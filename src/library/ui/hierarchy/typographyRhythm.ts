/**
 * Typography rhythm rules for the Atlas educational system.
 *
 * These constants enforce "one idea at a time" pacing through
 * character / sentence / heading limits. They extend the base
 * tokens in src/library/ui/tokens/typography.ts and are enforced
 * by VisualNoiseAudit and validated in tests.
 */

// ─── Section-intro limits ──────────────────────────────────────────────────

/**
 * Maximum characters for a section-level introductory paragraph.
 * Exceeding this risks the section feeling like a dense information
 * dump before the first card has even appeared.
 */
export const MAX_SECTION_INTRO_CHARACTERS = 180;

// ─── Sentence-length soft limits ──────────────────────────────────────────

/**
 * Soft limit on characters per sentence.
 * Sentences longer than this are flagged as hard to parse for users
 * with dyslexia, ADHD, or low technical literacy.
 */
export const SENTENCE_LENGTH_SOFT_LIMIT_CHARACTERS = 120;

/**
 * Hard limit on characters per sentence.
 * Sentences exceeding this must be split; the audit raises an error (not a
 * warning) for sentences beyond this threshold.
 */
export const SENTENCE_LENGTH_HARD_LIMIT_CHARACTERS = 180;

// ─── Bold / highlight limits ───────────────────────────────────────────────

/**
 * Maximum proportion of words in a paragraph that may be bold or highlighted.
 * Expressed as a fraction (0–1).
 * If more than this fraction is emphasised, every word becomes equally loud
 * and emphasis loses meaning.
 */
export const MAX_EMPHASIS_WORD_FRACTION = 0.15;

// ─── Heading spacing rules ─────────────────────────────────────────────────

/**
 * Minimum number of body characters that must appear between two headings of
 * the same level before the VisualNoiseAudit flags "heading collision".
 * Prevents two adjacent headings with almost no content between them.
 */
export const MIN_BODY_CHARACTERS_BETWEEN_SAME_LEVEL_HEADINGS = 80;

// ─── Simultaneous callouts ─────────────────────────────────────────────────

/**
 * Maximum number of distinct callout types (analogy, safety notice,
 * misconception, what-you-may-notice, key-point) that may appear in a
 * single card without the audit flagging callout overload.
 */
export const MAX_CALLOUT_TYPES_PER_CARD = 2;

/**
 * Maximum number of simultaneous inline callouts across a full section.
 * This is a section-wide cap, regardless of how they are distributed
 * across individual cards.
 */
export const MAX_SIMULTANEOUS_CALLOUTS_PER_SECTION = 3;

// ─── Typography rhythm descriptor ─────────────────────────────────────────

/**
 * A summary of all typography rhythm limits, suitable for passing to
 * audit helpers or documentation generators.
 */
export const typographyRhythmRules = {
  maxSectionIntroCharacters: MAX_SECTION_INTRO_CHARACTERS,
  sentenceLengthSoftLimitCharacters: SENTENCE_LENGTH_SOFT_LIMIT_CHARACTERS,
  sentenceLengthHardLimitCharacters: SENTENCE_LENGTH_HARD_LIMIT_CHARACTERS,
  maxEmphasisWordFraction: MAX_EMPHASIS_WORD_FRACTION,
  minBodyCharactersBetweenSameLevelHeadings: MIN_BODY_CHARACTERS_BETWEEN_SAME_LEVEL_HEADINGS,
  maxCalloutTypesPerCard: MAX_CALLOUT_TYPES_PER_CARD,
  maxSimultaneousCalloutsPerSection: MAX_SIMULTANEOUS_CALLOUTS_PER_SECTION,
} as const;
