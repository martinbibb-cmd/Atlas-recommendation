import type { LibraryContentProjectionV1 } from '../LibraryContentProjectionV1';
import type { LibraryProjectionSafetyV1 } from './LibraryProjectionSafetyV1';

// ─── Blocking terms ───────────────────────────────────────────────────────────

/**
 * Terms that must NOT appear in any visible card of a customer projection.
 * Matched case-insensitively against card title and summary.
 */
const CUSTOMER_FORBIDDEN_TERMS: readonly string[] = [
  'inhibitor',
  'bs7593',
  'bs 7593',
  'benchmark',
  'fill pressure',
  'zone valve',
  'g3 mechanics',
  'mcs mechanics',
];

/**
 * Concept IDs that represent installer/compliance-only topics.
 * Any card carrying one of these IDs that survived into the customer projection
 * is treated as a hard block.
 */
const CUSTOMER_SUPPRESSED_CONCEPT_IDS: ReadonlySet<string> = new Set([
  'MNT-02',
  'inhibitor_dosing',
  'bs7593',
  'benchmark_commissioning',
  'g3_certification',
  'qualification_check',
]);

// ─── Thresholds ───────────────────────────────────────────────────────────────

/** Maximum recommended cards in a customer projection before a warning is raised. */
const MAX_CUSTOMER_CARDS = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cardHaystack(card: { title: string; summary: string }): string {
  return `${card.title} ${card.summary}`.toLowerCase();
}

// ─── Main assessor ────────────────────────────────────────────────────────────

/**
 * assessLibraryProjectionSafety
 *
 * Inspects a customer audience projection for leakage of installer/compliance
 * content and missing customer-facing content quality signals.
 *
 * Only the `customer` audience projection is evaluated; all other audiences
 * return a trivially safe result because they are never routed to customers.
 *
 * Blocking rules (safeForCustomer → false):
 *  - Forbidden term found in a visible card (inhibitor, BS7593, Benchmark,
 *    fill pressure, zone valve, G3 mechanics, MCS mechanics)
 *  - Technical-only concept ID visible in the projection
 *
 * Warning rules (safeForCustomer not affected):
 *  - No diagrams included
 *  - No calm summary card present
 *  - More than MAX_CUSTOMER_CARDS visible cards
 *  - No "what you may notice" content in any visible card
 */
export function assessLibraryProjectionSafety(
  projection: LibraryContentProjectionV1,
): LibraryProjectionSafetyV1 {
  if (projection.audience !== 'customer') {
    return {
      safeForCustomer: true,
      blockingReasons: [],
      warnings: [],
      leakageTerms: [],
      missingRequiredContent: [],
    };
  }

  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const leakageTermsSet = new Set<string>();
  const missingRequiredContent: string[] = [];

  // ── Leakage: forbidden terms ───────────────────────────────────────────────
  for (const card of projection.visibleCards) {
    const haystack = cardHaystack(card);
    for (const term of CUSTOMER_FORBIDDEN_TERMS) {
      if (haystack.includes(term.toLowerCase())) {
        if (!leakageTermsSet.has(term)) {
          leakageTermsSet.add(term);
          blockingReasons.push(
            `Customer projection leakage: card "${card.title}" contains forbidden term "${term}"`,
          );
        }
      }
    }
  }

  // ── Leakage: technical-only concept IDs ───────────────────────────────────
  for (const card of projection.visibleCards) {
    if (card.conceptId != null && CUSTOMER_SUPPRESSED_CONCEPT_IDS.has(card.conceptId)) {
      blockingReasons.push(
        `Customer projection leakage: technical-only concept "${card.conceptId}" is visible (card "${card.title}")`,
      );
    }
  }

  // ── Warning: no diagrams ──────────────────────────────────────────────────
  if (projection.visibleDiagrams.length === 0) {
    warnings.push('No diagrams included in customer projection');
    missingRequiredContent.push('diagrams');
  }

  // ── Warning: no calm summary ──────────────────────────────────────────────
  const hasCalmSummary = projection.visibleCards.some((card) => {
    const lower = `${card.title} ${card.summary}`.toLowerCase();
    return (
      lower.includes('what atlas found')
      || lower.includes('calm summary')
      || lower.includes('decision summary')
      || card.title.toLowerCase().includes('summary')
    );
  });
  if (!hasCalmSummary) {
    warnings.push('No calm summary card found in customer projection');
    missingRequiredContent.push('calm_summary');
  }

  // ── Warning: too many cards ───────────────────────────────────────────────
  if (projection.visibleCards.length > MAX_CUSTOMER_CARDS) {
    warnings.push(
      `Customer projection has ${projection.visibleCards.length} cards (recommended maximum: ${MAX_CUSTOMER_CARDS})`,
    );
  }

  // ── Warning: no "what you may notice" content ─────────────────────────────
  const hasWhatYouMayNotice = projection.visibleCards.some((card) =>
    cardHaystack(card).includes('what you may notice'),
  );
  if (!hasWhatYouMayNotice) {
    warnings.push('No "what you may notice" content found in customer projection');
    missingRequiredContent.push('what_you_may_notice');
  }

  return {
    safeForCustomer: blockingReasons.length === 0,
    blockingReasons,
    warnings,
    leakageTerms: [...leakageTermsSet],
    missingRequiredContent,
  };
}
