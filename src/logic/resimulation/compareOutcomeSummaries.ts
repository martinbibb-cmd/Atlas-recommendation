/**
 * compareOutcomeSummaries.ts
 *
 * Pure function that computes a structured comparison (delta summary and
 * customer-readable headline improvements) between a simple-install
 * ClassifiedDaySchedule and a best-fit-install ClassifiedDaySchedule.
 *
 * Design rule: identical inputs always produce identical output — no
 * randomness is introduced at any point.
 */

import type { ClassifiedDaySchedule } from '../outcomes/types';
import type { ResimulationComparison } from './types';

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute a ResimulationComparison between simple-install and best-fit-install
 * classified day schedules.
 *
 * Delta sign convention:
 *   - For "fewer is better" metrics (reduced, conflict, outsideTarget):
 *       delta = simpleInstall.value − bestFitInstall.value
 *       Positive delta → best-fit is better.
 *   - For "more is better" metrics (successful):
 *       delta = simpleInstall.value − bestFitInstall.value
 *       Negative delta → best-fit is better (has more successes).
 *   - For bath fill time:
 *       delta = simpleInstall.avgBath − bestFitInstall.avgBath
 *       Positive delta → best-fit is faster (good).
 *
 * These deltas are computed consistently so that callers can reason about
 * the direction of improvement without needing to know the sign convention.
 *
 * @param simpleInstall  - Classified schedule from the original spec run.
 * @param bestFitInstall - Classified schedule from the upgraded spec run.
 * @returns A ResimulationComparison with deltas and headline improvements.
 */
export function compareOutcomeSummaries(
  simpleInstall: ClassifiedDaySchedule,
  bestFitInstall: ClassifiedDaySchedule,
): ResimulationComparison {
  // ── Hot water deltas ──────────────────────────────────────────────────────

  const hwConflictDelta  = simpleInstall.hotWater.conflict  - bestFitInstall.hotWater.conflict;
  const hwReducedDelta   = simpleInstall.hotWater.reduced   - bestFitInstall.hotWater.reduced;
  const hwSuccessfulDelta = simpleInstall.hotWater.successful - bestFitInstall.hotWater.successful;

  const simpleBath  = simpleInstall.hotWater.averageBathFillTimeMinutes;
  const bestFitBath = bestFitInstall.hotWater.averageBathFillTimeMinutes;
  const bathFillDelta =
    simpleBath !== null && bestFitBath !== null ? simpleBath - bestFitBath : null;

  // ── Heating deltas ────────────────────────────────────────────────────────

  const hConflictDelta       = simpleInstall.heating.conflict       - bestFitInstall.heating.conflict;
  const hReducedDelta        = simpleInstall.heating.reduced        - bestFitInstall.heating.reduced;
  const hSuccessfulDelta     = simpleInstall.heating.successful     - bestFitInstall.heating.successful;
  const outsideTargetDelta   =
    simpleInstall.heating.outsideTargetEventCount -
    bestFitInstall.heating.outsideTargetEventCount;

  // ── Headline improvements ─────────────────────────────────────────────────

  const headlines = buildHeadlineImprovements({
    hwConflictDelta,
    hwReducedDelta,
    bathFillDelta,
    hConflictDelta,
    hReducedDelta,
    outsideTargetDelta,
  });

  return {
    hotWater: {
      successfulDelta:                 hwSuccessfulDelta,
      reducedDelta:                    hwReducedDelta,
      conflictDelta:                   hwConflictDelta,
      averageBathFillTimeDeltaMinutes: bathFillDelta,
    },
    heating: {
      successfulDelta:             hSuccessfulDelta,
      reducedDelta:                hReducedDelta,
      conflictDelta:               hConflictDelta,
      outsideTargetEventCountDelta: outsideTargetDelta,
    },
    headlineImprovements: headlines,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface HeadlineInputs {
  hwConflictDelta: number;
  hwReducedDelta: number;
  bathFillDelta: number | null;
  hConflictDelta: number;
  hReducedDelta: number;
  outsideTargetDelta: number;
}

/**
 * Build an ordered list of customer-readable improvement statements.
 *
 * Only positive improvements are surfaced.  Where there is no improvement
 * on a given metric the statement is omitted (honest reporting).
 */
function buildHeadlineImprovements(inputs: HeadlineInputs): string[] {
  const lines: string[] = [];

  // ── Hot-water conflicts ───────────────────────────────────────────────────
  if (inputs.hwConflictDelta > 0) {
    lines.push(
      inputs.hwConflictDelta === 1
        ? '1 fewer on-demand hot-water conflict'
        : `${inputs.hwConflictDelta} fewer on-demand hot-water conflicts`,
    );
  }

  // ── Hot-water reduced events ──────────────────────────────────────────────
  if (inputs.hwReducedDelta > 0) {
    lines.push(
      inputs.hwReducedDelta === 1
        ? '1 fewer reduced-flow hot-water event'
        : `${inputs.hwReducedDelta} fewer reduced-flow hot-water events`,
    );
  }

  // ── Bath fill time ────────────────────────────────────────────────────────
  if (inputs.bathFillDelta !== null && inputs.bathFillDelta > 0) {
    const mins = Math.round(inputs.bathFillDelta);
    lines.push(
      mins === 1 ? 'Bath fills 1 minute faster' : `Bath fills ${mins} minutes faster`,
    );
  }

  // ── Heating conflicts ─────────────────────────────────────────────────────
  if (inputs.hConflictDelta > 0) {
    lines.push(
      inputs.hConflictDelta === 1
        ? '1 fewer heating conflict'
        : `${inputs.hConflictDelta} fewer heating conflicts`,
    );
  }

  // ── Heating reduced events ────────────────────────────────────────────────
  if (inputs.hReducedDelta > 0) {
    lines.push(
      inputs.hReducedDelta === 1
        ? '1 fewer reduced heating event'
        : `${inputs.hReducedDelta} fewer reduced heating events`,
    );
  }

  // ── Outside-target heating events ────────────────────────────────────────
  if (inputs.outsideTargetDelta > 0) {
    lines.push(
      inputs.outsideTargetDelta === 1
        ? '1 fewer heating event outside comfort target'
        : `${inputs.outsideTargetDelta} fewer heating events outside comfort target`,
    );
  }

  return lines;
}
