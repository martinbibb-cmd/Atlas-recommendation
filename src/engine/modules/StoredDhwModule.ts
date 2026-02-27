import type { EngineInputV2_3, StoredDhwV1Result, StoredDhwFlagItem } from '../schema/EngineInputV2_3';

/** Minimum mains dynamic flow (L/min) for an unvented cylinder to perform well. */
const UNVENTED_MIN_ADEQUATE_LPM = 18;

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
  };
}
