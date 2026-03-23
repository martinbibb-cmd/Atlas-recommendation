/**
 * hotWaterOutcomeRules.ts
 *
 * Deterministic classification rules for hot-water draw events
 * (shower, bath, kitchen_draw, tap_draw).
 *
 * Each exported function accepts the event under evaluation, the full ordered
 * list of events in the schedule (for overlap detection), and the system spec,
 * and returns an outcome result, a reason string, and any quantitative metrics.
 *
 * When spec.heatSourceBehaviour is present, physics-derived values from the
 * HeatSourceBehaviourModel are used in place of the previous fixed threshold
 * constants.  This ensures combi flow rates, cylinder recovery rates, and
 * simultaneous-demand effects all emerge from source behaviour rather than
 * generic family-level shortcuts.
 */

import type { DayEvent } from '../events/types';
import type { ClassifiedDayEvent, OutcomeSystemSpec } from './types';
import {
  buildHeatSourceBehaviour,
  type CombiBehaviourV1,
  type BoilerCylinderBehaviourV1,
  type HeatPumpCylinderBehaviourV1,
} from '../../engine/modules/HeatSourceBehaviourModel';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Standard bath volume used for fill-time calculations (litres). */
const BATH_VOLUME_LITRES = 150;

/**
 * Bath tap fill rate for stored-water systems (litres per minute).
 * Used only for bath fill-time and recovery-during-fill calculations.
 * Short draws and showers use their own lower rates (see below).
 */
const STORED_DEFAULT_DRAW_RATE_LPM = 15;

/**
 * Bath tap fill rate for heat-pump cylinder systems (litres per minute).
 * Slightly slower than gas systems due to lower delivery temperature.
 */
const HP_DEFAULT_DRAW_RATE_LPM = 12;

/**
 * Per-event-type draw rate constants.
 *
 * These replace the previous single STORED_DEFAULT_DRAW_RATE_LPM (15 lpm) that
 * was applied to all events, including showers and tap draws — causing severe
 * over-depletion (an 8-min shower was charged 120 L instead of ~72 L, leaving
 * the cylinder critically low and producing impossible conflict totals).
 *
 *   tap_draw     — brief hand wash / dental use; gravity tap pressure
 *   kitchen_draw — washing up, filling a kettle or bowl
 *   shower       — gravity-fed or pumped stored-water shower (stored path)
 *                  or mains-pressure shower from HP cylinder (HP path)
 */
const TAP_DRAW_RATE_LPM      = 3;   // ~3 L/min at low gravity pressure
const KITCHEN_DRAW_RATE_LPM  = 7;   // typical kitchen mixer flow
const STORED_SHOWER_RATE_LPM = 9;   // gravity / pumped shower at stored-water pressure
const HP_SHOWER_RATE_LPM     = 10;  // mains-pressure shower from HP cylinder

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Return the effective hot-water draw rate (L/min) for a specific event type
 * and system category.
 *
 * This prevents short tap draws and showers from inheriting the bath fill rate
 * (15 lpm), which previously caused severe over-depletion in the stored-water
 * running-balance model and produced impossible conflict totals.
 *
 * Bath events always return the full bath-fill rate for fill-time and
 * recovery-during-draw calculations; their volume is computed from the fixed
 * BATH_VOLUME_LITRES constant rather than rate × duration.
 */
function getEventDrawRateLpm(event: DayEvent, systemType: 'stored_water' | 'heat_pump'): number {
  switch (event.type) {
    case 'tap_draw':     return TAP_DRAW_RATE_LPM;
    case 'kitchen_draw': return KITCHEN_DRAW_RATE_LPM;
    case 'bath':         return systemType === 'heat_pump' ? HP_DEFAULT_DRAW_RATE_LPM : STORED_DEFAULT_DRAW_RATE_LPM;
    default:             return systemType === 'heat_pump' ? HP_SHOWER_RATE_LPM : STORED_SHOWER_RATE_LPM;
  }
}

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
 * Compute the effective available storage (litres) immediately before the
 * given event starts, using a running chronological simulation.
 *
 * This replaces the previous approach of summing all prior draws and crediting
 * only the gap from the last event — which produced wildly inflated depletion
 * figures when events were spread across a full day (e.g. morning draws
 * "persisted" into evening even after 6+ hours of recovery).
 *
 * The simulation:
 *   1. Starts with a full cylinder (maxStorageLitres).
 *   2. Processes each prior hot-water draw in chronological order.
 *   3. Credits recovery for the idle gap between the previous draw's end and
 *      the next draw's start (capped at maxStorageLitres).
 *   4. Subtracts the draw volume (floored at 0).
 *   5. After processing all prior events, credits recovery from the last draw's
 *      end to this event's start.
 */
