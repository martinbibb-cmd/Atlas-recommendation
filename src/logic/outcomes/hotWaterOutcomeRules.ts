/**
 * hotWaterOutcomeRules.ts
 *
 * Deterministic classification rules for hot-water draw events
 * (shower, bath, kitchen_draw, tap_draw).
 *
 * Each exported function accepts the event under evaluation, the full ordered
 * list of events in the schedule (for overlap detection), and the system spec,
 * and returns an outcome result, a reason string, and any quantitative metrics.
 */

import type { DayEvent } from '../events/types';
import type { ClassifiedDayEvent, EventOutcomeResult, OutcomeSystemSpec } from './types';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Standard bath volume used for fill-time calculations (litres). */
const BATH_VOLUME_LITRES = 150;

/**
 * Minimum mains dynamic pressure (bar) required for a combi to deliver
 * adequate hot-water flow.  Below this the outlet is noticeably weak.
 */
const COMBI_MIN_PRESSURE_BAR = 0.5;

/**
 * Mains pressure (bar) below which simultaneous demand causes an audible /
 * temperature drop — classified as conflict rather than reduced.
 */
const COMBI_CONFLICT_PRESSURE_BAR = 0.3;

/** Default combi peak capacity when not specified (litres per minute). */
const COMBI_DEFAULT_PEAK_LPM = 12;

/** Default stored-water peak draw rate used for bath fill-time estimate. */
const STORED_DEFAULT_DRAW_RATE_LPM = 15;

/** Default heat-pump cylinder draw rate (slower, larger vessel). */
const HP_DEFAULT_DRAW_RATE_LPM = 12;

/**
 * Threshold at which a single draw event's estimated volume exceeds what is
 * left in the cylinder after accounting for prior events in the cluster.
 * Below this fraction of storage remaining the outcome is reduced.
 */
const STORAGE_REDUCED_FRACTION = 0.4;

/**
 * Below this fraction of storage remaining the outcome is conflict.
 */
const STORAGE_CONFLICT_FRACTION = 0.15;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Estimate the hot-water volume consumed by a single draw event (litres).
 * For bath events we use the standard fill volume, otherwise we estimate from
 * the assumed flow rate and duration.
 */
function estimateDrawVolumeLitres(event: DayEvent, drawRateLpm: number): number {
  if (event.type === 'bath') return BATH_VOLUME_LITRES;
  return drawRateLpm * event.durationMinutes;
}

/**
 * Return true when two events overlap in time (even by a single minute).
 */
function eventsOverlap(a: DayEvent, b: DayEvent): boolean {
  const aEnd = a.startMinute + a.durationMinutes;
  const bEnd = b.startMinute + b.durationMinutes;
  return a.startMinute < bEnd && b.startMinute < aEnd;
}

/**
 * Count hot-water draw events in the schedule that overlap with the given event
 * (excluding the event itself).
 */
function concurrentDrawCount(event: DayEvent, allEvents: DayEvent[]): number {
  return allEvents.filter(
    (e) => e !== event && e.hotWaterDraw && eventsOverlap(e, event),
  ).length;
}

/**
 * Sum the estimated litres drawn by all hot-water events that start before this
 * event (used as a simple running depletion model for stored systems).
 */
function estimatePriorDepleted(
  event: DayEvent,
  allEvents: DayEvent[],
  drawRateLpm: number,
): number {
  return allEvents
    .filter((e) => e !== event && e.hotWaterDraw && e.startMinute < event.startMinute)
    .reduce((sum, e) => sum + estimateDrawVolumeLitres(e, drawRateLpm), 0);
}

// ─── Combi rules ─────────────────────────────────────────────────────────────

/**
 * Classify a hot-water draw event for a combi boiler system.
 *
 * Key factors:
 *   - mains dynamic pressure
 *   - peak flow capacity
 *   - concurrent demand from overlapping events
 *   - short-draw events (tap_draw) are almost always successful
 */
