import type { EducationalContentV1 } from '../content';
import { getContentByConceptId } from '../content';
import type { EducationalMotionMode } from '../ui';

export function getMotionAttribute(motionMode: EducationalMotionMode) {
  if (motionMode === 'system') {
    return undefined;
  }

  return motionMode;
}

function buildFallbackContent(conceptId: string): EducationalContentV1 {
  return {
    contentId: `fallback-${conceptId}`,
    conceptId,
    title: 'Journey guidance',
    plainEnglishSummary: 'This journey keeps expectations calm and practical.',
    customerExplanation:
      'What you may notice: the system behaves differently at first. What this means: this is expected during a new operating pattern.',
    analogyOptions: [
      {
        analogyId: `fallback-${conceptId}-analogy`,
        family: 'none',
        title: 'Direct explanation',
        explanation: 'Changes in comfort often come from control strategy and demand profile, not faults.',
        whereItWorks: 'Useful for straightforward expectation setting.',
        whereItBreaks: 'It does not replace a site-specific survey or commissioning check.',
      },
    ],
    commonMisunderstanding: 'Any change in feel means the system is wrong.',
    dangerousOversimplification: 'Keep changing settings every hour to force comfort.',
    livingWithSystemGuidance: 'Keep settings steady and review with your installer after one full day.',
    printSummary: 'Use this journey to align expectations and reduce avoidable worry.',
    qrDeepDiveTitle: 'Why comfort feel can change without indicating a fault',
    readingLevel: 'simple',
    accessibilityNotes: ['Short practical wording'],
    requiredEvidenceFacts: [conceptId],
    confidenceLevel: 'best_practice',
  };
}

export function getRequiredContent(conceptId: string): EducationalContentV1 {
  return getContentByConceptId(conceptId) ?? buildFallbackContent(conceptId);
}

function trimLabelledValue(source: string, label: string): string {
  const normalised = source.replace(/\s+/g, ' ').trim();
  const index = normalised.indexOf(label);
  if (index === -1) {
    return '';
  }

  return normalised.slice(index + label.length).trim();
}

export function extractNotice(customerExplanation: string): string {
  const value = trimLabelledValue(customerExplanation, 'What you may notice:');
  if (!value) {
    return customerExplanation;
  }

  return value.split('What this means:')[0]?.trim() ?? value;
}

export function extractMeaning(customerExplanation: string): string {
  const value = trimLabelledValue(customerExplanation, 'What this means:');
  return value || customerExplanation;
}

export function getPrimaryAnalogy(content: EducationalContentV1) {
  return content.analogyOptions[0] ?? {
    title: 'Direct explanation',
    explanation: content.customerExplanation,
    whereItWorks: 'Supports calm expectation-setting.',
    whereItBreaks: 'Does not replace property-specific evidence.',
  };
}

export function countSentences(value: string): number {
  return (value.match(/[.!?](?=\s|$)/g) ?? []).length;
}
