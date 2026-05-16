import { describe, expect, it } from 'vitest';
import { buildVisitHomeActionProjection } from '../buildVisitHomeActionProjection';

const BASE_INPUT = {
  visitReadiness: {
    hasVisit: true,
    hasRecommendation: true,
    hasAcceptedScenario: true,
    hasSurveyModel: true,
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
    hasSupportingPdf: true,
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
        hasRecommendation: false,
        hasAcceptedScenario: false,
        hasSurveyModel: false,
      },
    });
    const blockedExport = projection.blockedActions.find((item) => item.actionId === 'export-handover-package');
    expect(blockedExport?.reasonLabel).toBe('Visit data missing');
  });

  it('marks simulator as ready when visit and engine data are present', () => {
    const projection = buildVisitHomeActionProjection({
      ...BASE_INPUT,
      workspaceRole: 'surveyor',
      visitReadiness: {
        hasVisit: true,
        hasRecommendation: true,
        hasAcceptedScenario: true,
        hasSurveyModel: true,
      },
    });
    const simulator = projection.visibleActions.find((item) => item.actionId === 'run-simulator');
    expect(simulator?.status).toBe('ready');
  });

  it('marks simulator as ready when recommendation and survey exist without accepted scenario', () => {
    const projection = buildVisitHomeActionProjection({
      ...BASE_INPUT,
      workspaceRole: 'surveyor',
      visitReadiness: {
        hasVisit: true,
        hasRecommendation: true,
        hasAcceptedScenario: false,
        hasSurveyModel: true,
      },
    });
    const simulator = projection.visibleActions.find((item) => item.actionId === 'run-simulator');
    expect(simulator?.status).toBe('ready');
  });

  it('marks export as needs-review when recommendation exists but no package has been generated', () => {
    const projection = buildVisitHomeActionProjection({
      ...BASE_INPUT,
      workspaceRole: 'office',
      availableOutputs: {
        ...BASE_INPUT.availableOutputs,
        hasExportPackage: false,
      },
    });
    const exportAction = projection.visibleActions.find((item) => item.actionId === 'export-handover-package');
    expect(exportAction?.status).toBe('needs-review');
  });

  it('marks missing supporting PDF output as needs-review instead of blocked', () => {
    const projection = buildVisitHomeActionProjection({
      ...BASE_INPUT,
      workspaceRole: 'office',
      availableOutputs: {
        ...BASE_INPUT.availableOutputs,
        hasSupportingPdf: false,
      },
    });
    const pdf = projection.visibleActions.find((item) => item.actionId === 'supporting-pdf');
    expect(pdf?.status).toBe('needs-review');
  });

  it('library unsafe blocks only customer portal and supporting PDF surfaces', () => {
    const projection = buildVisitHomeActionProjection({
      ...BASE_INPUT,
      workspaceRole: 'owner',
      libraryProjectionSafety: {
        unsafe: true,
        reasons: ['x'],
      },
    });
    const blockedIds = projection.blockedActions.map((item) => item.actionId);
    expect(blockedIds).toContain('customer-portal');
    expect(blockedIds).toContain('supporting-pdf');
    expect(blockedIds).not.toContain('run-simulator');
    expect(blockedIds).not.toContain('export-handover-package');
  });

  it('uses explicit blocked reason copy for library safety and missing data gates', () => {
    const libraryBlocked = buildVisitHomeActionProjection({
      ...BASE_INPUT,
      workspaceRole: 'viewer',
      libraryProjectionSafety: {
        unsafe: true,
        reasons: ['legacy reason'],
      },
    });
    const portalBlocked = libraryBlocked.blockedActions.find((item) => item.actionId === 'customer-portal');
    expect(portalBlocked?.reasonLabel).toBe('Library safety needs review');

    const recommendationBlocked = buildVisitHomeActionProjection({
      ...BASE_INPUT,
      workspaceRole: 'surveyor',
      visitReadiness: {
        hasVisit: true,
        hasRecommendation: false,
        hasAcceptedScenario: false,
        hasSurveyModel: false,
      },
    });
    const simulatorBlocked = recommendationBlocked.blockedActions.find((item) => item.actionId === 'run-simulator');
    expect(simulatorBlocked?.reasonLabel).toBe('Recommendation not available');
  });
});
