/**
 * VisitHomeDashboard.test.tsx
 *
 * Tests for the Visit Home Dashboard Shell.
 *
 * Covers:
 *   - dashboard renders all expected cards
 *   - simulator CTA calls onOpenSimulator (keeps existing launch path)
 *   - implementation CTA calls onOpenInstallationSpecification (opens existing workflow)
 *   - journey card reflects archetype from engine output / scenario data
 *   - blocked outputs show status badge, CTA is disabled — no broken links
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisitHomeDashboard } from '../VisitHomeDashboard';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';

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

// ─── Default props factory ────────────────────────────────────────────────────

function makeProps(
  overrides: Partial<React.ComponentProps<typeof VisitHomeDashboard>> = {},
) {
  return {
    visitId: 'visit-abc123',
    engineInput: MINIMAL_ENGINE_INPUT,
    engineOutput: COMBI_ENGINE_OUTPUT as EngineOutputV1,
    scenarios: [],
    workspaceRole: 'admin',
    portalUrl: undefined,
    installationSpecOptionCount: 0,
    onOpenSimulator: vi.fn(),
    onOpenPresentation: vi.fn(),
    onPrintSummary: vi.fn(),
    onOpenInstallationSpecification: vi.fn(),
    onOpenInsightPack: vi.fn(),
    onOpenHandoffReview: vi.fn(),
    onOpenEngineerRoute: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
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

  it('renders workspace-first layout classes by default with mobile fallback marker', () => {
    render(<VisitHomeDashboard {...makeProps()} />);

    const root = screen.getByTestId('visit-home-layout-root');
    const workspace = screen.getByTestId('visit-home-workspace-layout');
    expect(root).toHaveClass('vhd-layout--workspace-default');
    expect(root).toHaveClass('vhd-layout--mobile-fallback');
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
    expect(screen.getByText('Run daily-use simulator →')).toBeInTheDocument();
    expect(screen.getByText('Prepare implementation pack →')).toBeInTheDocument();
    expect(screen.getByText('Export handover package →')).toBeInTheDocument();
    expect(screen.getByTestId('visit-home-scan-entry-note')).toHaveTextContent(
      'Atlas Scan remains the capture/import entry point for survey evidence, photos, pins, and notes.',
    );
  });

  it('simulator CTA calls onOpenSimulator — keeps existing launch path', () => {
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

  it('calls onPrintSummary when supporting PDF CTA is clicked', () => {
    const onPrintSummary = vi.fn();
    render(
      <VisitHomeDashboard
        {...makeProps({
          onPrintSummary,
        })}
      />,
    );

    fireEvent.click(screen.getByTestId('card-pdf-cta'));
    expect(onPrintSummary).toHaveBeenCalledOnce();
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

    it('PDF card is blocked when no engine data and CTA is disabled', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({
            engineInput: undefined,
            engineOutput: undefined,
          })}
        />,
      );
      const card = screen.getByTestId('card-pdf');
      expect(card).toHaveAttribute('data-status', 'blocked');

      const cta = screen.getByTestId('card-pdf-cta');
      expect(cta).toBeDisabled();
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
        'Implementation workflow unlocks after survey processing.',
      );
      expect(screen.getByTestId('card-implementation-cta')).toBeDisabled();
    });
  });

  it('back button calls onBack', () => {
    const onBack = vi.fn();
    render(<VisitHomeDashboard {...makeProps({ onBack })} />);

    fireEvent.click(screen.getByTestId('visit-home-back'));
    expect(onBack).toHaveBeenCalledOnce();
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
