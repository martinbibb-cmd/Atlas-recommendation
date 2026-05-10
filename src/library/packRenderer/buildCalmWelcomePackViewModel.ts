import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { EducationalContentV1 } from '../content/EducationalContentV1';
import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import type { EducationalPackSectionId } from '../contracts/EducationalPackV1';
import type { WelcomePackEligibilityMode, WelcomePackPlanV1 } from '../packComposer/WelcomePackComposerV1';
import type { EducationalConceptTaxonomyV1 } from '../taxonomy/EducationalConceptTaxonomyV1';
import type {
  CalmWelcomePackCardV1,
  CalmWelcomePackQrDestinationV1,
  CalmWelcomePackSectionId,
  CalmWelcomePackViewModelV1,
} from './CalmWelcomePackViewModelV1';

const MAX_CALM_PACK_PAGES = 4;
const DEFERRED_REASON_PATTERN = /\bdefer(?:red)?\b|\bqr\b|\bdeep(?:er)?\b|\bappendix\b|\bdetail\b|\bbudget\b/i;

const SECTION_ORDER: CalmWelcomePackSectionId[] = [
  'calm_summary',
  'why_this_fits',
  'living_with_the_system',
  'relevant_explainers',
  'safety_and_compliance',
  'optional_technical_appendix',
  'next_steps',
];

const SECTION_TITLES: Record<CalmWelcomePackSectionId, string> = {
  calm_summary: 'What Atlas found',
  why_this_fits: 'Why this fits',
  living_with_the_system: 'Living with your system',
  relevant_explainers: 'Relevant explainers',
  safety_and_compliance: 'Safety and compliance',
  optional_technical_appendix: 'Optional technical appendix',
  next_steps: 'Next steps',
};

export interface BuildCalmWelcomePackViewModelInputV1 {
  plan: WelcomePackPlanV1;
  customerSummary: CustomerSummaryV1;
  taxonomy: EducationalConceptTaxonomyV1[];
  assets: EducationalAssetV1[];
  educationalContent: EducationalContentV1[];
  eligibilityMode: WelcomePackEligibilityMode;
  includeTechnicalAppendix?: boolean;
}

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

function parseAssetIdFromDestination(destination: string): string | undefined {
  const marker = 'atlas://educational-library/';
  if (!destination.startsWith(marker)) {
    return undefined;
  }
  const assetId = destination.slice(marker.length).trim();
  return assetId.length > 0 ? assetId : undefined;
}

function estimateUsedPages(sectionCount: number, qrCount: number): number {
  const computed = sectionCount + (qrCount > 0 ? 1 : 0);
  return Math.min(MAX_CALM_PACK_PAGES, Math.max(1, computed));
}

function isDeferredReason(reason: string): boolean {
  return DEFERRED_REASON_PATTERN.test(reason);
}

function sectionCardsFromCustomerSummary(customerSummary: CustomerSummaryV1): CalmWelcomePackCardV1[] {
  const cards: CalmWelcomePackCardV1[] = [];
  if (customerSummary.headline.trim().length > 0) {
    cards.push({
      title: customerSummary.recommendedSystemLabel,
      summary: customerSummary.headline.trim(),
    });
  }
  if (customerSummary.plainEnglishDecision.trim().length > 0) {
    cards.push({
      title: 'Decision summary',
      summary: customerSummary.plainEnglishDecision.trim(),
    });
  }
  return cards;
}

function getCardSummaryForSection(
  content: EducationalContentV1,
  includeTechnicalAppendix: boolean,
  sectionId: CalmWelcomePackSectionId,
): string {
  if (sectionId === 'optional_technical_appendix' && includeTechnicalAppendix) {
    return (content.technicalAppendixSummary ?? '').trim()
      || (content.printSummary ?? '').trim()
      || (content.customerExplanation ?? '').trim();
  }
  return (content.printSummary ?? '').trim() || (content.customerExplanation ?? '').trim();
}

