/**
 * applyAcceptedSuggestions.ts
 *
 * Application layer: turns accepted VoiceNoteSuggestions into concrete
 * survey-model field updates with full provenance tracking.
 *
 * Design rules:
 *  - ONLY process suggestions with status === 'accepted'.
 *  - NEVER update hard measured fields (pressure, flow, heat loss, dimensions).
 *  - Every applied value produces an AppliedNoteSuggestion record for provenance.
 *  - Manually-entered or measured values always take precedence and mark the
 *    note-derived value as overriddenByManual.
 *
 * Safe field mappings (highest-value, lowest-risk):
 *   preference.avoid_cylinder       → input.preferCombi = true
 *   usage.high_shower_concurrency   → input.highOccupancy = true
 *   risk.likely_sludge              → fullSurvey.heatingCondition.magneticDebrisEvidence = true
 *   risk.radiator_imbalance         → fullSurvey.heatingCondition.radiatorsHeatingUnevenly = true
 *
 * Indirect-influence mappings (stored for UI / audit; no direct engine field yet):
 *   preference.simple_controls
 *   preference.no_bath_use
 *   preference.night_worker
 *   preference.preferred_boiler_location
 *   constraint.cupboard_tight
 *   constraint.storage_clearance_fail
 *   constraint.flue_route_difficult
 *   constraint.loft_access_poor
 *   constraint.narrow_stairs
 *   constraint.pipe_route_difficult
 *   constraint.parking_scaffold_issue
 *   risk.microbore_pipework
 *   risk.low_pressure_poor_flow
 *   risk.probable_asbestos
 *   follow-up prompts
 */

import type { VoiceNoteSuggestion, AppliedNoteSuggestion } from './voiceNoteTypes';
import type { FullSurveyModelV1, HeatingConditionDiagnosticsV1 } from '../../ui/fullSurvey/FullSurveyModelV1';

// ─── Application result ───────────────────────────────────────────────────────

/**
 * The output of applying accepted suggestions to a survey model.
 *
 * `updates`  — partial FullSurveyModelV1 to merge into the current model.
 * `applied`  — provenance records for every suggestion that was processed.
 */
export interface SuggestionApplicationResult {
  updates: Partial<FullSurveyModelV1>;
  applied: AppliedNoteSuggestion[];
}

// ─── Mapping table ────────────────────────────────────────────────────────────

/**
 * Describes how an accepted suggestion maps to a survey model field.
 *
 * - `targetField`  — the logical field name (used in AppliedNoteSuggestion).
 * - `applyToModel` — mutation function; should return a shallow-merged partial
 *                    that will be spread into the working model. Return null to
 *                    store provenance only (no direct engine field yet).
 */
interface SuggestionMapping {
  targetField: string;
  applyToModel: (
    current: Partial<FullSurveyModelV1>,
  ) => Partial<FullSurveyModelV1> | null;
}

