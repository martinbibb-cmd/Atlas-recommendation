/**
 * resultSurfaces.test.tsx
 *
 * PR8 — Validates the tidy Atlas result surface hierarchy:
 *
 *   Primary (survey-backed canonical flow):
 *     Simulator → Advice → Print Recommendation
 *
 *   Secondary (technical exports, clearly labelled):
 *     Technical Comparison, Engineering Detail
 *
 *   Demoted / removed from primary path:
 *     Customer Summary, Full Output Report
 *
 * Coverage:
 *   1. Survey-backed ExplainersHubPage exposes "Advice" as the primary CTA
 *      (no duplicate recommendation entry points in the header)
 *   2. LiveHubPage primary export is "Print Recommendation"
 *   3. LiveHubPage does NOT render legacy "Customer Summary" or "Full Output Report" buttons
 *   4. LiveHubPage secondary exports are labelled "Engineering Detail" / "Technical Comparison"
 *   5. LabShell (demo/sandbox) export section is labelled "Demo exports:" to distinguish from
 *      survey-backed canonical outputs
 *   6. DecisionSynthesisPage (Advice) print button is labelled "Print Recommendation"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LiveHubPage from '../LiveHubPage';
import ExplainersHubPage from '../../explainers/ExplainersHubPage';
import LabShell from '../../components/lab/LabShell';
import DecisionSynthesisPage from '../../components/advice/DecisionSynthesisPage';
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { CompareSeed } from '../../lib/simulator/buildCompareSeedFromSurvey';

// ─── Stubs ────────────────────────────────────────────────────────────────────

function makeResult(): FullEngineResult {
  return {
    combiDhwV1:   { verdict: { combiRisk: 'pass' } },
    storedDhwV1:  { verdict: { storedRisk: 'pass' } },
    normalizer:   { tenYearEfficiencyDecayPct: 5 },
    pvAssessment: {
      pvSuitability: 'limited',
      hasExistingPv: false,
      solarStorageOpportunity: 'low',
      energyDemandAlignment: 'poor',
      solarNarrativeSignals: [],
      batteryPlanned: undefined,
      pvGenerationTimingProfile: 'evening',
    },
    demographicOutputs: {
      dailyHotWaterLitres: 135,
      peakSimultaneousOutlets: 1,
      demandProfileLabel: 'Moderate',
      bathUseIntensity: 'low',
      occupancyTimingProfile: 'away_daytime',
      storageBenefitSignal: 'low',
      demographicNarrativeSignals: [],
    },
    engineOutput: {
      eligibility:    [],
      redFlags:       [],
      recommendation: { primary: 'Gas Combi is recommended' },
      explainers:     [],
      limiters:       { limiters: [] },
      evidence:       [],
      options:        [],
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FullEngineResult;
}

function makeInput(): FullSurveyModelV1 {
  return {
    occupancyCount: 3,
    bathroomCount:  1,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FullSurveyModelV1;
}

const MINIMAL_ENGINE_OUTPUT: EngineOutputV1 = {
  eligibility:    [],
  redFlags:       [],
  recommendation: { primary: 'Gas Combi is recommended' },
  explainers:     [],
  limiters:       { limiters: [] },
  evidence:       [],
  options:        [
    {
      id:       'combi',
      label:    'Gas Combi',
      status:   'viable',
      headline: 'Viable option',
      why:      ['Good fit'],
      requirements: [],
      heat:        { status: 'ok', headline: 'Adequate heat', bullets: [] },
      dhw:         { status: 'ok', headline: 'Good DHW flow', bullets: [] },
      engineering: { status: 'ok', headline: 'No major changes', bullets: [] },
      typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
    },
  ],
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const MINIMAL_COMPARE_SEED: CompareSeed = {
  left:  { systemChoice: 'combi',     systemInputs: {} },
  right: { systemChoice: 'unvented',  systemInputs: {} },
  compareMode:     'current_vs_proposed',
  comparisonLabel: 'Current system vs Proposed system',
};

const MINIMAL_SURVEY: FullSurveyModelV1 = {
  occupancyCount: 3,
  bathroomCount:  1,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as FullSurveyModelV1;

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

// ─── 1. Canonical flow — ExplainersHubPage (Simulator) ───────────────────────

const SURVEY_BACKED_INPUT: FullSurveyModelV1 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancyCount: 3,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
  mainsDynamicFlowLpm: 18,
// eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any as FullSurveyModelV1;

describe('resultSurfaces — ExplainersHubPage (Simulator)', () => {
  it('renders "Simulator" as the page title (not "Simulator Dashboard")', () => {
    render(<ExplainersHubPage />);
    expect(screen.getByRole('heading', { name: /^simulator$/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /simulator dashboard/i })).toBeNull();
  });

  it('survey-backed: renders the canonical SimulatorDashboard (compare layout) as the live results view', () => {
    render(<ExplainersHubPage surveyData={SURVEY_BACKED_INPUT} />);
    // compare-layout is the canonical SimulatorDashboard two-column layout.
    expect(document.querySelector('[data-testid="compare-layout"]')).not.toBeNull();
  });

  it('survey-backed: does NOT render the legacy SelectedFamilyDashboard family selector pills', () => {
    render(<ExplainersHubPage surveyData={SURVEY_BACKED_INPUT} />);
    // These testIds only exist on the legacy SelectedFamilyDashboard — not on SimulatorDashboard.
    expect(screen.queryByTestId('family-pill-combi')).toBeNull();
    expect(screen.queryByTestId('family-pill-stored_water')).toBeNull();
    expect(screen.queryByTestId('family-pill-heat_pump')).toBeNull();
  });

  it('survey-backed: still renders "Simulator" page heading', () => {
    render(<ExplainersHubPage surveyData={SURVEY_BACKED_INPUT} />);
    expect(screen.getByRole('heading', { name: /^simulator$/i })).toBeTruthy();
  });
});

// ─── 2. LiveHubPage — primary export ─────────────────────────────────────────

describe('resultSurfaces — LiveHubPage primary export', () => {
  it('renders "Print Recommendation" as the primary export button', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /print atlas recommendation/i })).toBeTruthy();
  });

  it('clicking "Print Recommendation" opens PrintableRecommendationPage', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print atlas recommendation/i }));
    expect(screen.getByLabelText(/printable atlas recommendation/i)).toBeTruthy();
  });
});

// ─── 3. LiveHubPage — legacy buttons removed ─────────────────────────────────

describe('resultSurfaces — LiveHubPage legacy buttons removed', () => {
  it('does NOT render "Customer Summary" button', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /customer summary/i })).toBeNull();
  });

  it('does NOT render "Full Output Report" button', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /full output report/i })).toBeNull();
  });
});

// ─── 4. LiveHubPage — secondary technical exports clearly labelled ────────────

describe('resultSurfaces — LiveHubPage secondary exports', () => {
  it('labels the secondary export section as "Technical exports"', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.getByText(/technical exports/i)).toBeTruthy();
  });

  it('uses "Engineering Detail" not "Technical Spec" for the engineering export', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /print engineering detail/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /print technical spec/i })).toBeNull();
  });
});

// ─── 5. LabShell — demo/sandbox labels ───────────────────────────────────────

describe('resultSurfaces — LabShell demo/sandbox labels', () => {
  it('labels the export section as "Demo exports:" not "Print / export:"', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.getByText(/demo exports:/i)).toBeTruthy();
    expect(screen.queryByText(/print \/ export:/i)).toBeNull();
  });

  it('does NOT expose a "Customer Summary" link in the demo lab', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('link', { name: /customer summary/i })).toBeNull();
  });
});

// ─── 6. DecisionSynthesisPage — print button label ───────────────────────────

describe('resultSurfaces — DecisionSynthesisPage print button', () => {
  it('renders "Print Recommendation" (capitalised) as the button label', () => {
    render(
      <DecisionSynthesisPage
        engineOutput={MINIMAL_ENGINE_OUTPUT}
        compareSeed={MINIMAL_COMPARE_SEED}
        surveyData={MINIMAL_SURVEY}
      />,
    );
    // Button text must exactly match the preferred capitalised label
    const btn = screen.getByRole('button', { name: /print atlas recommendation/i });
    expect(btn.textContent).toMatch(/Print Recommendation/);
  });

  it('renders "Advice" as the page title (not "Decision Advice")', () => {
    render(
      <DecisionSynthesisPage
        engineOutput={MINIMAL_ENGINE_OUTPUT}
        compareSeed={MINIMAL_COMPARE_SEED}
        surveyData={MINIMAL_SURVEY}
      />,
    );
    // The advice page heading should use the preferred label "Advice"
    expect(screen.getByRole('heading', { name: /advice/i })).toBeTruthy();
  });

  it('does NOT expose print button when no compare seed is provided (non-survey path)', () => {
    render(<DecisionSynthesisPage engineOutput={MINIMAL_ENGINE_OUTPUT} />);
    expect(screen.queryByRole('button', { name: /print atlas recommendation/i })).toBeNull();
  });
});
