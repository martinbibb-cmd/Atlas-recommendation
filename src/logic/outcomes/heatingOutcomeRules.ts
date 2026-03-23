/**
 * heatingOutcomeRules.ts
 *
 * Deterministic classification rules for heating events
 * (heating_recovery, heating_active, heating_setback).
 *
 * Key inputs:
 *   - system heat output (kW)
 *   - controls quality
 *   - system condition
 *   - low-temperature suitability
 *   - event intensity
 *   - concurrent DHW draws (via heatSourceBehaviour — CH/DHW interaction)
 */

import type { DayEvent } from '../events/types';
import type { ClassifiedDayEvent, OutcomeSystemSpec } from './types';
import { buildHeatSourceBehaviour } from '../../engine/modules/HeatSourceBehaviourModel';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Minimum heat output (kW) considered adequate for a recovery event. */
const RECOVERY_ADEQUATE_KW = 15;

/** Heat output (kW) below which a recovery event is likely to fall short. */
const RECOVERY_WEAK_KW = 8;

/**
 * Penalty degrees (°C) added to outside-target estimate for poor controls.
 * A basic controller cannot modulate precisely enough to hold the target.
 */
const CONTROLS_BASIC_PENALTY_DEG = 2;

/**
 * Penalty degrees (°C) added for poor system condition (sludge, scale).
 * Restricts flow and reduces effective output.
 */
const CONDITION_POOR_PENALTY_DEG = 2;
const CONDITION_AVERAGE_PENALTY_DEG = 1;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Compute a combined penalty score (°C offset) from controls quality and
 * system condition.  Higher = worse outcome.
 */
function computePenaltyDegrees(spec: OutcomeSystemSpec): number {
  let penalty = 0;

  if (spec.controlsQuality === 'basic') {
    penalty += CONTROLS_BASIC_PENALTY_DEG;
  }
  // 'good' or 'excellent' — no additional penalty.

  if (spec.systemCondition === 'poor') {
    penalty += CONDITION_POOR_PENALTY_DEG;
  } else if (spec.systemCondition === 'average') {
    penalty += CONDITION_AVERAGE_PENALTY_DEG;
  }

  return penalty;
}

/**
 * Determine whether the system is well-matched to the event's demand intensity.
 * Returns the effective output (kW) after condition penalty.
 */
function effectiveOutputKw(spec: OutcomeSystemSpec): number {
  const nominal = spec.heatOutputKw ?? 18;
  // Poor condition reduces effective output by ~20%.
  if (spec.systemCondition === 'poor')    return nominal * 0.8;
  if (spec.systemCondition === 'average') return nominal * 0.9;
  return nominal;
}

// ─── Recovery rules ───────────────────────────────────────────────────────────

/**
 * Classify a heating_recovery event.
 *
 * Recovery events represent the system firing to bring the property back up
 * to target temperature.  They are the most demanding test for heat output.
 */
