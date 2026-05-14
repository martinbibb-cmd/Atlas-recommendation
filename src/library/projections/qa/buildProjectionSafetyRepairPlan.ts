import type { OperationalDigestV1 } from '../../../workflow/operationalDigest/OperationalDigestV1';
import type { LibraryContentProjectionV1 } from '../LibraryContentProjectionV1';
import type { LibraryProjectionSafetyV1 } from './LibraryProjectionSafetyV1';

type RepairSeverity = 'blocker' | 'warning';
type RepairKind = 'audience_change' | 'replacement_copy' | 'content_gap';

export interface ProjectionSafetyRepairItemV1 {
  readonly repairId: string;
  readonly severity: RepairSeverity;
  readonly source: string;
  readonly kind: RepairKind;
  readonly recommendation: string;
  readonly linkedConceptIds: readonly string[];
  readonly linkedCardIds: readonly string[];
  readonly linkedTaskIds: readonly string[];
}

export interface ProjectionSafetySuggestedAudienceChangeV1 {
  readonly visibility: 'installer_only' | 'office_only' | 'engineer_only' | 'compliance_audit';
  readonly reason: string;
  readonly linkedConceptIds: readonly string[];
  readonly linkedCardIds: readonly string[];
  readonly linkedTaskIds: readonly string[];
}

export interface ProjectionSafetySuggestedReplacementCopyV1 {
  readonly sourceText: string;
  readonly replacementText: string;
  readonly linkedCardId: string;
  readonly linkedConceptId?: string;
}

export interface ProjectionSafetyRepairPlanV1 {
  readonly unsafe: boolean;
  readonly repairItems: readonly ProjectionSafetyRepairItemV1[];
  readonly affectedConceptIds: readonly string[];
  readonly affectedCardIds: readonly string[];
  readonly suggestedAudienceChanges: readonly ProjectionSafetySuggestedAudienceChangeV1[];
  readonly suggestedReplacementCopy: readonly ProjectionSafetySuggestedReplacementCopyV1[];
}

export interface BuildProjectionSafetyRepairPlanInputV1 {
  readonly projection: LibraryContentProjectionV1;
  readonly safety: LibraryProjectionSafetyV1;
  readonly operationalDigest?: OperationalDigestV1;
}

interface ProjectionCardRefV1 {
  readonly cardId: string;
  readonly card: LibraryContentProjectionV1['visibleCards'][number];
  readonly linkedTaskIds: readonly string[];
}

const REPAIR_TERM_RULES = [
  {
    terms: ['inhibitor', 'bs7593', 'bs 7593', 'benchmark'],
    visibility: ['installer_only', 'compliance_audit'] as const,
    recommendation: 'Move this item to installer and compliance audit visibility only.',
    reason: 'Inhibitor/BS7593/Benchmark detail must not appear in customer projection.',
  },
  {
    terms: ['g3 mechanics', 'mcs mechanics'],
    visibility: ['office_only', 'compliance_audit'] as const,
    recommendation: 'Move this mechanics item to office and compliance audit visibility.',
    reason: 'G3/MCS mechanics belongs to office/compliance review.',
  },
  {
    terms: ['fill pressure', 'zone valve'],
    visibility: ['engineer_only'] as const,
    recommendation: 'Move this mechanical setup detail to engineer visibility.',
    reason: 'Fill pressure and zone valve detail is engineer-only content.',
  },
] as const;

const TECHNICAL_TERMS = [
  'inhibitor',
  'bs7593',
  'bs 7593',
  'benchmark',
  'g3 mechanics',
  'mcs mechanics',
  'fill pressure',
  'zone valve',
] as const;

function toLowerCaseText(value: string): string {
  return value.toLowerCase();
}

function deriveCardId(
  card: LibraryContentProjectionV1['visibleCards'][number],
  index: number,
): string {
  if (card.assetId != null && card.assetId.length > 0) return card.assetId;
  if (card.conceptId != null && card.conceptId.length > 0) return `${card.conceptId}:${index}`;
  return `${card.title.toLowerCase().replace(/\W+/g, '_')}:${index}`;
}

function buildCardRefs(
  projection: LibraryContentProjectionV1,
  operationalDigest?: OperationalDigestV1,
): ProjectionCardRefV1[] {
  return projection.visibleCards.map((card, index) => {
    const cardId = deriveCardId(card, index);
    const digestItem = card.assetId != null
      ? operationalDigest?.items.find((item) => item.id === card.assetId)
      : undefined;
    return {
      cardId,
      card,
      linkedTaskIds: digestItem?.linkedTaskIds ?? [],
    };
  });
}

function buildOutcomeCopyReplacement(
  card: LibraryContentProjectionV1['visibleCards'][number],
  technicalTerm: string,
): string {
  if (technicalTerm.includes('fill pressure')) {
    return 'What you may notice: the pressure gauge may move slightly as your heating warms up and cools down. What this means: small pressure changes are normal in a sealed heating system.';
  }

  if (technicalTerm.includes('zone valve')) {
    return 'What you may notice: different parts of your home may warm at different times. What this means: heating zones are being controlled to match room demand.';
  }

  if (
    technicalTerm.includes('inhibitor')
    || technicalTerm.includes('bs7593')
    || technicalTerm.includes('benchmark')
  ) {
    return 'What you may notice: radiators heat more evenly and system noise is reduced over time. What this means: the heating water is being protected to support reliable operation.';
  }

  if (technicalTerm === 'g3 mechanics' || technicalTerm === 'mcs mechanics') {
    return 'What you may notice: installation and handover may include additional documented checks. What this means: the upgrade is being completed with the required safety and quality controls.';
  }

  return `What you may notice: ${card.title}. What this means: this change is designed to improve day-to-day comfort and reliability.`;
}