function computeEffectiveStorageAtEvent(
  event: DayEvent,
  allEvents: DayEvent[],
  maxStorageLitres: number,
  getDrawRateFn: (e: DayEvent) => number,
  recoveryLph: number,
): number {
  const priorEvents = allEvents
    .filter((e) => e !== event && e.hotWaterDraw && e.startMinute < event.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute);

  let balance = maxStorageLitres;
  let lastEndMinute = 0;

  for (const prior of priorEvents) {
    // Credit recovery for the idle gap since the previous draw finished.
    const gap = Math.max(0, prior.startMinute - lastEndMinute);
    const recovery = (gap / 60) * recoveryLph;
    balance = Math.min(maxStorageLitres, balance + recovery);

    // Subtract this draw's volume using the per-event-type rate.
    const draw = estimateDrawVolumeLitres(prior, getDrawRateFn(prior));
    balance = Math.max(0, balance - draw); // floored at 0 — cylinder cannot go negative

    // Advance the "last draw end" marker.  Using a conditional here intentionally
    // handles simultaneous events (e.g. shower and kitchen_draw both at 7:00).
    // Without the guard, processing the shorter event last would shrink
    // lastEndMinute and incorrectly credit extra recovery for the next event.
    const endMinute = prior.startMinute + prior.durationMinutes;
    if (endMinute > lastEndMinute) lastEndMinute = endMinute;
  }

  // Credit any remaining recovery between the last draw end and this event.
  const finalGap = Math.max(0, event.startMinute - lastEndMinute);
  const finalRecovery = (finalGap / 60) * recoveryLph;
  return Math.min(maxStorageLitres, balance + finalRecovery);
}

/**
 * Estimate how many hours a draw event takes, used for recovery-during-draw
 * calculations in stored-system classifiers.
 *
 * Bath fill time is derived from draw rate rather than the event's
 * durationMinutes (which is a schedule placeholder, not the actual fill time).
 */
function estimateDrawDurationHours(event: DayEvent, drawRateLpm: number): number {
  return event.type === 'bath'
    ? (BATH_VOLUME_LITRES / drawRateLpm) / 60
    : event.durationMinutes / 60;
}

// ─── Combi rules ─────────────────────────────────────────────────────────────

/**
 * Classify a hot-water draw event for a combi boiler system using physics
 * outputs from CombiBehaviourV1.
 *
 * Key factors (source-behaviour driven):
 *   - pressure lockout (from CombiBehaviourV1.pressureLockoutActive)
 *   - maximum DHW flow (from CombiBehaviourV1.singleOutletDhwLpm)
 *   - simultaneous flow split (from CombiBehaviourV1.dualOutletDhwLpmPerOutlet)
 *   - initiation delay (from CombiBehaviourV1.initiationDelaySeconds)
 *   - CH paused during DHW (from CombiBehaviourV1.chPausedDuringDhw — always true)
 *   - short-draw events (tap_draw) are almost always successful
 */
