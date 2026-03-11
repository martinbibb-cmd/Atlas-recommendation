import type { EngineInputV2_3, StoredDhwV1Result, StoredDhwFlagItem } from '../schema/EngineInputV2_3';
import {
  computeTapMixing,
  computeUsableVolumeFactor,
  defaultStoreTempForRegime,
  DEFAULT_STORED_BOILER_STORE_TEMP_C,
  type DhwStorageRegime,
} from '../utils/dhwMixing';

/** Minimum mains dynamic flow (L/min) for an unvented cylinder to perform well. */
const UNVENTED_MIN_ADEQUATE_LPM = 18;

/** Nominal cylinder coil reheat rate (kW) for a clean coil. */
const NOMINAL_REHEAT_KW = 12;

/**
 * StoredDhwModuleV1
 *
 * Deterministic stored-cylinder (DHW) eligibility and sizing-proxy module based
 * on four physics / practical rules:
 *   1. Space gate      – available cylinder space is tight or unknown → warn (suppressed
 *                        for unvented when mains flow is confirmed adequate)
 *   2. Vented/unvented – for unvented (mains_true), gates on mains flow adequacy
 *   3. Demand gate     – high occupancy or many bathrooms → recommend larger volume / Mixergy
 *   4. Combi fallback  – if combi simultaneous-demand fails, flag that Stored solves it
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

  // ── Rule 2 (new): Unvented mains-flow gate ────────────────────────────────
  // For unvented (mains-pressure) cylinders the principal viability check is
  // whether the mains supply can sustain the demand.  For vented (loft-tank)
  // systems this is not a gate because gravity-fed supply is normally adequate
  // for domestic cylinders.
  const isUnvented = coldWaterSource === 'mains_true' || coldWaterSource === 'mains_shared';
  const mainsFlowKnown = input.mainsDynamicFlowLpmKnown === true && input.mainsDynamicFlowLpm != null;
  const mainsFlowAdequate =
    mainsFlowKnown && input.mainsDynamicFlowLpm! >= UNVENTED_MIN_ADEQUATE_LPM;

  if (isUnvented) {
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
  } else if (coldWaterSource === 'loft_tank') {
    assumptions.push('Vented (gravity-fed) cylinder: loft-tank supply — mains flow gate not applicable.');
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
      title: 'High demand: stored solution recommended',
      detail:
        `${bathrooms} bathroom(s) and ${occupancy} occupant(s) suggest high simultaneous ` +
        `DHW demand. A stored cylinder eliminates the flow-rate and simultaneous-draw ` +
        `limitations of an on-demand (combi) system.`,
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