const SUGGESTION_MAPPINGS: Record<string, SuggestionMapping> = {
  // ── Preferences ─────────────────────────────────────────────────────────────

  'preference.avoid_cylinder': {
    targetField: 'preferCombi',
    applyToModel: () => ({ preferCombi: true }),
  },

  'preference.simple_controls': {
    targetField: 'preference.simple_controls',
    applyToModel: () => null, // advisory only — no direct engine field
  },

  'preference.no_bath_use': {
    targetField: 'preference.no_bath_use',
    applyToModel: () => null, // advisory only
  },

  'preference.night_worker': {
    targetField: 'preference.night_worker',
    applyToModel: () => null, // advisory only
  },

  'preference.preferred_boiler_location': {
    targetField: 'preference.preferred_boiler_location',
    applyToModel: () => null, // advisory only
  },

  // ── Install constraints ──────────────────────────────────────────────────────

  'constraint.cupboard_tight': {
    targetField: 'constraint.cupboard_tight',
    applyToModel: () => null, // advisory — affects cylinder option ranking (future work)
  },

  'constraint.storage_clearance_fail': {
    targetField: 'constraint.storage_clearance_fail',
    applyToModel: () => null, // advisory
  },

  'constraint.flue_route_difficult': {
    targetField: 'constraint.flue_route_difficult',
    applyToModel: () => null, // advisory
  },

  'constraint.loft_access_poor': {
    targetField: 'constraint.loft_access_poor',
    applyToModel: () => null, // advisory
  },

  'constraint.narrow_stairs': {
    targetField: 'constraint.narrow_stairs',
    applyToModel: () => null, // advisory
  },

  'constraint.pipe_route_difficult': {
    targetField: 'constraint.pipe_route_difficult',
    applyToModel: () => null, // advisory
  },

  'constraint.parking_scaffold_issue': {
    targetField: 'constraint.parking_scaffold_issue',
    applyToModel: () => null, // advisory
  },

  // ── Usage signals ────────────────────────────────────────────────────────────

  'usage.high_shower_concurrency': {
    targetField: 'highOccupancy',
    applyToModel: () => ({ highOccupancy: true }),
  },

  'usage.bath_infrequent': {
    targetField: 'usage.bath_infrequent',
    applyToModel: () => null, // advisory
  },

  // ── Risk / condition flags ───────────────────────────────────────────────────

  'risk.likely_sludge': {
    targetField: 'fullSurvey.heatingCondition.magneticDebrisEvidence',
    applyToModel: (current) => {
      const existing: HeatingConditionDiagnosticsV1 =
        current.fullSurvey?.heatingCondition ?? {};
      // Do not override a manually-confirmed false value; skip if already true.
      if (existing.magneticDebrisEvidence === false) return null;
      if (existing.magneticDebrisEvidence === true) return null;
      return {
        fullSurvey: {
          ...current.fullSurvey,
          heatingCondition: { ...existing, magneticDebrisEvidence: true },
        },
      };
    },
  },

  'risk.radiator_imbalance': {
    targetField: 'fullSurvey.heatingCondition.radiatorsHeatingUnevenly',
    applyToModel: (current) => {
      const existing: HeatingConditionDiagnosticsV1 =
        current.fullSurvey?.heatingCondition ?? {};
      if (existing.radiatorsHeatingUnevenly === false) return null;
      if (existing.radiatorsHeatingUnevenly === true) return null;
      return {
        fullSurvey: {
          ...current.fullSurvey,
          heatingCondition: { ...existing, radiatorsHeatingUnevenly: true },
        },
      };
    },
  },

  'risk.microbore_pipework': {
    targetField: 'risk.microbore_pipework',
    applyToModel: () => null, // advisory — pipe diameter is a hard measured field
  },

  'risk.low_pressure_poor_flow': {
    targetField: 'risk.low_pressure_poor_flow',
    applyToModel: () => null, // advisory — pressure is a hard measured field
  },

  'risk.probable_asbestos': {
    targetField: 'risk.probable_asbestos',
    applyToModel: () => null, // advisory
  },

  // ── Follow-up prompts ────────────────────────────────────────────────────────
  // Follow-up prompts are advisory only — they do not update engine fields.

  'followup.confirm_bath_shower_count': {
    targetField: 'followup.confirm_bath_shower_count',
    applyToModel: () => null,
  },

  'followup.confirm_boiler_location': {
    targetField: 'followup.confirm_boiler_location',
    applyToModel: () => null,
  },

  'followup.mark_install_constraint': {
    targetField: 'followup.mark_install_constraint',
    applyToModel: () => null,
  },

  'followup.combi_preference_confirm': {
    targetField: 'followup.combi_preference_confirm',
    applyToModel: () => null,
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * mergeFullSurveyUpdates
 *
 * Deep-merges two partial FullSurveyModelV1 objects, preserving the
 * heatingCondition sub-object on both sides.  Used when accumulating multiple
 * note-derived updates and when applying them into the working payload.
 *
 * Exported so that consumers (e.g. VisitHubPage) can use the same merge
 * logic without duplicating it.
 */
export function mergeFullSurveyUpdates(
  base: Partial<FullSurveyModelV1>,
  incoming: Partial<FullSurveyModelV1>,
): Partial<FullSurveyModelV1> {
  if (!incoming.fullSurvey || !base.fullSurvey) {
    return { ...base, ...incoming };
  }
  return {
    ...base,
    ...incoming,
    fullSurvey: {
      ...base.fullSurvey,
      ...incoming.fullSurvey,
      // Deep-merge heatingCondition sub-object when both sides have it.
      ...(incoming.fullSurvey.heatingCondition && base.fullSurvey.heatingCondition
        ? {
            heatingCondition: {
              ...base.fullSurvey.heatingCondition,
              ...incoming.fullSurvey.heatingCondition,
            },
          }
        : {}),
    },
  };
}

/**
 * applyAcceptedSuggestions
 *
 * Processes all accepted VoiceNoteSuggestions and produces:
 *   1. A partial FullSurveyModelV1 containing the field updates to merge.
 *   2. An array of AppliedNoteSuggestion records for provenance tracking.
 *
 * Only suggestions with status === 'accepted' are processed.
 * Suggestions without a defined mapping are silently skipped.
 *
 * @param suggestions  All suggestions from all voice notes for this visit.
 * @param current      The current survey model (used for guard checks).
 */
export function applyAcceptedSuggestions(
  suggestions: VoiceNoteSuggestion[],
  current: Partial<FullSurveyModelV1>,
): SuggestionApplicationResult {
  const accepted = suggestions.filter(s => s.status === 'accepted');

  let accumulator: Partial<FullSurveyModelV1> = {};
  const applied: AppliedNoteSuggestion[] = [];

  for (const suggestion of accepted) {
    const mapping = SUGGESTION_MAPPINGS[suggestion.key];
    if (!mapping) continue; // unknown key — skip silently

    const fieldUpdates = mapping.applyToModel({ ...current, ...accumulator });

    if (fieldUpdates !== null) {
      accumulator = mergeFullSurveyUpdates(accumulator, fieldUpdates);
    }

    applied.push({
      sourceSuggestionId: suggestion.id,
      sourceNoteId:       suggestion.sourceNoteId,
      targetField:        mapping.targetField,
      label:              suggestion.label,
      appliedValue:       suggestion.suggestedValue,
      confidence:         suggestion.confidence,
      provenance:         'accepted_atlas_suggestion',
      category:           suggestion.category,
      sourceSnippet:      suggestion.sourceSnippet,
    });
  }

  return { updates: accumulator, applied };
}

/**
 * mergeAppliedSuggestions
 *
 * Merges a set of AppliedNoteSuggestion records produced by
 * applyAcceptedSuggestions into an existing list, de-duplicating by
 * sourceSuggestionId.  Records already present are updated in place (so that
 * overriddenByManual state is preserved when re-running).
 */
export function mergeAppliedSuggestions(
  existing: AppliedNoteSuggestion[],
  incoming: AppliedNoteSuggestion[],
): AppliedNoteSuggestion[] {
  const byId = new Map<string, AppliedNoteSuggestion>(
    existing.map(a => [a.sourceSuggestionId, a]),
  );
  for (const item of incoming) {
    const prev = byId.get(item.sourceSuggestionId);
    // Preserve overriddenByManual if it was set previously.
    byId.set(item.sourceSuggestionId, {
      ...item,
      overriddenByManual: prev?.overriddenByManual ?? item.overriddenByManual,
    });
  }
  return Array.from(byId.values());
}

/**
 * markOverriddenByManual
 *
 * Returns an updated applied-suggestions list where any applied suggestion
 * targeting the given field is marked as overridden.
 *
 * Call this when the engineer manually enters or measures a value that maps
 * to the same field as a note-derived suggestion.
 */
export function markOverriddenByManual(
  applied: AppliedNoteSuggestion[],
  targetField: string,
): AppliedNoteSuggestion[] {
  return applied.map(a =>
    a.targetField === targetField ? { ...a, overriddenByManual: true } : a,
  );
}
