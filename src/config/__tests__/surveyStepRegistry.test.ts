/**
 * surveyStepRegistry.test.ts
 *
 * Regression tests for the canonical survey step contract.
 *
 *   1. The registry defines exactly the canonical 6-step journey.
 *   2. displayIndex values are sequential 1…N.
 *   3. progressLabel output matches the canonical sequence.
 *   4. Every step has a non-empty heading and testId.
 *   5. nextStepId / prevStepId navigate correctly.
 */
import { describe, it, expect } from 'vitest';
import {
  SURVEY_STEP_REGISTRY,
  SURVEY_STEP_IDS,
  SURVEY_STEP_COUNT,
  getStepMeta,
  progressLabel,
  nextStepId,
  prevStepId,
} from '../../config/surveyStepRegistry';

// ─── Contract: canonical journey order ────────────────────────────────────────

describe('surveyStepRegistry — canonical journey order', () => {
  it('defines exactly 7 steps', () => {
    expect(SURVEY_STEP_COUNT).toBe(7);
    expect(SURVEY_STEP_REGISTRY).toHaveLength(7);
  });

  it('step IDs match the canonical sequence', () => {
    expect(SURVEY_STEP_IDS).toEqual([
      'system_builder',
      'usage',
      'services',
      'heat_loss',
      'solar_assessment',
      'priorities',
      'insight',
    ]);
  });

  it('displayIndex values are sequential 1…7', () => {
    const indices = SURVEY_STEP_REGISTRY.map(s => s.displayIndex);
    expect(indices).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('every step has a non-empty heading', () => {
    for (const step of SURVEY_STEP_REGISTRY) {
      expect(step.heading.length).toBeGreaterThan(0);
    }
  });

  it('every step has a non-empty testId', () => {
    for (const step of SURVEY_STEP_REGISTRY) {
      expect(step.testId.length).toBeGreaterThan(0);
    }
  });

  it('every step has a non-empty analyticsEvent', () => {
    for (const step of SURVEY_STEP_REGISTRY) {
      expect(step.analyticsEvent.length).toBeGreaterThan(0);
    }
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

describe('surveyStepRegistry — helper functions', () => {
  it('getStepMeta returns correct metadata for each step', () => {
    expect(getStepMeta('system_builder').displayIndex).toBe(1);
    expect(getStepMeta('usage').displayIndex).toBe(2);
    expect(getStepMeta('services').displayIndex).toBe(3);
    expect(getStepMeta('heat_loss').displayIndex).toBe(4);
    expect(getStepMeta('solar_assessment').displayIndex).toBe(5);
    expect(getStepMeta('priorities').displayIndex).toBe(6);
    expect(getStepMeta('insight').displayIndex).toBe(7);
  });

  it('progressLabel returns "Step N of 7" for each step', () => {
    expect(progressLabel('system_builder')).toBe('Step 1 of 7');
    expect(progressLabel('usage')).toBe('Step 2 of 7');
    expect(progressLabel('services')).toBe('Step 3 of 7');
    expect(progressLabel('heat_loss')).toBe('Step 4 of 7');
    expect(progressLabel('solar_assessment')).toBe('Step 5 of 7');
    expect(progressLabel('priorities')).toBe('Step 6 of 7');
    expect(progressLabel('insight')).toBe('Step 7 of 7');
  });

  it('nextStepId chains through the canonical sequence', () => {
    expect(nextStepId('system_builder')).toBe('usage');
    expect(nextStepId('usage')).toBe('services');
    expect(nextStepId('services')).toBe('heat_loss');
    expect(nextStepId('heat_loss')).toBe('solar_assessment');
    expect(nextStepId('solar_assessment')).toBe('priorities');
    expect(nextStepId('priorities')).toBe('insight');
    expect(nextStepId('insight')).toBeNull();
  });

  it('prevStepId chains backwards through the canonical sequence', () => {
    expect(prevStepId('system_builder')).toBeNull();
    expect(prevStepId('usage')).toBe('system_builder');
    expect(prevStepId('services')).toBe('usage');
    expect(prevStepId('heat_loss')).toBe('services');
    expect(prevStepId('solar_assessment')).toBe('heat_loss');
    expect(prevStepId('priorities')).toBe('solar_assessment');
    expect(prevStepId('insight')).toBe('priorities');
  });
});

// ─── Regression: headings must match the canonical registry ───────────────────

describe('surveyStepRegistry — heading regression', () => {
  it('headings follow the canonical order', () => {
    const headings = SURVEY_STEP_REGISTRY.map(s => s.heading);
    // If a heading is changed, this test forces the developer to update the
    // registry — not a local component literal.
    expect(headings).toEqual([
      '🔧 System Architecture',
      '🏠 Home & Household',
      '🔧 Services',
      '🏗️ House & Heat Loss',
      '☀️ Solar & Roof',
      '🎯 Priorities',
      '🧠 What we need to keep in mind',
    ]);
  });

  it('testIds follow the canonical order', () => {
    const testIds = SURVEY_STEP_REGISTRY.map(s => s.testId);
    expect(testIds).toEqual([
      'system-builder-step',
      'usage-step',
      'services-step',
      'heat-loss-step',
      'solar-assessment-step',
      'priorities-step',
      'insight-layer-page',
    ]);
  });
});
