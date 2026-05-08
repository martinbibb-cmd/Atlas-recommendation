import type { EngineInputV2_3, StoredDhwV1Result, StoredDhwFlagItem, StoredDhwConstraintKind } from '../schema/EngineInputV2_3';
import {
  computeTapMixing,
  computeUsableVolumeFactor,
  defaultStoreTempForRegime,
  DEFAULT_STORED_BOILER_STORE_TEMP_C,
  type DhwStorageRegime,
} from '../utils/dhwMixing';

/** Minimum mains dynamic flow (L/min) for an unvented cylinder to perform well. */
const UNVENTED_MIN_ADEQUATE_LPM = 18;

/** Minimum mains dynamic pressure (bar) for reliable unvented cylinder operation. */
const UNVENTED_MIN_ADEQUATE_PRESSURE_BAR = 1.5;

/** Nominal cylinder coil reheat rate (kW) for a clean coil. */
const NOMINAL_REHEAT_KW = 12;

/** Minimum gravity head (m) above the draw-off point for a vented (open-vented) system. */
const VENTED_MIN_ADEQUATE_HEAD_M = 0.5;

/** Very low head threshold (m) for vented systems — below this, shower experience is poor. */
const VENTED_VERY_LOW_HEAD_M = 0.3;

/** Physics constant: 1 m water column ≈ 0.0981 bar. */
const METRES_HEAD_TO_BAR = 0.0981;

/** Nominal mains dynamic pressure (bar) used when no measurement is provided for unvented. */
const UNVENTED_NOMINAL_MAINS_PRESSURE_BAR = 2.0;

/** Nominal gravity head (m) used when no measurement is provided for open-vented. */
const VENTED_NOMINAL_HEAD_M = 1.0;

/** Marginal mains flow threshold (L/min) — below this, flow is limited but not zero. */
const UNVENTED_MARGINAL_LPM = 12;

/**
 * Nominal gravity-fed flow rate (L/min) at VENTED_NOMINAL_HEAD_M.
 * Used in the legacy sqrt-head flow cap (backward-compatible path).
 * Scales with √(head) via the Torricelli / orifice-flow relationship.
 */
const VENTED_BASE_FLOW_LPM = 10;

// ─── Branch hydraulic model constants ────────────────────────────────────────

/**
 * Base flow (L/min) for the branch hydraulic model at nominal conditions:
 * 1 m head, 15 mm pipe, 5 m equivalent length, shower outlet.
 *
 * Calibrated so that nominal-condition output matches real-world experience
 * of a gravity shower on a typical domestic 15 mm branch run.
 */
const BRANCH_BASE_FLOW_LPM = 9.0;

/**
 * Reference equivalent pipe length (m) for the branch model.
 * Route resistance is expressed as (equivalentLengthM / BRANCH_NOMINAL_LENGTH_M).
 */
const BRANCH_NOMINAL_LENGTH_M = 5.0;

/**
 * Pipe bore diameter factors relative to 15 mm baseline.
 * Based on cross-sectional area ratio (d_bore / 13)^2 using approximate
 * UK copper bore sizes; rounded to practical multipliers for explainability.
 */
const PIPE_DIAMETER_FACTOR: Record<15 | 22 | 28, number> = {
  15: 1.0,   // baseline
  22: 2.15,  // (20/13.6)^2 ≈ 2.15 — typical UK 22 mm copper bore
  28: 3.54,  // (25.6/13.6)^2 ≈ 3.54 — typical UK 28 mm copper bore
};

/**
 * Outlet resistance factors (dimensionless divisor applied to branch flow).
 * Higher values mean more restrictive outlets.
 *
 * tap          — wide-open tap, low resistance.
 * bath         — larger-bore tap/fill, moderate restriction.
 * shower       — gravity shower head, moderate-high restriction.
 * mixer_shower — thermostatic/pressure-balancing mixer, highest restriction.
 */
const OUTLET_RESISTANCE_FACTOR: Record<'tap' | 'bath' | 'shower' | 'mixer_shower', number> = {
  tap:          1.0,
  bath:         1.2,
  shower:       1.5,
  mixer_shower: 1.8,
};

/** Minimum effective flow (L/min) for a branch to be classified 'stable'. */
const BRANCH_ADEQUATE_FLOW_LPM = 7.0;

/** Minimum effective flow (L/min) for a branch to be classified 'marginal' (below = 'limited'). */
const BRANCH_MARGINAL_FLOW_LPM = 4.0;

/**
 * Minimum cylinder volume (litres) per bathroom for the thermal-capacity adequacy check.
 * Each bathroom represents a full hot-water draw point.
 */
const MIN_LITRES_PER_BATHROOM = 80;

/**
 * Additional minimum cylinder volume (litres) per occupant beyond the first two.
 * Two occupants share capacity; each additional person adds incremental draw demand.
 */
const MIN_LITRES_PER_EXTRA_OCCUPANT = 25;

/** Absolute floor for minimum cylinder volume (litres). */
const MIN_CYLINDER_VOLUME_LITRES = 100;

/**
 * Typical heat pump COP range for space heating (low-temperature circuit).
 * Used in the efficiency-penalty flag to contextualise DHW COP degradation.
 */
const HP_SPACE_HEATING_COP_RANGE = '2.5–3.5';

/**
 * Typical heat pump COP range when heating a cylinder to 50–55 °C.
 * Substantially lower than space-heating COP due to higher lift temperature.
 */
const HP_DHW_COP_RANGE = '1.5–2.0';

/**
 * StoredDhwModuleV1
 *
 * Deterministic stored-cylinder (DHW) eligibility and sizing-proxy module based
 * on physics / practical rules covering the correct governing constraints:
 *
 *   Vented systems:     head-limited   — gravity head determines pressure/flow delivery
 *   Unvented systems:   mains-limited  — dynamic pressure and flow adequacy govern operation
 *   All stored systems: thermal-capacity-limited — cylinder volume vs simultaneous demand
 *   Heat pump cylinder: reduced-efficiency — COP collapses at DHW storage temperatures
 *   All stored systems: recovery-limited — reheat rate bounded by coil condition / heat source
 */