function classifyCombiDraw(
  event: DayEvent,
  allEvents: DayEvent[],
  spec: OutcomeSystemSpec,
  behaviour: CombiBehaviourV1,
): Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'> {
  const concurrent = concurrentDrawCount(event, allEvents);

  // Very short taps are largely unaffected by pressure or concurrency.
  if (event.type === 'tap_draw') {
    return {
      result: 'successful',
      reason: 'Brief tap draw; combi delivers without meaningful pressure loss.',
      metrics: { estimatedFlowLpm: behaviour.singleOutletDhwLpm },
      tags: ['short_draw'],
    };
  }

  // Pressure lockout from behaviour model — hard failure gate.
  if (behaviour.pressureLockoutActive) {
    const pressure = spec.mainsDynamicPressureBar ?? 1.0;
    return {
      result: 'conflict',
      reason: `Mains dynamic pressure (${pressure} bar) is too low for combi to ignite — pressure lockout active. Minimum ${1.0} bar required.`,
      metrics: { estimatedFlowLpm: 0 },
      tags: ['low_pressure', 'pressure_lockout'],
    };
  }

  // Concurrent demand — use behaviour model's flow values and thresholds.
  if (concurrent >= 1 && event.canConflict) {
    const effectiveLpm = behaviour.dualOutletDhwLpmPerOutlet;

    if (!behaviour.canServeSimultaneousDhwEvents) {
      return {
        result: 'conflict',
        reason:
          `Simultaneous demand: combi flow split across ${concurrent + 1} concurrent outlet(s) ` +
          `delivers ~${effectiveLpm.toFixed(1)} lpm per outlet — below usable threshold. ` +
          `CH is paused while DHW is active (DHW priority).`,
        metrics: { estimatedFlowLpm: effectiveLpm },
        tags: ['concurrent_demand', 'dhw_priority'],
      };
    }

    // Use the behaviour model's comfort threshold rather than a hard-coded constant.
    if (effectiveLpm < behaviour.adequateConcurrentFlowLpm) {
      return {
        result: 'reduced',
        reason:
          `Overlapping demand splits combi output: ~${effectiveLpm.toFixed(1)} lpm per outlet ` +
          `(rated ${behaviour.singleOutletDhwLpm.toFixed(1)} lpm single outlet) — noticeable but tolerable.`,
        metrics: { estimatedFlowLpm: effectiveLpm },
        tags: ['concurrent_demand'],
      };
    }

    // Flow is adequate — mark circumstance but classify as successful.
    return {
      result: 'successful',
      reason:
        `Combi delivers ~${effectiveLpm.toFixed(1)} lpm per outlet under simultaneous demand — adequate flow maintained. ` +
        `Note: CH pauses while DHW is active (DHW priority; initiation delay ${behaviour.initiationDelaySeconds}s).`,
      metrics: { estimatedFlowLpm: effectiveLpm },
      tags: ['concurrent_demand', 'dhw_priority'],
    };
  }

  const pressure = spec.mainsDynamicPressureBar ?? 1.0;

  // Bath fill time for bath events — use behaviour model's flow rate.
  if (event.type === 'bath') {
    const flowLpm = behaviour.singleOutletDhwLpm;
    const fillTime = BATH_VOLUME_LITRES / flowLpm;
    return {
      result: 'successful',
      reason:
        `Combi delivers ${flowLpm.toFixed(1)} lpm (rated output); ` +
        `estimated bath fill time ${fillTime.toFixed(1)} min. ` +
        `CH pauses during fill (DHW priority); hot water after ${behaviour.initiationDelaySeconds}s initiation delay.`,
      metrics: { estimatedFlowLpm: flowLpm, bathFillTimeMinutes: fillTime },
      tags: [],
    };
  }

  return {
    result: 'successful',
    reason:
      `Combi delivers ${behaviour.singleOutletDhwLpm.toFixed(1)} lpm at adequate mains pressure (${pressure} bar). ` +
      `Hot water available after ${behaviour.initiationDelaySeconds}s initiation delay; CH paused during draw (DHW priority).`,
    metrics: { estimatedFlowLpm: behaviour.singleOutletDhwLpm },
    tags: [],
  };
}

// ─── Stored water rules ───────────────────────────────────────────────────────

/**
 * Classify a hot-water draw event for a stored-water system using physics
 * outputs from BoilerCylinderBehaviourV1.
 *
 * Key factors (source-behaviour driven):
 *   - effective usable volume (from BoilerCylinderBehaviourV1.effectiveUsableVolumeLitres)
 *   - coil recovery rate (from BoilerCylinderBehaviourV1.coilRecoveryRateLph)
 *   - S-plan vs Y-plan effect (from BoilerCylinderBehaviourV1.simultaneousChDhw)
 *   - running-balance storage simulation
 */
