import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { EducationalContentV1 } from '../content/EducationalContentV1';
import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import type { WelcomePackPlanV1 } from '../packComposer/WelcomePackComposerV1';
import type { EducationalConceptTaxonomyV1 } from '../taxonomy/EducationalConceptTaxonomyV1';
import type {
  PrintableWelcomePackSectionId,
  PrintableWelcomePackSectionV1,
  PrintableWelcomePackViewModelV1,
  PrintableSectionPrintPriority,
} from './PrintableWelcomePackViewModelV1';

interface BuildSectionTemplate {
  sectionId: PrintableWelcomePackSectionId;
  title: string;
  purpose: string;
  placeholderText: string;
  printPriority: PrintableSectionPrintPriority;
}

const SECTION_TEMPLATES: BuildSectionTemplate[] = [
  {
    sectionId: 'calm_summary',
    title: 'What Atlas found',
    purpose: 'Open with a short, low-friction summary of the recommended outcome.',
    placeholderText: 'Content pending: calm summary copy will be authored from locked plan facts.',
    printPriority: 'must_print',
  },
  {
    sectionId: 'why_this_fits',
    title: 'Why this fits',
    purpose: 'Explain why this exact scenario fits the home context and constraints.',
    placeholderText: 'Content pending: why-this-fits explanation copy will be authored.',
    printPriority: 'must_print',
  },
  {
    sectionId: 'living_with_the_system',
    title: 'Living with your system',
    purpose: 'Set day-to-day expectations for comfort, operation, and practical use.',
    placeholderText: 'Content pending: living-with-the-system guidance will be authored.',
    printPriority: 'should_print',
  },
  {
    sectionId: 'relevant_explainers',
    title: 'Relevant explainers',
    purpose: 'Collect static explainer cards tied to selected concepts and assets.',
    placeholderText: 'Content pending: explainer card copy and static artwork notes will be authored.',
    printPriority: 'should_print',
  },
  {
    sectionId: 'safety_and_compliance',
    title: 'Safety and compliance',
    purpose: 'Surface must-print safety concepts and compliance notes in one clear section.',
    placeholderText: 'Content pending: safety and compliance wording will be authored.',
    printPriority: 'must_print',
  },
  {
    sectionId: 'optional_technical_appendix',
    title: 'Optional technical appendix',
    purpose: 'Provide optional technical depth without overloading the core pack.',
    placeholderText: 'Content pending: optional technical appendix detail will be authored.',
    printPriority: 'digital_ok',
  },
  {
    sectionId: 'next_steps',
    title: 'Next steps',
    purpose: 'Confirm immediate practical steps and installer/customer follow-up actions.',
    placeholderText: 'Content pending: next-step checklist text will be authored.',
    printPriority: 'must_print',
  },
];

const QR_DEFERRED_REASON_FALLBACK = 'Deferred to QR detail. Content pending.';

const EMPTY_SECTION_ASSET_MAP: Record<PrintableWelcomePackSectionId, string[]> = {
  calm_summary: [],
  why_this_fits: [],
  living_with_the_system: [],
  relevant_explainers: [],
  safety_and_compliance: [],
  optional_technical_appendix: [],
  next_steps: [],
};

const PLAN_MIRRORED_SECTION_IDS = [
  'calm_summary',
  'why_this_fits',
  'living_with_the_system',
  'relevant_explainers',
  'optional_technical_appendix',
  'next_steps',
] as const;

type PlanMirroredSectionId = (typeof PLAN_MIRRORED_SECTION_IDS)[number];
const PLAN_MIRRORED_SECTION_SET = new Set<PlanMirroredSectionId>(PLAN_MIRRORED_SECTION_IDS);

export interface BuildPrintableWelcomePackContentOptionsV1 {
  educationalContent?: EducationalContentV1[];
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
  return destination.slice(marker.length).trim() || undefined;
}

function computeHighestCognitiveLoad(assetIds: string[], assetsById: Map<string, EducationalAssetV1>): 'low' | 'medium' | 'high' {
  const rank: Record<'low' | 'medium' | 'high', number> = {
    low: 1,
    medium: 2,
    high: 3,
  };

  let highest: 'low' | 'medium' | 'high' = 'low';
  for (const assetId of assetIds) {
    const asset = assetsById.get(assetId);
    if (!asset) {
      continue;
    }
    if (rank[asset.cognitiveLoad] > rank[highest]) {
      highest = asset.cognitiveLoad;
    }
  }
  return highest;
}

function buildCoreSnippet(entry: EducationalContentV1): string {
  const summary = entry.printSummary.trim() || entry.customerExplanation.trim();
  return `${entry.title}: ${summary}`;
}

function buildSafetySnippet(entry: EducationalContentV1): string | undefined {
  if (!entry.safetyNotice || entry.safetyNotice.trim().length === 0) {
    return undefined;
  }
  return `${entry.title}: ${entry.safetyNotice.trim()}`;
}

