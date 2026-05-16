/**
 * computeVisitHydrationState.test.ts
 *
 * Tests for the computeVisitHydrationState pure helper.
 */

import { describe, it, expect } from 'vitest';
import {
  computeVisitHydrationState,
  HYDRATION_STATE_DISPLAY,
} from '../computeVisitHydrationState';

describe('computeVisitHydrationState', () => {
  it('returns no-visit when hasVisit is false', () => {
    expect(
      computeVisitHydrationState({
        hasVisit: false,
        hasRecommendation: false,
        hasAcceptedScenario: false,
        hasSurveyModel: false,
      }),
    ).toBe('no-visit');
  });

  it('returns no-visit when all flags are false', () => {
    expect(
      computeVisitHydrationState({
        hasVisit: false,
        hasRecommendation: true,
        hasAcceptedScenario: true,
        hasSurveyModel: true,
      }),
    ).toBe('no-visit');
  });

  it('returns visit-loaded when visit is set but no recommendation data', () => {
    expect(
      computeVisitHydrationState({
        hasVisit: true,
        hasRecommendation: false,
        hasAcceptedScenario: false,
        hasSurveyModel: false,
      }),
    ).toBe('visit-loaded');
  });

  it('returns recommendation-ready when visit and recommendation exist but no accepted scenario', () => {
    expect(
      computeVisitHydrationState({
        hasVisit: true,
        hasRecommendation: true,
        hasAcceptedScenario: false,
        hasSurveyModel: false,
      }),
    ).toBe('recommendation-ready');
  });

  it('returns recommendation-ready when recommendation exists but survey model is absent', () => {
    expect(
      computeVisitHydrationState({
        hasVisit: true,
        hasRecommendation: true,
        hasAcceptedScenario: true,
        hasSurveyModel: false,
      }),
    ).toBe('recommendation-ready');
  });

  it('returns review-in-progress when accepted scenario and survey model are both present', () => {
    expect(
      computeVisitHydrationState({
        hasVisit: true,
        hasRecommendation: true,
        hasAcceptedScenario: true,
        hasSurveyModel: true,
      }),
    ).toBe('review-in-progress');
  });

  it('returns review-in-progress even without recommendation when accepted scenario and survey exist', () => {
    expect(
      computeVisitHydrationState({
        hasVisit: true,
        hasRecommendation: false,
        hasAcceptedScenario: true,
        hasSurveyModel: true,
      }),
    ).toBe('review-in-progress');
  });
});

describe('HYDRATION_STATE_DISPLAY', () => {
  it('provides display metadata for every state', () => {
    const states = ['no-visit', 'visit-loaded', 'recommendation-ready', 'review-in-progress'] as const;
    for (const state of states) {
      const display = HYDRATION_STATE_DISPLAY[state];
      expect(display.label.length).toBeGreaterThan(0);
      expect(display.description.length).toBeGreaterThan(0);
      expect(['neutral', 'info', 'success', 'active']).toContain(display.tone);
    }
  });
});