function classifyStoredWaterDraw(
  event: DayEvent,
  allEvents: DayEvent[],
  spec: OutcomeSystemSpec,
  behaviour: BoilerCylinderBehaviourV1,
): Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'> {
  const storage     = behaviour.effectiveUsableVolumeLitres;
  // Use per-event-type draw rate to avoid charging showers and taps at bath-fill rate.
  const drawRate    = getEventDrawRateLpm(event, 'stored_water');
  const recoveryLph = behaviour.coilRecoveryRateLph;
  // Nominal storage for remaining-fraction display (before usable-volume factor).
  const nominalStorage = spec.hotWaterStorageLitres ?? 150;

  // Use the running-balance model to get accurate available storage,
  // accounting for recovery between all prior draw clusters.
  // Each prior event uses its own per-type draw rate via the callback.
  const effectiveStorage = computeEffectiveStorageAtEvent(
    event, allEvents, storage, (e) => getEventDrawRateLpm(e, 'stored_water'), recoveryLph,
  );
  const remainingFraction = effectiveStorage / nominalStorage;

  // Volume-based outcome: compare this draw's demand against available storage.
  const drawLitres = estimateDrawVolumeLitres(event, drawRate);
  const usableLitres = Math.max(0, effectiveStorage);
  const recoveryDuringDraw = Math.max(0, estimateDrawDurationHours(event, drawRate) * recoveryLph);
  const servedFraction = drawLitres > 0 ? Math.min(1, usableLitres / drawLitres) : 1;

  // Shared trace fields populated in every return path.
  const traceMetrics = {
    requiredLitres:          drawLitres,
    usableLitresBeforeDraw:  usableLitres,
    recoveryDuringDrawLitres: recoveryDuringDraw,
    servedFraction,
    drawRateLpm:             drawRate,
  };

  // S-plan / Y-plan note: if CH is active and DHW starts, the plan type
  // determines whether heating is throttled.  We surface this in reason strings
  // so the user understands the system topology effect.
  const { chThrottledByDhwDemand, planType } = behaviour.simultaneousChDhw;
  let planNote: string;
  if (!chThrottledByDhwDemand) {
    planNote = ' S-plan: CH and DHW circuits are independent.';
  } else if (planType !== 'unknown') {
    planNote = ` Note: ${planType.toUpperCase()} arrangement — DHW demand may throttle space heating.`;
  } else {
    planNote = ' Note: DHW demand may throttle space heating.';
  }

  if (event.type === 'bath') {
    const fillTime = BATH_VOLUME_LITRES / drawRate;
    if (drawLitres > usableLitres + recoveryDuringDraw) {
      return {
        result: 'conflict',
        reason:
          `Stored cylinder severely depleted (≈${Math.round(remainingFraction * 100)}% remaining, ` +
          `${usableLitres.toFixed(0)} L available vs ${drawLitres} L needed); insufficient for bath fill.` +
          planNote,
        metrics: { ...traceMetrics, estimatedFlowLpm: drawRate * servedFraction, bathFillTimeMinutes: fillTime / Math.max(servedFraction, 0.1) },
        tags: ['storage_depleted'],
      };
    }
    if (drawLitres > usableLitres) {
      const adjustedFill = fillTime / Math.max(servedFraction, 0.1);
      return {
        result: 'reduced',
        reason:
          `Cylinder partially depleted (≈${Math.round(remainingFraction * 100)}% remaining); ` +
          `bath fill will be longer or cooler (recovery rate: ${recoveryLph.toFixed(0)} L/h, ` +
          `full recovery in ${behaviour.fullRecoveryHours.toFixed(1)} h).` +
          planNote,
        metrics: { ...traceMetrics, estimatedFlowLpm: drawRate * servedFraction, bathFillTimeMinutes: adjustedFill },
        tags: ['storage_depleted'],
      };
    }
    return {
      result: 'successful',
      reason:
        `Cylinder has adequate stored volume (≈${Math.round(remainingFraction * 100)}% remaining, ` +
        `${usableLitres.toFixed(0)} L usable); bath fills normally.` +
        planNote,
      metrics: { ...traceMetrics, estimatedFlowLpm: drawRate, bathFillTimeMinutes: fillTime },
      tags: [],
    };
  }

  if (drawLitres > usableLitres + recoveryDuringDraw) {
    return {
      result: 'conflict',
      reason:
        `Stored cylinder severely depleted (≈${Math.round(remainingFraction * 100)}% remaining); ` +
        `hot water likely exhausted. Coil recovery rate: ${recoveryLph.toFixed(0)} L/h.` +
        planNote,
      metrics: { ...traceMetrics, estimatedFlowLpm: drawRate * servedFraction },
      tags: ['storage_depleted'],
    };
  }

  if (drawLitres > usableLitres) {
    return {
      result: 'reduced',
      reason:
        `Cylinder partially depleted (≈${Math.round(remainingFraction * 100)}% remaining); ` +
        `draw may be warm rather than hot (recovery rate: ${recoveryLph.toFixed(0)} L/h).` +
        planNote,
      metrics: { ...traceMetrics, estimatedFlowLpm: drawRate * servedFraction },
      tags: ['storage_depleted'],
    };
  }

  return {
    result: 'successful',
    reason:
      `Cylinder has adequate stored volume (≈${Math.round(remainingFraction * 100)}% remaining). ` +
      `Coil recovery rate: ${recoveryLph.toFixed(0)} L/h.`,
    metrics: { ...traceMetrics, estimatedFlowLpm: drawRate },
    tags: [],
  };
}

