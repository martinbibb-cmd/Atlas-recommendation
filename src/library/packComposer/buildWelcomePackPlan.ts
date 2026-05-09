import type { EducationalAssetV1, EducationalLoad } from '../contracts/EducationalAssetV1';
import type { EducationalPackSectionV1 } from '../contracts/EducationalPackV1';
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

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function includesAny(source: string[], targets: string[]): string[] {
  const sourceSet = new Set(source.map(normalizeTag));
  return targets
    .map(normalizeTag)
    .filter((tag) => sourceSet.has(tag));
}

function buildAvailableFactKeys(input: WelcomePackComposerInputV1): Set<string> {
  const { customerSummary, atlasDecision } = input;
  const facts = new Set<string>(['recommended_scenario_available']);

  if (customerSummary.includedNow.length > 0 || atlasDecision.includedItems.length > 0) {
    facts.add('included_scope_present');
  }
  if (atlasDecision.dayToDayOutcomes.length > 0) {
    facts.add('day_to_day_outcomes_present');
  }
  if (atlasDecision.compatibilityWarnings.length > 0 || customerSummary.requiredChecks.length > 0) {
    facts.add('hydraulic_constraint_present');
  }
  if (
    customerSummary.performancePenalties.length > 0
    || atlasDecision.performancePenalties?.length
    || customerSummary.whyThisWins.some((reason) => /cycle|oversiz/i.test(reason))
  ) {
    facts.add('cycling_risk_or_reason');
  }
  if (
    customerSummary.requiredChecks.some((item) => /radiator|emitter|temperature/i.test(item))
    || customerSummary.optionalUpgrades.some((item) => /radiator|emitter/i.test(item))
  ) {
    facts.add('emitter_upgrade_or_high_temp_note');
  }
  if (
    customerSummary.whyThisWins.some((reason) => /control|weather compensation|setpoint/i.test(reason))
    || customerSummary.includedNow.some((item) => /control/i.test(item))
  ) {
    facts.add('controls_guidance_present');
  }

  return facts;
}

function assetRelevanceReasons(
  asset: EducationalAssetV1,
  activeTags: string[],
  availableFactKeys: Set<string>,
): string[] {
  const reasons: string[] = [];
  const matchedTags = includesAny(asset.triggerTags, activeTags);

  if (matchedTags.length > 0) {
    reasons.push(`Matched concern tags: ${matchedTags.join(', ')}.`);
  }

  const matchedFacts = asset.requiredEngineFacts.filter((fact) => availableFactKeys.has(fact));
  if (matchedFacts.length > 0) {
    reasons.push(`Supported by engine facts: ${matchedFacts.join(', ')}.`);
  }

  return reasons;
}