function classifyRecovery(
  event: DayEvent,
  spec: OutcomeSystemSpec,
): Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'> {
  const outputKw  = effectiveOutputKw(spec);
  const penalty   = computePenaltyDegrees(spec);
  const intensity = event.intensity;

  // Heat pumps: evaluate by low-temp suitability rather than raw kW output.
  if (spec.systemType === 'heat_pump') {
    const suitability = spec.lowTempSuitability ?? 'medium';

    if (suitability === 'high') {
      if (penalty > 0) {
        return {
          result: 'reduced',
          reason: `Heat pump is well-suited for low-temperature recovery but controls/condition penalty (${penalty}°C) may cause mild temperature drift.`,
          metrics: { outsideTargetDegrees: penalty },
          tags: ['heat_pump', 'recovery'],
        };
      }
      return {
        result: 'successful',
        reason: 'Heat pump with high low-temp suitability recovers efficiently; target temperature maintained.',
        metrics: { outsideTargetDegrees: 0 },
        tags: ['heat_pump', 'recovery'],
      };
    }

    if (suitability === 'medium') {
      const outsideDeg = penalty + (intensity === 'high' ? 1 : 0);
      return {
        result: outsideDeg > 2 ? 'reduced' : 'successful',
        reason: `Heat pump has medium low-temp suitability; recovery ${outsideDeg > 2 ? 'may fall short of target' : 'likely adequate'} (estimated ${outsideDeg}°C outside target).`,
        metrics: { outsideTargetDegrees: outsideDeg },
        tags: ['heat_pump', 'recovery'],
      };
    }

    // low suitability — heat pump is not a good match for this property.
    const outsideDeg = penalty + 3;
    return {
      result: 'conflict',
      reason: `Heat pump has low low-temp suitability; recovery is likely inadequate and temperature will sit ${outsideDeg}°C outside target.`,
      metrics: { outsideTargetDegrees: outsideDeg },
      tags: ['heat_pump', 'recovery', 'low_temp_mismatch'],
    };
  }

  // Combi / stored_water: evaluate by raw kW output.
  if (outputKw >= RECOVERY_ADEQUATE_KW) {
    if (penalty > 0) {
      const outsideDeg = penalty;
      return {
        result: outsideDeg >= 3 ? 'reduced' : 'successful',
        reason: `Boiler output (${outputKw.toFixed(0)} kW) is adequate for recovery but controls/condition adds ${outsideDeg}°C penalty.`,
        metrics: { outsideTargetDegrees: outsideDeg },
        tags: ['recovery'],
      };
    }
    return {
      result: 'successful',
      reason: `Boiler output (${outputKw.toFixed(0)} kW) is sufficient for recovery; target temperature achieved.`,
      metrics: { outsideTargetDegrees: 0 },
      tags: ['recovery'],
    };
  }

  if (outputKw >= RECOVERY_WEAK_KW) {
    const outsideDeg = penalty + (intensity === 'high' ? 2 : 1);
    return {
      result: outsideDeg >= 3 ? 'conflict' : 'reduced',
      reason: `Boiler output (${outputKw.toFixed(0)} kW) is marginal for recovery; estimated ${outsideDeg}°C outside target.`,
      metrics: { outsideTargetDegrees: outsideDeg },
      tags: ['recovery', 'undersized'],
    };
  }

  // Very weak output — clear failure.
  const outsideDeg = penalty + 4;
  return {
    result: 'conflict',
    reason: `Boiler output (${outputKw.toFixed(0)} kW) is too low for recovery; temperature will be ${outsideDeg}°C outside target.`,
    metrics: { outsideTargetDegrees: outsideDeg },
    tags: ['recovery', 'undersized'],
  };
}

// ─── Active heating rules ─────────────────────────────────────────────────────

/**
 * Classify a heating_active event.
 *
 * Active events represent the system maintaining the property at target
 * temperature over a sustained period.  This is less demanding than recovery
 * but still sensitive to controls quality and condition.
 */