// ─── Heat pump rules ──────────────────────────────────────────────────────────

/**
 * Classify a hot-water draw event for a heat-pump system using physics outputs
 * from HeatPumpCylinderBehaviourV1.
 *
 * Key factors (source-behaviour driven):
 *   - effective usable volume (from HeatPumpCylinderBehaviourV1.effectiveUsableVolumeLitres)
 *   - recovery rate (from HeatPumpCylinderBehaviourV1.recoveryRateLph — much slower than gas)
 *   - COP and lift penalty (from HeatPumpCylinderBehaviourV1.cop, liftPenaltyFactor)
 *   - low-temp suitability (from HeatPumpCylinderBehaviourV1.lowTempSuitability)
 */
function classifyHeatPumpDraw(
  event: DayEvent,
  allEvents: DayEvent[],
  spec: OutcomeSystemSpec,
  behaviour: HeatPumpCylinderBehaviourV1,
): Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'> {
  const storage     = behaviour.effectiveUsableVolumeLitres;
  // Use per-event-type draw rate to avoid charging showers and taps at bath-fill rate.
  const drawRate    = getEventDrawRateLpm(event, 'heat_pump');
  const recoveryLph = behaviour.recoveryRateLph;
  // Nominal storage for remaining-fraction display (before usable-volume factor).
  const nominalStorage = spec.hotWaterStorageLitres ?? 250;

  // Use the running-balance model to get accurate available storage.
  // Each prior event uses its own per-type draw rate via the callback.
  const effectiveStorage = computeEffectiveStorageAtEvent(
    event, allEvents, storage, (e) => getEventDrawRateLpm(e, 'heat_pump'), recoveryLph,
  );
  const remainingFraction = effectiveStorage / nominalStorage;

  const drawLitres = estimateDrawVolumeLitres(event, drawRate);
  const usableLitres = Math.max(0, effectiveStorage);
  const recoveryDuringDraw = Math.max(0, estimateDrawDurationHours(event, drawRate) * recoveryLph);
  const servedFraction = drawLitres > 0 ? Math.min(1, usableLitres / drawLitres) : 1;

  // Shared trace fields populated in every return path.
  const traceMetrics = {
    requiredLitres:           drawLitres,
    usableLitresBeforeDraw:   usableLitres,
    recoveryDuringDrawLitres: recoveryDuringDraw,
    servedFraction,
    drawRateLpm:              drawRate,
  };

  // Build a string summarising the HP recovery physics for reason strings.
  const recoveryNote =
    `Recovery rate: ${recoveryLph.toFixed(0)} L/h (COP ${behaviour.cop.toFixed(1)}, ` +
    `lift factor ${behaviour.liftPenaltyFactor.toFixed(2)}); ` +
    `full recovery in ${isFinite(behaviour.fullRecoveryHours) ? behaviour.fullRecoveryHours.toFixed(1) + ' h' : 'unknown'}.`;

  if (event.type === 'bath') {
    const fillTime = BATH_VOLUME_LITRES / drawRate;
    if (drawLitres > usableLitres + recoveryDuringDraw) {
      return {
        result: 'conflict',
        reason:
          `Heat-pump cylinder severely depleted (≈${Math.round(remainingFraction * 100)}% remaining); ` +
          `slow recovery means hot water unlikely for bath fill. ${recoveryNote}`,
        metrics: { ...traceMetrics, estimatedFlowLpm: drawRate * servedFraction, bathFillTimeMinutes: fillTime / Math.max(servedFraction, 0.05) },
        tags: ['storage_depleted', 'slow_recovery'],
      };
    }
    if (drawLitres > usableLitres) {
      const adjustedFill = fillTime / Math.max(servedFraction, 0.1);
      return {
        result: 'reduced',
        reason:
          `Heat-pump cylinder partially depleted (≈${Math.round(remainingFraction * 100)}% remaining); ` +
          `slow recovery means bath fill is longer. ${recoveryNote}`,
        metrics: { ...traceMetrics, estimatedFlowLpm: drawRate * servedFraction, bathFillTimeMinutes: adjustedFill },
        tags: ['storage_depleted', 'slow_recovery'],
      };
    }
    return {
      result: 'successful',
      reason:
        `Heat-pump cylinder has adequate volume (≈${Math.round(remainingFraction * 100)}% remaining); ` +
        `bath fills normally. ${recoveryNote}`,
      metrics: { ...traceMetrics, estimatedFlowLpm: drawRate, bathFillTimeMinutes: fillTime },
      tags: [],
    };
  }

  if (drawLitres > usableLitres + recoveryDuringDraw) {
    return {
      result: 'conflict',
      reason:
        `Heat-pump cylinder severely depleted; slow recovery cannot replenish in time — hot water likely unavailable. ` +
        recoveryNote,
      metrics: { ...traceMetrics, estimatedFlowLpm: drawRate * servedFraction },
      tags: ['storage_depleted', 'slow_recovery'],
    };
  }

  if (drawLitres > usableLitres) {
    return {
      result: 'reduced',
      reason:
        `Heat-pump cylinder partially depleted (≈${Math.round(remainingFraction * 100)}% remaining); ` +
        `subsequent draws may be warm only. ${recoveryNote}`,
      metrics: { ...traceMetrics, estimatedFlowLpm: drawRate * servedFraction },
      tags: ['storage_depleted', 'slow_recovery'],
    };
  }

  return {
    result: 'successful',
    reason:
      `Heat-pump cylinder has adequate stored volume (≈${Math.round(remainingFraction * 100)}% remaining). ` +
      recoveryNote,
    metrics: { ...traceMetrics, estimatedFlowLpm: drawRate },
    tags: [],
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Classify a single hot-water draw event (shower, bath, kitchen_draw, tap_draw)
 * against the provided system spec.
 *
 * When spec.heatSourceBehaviour is present, physics-derived values from the
 * HeatSourceBehaviourModel are used.  Otherwise the model is built on-the-fly
 * from the spec — callers may pre-compute it for efficiency when classifying
 * many events against the same spec.
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
  // Build (or reuse) the heat-source behaviour model.
  const behaviour = spec.heatSourceBehaviour ?? buildHeatSourceBehaviour(spec);

  switch (spec.systemType) {
    case 'combi':
      return classifyCombiDraw(event, allEvents, spec, behaviour.combi!);
    case 'stored_water':
      return classifyStoredWaterDraw(event, allEvents, spec, behaviour.boilerCylinder!);
    case 'heat_pump':
      return classifyHeatPumpDraw(event, allEvents, spec, behaviour.heatPumpCylinder!);
  }
}
