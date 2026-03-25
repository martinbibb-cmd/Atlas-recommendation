/**
 * LiveHubPage.test.tsx
 *
 * Validates that LiveHubPage:
 *   - Renders the primary "Print Recommendation" button
 *   - Renders "Engineering Detail" as a secondary technical export
 *   - Renders "Technical Comparison" only when ≥ 2 options exist
 *   - Hides "Technical Comparison" when fewer than 2 options are present
 *   - "Customer Summary" and "Full Output Report" legacy buttons are removed
 *   - Clicking "Print Recommendation" opens PrintableRecommendationPage overlay
 *   - Clicking "Engineering Detail" opens the LabPrintTechnical overlay
 *   - Clicking "Technical Comparison" opens the LabPrintComparison overlay
 *   - The print overlay's "← Back" button returns to the hub
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LiveHubPage from '../LiveHubPage';
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';

// ─── Minimal stub factories ────────────────────────────────────────────────────

/** Base FullEngineResult stub with just enough fields for LiveHubPage to render. */
function makeResult(options?: { optionCount?: number }): FullEngineResult {
  const optionList = options?.optionCount === 2
    ? [
        {
          id: 'combi', label: 'Gas Combi', status: 'viable',
          headline: 'Viable option', why: ['Good fit'], requirements: [],
          heat:        { status: 'ok', headline: 'Adequate heat', bullets: [] },
          dhw:         { status: 'ok', headline: 'Good DHW flow', bullets: [] },
          engineering: { status: 'ok', headline: 'No major changes', bullets: [] },
          typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
        },
        {
          id: 'ashp', label: 'ASHP', status: 'viable',
          headline: 'Viable option', why: ['Eco fit'], requirements: [],
          heat:        { status: 'ok', headline: 'Adequate heat', bullets: [] },
          dhw:         { status: 'ok', headline: 'Stored supply', bullets: [] },
          engineering: { status: 'ok', headline: 'Outdoor unit required', bullets: [] },
          typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
        },
      ]
    : [];

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
      options:        optionList,
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FullEngineResult;
}

function makeInput(): FullSurveyModelV1 {
  return {
    occupancyCount: 3,
    bathroomCount: 1,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FullSurveyModelV1;
}

// jsdom does not implement window.scrollTo
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LiveHubPage — primary export button', () => {
  it('renders the "Print Recommendation" primary button', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /print atlas recommendation/i })).toBeTruthy();
  });

  it('does NOT render legacy "Customer Summary" button', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /customer summary/i })).toBeNull();
  });

  it('does NOT render legacy "Full Output Report" button', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /full output report/i })).toBeNull();
  });

  it('clicking "Print Recommendation" opens the PrintableRecommendationPage overlay', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print atlas recommendation/i }));
    // PrintableRecommendationPage renders an aria-label "Printable Atlas recommendation"
    expect(screen.getByLabelText(/printable atlas recommendation/i)).toBeTruthy();
  });

  it('"← Back" in the Print Recommendation overlay returns to the hub', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print atlas recommendation/i }));
    expect(screen.getByLabelText(/printable atlas recommendation/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /back to advice page/i }));
    expect(screen.getByText('📡 Atlas Live Output Hub')).toBeTruthy();
  });
});

describe('LiveHubPage — secondary technical export buttons', () => {
  it('renders "Engineering Detail" as a secondary technical export', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /print engineering detail/i })).toBeTruthy();
  });

  it('does NOT render legacy "Technical Spec" button label', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /^print technical spec/i })).toBeNull();
  });

  it('does NOT render "Technical Comparison" button when fewer than 2 options are returned', () => {
    render(
      <LiveHubPage result={makeResult({ optionCount: 0 })} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /print technical comparison/i })).toBeNull();
  });

  it('renders "Technical Comparison" button when 2 or more options exist', () => {
    render(
      <LiveHubPage result={makeResult({ optionCount: 2 })} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /print technical comparison/i })).toBeTruthy();
  });

  it('does NOT render legacy "Comparison Sheet" button label', () => {
    render(
      <LiveHubPage result={makeResult({ optionCount: 2 })} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /comparison sheet/i })).toBeNull();
  });
});

describe('LiveHubPage — secondary export overlay navigation', () => {
  it('clicking "Engineering Detail" renders the LabPrintTechnical overlay', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print engineering detail/i }));
    // LabPrintTechnical renders an h1 "Technical Specification"
    expect(
      screen.getByRole('heading', { level: 1, name: 'Technical Specification' }),
    ).toBeTruthy();
  });

  it('clicking "Technical Comparison" renders the LabPrintComparison overlay', () => {
    render(
      <LiveHubPage result={makeResult({ optionCount: 2 })} input={makeInput()} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print technical comparison/i }));
    // LabPrintComparison renders an h1 "Comparison Sheet"
    expect(
      screen.getByRole('heading', { level: 1, name: 'Comparison Sheet' }),
    ).toBeTruthy();
  });

  it('"← Back to Lab" in the Engineering Detail overlay returns to the hub', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print engineering detail/i }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Technical Specification' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByText('← Back to Lab'));
    expect(screen.getByText('📡 Atlas Live Output Hub')).toBeTruthy();
  });
});

describe('LiveHubPage — export section labels', () => {
  it('renders a "Technical exports" secondary label', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.getByText(/technical exports/i)).toBeTruthy();
  });

  it('does NOT render legacy hint text about "Customer report: 3 pages"', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.queryByText(/Customer report: 3 pages/)).toBeNull();
  });
});