export function runStoredDhwModuleV1(
  input: EngineInputV2_3,
  combiSimultaneousFailed: boolean = false,
): StoredDhwV1Result {
  const flags: StoredDhwFlagItem[] = [];
  const assumptions: string[] = [];

  const space = input.availableSpace ?? 'unknown';
  const bathrooms = input.bathroomCount ?? 1;
  const occupancy = input.occupancyCount ?? (input.highOccupancy ? 4 : 2);
  const coldWaterSource = input.coldWaterSource ?? 'unknown';

  const isHighDemand = bathrooms >= 2 || occupancy >= 4;

  // ── Rule A: Vented head evaluation ────────────────────────────────────────
  // For open-vented (gravity-fed) systems the governing constraint is the
  // available cold-water service head above the draw-off point.  Poor head
  // directly limits delivery pressure and shower experience.
  const isVented = coldWaterSource === 'loft_tank';
  if (isVented) {
    if (input.cwsHeadMetres !== undefined) {
      const head = input.cwsHeadMetres;
      if (head < VENTED_VERY_LOW_HEAD_M) {
        flags.push({
          id: 'stored-vented-low-head',
          severity: 'warn',
          title: 'Very low tank-fed head — head-limited system',
          detail:
            `Measured CWS head of ${head.toFixed(1)} m is very low (below ${VENTED_VERY_LOW_HEAD_M} m). ` +
            `At this head, tank-fed hot water delivery pressure will be very weak — shower experience is likely ` +
            `to be poor and a shower pump or pressurisation unit should be specified. ` +
            `This is a head-limited system: the governing constraint is the height difference ` +
            `between the cold-water storage tank and the draw-off points.`,
        });
      } else if (head < VENTED_MIN_ADEQUATE_HEAD_M) {
        flags.push({
          id: 'stored-vented-low-head',
          severity: 'warn',
          title: 'Low tank-fed head — marginal delivery margin',
          detail:
            `Measured CWS head of ${head.toFixed(1)} m is below the ${VENTED_MIN_ADEQUATE_HEAD_M} m ` +
            `minimum recommended for an open-vented tank-fed system. Shower flow rate will be marginal ` +
            `and simultaneous draws may cause noticeable pressure drop. ` +
            `Consider a shower pump to boost delivery pressure.`,
        });
      } else {
        assumptions.push(
          `Vented (tank-fed) cylinder: CWS head ${head.toFixed(1)} m ≥ ` +
          `${VENTED_MIN_ADEQUATE_HEAD_M} m — tank-fed head adequate.`,
        );
      }
    } else {
      assumptions.push(
        'Vented (tank-fed) cylinder: loft-tank supply — CWS head not provided; ' +
        'mains flow gate not applicable.',
      );
    }
  }

  // ── Rule B: Unvented mains-flow and pressure gate ─────────────────────────
  // For unvented (mains-pressure) cylinders the principal viability checks are:
  //   1. Mains dynamic pressure — drives fill rate and simultaneous-outlet delivery
  //   2. Mains dynamic flow    — determines whether peak demand can be sustained
  // Vented (loft-tank) systems bypass both checks.
  const isUnvented = coldWaterSource === 'mains_true' || coldWaterSource === 'mains_shared';
  const mainsFlowKnown = input.mainsDynamicFlowLpmKnown === true && input.mainsDynamicFlowLpm != null;
  const mainsFlowAdequate =
    mainsFlowKnown && input.mainsDynamicFlowLpm! >= UNVENTED_MIN_ADEQUATE_LPM;

  // Resolve dynamic pressure from preferred alias or legacy field.
  // Note: 0 bar is a valid discrete reading that means "full open / maximum flow test".
  // mainsPressureRecorded === false means pressure was not measured at all (e.g. flow-cup only).
  const dynamicPressureBar =
    input.dynamicMainsPressureBar ?? input.dynamicMainsPressure;

  // "Full open" reading: pressure measured as 0 bar with the tap at full bore.
  // This is the standard UK unvented sizing test — the measured flow rate IS the
  // maximum achievable supply. Pressure adequacy is assessed via the flow reading alone
  // when 0 bar (full open) is the selected measurement point.
  const isFullOpenReading =
    dynamicPressureBar === 0 && input.mainsPressureRecorded !== false;

  const mainsPressureAdequate =
    (dynamicPressureBar !== undefined && dynamicPressureBar >= UNVENTED_MIN_ADEQUATE_PRESSURE_BAR) ||
    // 0 bar full-open with adequate flow is equivalent to a confirmed adequate supply:
    // the measured flow at full bore is the sizing value, not the pressure reading.
    (isFullOpenReading && mainsFlowAdequate);

  if (isUnvented) {
    // ── B1: Mains dynamic pressure ──────────────────────────────────────────
    if (isFullOpenReading) {
      // 0 bar full-open: pressure check is replaced by a flow-only assessment.
      // Emit an informational note; the flow gate below determines adequacy.
      assumptions.push(
        `Unvented (mains-pressure) cylinder: dynamic pressure recorded as 0 bar (full-open test). ` +
        `Maximum achievable mains flow rate is determined by the measured flow value.`
      );
    } else if (dynamicPressureBar !== undefined && !mainsPressureAdequate) {
      flags.push({
        id: 'stored-mains-limited',
        severity: 'warn',
        title: 'Low mains dynamic pressure — mains-limited system',
        detail:
          `Dynamic mains pressure of ${dynamicPressureBar.toFixed(2)} bar is below the ` +
          `${UNVENTED_MIN_ADEQUATE_PRESSURE_BAR} bar recommended minimum for an unvented cylinder. ` +
          `Low mains pressure limits simultaneous-outlet delivery and may cause pressure fluctuations ` +
          `during back-to-back draws. This is a mains-limited system: the governing constraint is ` +
          `the incoming mains supply, not the cylinder itself.`,
      });
    } else if (mainsPressureAdequate && !isFullOpenReading) {
      assumptions.push(
        `Unvented (mains-pressure) cylinder: dynamic pressure ` +
        `${dynamicPressureBar!.toFixed(2)} bar ≥ ${UNVENTED_MIN_ADEQUATE_PRESSURE_BAR} bar — adequate.`,
      );
    }

    // ── B2: Mains dynamic flow ──────────────────────────────────────────────
    if (mainsFlowKnown && !mainsFlowAdequate) {
      flags.push({
        id: 'stored-unvented-low-flow',
        severity: 'warn',
        title: isFullOpenReading
          ? 'Mains flow at full bore below optimal for unvented cylinder'
          : 'Mains flow below optimal for unvented cylinder',
        detail: isFullOpenReading
          ? `Maximum mains flow (measured at 0 bar full open) is ${input.mainsDynamicFlowLpm} L/min — ` +
            `below the ~${UNVENTED_MIN_ADEQUATE_LPM} L/min recommended for an unvented cylinder. ` +
            `The system will still work but simultaneous draws may disappoint.`
          : `Measured mains flow ${input.mainsDynamicFlowLpm} L/min is below the ` +
            `~${UNVENTED_MIN_ADEQUATE_LPM} L/min recommended for an unvented cylinder. ` +
            `The system will still work but simultaneous draws may disappoint — ` +
            `shower experience may be weak when multiple outlets run together.`,
      });
    } else if (!mainsFlowKnown) {
      flags.push({
        id: 'stored-unvented-flow-unknown',
        severity: 'warn',
        title: 'Mains flow not confirmed for unvented cylinder',
        detail: isFullOpenReading
          ? `0 bar (full-open) pressure recorded. Carry out a flow test at full bore to confirm ` +
            `maximum mains flow rate — this reading is required for unvented cylinder sizing.`
          : `Unvented cylinder viability depends on adequate mains flow (≥${UNVENTED_MIN_ADEQUATE_LPM} L/min). ` +
            `No measured reading has been provided — carry out a flow test before specifying an unvented cylinder.`,
      });
    } else {
      assumptions.push(
        isFullOpenReading
          ? `Unvented (mains-pressure) cylinder: maximum mains flow (0 bar full-open test) ` +
            `${input.mainsDynamicFlowLpm} L/min ≥ ${UNVENTED_MIN_ADEQUATE_LPM} L/min — mains supply adequate.`
          : `Unvented (mains-pressure) cylinder: measured mains flow ` +
            `${input.mainsDynamicFlowLpm} L/min ≥ ${UNVENTED_MIN_ADEQUATE_LPM} L/min — mains supply adequate.`,
      );
    }
  }

  // ── Rule 1: Space gate ────────────────────────────────────────────────────
  // For unvented systems with confirmed adequate mains flow, space-unknown is
  // downgraded to 'info' (the key viability question is answered; space is a
  // physical constraint to survey, not a system-viability gate).
  const spaceUnknownSeverity: StoredDhwFlagItem['severity'] =
    isUnvented && mainsFlowAdequate ? 'info' : 'warn';

  // ── Rule 1 (pre-check): No space at all → hard block on cylinder ─────────
  if (space === 'none') {
    flags.push({
      id: 'stored-space-none',
      severity: 'warn',
      title: 'No cylinder space — stored DHW not feasible',
      detail:
        'No suitable space for a hot water cylinder has been confirmed at this property. ' +
        'Any system requiring a cylinder (system boiler, regular boiler, heat pump) is not ' +
        'feasible unless additional space can be created. Only on-demand (combi) delivery ' +
        'should be considered.',
    });
  } else if (space === 'tight' && isHighDemand) {
    // ── Rule 1a: Space tight + high demand → Mixergy recommended ────────────
    flags.push({
      id: 'stored-space-tight',
      severity: 'warn',
      title: 'Space constraint',
      detail:
        `Available space is tight with ${bathrooms} bathroom(s) / ${occupancy} occupant(s). ` +
        `A Mixergy cylinder's stratified heating allows a smaller footprint to deliver ` +
        `the same usable hot water as a larger conventional cylinder.`,
    });
  } else if (space === 'tight') {
    // ── Rule 1b: Space tight + low demand → still warn but standard may work ─
    flags.push({
      id: 'stored-space-tight',
      severity: 'warn',
      title: 'Space constraint',
      detail:
        `Available space is tight. A compact cylinder or Mixergy unit should be ` +
        `considered to avoid installation issues.`,
    });
  } else if (space === 'unknown') {
    // ── Rule 1c: Space unknown → warn (or info for unvented with adequate mains) ──
    flags.push({
      id: 'stored-space-unknown',
      severity: spaceUnknownSeverity,
      title: 'Cylinder space not confirmed',
      detail:
        `Available space for a cylinder has not been confirmed. Survey the airing ` +
        `cupboard or utility area before specifying a cylinder size.`,
    });
  } else {
    assumptions.push('availableSpace is "ok" – no space constraint applied.');
  }

  // ── Rule 2: High demand flag ──────────────────────────────────────────────
  if (isHighDemand) {
    flags.push({
      id: 'stored-high-demand',
      severity: 'info',
      title: 'Multi-outlet demand profile: stored hot water handles concurrency well',
      detail:
        `${bathrooms} bathroom(s) and ${occupancy} occupant(s) indicate a multi-outlet ` +
        `demand profile. Stored hot water decouples delivery from instantaneous heat ` +
        `transfer capacity — simultaneous draws are served from the stored volume ` +
        `without the throughput constraints of an on-demand combi system.`,
    });
  } else {
    assumptions.push(
      `Low demand profile (${bathrooms} bathroom(s), ${occupancy} occupant(s)) – ` +
      'high-demand flag omitted.',
    );
  }

  // ── Rule 3: Combi simultaneous-demand failure → stored solves it ─────────
  if (combiSimultaneousFailed) {
    flags.push({
      id: 'stored-solves-simultaneous-demand',
      severity: 'info',
      title: 'Stored cylinder solves simultaneous demand',
      detail:
        `The on-demand (combi) system was rejected due to simultaneous hot-water ` +
        `demand. A stored cylinder provides a buffer that meets multiple simultaneous ` +
        `draws without temperature collapse.`,
    });
  }

  // ── Rule C: Thermal capacity check ───────────────────────────────────────
  // Evaluate whether the cylinder volume is adequate for the occupancy/bathroom
  // demand profile.  When cylinderVolumeLitres is provided, compare against the
  // minimum adequate volume derived from bathrooms and occupancy.
  //
  // Minimum adequate volume:
  //   base = bathroomCount × MIN_LITRES_PER_BATHROOM
  //   extra = max(0, occupancyCount − 2) × MIN_LITRES_PER_EXTRA_OCCUPANT
  //   min_litres = max(MIN_CYLINDER_VOLUME_LITRES, base + extra)
  //
  // For 'high' simultaneousDrawSeverity, apply a 20% additional reserve.
  //
  // When currentCylinderPresent === false, record "no cylinder installed" as an
  // assumption rather than raising a thermal-capacity warning — the constraint
  // is the absence of storage, not an undersized one.
  if (input.currentCylinderPresent === false && input.cylinderVolumeLitres === undefined) {
    assumptions.push('No cylinder currently installed — thermal capacity check skipped.');
  } else if (input.cylinderVolumeLitres !== undefined) {
    const drawSeverity = input.simultaneousDrawSeverity ?? 'low';
    const severityMultiplier = drawSeverity === 'high' ? 1.2 : drawSeverity === 'medium' ? 1.1 : 1.0;
    const baseMin = bathrooms * MIN_LITRES_PER_BATHROOM;
    const extraMin = Math.max(0, occupancy - 2) * MIN_LITRES_PER_EXTRA_OCCUPANT;
    const minAdequate = Math.round(
      Math.max(MIN_CYLINDER_VOLUME_LITRES, baseMin + extraMin) * severityMultiplier,
    );

    if (input.cylinderVolumeLitres < minAdequate) {
      flags.push({
        id: 'stored-thermal-capacity-limited',
        severity: 'warn',
        title: 'Cylinder undersized — thermal-capacity-limited',
        detail:
          `Cylinder volume ${input.cylinderVolumeLitres} L is below the estimated minimum ` +
          `${minAdequate} L for ${bathrooms} bathroom(s) and ${occupancy} occupant(s)` +
          (drawSeverity !== 'low' ? ` with ${drawSeverity} simultaneous draw severity` : '') +
          `. The cylinder will run out of hot water during peak back-to-back draws. ` +
          `This is a thermal-capacity-limited system: the constraint is stored energy, ` +
          `not delivery pressure. Upgrade to a larger cylinder or add a Mixergy unit ` +
          `to maximise usable capacity from the available volume.`,
      });
    } else {
      assumptions.push(
        `Cylinder volume ${input.cylinderVolumeLitres} L ≥ ` +
        `estimated minimum ${minAdequate} L — thermal capacity adequate.`,
      );
    }
  }

  // ── Rule 4: Cylinder condition degradation ────────────────────────────────
  const insulationFactor    = input.cylinderInsulationFactor    ?? 1.0;
  const coilTransferFactor  = input.cylinderCoilTransferFactor  ?? 1.0;
  const cylConditionBand    = input.cylinderConditionBand;

  const hasCylinderConditionData = input.cylinderInsulationFactor !== undefined;
  const standingLossRelative = parseFloat((1.0 / insulationFactor).toFixed(2));

  if (hasCylinderConditionData && cylConditionBand && cylConditionBand !== 'good') {
    // Build implication text based on the worse of the two factors
    const insulationDegraded = insulationFactor < 0.95;
    const coilDegraded       = coilTransferFactor < 1.0;

    const implicationParts: string[] = [];
    if (insulationDegraded) {
      const standingLossIncreasePct = Math.round((1.0 / insulationFactor - 1.0) * 100);
      implicationParts.push(`standing losses likely elevated (~${standingLossIncreasePct}% above a modern equivalent)`);
    }
    if (coilDegraded) {
      const reheatReductionPct = Math.round((1.0 - coilTransferFactor) * 100);
      implicationParts.push(`recovery time likely longer than expected (~${reheatReductionPct}% reduction in reheat rate)`);
    }

    const implicationText = implicationParts.length > 0
      ? implicationParts.join('; ') + '.'
      : 'stored hot water performance may be below that of a modern cylinder.';

    // Guidance by condition band
    const guidanceParts: string[] = [];
    if (cylConditionBand === 'moderate') {
      guidanceParts.push(
        'Check insulation and lagging quality. Monitor recovery time — if slower than expected, investigate the coil.',
      );
    } else if (cylConditionBand === 'poor') {
      guidanceParts.push(
        'Inspect insulation lagging and coil condition. Consider cylinder replacement or upgrade to a modern factory-insulated unit.',
      );
    } else if (cylConditionBand === 'severe') {
      guidanceParts.push(
        'Cylinder condition is severely degraded. Replacement is strongly recommended. ' +
        'A modern factory-insulated or Mixergy cylinder would significantly reduce standing losses and improve recovery.',
      );
    }

    const detail =
      `Cylinder condition: ${cylConditionBand}. ` +
      `Insulation factor ${insulationFactor.toFixed(2)}, coil transfer factor ${coilTransferFactor.toFixed(2)}. ` +
      implicationText +
      (guidanceParts.length > 0 ? ' ' + guidanceParts[0] : '');

    flags.push({
      id: 'stored-cylinder-condition',
      severity: cylConditionBand === 'moderate' ? 'info' : 'warn',
      title: `Cylinder Condition: ${cylConditionBand.charAt(0).toUpperCase() + cylConditionBand.slice(1)}`,
      detail,
    });

    // Recovery-limited flag: emit separately when coil is significantly degraded
    // so the constraintKind logic can surface this as the primary constraint.
    if (coilTransferFactor < 0.85) {
      const effectiveReheatKw = parseFloat((coilTransferFactor * NOMINAL_REHEAT_KW).toFixed(1));
      flags.push({
        id: 'stored-recovery-limited',
        severity: 'warn',
        title: 'Slow recovery — recovery-limited system',
        detail:
          `Coil transfer factor ${coilTransferFactor.toFixed(2)} reduces effective reheat rate to ` +
          `~${effectiveReheatKw} kW (nominal ${NOMINAL_REHEAT_KW} kW). ` +
          `Recovery time after a large draw will be extended — the system is recovery-limited. ` +
          `Descale or replace the coil to restore reheat capacity.`,
      });
    }
  }

  if (hasCylinderConditionData) {
    assumptions.push(
      `Cylinder insulation factor: ${insulationFactor.toFixed(2)} ` +
      `(standing loss ${standingLossRelative}× nominal). ` +
      `Coil transfer factor: ${coilTransferFactor.toFixed(2)} ` +
      `(reheat rate ${parseFloat((coilTransferFactor * NOMINAL_REHEAT_KW).toFixed(1))} kW vs ` +
      `${NOMINAL_REHEAT_KW} kW nominal).`,
    );
  }

  // ── Rule 5: Storage temperature regime ───────────────────────────────────
  // Resolve the effective storage regime and derive a store temperature for mixing.
  // Priority: explicit storeTempC > regime-derived temp > legacy default.
  const resolvedRegime: DhwStorageRegime = input.dhwStorageRegime ?? 'boiler_cylinder';

  let effectiveStoreTempC: number;
  if (input.storeTempC !== undefined) {
    // Explicit override always wins
    effectiveStoreTempC = input.storeTempC;
  } else {
    effectiveStoreTempC =
      defaultStoreTempForRegime(resolvedRegime) ?? DEFAULT_STORED_BOILER_STORE_TEMP_C;
  }

  // Emit an info flag when the regime is 'heat_pump_cylinder' so the UI can
  // surface the lower-temperature storage explanation.
  if (resolvedRegime === 'heat_pump_cylinder') {
    flags.push({
      id: 'stored-heat-pump-recovery',
      severity: 'info',
      title: 'Stored hot water (heat pump cylinder)',
      detail:
        `Heat pump cylinders are typically stored at a lower temperature (≈${effectiveStoreTempC} °C) ` +
        `than boiler cylinders (≈60–65 °C). This means a higher proportion of stored water ` +
        `is drawn at each outlet — so the effective usable volume is more sensitive to ` +
        `simultaneous demand and recovery speed than an identically-sized boiler cylinder.`,
    });

    // Separate efficiency-penalty warn flag: heat pump DHW involves a COP collapse
    // at cylinder heating temperatures that must not be presented as neutral.
    flags.push({
      id: 'stored-heat-pump-efficiency-penalty',
      severity: 'warn',
      title: 'Reduced-efficiency hot water mode — heat pump COP penalty',
      detail:
        `Heating a cylinder to ${effectiveStoreTempC} °C requires the heat pump to operate at a ` +
        `high lift temperature, causing a significant COP collapse. ` +
        `Typical heat pump COP for space heating (low-temperature circuit): ${HP_SPACE_HEATING_COP_RANGE}. ` +
        `Typical COP when heating a cylinder to 50–55 °C: ${HP_DHW_COP_RANGE}. ` +
        `This is reduced-efficiency hot water mode — heat pump DHW generation is not thermally neutral. ` +
        `Specify a Mixergy cylinder or large-volume buffer to minimise the frequency of ` +
        `cylinder reheat cycles and reduce time in this penalised operating mode.`,
    });

    assumptions.push(
      `Storage regime: heat pump cylinder (${effectiveStoreTempC} °C store). ` +
      `Usable volume reduced relative to a boiler cylinder at the same nominal size.`,
    );
  } else {
    assumptions.push(
      `Storage regime: boiler cylinder (${effectiveStoreTempC} °C store). ` +
      `Higher store temperature gives more cold dilution at outlets — good concurrency resilience.`,
    );
  }

  // Compute usable volume factor relative to a reference 60 °C boiler cylinder
  const resolvedUsableVolumeFactor = computeUsableVolumeFactor({
    storeTempC: effectiveStoreTempC,
    tapTargetTempC: input.tapTargetTempC,
    coldWaterTempC: input.coldWaterTempC,
  });

  // ── Determine primary constraint kind ────────────────────────────────────
  // Order of precedence: head-limited > mains-limited > thermal-capacity-limited
  //                      > recovery-limited > reduced-efficiency-hot-water
  let constraintKind: StoredDhwConstraintKind | undefined;
  if (flags.some(f => f.id === 'stored-vented-low-head')) {
    constraintKind = 'head-limited';
  } else if (flags.some(f => f.id === 'stored-mains-limited')) {
    constraintKind = 'mains-limited';
  } else if (flags.some(f => f.id === 'stored-thermal-capacity-limited')) {
    constraintKind = 'thermal-capacity-limited';
  } else if (flags.some(f => f.id === 'stored-recovery-limited')) {
    constraintKind = 'recovery-limited';
  } else if (flags.some(f => f.id === 'stored-heat-pump-efficiency-penalty')) {
    constraintKind = 'reduced-efficiency-hot-water';
  }

  // ── Determine overall storedRisk verdict ─────────────────────────────────
  const storedRisk: StoredDhwV1Result['verdict']['storedRisk'] =
    flags.some(f => f.severity === 'warn') ? 'warn' : 'pass';

  // ── Recommend cylinder type ───────────────────────────────────────────────
  // Mixergy is recommended only when at least two qualifying signals are present,
  // OR when the user has explicitly requested it (dhwTankType === 'mixergy').
  //
  // Qualifying signals (per Atlas physics rules):
  //   1. Space is tight — Mixergy's stratified heating reduces effective footprint.
  //   2. Solar PV installed or planned — Mixergy's smart immersion pairs well with diverters.
  //   3. High occupancy (4+ occupants) — faster usable volume turnover.
  //
  // Single signals such as bathroomCount >= 2 alone are NOT sufficient to recommend
  // Mixergy — this avoids leaking a Mixergy upsell into every two-bathroom home.
  const mixergySignalCount = [
    space === 'tight',                                                     // confirmed space constraint
    input.pvStatus === 'existing' || input.pvStatus === 'planned',         // solar PV installed or committed
    input.highOccupancy === true || occupancy >= 4,                        // high occupancy
  ].filter(Boolean).length;

  const recommendedType: StoredDhwV1Result['recommended']['type'] =
    mixergySignalCount >= 2 ? 'mixergy' : 'standard';

  // ── Recommend volume band ─────────────────────────────────────────────────
  let volumeBand: StoredDhwV1Result['recommended']['volumeBand'];
  if (occupancy >= 5 || bathrooms >= 3) {
    volumeBand = 'large';
  } else if (occupancy >= 3 || bathrooms >= 2) {
    volumeBand = 'medium';
  } else {
    volumeBand = 'small';
  }

  return {
    verdict: { storedRisk },
    recommended: { type: recommendedType, volumeBand },
    flags,
    assumptions,
    ...(constraintKind !== undefined && { constraintKind }),
    storageRegime: resolvedRegime,
    usableVolumeFactor: resolvedUsableVolumeFactor,
    dhwMixing: computeTapMixing({
      storeTempC: effectiveStoreTempC,
      tapTargetTempC: input.tapTargetTempC,
      coldWaterTempC: input.coldWaterTempC,
      mixedFlowLpm: input.dhwMixedFlowLpm,
    }),
    ...(hasCylinderConditionData && {
      cylinderCondition: {
        conditionBand: cylConditionBand ?? 'good',
        insulationFactor,
        coilTransferFactor,
        standingLossRelative,
      },
    }),
  };
}