export function buildPrintableWelcomePackViewModel(
  plan: WelcomePackPlanV1,
  customerSummary: CustomerSummaryV1,
  concepts: EducationalConceptTaxonomyV1[],
  assets: EducationalAssetV1[],
  options?: BuildPrintableWelcomePackContentOptionsV1,
): PrintableWelcomePackViewModelV1 {
  const selectedAssetIds = new Set(plan.selectedAssetIds);
  const selectedConceptIds = new Set(plan.selectedConceptIds);
  const deferredConceptIds = new Set(plan.deferredConceptIds);
  const conceptById = new Map(concepts.map((concept) => [concept.conceptId, concept]));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const contentByConceptId = new Map(
    (options?.educationalContent ?? []).map((entry) => [entry.conceptId, entry]),
  );
  const omittedReasonByAssetId = new Map(plan.omittedAssetIdsWithReason.map((item) => [item.assetId, item.reason]));

  const sectionAssetIds: Record<PrintableWelcomePackSectionId, string[]> = {
    ...EMPTY_SECTION_ASSET_MAP,
  };

  for (const section of plan.sections) {
    if (PLAN_MIRRORED_SECTION_SET.has(section.id)) {
      sectionAssetIds[section.id] = uniqueInOrder(
        section.includedAssetIds.filter((assetId) => selectedAssetIds.has(assetId)),
      );
    }
  }

  const mustPrintSafetyConceptIds = new Set<string>(
    plan.selectedConceptIds.filter((conceptId) => {
      const concept = conceptById.get(conceptId);
      return concept?.category === 'safety' && concept.printPriority === 'must_print';
    }),
  );

  const safetyAssetIds = uniqueInOrder(
    plan.selectedAssetIds.filter((assetId) => {
      const asset = assetById.get(assetId);
      return Boolean(asset?.conceptIds.some((conceptId) => mustPrintSafetyConceptIds.has(conceptId)));
    }),
  );
  const safetyAssetIdSet = new Set(safetyAssetIds);

  for (const sectionId of PLAN_MIRRORED_SECTION_IDS) {
    sectionAssetIds[sectionId] = sectionAssetIds[sectionId].filter((assetId) => !safetyAssetIdSet.has(assetId));
  }
  sectionAssetIds.safety_and_compliance = safetyAssetIds;

  const deferredAssetIdSet = new Set<string>();
  const qrDestinations = plan.qrDestinations
    .map((destination) => {
      const assetId = parseAssetIdFromDestination(destination);
      if (!assetId || !assetById.has(assetId)) {
        return undefined;
      }
      deferredAssetIdSet.add(assetId);
      const asset = assetById.get(assetId);
      const reason = omittedReasonByAssetId.get(assetId) ?? QR_DEFERRED_REASON_FALLBACK;
      const conceptIdsForAsset = (asset?.conceptIds ?? [])
        .filter((conceptId) => deferredConceptIds.has(conceptId) || selectedConceptIds.has(conceptId));
      return {
        assetId,
        destination,
        conceptIds: uniqueInOrder(conceptIdsForAsset),
        reason,
      };
    })
    .filter((item): item is PrintableWelcomePackViewModelV1['qrDestinations'][number] => Boolean(item));

  const sections: PrintableWelcomePackSectionV1[] = SECTION_TEMPLATES.map((template) => {
    const assetIds = uniqueInOrder(sectionAssetIds[template.sectionId].filter((assetId) => selectedAssetIds.has(assetId)));
    const conceptIds = uniqueInOrder(
      assetIds.flatMap((assetId) => (assetById.get(assetId)?.conceptIds ?? []))
        .filter((conceptId) => selectedConceptIds.has(conceptId)),
    );

    const sectionContent = conceptIds
      .map((conceptId) => contentByConceptId.get(conceptId))
      .filter((entry): entry is EducationalContentV1 => Boolean(entry));

    const coreSnippets = sectionContent.map(buildCoreSnippet);

    const selectedContent = plan.selectedConceptIds
      .map((conceptId) => contentByConceptId.get(conceptId))
      .filter((entry): entry is EducationalContentV1 => Boolean(entry));

    const safetySnippets = template.sectionId === 'safety_and_compliance'
      ? uniqueInOrder(
        selectedContent
          .map(buildSafetySnippet)
          .filter((snippet): snippet is string => Boolean(snippet)),
      )
      : [];

    const appendixSnippets = template.sectionId === 'optional_technical_appendix' && options?.includeTechnicalAppendix
      ? uniqueInOrder(
        sectionContent
          .map((entry) => {
            if (!entry.technicalAppendixSummary || entry.technicalAppendixSummary.trim().length === 0) {
              return undefined;
            }
            return `${entry.title}: ${entry.technicalAppendixSummary.trim()}`;
          })
          .filter((snippet): snippet is string => Boolean(snippet)),
      )
      : [];

    const contentSnippets = template.sectionId === 'optional_technical_appendix'
      ? appendixSnippets
      : uniqueInOrder([...coreSnippets, ...safetySnippets]);

    return {
      sectionId: template.sectionId,
      title: template.title,
      purpose: template.purpose,
      conceptIds,
      assetIds,
      placeholderText: contentSnippets.length > 0
        ? contentSnippets.join('\n\n')
        : template.placeholderText,
      printPriority: template.printPriority,
      cognitiveLoadEstimate: computeHighestCognitiveLoad(assetIds, assetById),
    };
  });

  return {
    packId: plan.packId,
    archetypeId: plan.archetypeId,
    recommendedScenarioId: plan.recommendedScenarioId,
    title: `Welcome pack skeleton — ${customerSummary.recommendedSystemLabel}`,
    subtitle: `Content pending. Scenario: ${plan.recommendedScenarioId}.`,
    sections,
    pageEstimate: {
      usedPages: plan.pageBudgetUsed,
      maxPages: plan.printPageBudget,
    },
    printNotes: [
      'Content pending: this renderer outputs a structured skeleton only.',
      'No recommendation logic is executed in this renderer.',
      'PDF generation is not included in this scope.',
    ],
    qrDestinations,
    omittedSummary: {
      deferredConceptIds: uniqueInOrder(plan.deferredConceptIds),
      omittedAssets: plan.omittedAssetIdsWithReason.map((item) => ({
        assetId: item.assetId,
        reason: item.reason,
        conceptIds: uniqueInOrder(assetById.get(item.assetId)?.conceptIds ?? []),
        deferredToQr: deferredAssetIdSet.has(item.assetId),
      })),
    },
  };
}