function classifyActive(
  spec: OutcomeSystemSpec,
): Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'> {
  const outputKw = effectiveOutputKw(spec);
  const penalty  = computePenaltyDegrees(spec);

  // Heat pumps excel at sustained low-level heating.
  if (spec.systemType === 'heat_pump') {
    const suitability = spec.lowTempSuitability ?? 'medium';

    if (suitability === 'high') {
      if (penalty === 0) {
        return {
          result: 'successful',
          reason: 'Heat pump is well-suited to sustained low-temperature space heating; target temperature held comfortably.',
          metrics: { outsideTargetDegrees: 0 },
          tags: ['heat_pump', 'active'],
        };
      }
      return {
        result: 'reduced',
        reason: `Heat pump holds temperature well but controls/condition penalty (${penalty}°C) causes minor drift.`,
        metrics: { outsideTargetDegrees: penalty },
        tags: ['heat_pump', 'active'],
      };
    }

    if (suitability === 'medium') {
      return {
        result: penalty > 2 ? 'reduced' : 'successful',
        reason: `Heat pump with medium low-temp suitability; ${penalty > 2 ? `penalty (${penalty}°C) causes noticeable drift` : 'temperature maintained adequately'}.`,
        metrics: { outsideTargetDegrees: penalty },
        tags: ['heat_pump', 'active'],
      };
    }

    const outsideDeg = penalty + 2;
    return {
      result: 'conflict',
      reason: `Heat pump has low low-temp suitability for sustained active heating; temperature ${outsideDeg}°C outside target.`,
      metrics: { outsideTargetDegrees: outsideDeg },
      tags: ['heat_pump', 'active', 'low_temp_mismatch'],
    };
  }

  // Gas/oil boiler (combi or stored_water): active holding is generally easier.
  if (outputKw >= RECOVERY_ADEQUATE_KW) {
    const outsideDeg = penalty;
    return {
      result: outsideDeg >= 3 ? 'reduced' : 'successful',
      reason: `Boiler maintains active heating well (${outputKw.toFixed(0)} kW output); ${outsideDeg > 0 ? `minor drift of ${outsideDeg}°C from controls/condition` : 'target temperature held'}.`,
      metrics: { outsideTargetDegrees: outsideDeg },
      tags: ['active'],
    };
  }

  if (outputKw >= RECOVERY_WEAK_KW) {
    const outsideDeg = penalty + 1;
    return {
      result: outsideDeg >= 3 ? 'conflict' : 'reduced',
      reason: `Marginal boiler output (${outputKw.toFixed(0)} kW); sustained heating shows ${outsideDeg}°C drift.`,
      metrics: { outsideTargetDegrees: outsideDeg },
      tags: ['active', 'undersized'],
    };
  }

  const outsideDeg = penalty + 3;
  return {
    result: 'conflict',
    reason: `Boiler output (${outputKw.toFixed(0)} kW) insufficient to hold target temperature; ${outsideDeg}°C outside target.`,
    metrics: { outsideTargetDegrees: outsideDeg },
    tags: ['active', 'undersized'],
  };
}

// ─── Setback rules ────────────────────────────────────────────────────────────

/**
 * Classify a heating_setback event.
 *
 * Setback events represent intentional reduced or off periods.  The system is
 * not expected to hold target; the classification reflects whether the
 * subsequent recovery will be feasible.
 */
function classifySetback(
  spec: OutcomeSystemSpec,
): Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'> {
  const outputKw = effectiveOutputKw(spec);
  const penalty  = computePenaltyDegrees(spec);

  // Setback itself is always intentional; classify by whether re-heat is viable.
  if (outputKw >= RECOVERY_ADEQUATE_KW && penalty <= 1) {
    return {
      result: 'successful',
      reason: 'Setback period as intended; system has adequate output for subsequent recovery.',
      metrics: { outsideTargetDegrees: 0 },
      tags: ['setback'],
    };
  }

  if (outputKw >= RECOVERY_WEAK_KW || penalty <= 2) {
    return {
      result: 'reduced',
      reason: `Setback period; re-heat capability is marginal (${outputKw.toFixed(0)} kW, penalty ${penalty}°C) — recovery after setback may be slow.`,
      metrics: { outsideTargetDegrees: penalty },
      tags: ['setback', 'slow_recovery'],
    };
  }

  return {
    result: 'conflict',
    reason: `Setback period; system is too weak (${outputKw.toFixed(0)} kW) and/or poorly controlled to recover reliably after setback.`,
    metrics: { outsideTargetDegrees: penalty + 2 },
    tags: ['setback', 'slow_recovery', 'undersized'],
  };
}

// ─── CH / DHW interaction helper ─────────────────────────────────────────────

/**
 * Return true when a hot-water draw (shower, bath, kitchen_draw) overlaps with
 * the given heating event.  Tap draws are excluded — they are too brief to
 * cause a meaningful CH interruption.
 */
function hasConcurrentDhwDraw(event: DayEvent, allEvents: DayEvent[]): boolean {
  const eventEnd = event.startMinute + event.durationMinutes;
  return allEvents.some(
    (e) =>
      e !== event &&
      e.hotWaterDraw &&
      e.type !== 'tap_draw' &&
      e.startMinute < eventEnd &&
      e.startMinute + e.durationMinutes > event.startMinute,
  );
}