// ─── Draw-off micro-behaviour ─────────────────────────────────────────────────

/**
 * Stability classification for draw-off flow under concurrent demand.
 *
 * stable   — adequate flow / head for sustained multi-outlet delivery.
 * marginal — borderline; acceptable for single outlets but may disappoint under load.
 * limited  — insufficient for reliable delivery; system is head-limited or flow-limited.
 */
export type DrawOffFlowStability = 'stable' | 'marginal' | 'limited';

/**
 * Cold-water source type for a vented branch.
 *
 * shared_cws     — branch draws from a shared cold-water storage cistern supplying both
 *                  hot and cold; pressure is balanced but cold competes with other outlets.
 * dedicated_cws  — separate cold branch from the same cistern; eliminates cold-side
 *                  competition and keeps hot/cold pressures balanced at a mixer.
 * mains_cold     — cold side is at mains pressure; creates a large hot/cold pressure
 *                  mismatch at mixer showers when the hot side is gravity-fed.
 */
export type VentedColdSource = 'shared_cws' | 'dedicated_cws' | 'mains_cold';

/**
 * Primary factor that most limits delivery on a vented branch.
 *
 * head             — gravity head (CWS height above draw-off) is the governing constraint.
 * pipe_diameter    — small bore (typically 15 mm) limits achievable flow.
 * route_length     — long equivalent pipe run creates high hydraulic resistance.
 * outlet_resistance — restrictive fixture (e.g. mixer shower) limits delivery.
 * mixer_imbalance  — significant hot/cold pressure mismatch degrades mixer performance.
 */
