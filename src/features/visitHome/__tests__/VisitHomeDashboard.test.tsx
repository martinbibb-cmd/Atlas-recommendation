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
      render(
        <VisitHomeDashboard
          {...makeProps({
            engineOutput: SYSTEM_UNVENTED_OUTPUT as EngineOutputV1,
            surveyModel: {
              ...MINIMAL_ENGINE_INPUT,
              fullSurvey: {
                heatingCondition: { systemCircuitType: 'open_vented' },
              },
            } as never,
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
  });

  it('back button calls onBack', () => {
    const onBack = vi.fn();
    render(<VisitHomeDashboard {...makeProps({ onBack })} />);

    fireEvent.click(screen.getByTestId('visit-home-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
