/**
 * buildNoteInfluenceSummary.ts
 *
 * Derives a structured summary of how accepted voice-note suggestions
 * influenced the current recommendation.
 *
 * Design rules:
 *  - ONLY process non-overridden suggestions with provenance 'accepted_atlas_suggestion'.
 *  - NEVER surface unaccepted (status='suggested') or rejected suggestions.
 *  - Separate direct survey-field mappings from advisory-only influences.
 *  - Each item carries a human-readable explanation sentence for the UI.
 *  - Overridden items (superseded by manual measurement) are excluded from
 *    active influence but may be surfaced separately for audit purposes.
 */

import type { AppliedNoteSuggestion } from '../../features/voiceNotes/voiceNoteTypes';

// ─── Output types ─────────────────────────────────────────────────────────────

/**
 * A single note-derived input that influenced the recommendation.
 */
export interface NoteInfluenceItem {
  /** Stable ID of the originating suggestion. */
  sourceSuggestionId: string;
  /** Human-readable label (e.g. "Customer prefers to avoid a cylinder"). */
  label: string;
  /** Verbatim snippet from the transcript that supported this suggestion. */
  sourceSnippet?: string;
  /** Confidence band from the original extraction. */
  confidence: 'high' | 'medium' | 'low';
  /** The survey field or logical concept this mapped to. */
  targetField: string;
  /**
   * 'direct'   — the suggestion updated a concrete survey / engine field.
   * 'advisory' — the suggestion is held as advisory context; no hard engine
   *              field was changed.
   */
  influenceType: 'direct' | 'advisory';
  /**
   * Human-readable sentence explaining how this suggestion affected the
   * recommendation (e.g. "Combi preference strengthened because an accepted
   * note indicated the customer wants to avoid a cylinder.").
   */
  explanation: string;
}

/**
 * Full note influence summary split into two groups for clear UI presentation.
 *
 * `direct`   — suggestions that changed a survey / engine field.
 * `advisory` — suggestions held as advisory context only.
 *
 * Both lists contain only active (non-overridden) suggestions.
 * The `overridden` list preserves superseded suggestions for audit purposes.
 */
export interface NoteInfluenceSummary {
  /** Suggestions that directly updated survey / engine fields. */
  direct: NoteInfluenceItem[];
  /** Suggestions captured as advisory context (no engine field change). */
  advisory: NoteInfluenceItem[];
  /** Suggestions that were applied but later overridden by a manual value. */
  overridden: NoteInfluenceItem[];
  /** True when there is at least one active influence (direct or advisory). */
  hasActiveInfluence: boolean;
}

// ─── Direct-field target set ─────────────────────────────────────────────────

/**
 * Target fields that correspond to a concrete engine / survey field update.
 * All other target fields are advisory-only.
 *
 * Derived from SUGGESTION_MAPPINGS in applyAcceptedSuggestions.ts.
 */
const DIRECT_TARGET_FIELDS = new Set([
  'preferCombi',
  'highOccupancy',
  'fullSurvey.heatingCondition.magneticDebrisEvidence',
  'fullSurvey.heatingCondition.radiatorsHeatingUnevenly',
]);

// ─── Explanation copy lookup ──────────────────────────────────────────────────

/**
 * Per-targetField explanation sentences for the recommendation influence panel.
 *
 * These are intentionally plain-English descriptions that connect the note
 * insight to its recommendation effect.
 */
