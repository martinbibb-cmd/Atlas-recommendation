import { describe, expect, it } from 'vitest';
import { computeVisitHydrationState } from '../computeVisitHydrationState';

describe('computeVisitHydrationState lifecycle authority', () => {
  it('returns survey-in-progress when canonical lifecycle is survey_in_progress', () => {
    const state = computeVisitHydrationState({
      hasVisit: true,
      lifecycleState: 'survey_in_progress',
      hasRecommendation: true,
      hasAcceptedScenario: true,
      hasSurveyModel: true,
      hasHandoffReview: true,
      hasExportPackage: true,
    });
    expect(state).toBe('survey-in-progress');
  });

  it('returns recommendation-ready when canonical lifecycle is recommendation_ready', () => {
    const state = computeVisitHydrationState({
      hasVisit: true,
      lifecycleState: 'recommendation_ready',
      hasRecommendation: false,
      hasAcceptedScenario: false,
      hasSurveyModel: false,
      hasHandoffReview: false,
      hasExportPackage: false,
    });
    expect(state).toBe('recommendation-ready');
  });

  it('returns review-in-progress when canonical lifecycle is presentation_ready', () => {
    const state = computeVisitHydrationState({
      hasVisit: true,
      lifecycleState: 'presentation_ready',
      hasRecommendation: false,
      hasAcceptedScenario: false,
      hasSurveyModel: false,
      hasHandoffReview: false,
      hasExportPackage: false,
    });
    expect(state).toBe('review-in-progress');
  });
});
