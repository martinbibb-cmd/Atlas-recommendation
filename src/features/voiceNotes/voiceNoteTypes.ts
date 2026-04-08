/**
 * voiceNoteTypes.ts
 *
 * Types for the voice-note ingestion pipeline.
 *
 * Voice notes can partially prefill the survey as "Atlas suggestions" — but
 * they are NEVER promoted to authoritative truth.  Every suggestion carries
 * explicit provenance, confidence, and status so the recommendation engine
 * can weight them appropriately.
 */

// ─── Provenance ───────────────────────────────────────────────────────────────

/**
 * All values a survey field's provenance may take.
 * Determines how strongly the recommendation engine should trust the value.
 */
export type SurveyFieldProvenance =
  | 'measured'                  // site measurement (pressure gauge, flow test, etc.)
  | 'scanned'                   // extracted from a scan bundle
  | 'entered_manually'          // engineer typed the value in the form
  | 'inferred_from_voice_note'  // derived from a voice-note transcript
  | 'inferred_from_photo'       // derived from image interpretation
  | 'accepted_atlas_suggestion' // engineer accepted an Atlas-generated suggestion
  | 'defaulted';                // engine-safe fallback applied at normalisation

// ─── Suggestion lifecycle ─────────────────────────────────────────────────────

/** Lifecycle status of a single suggestion derived from a voice note. */
export type SuggestionStatus = 'suggested' | 'accepted' | 'rejected';

// ─── Suggestion categories ────────────────────────────────────────────────────

/**
 * Broad categories that voice-note suggestions fall into.
 * Used for grouping in the "Suggested from notes" panel.
 */
export type SuggestionCategory =
  | 'preferences'  // customer wants, likes, stated preferences
  | 'constraints'  // install constraints, access issues, clearance limits
  | 'usage'        // hot-water habits, bath/shower patterns, occupancy clues
  | 'risks'        // sludge, microbore, poor pressure, condition concerns
  | 'follow_ups';  // questions Atlas cannot answer from the note alone

// ─── Core types ───────────────────────────────────────────────────────────────

/**
 * VoiceNoteSuggestion
 *
 * A single survey-input suggestion derived from a voice-note transcript.
 * Should never be treated as authoritative truth — status starts as
 * 'suggested' and only moves to 'accepted' when the engineer explicitly
 * confirms it.
 */
export interface VoiceNoteSuggestion {
  /** Stable ID for this suggestion. */
  id: string;
  /** Survey field key or logical concept this maps to. */
  key: string;
  /** Human-readable label shown in the UI. */
  label: string;
  /** Suggested value as a string (may be a boolean/enum rendered as text). */
  suggestedValue: string;
  /** Confidence in the extraction: how reliably the note supports this value. */
  confidence: 'high' | 'medium' | 'low';
  /** ID of the VoiceNote this was derived from. */
  sourceNoteId: string;
  /** Verbatim snippet from the transcript that supports this suggestion. */
  sourceSnippet: string;
  /** Always 'inferred_from_voice_note' for voice-note-derived suggestions. */
  provenance: 'inferred_from_voice_note';
  /** Lifecycle status — starts as 'suggested'. */
  status: SuggestionStatus;
  /** Category for UI grouping. */
  category: SuggestionCategory;
}

/**
 * VoiceNote
 *
 * A single voice note attached to a visit, stored as a text transcript.
 * The suggestions field holds all Atlas-derived survey-input candidates
 * extracted from this note.
 */
export interface VoiceNote {
  /** Stable UUID for this note. */
  id: string;
  /** ID of the parent visit. */
  visitId: string;
  /** Free-form text transcript of the note. */
  transcript: string;
  /** ISO timestamp of when this note was recorded. */
  createdAt: string;
  /**
   * Atlas-derived suggestions extracted from this transcript.
   * These are suggestions only — never auto-applied to the survey.
   */
  suggestions: VoiceNoteSuggestion[];
}

// ─── Category metadata ────────────────────────────────────────────────────────

export interface SuggestionCategoryMeta {
  key: SuggestionCategory;
  label: string;
  emoji: string;
}

export const SUGGESTION_CATEGORY_META: SuggestionCategoryMeta[] = [
  { key: 'preferences', label: 'Customer preferences',    emoji: '🎯' },
  { key: 'constraints', label: 'Install constraints',     emoji: '⚠️' },
  { key: 'usage',       label: 'Usage signals',           emoji: '🚿' },
  { key: 'risks',       label: 'Risk / condition flags',  emoji: '🔴' },
  { key: 'follow_ups',  label: 'Follow-up questions',     emoji: '❓' },
];

// ─── Applied suggestion (post-acceptance) ─────────────────────────────────────

/**
 * AppliedNoteSuggestion
 *
 * An accepted suggestion that has been mapped and applied to the survey model.
 * Retains full provenance so the recommendation engine can treat it with
 * appropriate trust (lower than measured / scanned / manually-confirmed values).
 *
 * These are stored in fullSurvey.appliedNoteSuggestions and rendered in the
 * survey UI as "Accepted from note" values.
 */
export interface AppliedNoteSuggestion {
  /** ID of the originating VoiceNoteSuggestion. */
  sourceSuggestionId: string;
  /** ID of the originating VoiceNote. */
  sourceNoteId: string;
  /**
   * The survey / engine field this suggestion was applied to, or a logical
   * concept name for indirect influences (e.g. 'risk.likely_sludge',
   * 'constraint.cupboard_tight').
   */
  targetField: string;
  /** Human-readable label for display in the survey. */
  label: string;
  /** The value that was applied, as a string (may represent a boolean or enum). */
  appliedValue: string;
  /**
   * Verbatim snippet from the original transcript that supported this suggestion.
   * Preserved from the source VoiceNoteSuggestion for provenance display.
   */
  sourceSnippet?: string;
  /** Confidence from the original extraction. */
  confidence: 'high' | 'medium' | 'low';
  /** Provenance — always 'accepted_atlas_suggestion' for applied note values. */
  provenance: 'accepted_atlas_suggestion';
  /** Category of the original suggestion (for grouping in UI). */
  category: SuggestionCategory;
  /**
   * When true, this applied value was subsequently overridden by a
   * manually-entered or measured value.  The note value is retained for
   * provenance / audit purposes but no longer influences recommendations.
   */
  overriddenByManual?: boolean;
}
