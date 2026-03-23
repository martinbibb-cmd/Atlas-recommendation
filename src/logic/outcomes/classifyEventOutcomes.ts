/**
 * classifyEventOutcomes.ts
 *
 * Main entry point for the PR 3 Event Outcome Engine.
 *
 * Runs a TypicalDaySchedule (from PR 2) against an OutcomeSystemSpec and
 * returns a ClassifiedDaySchedule containing:
 *   - per-event outcome results with reasons and optional metrics
 *   - aggregated hot-water outcome counts
 *   - aggregated heating outcome counts
 *   - average bath fill time
 *
 * Design rule: same schedule + same spec → identical output (deterministic).
 */

import type { TypicalDaySchedule } from '../events/types';
import type {
  ClassifiedDayEvent,
  ClassifiedDaySchedule,
  HeatingOutcomeSummary,
  HotWaterOutcomeSummary,
  OutcomeSystemSpec,
} from './types';
import { classifyHotWaterEvent } from './hotWaterOutcomeRules';
import { classifyHeatingEvent } from './heatingOutcomeRules';
import { buildHeatSourceBehaviour } from '../../engine/modules/HeatSourceBehaviourModel';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a human-readable label for the system spec, used in the returned
 * ClassifiedDaySchedule.systemLabel.
 */
function buildSystemLabel(spec: OutcomeSystemSpec): string {
  const typeLabel: Record<OutcomeSystemSpec['systemType'], string> = {
    combi:        'Combi boiler',
    stored_water: 'Stored-water system',
    heat_pump:    'Heat pump',
  };
  const parts: string[] = [typeLabel[spec.systemType]];

  if (spec.heatOutputKw !== undefined) {
    parts.push(`${spec.heatOutputKw} kW`);
  }
  if (spec.hotWaterStorageLitres !== undefined) {
    parts.push(`${spec.hotWaterStorageLitres} L store`);
  }
  if (spec.controlsQuality !== undefined) {
    parts.push(`${spec.controlsQuality} controls`);
  }
  return parts.join(', ');
}

/**
 * Aggregate classified events into a HotWaterOutcomeSummary.
 */
function buildHotWaterSummary(events: ClassifiedDayEvent[]): HotWaterOutcomeSummary {
  const draws = events.filter((e) =>
    ['shower', 'bath', 'kitchen_draw', 'tap_draw'].includes(e.type),
  );

  let successful = 0;
  let reduced    = 0;
  let conflict   = 0;
  let simultaneousEventCount = 0;

  const bathFillTimes: number[] = [];

  for (const e of draws) {
    if (e.result === 'successful') successful++;
    else if (e.result === 'reduced') reduced++;
    else conflict++;

    // Count events that had concurrent/overlapping demand — regardless of outcome.
    if (e.tags.includes('concurrent_demand')) simultaneousEventCount++;

    if (e.type === 'bath' && e.metrics?.bathFillTimeMinutes !== undefined) {
      bathFillTimes.push(e.metrics.bathFillTimeMinutes);
    }
  }

  return {
    totalDraws:  draws.length,
    successful,
    reduced,
    conflict,
    simultaneousEventCount,
    averageBathFillTimeMinutes:
      bathFillTimes.length > 0
        ? bathFillTimes.reduce((a, b) => a + b, 0) / bathFillTimes.length
        : null,
  };
}

/**
 * Aggregate classified events into a HeatingOutcomeSummary.
 */
function buildHeatingSummary(events: ClassifiedDayEvent[]): HeatingOutcomeSummary {
  const heatingEvents = events.filter((e) =>
    ['heating_recovery', 'heating_active', 'heating_setback'].includes(e.type),
  );

  let successful = 0;
  let reduced    = 0;
  let conflict   = 0;
  let outsideTargetEventCount = 0;

  for (const e of heatingEvents) {
    if (e.result === 'successful') successful++;
    else if (e.result === 'reduced') reduced++;
    else conflict++;

    if (
      e.metrics?.outsideTargetDegrees !== undefined &&
      e.metrics.outsideTargetDegrees > 0
    ) {
      outsideTargetEventCount++;
    }
  }

  return {
    totalHeatingEvents: heatingEvents.length,
    successful,
    reduced,
    conflict,
    outsideTargetEventCount,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a TypicalDaySchedule against an OutcomeSystemSpec and return a fully
 * classified day schedule.
 *
 * The function is deterministic: identical inputs always produce identical
 * output.  No randomness is introduced.
 *
 * @param schedule  - Deterministic 24-hour event schedule from PR 2.
 * @param spec      - System specification to evaluate the schedule against.
 * @returns A ClassifiedDaySchedule with per-event outcomes and summary counts.
 *
 * @example
 *   const result = classifyEventOutcomes(schedule, {
 *     systemType: 'combi',
 *     peakHotWaterCapacityLpm: 12,
 *     heatOutputKw: 24,
 *     mainsDynamicPressureBar: 1.0,
 *     controlsQuality: 'good',
 *     systemCondition: 'clean',
 *   });
 *   // result.hotWater.successful, result.hotWater.conflict, …
 */
export function classifyEventOutcomes(
  schedule: TypicalDaySchedule,
  spec: OutcomeSystemSpec,
): ClassifiedDaySchedule {
  const allDayEvents = schedule.events;
  const classifiedEvents: ClassifiedDayEvent[] = [];

  // Pre-build the heat-source behaviour model once for all events.
  // If the caller has already populated spec.heatSourceBehaviour (e.g. for
  // testing or custom override) we reuse it; otherwise we build it here so
  // that every event in this schedule is classified against the same
  // physics-derived outputs.
  const specWithBehaviour: OutcomeSystemSpec =
    spec.heatSourceBehaviour != null
      ? spec
      : { ...spec, heatSourceBehaviour: buildHeatSourceBehaviour(spec) };

  for (const event of allDayEvents) {
    if (event.hotWaterDraw) {
      const outcome = classifyHotWaterEvent(event, allDayEvents, specWithBehaviour);
      classifiedEvents.push({
        eventId:         event.id,
        type:            event.type,
        startMinute:     event.startMinute,
        durationMinutes: event.durationMinutes,
        result:          outcome.result,
        reason:          outcome.reason,
        metrics:         outcome.metrics,
        tags:            [...event.tags, ...outcome.tags],
      });
      continue;
    }

    if (event.heatingRelated) {
      const outcome = classifyHeatingEvent(event, specWithBehaviour);
      classifiedEvents.push({
        eventId:         event.id,
        type:            event.type,
        startMinute:     event.startMinute,
        durationMinutes: event.durationMinutes,
        result:          outcome.result,
        reason:          outcome.reason,
        metrics:         outcome.metrics,
        tags:            [...event.tags, ...outcome.tags],
      });
      continue;
    }

    // Events that are neither hot-water nor heating related are classified as
    // successful by default (no system interaction required).
    classifiedEvents.push({
      eventId:         event.id,
      type:            event.type,
      startMinute:     event.startMinute,
      durationMinutes: event.durationMinutes,
      result:          'successful',
      reason:          'Event does not interact with the heating or hot-water system.',
      tags:            [...event.tags],
    });
  }

  return {
    systemLabel: buildSystemLabel(spec),
    events:      classifiedEvents,
    hotWater:    buildHotWaterSummary(classifiedEvents),
    heating:     buildHeatingSummary(classifiedEvents),
  };
}
