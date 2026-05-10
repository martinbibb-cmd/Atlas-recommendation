import { describe, expect, it } from 'vitest';
import type { EducationalContentV1 } from '../content/EducationalContentV1';
import { educationalContentRegistry } from '../content/educationalContentRegistry';
import { validateEducationalContent } from '../content/qa/validateEducationalContent';

function buildValidContent(overrides: Partial<EducationalContentV1> = {}): EducationalContentV1 {
  return {
    ...educationalContentRegistry[0],
    ...overrides,
  };
}

describe('validateEducationalContent', () => {
  it('valid MVP content passes', () => {
    const findings = validateEducationalContent(educationalContentRegistry[0]);
    expect(findings).toEqual([]);
  });

  it('fails when printSummary is missing', () => {
    const findings = validateEducationalContent(buildValidContent({ printSummary: '  ' }));
    expect(findings.some((finding) => finding.ruleId === 'missing_print_summary')).toBe(true);
  });

  it('fails when factual no-analogy option is missing', () => {
    const findings = validateEducationalContent(buildValidContent({
      analogyOptions: educationalContentRegistry[0].analogyOptions.filter((option) => option.family !== 'none'),
    }));
    expect(findings.some((finding) => finding.ruleId === 'missing_factual_no_analogy_option')).toBe(true);
  });

  it('fails when banned phrases are used', () => {
    const findings = validateEducationalContent(buildValidContent({
      customerExplanation: 'This gives guaranteed savings with zero disruption.',
    }));
    expect(findings.some((finding) => finding.ruleId === 'banned_phrase')).toBe(true);
  });

  it('fails when scare words are used outside safetyNotice', () => {
    const findings = validateEducationalContent(buildValidContent({
      customerExplanation: 'The result is catastrophic if this setting is changed.',
    }));
    expect(findings.some((finding) => finding.ruleId === 'scare_framing_outside_safety_notice')).toBe(true);
  });

  it('fails when analogy option is missing break-point', () => {
    const findings = validateEducationalContent(buildValidContent({
      analogyOptions: [
        {
          ...educationalContentRegistry[0].analogyOptions[0],
          whereItBreaks: '  ',
        },
        educationalContentRegistry[0].analogyOptions[1],
      ],
    }));
    expect(findings.some((finding) => finding.ruleId === 'analogy_missing_where_it_breaks')).toBe(true);
  });
});
