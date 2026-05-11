import type { PortalJourneyPrintModelV1, PortalJourneyPrintSectionV1 } from './buildPortalJourneyPrintModel';

export interface SupportingPdfReadinessInput {
  model: PortalJourneyPrintModelV1;
  expectedRecommendationSummary: string;
  maxCustomerPages?: number;
  requiredDiagramSectionIds?: PortalJourneyPrintSectionV1['sectionId'][];
  requiredDiagramRendererIds?: string[];
  availableDiagramRendererIds?: string[];
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
    ...(section.diagramCaption ? [section.diagramCaption] : []),
    ...section.items,
  ]);

  const nextStepText = model.nextSteps.flatMap((step) => [step.label, step.body]);
  const qrText = model.qrDestinations.flatMap((dest) => [dest.heading, dest.note]);

  return [...coverText, ...sectionText, ...nextStepText, ...qrText].map((line) => line.trim());
}

function hasPendingContent(lines: string[]): boolean {
  return lines.some((line) =>
    PENDING_CONTENT_PATTERNS.some((pattern) => pattern.test(line)));
}

function hasMissingRequiredContent(model: PortalJourneyPrintModelV1): boolean {
  if (
    model.cover.title.trim().length === 0
    || model.cover.summary.trim().length === 0
  ) {
    return true;
  }

  for (const section of model.sections) {
    if (
      section.heading.trim().length === 0
      || section.summary.trim().length === 0
      || section.keyTakeaway.trim().length === 0
      || section.reassurance.trim().length === 0
      || section.items.length === 0
    ) {
      return true;
    }

    if (section.items.some((item) => item.trim().length === 0)) {
      return true;
    }
  }

  if (model.nextSteps.length === 0 || model.qrDestinations.length === 0) {
    return true;
  }

  if (model.nextSteps.some((step) => step.label.trim().length === 0 || step.body.trim().length === 0)) {
    return true;
  }

  if (model.qrDestinations.some((dest) => dest.heading.trim().length === 0 || dest.note.trim().length === 0)) {
    return true;
  }

  return false;
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
    requiredDiagramRendererIds = [],
    availableDiagramRendererIds,
    printSafeLayoutPass,
    accessibilityBasicsPass,
    insightFallbackAvailable,
  } = input;

  const blockingReasons: string[] = [];
  const warnings: string[] = [];
  const allCustomerText = collectCustomerFacingText(model);

  if (hasPendingContent(allCustomerText) || hasMissingRequiredContent(model)) {
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

  const diagramRendererIdSet = new Set(
    model.sections
      .map((section) => section.diagramRendererId)
      .filter((diagramRendererId): diagramRendererId is string =>
        typeof diagramRendererId === 'string' && diagramRendererId.trim().length > 0),
  );

  for (const requiredDiagramRendererId of requiredDiagramRendererIds) {
    const isAvailable =
      availableDiagramRendererIds == null
      || availableDiagramRendererIds.includes(requiredDiagramRendererId);
    if (!isAvailable) {
      warnings.push(`Required diagram is not currently available in renderer: ${requiredDiagramRendererId}.`);
      continue;
    }
    if (!diagramRendererIdSet.has(requiredDiagramRendererId)) {
      blockingReasons.push(`Required diagram is missing: ${requiredDiagramRendererId}.`);
    }
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
