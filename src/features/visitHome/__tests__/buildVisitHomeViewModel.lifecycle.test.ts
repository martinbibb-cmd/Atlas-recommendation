import { describe, expect, it } from 'vitest';
import { buildVisitHomeViewModel } from '../buildVisitHomeViewModel';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';

const ENGINE_OUTPUT = {
  recommendation: { primary: 'combi' },
} as EngineOutputV1;

describe('buildVisitHomeViewModel lifecycle authority', () => {
  it('keeps recommendation status non-ready when lifecycle is survey_in_progress', () => {
    const result = buildVisitHomeViewModel({
      engineResult: ENGINE_OUTPUT,
      lifecycleState: 'survey_in_progress',
      workflowReadiness: {
        hasVisit: true,
        libraryUnsafe: false,
        installationSpecOptionCount: 0,
      },
      outputAvailability: {
        hasPortalOutput: false,
        hasSupportingPdfOutput: false,
        hasHandoffReview: false,
        hasExportPackage: false,
      },
      simulatorAvailability: {
        hasSimulatorSurface: true,
      },
    });
    expect(result.recommendationStatus).toBe('needs-review');
    expect(result.portalStatus).toBe('blocked');
  });

  it('unlocks portal/pdf to needs-review at recommendation_ready lifecycle', () => {
    const result = buildVisitHomeViewModel({
      engineResult: ENGINE_OUTPUT,
      lifecycleState: 'recommendation_ready',
      workflowReadiness: {
        hasVisit: true,
        libraryUnsafe: false,
        installationSpecOptionCount: 0,
      },
      outputAvailability: {
        hasPortalOutput: false,
        hasSupportingPdfOutput: false,
        hasHandoffReview: false,
        hasExportPackage: false,
      },
      simulatorAvailability: {
        hasSimulatorSurface: true,
      },
    });
    expect(result.portalStatus).toBe('needs-review');
    expect(result.supportingPdfStatus).toBe('needs-review');
  });

  it('keeps handoff/export blocked at recommendation_ready lifecycle', () => {
    const result = buildVisitHomeViewModel({
      engineResult: ENGINE_OUTPUT,
      lifecycleState: 'recommendation_ready',
      workflowReadiness: {
        hasVisit: true,
        libraryUnsafe: false,
        installationSpecOptionCount: 0,
      },
      outputAvailability: {
        hasPortalOutput: false,
        hasSupportingPdfOutput: false,
        hasHandoffReview: true,
        hasExportPackage: true,
      },
      simulatorAvailability: {
        hasSimulatorSurface: true,
      },
    });
    expect(result.handoffStatus).toBe('blocked');
    expect(result.exportStatus).toBe('blocked');
  });

  it('presentation_ready without portal output still requires portal generation', () => {
    const result = buildVisitHomeViewModel({
      engineResult: ENGINE_OUTPUT,
      lifecycleState: 'presentation_ready',
      workflowReadiness: {
        hasVisit: true,
        libraryUnsafe: false,
        installationSpecOptionCount: 0,
      },
      outputAvailability: {
        hasPortalOutput: false,
        hasSupportingPdfOutput: true,
        hasHandoffReview: false,
        hasExportPackage: false,
      },
      simulatorAvailability: {
        hasSimulatorSurface: true,
      },
    });
    expect(result.portalStatus).toBe('needs-review');
  });

  it('does not treat journey as recommendation truth when envelope payload is missing', () => {
    const result = buildVisitHomeViewModel({
      engineResult: ENGINE_OUTPUT,
      lifecycleState: 'presentation_ready',
      visitEnvelope: {
        recommendation: {} as never,
      } as never,
      workflowReadiness: {
        hasVisit: true,
        libraryUnsafe: false,
        installationSpecOptionCount: 0,
      },
      outputAvailability: {
        hasPortalOutput: false,
        hasSupportingPdfOutput: false,
        hasHandoffReview: false,
        hasExportPackage: false,
      },
      simulatorAvailability: {
        hasSimulatorSurface: true,
      },
    });
    expect(result.recommendationStatus).toBe('needs-review');
    expect(result.portalStatus).toBe('blocked');
    expect(result.handoffStatus).toBe('blocked');
    expect(result.exportStatus).toBe('blocked');
  });
});
