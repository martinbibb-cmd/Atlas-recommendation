/**
 * Card emphasis rules for the Atlas educational system.
 *
 * Defines how each VisualPriorityLevel maps to concrete card-level
 * layout treatment: width, visual weight, and grouping behaviour.
 * These rules complement visualHierarchyRules.ts (section-level) and
 * typographyRhythm.ts (text-level).
 */

import type { VisualPriorityLevel } from './EducationalVisualPriorityV1';

// ─── CSS class name helpers ────────────────────────────────────────────────

/**
 * Returns the BEM modifier class to apply to a card element based on its
 * visual priority level.
 *
 * Usage:
 *   <article className={`atlas-edu-card ${cardPriorityClass(priority)}`}>
 */
export function cardPriorityClass(level: VisualPriorityLevel): string {
  switch (level) {
    case 'primary':
      return 'atlas-edu-card--priority-primary';
    case 'supporting':
      return 'atlas-edu-card--priority-supporting';
    case 'optional':
      return 'atlas-edu-card--priority-optional';
    case 'deferred':
      return 'atlas-edu-card--priority-deferred';
  }
}

// ─── ARIA helpers ──────────────────────────────────────────────────────────

/**
 * Returns the ARIA label suffix that qualifies a card's priority for
 * screen readers. Used to give non-visual users the same "weight" signal
 * that sighted users receive from layout and colour.
 */
export function cardPriorityAriaLabel(
  cardTitle: string,
  level: VisualPriorityLevel,
): string {
  switch (level) {
    case 'primary':
      return cardTitle;
    case 'supporting':
      return `${cardTitle} — supporting detail`;
    case 'optional':
      return `${cardTitle} — optional detail`;
    case 'deferred':
      return `${cardTitle} — available via QR deep dive`;
  }
}

// ─── Grouping rules ────────────────────────────────────────────────────────

/**
 * When true, cards at this priority level should be wrapped in a shared
 * visual group (e.g. a bordered cluster) rather than rendered individually.
 *
 * Convention: `true` means the renderer *should* group these cards together;
 * it does not mean they currently *are* grouped — that is up to the renderer.
 */
export const CARD_PRIORITY_SHOULD_BE_GROUPED: Record<VisualPriorityLevel, boolean> = {
  primary: false,
  supporting: true,
  optional: false,
  deferred: false,
} as const;

/**
 * @deprecated Use CARD_PRIORITY_SHOULD_BE_GROUPED instead.
 * @see CARD_PRIORITY_SHOULD_BE_GROUPED
 */
export const CARD_PRIORITY_GROUPED = CARD_PRIORITY_SHOULD_BE_GROUPED;

// ─── Prose description (for docs / audit reports) ─────────────────────────

/**
 * Human-readable description of each level's card treatment.
 * Used in audit reports, the educational-visual-hierarchy.md doc, and
 * dev preview tooltips.
 */
export const CARD_EMPHASIS_DESCRIPTIONS: Record<VisualPriorityLevel, string> = {
  primary:
    'Full width. Stronger visual weight (accent border, prominent heading). ' +
    'Maximum one per section. Not collapsible.',
  supporting:
    'Grouped in clusters of up to two. Standard visual weight. ' +
    'Not collapsible. Uses standard card border and heading scale.',
  optional:
    'Visually subdued (muted text, light border). ' +
    'Collapsed by default — requires user interaction to expand. ' +
    'Must not compete with primary or supporting cards.',
  deferred:
    'Not rendered inline in the pack. ' +
    'Content is placed in QR / deep-dive destinations only. ' +
    'Must never be visually dominant on any page.',
} as const;
