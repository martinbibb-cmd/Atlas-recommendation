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

  // Resolve dynamic pressure from preferred alias or legacy field
  const dynamicPressureBar =
    input.dynamicMainsPressureBar ?? input.dynamicMainsPressure;
  const mainsPressureAdequate =
    dynamicPressureBar !== undefined && dynamicPressureBar >= UNVENTED_MIN_ADEQUATE_PRESSURE_BAR;

  if (isUnvented) {
    // ── B1: Mains dynamic pressure ──────────────────────────────────────────
    if (dynamicPressureBar !== undefined && !mainsPressureAdequate) {
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
    } else if (mainsPressureAdequate) {
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
        title: 'Mains flow below optimal for unvented cylinder',
        detail:
          `Measured mains flow ${input.mainsDynamicFlowLpm} L/min is below the ` +
          `~${UNVENTED_MIN_ADEQUATE_LPM} L/min recommended for an unvented cylinder. ` +
          `The system will still work but simultaneous draws may disappoint — ` +
          `shower experience may be weak when multiple outlets run together.`,
      });
    } else if (!mainsFlowKnown) {
      flags.push({
        id: 'stored-unvented-flow-unknown',
        severity: 'warn',
        title: 'Mains flow not confirmed for unvented cylinder',
        detail:
          `Unvented cylinder viability depends on adequate mains flow (≥${UNVENTED_MIN_ADEQUATE_LPM} L/min). ` +
          `No measured reading has been provided — carry out a flow test before specifying an unvented cylinder.`,
      });
    } else {
      assumptions.push(
        `Unvented (mains-pressure) cylinder: measured mains flow ` +
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

  // ── Rule 1a: Space tight + high demand → Mixergy recommended ────────────
  if (space === 'tight' && isHighDemand) {
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
  // Mixergy when space is tight or when high demand (fast usable hot water advantage).
  const recommendedType: StoredDhwV1Result['recommended']['type'] =
    space === 'tight' || isHighDemand ? 'mixergy' : 'standard';

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