function classifyCombiDraw(
  event: DayEvent,
  allEvents: DayEvent[],
  spec: OutcomeSystemSpec,
): Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'> {
  const pressure = spec.mainsDynamicPressureBar ?? 1.0;
  const peakLpm  = spec.peakHotWaterCapacityLpm ?? COMBI_DEFAULT_PEAK_LPM;
  const concurrent = concurrentDrawCount(event, allEvents);

  // Very short taps are largely unaffected by pressure or concurrency.
  if (event.type === 'tap_draw') {
    return {
      result: 'successful',
      reason: 'Brief tap draw; combi delivers without meaningful pressure loss.',
      metrics: { estimatedFlowLpm: peakLpm },
      tags: ['short_draw'],
    };
  }

  // Low pressure — hard failure gate.
  if (pressure < COMBI_CONFLICT_PRESSURE_BAR) {
    return {
      result: 'conflict',
      reason: `Mains dynamic pressure (${pressure} bar) is too low for combi to deliver adequate flow.`,
      metrics: { estimatedFlowLpm: pressure * peakLpm },
      tags: ['low_pressure'],
    };
  }

  // Borderline pressure — degraded delivery.
  if (pressure < COMBI_MIN_PRESSURE_BAR) {
    return {
      result: 'reduced',
      reason: `Mains dynamic pressure (${pressure} bar) is marginal; flow will be noticeably reduced.`,
      metrics: { estimatedFlowLpm: pressure * peakLpm * 1.5 },
      tags: ['low_pressure'],
    };
  }

  // Concurrent demand — combi cannot serve two high-intensity draws simultaneously.
  if (concurrent >= 1 && event.canConflict) {
    const effectiveLpm = peakLpm / (concurrent + 1);
    if (effectiveLpm < 6) {
      return {
        result: 'conflict',
        reason: `Simultaneous demand: ${concurrent + 1} concurrent hot-water draw(s) exceed combi capacity (${peakLpm} lpm).`,
        metrics: { estimatedFlowLpm: effectiveLpm },
        tags: ['concurrent_demand'],
      };
    }
    return {
      result: 'reduced',
      reason: `Overlapping demand reduces effective flow to ~${effectiveLpm.toFixed(1)} lpm from combi capacity of ${peakLpm} lpm.`,
      metrics: { estimatedFlowLpm: effectiveLpm },
      tags: ['concurrent_demand'],
    };
  }

  // Bath fill time for bath events.
  if (event.type === 'bath') {
    const fillTime = BATH_VOLUME_LITRES / peakLpm;
    return {
      result: 'successful',
      reason: `Combi delivers ${peakLpm} lpm; estimated bath fill time ${fillTime.toFixed(1)} minutes.`,
      metrics: { estimatedFlowLpm: peakLpm, bathFillTimeMinutes: fillTime },
      tags: [],
    };
  }

  return {
    result: 'successful',
    reason: `Combi delivers adequate flow at ${peakLpm} lpm with sufficient mains pressure (${pressure} bar).`,
    metrics: { estimatedFlowLpm: peakLpm },
    tags: [],
  };
}

// ─── Stored water rules ───────────────────────────────────────────────────────

/**
 * Classify a hot-water draw event for a stored-water system
 * (cylinder-fed, boiler or immersion).
 *
 * Key factors:
 *   - storage volume vs cumulative prior depletion
 *   - recovery rate
 *   - clustering of events
 */
