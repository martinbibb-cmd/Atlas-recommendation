/**
 * ProgramToTimelineModule
 *
 * Converts a painted 24-hour day programme (EngineInputV2_3.dayProgram) into
 * the canonical Timeline24hEvent[] and demand arrays consumed by TimelineBuilder.
 *
 * Rules (from custom instructions):
 *  - Heat intent 0 = off, 1 = setback (~16 °C), 2 = comfort (~21 °C).
 *  - DHW events are generated from dhwLpm intensities at 15-min resolution.
 *  - Cold-fill events are cold_only kind — not thermal loads.
 *  - Combi DHW lockout during DHW hours is enforced downstream by Solver24hV1.
 */
import type { Timeline24hEvent } from '../../contracts/EngineOutputV1';

/** DHW heat conversion factor: Cp / 60 (kW per L/min per °C). */
const DHW_KW_PER_LPM_PER_C = 4.186 / 60;

/** Cold inlet temperature (°C). */
const COLD_INLET_C = 10;

/** Target DHW outlet temperature (°C). */
const DHW_TARGET_C = 40;

/** ΔT for DHW mixing calculation (°C). */
const DHW_DELTA_T_C = DHW_TARGET_C - COLD_INLET_C; // 30 °C

/** Classify a dhwLpm value into a Timeline24hEvent intensity band. */
function dhwIntensity(lpm: number): 'low' | 'med' | 'high' {
  if (lpm >= 6) return 'high';
  if (lpm >= 3) return 'med';
  return 'low';
}

/**
 * Convert a painted day programme into Timeline24hEvent[].
 *
 * For each non-zero DHW-lpm hour, one event is emitted spanning the full 60-minute
 * window (startMin = h * 60, endMin = h * 60 + 60).
 *
 * For each non-zero cold-lpm hour, one cold_only event is emitted.
 *
 * @param dayProgram - 24-element arrays from EngineInputV2_3.dayProgram
 * @returns Events suitable for Timeline24hBuilder
 */
export function programToTimelineEvents(dayProgram: {
  heatIntent: number[];
  dhwLpm: number[];
  coldLpm: number[];
}): Timeline24hEvent[] {
  const events: Timeline24hEvent[] = [];

  for (let h = 0; h < 24; h++) {
    const startMin = h * 60;
    const endMin = startMin + 60;

    const dhw = dayProgram.dhwLpm[h] ?? 0;
    if (dhw > 0) {
      events.push({
        startMin,
        endMin,
        kind: 'sink',
        intensity: dhwIntensity(dhw),
      });
    }

    const cold = dayProgram.coldLpm[h] ?? 0;
    if (cold > 0) {
      events.push({
        startMin,
        endMin,
        kind: 'cold_only',
        intensity: 'low',
      });
    }
  }

  return events;
}

/**
 * Derive a 24-element hourly demand-kW array from the painted programme.
 *
 * Space-heat demand is proportional to heat-loss rate × heat-intent fraction:
 *   intent 0 → 0 (no demand)
 *   intent 1 → 0.40 × heatLossKw (setback — maintain ~16 °C)
 *   intent 2 → 1.00 × heatLossKw (comfort — maintain ~21 °C)
 *
 * DHW demand is added on top of space-heat demand:
 *   dhwKw = DHW_KW_PER_LPM_PER_K × lpm × DHW_DELTA_T_C
 *
 * @param dayProgram - 24-element arrays from EngineInputV2_3.dayProgram
 * @param heatLossKw - Peak fabric heat-loss (kW) used to scale demand
 * @returns 24-element array of total hourly demand (kW)
 */
export function programToHourlyDemandKw(
  dayProgram: { heatIntent: number[]; dhwLpm: number[] },
  heatLossKw: number,
): number[] {
  const HEAT_INTENT_FRACTION: Record<number, number> = { 0: 0, 1: 0.40, 2: 1.00 };

  return Array.from({ length: 24 }, (_, h) => {
    const intent = dayProgram.heatIntent[h] ?? 0;
    const shKw = heatLossKw * (HEAT_INTENT_FRACTION[intent] ?? 0);
    const dhwKw = DHW_KW_PER_LPM_PER_C * (dayProgram.dhwLpm[h] ?? 0) * DHW_DELTA_T_C;
    return parseFloat((shKw + dhwKw).toFixed(3));
  });
}
