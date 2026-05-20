import {
  DEFAULT_ATLAS_VISIT_JOURNEY_STATE,
  isAtlasVisitJourneyAtLeast,
  isAtlasVisitJourneyState,
  normaliseAtlasVisitJourneyState,
  transitionAtlasVisitJourney,
  type AtlasVisitJourneyEvent,
  type AtlasVisitJourneyState,
} from './atlasVisitJourney';

export type VisitReviewLifecycleState = AtlasVisitJourneyState;
export type VisitReviewLifecycleEvent = AtlasVisitJourneyEvent;
export { DEFAULT_ATLAS_VISIT_JOURNEY_STATE, transitionAtlasVisitJourney };

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

export function isLifecycleState(value: unknown): value is VisitReviewLifecycleState {
  return isAtlasVisitJourneyState(value);
}

export function normaliseVisitReviewLifecycleState(
  value: unknown,
): VisitReviewLifecycleState | undefined {
  return normaliseAtlasVisitJourneyState(value);
}

export function isLifecycleAtLeast(
  lifecycleState: VisitReviewLifecycleState,
  threshold: VisitReviewLifecycleState,
): boolean {
  return isAtlasVisitJourneyAtLeast(lifecycleState, threshold);
}

export function deriveLifecycleStateFromSnapshot(input: {
  readonly recommendationReady: boolean;
  readonly generatedOutputs?: Partial<GeneratedOutputsV1>;
}): VisitReviewLifecycleState {
  const outputs = normaliseGeneratedOutputs(input.generatedOutputs);
  if (outputs.handoff.generated) return 'handoff_ready';
  if (outputs.simulatorReview.generated || outputs.portal.generated || outputs.pdf.generated) {
    return 'presentation_ready';
  }
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
