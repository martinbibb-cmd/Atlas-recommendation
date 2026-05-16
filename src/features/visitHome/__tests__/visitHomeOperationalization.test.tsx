/**
 * visitHomeOperationalization.test.tsx
 *
 * Tests for the operationalized Visit Home lifecycle:
 *   - import → recommendation available
 *   - accepted scenario hydrates Visit Home (simulator/portal/pdf available)
 *   - simulator available after hydration (not blocked)
 *   - portal/pdf move to needs-review instead of blocked when accepted scenario present
 *   - hydration banner shows correct state
 *   - empty state with import/open/demo CTAs shown when no visit loaded
 *   - local visit controls shown when handlers are provided
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisitHomeDashboard } from '../VisitHomeDashboard';
import { buildVisitHomeActionProjection } from '../buildVisitHomeActionProjection';
import { parseWorkflowPackageJson } from '../importVisitWorkflowPackage';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';
import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ENGINE_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  heatLossWatts: 8000,
  bathroomCount: 1,
  occupancyCount: 3,
  dynamicMainsPressure: 2.0,
  mainsDynamicFlowLpm: 14,
};

const ENGINE_OUTPUT: Partial<EngineOutputV1> = {
  recommendation: { primary: 'combi' },
  eligibility: [],
  redFlags: [],
  explainers: [],
};

const ACCEPTED_SCENARIO: ScenarioResult = {
  scenarioId: 'combi',
  system: { type: 'combi', summary: 'Combi boiler' },
  performance: { hotWater: 'good', heating: 'good', efficiency: 'good', reliability: 'good' },
  physicsFlags: {},
  displayIdentity: { label: 'Combi', tagline: '' },
  benefits: [],
  constraints: [],
  outcomes: [],
  requiredWorks: [],
  upgradePaths: [],
};

const RECOMMENDATION_SUMMARY: CustomerSummaryV1 = {
  recommendedScenarioId: 'combi',
  recommendedSystemLabel: 'Combi boiler',
  headline: 'Combi boiler is the right fit.',
  plainEnglishDecision: 'Decision text.',
  whyThisWins: [],
  whatThisAvoids: [],
  includedNow: [],
  requiredChecks: [],
  optionalUpgrades: [],
  futureReady: [],
  confidenceNotes: [],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative: '',
};

function makeProps(
  overrides: Partial<React.ComponentProps<typeof VisitHomeDashboard>> = {},
) {
  return {
    visitId: 'visit-abc123',
    engineInput: ENGINE_INPUT,
    engineOutput: ENGINE_OUTPUT as EngineOutputV1,
    scenarios: [ACCEPTED_SCENARIO],
    acceptedScenario: ACCEPTED_SCENARIO,
    recommendationSummary: RECOMMENDATION_SUMMARY,
    surveyModel: ENGINE_INPUT as FullSurveyModelV1,
    workspaceRole: 'admin',
    onOpenSimulator: vi.fn(),
    onOpenPresentation: vi.fn(),
    onPrintSummary: vi.fn(),
    onOpenInstallationSpecification: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  } as const;
}

// ─── Operational gating: accepted scenario unlocks simulator/portal/pdf ───────

describe('operational gating — accepted scenario presence', () => {
  it('simulator is not blocked when visit and accepted scenario exist (even without full survey model)', () => {
    const projection = buildVisitHomeActionProjection({
      visitReadiness: {
        hasVisit: true,
        hasRecommendation: false,
        hasAcceptedScenario: true,
        hasSurveyModel: false,
      },
      libraryProjectionSafety: { unsafe: false },
      implementationReadiness: { installationSpecOptionCount: 0 },
      availableOutputs: {
        hasPortalUrl: false,
        hasSupportingPdf: false,
        hasHandoffReview: false,
        hasExportPackage: false,
      },
    });
    const simulatorAction = projection.visibleActions.find((a) => a.actionId === 'run-simulator');
    expect(simulatorAction?.status).not.toBe('blocked');
    expect(simulatorAction?.status).toBe('needs-review');
  });

  it('simulator is ready when visit, accepted scenario, and survey model all present', () => {
    const projection = buildVisitHomeActionProjection({
      visitReadiness: {
        hasVisit: true,
        hasRecommendation: true,
        hasAcceptedScenario: true,
        hasSurveyModel: true,
      },
      libraryProjectionSafety: { unsafe: false },
      implementationReadiness: { installationSpecOptionCount: 0 },
      availableOutputs: {
        hasPortalUrl: false,
        hasSupportingPdf: false,
        hasHandoffReview: false,
        hasExportPackage: false,
      },
    });
    const simulatorAction = projection.visibleActions.find((a) => a.actionId === 'run-simulator');
    expect(simulatorAction?.status).toBe('ready');
  });

  it('portal is needs-review (not blocked) when visit and accepted scenario exist', () => {
    const projection = buildVisitHomeActionProjection({
      workspaceRole: 'owner',
      visitReadiness: {
        hasVisit: true,
        hasRecommendation: false,
        hasAcceptedScenario: true,
        hasSurveyModel: true,
      },
      libraryProjectionSafety: { unsafe: false },
      implementationReadiness: { installationSpecOptionCount: 0 },
      availableOutputs: {
        hasPortalUrl: false,
        hasSupportingPdf: false,
        hasHandoffReview: false,
        hasExportPackage: false,
      },
    });
    const portalAction = projection.visibleActions.find((a) => a.actionId === 'customer-portal');
    expect(portalAction?.status).toBe('needs-review');
    expect(portalAction?.status).not.toBe('blocked');
  });

  it('pdf is needs-review (not blocked) when visit and accepted scenario exist', () => {
    const projection = buildVisitHomeActionProjection({
      workspaceRole: 'owner',
      visitReadiness: {
        hasVisit: true,
        hasRecommendation: false,
        hasAcceptedScenario: true,
        hasSurveyModel: true,
      },
      libraryProjectionSafety: { unsafe: false },
      implementationReadiness: { installationSpecOptionCount: 0 },
      availableOutputs: {
        hasPortalUrl: false,
        hasSupportingPdf: false,
        hasHandoffReview: false,
        hasExportPackage: false,
      },
    });
    const pdfAction = projection.visibleActions.find((a) => a.actionId === 'supporting-pdf');
    expect(pdfAction?.status).toBe('needs-review');
    expect(pdfAction?.status).not.toBe('blocked');
  });

  it('simulator is still blocked when no visit, no recommendation, and no accepted scenario', () => {
    const projection = buildVisitHomeActionProjection({
      workspaceRole: 'owner',
      visitReadiness: {
        hasVisit: true,
        hasRecommendation: false,
        hasAcceptedScenario: false,
        hasSurveyModel: false,
      },
      libraryProjectionSafety: { unsafe: false },
      implementationReadiness: { installationSpecOptionCount: 0 },
      availableOutputs: {
        hasPortalUrl: false,
        hasSupportingPdf: false,
        hasHandoffReview: false,
        hasExportPackage: false,
      },
    });
    const simulatorAction = projection.visibleActions.find((a) => a.actionId === 'run-simulator');
    expect(simulatorAction?.status).toBe('blocked');
  });
});

// ─── Visit Home Dashboard — hydration banner ─────────────────────────────────

describe('VisitHomeDashboard hydration banner', () => {
  it('shows no-visit state when no visitId is provided', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({ visitId: undefined, engineOutput: undefined, acceptedScenario: undefined, scenarios: [] })}
      />,
    );
    const banner = screen.getByTestId('visit-home-hydration-banner');
    expect(banner).toHaveAttribute('data-hydration-state', 'no-visit');
  });

  it('shows survey-in-progress state when visitId set but no recommendation', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          engineOutput: undefined,
          acceptedScenario: undefined,
          recommendationSummary: undefined,
          scenarios: [],
          surveyModel: undefined,
        })}
      />,
    );
    const banner = screen.getByTestId('visit-home-hydration-banner');
    expect(banner).toHaveAttribute('data-hydration-state', 'survey-in-progress');
  });

  it('shows recommendation-ready when engine output exists but no accepted scenario + survey model pair', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          acceptedScenario: ACCEPTED_SCENARIO,
          surveyModel: undefined,
        })}
      />,
    );
    const banner = screen.getByTestId('visit-home-hydration-banner');
    expect(banner).toHaveAttribute('data-hydration-state', 'recommendation-ready');
  });

  it('shows review-in-progress when accepted scenario and survey model are both present', () => {
    render(<VisitHomeDashboard {...makeProps()} />);
    const banner = screen.getByTestId('visit-home-hydration-banner');
    expect(banner).toHaveAttribute('data-hydration-state', 'review-in-progress');
  });

  it('shows handover-ready when handoff output is available', () => {
    render(<VisitHomeDashboard {...makeProps({ onOpenHandoffReview: vi.fn() })} />);
    const banner = screen.getByTestId('visit-home-hydration-banner');
    expect(banner).toHaveAttribute('data-hydration-state', 'handover-ready');
  });
});

// ─── Visit Home Dashboard — empty state when no visit ─────────────────────────

describe('VisitHomeDashboard empty state', () => {
  it('shows empty state panel when no visitId is provided', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          visitId: undefined,
          engineOutput: undefined,
          acceptedScenario: undefined,
          scenarios: [],
          onImportScanPackage: vi.fn(),
          onOpenExistingVisit: vi.fn(),
          onStartDemoReview: vi.fn(),
        })}
      />,
    );
    expect(screen.getByTestId('visit-home-empty-state')).toBeInTheDocument();
  });

  it('does not show empty state when a visitId is present', () => {
    render(<VisitHomeDashboard {...makeProps()} />);
    expect(screen.queryByTestId('visit-home-empty-state')).not.toBeInTheDocument();
  });

  it('import scan CTA calls onImportScanPackage', () => {
    const onImportScanPackage = vi.fn();
    render(
      <VisitHomeDashboard
        {...makeProps({
          visitId: undefined,
          engineOutput: undefined,
          acceptedScenario: undefined,
          scenarios: [],
          onImportScanPackage,
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('visit-home-import-scan-cta'));
    expect(onImportScanPackage).toHaveBeenCalledOnce();
  });

  it('open existing visit CTA calls onOpenExistingVisit', () => {
    const onOpenExistingVisit = vi.fn();
    render(
      <VisitHomeDashboard
        {...makeProps({
          visitId: undefined,
          engineOutput: undefined,
          acceptedScenario: undefined,
          scenarios: [],
          onOpenExistingVisit,
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('visit-home-open-existing-cta'));
    expect(onOpenExistingVisit).toHaveBeenCalledOnce();
  });

  it('start demo CTA calls onStartDemoReview', () => {
    const onStartDemoReview = vi.fn();
    render(
      <VisitHomeDashboard
        {...makeProps({
          visitId: undefined,
          engineOutput: undefined,
          acceptedScenario: undefined,
          scenarios: [],
          onStartDemoReview,
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('visit-home-start-demo-cta'));
    expect(onStartDemoReview).toHaveBeenCalledOnce();
  });

  it('shows continue-survey and run-recommendation CTAs when survey is in progress', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          engineOutput: undefined,
          acceptedScenario: undefined,
          recommendationSummary: undefined,
          scenarios: [],
          surveyModel: undefined,
          onContinueSurvey: vi.fn(),
          onRunRecommendation: vi.fn(),
        })}
      />,
    );
    expect(screen.getByTestId('visit-home-continue-survey-cta')).toBeInTheDocument();
    expect(screen.getByTestId('visit-home-run-recommendation-cta')).toBeInTheDocument();
  });

  it('run recommendation CTA calls onRunRecommendation', () => {
    const onRunRecommendation = vi.fn();
    render(
      <VisitHomeDashboard
        {...makeProps({
          engineOutput: undefined,
          acceptedScenario: undefined,
          recommendationSummary: undefined,
          scenarios: [],
          surveyModel: undefined,
          onRunRecommendation,
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('visit-home-run-recommendation-cta'));
    expect(onRunRecommendation).toHaveBeenCalledOnce();
  });

  it('existing visit selector opens chosen visit session', () => {
    const onSelectVisit = vi.fn();
    render(
      <VisitHomeDashboard
        {...makeProps({
          visitId: undefined,
          engineOutput: undefined,
          acceptedScenario: undefined,
          scenarios: [],
          visitSelectorEntries: [
            { visitId: 'atlas_visit_local_1', label: 'Saved visit LOCAL001', source: 'local' },
            { visitId: 'demo_visit_001', label: 'Demo fixture 00000001', source: 'demo' },
          ],
          onSelectVisit,
        })}
      />,
    );
    fireEvent.click(screen.getByTestId('visit-home-selector-local-atlas_visit_local_1'));
    expect(onSelectVisit).toHaveBeenCalledWith('atlas_visit_local_1');
  });

  it('hides delivery / handover rail section when no delivery actions are visible', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          workspaceRole: 'viewer',
          workspacePermissions: ['view_visits'],
        })}
      />,
    );
    expect(screen.queryByTestId('visit-home-section-delivery-handover')).not.toBeInTheDocument();
  });
});

// ─── Visit Home Dashboard — local visit controls ──────────────────────────────

describe('VisitHomeDashboard local visit controls', () => {
  it('shows local controls panel when onSaveLocally is provided', () => {
    render(<VisitHomeDashboard {...makeProps({ onSaveLocally: vi.fn() })} />);
    expect(screen.getByTestId('visit-home-local-controls')).toBeInTheDocument();
  });

  it('shows local controls panel when onClearSession is provided', () => {
    render(<VisitHomeDashboard {...makeProps({ onClearSession: vi.fn() })} />);
    expect(screen.getByTestId('visit-home-local-controls')).toBeInTheDocument();
  });

  it('does not show local controls panel when no lifecycle handlers are provided', () => {
    render(<VisitHomeDashboard {...makeProps()} />);
    expect(screen.queryByTestId('visit-home-local-controls')).not.toBeInTheDocument();
  });

  it('save locally CTA calls onSaveLocally', () => {
    const onSaveLocally = vi.fn();
    render(<VisitHomeDashboard {...makeProps({ onSaveLocally })} />);
    fireEvent.click(screen.getByTestId('visit-home-save-locally'));
    expect(onSaveLocally).toHaveBeenCalledOnce();
  });

  it('resume saved visit CTA is shown and calls onResumeLocalVisit when hasSavedLocalVisit is true', () => {
    const onResumeLocalVisit = vi.fn();
    render(
      <VisitHomeDashboard
        {...makeProps({ hasSavedLocalVisit: true, onResumeLocalVisit, onSaveLocally: vi.fn() })}
      />,
    );
    fireEvent.click(screen.getByTestId('visit-home-resume-local'));
    expect(onResumeLocalVisit).toHaveBeenCalledOnce();
  });

  it('resume saved visit CTA is hidden when hasSavedLocalVisit is false', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({ hasSavedLocalVisit: false, onResumeLocalVisit: vi.fn(), onSaveLocally: vi.fn() })}
      />,
    );
    expect(screen.queryByTestId('visit-home-resume-local')).not.toBeInTheDocument();
  });

  it('clear session CTA calls onClearSession', () => {
    const onClearSession = vi.fn();
    render(<VisitHomeDashboard {...makeProps({ onClearSession })} />);
    fireEvent.click(screen.getByTestId('visit-home-clear-session'));
    expect(onClearSession).toHaveBeenCalledOnce();
  });

  it('scan import CTA in right rail calls onImportScanPackage', () => {
    const onImportScanPackage = vi.fn();
    render(<VisitHomeDashboard {...makeProps({ onImportScanPackage })} />);
    fireEvent.click(screen.getByTestId('visit-home-scan-import-cta'));
    expect(onImportScanPackage).toHaveBeenCalledOnce();
  });
});

// ─── Import workflow package → recommendation available ───────────────────────

describe('import workflow package → accepted scenario hydrates dashboard', () => {
  it('parseWorkflowPackageJson returns imported for a valid export package', () => {
    const exportPkg = {
      visitId: 'visit-xyz99',
      visitReference: 'XYZ99',
      exportedAt: '2025-01-15T10:00:00.000Z',
      engineInput: ENGINE_INPUT,
      surveyModel: ENGINE_INPUT,
    };
    const result = parseWorkflowPackageJson(exportPkg);
    expect(result.status).toBe('imported');
    if (result.status !== 'imported') return;
    expect(result.visitId).toBe('visit-xyz99');
    expect(result.engineInput).toBeDefined();
    expect(result.surveyModel).toBeDefined();
  });

  it('simulator card status is not blocked after accepted scenario is hydrated', () => {
    render(<VisitHomeDashboard {...makeProps()} />);
    const simulatorCard = screen.getByTestId('card-simulator');
    expect(simulatorCard).not.toHaveAttribute('data-status', 'blocked');
  });

  it('portal card moves from blocked to needs-review when accepted scenario is available without portal URL', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          portalUrl: undefined,
        })}
      />,
    );
    expect(screen.getByTestId('card-portal')).toHaveAttribute('data-status', 'needs-review');
  });

  it('pdf card moves from blocked to needs-review when accepted scenario is available without PDF', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          onPrintSummary: undefined,
        })}
      />,
    );
    expect(screen.getByTestId('card-pdf')).toHaveAttribute('data-status', 'needs-review');
  });
});
