import type { EducationalContentV1 } from '../EducationalContentV1';
import type { EducationalContentQaV1 } from './EducationalContentQaV1';

const MAX_CUSTOMER_EXPLANATION_LENGTH = 240;
const MAX_PRINT_SUMMARY_LENGTH = 140;

const BANNED_PHRASES = [
  'instantaneous hot water',
  'guaranteed savings',
  'maintenance-free',
  'zero disruption',
  'always cheaper',
  'never needs',
];

const SCARE_WORDS = ['dangerous', 'catastrophic', 'fatal'];

const UNSUPPORTED_RECOMMENDATION_PHRASES = [
  'best system',
  'must choose',
  'atlas guarantees',
];

const JARGON_PATTERNS: RegExp[] = [
  /\bcoefficient of performance\b/i,
  /\bcop\b/i,
  /\bdelta[- ]?t\b/i,
  /\bhysteresis\b/i,
  /\benthalpy\b/i,
];

const COMPLIANCE_TERMS = ['compliance', 'regulation', 'mandatory', 'standards-based'];
const BENEFIT_TERMS = ['benefit', 'save', 'savings', 'comfort', 'better', 'improve', 'advantage'];

interface AddFindingInput {
  list: EducationalContentQaV1[];
  contentId: string;
  conceptId: string;
  severity: EducationalContentQaV1['severity'];
  ruleId: string;
  message: string;
  field: string;
  suggestedAction?: string;
}

function addFinding(input: AddFindingInput) {
  input.list.push({
    contentId: input.contentId,
    conceptId: input.conceptId,
    severity: input.severity,
    ruleId: input.ruleId,
    message: input.message,
    field: input.field,
    suggestedAction: input.suggestedAction,
  });
}

function includesAnyPhrase(value: string, phrases: string[]): string | undefined {
  const lower = value.toLowerCase();
  return phrases.find((phrase) => lower.includes(phrase));
}

function containsScareWord(value: string): string | undefined {
  const lower = value.toLowerCase();
  return SCARE_WORDS.find((word) => new RegExp(`\\b${word}\\b`, 'i').test(lower));
}

function hasUnexplainedJargon(entry: EducationalContentV1): string | undefined {
  if (entry.readingLevel === 'technical') {
    return undefined;
  }

  const candidateFields: Array<{ field: string; value: string }> = [
    { field: 'title', value: entry.title },
    { field: 'plainEnglishSummary', value: entry.plainEnglishSummary },
    { field: 'customerExplanation', value: entry.customerExplanation },
    { field: 'printSummary', value: entry.printSummary },
  ];

  for (const candidate of candidateFields) {
    for (const pattern of JARGON_PATTERNS) {
      if (pattern.test(candidate.value)) {
        return candidate.field;
      }
    }
  }

  return undefined;
}

function complianceFramedAsBenefit(entry: EducationalContentV1): string | undefined {
  const candidateFields: Array<{ field: string; value: string }> = [
    { field: 'plainEnglishSummary', value: entry.plainEnglishSummary },
    { field: 'customerExplanation', value: entry.customerExplanation },
    { field: 'printSummary', value: entry.printSummary },
  ];

  for (const candidate of candidateFields) {
    const lower = candidate.value.toLowerCase();
    if (
      COMPLIANCE_TERMS.some((term) => lower.includes(term))
      && BENEFIT_TERMS.some((term) => lower.includes(term))
    ) {
      return candidate.field;
    }
  }

  return undefined;
}