export function buildProjectionSafetyRepairPlan(
  input: BuildProjectionSafetyRepairPlanInputV1,
): ProjectionSafetyRepairPlanV1 {
  const { projection, safety, operationalDigest } = input;

  if (projection.audience !== 'customer') {
    return {
      unsafe: false,
      repairItems: [],
      affectedConceptIds: [],
      affectedCardIds: [],
      suggestedAudienceChanges: [],
      suggestedReplacementCopy: [],
    };
  }

  const cardRefs = buildCardRefs(projection, operationalDigest);
  const repairItems: ProjectionSafetyRepairItemV1[] = [];
  const suggestedAudienceChanges: ProjectionSafetySuggestedAudienceChangeV1[] = [];
  const suggestedReplacementCopy: ProjectionSafetySuggestedReplacementCopyV1[] = [];
  const affectedConceptIds = new Set<string>();
  const affectedCardIds = new Set<string>();
  const seenRepairIds = new Set<string>();

  for (const cardRef of cardRefs) {
    const cardText = toLowerCaseText(`${cardRef.card.title} | ${cardRef.card.summary}`);
    const linkedConceptIds = cardRef.card.conceptId != null ? [cardRef.card.conceptId] : [];

    for (const rule of REPAIR_TERM_RULES) {
      const matchedTerm = rule.terms.find((term) => cardText.includes(term));
      if (matchedTerm == null) continue;

      const repairId = `audience:${cardRef.cardId}:${matchedTerm}`;
      if (!seenRepairIds.has(repairId)) {
        seenRepairIds.add(repairId);

        for (const conceptId of linkedConceptIds) affectedConceptIds.add(conceptId);
        affectedCardIds.add(cardRef.cardId);

        const source = `Card "${cardRef.card.title}" contains "${matchedTerm}"`;
        repairItems.push({
          repairId,
          severity: 'blocker',
          source,
          kind: 'audience_change',
          recommendation: rule.recommendation,
          linkedConceptIds,
          linkedCardIds: [cardRef.cardId],
          linkedTaskIds: cardRef.linkedTaskIds,
        });

        for (const visibility of rule.visibility) {
          suggestedAudienceChanges.push({
            visibility,
            reason: rule.reason,
            linkedConceptIds,
            linkedCardIds: [cardRef.cardId],
            linkedTaskIds: cardRef.linkedTaskIds,
          });
        }
      }
    }

    const technicalTerm = TECHNICAL_TERMS.find((term) => cardText.includes(term));
    if (technicalTerm != null) {
      const replacement = buildOutcomeCopyReplacement(cardRef.card, technicalTerm);
      const replacementId = `copy:${cardRef.cardId}:${technicalTerm}`;
      if (!seenRepairIds.has(replacementId)) {
        seenRepairIds.add(replacementId);
        for (const conceptId of linkedConceptIds) affectedConceptIds.add(conceptId);
        affectedCardIds.add(cardRef.cardId);

        repairItems.push({
          repairId: replacementId,
          severity: 'blocker',
          source: `Customer-visible technical-only wording in card "${cardRef.card.title}"`,
          kind: 'replacement_copy',
          recommendation: 'Rewrite this card in customer outcome wording.',
          linkedConceptIds,
          linkedCardIds: [cardRef.cardId],
          linkedTaskIds: cardRef.linkedTaskIds,
        });
        suggestedReplacementCopy.push({
          sourceText: `${cardRef.card.title}: ${cardRef.card.summary}`,
          replacementText: replacement,
          linkedCardId: cardRef.cardId,
          linkedConceptId: cardRef.card.conceptId,
        });
      }
    }
  }

  if (safety.missingRequiredContent.includes('diagrams')) {
    repairItems.push({
      repairId: 'missing:diagrams',
      severity: 'warning',
      source: 'No diagrams included in customer projection',
      kind: 'content_gap',
      recommendation: 'Add diagram coverage for customer-visible concepts in this projection.',
      linkedConceptIds: projection.visibleConcepts,
      linkedCardIds: [],
      linkedTaskIds: [],
    });
    for (const conceptId of projection.visibleConcepts) affectedConceptIds.add(conceptId);
  }

  if (safety.missingRequiredContent.includes('what_you_may_notice')) {
    repairItems.push({
      repairId: 'missing:what_you_may_notice',
      severity: 'warning',
      source: 'No "what you may notice" content found in customer projection',
      kind: 'content_gap',
      recommendation: 'Add a lived-experience card that includes "what you may notice" guidance.',
      linkedConceptIds: projection.visibleConcepts,
      linkedCardIds: [],
      linkedTaskIds: [],
    });
    for (const conceptId of projection.visibleConcepts) affectedConceptIds.add(conceptId);
  }

  return {
    unsafe: !safety.safeForCustomer,
    repairItems,
    affectedConceptIds: [...affectedConceptIds],
    affectedCardIds: [...affectedCardIds],
    suggestedAudienceChanges,
    suggestedReplacementCopy,
  };
}
