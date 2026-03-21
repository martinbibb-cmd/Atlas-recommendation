/**
 * EngineInputValidationModule
 *
 * Audits the engine input against a known set of critical fields to detect:
 *   1. Missing critical inputs that the survey UI makes available (user-skipped).
 *   2. Missing inputs that the survey UI never collects (not penalised).
 *
 * This prevents the engine from silently degrading confidence for inputs the
 * user was never given the chance to provide, while still flagging genuine gaps.
 *
 * Rule: downgrade confidence ONLY when the user skipped an input the UI collects.
 * Never penalise for inputs that have no corresponding survey question.
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Contract ─────────────────────────────────────────────────────────────────

export interface EngineInputValidation {
  /**
   * Identifiers of critical inputs that are missing AND were collectable via the
   * survey UI.  Each entry represents a question the user could have answered
   * but did not.
   */
  missingCriticalInputs: string[];
  /**
   * True when one or more critical inputs are missing, causing a downgrade in
   * output confidence.  Never true for inputs the UI does not collect.
   */
  degradedConfidence: boolean;
}

// ─── Fields collected by the survey UI ────────────────────────────────────────
// Each entry describes an input field the UI makes available to the user.
// Missing values here are genuine user-skipped gaps and MAY affect confidence.

const SURVEY_COLLECTABLE_CHECKS: Array<{
  id: string;
  label: string;
  isMissing: (input: EngineInputV2_3) => boolean;
  critical: boolean;
}> = [
  {
    id: 'boiler_age',
    label: 'Current boiler age (years)',
    isMissing: (i) =>
      !i.currentSystem?.boiler?.ageYears && !i.currentBoilerAgeYears,
    critical: true,
  },
  {
    id: 'boiler_output',
    label: 'Current boiler output (kW)',
    isMissing: (i) =>
      !i.currentSystem?.boiler?.nominalOutputKw && !i.currentBoilerOutputKw,
    critical: true,
  },
  {
    id: 'heat_loss',
    label: 'Peak heat loss (W)',
    isMissing: (i) =>
      i.heatLossWatts == null || i.heatLossWatts <= 0,
    critical: true,
  },
  {
    id: 'mains_flow',
    label: 'Mains dynamic flow rate (L/min)',
    isMissing: (i) => {
      // Missing when no flow value has been provided.
      // We do not penalise for the known/unknown flag alone because an
      // engineer who hasn't measured flow yet has not 'skipped' the input
      // — it is deferred rather than ignored.  The value itself is what matters.
      return !i.mainsDynamicFlowLpm;
    },
    critical: false, // Flow is important but not always measurable on first visit.
  },
  {
    id: 'bathroom_count',
    label: 'Number of bathrooms',
    isMissing: (i) => i.bathroomCount == null,
    critical: false,
  },
  {
    id: 'occupancy_count',
    label: 'Number of occupants',
    isMissing: (i) => i.occupancyCount == null,
    critical: false,
  },
];

// ─── Non-penalised fields (UI never collects) ─────────────────────────────────
// These are noted in the output but must NEVER contribute to degradedConfidence.

const NON_PENALISED_FIELD_IDS: ReadonlySet<string> = new Set([
  'boiler_gc_number',    // No GC lookup path in current survey UI
]);

// ─── Module function ──────────────────────────────────────────────────────────

/**
 * Validate engine inputs and return a summary of missing fields.
 *
 * @param input   The engine input to validate.
 * @returns       `EngineInputValidation` with a list of missing critical inputs
 *                and a flag indicating whether confidence should be degraded.
 */
export function runEngineInputValidation(
  input: EngineInputV2_3,
): EngineInputValidation {
  const missingCriticalInputs: string[] = [];

  for (const check of SURVEY_COLLECTABLE_CHECKS) {
    if (check.isMissing(input)) {
      missingCriticalInputs.push(check.id);
    }
  }

  // Filter out non-penalised fields before computing confidence degradation.
  const penalisableMissing = missingCriticalInputs.filter(
    id => !NON_PENALISED_FIELD_IDS.has(id),
  );

  const criticalMissing = penalisableMissing.filter(id => {
    const check = SURVEY_COLLECTABLE_CHECKS.find(c => c.id === id);
    return check?.critical === true;
  });

  return {
    missingCriticalInputs,
    degradedConfidence: criticalMissing.length > 0,
  };
}
