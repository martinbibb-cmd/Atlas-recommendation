import type { EducationalAssetV1, EducationalAssetType } from '../../contracts/EducationalAssetV1';
import type { EducationalConceptTaxonomyV1 } from '../../taxonomy/EducationalConceptTaxonomyV1';
import type {
  EducationalAssetSelectionV1,
  EducationalRoutingSectionTarget,
} from '../../routing/EducationalRoutingRuleV1';
import type { WelcomePackAccessibilityPreferencesV1 } from '../WelcomePackComposerV1';
import type { WelcomePackArchetypeV1 } from '../archetypes/WelcomePackArchetypeV1';
import type { WelcomePackBudgetV1 } from './WelcomePackBudgetV1';

export interface WelcomePackBudgetItemV1 {
  assetId: string;
  conceptIds: string[];
  reason: string;
  sectionTarget: EducationalRoutingSectionTarget;
}

export interface WelcomePackBudgetQrItemV1 extends WelcomePackBudgetItemV1 {
  qrDestination: string;
}

export interface WelcomePackBudgetOmissionV1 {
  assetId: string;
  conceptIds: string[];
  reason: string;
}

export interface ApplyWelcomePackBudgetInputV1 {
  routingSelection: EducationalAssetSelectionV1;
  archetype: WelcomePackArchetypeV1;
  assets: EducationalAssetV1[];
  concepts: EducationalConceptTaxonomyV1[];
  accessibilityPreferences?: WelcomePackAccessibilityPreferencesV1;
}

export interface ApplyWelcomePackBudgetResultV1 {
  appliedBudget: WelcomePackBudgetV1;
  selectedWithinBudget: WelcomePackBudgetItemV1[];
  deferredToQr: WelcomePackBudgetQrItemV1[];
  movedToAppendix: WelcomePackBudgetItemV1[];
  omittedWithReason: WelcomePackBudgetOmissionV1[];
  budgetWarnings: string[];
  pageBudgetUsed: number;
}

const ASSET_PAGE_COST: Record<EducationalAssetType, number> = {
  animation: 1,
  analogy: 1,
  checklist: 1,
  diagram: 1,
  explainer: 1,
  print_sheet: 1,
  topology: 1,
};

function buildAppliedBudget(
  archetype: WelcomePackArchetypeV1,
  accessibilityPreferences?: WelcomePackAccessibilityPreferencesV1,
): WelcomePackBudgetV1 {
  const appendixRequested = Boolean(accessibilityPreferences?.includeTechnicalAppendix);
  const prefersPrint = Boolean(accessibilityPreferences?.prefersPrint);
  const prefersReducedMotion = Boolean(accessibilityPreferences?.prefersReducedMotion);

  return {
    maxPages: Math.min(accessibilityPreferences?.maxPages ?? archetype.maxPrintPages, archetype.maxPrintPages),
    maxCoreConcepts: archetype.maxCoreConcepts,
    maxRelevantExplainers: archetype.printStrategy === 'compact' ? 1 : 2,
    maxTechnicalAppendixItems: appendixRequested ? archetype.maxAppendixConcepts : 0,
    maxHighCognitiveLoadItems: appendixRequested ? 1 : 0,
    maxMotionAssets: prefersPrint || prefersReducedMotion ? 0 : archetype.qrStrategy === 'minimal' ? 0 : 1,
    mustPrintSafetyItems: true,
    preferStaticFallbacks: prefersPrint || prefersReducedMotion,
    requireOmissionReasons: true,
  };
}

function createReason(originalReason: string, addition: string): string {
  return `${originalReason} ${addition}`.trim();
}

function uniqueInOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      ordered.push(value);
    }
  }
  return ordered;
}

function countConcepts(items: WelcomePackBudgetItemV1[]): number {
  return uniqueInOrder(items.flatMap((item) => item.conceptIds)).length;
}

function isMustPrintSafetyAsset(
  asset: EducationalAssetV1,
  conceptById: Map<string, EducationalConceptTaxonomyV1>,
): boolean {
  return asset.conceptIds.some((conceptId) => {
    const concept = conceptById.get(conceptId);
    return concept?.category === 'safety' && concept.printPriority === 'must_print';
  });
}

