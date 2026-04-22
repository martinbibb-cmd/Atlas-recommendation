/**
 * canonicalSections.ts — Single source of truth for the Atlas canonical
 * presentation structure.
 *
 * All three output formats (in-room, customer-pack, technical-pack) are
 * rendered from the same InsightPack data model.  This file defines:
 *   - the ordered section catalogue (CanonicalSection[])
 *   - which sections are visible in each mode (SECTIONS_BY_MODE)
 *   - the hierarchy tier for each section (recommendation / explanation / technical)
 *
 * Rules (non-negotiable):
 *   - Section order must never change — only visibility differs per mode.
 *   - customer-pack sections must be a strict subset of in-room sections.
 *   - technical-pack includes every section (never fewer than in-room).
 *   - No section may be added to SECTIONS_BY_MODE without being in CANONICAL_SECTIONS.
 */

// ─── Section IDs ──────────────────────────────────────────────────────────────

export type CanonicalSectionId =
  | 'cover'
  | 'what-we-know'
  | 'overview'
  | 'best-advice'
  | 'daily-use'
  | 'ratings'
  | 'limitations'
  | 'improvements'
  | 'savings'
  | 'why-atlas'
  | 'next-steps';

// ─── Presentation mode ────────────────────────────────────────────────────────

/**
 * Which rendering mode the InsightPackDeck is operating in.
 *
 *   in-room       — Full 11-section interactive presentation for the
 *                   in-room surveyor session.  One section per screen.
 *                   All sections visible.  Visuals-first.
 *
 *   customer-pack — Trimmed 6-section print-optimised layout.
 *                   Shows only recommendation-tier and key explanation
 *                   sections.  Ratings simplified to suitability only.
 *                   Limitations limited to high-severity only.
 *                   Designed to feel complete but not overwhelming.
 *
 *   technical-pack — Full 11-section presentation with expanded engineering
 *                    detail.  Positioned as supporting evidence, not the
 *                    default customer output.  Includes physics strings.
 */
export type PresentationMode = 'in-room' | 'customer-pack' | 'technical-pack';

// ─── Hierarchy tiers ──────────────────────────────────────────────────────────

/**
 * The narrative hierarchy tier for a canonical section.
 *
 *   recommendation — The headline story (what we recommend, why, what next).
 *                    Always shown in every mode.
 *
 *   explanation    — Supporting detail that helps the customer understand
 *                    the recommendation.  Shown in-room and technical-pack.
 *                    In customer-pack, shown in condensed or summary form only.
 *
 *   technical      — Engineering evidence for validation and challenge
 *                    conversations.  Shown in-room and technical-pack.
 *                    Not shown in customer-pack.
 */
export type SectionTier = 'recommendation' | 'explanation' | 'technical';

// ─── Section catalogue ────────────────────────────────────────────────────────

export interface CanonicalSection {
  /** Stable identifier — must never change once shipped. */
  id: CanonicalSectionId;
  /** Short display label for navigation tabs. */
  label: string;
  /** Emoji icon for navigation tabs. */
  icon: string;
  /** Narrative hierarchy tier. */
  tier: SectionTier;
}

/**
 * Ordered catalogue of all canonical sections.
 * This is the single source of truth — all three output modes derive
 * their section lists from this array.
 */
export const CANONICAL_SECTIONS: readonly CanonicalSection[] = [
  { id: 'cover',         label: 'Your Home',         icon: '🏠', tier: 'recommendation' },
  { id: 'what-we-know',  label: 'What We Looked At', icon: '📋', tier: 'explanation'    },
  { id: 'overview',      label: 'Options',            icon: '📄', tier: 'explanation'    },
  { id: 'best-advice',   label: 'Best Advice',        icon: '🎯', tier: 'recommendation' },
  { id: 'daily-use',     label: 'Day to Day',         icon: '☀️', tier: 'recommendation' },
  { id: 'ratings',       label: 'Ratings',            icon: '⭐', tier: 'explanation'    },
  { id: 'limitations',   label: 'Limitations',        icon: '⚠️', tier: 'technical'      },
  { id: 'improvements',  label: 'Improvements',       icon: '🔧', tier: 'explanation'    },
  { id: 'savings',       label: 'Savings',            icon: '💡', tier: 'explanation'    },
  { id: 'why-atlas',     label: 'Why This',           icon: '🧠', tier: 'technical'      },
  { id: 'next-steps',    label: 'Next Steps',         icon: '✅', tier: 'recommendation' },
] as const;

// ─── Sections visible per mode ────────────────────────────────────────────────

/**
 * Which canonical sections are rendered in each presentation mode.
 *
 * Rules:
 *   - Sections are always rendered in canonical order (as listed above).
 *   - customer-pack sections are a strict subset of in-room sections.
 *   - technical-pack is identical to in-room (same sections; panels may
 *     optionally expose extra engineering detail at render time).
 */
export const SECTIONS_BY_MODE: Readonly<Record<PresentationMode, readonly CanonicalSectionId[]>> = {
  'in-room': [
    'cover',
    'what-we-know',
    'overview',
    'best-advice',
    'daily-use',
    'ratings',
    'limitations',
    'improvements',
    'savings',
    'why-atlas',
    'next-steps',
  ],
  'customer-pack': [
    'cover',
    'what-we-know',
    'best-advice',
    'daily-use',
    'ratings',
    'next-steps',
  ],
  'technical-pack': [
    'cover',
    'what-we-know',
    'overview',
    'best-advice',
    'daily-use',
    'ratings',
    'limitations',
    'improvements',
    'savings',
    'why-atlas',
    'next-steps',
  ],
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the ordered CanonicalSection list for the given mode.
 * Preserves canonical catalogue order regardless of the order
 * entries appear in SECTIONS_BY_MODE.
 */
export function sectionsForMode(mode: PresentationMode): readonly CanonicalSection[] {
  const visibleIds = new Set<CanonicalSectionId>(SECTIONS_BY_MODE[mode]);
  return CANONICAL_SECTIONS.filter(s => visibleIds.has(s.id));
}