export type VentedLimitingFactor =
  | 'head'
  | 'pipe_diameter'
  | 'route_length'
  | 'outlet_resistance'
  | 'mixer_imbalance';

/**
 * Per-branch hydraulic inputs for vented draw-off assessment.
 *
 * Replaces the pure √(head) shortcut with a multi-factor model that captures
 * pipe bore, route resistance, outlet class, and mixer balance independently.
 *
 * Example usage:
 *   const shower: BranchHydraulics = {
 *     source: 'dedicated_cws',
 *     headM: 2.5,
 *     pipeMm: 22,
 *     equivalentLengthM: 8,
 *     outletClass: 'mixer_shower',
 *   };
 */
export interface BranchHydraulics {
  /**
   * Cold-water source for this branch.
   * Determines cold-side pressure and whether mixer balance is affected.
   */
  source: VentedColdSource;
  /**
   * Gravity head from the CWS cistern surface to the draw-off point (m).
   * Used for `shared_cws` and `dedicated_cws` sources.
   * Defaults to VENTED_NOMINAL_HEAD_M when absent.
   */
  headM?: number;
  /** Nominal pipe bore for this branch (mm). */
  pipeMm: 15 | 22 | 28;
  /**
   * Total equivalent pipe length including fittings (m).
   * Each elbow adds ≈ 0.5–1 m; each gate valve ≈ 0.1 m; each ball valve ≈ 0.4 m.
   */
  equivalentLengthM: number;
  /** Outlet fixture class — determines outlet resistance factor. */
  outletClass: 'tap' | 'bath' | 'shower' | 'mixer_shower';
}

