import type { CalmWelcomePackCardV1, CalmWelcomePackViewModelV1 } from '../packRenderer/CalmWelcomePackViewModelV1';
import type { DiagramExplanationEntry } from '../diagrams/diagramExplanationRegistry';
import { diagramExplanationRegistry } from '../diagrams/diagramExplanationRegistry';
import type { EducationalContentV1 } from '../content/EducationalContentV1';
import type { OperationalDigestV1, OperationalIntentGroupV1 } from '../../workflow/operationalDigest/OperationalDigestV1';
import type { LibraryAudienceV1 } from './LibraryAudienceV1';
import type {
  LibraryAuditTraceEntryV1,
  LibraryContentProjectionV1,
  LibraryHiddenReasonEntryV1,
} from './LibraryContentProjectionV1';

// ─── Input ────────────────────────────────────────────────────────────────────

export interface BuildLibraryAudienceProjectionInputV1 {
  readonly calmViewModel: CalmWelcomePackViewModelV1;
  readonly operationalDigest: OperationalDigestV1;
  readonly educationalContent: readonly EducationalContentV1[];
  readonly audience: LibraryAudienceV1;
}

// ─── Customer suppression definitions ────────────────────────────────────────

/**
 * Terms that identify installer/compliance content that must not appear in a
 * customer-facing projection.  Matched case-insensitively against card title,
 * summary, and conceptId.
 */
const CUSTOMER_SUPPRESSED_TERMS: readonly string[] = [
  'inhibitor',
  'bs7593',
  'bs 7593',
  'benchmark',
  'g3 qualification',
  'g3-qualified',
  'g3 installer',
  'commissioning checklist',
  'commissioning procedure',
];

/**
 * Exact concept IDs that represent installer/compliance topics suppressed from
 * the customer audience.
 */
