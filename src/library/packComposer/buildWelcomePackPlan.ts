import type { EducationalAssetV1, EducationalLoad } from '../contracts/EducationalAssetV1';
import type { EducationalPackSectionV1 } from '../contracts/EducationalPackV1';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import type {
  EducationalAssetSelectionV1,
  EducationalRoutingAccessibilityProfile,
  EducationalRoutingSectionTarget,
} from '../routing/EducationalRoutingRuleV1';
import { selectEducationalAssetsForContext } from '../routing/selectEducationalAssetsForContext';
import { getConceptById } from '../taxonomy/conceptGraph';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';
import { detectWelcomePackArchetype } from './archetypes/welcomePackArchetypes';
import { applyWelcomePackBudget } from './budget/applyWelcomePackBudget';
import { checkWelcomePackAssetEligibility } from './eligibility/checkWelcomePackAssetEligibility';
import type { EligibilityDeliveryMode } from './eligibility/WelcomePackEligibilityV1';
import type { WelcomePackComposerInputV1, WelcomePackPlanV1 } from './WelcomePackComposerV1';
import { educationalAssetAccessibilityAudits } from '../audits/educationalAssetAccessibilityAudits';
import { printEquivalentRegistry } from '../printEquivalents/printEquivalentRegistry';
import { runEducationalAssetQa } from '../registry/qa/runEducationalAssetQa';
import { educationalComponentRegistry } from '../registry/educationalComponentRegistry';