/**
 * Micro-level draw-off behaviour for a stored-cylinder system archetype.
 *
 * This is intentionally distinct from the macro-level hourly energy accounting
 * in `computeSystemHourPhysics`: these values capture pressure and flow stability
 * characteristics that differ between mains-fed (unvented) and tank-fed
 * (open-vented) architectures even when thermal demand is identical.
 */
export interface DrawOffBehaviour {
  /** Maximum expected delivery pressure at the draw-off point (bar). */
  maxPressureBar: number;
  /** Flow stability classification under concurrent draw. */
  flowStability: DrawOffFlowStability;
  /**
   * Best-estimate flow cap (L/min) for tank-fed (open-vented) systems.
   *
   * When `BranchHydraulics` is supplied to `computeDrawOff`, this is derived
   * from the full branch hydraulic model (pipe bore + route resistance + outlet
   * class + mixer balance penalty).
   *
   * Without branch inputs, falls back to the legacy formula:
   *   VENTED_BASE_FLOW_LPM × √(head / VENTED_NOMINAL_HEAD_M)
   *
   * Undefined for mains-fed systems (flow is governed by mains supply, not head).
   */
  ventedMaxFlowLpm?: number;
  /**
   * Detailed branch hydraulic model breakdown.
   * Present only when `BranchHydraulics` was supplied to `computeDrawOff`.
   */
  branchModel?: {
    /** Effective flow after all factors and mixer balance penalty (L/min). */
    effectiveFlowLpm: number;
    /** Pipe bore multiplier relative to 15 mm baseline (≥ 1.0). */
    diameterFactor: number;
    /** Route resistance divisor (≥ 1.0); higher = more resistance. */
    routeResistanceFactor: number;
    /** Outlet class resistance divisor. */
    outletFactor: number;
    /**
     * Mixer balance penalty as a fraction (0 = none, 0.3 = severe).
     * Non-zero when cold source is `mains_cold` and hot/cold pressures are
     * significantly mismatched at a mixer fixture.
     */
    mixerBalancePenalty: number;
    /** Primary bottleneck for this branch. */
    limitingFactor: VentedLimitingFactor;
  };
}

