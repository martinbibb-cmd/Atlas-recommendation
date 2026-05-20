import { describe, it, expect } from 'vitest';
import {
  CANONICAL_PORTAL_RENDERER,
  buildGeneratedPortalArtifact,
  createEmptyGeneratedOutputs,
  projectVisitReadiness,
  withGeneratedPortalOutput,
} from '../visitReviewLifecycle';

describe('visitReviewLifecycle', () => {
  it('buildGeneratedPortalArtifact uses the canonical customer portal renderer', () => {
    const artifact = buildGeneratedPortalArtifact({
      generatedAt: '2026-05-17T10:00:00.000Z',
      url: 'https://atlas.test/portal/demo?token=signed-token',
    });

    expect(artifact.generated).toBe(true);
    expect(artifact.renderer).toBe(CANONICAL_PORTAL_RENDERER);
    expect(artifact.renderer).not.toBe('legacy_dev_only');
  });

  it('withGeneratedPortalOutput preserves existing outputs while marking the portal generated', () => {
    const outputs = withGeneratedPortalOutput(
      {
        ...createEmptyGeneratedOutputs(),
        pdf: {
          generated: true,
          generatedAt: '2026-05-17T10:00:00.000Z',
          documentId: 'pdf-123',
          version: '1.0',
        },
      },
      {
        generatedAt: '2026-05-17T11:00:00.000Z',
        url: 'https://atlas.test/portal/demo?token=signed-token',
      },
    );

    expect(outputs.portal.generated).toBe(true);
    expect(outputs.portal.renderer).toBe(CANONICAL_PORTAL_RENDERER);
    expect(outputs.portal.url).toContain('/portal/demo?token=');
    expect(outputs.pdf.generated).toBe(true);
    expect(outputs.pdf.documentId).toBe('pdf-123');
  });

  it('presentation_ready without portal output keeps portal generation required', () => {
    const projection = projectVisitReadiness(
      {
        recommendation: {} as never,
        topology: { topologyId: 'combi' },
      },
      createEmptyGeneratedOutputs(),
      'presentation_ready',
    );

    expect(projection.presentationSurfacesUnlocked).toBe(true);
    expect(projection.portalOutputAvailable).toBe(false);
  });

  it('recommendation_ready does not unlock delivery surfaces', () => {
    const projection = projectVisitReadiness(
      {
        recommendation: {} as never,
        topology: { topologyId: 'combi' },
      },
      createEmptyGeneratedOutputs(),
      'recommendation_ready',
    );

    expect(projection.deliverySurfacesUnlocked).toBe(false);
    expect(projection.exportOutputAvailable).toBe(false);
  });

  it('legacy-normalised presentation_ready preserves generated output semantics', () => {
    const projection = projectVisitReadiness(
      {
        recommendation: {} as never,
        topology: { topologyId: 'combi' },
      },
      {
        ...createEmptyGeneratedOutputs(),
        portal: { generated: true },
        pdf: { generated: true },
      },
      'presentation_ready',
    );

    expect(projection.portalOutputAvailable).toBe(true);
    expect(projection.supportingPdfOutputAvailable).toBe(true);
  });

  it('journey state cannot override missing envelope recommendation/topology payloads', () => {
    const missingRecommendationProjection = projectVisitReadiness(
      {
        topology: { topologyId: 'combi' },
      } as never,
      createEmptyGeneratedOutputs(),
      'presentation_ready',
    );
    const missingTopologyProjection = projectVisitReadiness(
      {
        recommendation: {} as never,
      } as never,
      createEmptyGeneratedOutputs(),
      'presentation_ready',
    );

    expect(missingRecommendationProjection.recommendationReady).toBe(false);
    expect(missingRecommendationProjection.presentationSurfacesUnlocked).toBe(false);
    expect(missingTopologyProjection.recommendationReady).toBe(false);
    expect(missingTopologyProjection.presentationSurfacesUnlocked).toBe(false);
  });
});
