/**
 * buildNoteInfluenceSummary.ts
 *
 * Pure, deterministic builder that derives a NoteInfluenceSummary from a list
 * of AppliedNoteSuggestion records.
 *
 * This is the canonical function for turning note provenance into an
 * explainable, auditable influence summary.  It is UI-agnostic and is the
 * single source of truth for grouping (direct / advisory / overridden) and
 * explanation strings across every surface that renders note influence:
 *   - RecommendationHub
 *   - Engineer portal visit replay (VisitReplayPanel)
 *   - Future: customer portal, PDF exports, audit trails
 *
 * Guardrails enforced here:
 *   - Only records with provenance === 'accepted_atlas_suggestion' are processed.
 *   - Unaccepted suggestions are never surfaced.
 *   - direct / advisory / overridden are strictly separated — advisory context
 *     cannot accidentally become hard evidence.
 */

import type { AppliedNoteSuggestion, SuggestionCategory } from '../../features/voiceNotes/voiceNoteTypes';

// ─── Output types ─────────────────────────────────────────────────────────────

/**
 * A single influence item derived from an accepted note suggestion.
 * Carries explanation, confidence, influence type, and the verbatim source
 * snippet so every explanation can be traced back to the engineer's words.
 */
export interface NoteInfluenceItem {
  sourceSuggestionId: string;
  sourceNoteId: string;
  targetField: string;
  label: string;
  appliedValue: string;
  confidence: 'high' | 'medium' | 'low';
  category: SuggestionCategory;
  /** Verbatim transcript snippet — "because the engineer said this…" */
  sourceSnippet?: string;
  /** Human-readable explanation of how this item influenced the recommendation. */
  explanation: string;
  /** Whether this item directly affected an engine input field. */
  influenceType: 'direct' | 'advisory';
}

/**
 * Grouped summary of how accepted note suggestions influenced a recommendation.
 *
 * - `direct`    — suggestions that updated engine input fields.
 * - `advisory`  — suggestions that were accepted as context only (no engine field).
 * - `overridden` — suggestions that were subsequently overridden by a manually-
 *                  entered or measured value (kept for audit purposes).
 */
export interface NoteInfluenceSummary {
  direct: NoteInfluenceItem[];
  advisory: NoteInfluenceItem[];
  overridden: NoteInfluenceItem[];
}

// ─── Target fields that have a direct engine impact ───────────────────────────

/**
 * The set of targetField values that map to actual engine input fields.
 * Everything else is advisory (context only).
 */
const DIRECT_TARGET_FIELDS = new Set<string>([
  'preferCombi',
  'highOccupancy',
  'fullSurvey.heatingCondition.magneticDebrisEvidence',
  'fullSurvey.heatingCondition.radiatorsHeatingUnevenly',
]);

// ─── Explanation templates ────────────────────────────────────────────────────

/**
 * Parameterised explanation builders keyed by targetField.
 * Confidence shapes phrasing strength — high → assertive, low → tentative.
 */
type ExplanationBuilder = (item: AppliedNoteSuggestion) => string;

const COMBI_BY_CONFIDENCE: Record<string, string> = {
  high:   'Combi preference strengthened — customer confirmed they want to avoid a cylinder.',
  medium: 'Combi preference noted — customer indicated they would prefer to avoid a cylinder.',
  low:    'Combi preference weakly indicated — verify customer intent on site.',
};

const HIGH_OCCUPANCY_BY_CONFIDENCE: Record<string, string> = {
  high:   'High concurrent hot-water demand confirmed — simultaneous shower use expected.',
  medium: 'Elevated hot-water demand indicated — concurrent shower use likely.',
  low:    'Hot-water demand signal present — verify household usage patterns.',
};

const SLUDGE_BY_CONFIDENCE: Record<string, string> = {
  high:   'Sludge risk confirmed — magnetic filter and system flush are required.',
  medium: 'Sludge risk indicated — magnetic filter and flush are likely required.',
  low:    'Possible sludge risk — inspect system condition before proceeding.',
};