/**
 * Compute draw-off micro-behaviour for a stored-cylinder system archetype.
 *
 * Mains-fed systems (mixergy / stored_unvented): governed by mains dynamic
 * pressure and flow rate.  Typical domestic mains pressure is 1.5–4 bar,
 * giving substantially higher and more stable delivery pressure than gravity.
 *
 * Tank-fed systems (mixergy_open_vented / stored_vented): governed by gravity
 * head — the height of the cold-water storage tank above the draw-off point.
 * Every metre of head contributes ≈ 0.098 bar; a typical domestic loft tank at
 * 1 m above the draw-off delivers only ≈ 0.1 bar — far below mains pressure.
 *
 * When `branchHydraulics` is supplied, the vented flow cap uses the full
 * branch model (pipe bore × route resistance × outlet class × mixer balance).
 * Without it, a legacy sqrt-head cap is applied for backward compatibility.
 *
 * @param systemType               Comparison system archetype.
 * @param mainsDynamicPressureBar  Measured mains dynamic pressure (bar).  Used
 *                                 for mains-fed systems only.  Defaults to
 *                                 UNVENTED_NOMINAL_MAINS_PRESSURE_BAR when absent.
 * @param mainsDynamicFlowLpm      Measured mains dynamic flow (L/min).  Used for
 *                                 mains-fed flow-stability classification.  When
 *                                 absent, stability is conservatively 'marginal'.
 * @param cwsHeadMetres            Gravity head (m) from CWS tank to draw-off.
 *                                 Used for tank-fed systems only when branch
 *                                 hydraulics are not provided.  Defaults to
 *                                 VENTED_NOMINAL_HEAD_M when absent.
 * @param branchHydraulics         Optional per-branch hydraulic inputs.  When
 *                                 supplied for a tank-fed system, enables the
 *                                 full branch hydraulic model.  `headM` inside
 *                                 the struct takes precedence over `cwsHeadMetres`.
 */