const CUSTOMER_SUPPRESSED_CONCEPT_IDS = new Set<string>([
  'MNT-02',
  'inhibitor_dosing',
  'bs7593',
  'benchmark_commissioning',
  'g3_certification',
  'qualification_check',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeForSearch(value: string): string {
  return value.toLowerCase().trim();
}

function deriveCardId(card: CalmWelcomePackCardV1): string {
  return card.assetId ?? card.conceptId ?? normalizeForSearch(card.title).replace(/\W+/g, '_');
}

function classifyCardForCustomer(card: CalmWelcomePackCardV1): { suppressed: boolean; reason: string } {
  const normalizedTitle = normalizeForSearch(card.title);
  const normalizedSummary = normalizeForSearch(card.summary);
  const normalizedConcept = normalizeForSearch(card.conceptId ?? '');

  for (const term of CUSTOMER_SUPPRESSED_TERMS) {
    if (
      normalizedTitle.includes(term) ||
      normalizedSummary.includes(term) ||
      normalizedConcept.includes(term)
    ) {
      return {
        suppressed: true,
        reason: `Content references '${term}' which is installer/compliance detail not shown to customers`,
      };
    }
  }

  if (card.conceptId && CUSTOMER_SUPPRESSED_CONCEPT_IDS.has(card.conceptId)) {
    return {
      suppressed: true,
      reason: `Concept '${card.conceptId}' is classified as installer/compliance-only content`,
    };
  }

  return { suppressed: false, reason: 'Customer-safe outcome/expectation content' };
}

function buildProjectedDiagrams(visibleConceptIds: ReadonlySet<string>): DiagramExplanationEntry[] {
  return diagramExplanationRegistry.filter((diagram) =>
    diagram.conceptIds.some((id) => visibleConceptIds.has(id)),
  );
}

function digestItemToCard(item: OperationalIntentGroupV1): CalmWelcomePackCardV1 {
  return {
    // Use assetId to carry the digest item ID so that conceptId is not
    // conflated with an educational concept identifier.
    assetId: item.id,
    title: item.title,
    summary: item.summary,
  };
}

// ─── Audience-specific card collection ───────────────────────────────────────

interface CardClassificationResult {
  readonly visibleCards: CalmWelcomePackCardV1[];
  readonly hiddenReasonLog: LibraryHiddenReasonEntryV1[];
  readonly auditTrace: LibraryAuditTraceEntryV1[];
}

/**
 * Applies customer-suppression rules to the flat list of view-model cards.
 * Cards containing inhibitor dosing, BS7593, Benchmark, G3, or commissioning
 * minutiae are excluded; only outcome/expectation/action cards remain.
 */
function classifyViewModelCards(
  cards: readonly CalmWelcomePackCardV1[],
  suppressForCustomer: boolean,
): CardClassificationResult {
  const visibleCards: CalmWelcomePackCardV1[] = [];
  const hiddenReasonLog: LibraryHiddenReasonEntryV1[] = [];
  const auditTrace: LibraryAuditTraceEntryV1[] = [];

  for (const card of cards) {
    const contentId = deriveCardId(card);
    const linkedConceptIds = card.conceptId ? [card.conceptId] : [];

    if (suppressForCustomer) {
      const { suppressed, reason } = classifyCardForCustomer(card);
      if (suppressed) {
        hiddenReasonLog.push({ contentId, title: card.title, reason });
        auditTrace.push({ contentId, title: card.title, decision: 'hidden', reason, linkedConceptIds });
      } else {
        visibleCards.push(card);
        auditTrace.push({ contentId, title: card.title, decision: 'visible', reason, linkedConceptIds });
      }
    } else {
      visibleCards.push(card);
      auditTrace.push({
        contentId,
        title: card.title,
        decision: 'visible',
        reason: 'All content visible to this audience',
        linkedConceptIds,
      });
    }
  }

  return { visibleCards, hiddenReasonLog, auditTrace };
}

/**
 * Converts relevant operational digest items into cards for a given audience,
 * based on install phase and visibility.
 *
 * - surveyor  → survey-phase items visible to the installer role
 * - office    → coordination-phase items visible to office
 * - engineer  → installation-phase items visible to the installer role
 * - audit     → all items regardless of phase
 */
function buildDigestCards(
  digest: OperationalDigestV1,
  audience: LibraryAudienceV1,
): CalmWelcomePackCardV1[] {
  if (audience === 'customer') return [];

  return digest.items
    .filter((item) => {
      if (audience === 'audit') return true;
      if (audience === 'surveyor') {
        return (
          item.installPhase === 'survey' &&
          (item.visibility.includes('installer_only') ||
            item.visibility.includes('customer_summary') ||
            item.visibility.includes('customer_action_required'))
        );
      }
      if (audience === 'office') {
        return (
          item.installPhase === 'coordination' &&
          (item.visibility.includes('office_only') ||
            item.visibility.includes('compliance_audit'))
        );
      }
      // engineer
      return (
        item.installPhase === 'installation' &&
        (item.visibility.includes('installer_only') ||
          item.visibility.includes('customer_summary') ||
          item.visibility.includes('customer_action_required'))
      );
    })
    .map(digestItemToCard);
}

function buildDigestAuditTrace(
  digest: OperationalDigestV1,
  audience: LibraryAudienceV1,
): LibraryAuditTraceEntryV1[] {
  if (audience !== 'audit') return [];

  return digest.items.map((item) => ({
    contentId: item.id,
    title: item.title,
    decision: 'visible' as const,
    reason: 'Full operational digest included for audit traceability',
    linkedConceptIds: [item.id, ...item.linkedTaskIds],
  }));
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * buildLibraryAudienceProjection
 *
 * Produces a scoped, read-only projection of library content for a specific
 * audience.  No input objects are mutated; all output collections are new
 * arrays.
 *
 * Audience rules
 * ──────────────
 * customer  — outcomes, expectations, and actions only.  Inhibitor dosing,
 *             BS7593, Benchmark, G3 mechanics, and commissioning minutiae are
 *             suppressed.
 *
 * surveyor  — customer-safe cards + survey-phase operational digest items
 *             (things to confirm, measure, photograph, and ask on-site).
 *
 * office    — customer-safe cards + coordination-phase digest items
 *             (qualifications, quote readiness, unresolved commercial/spec risk).
 *
 * engineer  — all view-model cards (no suppression) + installation-phase
 *             digest items (fit/remove/check/commissioning bullets).
 *
 * audit     — everything, with complete auditTrace for every item considered.
 */
export function buildLibraryAudienceProjection(
  input: BuildLibraryAudienceProjectionInputV1,
): LibraryContentProjectionV1 {
  const { calmViewModel, operationalDigest, audience } = input;

  // Collect all cards from the view model (immutable source – never mutated).
  const allViewModelCards: readonly CalmWelcomePackCardV1[] =
    calmViewModel.customerFacingSections.flatMap((section) => section.cards);

  // Customer and surveyor/office audiences receive customer-suppression filtering;
  // engineer and audit receive all cards.
  const suppressForCustomer = audience === 'customer' || audience === 'surveyor' || audience === 'office';

  const { visibleCards: filteredViewModelCards, hiddenReasonLog, auditTrace: vmAuditTrace } =
    classifyViewModelCards(allViewModelCards, suppressForCustomer);

  // Derive digest-sourced cards for the appropriate audience phase.
  const digestCards = buildDigestCards(operationalDigest, audience);

  const allVisibleCards = [...filteredViewModelCards, ...digestCards];

  // Derive unique concept IDs from all visible cards.
  const visibleConceptSet = new Set<string>();
  for (const card of allVisibleCards) {
    if (card.conceptId) visibleConceptSet.add(card.conceptId);
  }
  const visibleConcepts = [...visibleConceptSet];

  // Diagrams whose concept IDs intersect with visible concepts.
  const visibleDiagrams = buildProjectedDiagrams(visibleConceptSet);

  // Audit trace for digest items (only the audit audience gets full digest traceability).
  const digestAuditTrace = buildDigestAuditTrace(operationalDigest, audience);

  return {
    audience,
    visibleConcepts,
    visibleCards: allVisibleCards,
    visibleDiagrams,
    hiddenReasonLog,
    auditTrace: [...vmAuditTrace, ...digestAuditTrace],
  };
}
