import type { EngineInputV2_3, RedFlagResult } from '../schema/EngineInputV2_3';

export function runRedFlagModule(input: EngineInputV2_3): RedFlagResult {
  const reasons: string[] = [];
  let rejectCombi = false;
  let rejectStored = false;
  let flagAshp = false;
  let rejectAshp = false;

  // Journey 1: Fast-Choice Red Flag triggers

  // 2+ bathrooms + high occupancy → Combi rejected (flow starvation)
  if (input.bathroomCount >= 2 && input.highOccupancy) {
    rejectCombi = true;
    reasons.push(
      `🚫 Combi Rejected: ${input.bathroomCount} bathrooms + high occupancy creates simultaneous ` +
      `draw scenarios that exceed combi on-demand flow capacity. Hot water starvation likely.`
    );
  }

  // Loft converted → Stored cylinder branch rejected (loss of gravity head and tank space)
  if (input.hasLoftConversion) {
    rejectStored = true;
    reasons.push(
      `🚫 Stored Cylinder Rejected: Loft conversion has eliminated the gravity "head" ` +
      `required for a vented F&E tank and cold water storage. Sealed system required.`
    );
  }

  // One-pipe topology → ASHP hard fail (return temp >55°C prevents condensing / ASHP operation)
  if (input.pipingTopology === 'one_pipe') {
    rejectAshp = true;
    flagAshp = true;
    reasons.push(
      `🚫 ASHP Hard Fail: One-pipe ring main detected. Return temperature to the last ` +
      `radiator exceeds 55°C, preventing ASHP low-temperature operation and condensing ` +
      `mode. Full system re-pipe to two-pipe or microbore is required before ASHP installation.`
    );
  }

  // 22mm primaries + high heat loss → ASHP flagged (hydraulic velocity/noise)
  if (input.primaryPipeDiameter < 28 && input.heatLossWatts > 8000) {
    flagAshp = true;
    reasons.push(
      `⚠️ ASHP Flagged: 22mm primary pipework with ${(input.heatLossWatts / 1000).toFixed(1)}kW ` +
      `heat loss. ASHP's low ΔT (5–7°C) demands high flow rates incompatible with 22mm ` +
      `diameter – expect pipe noise, erosion, and reduced efficiency.`
    );
  }

  // Low mains pressure → combi safety risk
  if (input.dynamicMainsPressure < 1.0) {
    rejectCombi = true;
    reasons.push(
      `🚫 Combi Rejected: Dynamic mains pressure ${input.dynamicMainsPressure.toFixed(1)}bar ` +
      `is below the 1.0bar minimum. Combi will lock out during simultaneous draws.`
    );
  }

  return {
    rejectCombi,
    rejectStored,
    rejectVented: rejectStored,
    flagAshp,
    rejectAshp,
    reasons,
  };
}