const COGNITIVE_WEIGHT: Record<EducationalLoad, number> = {
  low: 1,
  medium: 2,
  high: 3,
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
  return target === 'technical_appendix' ? 'optional_technical_appendix' : target;
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
    || (atlasDecision.performancePenalties?.length ?? 0) > 0
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

function includesConcept(asset: EducationalAssetV1, conceptIds: string[]): boolean {
  return asset.conceptIds.some((conceptId) => conceptIds.includes(conceptId));
}

function toArchetypeSectionTarget(
  asset: EducationalAssetV1,
  trustRecoveryConceptIds: string[],
  livingWithSystemConceptIds: string[],
): EducationalRoutingSectionTarget {
  if (includesConcept(asset, trustRecoveryConceptIds)) {
    return 'why_this_fits';
  }
  if (includesConcept(asset, livingWithSystemConceptIds)) {
    return 'living_with_the_system';
  }
  if (asset.conceptIds.some((conceptId) => getConceptById(conceptId)?.category === 'safety')) {
    return 'next_steps';
  }
  if (
    asset.assetType === 'print_sheet'
    || asset.conceptIds.includes('system_work_explainer')
    || asset.conceptIds.includes('scope_clarity')
  ) {
    return 'next_steps';
  }
  return 'relevant_explainers';
}

function toArchetypePriority(
  asset: EducationalAssetV1,
  requiredConceptIds: string[],
  recommendedConceptIds: string[],
  optionalConceptIds: string[],
): number {
  const requiredMatches = requiredConceptIds.filter((conceptId) => asset.conceptIds.includes(conceptId)).length;
  const recommendedMatches = recommendedConceptIds.filter((conceptId) => asset.conceptIds.includes(conceptId)).length;
  const optionalMatches = optionalConceptIds.filter((conceptId) => asset.conceptIds.includes(conceptId)).length;

  return requiredMatches * 90 + recommendedMatches * 60 + optionalMatches * 30;
}

function mergeWithArchetypeCandidates(
  input: WelcomePackComposerInputV1,
  routingSelection: EducationalAssetSelectionV1,
): EducationalAssetSelectionV1 {
  const archetype = detectWelcomePackArchetype(input);
  const scenario = input.scenarios.find((item) => item.scenarioId === input.atlasDecision.recommendedScenarioId);
  const systemType = scenario?.system.type;
  const availableFacts = buildAvailableFactKeys(input);
  const selectedById = new Map(routingSelection.selected.map((item) => [item.assetId, item]));
  const warnings = [...routingSelection.warnings];
  const conceptPool = [
    ...archetype.requiredConceptIds,
    ...archetype.recommendedConceptIds,
    ...archetype.optionalConceptIds,
    ...archetype.trustRecoveryConceptIds,
    ...archetype.livingWithSystemConceptIds,
  ];

  for (const asset of educationalAssetRegistry) {
    if (selectedById.has(asset.id)) {
      continue;
    }
    if (asset.requiredEngineFacts.some((fact) => !availableFacts.has(fact))) {
      continue;
    }

    const matchingConceptIds = asset.conceptIds.filter((conceptId) => conceptPool.includes(conceptId));
    if (matchingConceptIds.length === 0) {
      continue;
    }

    const applicableConcept = asset.conceptIds.some((conceptId) => {
      const concept = getConceptById(conceptId);
      return concept
        ? concept.appliesToSystemTypes.includes('all')
          || (systemType !== undefined && concept.appliesToSystemTypes.includes(systemType))
        : true;
    });
    if (!applicableConcept) {
      continue;
    }

    selectedById.set(asset.id, {
      assetId: asset.id,
      ruleId: `archetype:${archetype.archetypeId}`,
      reason: `Selected for ${archetype.label} because it covers ${matchingConceptIds.join(', ')}.`,
      sectionTarget: toArchetypeSectionTarget(
        asset,
        archetype.trustRecoveryConceptIds,
        archetype.livingWithSystemConceptIds,
      ),
      priority: toArchetypePriority(
        asset,
        archetype.requiredConceptIds,
        archetype.recommendedConceptIds,
        archetype.optionalConceptIds,
      ),
      printWeight: archetype.preferredAssetTypes.includes(asset.assetType) ? 8 : 4,
      cognitiveLoadImpact: asset.cognitiveLoad,
    });
  }

  const selected = [...selectedById.values()]
    .sort((a, b) => b.priority - a.priority || b.printWeight - a.printWeight || a.assetId.localeCompare(b.assetId));

  const selectedIdSet = new Set(selected.map((item) => item.assetId));
  const omitted = educationalAssetRegistry
    .filter((asset) => !selectedIdSet.has(asset.id))
    .map((asset) => ({
      assetId: asset.id,
      reason: routingSelection.omitted.find((item) => item.assetId === asset.id)?.reason
        ?? 'No routing rule or archetype concept selected this asset for the current context.',
    }))
    .sort((a, b) => a.assetId.localeCompare(b.assetId));

  if (!systemType) {
    warnings.push('Archetype candidate routing could not confirm the recommended system type.');
  }

  return {
    selected,
    omitted,
    warnings,
  };
}

function toBudgetLoad(accessibilityPreferences: WelcomePackComposerInputV1['accessibilityPreferences']): EducationalLoad {
  if (accessibilityPreferences?.profiles?.some((profile) => profile === 'dyslexia' || profile === 'adhd')) {
    return 'low';
  }
  return accessibilityPreferences?.includeTechnicalAppendix ? 'high' : 'medium';
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function resolveDeliveryMode(input: WelcomePackComposerInputV1): EligibilityDeliveryMode {
  if (input.accessibilityPreferences?.prefersPrint) {
    return 'print';
  }
  if (input.accessibilityPreferences?.prefersReducedMotion) {
    return 'reduced_motion';
  }
  if (input.accessibilityPreferences?.includeTechnicalAppendix) {
    return 'technical_appendix';
  }
  return 'customer_pack';
}

export function buildWelcomePackPlan(input: WelcomePackComposerInputV1): WelcomePackPlanV1 {
  const {
    customerSummary,
    atlasDecision,
    scenarios,
    accessibilityPreferences,
    userConcernTags = [],
    propertyConstraintTags = [],
    eligibilityMode = 'off',
  } = input;

  const recommendedScenarioId = atlasDecision.recommendedScenarioId;
  const archetype = detectWelcomePackArchetype(input);
  const cognitiveLoadBudget = toBudgetLoad(accessibilityPreferences);
  const maxCognitiveWeight = toLoadLimit(cognitiveLoadBudget);

  const baseRoutingSelection = selectEducationalAssetsForContext({
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
  const routingSelection = mergeWithArchetypeCandidates(input, baseRoutingSelection);
  const assetById = new Map(educationalAssetRegistry.map((asset) => [asset.id, asset]));
  const constrainedSelection: EducationalAssetSelectionV1 = {
    ...routingSelection,
    selected: routingSelection.selected.filter((item) => {
      const asset = assetById.get(item.assetId);
      if (!asset) {
        return false;
      }

      if (COGNITIVE_WEIGHT[asset.cognitiveLoad] > maxCognitiveWeight) {
        return false;
      }

      if (
        accessibilityPreferences?.prefersReducedMotion
        && !asset.supportsReducedMotion
        && asset.motionIntensity !== 'none'
      ) {
        return false;
      }

      return true;
    }),
    omitted: routingSelection.omitted,
  };
  const budgetResult = applyWelcomePackBudget({
    routingSelection: constrainedSelection,
    archetype,
    assets: educationalAssetRegistry,
    concepts: educationalConceptTaxonomy,
    accessibilityPreferences,
  });

  const printedItems = [...budgetResult.selectedWithinBudget, ...budgetResult.movedToAppendix];
  const selectedAssetIds = printedItems.map((item) => item.assetId);
  const selectedAssetReasons: Record<string, string[]> = {};
  const selectedBySection = new Map<EducationalPackSectionV1['id'], string[]>();
  const reasonNotesBySection = new Map<EducationalPackSectionV1['id'], string[]>();

  for (const selected of printedItems) {
    const sectionId = toSectionId(selected.sectionTarget);
    selectedBySection.set(sectionId, [...(selectedBySection.get(sectionId) ?? []), selected.assetId]);
    reasonNotesBySection.set(
      sectionId,
      [...(reasonNotesBySection.get(sectionId) ?? []), `${selected.assetId}: ${selected.reason}`],
    );
    selectedAssetReasons[selected.assetId] = [selected.reason];
  }

  const sections: EducationalPackSectionV1[] = [
    buildSection('calm_summary', selectedBySection.get('calm_summary') ?? [], [
      `Archetype: ${archetype.label}.`,
      'Always include a calm summary in plain language.',
      ...archetype.calmFramingNotes,
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

  if (accessibilityPreferences?.includeTechnicalAppendix || selectedBySection.has('optional_technical_appendix')) {
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

  for (const warning of budgetResult.budgetWarnings) {
    sections[0].notes.push(`Warning: ${warning}`);
  }

  const omittedAssetIdSet = new Set<string>();
  const omittedAssetIdsWithReason = [
    ...budgetResult.omittedWithReason,
    ...budgetResult.deferredToQr.map((item) => ({
      assetId: item.assetId,
      conceptIds: item.conceptIds,
      reason: item.reason,
    })),
  ]
    .filter((item) => {
      if (omittedAssetIdSet.has(item.assetId)) {
        return false;
      }
      omittedAssetIdSet.add(item.assetId);
      return true;
    })
    .map((item) => ({
      assetId: item.assetId,
      reason: buildRoutingOmissionReason(item.reason, 'No matched concern tags or required engine facts.'),
    }));

  // Eligibility gate – runs when eligibilityMode is 'warn' or 'filter'
  let finalSelectedAssetIds = selectedAssetIds;
  let finalOmittedAssetIdsWithReason = omittedAssetIdsWithReason;
  let eligibilityFindings: ReturnType<typeof checkWelcomePackAssetEligibility> | undefined;

  if (eligibilityMode !== 'off') {
    const deliveryMode = resolveDeliveryMode(input);
    const qaFindings = runEducationalAssetQa(
      educationalAssetRegistry,
      educationalComponentRegistry,
      educationalConceptTaxonomy,
    );

    const findings = checkWelcomePackAssetEligibility({
      selectedAssetIds,
      deliveryMode,
      assets: educationalAssetRegistry,
      audits: educationalAssetAccessibilityAudits,
      qaFindings,
      printEquivalents: printEquivalentRegistry,
      componentRegistry: educationalComponentRegistry as Record<string, unknown>,
    });

    eligibilityFindings = findings;

    if (eligibilityMode === 'filter') {
      const ineligibleIds = new Set(
        findings.filter((f) => !f.eligible).map((f) => f.assetId),
      );

      finalSelectedAssetIds = selectedAssetIds.filter((id) => !ineligibleIds.has(id));

      const eligibilityOmissions = findings
        .filter((f) => !f.eligible)
        .map((f) => ({
          assetId: f.assetId,
          reason: `Eligibility gate (${deliveryMode}): ${f.reasons.join(' ')}`,
        }));

      const eligibilityOmissionIdSet = new Set(eligibilityOmissions.map((e) => e.assetId));
      finalOmittedAssetIdsWithReason = [
        ...omittedAssetIdsWithReason.filter((item) => !eligibilityOmissionIdSet.has(item.assetId)),
        ...eligibilityOmissions,
      ];
    }
  }

  return {
    packId: `welcome-pack:${recommendedScenarioId}`,
    recommendedScenarioId,
    archetypeId: archetype.archetypeId,
    sections,
    selectedAssetIds: finalSelectedAssetIds,
    selectedAssetReasons,
    selectedConceptIds: uniqueValues(printedItems.flatMap((item) => item.conceptIds)),
    deferredConceptIds: uniqueValues([
      ...budgetResult.deferredToQr.flatMap((item) => item.conceptIds),
      ...budgetResult.movedToAppendix.flatMap((item) => item.conceptIds),
    ]),
    omittedAssetIdsWithReason: finalOmittedAssetIdsWithReason,
    printPageBudget: budgetResult.appliedBudget.maxPages,
    pageBudgetUsed: budgetResult.pageBudgetUsed,
    cognitiveLoadBudget,
    qrDestinations: budgetResult.deferredToQr.map((item) => item.qrDestination),
    eligibilityFindings,
  };
}
