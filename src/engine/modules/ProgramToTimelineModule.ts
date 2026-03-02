/**
 * ProgramToTimelineModule
 *
 * Converts a painted 24-hour day programme (EngineInputV2_3.dayProgram) into
 * the canonical Timeline24hEvent[] and demand arrays consumed by TimelineBuilder.
 *
 * Also converts the new Hive-style DayProfileV1 (EngineInputV2_3.dayProfile) into
 * the same canonical arrays — dayProfile takes priority over dayProgram when both
 * are present.
 *
 * Rules (from custom instructions):
 *  - Heat intent 0 = off, 1 = setback (~16 °C), 2 = comfort (~21 °C).
 *  - DHW events are generated from dhwLpm intensities at 15-min resolution.
 *  - Cold-fill events are cold_only kind — not thermal loads.
 *  - Combi DHW lockout during DHW hours is enforced downstream by Solver24hV1.
 */
import type { Timeline24hEvent } from '../../contracts/EngineOutputV1';
import type { DayProfileV1, DhwEventV1 } from '../../contracts/EngineInputV2_3';
import { DHW_KW_PER_LPM_PER_K, computeRequiredKw } from '../presets/DhwFlowPresets';

/** Cold inlet temperature (°C). */
const COLD_INLET_C = 10;

/** Target DHW outlet temperature (°C). */
const DHW_TARGET_C = 40;

/** ΔT for DHW mixing calculation (°C). */
const DHW_DELTA_T_C = DHW_TARGET_C - COLD_INLET_C; // 30 °C

/** @deprecated Use DHW_KW_PER_LPM_PER_K from DhwFlowPresets. Internal alias for compatibility. */
const DHW_KW_PER_LPM_PER_C = DHW_KW_PER_LPM_PER_K;

/**
 * Flow rate (L/min) for each DhwEventV1 profile.
 * Mirrors OUTLET_FLOW_PRESETS_LPM in DhwFlowPresets — do not duplicate magic numbers.
 */
const DHW_PROFILE_LPM: Record<DhwEventV1['profile'], number> = {
  mixer10:    10,
  mixer12:    12,
  rainfall16: 16,
};

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

// ── DayProfileV1 → canonical arrays ───────────────────────────────────────────

/**
 * Determine the space-heat demand fraction at a given minute of the day
 * from the Hive-style heatingBands schedule.
 *
 * Returns 1.0 when the minute falls inside a comfort band.
 * Returns 0.40 (setback) when no band covers the minute (default background).
 */
function heatingFractionAtMinute(dayProfile: DayProfileV1, minuteOfDay: number): number {
  for (const band of dayProfile.heatingBands) {
    if (minuteOfDay >= band.startMin && minuteOfDay < band.endMin) {
      // Map target temperature to a demand fraction using design ΔT (24 K).
      // targetC ~21 → fraction ~1.0; targetC ~16 → fraction ~0.40.
      const DESIGN_INDOOR_C = 21;
      const SETBACK_C = 16;
      const span = DESIGN_INDOOR_C - SETBACK_C;
      const fraction = Math.max(0, Math.min(1, (band.targetC - SETBACK_C) / span));
      return Math.max(0.40, fraction); // at least setback
    }
  }
  return 0; // off when no band covers this minute
}

/**
 * Convert a Hive-style DayProfileV1 into the legacy Timeline24hEvent[] used by
 * TimelineBuilder.  Each DhwEventV1 becomes a 'sink' event spanning its duration.
 *
 * @param dayProfile - Hive-style schedule from EngineInputV2_3.dayProfile
 * @returns Events suitable for Timeline24hBuilder
 */
export function dayProfileToTimelineEvents(dayProfile: DayProfileV1): Timeline24hEvent[] {
  return dayProfile.dhwEvents.map((ev) => ({
    startMin: ev.startMin,
    endMin: ev.startMin + ev.durationMin,
    kind: 'sink',
    intensity: dhwIntensity(DHW_PROFILE_LPM[ev.profile]),
  }));
}

/**
 * Derive a 24-element hourly demand-kW array from a Hive-style DayProfileV1.
 *
 * Space-heat demand per hour = average demand fraction across the hour × heatLossKw.
 * DHW demand per hour = sum of kW contribution from all events overlapping that hour.
 *
 * Uses computeRequiredKw from DhwFlowPresets — single helper for both this module
 * and the Combi Story Panel, preventing drift between UI panels.
 *
 * @param dayProfile  Hive-style day profile.
 * @param heatLossKw  Peak fabric heat-loss (kW).
 * @returns 24-element array of total hourly demand (kW).
 */
export function dayProfileToHourlyDemandKw(
  dayProfile: DayProfileV1,
  heatLossKw: number,
): number[] {
  return Array.from({ length: 24 }, (_, h) => {
    // Average space-heat demand fraction sampled at 15-min mid-points.
    const fractions = [0, 15, 30, 45].map((offset) =>
      heatingFractionAtMinute(dayProfile, h * 60 + offset),
    );
    const avgFraction = fractions.reduce((s, v) => s + v, 0) / 4;
    const shKw = heatLossKw * avgFraction;

    // DHW demand: sum over all events that overlap this hour.
    const hourStartMin = h * 60;
    const hourEndMin = hourStartMin + 60;
    let dhwKw = 0;
    for (const ev of dayProfile.dhwEvents) {
      const evEnd = ev.startMin + ev.durationMin;
      const overlapStart = Math.max(ev.startMin, hourStartMin);
      const overlapEnd = Math.min(evEnd, hourEndMin);
      if (overlapEnd > overlapStart) {
        const overlapFraction = (overlapEnd - overlapStart) / 60;
        const lpm = DHW_PROFILE_LPM[ev.profile];
        dhwKw += computeRequiredKw(lpm, DHW_DELTA_T_C) * overlapFraction;
      }
    }

    return parseFloat((shKw + dhwKw).toFixed(3));
  });
}
