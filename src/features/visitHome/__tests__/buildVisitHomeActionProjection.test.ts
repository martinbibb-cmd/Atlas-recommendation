import { describe, expect, it } from 'vitest';
import { buildVisitHomeActionProjection } from '../buildVisitHomeActionProjection';

const BASE_INPUT = {
  visitReadiness: {
    hasVisit: true,
    hasEngineData: true,
  },
  libraryProjectionSafety: {
    unsafe: false,
    reasons: [],
  },
  implementationReadiness: {
    installationSpecOptionCount: 1,
  },
  availableOutputs: {
    hasPortalUrl: true,
    hasInsightPack: true,
    hasHandoffReview: true,
    hasExportPackage: true,
  },
} as const;

describe('buildVisitHomeActionProjection', () => {
  it('returns surveyor actions for review, simulator, and follow-up only', () => {
    const projection = buildVisitHomeActionProjection({
      ...BASE_INPUT,
      workspaceRole: 'surveyor',
    });
    expect(projection.visibleActions.map((item) => item.actionId)).toEqual([
      'review-survey',
      'run-simulator',
      'resolve-follow-ups',
    ]);
  });

  it('returns office actions for customer journey, pdf, workflow, and export', () => {
    const projection = buildVisitHomeActionProjection({
      ...BASE_INPUT,
      workspaceRole: 'office',
    });
    expect(projection.visibleActions.map((item) => item.actionId)).toEqual([
      'review-survey',
      'supporting-pdf',
      'implementation-workflow',
      'export-handover-package',
    ]);
  });

  it('returns customer-preview actions and hides implementation internals', () => {
    const projection = buildVisitHomeActionProjection({
      ...BASE_INPUT,
      workspaceRole: 'customer-preview',
    });
    expect(projection.visibleActions.map((item) => item.actionId)).toEqual([
      'customer-portal',
      'supporting-pdf',
      'run-simulator',
    ]);
    expect(projection.hiddenActions.some((item) => item.actionId === 'implementation-workflow')).toBe(true);
  });

  it('adds blocked reason labels when readiness gates fail', () => {
    const projection = buildVisitHomeActionProjection({
      ...BASE_INPUT,
      workspaceRole: 'office',
      visitReadiness: {
        hasVisit: false,
        hasEngineData: false,
      },
    });
    const blockedExport = projection.blockedActions.find((item) => item.actionId === 'export-handover-package');
    expect(blockedExport?.reasonLabel).toBe('Export package unlocks after visit and survey readiness.');
  });
});