function buildSection(
  id: EducationalPackSectionV1['id'],
  includedAssetIds: string[],
  notes: string[],
): EducationalPackSectionV1 {
  return { id, includedAssetIds, notes };
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
  const recommendedScenario = scenarios.find((scenario) => scenario.scenarioId === recommendedScenarioId);
  const printPageBudget = Math.min(
    accessibilityPreferences?.maxPages ?? DEFAULT_PRINT_PAGE_BUDGET,
    DEFAULT_PRINT_PAGE_BUDGET,
  );
  const cognitiveLoadBudget: EducationalLoad = accessibilityPreferences?.includeTechnicalAppendix
    ? 'high'
    : 'medium';
  const maxCognitiveWeight = toLoadLimit(cognitiveLoadBudget);
  const activeTags = [
    ...userConcernTags,
    ...propertyConstraintTags,
    recommendedScenario?.system.type ?? '',
    customerSummary.recommendedSystemLabel,
  ]
    .map(normalizeTag)
    .filter(Boolean);
  const availableFactKeys = buildAvailableFactKeys(input);
  const includedReasons = new Map<string, string[]>();
  const omittedAssetIdsWithReason: Array<{ assetId: string; reason: string }> = [];

  const rankedAssets = educationalAssetRegistry
    .map((asset) => {
      const reasons = assetRelevanceReasons(asset, activeTags, availableFactKeys);
      const relevanceScore = reasons.length * 10
        + (asset.hasPrintEquivalent ? 3 : 0)
        + (asset.hasStaticFallback ? 2 : 0)
        - COGNITIVE_WEIGHT[asset.cognitiveLoad];
      return { asset, reasons, relevanceScore };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);

  let usedPages = 0;
  const selectedAssetIds: string[] = [];

  for (const item of rankedAssets) {
    const { asset, reasons } = item;

    if (reasons.length === 0) {
      omittedAssetIdsWithReason.push({
        assetId: asset.id,
        reason: 'No matched concern tags or required engine facts.',
      });
      continue;
    }

    if (!accessibilityPreferences?.includeTechnicalAppendix && asset.cognitiveLoad === 'high') {
      omittedAssetIdsWithReason.push({
        assetId: asset.id,
        reason: 'High cognitive load omitted because technical appendix was not requested.',
      });
      continue;
    }

    if (COGNITIVE_WEIGHT[asset.cognitiveLoad] > maxCognitiveWeight) {
      omittedAssetIdsWithReason.push({
        assetId: asset.id,
        reason: 'Asset exceeds configured cognitive-load budget.',
      });
      continue;
    }

    if (
      accessibilityPreferences?.prefersReducedMotion
      && !asset.supportsReducedMotion
      && asset.motionIntensity !== 'none'
    ) {
      omittedAssetIdsWithReason.push({
        assetId: asset.id,
        reason: 'Asset omitted because reduced-motion support is required.',
      });
      continue;
    }

    if (accessibilityPreferences?.prefersPrint && !asset.hasPrintEquivalent) {
      omittedAssetIdsWithReason.push({
        assetId: asset.id,
        reason: 'Print-first preference favours print-capable assets.',
      });
      continue;
    }

    const pageCost = ASSET_PAGE_COST[asset.assetType];
    if (usedPages + pageCost > printPageBudget) {
      omittedAssetIdsWithReason.push({
        assetId: asset.id,
        reason: `Adding this asset would exceed the ${printPageBudget}-page pack budget.`,
      });
      continue;
    }

    selectedAssetIds.push(asset.id);
    includedReasons.set(asset.id, reasons);
    usedPages += pageCost;
  }

  const selectedAssetReasons = Object.fromEntries(includedReasons.entries());
  const sectionNotes = selectedAssetIds.map(
    (assetId) => `${assetId}: ${(selectedAssetReasons[assetId] ?? []).join(' ')}`,
  );

  const sections: EducationalPackSectionV1[] = [
    buildSection('calm_summary', [], ['Always include a calm summary in plain language.']),
    buildSection('why_this_fits', [], ['Explain why Atlas selected this scenario using locked decision facts.']),
    buildSection('living_with_the_system', selectedAssetIds.filter((id) => id === 'DrivingStyleVisual'), [
      'Focus on day-to-day operation and comfort expectations.',
    ]),
    buildSection('relevant_explainers', selectedAssetIds, sectionNotes),
  ];

  if (accessibilityPreferences?.includeTechnicalAppendix) {
    sections.push(
      buildSection('optional_technical_appendix', [], [
        'Optional technical appendix requested by user preference.',
      ]),
    );
  }

  sections.push(buildSection('next_steps', [], ['Confirm installation checks and practical next actions.']));

  const qrDestinations = selectedAssetIds
    .map((assetId) => educationalAssetRegistry.find((asset) => asset.id === assetId))
    .filter((asset): asset is EducationalAssetV1 => Boolean(asset))
    .filter((asset) => !asset.hasPrintEquivalent || asset.assetType === 'animation')
    .map((asset) => `atlas://educational-library/${asset.id}`);

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
