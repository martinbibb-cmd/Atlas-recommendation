import type { EngineInputV2_3, StoredDhwV1Result, StoredDhwFlagItem } from '../schema/EngineInputV2_3';

/**
 * StoredDhwModuleV1
 *
 * Deterministic stored-cylinder (DHW) eligibility and sizing-proxy module based
 * on three physics / practical rules:
 *   1. Space gate  – available cylinder space is tight or unknown → warn
 *   2. Demand gate – high occupancy or many bathrooms → recommend larger volume / Mixergy
 *   3. Combi fallback – if combi simultaneous-demand fails, flag that Stored solves it
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

  const isHighDemand = bathrooms >= 2 || occupancy >= 4;

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
    // ── Rule 1c: Space unknown → warn ────────────────────────────────────────
    flags.push({
      id: 'stored-space-unknown',
      severity: 'warn',
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
        `limitations of an instantaneous (combi) system.`,
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
        `The instantaneous (combi) system was rejected due to simultaneous hot-water ` +
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
