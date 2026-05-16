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
        hasHandoffReview: false,
        hasExportPackage: false,
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
        hasHandoffReview: false,
        hasExportPackage: false,
      }),
    ).toBe('no-visit');
  });

  it('returns survey-in-progress when visit is set but no recommendation data', () => {
    expect(
      computeVisitHydrationState({
        hasVisit: true,
        hasRecommendation: false,
        hasAcceptedScenario: false,
        hasSurveyModel: false,
        hasHandoffReview: false,
        hasExportPackage: false,
      }),
    ).toBe('survey-in-progress');
  });

  it('returns recommendation-ready when visit and recommendation exist but no accepted scenario', () => {
    expect(
      computeVisitHydrationState({
        hasVisit: true,
        hasRecommendation: true,
        hasAcceptedScenario: false,
        hasSurveyModel: false,
        hasHandoffReview: false,
        hasExportPackage: false,
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
        hasHandoffReview: false,
        hasExportPackage: false,
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
        hasHandoffReview: false,
        hasExportPackage: false,
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
        hasHandoffReview: false,
        hasExportPackage: false,
      }),
    ).toBe('review-in-progress');
  });

  it('returns handover-ready when handoff output exists', () => {
    expect(
      computeVisitHydrationState({
        hasVisit: true,
        hasRecommendation: true,
        hasAcceptedScenario: true,
        hasSurveyModel: true,
        hasHandoffReview: true,
        hasExportPackage: false,
      }),
    ).toBe('handover-ready');
  });

  it('returns handover-ready when export package exists', () => {
    expect(
      computeVisitHydrationState({
        hasVisit: true,
        hasRecommendation: true,
        hasAcceptedScenario: true,
        hasSurveyModel: true,
        hasHandoffReview: false,
        hasExportPackage: true,
      }),
    ).toBe('handover-ready');
  });
});

describe('HYDRATION_STATE_DISPLAY', () => {
  it('provides display metadata for every state', () => {
    const states = ['no-visit', 'survey-in-progress', 'recommendation-ready', 'review-in-progress', 'handover-ready'] as const;
    for (const state of states) {
      const display = HYDRATION_STATE_DISPLAY[state];
      expect(display.label.length).toBeGreaterThan(0);
      expect(display.description.length).toBeGreaterThan(0);
      expect(['neutral', 'info', 'success', 'active']).toContain(display.tone);
    }
  });
});
