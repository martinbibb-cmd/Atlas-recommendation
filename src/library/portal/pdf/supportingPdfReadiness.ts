import type { PortalJourneyPrintModelV1, PortalJourneyPrintSectionV1 } from './buildPortalJourneyPrintModel';
import type { LibraryProjectionSafetyV1 } from '../../projections/qa/LibraryProjectionSafetyV1';

export interface SupportingPdfReadinessInput {
  model: PortalJourneyPrintModelV1;
  expectedRecommendationSummary: string;
  reviewRecommendationId?: string;
  exportRecommendationId?: string;
  snapshotChecksum?: string;
  maxCustomerPages?: number;
  requiredDiagramSectionIds?: PortalJourneyPrintSectionV1['sectionId'][];
  requiredDiagramRendererIds?: string[];
  availableDiagramRendererIds?: string[];
  printSafeLayoutPass: boolean;
  accessibilityBasicsPass: boolean;
  insightFallbackAvailable: boolean;
  /**
   * Optional customer projection safety result from assessLibraryProjectionSafety.
   * When present and safeForCustomer is false, the PDF is blocked with the
   * exact leakage reasons from the projection assessment.
   */
  customerProjectionSafety?: LibraryProjectionSafetyV1;
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

const INTERNAL_PIPELINE_WORDING_PATTERNS = [
  /\bcognitive load\b/i,
  /\bdense technical\b/i,
  /\bspacing\b/i,
  /\bcomprehension\b/i,
  /\bbreather page\b/i,
  /\brouted evidence\b/i,
  /\broute\b/i,
  /\bstory scene\b/i,
  /\bcomposition\b/i,
  /\barchetype\b/i,
  /\bprojection\b/i,
  /\btaxonomy\b/i,
] as const;

function collectCustomerFacingText(model: PortalJourneyPrintModelV1): string[] {
  const coverText = [
    model.cover.title,
    model.cover.summary,
    ...model.cover.customerFacts,
  ];

  const sectionText = model.sections.flatMap((section) => [
    ...(section.storyScene != null
      ? [
        section.storyScene.title,
        section.storyScene.customerTakeaway,
        section.storyScene.whyItMatters,
        section.storyScene.whatYouWillNotice,
      ]
      : [
        section.heading,
        section.summary,
        section.keyTakeaway,
        ...section.items,
      ]),
    section.reassurance,
    ...(section.diagramCaption ? [section.diagramCaption] : []),
  ]);
  const recommendationReasonText = model.recommendationReasons.flatMap((reason) => [
    reason.homeFact,
    reason.whyItMatters,
    reason.atlasRecommendationOutcome,
    reason.practicalEffect,
    ...(reason.detail ? [reason.detail] : []),
  ]);

  const nextStepText = model.nextSteps.flatMap((step) => [step.label, step.body]);
  const qrText = model.qrDestinations.flatMap((dest) => [dest.heading, dest.note]);

  return [...coverText, ...recommendationReasonText, ...sectionText, ...nextStepText, ...qrText].map((line) => line.trim());
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
    if (section.evidenceTags == null || section.evidenceTags.length === 0) {
      return true;
    }
  }