/**
 * Apply the CH/DHW interaction from the heat-source behaviour model to an
 * already-classified heating outcome.
 *
 * - **Combi** (`chPausedDuringDhw: true`): whenever a DHW draw overlaps the
 *   heating window, CH is fully paused.  A 'successful' result is downgraded
 *   to 'reduced' and tagged `ch_paused_for_dhw`.  Results already at 'reduced'
 *   or 'conflict' keep their existing classification (they are already degraded).
 *
 * - **Stored water — Y-plan** (`chThrottledByDhwDemand: true`): when the
 *   cylinder calls for heat the mid-position valve moves to DHW priority,
 *   throttling CH output.  A 'successful' result is downgraded to 'reduced'
 *   and tagged `ch_throttled_for_dhw`.
 *
 * - **Stored water — S-plan** (`chThrottledByDhwDemand: false`) and **heat
 *   pump**: no change — circuits are independent.
 */
function applyChDhwInteraction(
  base: Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'>,
  spec: OutcomeSystemSpec,
  concurrentDhw: boolean,
): Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'> {
  if (!concurrentDhw) return base;

  // Resolve behaviour model (reuse pre-built instance if available).
  const behaviour = spec.heatSourceBehaviour ?? buildHeatSourceBehaviour(spec);

  if (spec.systemType === 'combi') {
    // chPausedDuringDhw is always true for a combi; checked explicitly for clarity.
    if (behaviour.combi?.chPausedDuringDhw) {
      if (base.result === 'successful') {
        return {
          result: 'reduced',
          reason:
            `${base.reason} CH is paused while a concurrent DHW draw is active (combi DHW priority).`,
          metrics: base.metrics,
          tags: [...base.tags, 'ch_paused_for_dhw'],
        };
      }
      // Already 'reduced' or 'conflict' — just add the tag.
      return {
        ...base,
        tags: [...base.tags, 'ch_paused_for_dhw'],
      };
    }
  }

  if (spec.systemType === 'stored_water' || spec.systemType === 'open_vented') {
    const chEffect = behaviour.boilerCylinder?.simultaneousChDhw;
    if (chEffect?.chThrottledByDhwDemand) {
      const planLabel =
        chEffect.planType === 's_plan' ? 'S-plan' :
        chEffect.planType === 'y_plan' ? 'Y-plan' :
        'Y-plan (assumed)';
      if (base.result === 'successful') {
        return {
          result: 'reduced',
          reason:
            `${base.reason} DHW demand throttles CH while the cylinder reheats (${planLabel}).`,
          metrics: base.metrics,
          tags: [...base.tags, 'ch_throttled_for_dhw'],
        };
      }
      return {
        ...base,
        tags: [...base.tags, 'ch_throttled_for_dhw'],
      };
    }
  }

  return base;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Classify a single heating event (heating_recovery, heating_active,
 * heating_setback) against the provided system spec.
 *
 * When `allDayEvents` is provided the classifier also checks for concurrent
 * DHW draws and applies the appropriate CH/DHW interaction from the
 * heat-source behaviour model:
 *   - Combi: CH paused during any concurrent DHW draw.
 *   - Stored water / Y-plan: CH throttled during cylinder reheat call.
 *   - Stored water / S-plan: no effect (independent circuits).
 *
 * @param event      - The DayEvent being classified.
 * @param spec       - The system specification to classify against.
 * @param allEvents  - All events in the day schedule (used for overlap check).
 * @returns A partial ClassifiedDayEvent (result, reason, metrics, tags).
 */
export function classifyHeatingEvent(
  event: DayEvent,
  spec: OutcomeSystemSpec,
  allEvents: DayEvent[] = [],
): Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'> {
  let base: Pick<ClassifiedDayEvent, 'result' | 'reason' | 'metrics' | 'tags'>;

  switch (event.type) {
    case 'heating_recovery':
      base = classifyRecovery(event, spec);
      break;
    case 'heating_active':
      base = classifyActive(spec);
      break;
    case 'heating_setback':
      base = classifySetback(spec);
      break;
    default:
      // Should never reach here when called from the main classifier.
      return {
        result: 'successful',
        reason: 'No heating classification applicable.',
        metrics: {},
        tags: [],
      };
  }

  const concurrentDhw = hasConcurrentDhwDraw(event, allEvents);
  return applyChDhwInteraction(base, spec, concurrentDhw);
}
