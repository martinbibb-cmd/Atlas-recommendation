import {
  type LibraryStorySceneCompositionV1,
  type PortalJourneyPrintSectionV1,
  type RecommendationReasonBlockV1,
} from '../portal/pdf/buildPortalJourneyPrintModel';

export interface CustomerSceneInsightV1 {
  whatWasFound: string;
  whyItMatters: string;
  whatChanges: string;
  whatToExpect: string;
}

export interface CustomerPresentationScene {
  sceneId: string;
  sectionId: PortalJourneyPrintSectionV1['sectionId'];
  heading: string;
  takeaway: string;
  visualAssetId?: string;
  explanation?: string;
  technicalDetail?: string;
  insight: CustomerSceneInsightV1;
  composition?: LibraryStorySceneCompositionV1;
  sourceSection: PortalJourneyPrintSectionV1;
}

export function customerSceneHasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveTechnicalDetail(section: PortalJourneyPrintSectionV1): string | undefined {
  const details = [section.reassurance, ...section.items]
    .filter(customerSceneHasText)
    .map((value) => value.trim());
  if (details.length === 0) return undefined;
  return details.join(' ');
}

function dedupeNonEmpty(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    if (!customerSceneHasText(value)) continue;
    const normalized = value.trim();
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
  }
  return output;
}

function preferredReasonCategoriesBySection(
  sectionId: PortalJourneyPrintSectionV1['sectionId'],
): RecommendationReasonBlockV1['category'][] {
  switch (sectionId) {
    case 'system_fit_decision_map':
      return ['household_demand', 'bathroom_count', 'mains_flow_pressure', 'current_system_constraint', 'simultaneous_hot_water_use'];
    case 'pressure_vs_storage':
    case 'stored_hot_water_recovery_timeline':
      return ['hot_water_system_type', 'bathroom_count', 'mains_flow_pressure', 'simultaneous_hot_water_use'];
    case 'flow_restriction_bottleneck':
      return ['mains_flow_pressure', 'simultaneous_hot_water_use', 'current_system_constraint'];
    case 'powerflush_condition_led':
    case 'magnetic_filter_capture':
    case 'sealed_system_pressure_window':
      return ['protection_system_condition', 'current_system_constraint', 'mains_flow_pressure'];
    case 'warm_not_hot_radiators':
    case 'steady_running':
    case 'winter_behaviour':
      return ['emitter_upgrade_required', 'current_system_constraint', 'future_upgrade_readiness'];
    case 'unvented_safety':
      return ['hot_water_system_type', 'protection_system_condition', 'bathroom_count'];
    default:
      return ['current_system_constraint', 'household_demand', 'mains_flow_pressure'];
  }
}

function pickReasonForSection(
  section: PortalJourneyPrintSectionV1,
  reasons: readonly RecommendationReasonBlockV1[],
): RecommendationReasonBlockV1 | undefined {
  const preferredCategories = preferredReasonCategoriesBySection(section.sectionId);
  for (const category of preferredCategories) {
    const match = reasons.find((reason) => reason.category === category);
    if (match != null) return match;
  }
  return reasons[0];
}

function buildSceneInsight(
  section: PortalJourneyPrintSectionV1,
  matchedReason: RecommendationReasonBlockV1 | undefined,
): CustomerSceneInsightV1 {
  const storyScene = section.storyScene;
  const whatWasFound = dedupeNonEmpty([
    matchedReason?.homeFact,
    section.summary,
    section.keyTakeaway,
    section.items[0],
  ])[0] ?? section.summary;

  const whyItMatters = dedupeNonEmpty([
    matchedReason?.whyItMatters,
    storyScene?.whyItMatters,
    section.summary,
  ])[0] ?? section.summary;

  const whatChanges = dedupeNonEmpty([
    matchedReason?.atlasRecommendationOutcome,
    section.keyTakeaway,
    section.reassurance,
  ])[0] ?? section.keyTakeaway;

  const whatToExpect = dedupeNonEmpty([
    matchedReason?.practicalEffect,
    storyScene?.whatYouWillNotice,
    section.items[0],
    section.reassurance,
  ])[0] ?? section.reassurance;

  return { whatWasFound, whyItMatters, whatChanges, whatToExpect };
}

export function resolveCustomerSceneVisualAssetId(
  section: PortalJourneyPrintSectionV1,
): string | undefined {
  return section.storyScene?.visualAssetId ?? section.diagramRendererId ?? section.diagramId;
}

export function isValidCustomerPresentationScene(
  scene: CustomerPresentationScene,
): boolean {
  return customerSceneHasText(scene.heading)
    && customerSceneHasText(scene.takeaway)
    && customerSceneHasText(scene.insight.whatWasFound)
    && customerSceneHasText(scene.insight.whyItMatters)
    && customerSceneHasText(scene.insight.whatChanges)
    && customerSceneHasText(scene.insight.whatToExpect);
}

export function buildCustomerPresentationScenes(
  sections: readonly PortalJourneyPrintSectionV1[],
  options?: {
    recommendationReasons?: readonly RecommendationReasonBlockV1[];
  },
): CustomerPresentationScene[] {
  const recommendationReasons = options?.recommendationReasons ?? [];
  return sections
    .map((section) => {
      const storyScene = section.storyScene;
      const matchedReason = pickReasonForSection(section, recommendationReasons);
      return {
        sceneId: `${section.sectionId}-${section.contentId}`,
        sectionId: section.sectionId,
        heading: storyScene?.title ?? section.heading,
        takeaway: storyScene?.customerTakeaway ?? section.keyTakeaway,
        visualAssetId: resolveCustomerSceneVisualAssetId(section),
        explanation: storyScene?.whyItMatters ?? section.summary,
        technicalDetail: resolveTechnicalDetail(section),
        insight: buildSceneInsight(section, matchedReason),
        composition: storyScene?.composition,
        sourceSection: section,
      };
    })
    .filter(isValidCustomerPresentationScene);
}