const RADIATOR_IMBALANCE_BY_CONFIDENCE: Record<string, string> = {
  high:   'Radiator imbalance confirmed — balancing or power-flush required before installation.',
  medium: 'Radiator imbalance indicated — balancing or power-flush is likely required.',
  low:    'Possible radiator imbalance — verify heat distribution during survey.',
};

const EXPLANATION_BY_FIELD: Record<string, ExplanationBuilder> = {
  preferCombi:    (item) => COMBI_BY_CONFIDENCE[item.confidence],
  highOccupancy:  (item) => HIGH_OCCUPANCY_BY_CONFIDENCE[item.confidence],
  'fullSurvey.heatingCondition.magneticDebrisEvidence':  (item) => SLUDGE_BY_CONFIDENCE[item.confidence],
  'fullSurvey.heatingCondition.radiatorsHeatingUnevenly': (item) => RADIATOR_IMBALANCE_BY_CONFIDENCE[item.confidence],
};

/**
 * Fallback explanation for advisory items without a specific template.
 * Confidence shapes the qualifier appended to the label.
 */
const ADVISORY_QUALIFIER: Record<string, string> = {
  high:   '',
  medium: ' (medium confidence)',
  low:    ' (low confidence — verify on site)',
};

function buildAdvisoryExplanation(item: AppliedNoteSuggestion): string {
  const qualifier = ADVISORY_QUALIFIER[item.confidence] ?? '';
  return `${item.label}${qualifier} — context only, does not directly affect engine inputs.`;
}

// ─── Item builder ─────────────────────────────────────────────────────────────

function toInfluenceItem(item: AppliedNoteSuggestion): NoteInfluenceItem {
  const isDirect = DIRECT_TARGET_FIELDS.has(item.targetField);
  const builder = EXPLANATION_BY_FIELD[item.targetField];
  const explanation = builder ? builder(item) : buildAdvisoryExplanation(item);

  return {
    sourceSuggestionId: item.sourceSuggestionId,
    sourceNoteId:       item.sourceNoteId,
    targetField:        item.targetField,
    label:              item.label,
    appliedValue:       item.appliedValue,
    confidence:         item.confidence,
    category:           item.category,
    sourceSnippet:      item.sourceSnippet,
    explanation,
    influenceType:      isDirect ? 'direct' : 'advisory',
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * buildNoteInfluenceSummary
 *
 * Derives a NoteInfluenceSummary from an array of AppliedNoteSuggestion
 * records, grouping them into:
 *   - direct    — affected engine inputs
 *   - advisory  — context only
 *   - overridden — superseded by manual measurement / entry
 *
 * Only records with provenance === 'accepted_atlas_suggestion' are processed.
 * Records with any other provenance value are silently excluded.
 *
 * Deduplication: if the same sourceSuggestionId appears more than once (e.g.
 * due to re-processing after note edits), only the last occurrence is retained.
 */
export function buildNoteInfluenceSummary(
  applied: AppliedNoteSuggestion[],
): NoteInfluenceSummary {
  // Guardrail: only accepted_atlas_suggestion provenance is permitted.
  const safe = applied.filter(a => a.provenance === 'accepted_atlas_suggestion');

  // Deduplicate by sourceSuggestionId — last occurrence wins.
  const deduped = new Map<string, AppliedNoteSuggestion>();
  for (const item of safe) {
    deduped.set(item.sourceSuggestionId, item);
  }

  const direct: NoteInfluenceItem[] = [];
  const advisory: NoteInfluenceItem[] = [];
  const overridden: NoteInfluenceItem[] = [];

  for (const item of deduped.values()) {
    const influence = toInfluenceItem(item);
    if (item.overriddenByManual) {
      overridden.push(influence);
    } else if (influence.influenceType === 'direct') {
      direct.push(influence);
    } else {
      advisory.push(influence);
    }
  }

  return { direct, advisory, overridden };
}