function isHighCognitiveLoad(asset: EducationalAssetV1): boolean {
  return asset.cognitiveLoad === 'high';
}

function isMotionAsset(asset: EducationalAssetV1): boolean {
  return asset.motionIntensity !== 'none' || asset.assetType === 'animation';
}

function chooseAppendixReason(originalReason: string): string {
  return createReason(originalReason, 'Moved to the technical appendix to keep the core pack calm and readable.');
}

function chooseQrReason(originalReason: string): string {
  return createReason(originalReason, 'Deferred to QR deep dive to protect print budget and cognitive load.');
}

function chooseOmissionReason(originalReason: string, reason: string): string {
  return createReason(originalReason, reason);
}

function rankCandidate(
  selection: EducationalAssetSelectionV1['selected'][number],
  asset: EducationalAssetV1,
  archetype: WelcomePackArchetypeV1,
  budget: WelcomePackBudgetV1,
): number {
  const conceptIds = new Set(asset.conceptIds);
  const requiredMatches = archetype.requiredConceptIds.filter((conceptId) => conceptIds.has(conceptId)).length;
  const recommendedMatches = archetype.recommendedConceptIds.filter((conceptId) => conceptIds.has(conceptId)).length;
  const optionalMatches = archetype.optionalConceptIds.filter((conceptId) => conceptIds.has(conceptId)).length;
  const trustMatches = archetype.trustRecoveryConceptIds.filter((conceptId) => conceptIds.has(conceptId)).length;
  const livingMatches = archetype.livingWithSystemConceptIds.filter((conceptId) => conceptIds.has(conceptId)).length;
  const excludedMatches = archetype.excludedByDefaultConceptIds.filter((conceptId) => conceptIds.has(conceptId)).length;

  let score = selection.priority * 100 + selection.printWeight * 10;
  score += requiredMatches * 90;
  score += recommendedMatches * 50;
  score += optionalMatches * 20;
  score += trustMatches * 40;
  score += livingMatches * 30;
  score -= excludedMatches * 120;
  score += archetype.preferredAssetTypes.includes(asset.assetType) ? 25 : 0;
  score += budget.preferStaticFallbacks && (asset.hasPrintEquivalent || asset.hasStaticFallback) ? 20 : 0;
  score -= isHighCognitiveLoad(asset) ? 15 : 0;
  score -= isMotionAsset(asset) && budget.maxMotionAssets === 0 ? 30 : 0;
  return score;
}

