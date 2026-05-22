/**
 * VisitHomeDashboard.test.tsx
 *
 * Tests for the Visit Home Dashboard Shell.
 *
 * Covers:
 *   - dashboard renders all expected cards
 *   - simulator CTA calls onOpenSimulator
 *   - implementation CTA calls onOpenInstallationSpecification (opens existing workflow)
 *   - journey card reflects archetype from engine output / scenario data
 *   - blocked outputs show status badge, CTA is disabled — no broken links
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { VisitHomeDashboard } from '../VisitHomeDashboard';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';
import type { CustomerSummaryV1 } from '../../../contracts/CustomerSummaryV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import {
  buildCustomerJourneyPack,
  buildCustomerJourneyPackGeneratedOutput,
} from '../../../library/portal/pdf/buildPortalJourneyPrintModel';

// ─── Minimal fixtures ─────────────────────────────────────────────────────────

const MINIMAL_ENGINE_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  heatLossWatts: 8000,
  bathroomCount: 1,
  occupancyCount: 3,
  dynamicMainsPressure: 2.0,
  mainsDynamicFlowLpm: 14,
};

const COMBI_ENGINE_OUTPUT: Partial<EngineOutputV1> = {
  recommendation: { primary: 'combi' },
  eligibility: [],
  redFlags: [],
  explainers: [],
};

const ASHP_ENGINE_OUTPUT: Partial<EngineOutputV1> = {
  recommendation: { primary: 'ashp' },
  eligibility: [],
  redFlags: [],
  explainers: [],
};

const SYSTEM_UNVENTED_OUTPUT: Partial<EngineOutputV1> = {
  recommendation: { primary: 'system_unvented' },
  eligibility: [],
  redFlags: [],
  explainers: [],
};

const SCENARIO_WITH_PRESSURE_CONSTRAINT: ScenarioResult[] = [
  {
    scenarioId: 'combi',
    system: { type: 'combi', summary: 'Combi boiler' },
    performance: {
      hotWater: 'good',
      heating: 'good',
      efficiency: 'good',
      reliability: 'good',
    },
    physicsFlags: { pressureConstraint: true },
    displayIdentity: { label: 'Combi', tagline: '' },
    benefits: [],
    constraints: [],
    outcomes: [],
    requiredWorks: [],
    upgradePaths: [],
  },
];

const ACCEPTED_SCENARIO: ScenarioResult = {
  scenarioId: 'combi',
  system: { type: 'combi', summary: 'Combi boiler' },
  performance: {
    hotWater: 'good',
    heating: 'good',
    efficiency: 'good',
    reliability: 'good',
  },
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
  plainEnglishDecision: 'The recommendation aligns with household demand and property constraints.',
  whyThisWins: ['Daily hot water demand is met without stored hot-water losses.'],
  whatThisAvoids: [],
  includedNow: [],
  requiredChecks: ['Confirm flue route and condensate path.'],
  optionalUpgrades: [],
  futureReady: [],
  confidenceNotes: [],
  hardConstraints: [],
  performancePenalties: [],
  fitNarrative: 'The recommendation aligns with household demand and property constraints.',
};

// ─── Default props factory ────────────────────────────────────────────────────

function makeProps(
  overrides: Partial<React.ComponentProps<typeof VisitHomeDashboard>> = {},
) {
  return {
    visitId: 'visit-abc123',
    engineInput: MINIMAL_ENGINE_INPUT,
    engineOutput: COMBI_ENGINE_OUTPUT as EngineOutputV1,
    scenarios: [ACCEPTED_SCENARIO],
    acceptedScenario: ACCEPTED_SCENARIO,
    recommendationSummary: RECOMMENDATION_SUMMARY,
    surveyModel: MINIMAL_ENGINE_INPUT as FullSurveyModelV1,
    workspaceRole: 'admin',
    portalUrl: undefined,
    installationSpecOptionCount: 0,
    onOpenSimulator: vi.fn(),
    onOpenPresentation: vi.fn(),
    onDownloadCustomerPdf: vi.fn(),
    onOpenInstallationSpecification: vi.fn(),
    onOpenHandoffReview: vi.fn(),
    onOpenEngineerRoute: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
}

function setViewportWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  window.dispatchEvent(new Event('resize'));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VisitHomeDashboard', () => {
  it('renders all seven expected cards', () => {
    render(<VisitHomeDashboard {...makeProps()} />);

    expect(screen.getByTestId('card-recommendation')).toBeInTheDocument();
    expect(screen.getByTestId('card-portal')).toBeInTheDocument();
    expect(screen.getByTestId('card-simulator')).toBeInTheDocument();
    expect(screen.getByTestId('card-pdf')).toBeInTheDocument();
    expect(screen.getByTestId('card-implementation')).toBeInTheDocument();
    expect(screen.getByTestId('card-handoff')).toBeInTheDocument();
    expect(screen.getByTestId('card-export')).toBeInTheDocument();
  });

  it('hydrates dashboard state from accepted scenario even when engine input is unavailable', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          engineInput: undefined,
          engineOutput: undefined,
        })}
      />,
    );
    expect(screen.getByTestId('card-recommendation')).toHaveAttribute('data-status', 'ready');
  });

  it('renders workspace-first layout classes by default with mobile fallback marker', () => {
    render(<VisitHomeDashboard {...makeProps()} />);

    const root = screen.getByTestId('visit-home-layout-root');
    const workspace = screen.getByTestId('visit-home-workspace-layout');
    expect(root).toHaveClass('vhd-layout--workspace-default');
    expect(root).toHaveClass('vhd-layout--mobile-fallback');
    expect(workspace).toHaveClass('vhd-workspace--three-rail');
  });

  it('renders grouped workspace sections for customer, technical, and delivery review', () => {
    render(<VisitHomeDashboard {...makeProps()} />);
    expect(screen.getByTestId('visit-home-section-customer-review')).toBeInTheDocument();
    expect(screen.getByTestId('visit-home-section-technical-review')).toBeInTheDocument();
    expect(screen.getByTestId('visit-home-section-delivery-handover')).toBeInTheDocument();
  });

  it('shows recommendation hero with placeholders when recommendation data is absent', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          engineInput: undefined,
          engineOutput: undefined,
          acceptedScenario: undefined,
          recommendationSummary: undefined,
          scenarios: [],
          surveyModel: undefined,
          visitId: undefined,
        })}
      />,
    );

    const hero = screen.getByTestId('visit-home-recommendation-hero');
    expect(hero).toHaveTextContent('Recommended system');
    expect(hero).toHaveTextContent('Recommendation pending');
  });

  it.each([
    ['desktop', 1366],
    ['tablet', 1024],
  ])('keeps key CTAs visible at %s widths', (_label, width) => {
    setViewportWidth(width);
    render(<VisitHomeDashboard {...makeProps()} />);
    const workspace = screen.getByTestId('visit-home-workspace-layout');

    expect(screen.getByTestId('card-recommendation-cta')).toBeInTheDocument();
    expect(screen.getByTestId('card-portal-cta')).toBeInTheDocument();
    expect(screen.getByTestId('card-pdf-cta')).toBeInTheDocument();
    expect(screen.getByTestId('card-simulator-cta')).toBeInTheDocument();
    expect(screen.getByTestId('card-implementation-cta')).toBeInTheDocument();
    expect(screen.getByTestId('card-handoff-cta')).toBeInTheDocument();
    expect(screen.getByTestId('card-export-cta')).toBeInTheDocument();
    expect(workspace).toHaveClass('vhd-workspace--three-rail');
  });

  it('shows review workflow copy and keeps scan as capture/import entry point', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({ engineOutput: ASHP_ENGINE_OUTPUT as EngineOutputV1 })}
      />,
    );

    expect(screen.getByText('Review this visit')).toBeInTheDocument();
    expect(screen.getByText('Open customer journey →')).toBeInTheDocument();
    expect(screen.getByText('Open house simulator →')).toBeInTheDocument();
    expect(screen.getByText('Prepare implementation pack →')).toBeInTheDocument();
    expect(screen.getByText('Export handover package →')).toBeInTheDocument();
    expect(screen.getByTestId('visit-home-scan-entry-note')).toHaveTextContent(
      'Atlas Scan remains the capture/import entry point for survey evidence, photos, pins, and notes.',
    );
  });

  it('shows recovery center diagnostics and retry CTA when import failure is present', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          onImportWorkflowPackage: vi.fn(),
          lastImportFailure: {
            occurredAt: '2026-05-21T05:00:00.000Z',
            filename: 'broken.atlasvisit.pdf',
            errors: ['schema mismatch: expected atlas.visit-package.v1'],
          },
        })}
      />,
    );
    expect(screen.getByTestId('visit-home-recovery-center')).toBeInTheDocument();
    expect(screen.getByTestId('visit-home-import-failure-diagnostics')).toHaveTextContent('broken.atlasvisit.pdf');
    expect(screen.getByTestId('visit-home-import-retry-cta')).toBeInTheDocument();
  });

  it('does not show a separate export visit package action in the Visit session panel', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          onSaveLocally: vi.fn(),
          onImportWorkflowPackage: vi.fn(),
          onExportPackage: vi.fn(),
        })}
      />,
    );

    expect(screen.queryByTestId('visit-home-export-package')).not.toBeInTheDocument();
  });

  it('shows package history entries and workflow QA checklist states', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          packageOpenHistory: [
            {
              visitReference: 'REF-1234',
              importedAt: '2026-05-21T05:00:00.000Z',
              sourceLabel: 'Visit Home',
              integrityStatus: 'verified',
            },
          ],
          workflowQaChecklist: [
            {
              id: 'import_package',
              label: 'Import package',
              status: 'complete',
              detail: 'Loaded.',
            },
            {
              id: 'receive_scan_return',
              label: 'Receive scan return',
              status: 'pending',
              detail: 'Pending return.',
            },
          ],
        })}
      />,
    );

    expect(screen.getByTestId('visit-home-package-history-list')).toHaveTextContent('REF-1234');
    expect(screen.getByTestId('visit-home-workflow-qa-checklist')).toBeInTheDocument();
    expect(screen.getByTestId('visit-home-workflow-qa-import_package')).toHaveTextContent('Complete');
    expect(screen.getByTestId('visit-home-workflow-qa-receive_scan_return')).toHaveTextContent('Pending');
  });

  it('PDF card shows ready and workflow QA export step is complete after a successful export', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          generatedOutputs: {
            portal: { generated: false },
            pdf: { generated: true },
            customerJourneyPack: undefined,
            simulatorReview: { generated: false },
            handoff: { generated: false },
          },
          workflowQaChecklist: [
            {
              id: 'export_package_again',
              label: 'Export package again',
              status: 'complete',
              detail: 'Exported.',
            },
          ],
        })}
      />,
    );

    expect(screen.getByTestId('card-pdf')).toHaveAttribute('data-status', 'ready');
    expect(screen.getByTestId('visit-home-workflow-qa-export_package_again')).toHaveTextContent('Complete');
  });

  it('shows packaged customer journey readiness in the readiness summary', () => {
    const customerJourneyPack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Combi boiler is the right fit.',
      customerFacts: ['3-person household', '1 bathroom'],
      journeyType: 'generic_recommendation_summary',
    });
    render(
      <VisitHomeDashboard
        {...makeProps({
          generatedOutputs: {
            portal: { generated: false },
            pdf: { generated: false },
            customerJourneyPack: buildCustomerJourneyPackGeneratedOutput({
              customerJourneyPack,
              generatedAt: '2026-05-20T10:00:00.000Z',
            }),
            simulatorReview: { generated: false },
            handoff: { generated: false },
          },
        })}
      />,
    );
    expect(screen.getByTestId('visit-home-customer-journey-pack-status')).toHaveTextContent(
      'Customer journey pack: Ready',
    );
  });

  it('simulator CTA calls onOpenSimulator', () => {
    const onOpenSimulator = vi.fn();
    render(<VisitHomeDashboard {...makeProps({ onOpenSimulator })} />);

    const cta = screen.getByTestId('card-simulator-cta');
    expect(cta).not.toBeDisabled();
    fireEvent.click(cta);
    expect(onOpenSimulator).toHaveBeenCalledOnce();
  });

  it('implementation CTA calls onOpenInstallationSpecification — opens existing workflow', () => {
    const onOpenInstallationSpecification = vi.fn();
    render(<VisitHomeDashboard {...makeProps({ onOpenInstallationSpecification })} />);

    const cta = screen.getByTestId('card-implementation-cta');
    expect(cta).not.toBeDisabled();
    fireEvent.click(cta);
    expect(onOpenInstallationSpecification).toHaveBeenCalledOnce();
  });

  it('calls onDownloadCustomerPdf when customer PDF CTA is clicked', () => {
    const onDownloadCustomerPdf = vi.fn();
    render(
      <VisitHomeDashboard
        {...makeProps({
          onDownloadCustomerPdf,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('card-pdf-cta'));
    expect(onDownloadCustomerPdf).toHaveBeenCalledOnce();
  });

  it('customer PDF card title is "Customer PDF"', () => {
    render(<VisitHomeDashboard {...makeProps()} />);
    const card = screen.getByTestId('card-pdf');
    expect(card).toHaveTextContent('Customer PDF');
  });

  it('validates production customer-review CTAs exclude retired surfaces', () => {
    render(<VisitHomeDashboard {...makeProps({ portalUrl: 'https://portal.example.com' })} />);
    const customerReview = screen.getByTestId('visit-home-section-customer-review');
    const text = customerReview.textContent ?? '';
    expect(text).not.toContain('Insight Pack');
    expect(text).not.toContain('framework-print');
    expect(text).not.toContain('unified-simulator');
    expect(text).not.toContain('CustomerAdvicePrintPack');
  });

  it('validates visit-home customer-review routes resolve to canonical surfaces', () => {
    const onOpenPresentation = vi.fn();
    const onDownloadCustomerPdf = vi.fn();
    const mockWindowOpen = vi.fn();
    vi.stubGlobal('open', mockWindowOpen);
    render(<VisitHomeDashboard {...makeProps({ portalUrl: 'https://portal.example.com', onOpenPresentation, onDownloadCustomerPdf })} />);
    const customerReview = screen.getByTestId('visit-home-section-customer-review');
    const ctaLabels = within(customerReview)
      .getAllByRole('button')
      .map((button) => button.textContent?.trim() ?? '');
    expect(ctaLabels).toMatchInlineSnapshot(`
      [
        "Review recommendation →",
        "Open customer portal →",
        "Download customer PDF →",
      ]
    `);
    fireEvent.click(screen.getByTestId('card-recommendation-cta'));
    fireEvent.click(screen.getByTestId('card-portal-cta'));
    fireEvent.click(screen.getByTestId('card-pdf-cta'));
    expect(onOpenPresentation).toHaveBeenCalledOnce();
    expect(mockWindowOpen).toHaveBeenCalledOnce();
    expect(onDownloadCustomerPdf).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('portal card shows needs-review when no portalUrl is available', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          portalUrl: undefined,
        })}
      />,
    );
    expect(screen.getByTestId('card-portal')).toHaveAttribute('data-status', 'needs-review');
    expect(screen.getByTestId('card-portal-cta')).toBeDisabled();
  });

  it('portal card exposes generate CTA when output is missing and generation handler is provided', () => {
    const onGenerateCustomerPortal = vi.fn();
    render(
      <VisitHomeDashboard
        {...makeProps({
          portalUrl: undefined,
          hasPortalOutput: false,
          onGenerateCustomerPortal,
        })}
      />,
    );
    const cta = screen.getByTestId('card-portal-cta');
    expect(cta).toHaveTextContent('Generate customer portal →');
    fireEvent.click(cta);
    expect(onGenerateCustomerPortal).toHaveBeenCalledOnce();
  });

  it('portal card CTA label is "Open customer portal →" when portalUrl is set', () => {
    const mockWindowOpen = vi.fn();
    vi.stubGlobal('open', mockWindowOpen);
    render(
      <VisitHomeDashboard
        {...makeProps({
          portalUrl: 'https://portal.example.com',
        })}
      />,
    );
    const cta = screen.getByTestId('card-portal-cta');
    expect(cta).toHaveTextContent('Open customer portal →');
    fireEvent.click(cta);
    expect(mockWindowOpen).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it('portal card opens packaged portal when customer journey content is available from an import', () => {
    const onOpenPortalFromPackage = vi.fn();
    const customerJourneyPack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'System boiler with cylinder: Best fit for this home',
      customerFacts: ['3-person household', '2 bathrooms'],
      journeyType: 'open_vented',
    });

    render(
      <VisitHomeDashboard
        {...makeProps({
          portalUrl: undefined,
          hasPortalOutput: false,
          generatedOutputs: {
            portal: { generated: false },
            pdf: { generated: false },
            customerJourneyPack: buildCustomerJourneyPackGeneratedOutput({
              customerJourneyPack,
              generatedAt: '2026-05-20T10:02:00.000Z',
            }),
            simulatorReview: { generated: false },
            handoff: { generated: false },
          },
          onOpenPortalFromPackage,
        })}
      />,
    );

    const cta = screen.getByTestId('card-portal-cta');
    expect(cta).toHaveTextContent('Open customer portal →');
    fireEvent.click(cta);
    expect(onOpenPortalFromPackage).toHaveBeenCalledOnce();
  });

  it('scan launch CTA in capture/import panel calls onOpenScanFromPackage', () => {
    const onOpenScanFromPackage = vi.fn();
    render(<VisitHomeDashboard {...makeProps({ onOpenScanFromPackage })} />);
    fireEvent.click(screen.getByTestId('visit-home-scan-launch-cta'));
    expect(onOpenScanFromPackage).toHaveBeenCalledOnce();
  });

  it('customer PDF card CTA stays download-labelled when output is missing', () => {
    const onDownloadCustomerPdf = vi.fn();
    render(
      <VisitHomeDashboard
        {...makeProps({
          onDownloadCustomerPdf,
          hasSupportingPdfOutput: false,
        })}
      />,
    );
    const cta = screen.getByTestId('card-pdf-cta');
    expect(cta).toHaveTextContent('Download customer PDF →');
    fireEvent.click(cta);
    expect(onDownloadCustomerPdf).toHaveBeenCalledOnce();
  });

  it('customer PDF CTA uses canonical package export instead of window.print', () => {
    const onDownloadCustomerPdf = vi.fn();
    const mockPrint = vi.fn();
    vi.stubGlobal('print', mockPrint);

    render(
      <VisitHomeDashboard
        {...makeProps({
          onDownloadCustomerPdf,
          hasSupportingPdfOutput: false,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('card-pdf-cta'));
    expect(onDownloadCustomerPdf).toHaveBeenCalledOnce();
    expect(mockPrint).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  describe('journey card', () => {
    it('shows heat_pump_reality archetype when engine recommends ashp', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ engineOutput: ASHP_ENGINE_OUTPUT as EngineOutputV1 })}
        />,
      );
      const card = screen.getByTestId('visit-journey-card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveAttribute('data-archetype', 'heat_pump_reality');
      expect(card).toHaveTextContent('Heat pump reality');
    });

    it('shows open_vented_to_sealed_unvented when circuit is open_vented and recommendation is system_unvented', () => {
      const surveyModel: FullSurveyModelV1 = {
        ...MINIMAL_ENGINE_INPUT,
        fullSurvey: {
          heatingCondition: { systemCircuitType: 'open_vented' },
        },
      };
      render(
        <VisitHomeDashboard
          {...makeProps({
            engineOutput: SYSTEM_UNVENTED_OUTPUT as EngineOutputV1,
            surveyModel,
          })}
        />,
      );
      const card = screen.getByTestId('visit-journey-card');
      expect(card).toHaveAttribute('data-archetype', 'open_vented_to_sealed_unvented');
    });

    it('shows water_constraint archetype when scenario has pressureConstraint flag', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ scenarios: SCENARIO_WITH_PRESSURE_CONSTRAINT })}
        />,
      );
      const card = screen.getByTestId('visit-journey-card');
      expect(card).toHaveAttribute('data-archetype', 'water_constraint');
    });

    it('hides journey card when no archetype is detected', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({
            engineOutput: undefined,
            scenarios: [],
          })}
        />,
      );
      expect(screen.queryByTestId('visit-journey-card')).not.toBeInTheDocument();
    });
  });

  describe('blocked outputs', () => {
    it('recommendation card is blocked when no engine data', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({
            engineInput: undefined,
            engineOutput: undefined,
            visitId: undefined,
          })}
        />,
      );
      const card = screen.getByTestId('card-recommendation');
      expect(card).toHaveAttribute('data-status', 'blocked');

      // CTA must be disabled — no broken link
      const cta = screen.getByTestId('card-recommendation-cta');
      expect(cta).toBeDisabled();
    });

    it('PDF card is needs-review when recommendation exists but supporting PDF is not generated and CTA is disabled', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({
            engineInput: undefined,
            engineOutput: undefined,
            onDownloadCustomerPdf: undefined,
          })}
        />,
      );
      const card = screen.getByTestId('card-pdf');
      expect(card).toHaveAttribute('data-status', 'needs-review');

    const cta = screen.getByTestId('card-pdf-cta');
    expect(cta).toBeDisabled();
  });

  it('shows specific not-generated copy for portal and supporting PDF when recommendation exists', () => {
    render(
      <VisitHomeDashboard
        {...makeProps({
          portalUrl: undefined,
          onDownloadCustomerPdf: undefined,
        })}
      />,
    );

    expect(screen.getByTestId('card-portal')).toHaveAttribute('data-status', 'needs-review');
    expect(screen.getByTestId('card-pdf')).toHaveAttribute('data-status', 'needs-review');
    expect(screen.getByText('Customer portal not generated yet.')).toBeInTheDocument();
    expect(screen.getByText('Customer PDF not generated yet.')).toBeInTheDocument();
    expect(screen.queryByText('Recommendation not available')).not.toBeInTheDocument();
  });

    it('handoff card is blocked when no visitId and CTA is disabled', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({
            visitId: undefined,
            engineInput: undefined,
            engineOutput: undefined,
          })}
        />,
      );
      const card = screen.getByTestId('card-handoff');
      expect(card).toHaveAttribute('data-status', 'blocked');

      const cta = screen.getByTestId('card-handoff-cta');
      expect(cta).toBeDisabled();
    });

    it('implementation card shows ready when installationSpecOptionCount > 0', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ installationSpecOptionCount: 2 })}
        />,
      );
      const card = screen.getByTestId('card-implementation');
      expect(card).toHaveAttribute('data-status', 'ready');
      expect(card).toHaveTextContent('2 options saved');
    });

    it('blocked actions render reason labels instead of only dead buttons', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({
            workspaceRole: 'office',
            engineInput: undefined,
            engineOutput: undefined,
            visitId: undefined,
          })}
        />,
      );
      const card = screen.getByTestId('card-implementation');
      expect(card).toHaveAttribute('data-status', 'blocked');
      expect(screen.getByTestId('card-implementation-blocked-reason')).toHaveTextContent(
        'Visit data missing',
      );
      expect(screen.getByTestId('card-implementation-cta')).toBeDisabled();
    });
  });

  it('readiness counts exclude hidden role actions', () => {
    render(<VisitHomeDashboard {...makeProps({ workspaceRole: 'surveyor' })} />);
    const panel = screen.getByTestId('visit-home-readiness-panel');
    expect(panel).toHaveTextContent('3 ready');
    expect(panel).toHaveTextContent('0 needs review');
    expect(panel).toHaveTextContent('0 blocked');
  });

  it('back button calls onBack', () => {
    const onBack = vi.fn();
    render(<VisitHomeDashboard {...makeProps({ onBack })} />);

    fireEvent.click(screen.getByTestId('visit-home-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders recommendation hero from canonical recommendation state', () => {
    render(<VisitHomeDashboard {...makeProps()} />);
    const hero = screen.getByTestId('visit-home-recommendation-hero');
    expect(hero).toBeInTheDocument();
    expect(hero).toHaveTextContent('Recommended system');
    expect(hero).toHaveTextContent('Combi boiler');
    expect(hero).toHaveTextContent('Key expectation delta');
  });

  describe('export card CTA — routes to onExportPackage, not engineer route', () => {
    it('export CTA calls onExportPackage when provided', () => {
      const onExportPackage = vi.fn();
      render(<VisitHomeDashboard {...makeProps({ onExportPackage })} />);

      const cta = screen.getByTestId('card-export-cta');
      expect(cta).not.toBeDisabled();
      fireEvent.click(cta);
      expect(onExportPackage).toHaveBeenCalledOnce();
    });

    it('export CTA does not call onOpenEngineerRoute when export is triggered', () => {
      const onExportPackage = vi.fn();
      const onOpenEngineerRoute = vi.fn();
      render(<VisitHomeDashboard {...makeProps({ onExportPackage, onOpenEngineerRoute })} />);

      fireEvent.click(screen.getByTestId('card-export-cta'));
      expect(onExportPackage).toHaveBeenCalledOnce();
      expect(onOpenEngineerRoute).not.toHaveBeenCalled();
    });

    it('export CTA is disabled when onExportPackage is not provided', () => {
      render(<VisitHomeDashboard {...makeProps({ onExportPackage: undefined })} />);

      const cta = screen.getByTestId('card-export-cta');
      expect(cta).toBeDisabled();
    });

    it('export card is blocked when no visit or engine data', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({
            visitId: undefined,
            engineInput: undefined,
            engineOutput: undefined,
            onExportPackage: undefined,
          })}
        />,
      );
      const card = screen.getByTestId('card-export');
      expect(card).toHaveAttribute('data-status', 'blocked');
    });
  });

  describe('role-aware action visibility', () => {
    it('surveyor sees review/simulator/follow-up actions', () => {
      render(<VisitHomeDashboard {...makeProps({ workspaceRole: 'surveyor' })} />);
      expect(screen.getByTestId('card-recommendation')).toBeInTheDocument();
      expect(screen.getByTestId('card-simulator')).toBeInTheDocument();
      expect(screen.getByTestId('card-handoff')).toBeInTheDocument();
      expect(screen.queryByTestId('card-pdf')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-export')).not.toBeInTheDocument();
    });

    it('office sees customer journey/PDF/workflow/export actions', () => {
      render(<VisitHomeDashboard {...makeProps({ workspaceRole: 'office' })} />);
      expect(screen.getByTestId('card-recommendation')).toBeInTheDocument();
      expect(screen.getByTestId('card-pdf')).toBeInTheDocument();
      expect(screen.getByTestId('card-implementation')).toBeInTheDocument();
      expect(screen.getByTestId('card-export')).toBeInTheDocument();
      expect(screen.queryByTestId('card-simulator')).not.toBeInTheDocument();
    });

    it('engineer sees implementation pack and walkthrough/follow-up actions', () => {
      render(<VisitHomeDashboard {...makeProps({ workspaceRole: 'engineer' })} />);
      expect(screen.getByTestId('card-implementation')).toBeInTheDocument();
      expect(screen.getByTestId('card-handoff')).toBeInTheDocument();
      expect(screen.queryByTestId('card-pdf')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-export')).not.toBeInTheDocument();
    });

    it('customer-preview role cannot see implementation internals', () => {
      render(<VisitHomeDashboard {...makeProps({ workspaceRole: 'customer-preview' })} />);
      expect(screen.getByTestId('card-portal')).toBeInTheDocument();
      expect(screen.getByTestId('card-pdf')).toBeInTheDocument();
      expect(screen.getByTestId('card-simulator')).toBeInTheDocument();
      expect(screen.queryByTestId('card-implementation')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-handoff')).not.toBeInTheDocument();
      expect(screen.queryByTestId('card-export')).not.toBeInTheDocument();
    });
  });
});