export function computeDrawOff(
  systemType: 'mixergy' | 'mixergy_open_vented' | 'stored_unvented' | 'stored_vented',
  mainsDynamicPressureBar?: number,
  mainsDynamicFlowLpm?: number,
  cwsHeadMetres?: number,
  branchHydraulics?: BranchHydraulics,
): DrawOffBehaviour {
  const isMainsFed = systemType === 'mixergy' || systemType === 'stored_unvented';

  if (isMainsFed) {
    const pressure = mainsDynamicPressureBar ?? UNVENTED_NOMINAL_MAINS_PRESSURE_BAR;

    let flowStability: DrawOffFlowStability;
    if (mainsDynamicFlowLpm === undefined) {
      // No measurement — conservatively assume marginal until confirmed
      flowStability = 'marginal';
    } else if (mainsDynamicFlowLpm >= UNVENTED_MIN_ADEQUATE_LPM) {
      flowStability = 'stable';
    } else if (mainsDynamicFlowLpm >= UNVENTED_MARGINAL_LPM) {
      flowStability = 'marginal';
    } else {
      flowStability = 'limited';
    }

    return { maxPressureBar: pressure, flowStability };
  } else {
    // Tank-fed (open-vented): gravity head governs delivery pressure.
    const head = branchHydraulics?.headM ?? cwsHeadMetres ?? VENTED_NOMINAL_HEAD_M;
    const pressure = parseFloat((head * METRES_HEAD_TO_BAR).toFixed(4));

    if (branchHydraulics !== undefined) {
      // ── Branch hydraulic model ────────────────────────────────────────────
      // Flow depends on head, pipe bore, route resistance, outlet class, and
      // whether cold supply is separately balanced or shared with hot.
      const branchModel = computeBranchFlow(
        head,
        branchHydraulics,
        mainsDynamicPressureBar ?? UNVENTED_NOMINAL_MAINS_PRESSURE_BAR,
      );

      const effectiveFlow = branchModel.effectiveFlowLpm;
      let flowStability: DrawOffFlowStability;
      if (effectiveFlow >= BRANCH_ADEQUATE_FLOW_LPM && head >= VENTED_MIN_ADEQUATE_HEAD_M) {
        flowStability = 'stable';
      } else if (effectiveFlow >= BRANCH_MARGINAL_FLOW_LPM && head >= VENTED_VERY_LOW_HEAD_M) {
        flowStability = 'marginal';
      } else {
        flowStability = 'limited';
      }

      return {
        maxPressureBar: pressure,
        flowStability,
        ventedMaxFlowLpm: parseFloat(effectiveFlow.toFixed(2)),
        branchModel,
      };
    } else {
      // ── Legacy sqrt-head cap (backward compatible) ────────────────────────
      // Flow ∝ √head (Torricelli / orifice-flow): at double the head you get
      // √2 × the flow, not 2×.  Used when branch hydraulics are not provided.
      const ventedMaxFlowLpm = parseFloat(
        (VENTED_BASE_FLOW_LPM * Math.sqrt(head / VENTED_NOMINAL_HEAD_M)).toFixed(2),
      );

      let flowStability: DrawOffFlowStability;
      if (head >= VENTED_MIN_ADEQUATE_HEAD_M) {
        flowStability = 'stable';
      } else if (head >= VENTED_VERY_LOW_HEAD_M) {
        flowStability = 'marginal';
      } else {
        flowStability = 'limited';
      }

      return { maxPressureBar: pressure, flowStability, ventedMaxFlowLpm };
    }
  }
}