  if (model.recommendationReasons.some((reason) => reason.evidenceTags == null || reason.evidenceTags.length === 0)) {
    return true;
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

function findInternalPipelineLeakTerms(lines: string[]): string[] {
  const matches = new Set<string>();
  for (const line of lines) {
    for (const pattern of INTERNAL_PIPELINE_WORDING_PATTERNS) {
      const match = line.match(pattern);
      if (match?.[0]) matches.add(match[0].toLowerCase());
    }
  }
  return [...matches];
}

function collectRenderedSceneText(model: PortalJourneyPrintModelV1): string[] {
  return model.sections.flatMap((section) => {
    const scene = section.storyScene;
    if (scene == null) {
      return [section.heading, section.summary, section.keyTakeaway, section.reassurance, ...section.items];
    }
    return [
      scene.title,
      scene.customerTakeaway,
      scene.whyItMatters,
      scene.whatYouWillNotice,
    ];
  });
}

function hasStoredHotWaterClaims(lines: string[]): boolean {
  return lines.some((line) => {
    const lower = line.toLowerCase();
    if (/\bno stored\b/.test(lower) || /\bno cylinder\b/.test(lower)) return false;
    return /(stored hot water|hot water cylinder|unvented cylinder|vented cylinder)/.test(lower);
  });
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
    reviewRecommendationId,
    exportRecommendationId,
    snapshotChecksum,
    maxCustomerPages = model.pageEstimate.maxPages,
    requiredDiagramSectionIds = [],
    requiredDiagramRendererIds = [],
    availableDiagramRendererIds,
    printSafeLayoutPass,
    accessibilityBasicsPass,
    insightFallbackAvailable,
    customerProjectionSafety,
  } = input;

  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  // ── Projection safety gate ─────────────────────────────────────────────────
  if (customerProjectionSafety != null && !customerProjectionSafety.safeForCustomer) {
    for (const reason of customerProjectionSafety.blockingReasons) {
      blockingReasons.push(`Projection safety: ${reason}`);
    }
  }
  const allCustomerText = collectCustomerFacingText(model);

  if (hasPendingContent(allCustomerText) || hasMissingRequiredContent(model)) {
    blockingReasons.push('Content is still pending, incomplete, or lacks evidence backing.');
  }

  if (hasRawEngineOrDebugText(allCustomerText)) {
    blockingReasons.push('Raw engine/debug text is present in customer-facing copy.');
  }
  const leakedInternalTerms = findInternalPipelineLeakTerms(collectRenderedSceneText(model));
  if (leakedInternalTerms.length > 0) {
    blockingReasons.push(`Internal design/pipeline wording leaked into rendered customer copy: ${leakedInternalTerms.join(', ')}.`);
  }

  if (model.cover.summary.trim() !== expectedRecommendationSummary.trim()) {
    blockingReasons.push('Recommendation identity does not match the current Insight output.');
  }
  const summaryLower = expectedRecommendationSummary.trim().toLowerCase();
  if (summaryLower.includes('combi') && hasStoredHotWaterClaims(allCustomerText)) {
    const detail = [
      'Customer pack recommendation mismatch: combi recommendation cannot render stored-hot-water practical outcomes.',
      reviewRecommendationId ? `review recommendation id=${reviewRecommendationId}` : undefined,
      exportRecommendationId ? `export recommendation id=${exportRecommendationId}` : undefined,
      snapshotChecksum ? `snapshot checksum=${snapshotChecksum}` : undefined,
    ]
      .filter(Boolean)
      .join(' ');
    blockingReasons.push(detail);
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

  if ((model.contentSource?.storySceneValidation.compositionErrorCount ?? 0) > 0) {
    blockingReasons.push('Composition contract validation failed for one or more story scenes.');
  }
  if ((model.contentSource?.sceneDiagnostics ?? []).some((diag) => diag.blockingReasons.length > 0)) {
    blockingReasons.push('One or more scene visuals are unresolved for PDF rendering.');
  }
  const routeCompletenessAudit = model.contentSource?.routeCompletenessAudit;
  if (routeCompletenessAudit != null && !routeCompletenessAudit.ready) {
    blockingReasons.push(
      `Route completeness failed for ${routeCompletenessAudit.routeId}: missing=${routeCompletenessAudit.missingRequirementIds.join(', ') || 'none'} blocked=${routeCompletenessAudit.blockedRequirementIds.join(', ') || 'none'} generic=${routeCompletenessAudit.genericFallbackRequirementIds.join(', ') || 'none'}.`,
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
      .filter((diagramRendererId): diagramRendererId is string => Boolean(diagramRendererId)),
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