function classifyStoredWaterDraw(
  event: DayEvent,
  allEvents: DayEvent[],
  spec: OutcomeSystemSpec,
): Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'> {
  const storage     = spec.hotWaterStorageLitres ?? 150;
  const drawRate    = STORED_DEFAULT_DRAW_RATE_LPM;
  const recoveryLph = spec.recoveryRateLitresPerHour ?? 60;

  const priorDepleted = estimatePriorDepleted(event, allEvents, drawRate);
  const thisVolume    = estimateDrawVolumeLitres(event, drawRate);

  // Simple recovery credit: litres recovered since last draw started.
  const lastEventBefore = [...allEvents]
    .filter((e) => e !== event && e.hotWaterDraw && e.startMinute < event.startMinute)
    .sort((a, b) => b.startMinute - a.startMinute)[0];

  const gapMinutes = lastEventBefore
    ? event.startMinute - (lastEventBefore.startMinute + lastEventBefore.durationMinutes)
    : event.startMinute;

  const recoveryCredit = Math.max(0, (gapMinutes / 60) * recoveryLph);
  const effectiveStorage = Math.min(storage, storage - priorDepleted + recoveryCredit);
  const remainingFraction = effectiveStorage / storage;

  if (event.type === 'bath') {
    const fillTime = BATH_VOLUME_LITRES / drawRate;
    if (remainingFraction < STORAGE_CONFLICT_FRACTION) {
      return {
        result: 'conflict',
        reason: `Stored cylinder severely depleted (≈${Math.round(remainingFraction * 100)}% remaining); insufficient for bath fill.`,
        metrics: { estimatedFlowLpm: drawRate * remainingFraction, bathFillTimeMinutes: fillTime / remainingFraction },
        tags: ['storage_depleted'],
      };
    }
    if (remainingFraction < STORAGE_REDUCED_FRACTION) {
      const adjustedFill = fillTime / Math.max(remainingFraction, 0.1);
      return {
        result: 'reduced',
        reason: `Cylinder partially depleted (≈${Math.round(remainingFraction * 100)}% remaining); bath fill will be longer or cooler.`,
        metrics: { estimatedFlowLpm: drawRate * remainingFraction, bathFillTimeMinutes: adjustedFill },
        tags: ['storage_depleted'],
      };
    }
    return {
      result: 'successful',
      reason: `Cylinder has adequate stored volume (≈${Math.round(remainingFraction * 100)}% remaining); bath fills normally.`,
      metrics: { estimatedFlowLpm: drawRate, bathFillTimeMinutes: fillTime },
      tags: [],
    };
  }

  if (remainingFraction < STORAGE_CONFLICT_FRACTION) {
    return {
      result: 'conflict',
      reason: `Stored cylinder severely depleted (≈${Math.round(remainingFraction * 100)}% remaining); hot water likely exhausted.`,
      metrics: { estimatedFlowLpm: drawRate * remainingFraction },
      tags: ['storage_depleted'],
    };
  }

  if (remainingFraction < STORAGE_REDUCED_FRACTION) {
    return {
      result: 'reduced',
      reason: `Cylinder partially depleted (≈${Math.round(remainingFraction * 100)}% remaining); draw may be warm rather than hot.`,
      metrics: { estimatedFlowLpm: drawRate * remainingFraction },
      tags: ['storage_depleted'],
    };
  }

  return {
    result: 'successful',
    reason: `Cylinder has adequate stored volume (≈${Math.round(remainingFraction * 100)}% remaining).`,
    metrics: { estimatedFlowLpm: drawRate },
    tags: [],
  };
}

// ─── Heat pump rules ──────────────────────────────────────────────────────────

/**
 * Classify a hot-water draw event for a heat-pump system.
 *
 * Heat-pump cylinders are typically larger but recover more slowly than gas
 * boiler stores.  Sudden pressure-style failures do not occur; the dominant
 * failure mode is "not ready again yet" after a cluster.
 */
