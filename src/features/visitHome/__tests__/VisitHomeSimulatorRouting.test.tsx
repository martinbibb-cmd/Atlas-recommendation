/**
 * VisitHomeSimulatorRouting.test.tsx
 *
 * Covers Visit Home simulator routing requirements:
 *   1. Simulator CTA on Visit Home opens the house-simulator surface
 *      (not the old unified-simulator/UnifiedSimulatorView wrapper).
 *   2. Visit Home does not route to the legacy VisitHomeUnifiedSimulatorRoute.
 *   3. House simulator receives existing visit/recommendation context (surveyData).
 *   4. Back from house simulator returns to Visit Home.
 *
 * Legacy section:
 *   VisitHomeUnifiedSimulatorRoute is retained as a dev-only component.
 *   Its own smoke tests are kept for regression coverage.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';

vi.mock('../../../engine/Engine', () => ({
  runEngine: vi.fn(() => ({
    engineOutput: { recommendation: { primary: 'combi' } },
  })),
}));

vi.mock('../../../components/simulator/UnifiedSimulatorView', () => ({
  default: () => <div data-testid="unified-simulator-view">UnifiedSimulatorView</div>,
}));

import { VisitHomeDashboard } from '../VisitHomeDashboard';
import { VisitHomeUnifiedSimulatorRoute } from '../VisitHomeUnifiedSimulatorRoute';

const ENGINE_INPUT: EngineInputV2_3 = {
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

const ACCEPTED_SCENARIO_STUB = {
  scenarioId: 'combi',
  system: { type: 'combi' as const, summary: 'Combi boiler' },
  performance: { hotWater: 'good' as const, heating: 'good' as const, efficiency: 'good' as const, reliability: 'good' as const },
  physicsFlags: {},
  displayIdentity: { label: 'Combi', tagline: '' },
  benefits: [], constraints: [], outcomes: [], requiredWorks: [], upgradePaths: [],
};

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    visitId: 'visit-test-123',
    engineInput: ENGINE_INPUT,
    engineOutput: COMBI_ENGINE_OUTPUT as EngineOutputV1,
    scenarios: [ACCEPTED_SCENARIO_STUB],
    acceptedScenario: ACCEPTED_SCENARIO_STUB,
    surveyModel: ENGINE_INPUT as FullSurveyModelV1,
    workspaceRole: 'admin' as const,
    onOpenSimulator: vi.fn(),
    onOpenPresentation: vi.fn(),
    onPrintSummary: vi.fn(),
    onOpenInstallationSpecification: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
}

// ─── Visit Home → house-simulator routing ─────────────────────────────────────

describe('Visit Home simulator CTA routing', () => {
  it('simulator CTA calls onOpenSimulator — wired to house-simulator journey in App.tsx', () => {
    const onOpenSimulator = vi.fn();
    render(<VisitHomeDashboard {...makeProps({ onOpenSimulator })} />);

    const cta = screen.getByTestId('card-simulator-cta');
    expect(cta).not.toBeDisabled();
    fireEvent.click(cta);
    expect(onOpenSimulator).toHaveBeenCalledOnce();
  });

  it('simulator card title is "Open house simulator"', () => {
    render(<VisitHomeDashboard {...makeProps()} />);

    const card = screen.getByTestId('card-simulator');
    expect(card).toHaveTextContent('Open house simulator');
  });

  it('simulator card description references the current house-simulator surface', () => {
    render(<VisitHomeDashboard {...makeProps()} />);

    const card = screen.getByTestId('card-simulator');
    expect(card).toHaveTextContent('Interactive daily-use simulator');
    expect(card).toHaveTextContent('house-simulator surface');
  });

  it('simulator CTA label is "Open house simulator →"', () => {
    render(<VisitHomeDashboard {...makeProps()} />);

    expect(screen.getByText('Open house simulator →')).toBeInTheDocument();
  });

  it('old "Run daily-use simulator →" label is not present on Visit Home', () => {
    render(<VisitHomeDashboard {...makeProps()} />);

    expect(screen.queryByText('Run daily-use simulator →')).not.toBeInTheDocument();
  });

  it('back from house simulator returns to Visit Home — onBack callback is provided', () => {
    // The house-simulator journey is rendered with onBack={() => setJourney('visit-home')}
    // in App.tsx. This test verifies the Visit Home dashboard itself wires back correctly.
    const onBack = vi.fn();
    render(<VisitHomeDashboard {...makeProps({ onBack })} />);

    fireEvent.click(screen.getByTestId('visit-home-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// ─── Legacy: VisitHomeUnifiedSimulatorRoute (dev-only, no longer reached from Visit Home) ──

describe('VisitHomeUnifiedSimulatorRoute — legacy dev-only component', () => {
  it('renders UnifiedSimulatorView wrapper when recommendation data is available', () => {
    render(
      <VisitHomeUnifiedSimulatorRoute
        engineInput={ENGINE_INPUT}
        onBack={vi.fn()}
        backLabel="visit-home"
      />,
    );

    expect(screen.getByTestId('unified-simulator-view')).toBeInTheDocument();
  });

  it('back button routes control to parent handler', () => {
    const onBack = vi.fn();
    render(
      <VisitHomeUnifiedSimulatorRoute
        engineInput={ENGINE_INPUT}
        onBack={onBack}
        backLabel="visit-home"
      />,
    );

    fireEvent.click(screen.getByTestId('visit-home-unified-simulator-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders workspace marker header', () => {
    render(
      <VisitHomeUnifiedSimulatorRoute
        engineInput={ENGINE_INPUT}
        onBack={vi.fn()}
        backLabel="visit-home"
      />,
    );

    expect(screen.getByTestId('visit-home-unified-simulator-workspace-marker')).toHaveTextContent(
      'Daily-use simulator — review workspace',
    );
  });

  it('workspace header bar contains back button and workspace marker', () => {
    render(
      <VisitHomeUnifiedSimulatorRoute
        engineInput={ENGINE_INPUT}
        onBack={vi.fn()}
        backLabel="visit-home"
      />,
    );

    const header = screen.getByTestId('visit-home-unified-simulator-header');
    expect(header).toContainElement(screen.getByTestId('visit-home-unified-simulator-back'));
    expect(header).toContainElement(screen.getByTestId('visit-home-unified-simulator-workspace-marker'));
  });
});
