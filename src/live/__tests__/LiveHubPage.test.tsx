/**
 * LiveHubPage.test.tsx
 *
 * Validates that LiveHubPage:
 *   - Renders the print action buttons (Customer Summary, Technical Spec)
 *   - Renders the Comparison Sheet button only when ≥ 2 options exist
 *   - Hides the Comparison Sheet button when fewer than 2 options are present
 *   - Clicking "Customer Summary" opens the LabPrintCustomer overlay
 *   - Clicking "Technical Spec" opens the LabPrintTechnical overlay
 *   - Clicking "Comparison Sheet" opens the LabPrintComparison overlay
 *   - The print overlay's "← Back to Lab" button returns to the hub
 *   - No duplicate print logic is introduced (print surfaces are the existing Lab ones)
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

describe('LiveHubPage — print action buttons', () => {
  it('renders the "Customer Summary" print button', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /print customer summary/i })).toBeTruthy();
  });

  it('renders the "Technical Spec" print button', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /print technical specification/i })).toBeTruthy();
  });

  it('does NOT render "Comparison Sheet" button when fewer than 2 options are returned', () => {
    render(
      <LiveHubPage result={makeResult({ optionCount: 0 })} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.queryByRole('button', { name: /print comparison sheet/i })).toBeNull();
  });

  it('renders the "Comparison Sheet" button when 2 or more options exist', () => {
    render(
      <LiveHubPage result={makeResult({ optionCount: 2 })} input={makeInput()} onBack={() => {}} />,
    );
    expect(screen.getByRole('button', { name: /print comparison sheet/i })).toBeTruthy();
  });
});

describe('LiveHubPage — print overlay navigation', () => {
  it('clicking "Customer Summary" renders the LabPrintCustomer overlay', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print customer summary/i }));
    // LabPrintCustomer renders an h1 "Customer Summary"
    expect(
      screen.getByRole('heading', { level: 1, name: 'Customer Summary' }),
    ).toBeTruthy();
  });

  it('clicking "Technical Spec" renders the LabPrintTechnical overlay', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print technical specification/i }));
    // LabPrintTechnical renders an h1 "Technical Specification"
    expect(
      screen.getByRole('heading', { level: 1, name: 'Technical Specification' }),
    ).toBeTruthy();
  });

  it('clicking "Comparison Sheet" renders the LabPrintComparison overlay', () => {
    render(
      <LiveHubPage result={makeResult({ optionCount: 2 })} input={makeInput()} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print comparison sheet/i }));
    // LabPrintComparison renders an h1 "Comparison Sheet"
    expect(
      screen.getByRole('heading', { level: 1, name: 'Comparison Sheet' }),
    ).toBeTruthy();
  });

  it('"← Back to Lab" in the print overlay returns to the hub', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    // Open the customer print overlay
    fireEvent.click(screen.getByRole('button', { name: /print customer summary/i }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Customer Summary' }),
    ).toBeTruthy();

    // Click "← Back to Lab" to dismiss the overlay
    fireEvent.click(screen.getByText('← Back to Lab'));

    // Hub should be shown again (Live Output Hub heading is present)
    expect(screen.getByText('📡 Live Output Hub')).toBeTruthy();
  });
});

describe('LiveHubPage — print surfaces use existing lab components', () => {
  it('Customer Summary print surface shows ATLAS brand (reuses LabPrintCustomer)', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print customer summary/i }));
    expect(screen.getByText('ATLAS')).toBeTruthy();
  });

  it('Technical Spec print surface shows ATLAS brand (reuses LabPrintTechnical)', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print technical specification/i }));
    expect(screen.getByText('ATLAS')).toBeTruthy();
  });

  it('print surfaces include a "Print / Save PDF" button', () => {
    render(
      <LiveHubPage result={makeResult()} input={makeInput()} onBack={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print customer summary/i }));
    expect(screen.getByText(/Print \/ Save PDF/)).toBeTruthy();
  });
});
