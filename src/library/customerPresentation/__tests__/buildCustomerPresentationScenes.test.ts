import { describe, expect, it } from 'vitest';
import { buildPortalJourneyPrintModel } from '../../portal/pdf/buildPortalJourneyPrintModel';
import { buildCustomerPresentationScenes } from '../customerSceneValidation';

describe('buildCustomerPresentationScenes', () => {
  it('builds homeowner insight blocks for each scene', () => {
    const model = buildPortalJourneyPrintModel({
      journeyType: 'generic_recommendation_summary',
      selectedSectionIds: ['CON_D01'],
      educationalConceptTags: ['flow_restriction_bottleneck'],
      recommendationSummary: 'Stored hot-water route selected from measured evidence.',
      customerFacts: ['4-person household', '2 bathrooms'],
      recommendationReasons: [
        {
          id: 'reason-1',
          category: 'mains_flow_pressure',
          homeFact: 'Measured mains flow dips during overlap demand.',
          whyItMatters: 'Flow limits can reduce performance when outlets run together.',
          atlasRecommendationOutcome: 'Atlas prioritised stored hot water instead of a standard combi route.',
          practicalEffect: 'Hot-water delivery remains steadier when two outlets overlap.',
        },
      ],
    });

    const scenes = buildCustomerPresentationScenes(model.sections, {
      recommendationReasons: [
        {
          id: 'reason-flow',
          category: 'mains_flow_pressure',
          homeFact: 'Your measured supply drops under overlap use.',
          whyItMatters: 'This can cause combi performance dips at busy times.',
          atlasRecommendationOutcome: 'Atlas selected stored hot water to protect overlap demand.',
          practicalEffect: 'You should see steadier showers during peak use.',
        },
      ],
    });

    expect(scenes.length).toBeGreaterThan(0);
    for (const scene of scenes) {
      expect(scene.insight.whatWasFound.length).toBeGreaterThan(0);
      expect(scene.insight.whyItMatters.length).toBeGreaterThan(0);
      expect(scene.insight.whatChanges.length).toBeGreaterThan(0);
      expect(scene.insight.whatToExpect.length).toBeGreaterThan(0);
    }
  });

  it('prefers matching recommendation rationale when available', () => {
    const model = buildPortalJourneyPrintModel({
      journeyType: 'generic_recommendation_summary',
      selectedSectionIds: ['CON_D01'],
      educationalConceptTags: ['flow_restriction_bottleneck'],
      recommendationSummary: 'Stored hot-water route selected from measured evidence.',
      customerFacts: ['4-person household', '2 bathrooms'],
      recommendationReasons: [
        {
          id: 'reason-flow',
          category: 'mains_flow_pressure',
          homeFact: 'Your measured supply drops under overlap use.',
          whyItMatters: 'This can cause combi performance dips at busy times.',
          atlasRecommendationOutcome: 'Atlas selected stored hot water to protect overlap demand.',
          practicalEffect: 'You should see steadier showers during peak use.',
        },
      ],
    });
    const scenes = buildCustomerPresentationScenes(model.sections, {
      recommendationReasons: [
        {
          id: 'reason-flow',
          category: 'mains_flow_pressure',
          homeFact: 'Your measured supply drops under overlap use.',
          whyItMatters: 'This can cause combi performance dips at busy times.',
          atlasRecommendationOutcome: 'Atlas selected stored hot water to protect overlap demand.',
          practicalEffect: 'You should see steadier showers during peak use.',
        },
      ],
    });
    const flowScene = scenes.find((scene) => scene.sectionId === 'flow_restriction_bottleneck');
    expect(flowScene).toBeDefined();
    expect(flowScene?.insight.whatWasFound).toContain('measured supply');
    expect(flowScene?.insight.whatToExpect).toContain('steadier showers');
  });
});
