import type { EducationalAssetV1, EducationalLoad } from '../contracts/EducationalAssetV1';
import type { EducationalPackSectionV1 } from '../contracts/EducationalPackV1';
import { selectEducationalAssetsForContext } from '../routing/selectEducationalAssetsForContext';
import type {
  EducationalAssetSelectionV1,
  EducationalRoutingAccessibilityProfile,
  EducationalRoutingSectionTarget,
} from '../routing/EducationalRoutingRuleV1';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import type { WelcomePackComposerInputV1, WelcomePackPlanV1 } from './WelcomePackComposerV1';

const DEFAULT_PRINT_PAGE_BUDGET = 4;

const COGNITIVE_WEIGHT: Record<EducationalLoad, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

const ASSET_PAGE_COST: Record<EducationalAssetV1['assetType'], number> = {
  animation: 1,
  diagram: 1,
  explainer: 1,
  print_sheet: 1,
  analogy: 1,
  topology: 1,
  checklist: 1,
};

function toLoadLimit(load: EducationalLoad): number {
  return COGNITIVE_WEIGHT[load];
}

function toRoutingProfiles(input: WelcomePackComposerInputV1): EducationalRoutingAccessibilityProfile[] {
  const profiles = new Set<EducationalRoutingAccessibilityProfile>(input.accessibilityPreferences?.profiles ?? []);

  if (input.accessibilityPreferences?.prefersPrint) {
    profiles.add('print_first');
  }
  if (input.accessibilityPreferences?.prefersReducedMotion) {
    profiles.add('reduced_motion');
  }
  if (input.accessibilityPreferences?.includeTechnicalAppendix) {
    profiles.add('technical_appendix_requested');
  }

  return [...profiles.values()];
}

function toSectionId(target: EducationalRoutingSectionTarget): EducationalPackSectionV1['id'] {
  if (target === 'technical_appendix') {
    return 'optional_technical_appendix';
  }
  return target;
}

function buildSection(
  id: EducationalPackSectionV1['id'],
  includedAssetIds: string[],
  notes: string[],
): EducationalPackSectionV1 {
  return { id, includedAssetIds, notes };
}

function buildRoutingOmissionReason(reason: string, fallback: string): string {
  return reason.trim().length > 0 ? reason : fallback;
}

function scoreRoutedAsset(
  selected: EducationalAssetSelectionV1['selected'][number],
  asset: EducationalAssetV1 | undefined,
  prefersPrint: boolean | undefined,
  hasLowCognitiveProfile: boolean,
): number {
  const cognitiveWeight = asset ? COGNITIVE_WEIGHT[asset.cognitiveLoad] : 0;
  const printBonus = prefersPrint && asset?.hasPrintEquivalent ? 40 : 0;
  const staticBonus = hasLowCognitiveProfile && asset && (asset.hasStaticFallback || asset.motionIntensity === 'none')
    ? 20
    : 0;
  const reducedMotionBonus = hasLowCognitiveProfile && asset && asset.supportsReducedMotion ? 20 : 0;

  return selected.priority * 100
    + selected.printWeight * 5
    - cognitiveWeight
    + printBonus
    + staticBonus
    + reducedMotionBonus;
}