export function validateEducationalContent(entry: EducationalContentV1): EducationalContentQaV1[] {
  const findings: EducationalContentQaV1[] = [];

  if (entry.printSummary.trim().length === 0) {
    addFinding({
      list: findings,
      contentId: entry.contentId,
      conceptId: entry.conceptId,
      severity: 'error',
      ruleId: 'missing_print_summary',
      message: 'printSummary is required.',
      field: 'printSummary',
      suggestedAction: 'Add a concise print summary for print and fallback surfaces.',
    });
  }

  if (entry.dangerousOversimplification.trim().length === 0) {
    addFinding({
      list: findings,
      contentId: entry.contentId,
      conceptId: entry.conceptId,
      severity: 'error',
      ruleId: 'missing_dangerous_oversimplification',
      message: 'dangerousOversimplification is required.',
      field: 'dangerousOversimplification',
      suggestedAction: 'Add a clear harmful oversimplification statement.',
    });
  }

  if (entry.analogyOptions.length === 0) {
    addFinding({
      list: findings,
      contentId: entry.contentId,
      conceptId: entry.conceptId,
      severity: 'error',
      ruleId: 'missing_analogy_options',
      message: 'At least one analogy option is required.',
      field: 'analogyOptions',
      suggestedAction: 'Add at least one analogy option.',
    });
  }

  if (!entry.analogyOptions.some((option) => option.family === 'none')) {
    addFinding({
      list: findings,
      contentId: entry.contentId,
      conceptId: entry.conceptId,
      severity: 'error',
      ruleId: 'missing_factual_no_analogy_option',
      message: 'At least one factual no-analogy option is required.',
      field: 'analogyOptions',
      suggestedAction: 'Add an option with family set to none.',
    });
  }

  if (entry.customerExplanation.length > MAX_CUSTOMER_EXPLANATION_LENGTH) {
    addFinding({
      list: findings,
      contentId: entry.contentId,
      conceptId: entry.conceptId,
      severity: 'warning',
      ruleId: 'customer_explanation_too_long',
      message: `customerExplanation is longer than ${MAX_CUSTOMER_EXPLANATION_LENGTH} characters.`,
      field: 'customerExplanation',
      suggestedAction: 'Shorten customerExplanation to improve readability.',
    });
  }

  if (entry.printSummary.length > MAX_PRINT_SUMMARY_LENGTH) {
    addFinding({
      list: findings,
      contentId: entry.contentId,
      conceptId: entry.conceptId,
      severity: 'warning',
      ruleId: 'print_summary_too_long',
      message: `printSummary is longer than ${MAX_PRINT_SUMMARY_LENGTH} characters.`,
      field: 'printSummary',
      suggestedAction: 'Shorten printSummary for print-first accessibility.',
    });
  }

  const textFields: Array<{ field: string; value: string }> = [
    { field: 'title', value: entry.title },
    { field: 'plainEnglishSummary', value: entry.plainEnglishSummary },
    { field: 'customerExplanation', value: entry.customerExplanation },
    { field: 'commonMisunderstanding', value: entry.commonMisunderstanding },
    { field: 'dangerousOversimplification', value: entry.dangerousOversimplification },
    { field: 'livingWithSystemGuidance', value: entry.livingWithSystemGuidance ?? '' },
    { field: 'printSummary', value: entry.printSummary },
    { field: 'technicalAppendixSummary', value: entry.technicalAppendixSummary ?? '' },
    { field: 'safetyNotice', value: entry.safetyNotice ?? '' },
    { field: 'qrDeepDiveTitle', value: entry.qrDeepDiveTitle ?? '' },
  ];

  for (const field of textFields) {
    const banned = includesAnyPhrase(field.value, BANNED_PHRASES);
    if (!banned) {
      continue;
    }
    addFinding({
      list: findings,
      contentId: entry.contentId,
      conceptId: entry.conceptId,
      severity: 'error',
      ruleId: 'banned_phrase',
      message: `Banned phrase detected: "${banned}".`,
      field: field.field,
      suggestedAction: 'Replace with Atlas-approved terminology and bounded wording.',
    });
  }

  for (const field of textFields) {
    if (field.field === 'safetyNotice' && entry.safetyNotice) {
      continue;
    }

    const scareWord = containsScareWord(field.value);
    if (!scareWord) {
      continue;
    }
    addFinding({
      list: findings,
      contentId: entry.contentId,
      conceptId: entry.conceptId,
      severity: 'error',
      ruleId: 'scare_framing_outside_safety_notice',
      message: `Scare framing word "${scareWord}" is only allowed in safetyNotice context.`,
      field: field.field,
      suggestedAction: 'Move safety-critical wording into safetyNotice or neutralise framing.',
    });
  }

  const jargonField = hasUnexplainedJargon(entry);
  if (jargonField) {
    addFinding({
      list: findings,
      contentId: entry.contentId,
      conceptId: entry.conceptId,
      severity: 'warning',
      ruleId: 'unexplained_jargon',
      message: 'Potential unexplained jargon found in simple/standard content.',
      field: jargonField,
      suggestedAction: 'Replace jargon or add plain-language explanation.',
    });
  }

  for (const field of textFields) {
    const unsupportedPhrase = includesAnyPhrase(field.value, UNSUPPORTED_RECOMMENDATION_PHRASES);
    if (!unsupportedPhrase) {
      continue;
    }
    addFinding({
      list: findings,
      contentId: entry.contentId,
      conceptId: entry.conceptId,
      severity: 'error',
      ruleId: 'unsupported_recommendation_language',
      message: `Unsupported recommendation language detected: "${unsupportedPhrase}".`,
      field: field.field,
      suggestedAction: 'Use evidence-grounded and non-prescriptive phrasing.',
    });
  }

  const complianceBenefitField = complianceFramedAsBenefit(entry);
  if (complianceBenefitField) {
    addFinding({
      list: findings,
      contentId: entry.contentId,
      conceptId: entry.conceptId,
      severity: 'error',
      ruleId: 'compliance_framed_as_customer_benefit',
      message: 'Compliance language must not be framed as a customer benefit claim.',
      field: complianceBenefitField,
      suggestedAction: 'Separate compliance obligations from customer benefit statements.',
    });
  }

  for (const [index, option] of entry.analogyOptions.entries()) {
    if (option.whereItWorks.trim().length === 0) {
      addFinding({
        list: findings,
        contentId: entry.contentId,
        conceptId: entry.conceptId,
        severity: 'error',
        ruleId: 'analogy_missing_where_it_works',
        message: `Analogy option ${option.analogyId} must include whereItWorks.`,
        field: `analogyOptions[${index}].whereItWorks`,
        suggestedAction: 'Add a concise scope statement for where the analogy works.',
      });
    }
    if (option.whereItBreaks.trim().length === 0) {
      addFinding({
        list: findings,
        contentId: entry.contentId,
        conceptId: entry.conceptId,
        severity: 'error',
        ruleId: 'analogy_missing_where_it_breaks',
        message: `Analogy option ${option.analogyId} must include whereItBreaks.`,
        field: `analogyOptions[${index}].whereItBreaks`,
        suggestedAction: 'Add a boundary statement for where the analogy breaks.',
      });
    }
  }

  return findings;
}