const EXPLANATION_BY_TARGET: Record<string, string> = {
  // Direct survey field mappings
  'preferCombi':
    'Combi preference strengthened because an accepted note indicated the customer wants to avoid a cylinder.',
  'highOccupancy':
    'Higher hot-water demand considered because an accepted note indicated high shower concurrency.',
  'fullSurvey.heatingCondition.magneticDebrisEvidence':
    'System condition risk adjusted because an accepted note suggested likely sludge in the system.',
  'fullSurvey.heatingCondition.radiatorsHeatingUnevenly':
    'Radiator imbalance flagged because an accepted note indicated uneven heating across the property.',

  // Advisory-only influences
  'preference.simple_controls':
    'Customer preference for simple controls captured — may influence control recommendation.',
  'preference.no_bath_use':
    'No bath use noted — may reduce hot-water storage sizing expectations.',
  'preference.night_worker':
    'Night-worker schedule noted — relevant to heating programme and quiet operation.',
  'preference.preferred_boiler_location':
    'Preferred boiler location noted — relevant to install planning.',
  'constraint.cupboard_tight':
    'Tight cupboard noted — may limit cylinder options or require careful sizing.',
  'constraint.storage_clearance_fail':
    'Storage clearance issue noted — may affect cylinder or system boiler suitability.',
  'constraint.flue_route_difficult':
    'Difficult flue route noted — relevant to appliance position and install cost.',
  'constraint.loft_access_poor':
    'Poor loft access noted — relevant to install logistics.',
  'constraint.narrow_stairs':
    'Narrow stairs noted — may affect delivery and install logistics.',
  'constraint.pipe_route_difficult':
    'Difficult pipe route noted — relevant to install planning and cost.',
  'constraint.parking_scaffold_issue':
    'Parking or scaffold constraint noted — relevant to install logistics.',
  'risk.microbore_pipework':
    'Possible microbore pipework noted — advisory flag for hydraulic assessment.',
  'risk.low_pressure_poor_flow':
    'Low pressure or poor flow noted — advisory flag for mains supply assessment.',
  'risk.probable_asbestos':
    'Possible asbestos noted — advisory flag for safe working assessment.',
  'usage.bath_infrequent':
    'Infrequent bath use noted — may support reduced storage sizing.',
  'followup.confirm_bath_shower_count':
    'Follow-up needed: confirm bath and shower count on site.',
  'followup.confirm_boiler_location':
    'Follow-up needed: confirm preferred boiler location.',
  'followup.mark_install_constraint':
    'Follow-up needed: mark specific install constraint for planning.',
  'followup.combi_preference_confirm':
    'Follow-up needed: confirm combi preference with customer.',
};

/**
 * Derive a fallback explanation string when no specific copy is defined.
 */
function fallbackExplanation(item: AppliedNoteSuggestion): string {
  return `Accepted note (${item.label}) captured as advisory context for this recommendation.`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * buildNoteInfluenceSummary
 *
 * Processes a list of AppliedNoteSuggestion records and returns a structured
 * NoteInfluenceSummary describing:
 *   - Which suggestions directly updated survey / engine fields.
 *   - Which suggestions are advisory context only.
 *   - Which suggestions were overridden by a subsequent manual entry.
 *
 * Guardrails:
 *   - Only processes suggestions with provenance === 'accepted_atlas_suggestion'.
 *   - Overridden items appear in the `overridden` list, not in direct/advisory.
 *   - An empty or undefined input returns an empty summary.
 *
 * @param applied  The list of applied note suggestions from the survey model.
 */
export function buildNoteInfluenceSummary(
  applied: AppliedNoteSuggestion[] | undefined,
): NoteInfluenceSummary {
  const empty: NoteInfluenceSummary = {
    direct: [],
    advisory: [],
    overridden: [],
    hasActiveInfluence: false,
  };

  if (!applied || applied.length === 0) return empty;

  const direct:    NoteInfluenceItem[] = [];
  const advisory:  NoteInfluenceItem[] = [];
  const overridden: NoteInfluenceItem[] = [];

  for (const item of applied) {
    // Guardrail: only process accepted atlas suggestions
    if (item.provenance !== 'accepted_atlas_suggestion') continue;

    const isDirect = DIRECT_TARGET_FIELDS.has(item.targetField);
    const explanation =
      EXPLANATION_BY_TARGET[item.targetField] ?? fallbackExplanation(item);

    const influenceItem: NoteInfluenceItem = {
      sourceSuggestionId: item.sourceSuggestionId,
      label:              item.label,
      sourceSnippet:      item.sourceSnippet,
      confidence:         item.confidence,
      targetField:        item.targetField,
      influenceType:      isDirect ? 'direct' : 'advisory',
      explanation,
    };

    if (item.overriddenByManual) {
      overridden.push(influenceItem);
    } else if (isDirect) {
      direct.push(influenceItem);
    } else {
      advisory.push(influenceItem);
    }
  }

  return {
    direct,
    advisory,
    overridden,
    hasActiveInfluence: direct.length > 0 || advisory.length > 0,
  };
}