function classifyHeatPumpDraw(
  event: DayEvent,
  allEvents: DayEvent[],
  spec: OutcomeSystemSpec,
): Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'> {
  // Heat pumps typically ship with 200–300 L cylinders; default 250 L.
  const storage     = spec.hotWaterStorageLitres ?? 250;
  const drawRate    = HP_DEFAULT_DRAW_RATE_LPM;
  // Heat pumps recover slowly — default 30 L/h vs ~60 L/h for gas.
  const recoveryLph = spec.recoveryRateLitresPerHour ?? 30;

  const priorDepleted = estimatePriorDepleted(event, allEvents, drawRate);
  const thisVolume    = estimateDrawVolumeLitres(event, drawRate);

  const lastEventBefore = [...allEvents]
    .filter((e) => e !== event && e.hotWaterDraw && e.startMinute < event.startMinute)
    .sort((a, b) => b.startMinute - a.startMinute)[0];

  const gapMinutes = lastEventBefore
    ? event.startMinute - (lastEventBefore.startMinute + lastEventBefore.durationMinutes)
    : event.startMinute;

  const recoveryCredit = Math.max(0, (gapMinutes / 60) * recoveryLph);
  const effectiveStorage = Math.min(storage, storage - priorDepleted + recoveryCredit);
  const remainingFraction = effectiveStorage / storage;

  // Suppress unused variable warning — thisVolume captured for symmetry with
  // stored_water path; may be used in future thermodynamic pass.
  void thisVolume;

  if (event.type === 'bath') {
    const fillTime = BATH_VOLUME_LITRES / drawRate;
    if (remainingFraction < STORAGE_CONFLICT_FRACTION) {
      return {
        result: 'conflict',
        reason: `Heat-pump cylinder severely depleted (≈${Math.round(remainingFraction * 100)}% remaining); slow recovery rate means water may be cold.`,
        metrics: { estimatedFlowLpm: drawRate * remainingFraction, bathFillTimeMinutes: fillTime / Math.max(remainingFraction, 0.05) },
        tags: ['storage_depleted', 'slow_recovery'],
      };
    }
    if (remainingFraction < STORAGE_REDUCED_FRACTION) {
      const adjustedFill = fillTime / Math.max(remainingFraction, 0.1);
      return {
        result: 'reduced',
        reason: `Heat-pump cylinder partially depleted (≈${Math.round(remainingFraction * 100)}% remaining); slow recovery means bath fill is longer.`,
        metrics: { estimatedFlowLpm: drawRate * remainingFraction, bathFillTimeMinutes: adjustedFill },
        tags: ['storage_depleted', 'slow_recovery'],
      };
    }
    return {
      result: 'successful',
      reason: `Heat-pump cylinder has adequate volume (≈${Math.round(remainingFraction * 100)}% remaining); bath fills normally.`,
      metrics: { estimatedFlowLpm: drawRate, bathFillTimeMinutes: fillTime },
      tags: [],
    };
  }

  if (remainingFraction < STORAGE_CONFLICT_FRACTION) {
    return {
      result: 'conflict',
      reason: `Heat-pump cylinder severely depleted and slow recovery rate cannot replenish in time; hot water likely unavailable.`,
      metrics: { estimatedFlowLpm: drawRate * remainingFraction },
      tags: ['storage_depleted', 'slow_recovery'],
    };
  }

  if (remainingFraction < STORAGE_REDUCED_FRACTION) {
    return {
      result: 'reduced',
      reason: `Heat-pump cylinder partially depleted (≈${Math.round(remainingFraction * 100)}% remaining); slow recovery means subsequent draws may be warm only.`,
      metrics: { estimatedFlowLpm: drawRate * remainingFraction },
      tags: ['storage_depleted', 'slow_recovery'],
    };
  }

  return {
    result: 'successful',
    reason: `Heat-pump cylinder has adequate stored volume (≈${Math.round(remainingFraction * 100)}% remaining).`,
    metrics: { estimatedFlowLpm: drawRate },
    tags: [],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Classify a single hot-water draw event (shower, bath, kitchen_draw, tap_draw)
 * against the provided system spec.
 *
 * @param event      - The DayEvent being classified.
 * @param allEvents  - Complete ordered event list (used for overlap / depletion
 *                     calculations).
 * @param spec       - The system specification to classify against.
 * @returns A partial ClassifiedDayEvent (result, reason, metrics, tags).
 */
export function classifyHotWaterEvent(
  event: DayEvent,
  allEvents: DayEvent[],
  spec: OutcomeSystemSpec,
): Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'> {
  switch (spec.systemType) {
    case 'combi':
      return classifyCombiDraw(event, allEvents, spec);
    case 'stored_water':
      return classifyStoredWaterDraw(event, allEvents, spec);
    case 'heat_pump':
      return classifyHeatPumpDraw(event, allEvents, spec);
  }
}
