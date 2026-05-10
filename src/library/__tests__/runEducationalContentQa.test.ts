import { describe, expect, it } from 'vitest';
import { educationalContentRegistry } from '../content/educationalContentRegistry';
import {
  getContentQaErrors,
  getContentQaWarnings,
  runEducationalContentQa,
} from '../content/qa/runEducationalContentQa';

describe('runEducationalContentQa', () => {
  it('returns no errors and warnings for current MVP registry', () => {
    const findings = runEducationalContentQa(educationalContentRegistry);
    expect(findings).toEqual([]);
    expect(getContentQaErrors()).toEqual([]);
    expect(getContentQaWarnings()).toEqual([]);
  });

  it('splits errors and warnings in helper accessors', () => {
    runEducationalContentQa([
      {
        ...educationalContentRegistry[0],
        contentId: 'EC-TEST-01',
        conceptId: 'CON-01',
        printSummary: '',
        customerExplanation: 'x'.repeat(250),
      },
    ]);

    expect(getContentQaErrors().some((finding) => finding.ruleId === 'missing_print_summary')).toBe(true);
    expect(getContentQaWarnings().some((finding) => finding.ruleId === 'customer_explanation_too_long')).toBe(true);
  });
});