export function buildWelcomePackPlan(input: WelcomePackComposerInputV1): WelcomePackPlanV1 {
  const {
    customerSummary,
    atlasDecision,
    scenarios,
    accessibilityPreferences,
    userConcernTags = [],
    propertyConstraintTags = [],
  } = input;

  const recommendedScenarioId = atlasDecision.recommendedScenarioId;
  const printPageBudget = Math.min(
    accessibilityPreferences?.maxPages ?? DEFAULT_PRINT_PAGE_BUDGET,
    DEFAULT_PRINT_PAGE_BUDGET,
  );
  const cognitiveLoadBudget: EducationalLoad = accessibilityPreferences?.includeTechnicalAppendix
    ? 'high'
    : 'medium';
  const maxCognitiveWeight = toLoadLimit(cognitiveLoadBudget);

  const routingSelection = selectEducationalAssetsForContext({
    customerSummary,
    atlasDecision,
    scenarios,
    educationalAssets: educationalAssetRegistry,
    accessibilityPreferences: {
      prefersPrint: accessibilityPreferences?.prefersPrint,
      prefersReducedMotion: accessibilityPreferences?.prefersReducedMotion,
      includeTechnicalAppendix: accessibilityPreferences?.includeTechnicalAppendix,
      profiles: toRoutingProfiles(input),
    },
    userConcernTags,
    propertyConstraintTags,
    packMode: accessibilityPreferences?.prefersPrint ? 'print' : 'welcome',
  });

  const selectedAssetReasons: Record<string, string[]> = {};
  const omittedByAssetId = new Map<string, string>();

  for (const omitted of routingSelection.omitted) {
    omittedByAssetId.set(omitted.assetId, omitted.reason);
  }

  const assetById = new Map(educationalAssetRegistry.map((asset) => [asset.id, asset]));
  const selectedForPlan: EducationalAssetSelectionV1['selected'] = [];

  const hasLowCognitiveProfile = Boolean(
    accessibilityPreferences?.profiles?.includes('dyslexia')
      || accessibilityPreferences?.profiles?.includes('adhd'),
  );

  const rankedSelection = [...routingSelection.selected].sort((a, b) => {
    const assetA = assetById.get(a.assetId);
    const assetB = assetById.get(b.assetId);

    const scoreA = scoreRoutedAsset(a, assetA, accessibilityPreferences?.prefersPrint, hasLowCognitiveProfile);
    const scoreB = scoreRoutedAsset(b, assetB, accessibilityPreferences?.prefersPrint, hasLowCognitiveProfile);

    return scoreB - scoreA || a.assetId.localeCompare(b.assetId);
  });

  let usedPages = 0;

  for (const selected of rankedSelection) {
    const asset = assetById.get(selected.assetId);

    if (!asset) {
      omittedByAssetId.set(selected.assetId, 'Selected asset is not present in the registry.');
      continue;
    }

    if (!accessibilityPreferences?.includeTechnicalAppendix && asset.cognitiveLoad === 'high') {
      omittedByAssetId.set(
        asset.id,
        'High cognitive-load asset omitted because a technical appendix was not requested.',
      );
      continue;
    }

    if (COGNITIVE_WEIGHT[asset.cognitiveLoad] > maxCognitiveWeight) {
      omittedByAssetId.set(asset.id, 'Asset exceeds configured cognitive-load budget.');
      continue;
    }

    if (
      accessibilityPreferences?.prefersReducedMotion
      && !asset.supportsReducedMotion
      && asset.motionIntensity !== 'none'
    ) {
      omittedByAssetId.set(asset.id, 'Asset omitted because reduced-motion support is required.');
      continue;
    }

    const pageCost = ASSET_PAGE_COST[asset.assetType];
    if (usedPages + pageCost > printPageBudget) {
      omittedByAssetId.set(
        asset.id,
        `Adding this asset would exceed the ${printPageBudget}-page pack budget.`,
      );
      continue;
    }

    selectedForPlan.push(selected);
    selectedAssetReasons[asset.id] = [selected.reason];
    usedPages += pageCost;
  }

  const selectedAssetIds = selectedForPlan.map((item) => item.assetId);
  const selectedBySection = new Map<EducationalPackSectionV1['id'], string[]>();

  for (const selected of selectedForPlan) {
    const sectionId = toSectionId(selected.sectionTarget);
    const current = selectedBySection.get(sectionId) ?? [];
    current.push(selected.assetId);
    selectedBySection.set(sectionId, current);
  }

  const reasonNotesBySection = new Map<EducationalPackSectionV1['id'], string[]>();
  for (const selected of selectedForPlan) {
    const sectionId = toSectionId(selected.sectionTarget);
    const current = reasonNotesBySection.get(sectionId) ?? [];
    current.push(`${selected.assetId}: ${selected.reason}`);
    reasonNotesBySection.set(sectionId, current);
  }

  const sections: EducationalPackSectionV1[] = [
    buildSection('calm_summary', selectedBySection.get('calm_summary') ?? [], [
      'Always include a calm summary in plain language.',
      ...(reasonNotesBySection.get('calm_summary') ?? []),
    ]),
    buildSection('why_this_fits', selectedBySection.get('why_this_fits') ?? [], [
      'Explain why Atlas selected this scenario using locked decision facts.',
      ...(reasonNotesBySection.get('why_this_fits') ?? []),
    ]),
    buildSection('living_with_the_system', selectedBySection.get('living_with_the_system') ?? [], [
      'Focus on day-to-day operation and comfort expectations.',
      ...(reasonNotesBySection.get('living_with_the_system') ?? []),
    ]),
    buildSection('relevant_explainers', selectedBySection.get('relevant_explainers') ?? [], [
      ...(reasonNotesBySection.get('relevant_explainers') ?? []),
    ]),
  ];

  if (accessibilityPreferences?.includeTechnicalAppendix) {
    sections.push(
      buildSection('optional_technical_appendix', selectedBySection.get('optional_technical_appendix') ?? [], [
        'Optional technical appendix requested by user preference.',
        ...(reasonNotesBySection.get('optional_technical_appendix') ?? []),
      ]),
    );
  }

  sections.push(buildSection('next_steps', selectedBySection.get('next_steps') ?? [], [
    'Confirm installation checks and practical next actions.',
    ...(reasonNotesBySection.get('next_steps') ?? []),
  ]));

  const qrDestinations = selectedAssetIds
    .map((assetId) => assetById.get(assetId))
    .filter((asset): asset is EducationalAssetV1 => Boolean(asset))
    .filter((asset) => !asset.hasPrintEquivalent || asset.assetType === 'animation')
    .map((asset) => `atlas://educational-library/${asset.id}`);

  const selectedAssetIdSet = new Set(selectedAssetIds);
  const omittedAssetIdsWithReason = educationalAssetRegistry
    .filter((asset) => !selectedAssetIdSet.has(asset.id))
    .map((asset) => ({
      assetId: asset.id,
      reason: buildRoutingOmissionReason(
        omittedByAssetId.get(asset.id) ?? '',
        'No matched concern tags or required engine facts.',
      ),
    }));

  for (const warning of routingSelection.warnings) {
    sections[0].notes.push(`Warning: ${warning}`);
  }

  return {
    packId: `welcome-pack:${recommendedScenarioId}`,
    recommendedScenarioId,
    sections,
    selectedAssetIds,
    selectedAssetReasons,
    omittedAssetIdsWithReason,
    printPageBudget,
    cognitiveLoadBudget,
    qrDestinations,
  };
}
