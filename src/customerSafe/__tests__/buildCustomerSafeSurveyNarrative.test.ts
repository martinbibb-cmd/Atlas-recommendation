import { describe, expect, it } from 'vitest';
import { buildCustomerSafeSurveyNarrative, containsCustomerUnsafeSurveyNarrative } from '../buildCustomerSafeSurveyNarrative';

describe('buildCustomerSafeSurveyNarrative', () => {
  it('replaces known survey leakage phrases with customer-safe copy', () => {
    expect(buildCustomerSafeSurveyNarrative('Heat loss band not modelled')).toBe(
      'Detailed heat-loss band analysis was outside the current survey scope.',
    );
    expect(buildCustomerSafeSurveyNarrative('Wall type not recorded')).toBe(
      'Detailed wall construction assessment was not included in this visit.',
    );
  });

  it('rewrites service-life estimate notes without using internal survey-state wording', () => {
    expect(buildCustomerSafeSurveyNarrative('Age not recorded — using a condition-led service-life estimate (~14 years).')).toBe(
      'System age was not confirmed during this survey, so Atlas used condition evidence to estimate service life (~14 years).',
    );
  });

  it('flags unsafe survey-state phrases', () => {
    expect(containsCustomerUnsafeSurveyNarrative('Insulation level not recorded')).toBe(true);
    expect(containsCustomerUnsafeSurveyNarrative('Insulation performance was not fully assessed during this survey.')).toBe(false);
  });
});
