import type { PortalJourneyPrintModelV1, PortalJourneyPrintSectionV1 } from './buildPortalJourneyPrintModel';

export interface SupportingPdfReadinessInput {
  model: PortalJourneyPrintModelV1;
  expectedRecommendationSummary: string;
  maxCustomerPages?: number;
  requiredDiagramSectionIds?: PortalJourneyPrintSectionV1['sectionId'][];
  printSafeLayoutPass: boolean;
  accessibilityBasicsPass: boolean;
  insightFallbackAvailable: boolean;
}

export interface SupportingPdfReadinessResult {
  ready: boolean;
  blockingReasons: string[];
  warnings: string[];
}

const PENDING_CONTENT_PATTERNS = [
  /\bcontent pending\b/i,
  /\btodo\b/i,
  /\btbd\b/i,
  /\bplaceholder\b/i,
] as const;

const RAW_ENGINE_OR_DEBUG_PATTERNS = [
  /\bCON_[A-Z0-9]+\b/,
  /\bdebug\b/i,
  /\bdiagnostic\b/i,
  /\btrace\b/i,
  /\bengine\b/i,
] as const;

function collectCustomerFacingText(model: PortalJourneyPrintModelV1): string[] {
  const coverText = [
    model.cover.title,
    model.cover.summary,
    ...model.cover.customerFacts,
  ];

  const sectionText = model.sections.flatMap((section) => [
    section.heading,
    section.summary,
    section.keyTakeaway,
    section.reassurance,
    section.diagramCaption ?? '',
    ...section.items,
  ]);

  const nextStepText = model.nextSteps.flatMap((step) => [step.label, step.body]);
  const qrText = model.qrDestinations.flatMap((dest) => [dest.heading, dest.note]);

  return [...coverText, ...sectionText, ...nextStepText, ...qrText].map((line) => line.trim());
}

function hasPendingContent(lines: string[]): boolean {
  return lines.some((line) =>
    line.length === 0 || PENDING_CONTENT_PATTERNS.some((pattern) => pattern.test(line)));
}

function hasRawEngineOrDebugText(lines: string[]): boolean {
  return lines.some((line) => RAW_ENGINE_OR_DEBUG_PATTERNS.some((pattern) => pattern.test(line)));
}

function getMissingRequiredDiagrams(
  model: PortalJourneyPrintModelV1,
  requiredDiagramSectionIds: PortalJourneyPrintSectionV1['sectionId'][],
): PortalJourneyPrintSectionV1['sectionId'][] {
  if (requiredDiagramSectionIds.length === 0) {
    return [];
  }

  return requiredDiagramSectionIds.filter((requiredSectionId) => {
    const section = model.sections.find((candidate) => candidate.sectionId === requiredSectionId);
    return !section || !section.diagramId || section.diagramId.trim().length === 0;
  });
}

export function assessSupportingPdfReadiness(
  input: SupportingPdfReadinessInput,
): SupportingPdfReadinessResult {
  const {
    model,
    expectedRecommendationSummary,
    maxCustomerPages = model.pageEstimate.maxPages,
    requiredDiagramSectionIds = [],
    printSafeLayoutPass,
    accessibilityBasicsPass,
    insightFallbackAvailable,
  } = input;

  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const allCustomerText = collectCustomerFacingText(model);

  if (hasPendingContent(allCustomerText)) {
    blockingReasons.push('Content is still pending or incomplete.');
  }

  if (hasRawEngineOrDebugText(allCustomerText)) {
    blockingReasons.push('Raw engine/debug text is present in customer-facing copy.');
  }

  if (model.cover.summary.trim() !== expectedRecommendationSummary.trim()) {
    blockingReasons.push('Recommendation identity does not match the current Insight output.');
  }

  if (model.pageEstimate.usedPages > maxCustomerPages) {
    warnings.push(
      `Customer page count overflow (${model.pageEstimate.usedPages}/${maxCustomerPages}).`,
    );
    blockingReasons.push(
      `Customer page count exceeds allowed limit (${model.pageEstimate.usedPages}/${maxCustomerPages}).`,
    );
  } else if (model.pageEstimate.usedPages === maxCustomerPages) {
    warnings.push(
      `Customer page count is at the limit (${model.pageEstimate.usedPages}/${maxCustomerPages}).`,
    );
  }

  const missingRequiredDiagrams = getMissingRequiredDiagrams(model, requiredDiagramSectionIds);
  if (missingRequiredDiagrams.length > 0) {
    blockingReasons.push(
      `Required diagrams are missing for: ${missingRequiredDiagrams.join(', ')}.`,
    );
  }

  if (!printSafeLayoutPass) {
    blockingReasons.push('Print-safe layout checks failed.');
  }

  if (!accessibilityBasicsPass) {
    blockingReasons.push('Accessibility baseline checks failed.');
  }

  if (!insightFallbackAvailable) {
    blockingReasons.push('Current Insight fallback path is unavailable.');
  }

  return {
    ready: blockingReasons.length === 0,
    blockingReasons,
    warnings,
  };
}