export function buildCalmWelcomePackViewModel(
  input: BuildCalmWelcomePackViewModelInputV1,
): CalmWelcomePackViewModelV1 {
  const {
    plan,
    customerSummary,
    taxonomy,
    assets,
    educationalContent,
    eligibilityMode,
    includeTechnicalAppendix = false,
  } = input;

  const internalOmissionLog: CalmWelcomePackViewModelV1['internalOmissionLog'] = [];
  const blockingReasons: string[] = [];

  if (customerSummary.recommendedScenarioId !== plan.recommendedScenarioId) {
    blockingReasons.push('Customer summary scenario does not match plan scenario.');
  }

  if (eligibilityMode !== 'filter') {
    blockingReasons.push('Calm pack requires eligibility filtering for customer-pack output.');
  }

  const contentByConceptId = new Map(educationalContent.map((entry) => [entry.conceptId, entry]));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const selectedConceptSet = new Set(plan.selectedConceptIds);
  const deferredConceptSet = new Set(plan.deferredConceptIds);
  const sectionAssetMap = new Map<EducationalPackSectionId, string[]>(
    plan.sections.map((section) => [section.id, uniqueInOrder(section.includedAssetIds)]),
  );
  const omittedReasonByAssetId = new Map(plan.omittedAssetIdsWithReason.map((item) => [item.assetId, item.reason]));

  const eligibleAssetIds = new Set<string>();
  const findingsByAssetId = new Map(
    (plan.eligibilityFindings ?? [])
      .filter((finding) => finding.mode === 'customer_pack')
      .map((finding) => [finding.assetId, finding]),
  );

  for (const assetId of uniqueInOrder(plan.selectedAssetIds)) {
    const finding = findingsByAssetId.get(assetId);
    if (!finding) {
      internalOmissionLog.push({
        assetId,
        reason: 'Asset omitted because no customer-pack eligibility finding exists.',
      });
      continue;
    }

    if (!finding.eligible) {
      internalOmissionLog.push({
        assetId,
        reason: `Asset omitted by customer-pack eligibility filter: ${finding.reasons.join(' ') || 'Ineligible for customer-pack output.'}`,
      });
      continue;
    }

    const asset = assetById.get(assetId);
    if (!asset) {
      internalOmissionLog.push({
        assetId,
        reason: 'Asset omitted because it was not found in provided assets.',
      });
      continue;
    }

    // Calm packs are intentionally low-load for customer-first delivery.
    if (asset.cognitiveLoad !== 'low') {
      internalOmissionLog.push({
        assetId,
        reason: `Asset omitted because cognitive load is ${asset.cognitiveLoad}, but calm packs only include low-load assets.`,
      });
      continue;
    }

    eligibleAssetIds.add(assetId);
  }

  if (plan.selectedAssetIds.length > 0 && eligibleAssetIds.size === 0) {
    blockingReasons.push('No eligible low-load customer-pack assets remain after filtering.');
  }

  const safetyConceptIds = new Set(
    taxonomy
      .filter((concept) => concept.category === 'safety')
      .map((concept) => concept.conceptId),
  );

  const safetyCards: CalmWelcomePackCardV1[] = [];
  const customerFacingSections: CalmWelcomePackViewModelV1['customerFacingSections'] = [];
  const includedAssetIds = new Set<string>();
  const includedCardKeySet = new Set<string>();

  const calmSummaryCards = sectionCardsFromCustomerSummary(customerSummary);
  if (calmSummaryCards.length > 0) {
    customerFacingSections.push({
      sectionId: 'calm_summary',
      title: SECTION_TITLES.calm_summary,
      cards: calmSummaryCards,
    });
  } else {
    internalOmissionLog.push({
      sectionId: 'calm_summary',
        reason: 'calm summary omitted because no customer summary text was available.',
      });
  }

  for (const sectionId of SECTION_ORDER) {
    if (sectionId === 'calm_summary' || sectionId === 'safety_and_compliance') {
      continue;
    }

    if (sectionId === 'optional_technical_appendix' && !includeTechnicalAppendix) {
      internalOmissionLog.push({
        sectionId,
        reason: 'Technical appendix omitted because includeTechnicalAppendix was false.',
      });
      continue;
    }

    const sectionAssets = sectionAssetMap.get(sectionId) ?? [];
    const cards: CalmWelcomePackCardV1[] = [];

    for (const assetId of sectionAssets) {
      if (!eligibleAssetIds.has(assetId)) {
        continue;
      }

      const asset = assetById.get(assetId);
      if (!asset) {
        continue;
      }

      const conceptIds = asset.conceptIds.filter((conceptId) => selectedConceptSet.has(conceptId));
      if (conceptIds.length === 0) {
        internalOmissionLog.push({
          sectionId,
          assetId,
          reason: 'Asset omitted because it has no selected concept IDs.',
        });
        continue;
      }

      for (const conceptId of conceptIds) {
        const content = contentByConceptId.get(conceptId);
        if (!content) {
          internalOmissionLog.push({
            sectionId,
            assetId,
            conceptId,
            reason: 'Card omitted because no educational content entry was found for the concept.',
          });
          continue;
        }

        const summary = getCardSummaryForSection(content, includeTechnicalAppendix, sectionId);
        if (summary.length === 0) {
          internalOmissionLog.push({
            sectionId,
            assetId,
            conceptId,
            reason: 'Card omitted because no safe short summary content was available.',
          });
          continue;
        }

        if (safetyConceptIds.has(conceptId)) {
          const cardKey = `${assetId}:${conceptId}:safety`;
          if (!includedCardKeySet.has(cardKey)) {
            safetyCards.push({
              assetId,
              conceptId,
              title: content.title,
              summary,
              safetyNotice: content.safetyNotice?.trim() || undefined,
            });
            includedCardKeySet.add(cardKey);
            includedAssetIds.add(assetId);
          }
          continue;
        }

        const cardKey = `${assetId}:${conceptId}:${sectionId}`;
        if (includedCardKeySet.has(cardKey)) {
          continue;
        }

        cards.push({
          assetId,
          conceptId,
          title: content.title,
          summary,
          safetyNotice: sectionId === 'next_steps' ? content.safetyNotice?.trim() || undefined : undefined,
        });
        includedCardKeySet.add(cardKey);
        includedAssetIds.add(assetId);
      }
    }

    if (cards.length > 0) {
      customerFacingSections.push({
        sectionId,
        title: SECTION_TITLES[sectionId],
        cards,
      });
    } else {
      internalOmissionLog.push({
        sectionId,
        reason: 'Section omitted because no eligible cards remained after filtering.',
      });
    }
  }

  if (safetyCards.length > 0) {
    customerFacingSections.push({
      sectionId: 'safety_and_compliance',
      title: SECTION_TITLES.safety_and_compliance,
      cards: safetyCards,
    });
  } else {
    const hasSafetyConcepts = plan.selectedConceptIds.some((conceptId) => safetyConceptIds.has(conceptId));
    if (hasSafetyConcepts) {
      internalOmissionLog.push({
        sectionId: 'safety_and_compliance',
        reason: 'Safety and compliance section omitted because no eligible safety content cards were available.',
      });
    }
  }

  const qrDestinations: CalmWelcomePackQrDestinationV1[] = [];
  for (const destination of plan.qrDestinations) {
    const assetId = parseAssetIdFromDestination(destination);
    if (!assetId) {
      internalOmissionLog.push({
        reason: `QR destination omitted because it was malformed: ${destination}`,
      });
      continue;
    }

    const reason = omittedReasonByAssetId.get(assetId) ?? '';
    const asset = assetById.get(assetId);
    const assetConceptIds = asset?.conceptIds ?? [];
    const deferredByConcept = assetConceptIds.some((conceptId) => deferredConceptSet.has(conceptId));
    const deferredByReason = isDeferredReason(reason);
    const alreadyIncluded = includedAssetIds.has(assetId);

    if (alreadyIncluded || (!deferredByConcept && !deferredByReason)) {
      internalOmissionLog.push({
        assetId,
        reason: 'QR destination omitted because it was not deferred/deeper detail content.',
      });
      continue;
    }

    const title = assetConceptIds
      .map((conceptId) => {
        const content = contentByConceptId.get(conceptId);
        return content?.qrDeepDiveTitle || content?.title;
      })
      .find((value): value is string => Boolean(value && value.trim().length > 0))
      ?? asset?.title
      ?? assetId;

    qrDestinations.push({
      assetId,
      destination,
      title,
      reason: reason || 'Deferred to deeper detail.',
    });
  }

  if (customerFacingSections.length === 0) {
    blockingReasons.push('No customer-facing sections could be safely assembled.');
  }

  if (plan.selectedAssetIds.length > 0 && findingsByAssetId.size === 0) {
    blockingReasons.push('Customer-pack eligibility findings are required for production-safe output.');
  }

  const orderedSections = SECTION_ORDER
    .map((sectionId) => customerFacingSections.find((section) => section.sectionId === sectionId))
    .filter((section): section is NonNullable<typeof section> => Boolean(section));

  return {
    packId: plan.packId,
    recommendedScenarioId: plan.recommendedScenarioId,
    title: `Welcome pack — ${customerSummary.recommendedSystemLabel}`,
    customerFacingSections: orderedSections,
    qrDestinations,
    internalOmissionLog,
    pageEstimate: {
      usedPages: estimateUsedPages(orderedSections.length, qrDestinations.length),
      maxPages: MAX_CALM_PACK_PAGES,
    },
    readiness: {
      safeForCustomer: blockingReasons.length === 0,
      blockingReasons,
    },
  };
}
