import type { EducationalAssetV1, EducationalLoad } from '../contracts/EducationalAssetV1';
import type { ScenarioSystemType } from '../../contracts/ScenarioResult';
import { educationalRoutingRules } from './educationalRoutingRules';
import type {
  EducationalAssetSelectionV1,
  EducationalRoutingAccessibilityProfile,
  EducationalRoutingRuleV1,
  SelectEducationalAssetsForContextInputV1,
} from './EducationalRoutingRuleV1';

const COGNITIVE_WEIGHT: Record<EducationalLoad, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function normalizeTag(value: string): string {
  return value.trim().toLowerCase();
}

function includesAny(source: string[], targets: string[]): boolean {
  if (source.length === 0 || targets.length === 0) {
    return false;
  }
  const sourceSet = new Set(source.map(normalizeTag));
  return targets.map(normalizeTag).some((tag) => sourceSet.has(tag));
}

function buildAvailableFactKeys(input: SelectEducationalAssetsForContextInputV1): Set<string> {
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

function toAccessibilityProfiles(input: SelectEducationalAssetsForContextInputV1): Set<EducationalRoutingAccessibilityProfile> {
  const profiles = new Set<EducationalRoutingAccessibilityProfile>(input.accessibilityPreferences?.profiles ?? []);

  if (input.accessibilityPreferences?.prefersPrint || input.packMode === 'print') {
    profiles.add('print_first');
  }
  if (input.accessibilityPreferences?.prefersReducedMotion) {
    profiles.add('reduced_motion');
  }
  if (input.accessibilityPreferences?.includeTechnicalAppendix || input.packMode === 'engineer') {
    profiles.add('technical_appendix_requested');
  }

  return profiles;
}

function isRuleApplicable(
  rule: EducationalRoutingRuleV1,
  scenarioType: ScenarioSystemType | undefined,
  userConcernTags: string[],
  propertyConstraintTags: string[],
  profiles: Set<EducationalRoutingAccessibilityProfile>,
  availableFacts: Set<string>,
): boolean {
  if (rule.requiredEngineFacts.some((fact) => !availableFacts.has(fact))) {
    return false;
  }
  if (rule.appliesToScenarioTypes?.length && (!scenarioType || !rule.appliesToScenarioTypes.includes(scenarioType))) {
    return false;
  }
  if (rule.appliesToConstraintTags?.length && !includesAny(rule.appliesToConstraintTags, propertyConstraintTags)) {
    return false;
  }
  if (rule.appliesToUserConcernTags?.length && !includesAny(rule.appliesToUserConcernTags, userConcernTags)) {
    return false;
  }
  if (rule.appliesToAccessibilityProfiles?.length) {
    const hasProfile = rule.appliesToAccessibilityProfiles.some((profile) => profiles.has(profile));
    if (!hasProfile) {
      return false;
    }
  }

  return true;
}

function assetSupportsRule(
  asset: EducationalAssetV1,
  rule: EducationalRoutingRuleV1,
  activeContextTags: string[],
  profiles: Set<EducationalRoutingAccessibilityProfile>,
  availableFacts: Set<string>,
  includeTechnicalAppendix: boolean,
): { supported: boolean; score: number; reason?: string } {
  if (rule.preferredAssetTypes.length > 0 && !rule.preferredAssetTypes.includes(asset.assetType)) {
    return { supported: false, score: -1, reason: 'Asset type does not match rule preference.' };
  }

  if (asset.requiredEngineFacts.some((fact) => !availableFacts.has(fact))) {
    return { supported: false, score: -1, reason: 'Asset required engine facts are not present.' };
  }

  const conceptMatch = rule.requiredConceptIds.length === 0
    || asset.conceptIds.some((conceptId) => rule.requiredConceptIds.includes(conceptId));
  if (!conceptMatch) {
    return { supported: false, score: -1, reason: 'Asset concept does not match rule requirements.' };
  }

  const triggerMatch = rule.triggerTags.length === 0
    || includesAny(rule.triggerTags, activeContextTags)
    || asset.triggerTags.some((tag) => rule.triggerTags.includes(tag));
  if (!triggerMatch) {
    return { supported: false, score: -1, reason: 'Rule trigger tags were not matched.' };
  }

  let score = rule.priority * 100;
  score += rule.printWeight * (asset.hasPrintEquivalent ? 2 : 0);
  score -= COGNITIVE_WEIGHT[asset.cognitiveLoad];

  if (profiles.has('print_first')) {
    score += asset.hasPrintEquivalent ? 40 : -10;
  }

  const cognitiveProfileActive = profiles.has('dyslexia') || profiles.has('adhd');
  if (cognitiveProfileActive && !includeTechnicalAppendix && asset.cognitiveLoad === 'high') {
    return {
      supported: false,
      score: -1,
      reason: 'High cognitive-load asset omitted for dyslexia/ADHD profile without appendix request.',
    };
  }

  if (cognitiveProfileActive) {
    const reducedMotionSafe = asset.motionIntensity === 'none' || asset.supportsReducedMotion;
    const staticSafe = asset.hasStaticFallback || asset.motionIntensity === 'none';
    score += reducedMotionSafe ? 20 : -20;
    score += staticSafe ? 15 : -15;
    score += asset.cognitiveLoad === 'low' ? 20 : asset.cognitiveLoad === 'medium' ? 5 : -40;
  }

  return { supported: true, score };
}

export function selectEducationalAssetsForContext(
  input: SelectEducationalAssetsForContextInputV1,
): EducationalAssetSelectionV1 {
  const userConcernTags = (input.userConcernTags ?? []).map(normalizeTag);
  const propertyConstraintTags = (input.propertyConstraintTags ?? []).map(normalizeTag);
  const recommendedScenario = input.scenarios.find(
    (scenario) => scenario.scenarioId === input.atlasDecision.recommendedScenarioId,
  );
  const scenarioType = recommendedScenario?.system.type;

  const warnings: string[] = [];
  if (!recommendedScenario) {
    warnings.push('Recommended scenario was not found in provided scenarios.');
  }

  const availableFacts = buildAvailableFactKeys(input);
  const profiles = toAccessibilityProfiles(input);
  const activeContextTags = [...new Set([
    ...userConcernTags,
    ...propertyConstraintTags,
    normalizeTag(input.customerSummary.recommendedSystemLabel),
    normalizeTag(input.atlasDecision.recommendedScenarioId),
    scenarioType ? normalizeTag(scenarioType) : '',
    ...Array.from(profiles.values()),
  ].filter(Boolean))];

  const selectedByAssetId = new Map<string, EducationalAssetSelectionV1['selected'][number]>();
  const failedAssetReasons = new Map<string, string[]>();

  const sortedRules = [...educationalRoutingRules].sort((a, b) => b.priority - a.priority || a.ruleId.localeCompare(b.ruleId));

  for (const rule of sortedRules) {
    if (!isRuleApplicable(rule, scenarioType, userConcernTags, propertyConstraintTags, profiles, availableFacts)) {
      continue;
    }

    const candidates = input.educationalAssets
      .map((asset) => {
        const evaluation = assetSupportsRule(
          asset,
          rule,
          activeContextTags,
          profiles,
          availableFacts,
          Boolean(input.accessibilityPreferences?.includeTechnicalAppendix || input.packMode === 'engineer'),
        );
        if (!evaluation.supported && evaluation.reason) {
          const prior = failedAssetReasons.get(asset.id) ?? [];
          prior.push(`${rule.ruleId}: ${evaluation.reason}`);
          failedAssetReasons.set(asset.id, prior);
        }
        return { asset, evaluation };
      })
      .filter((item) => item.evaluation.supported)
      .sort((a, b) => b.evaluation.score - a.evaluation.score || a.asset.id.localeCompare(b.asset.id));

    for (const candidate of candidates.slice(0, Math.max(0, rule.maxAssets))) {
      if (selectedByAssetId.has(candidate.asset.id)) {
        continue;
      }

      selectedByAssetId.set(candidate.asset.id, {
        assetId: candidate.asset.id,
        ruleId: rule.ruleId,
        reason: `${rule.includeReason} Rule: ${rule.label}.`,
        sectionTarget: rule.sectionTarget,
        priority: rule.priority,
        printWeight: rule.printWeight,
        cognitiveLoadImpact: rule.cognitiveLoadImpact,
      });
    }
  }

  const selected = [...selectedByAssetId.values()]
    .sort((a, b) => b.priority - a.priority || b.printWeight - a.printWeight || a.assetId.localeCompare(b.assetId));

  const omitted = input.educationalAssets
    .filter((asset) => !selectedByAssetId.has(asset.id))
    .map((asset) => {
      const reasons = failedAssetReasons.get(asset.id) ?? [];
      return {
        assetId: asset.id,
        reason: reasons[0] ?? 'No routing rule selected this asset for the current context.',
      };
    })
    .sort((a, b) => a.assetId.localeCompare(b.assetId));

  return {
    selected,
    omitted,
    warnings,
  };
}