// ─── Branch hydraulic model helper ───────────────────────────────────────────

/**
 * Compute effective branch flow for a vented draw-off using the branch
 * hydraulic model.
 *
 * Formula:
 *   rawFlowLpm = BRANCH_BASE_FLOW_LPM
 *                × √(headM / BRANCH_NOMINAL_HEAD_M)   ← head contribution
 *                × diameterFactor                      ← pipe bore multiplier
 *                / routeResistanceFactor               ← equivalent length divisor
 *                / outletFactor                        ← fixture restriction divisor
 *
 *   effectiveFlowLpm = rawFlowLpm × (1 − mixerBalancePenalty)
 *
 * Mixer balance penalty is non-zero only when `source === 'mains_cold'` and
 * the hot-side (gravity) pressure is significantly lower than cold-side
 * (mains) pressure — a classic vented-hot / mains-cold mismatch.
 *
 * @internal Not exported; called only by `computeDrawOff`.
 */
function computeBranchFlow(
  headM: number,
  branch: BranchHydraulics,
  mainsDynamicPressureBar: number,
): NonNullable<DrawOffBehaviour['branchModel']> {
  // Diameter factor: cross-sectional area relative to 15 mm baseline.
  const pipeMmKey = ([28, 22, 15] as const).find(k => branch.pipeMm >= k) ?? 15;
  const diameterFactor = PIPE_DIAMETER_FACTOR[pipeMmKey];

  // Route resistance: equivalent length relative to 5 m reference run.
  const routeResistanceFactor = Math.max(1.0, branch.equivalentLengthM / BRANCH_NOMINAL_LENGTH_M);

  // Outlet resistance.
  const outletFactor = OUTLET_RESISTANCE_FACTOR[branch.outletClass];

  // Raw branch flow before mixer balance adjustment.
  const rawFlowLpm =
    BRANCH_BASE_FLOW_LPM *
    Math.sqrt(headM / VENTED_NOMINAL_HEAD_M) *
    diameterFactor /
    (routeResistanceFactor * outletFactor);

  // Mixer balance penalty.
  // Only applies when cold supply is at mains pressure while hot is gravity-fed,
  // and only at mixing-valve fixtures where hot and cold are blended (not taps/baths
  // where the user adjusts handles independently).
  //
  // Thresholds are calibrated from observed UK field behaviour:
  //   ratio < 0.2  (e.g. 1 m head ≈ 0.098 bar vs 2 bar mains → ratio 0.049): the
  //                thermostatic cartridge cannot balance reliably — severe temperature
  //                swings, nuisance trips, and poor flow control.  30% effective-flow
  //                penalty reflects typical perceived performance loss.
  //   ratio 0.2–0.5 (e.g. 3 m head ≈ 0.294 bar vs 1.5 bar mains → ratio 0.196):
  //                noticeable pressure imbalance; cartridge fights a 3–5:1 difference.
  //                15% penalty captures the moderate, manageable degradation seen in
  //                practice when a pump or pressurisation unit is absent.
  //   ratio ≥ 0.5: pressures are within approximately 2:1 of each other; a standard
  //                thermostatic cartridge can compensate adequately — no penalty applied.
  let mixerBalancePenalty = 0;
  if (branch.source === 'mains_cold' && branch.outletClass !== 'tap' && branch.outletClass !== 'bath') {
    const hotPressureBar = headM * METRES_HEAD_TO_BAR;
    const pressureRatio = hotPressureBar / mainsDynamicPressureBar;
    if (pressureRatio < 0.2) {
      mixerBalancePenalty = 0.30;  // severe mismatch — gravity vs. mains
    } else if (pressureRatio < 0.5) {
      mixerBalancePenalty = 0.15;  // moderate mismatch
    }
  }

  const effectiveFlowLpm = rawFlowLpm * (1 - mixerBalancePenalty);

  const limitingFactor = determineLimitingFactor(
    headM,
    diameterFactor,
    routeResistanceFactor,
    outletFactor,
    mixerBalancePenalty,
  );

  return {
    effectiveFlowLpm: parseFloat(effectiveFlowLpm.toFixed(2)),
    diameterFactor,
    routeResistanceFactor: parseFloat(routeResistanceFactor.toFixed(2)),
    outletFactor,
    mixerBalancePenalty,
    limitingFactor,
  };
}

/**
 * Determine the single most constraining factor on a vented branch.
 * Used to generate human-readable explanations such as
 * "Shower weak because 15 mm long run" or "Dedicated cold feed improves
 * mixer balance but not hot-side head".
 *
 * @internal
 */
function determineLimitingFactor(
  headM: number,
  diameterFactor: number,
  routeResistanceFactor: number,
  outletFactor: number,
  mixerBalancePenalty: number,
): VentedLimitingFactor {
  // Mixer imbalance overrides physical constraints — it is a system design issue.
  if (mixerBalancePenalty >= 0.3) return 'mixer_imbalance';
  // Low head is the vented system's fundamental physical limit.
  if (headM < VENTED_MIN_ADEQUATE_HEAD_M) return 'head';
  // Long runs (≥ 15 m equivalent, i.e. routeResistanceFactor ≥ 3.0) dominate
  // resistance on real installations: a 22 mm pipe at 15 m still halves flow
  // compared to a 5 m run, overwhelming the pipe-size benefit.
  if (routeResistanceFactor >= 3.0) return 'route_length';
  // 15 mm pipe (diameterFactor = 1.0) is the bottleneck when the run is longer
  // than 1.5× the 5 m reference (i.e. > 7.5 m equivalent).  Below that, friction
  // on a short 15 mm run is manageable; above it the bore becomes the weak link.
  if (diameterFactor <= 1.0 && routeResistanceFactor > 1.5) return 'pipe_diameter';
  // Restrictive outlet (mixer shower) limits peak throughput even on a well-designed branch.
  if (outletFactor >= 1.8) return 'outlet_resistance';
  // Default: gravity head is always the underlying constraint on a vented system.
  return 'head';
}