export function applyWelcomePackBudget(
  input: ApplyWelcomePackBudgetInputV1,
): ApplyWelcomePackBudgetResultV1 {
  const budget = buildAppliedBudget(input.archetype, input.accessibilityPreferences);
  const assetById = new Map(input.assets.map((asset) => [asset.id, asset]));
  const conceptById = new Map(input.concepts.map((concept) => [concept.conceptId, concept]));
  const warnings = [...input.routingSelection.warnings];
  const selectedWithinBudget: WelcomePackBudgetItemV1[] = [];
  const movedToAppendix: WelcomePackBudgetItemV1[] = [];
  const deferredToQr: WelcomePackBudgetQrItemV1[] = [];
  const omittedWithReason: WelcomePackBudgetOmissionV1[] = [];
  let relevantExplainers = 0;
  let highLoadCount = 0;
  let motionAssetCount = 0;

  const ranked = [...input.routingSelection.selected]
    .map((selection) => ({ selection, asset: assetById.get(selection.assetId) }))
    .filter((item): item is { selection: EducationalAssetSelectionV1['selected'][number]; asset: EducationalAssetV1 } => Boolean(item.asset))
    .sort((a, b) => {
      const scoreDiff = rankCandidate(a.selection, a.asset, input.archetype, budget)
        - rankCandidate(b.selection, b.asset, input.archetype, budget);
      return scoreDiff === 0 ? a.asset.id.localeCompare(b.asset.id) : scoreDiff * -1;
    });

  for (const { selection, asset } of ranked) {
    const excludedConceptOnly = asset.conceptIds.every((conceptId) => input.archetype.excludedByDefaultConceptIds.includes(conceptId));
    if (excludedConceptOnly) {
      omittedWithReason.push({
        assetId: asset.id,
        conceptIds: asset.conceptIds,
        reason: chooseOmissionReason(selection.reason, `Excluded by default for the ${input.archetype.label.toLowerCase()} archetype.`),
      });
      continue;
    }

    const pageCost = ASSET_PAGE_COST[asset.assetType];
    const coreConceptCount = countConcepts(selectedWithinBudget);
    const mustPrintSafety = budget.mustPrintSafetyItems && isMustPrintSafetyAsset(asset, conceptById);
    const targetSection = selection.sectionTarget;
    const item: WelcomePackBudgetItemV1 = {
      assetId: asset.id,
      conceptIds: asset.conceptIds,
      reason: selection.reason,
      sectionTarget: targetSection,
    };

    if (targetSection === 'calm_summary' && selectedWithinBudget.filter((candidate) => candidate.sectionTarget === 'calm_summary').length >= 1) {
      deferredToQr.push({
        ...item,
        reason: chooseQrReason(selection.reason),
        qrDestination: `atlas://educational-library/${asset.id}`,
      });
      continue;
    }

    if (targetSection === 'relevant_explainers' && relevantExplainers >= budget.maxRelevantExplainers) {
      deferredToQr.push({
        ...item,
        reason: chooseQrReason(selection.reason),
        qrDestination: `atlas://educational-library/${asset.id}`,
      });
      continue;
    }

    if (
      !mustPrintSafety
      && coreConceptCount + uniqueInOrder(asset.conceptIds).filter((conceptId) => !selectedWithinBudget.some((candidate) => candidate.conceptIds.includes(conceptId))).length > budget.maxCoreConcepts
    ) {
      deferredToQr.push({
        ...item,
        reason: chooseQrReason(selection.reason),
        qrDestination: `atlas://educational-library/${asset.id}`,
      });
      continue;
    }

    if (isHighCognitiveLoad(asset) && highLoadCount >= budget.maxHighCognitiveLoadItems) {
      if (budget.maxTechnicalAppendixItems > movedToAppendix.length) {
        movedToAppendix.push({
          ...item,
          reason: chooseAppendixReason(selection.reason),
          sectionTarget: 'technical_appendix',
        });
        continue;
      }

      deferredToQr.push({
        ...item,
        reason: chooseQrReason(selection.reason),
        qrDestination: `atlas://educational-library/${asset.id}`,
      });
      continue;
    }

    if (isMotionAsset(asset) && motionAssetCount >= budget.maxMotionAssets) {
      deferredToQr.push({
        ...item,
        reason: chooseQrReason(selection.reason),
        qrDestination: `atlas://educational-library/${asset.id}`,
      });
      continue;
    }

    if (!mustPrintSafety && selectedWithinBudget.length + movedToAppendix.length + pageCost > budget.maxPages) {
      deferredToQr.push({
        ...item,
        reason: chooseQrReason(selection.reason),
        qrDestination: `atlas://educational-library/${asset.id}`,
      });
      continue;
    }

    if (mustPrintSafety && selectedWithinBudget.length + movedToAppendix.length + pageCost > budget.maxPages) {
      warnings.push(`Page budget exceeded to keep must-print safety asset "${asset.id}" in the pack.`);
    }

    selectedWithinBudget.push(item);

    if (targetSection === 'relevant_explainers') {
      relevantExplainers += 1;
    }
    if (isHighCognitiveLoad(asset)) {
      highLoadCount += 1;
    }
    if (isMotionAsset(asset)) {
      motionAssetCount += 1;
    }
  }

  if (budget.requireOmissionReasons) {
    for (const omitted of input.routingSelection.omitted) {
      const asset = assetById.get(omitted.assetId);
      omittedWithReason.push({
        assetId: omitted.assetId,
        conceptIds: asset?.conceptIds ?? [],
        reason: omitted.reason,
      });
    }
  }

  omittedWithReason.sort((a, b) => a.assetId.localeCompare(b.assetId));

  return {
    appliedBudget: budget,
    selectedWithinBudget,
    deferredToQr,
    movedToAppendix,
    omittedWithReason,
    budgetWarnings: warnings,
    pageBudgetUsed: selectedWithinBudget.length + movedToAppendix.length,
  };
}
