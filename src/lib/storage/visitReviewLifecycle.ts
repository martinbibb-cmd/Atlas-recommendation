export type VisitReviewLifecycleState =
  | 'survey_in_progress'
  | 'recommendation_ready'
  | 'outputs_generated'
  | 'review_in_progress'
  | 'handover_ready';

export type GeneratedOutputRendererV1 = 'library_customer_portal' | 'legacy_dev_only';
export const CANONICAL_PORTAL_RENDERER: GeneratedOutputRendererV1 = 'library_customer_portal';

export interface GeneratedOutputArtifactV1 {
  readonly generated: boolean;
  readonly generatedAt?: string;
  readonly url?: string;
  readonly version?: string;
  readonly documentId?: string;
  /** Which renderer this artifact targets. Canonical portal artifacts must use 'library_customer_portal'. */
  readonly renderer?: GeneratedOutputRendererV1;
}

export interface GeneratedOutputsV1 {
  readonly portal: GeneratedOutputArtifactV1;
  readonly pdf: GeneratedOutputArtifactV1;
  readonly simulatorReview: GeneratedOutputArtifactV1;
  readonly handoff: GeneratedOutputArtifactV1;
}

function createEmptyOutputArtifact(): GeneratedOutputArtifactV1 {
  return { generated: false };
}

export function buildGeneratedPortalArtifact(input: {
  readonly generatedAt: string;
  readonly url: string;
  readonly version?: string;
}): GeneratedOutputArtifactV1 {
  return {
    generated: true,
    generatedAt: input.generatedAt,
    url: input.url,
    version: input.version ?? '1.0',
    renderer: CANONICAL_PORTAL_RENDERER,
  };
}

export function createEmptyGeneratedOutputs(): GeneratedOutputsV1 {
  return {
    portal: createEmptyOutputArtifact(),
    pdf: createEmptyOutputArtifact(),
    simulatorReview: createEmptyOutputArtifact(),
    handoff: createEmptyOutputArtifact(),
  };
}

export function normaliseGeneratedOutputs(
  outputs: Partial<GeneratedOutputsV1> | undefined,
): GeneratedOutputsV1 {
  const base = createEmptyGeneratedOutputs();
  if (outputs == null) return base;
  return {
    portal: outputs.portal ?? base.portal,
    pdf: outputs.pdf ?? base.pdf,
    simulatorReview: outputs.simulatorReview ?? base.simulatorReview,
    handoff: outputs.handoff ?? base.handoff,
  };
}

export function withGeneratedPortalOutput(
  outputs: Partial<GeneratedOutputsV1> | undefined,
  portal: {
    readonly generatedAt: string;
    readonly url: string;
    readonly version?: string;
  },
): GeneratedOutputsV1 {
  return {
    ...normaliseGeneratedOutputs(outputs),
    portal: buildGeneratedPortalArtifact(portal),
  };
}

const LIFECYCLE_ORDER: readonly VisitReviewLifecycleState[] = [
  'survey_in_progress',
  'recommendation_ready',
  'outputs_generated',
  'review_in_progress',
  'handover_ready',
];

export function isLifecycleState(value: unknown): value is VisitReviewLifecycleState {
  return (
    typeof value === 'string' &&
    LIFECYCLE_ORDER.includes(value as VisitReviewLifecycleState)
  );
}

export function isLifecycleAtLeast(
  lifecycleState: VisitReviewLifecycleState,
  threshold: VisitReviewLifecycleState,
): boolean {
  return LIFECYCLE_ORDER.indexOf(lifecycleState) >= LIFECYCLE_ORDER.indexOf(threshold);
}

export function deriveLifecycleStateFromSnapshot(input: {
  readonly recommendationReady: boolean;
  readonly generatedOutputs?: Partial<GeneratedOutputsV1>;
}): VisitReviewLifecycleState {
  const outputs = normaliseGeneratedOutputs(input.generatedOutputs);
  if (outputs.handoff.generated) return 'handover_ready';
  if (outputs.simulatorReview.generated) return 'review_in_progress';
  if (outputs.portal.generated || outputs.pdf.generated) return 'outputs_generated';
  if (input.recommendationReady) return 'recommendation_ready';
  return 'survey_in_progress';
}

export function isRecommendationReadyForLifecycle(input: {
  readonly decision?: unknown;
  readonly customerSummary?: unknown;
  readonly acceptedScenarioId?: string;
  readonly engineRecommendationPrimary?: string;
}): boolean {
  return (
    input.decision != null ||
    input.customerSummary != null ||
    input.acceptedScenarioId != null ||
    input.engineRecommendationPrimary != null
  );
}
