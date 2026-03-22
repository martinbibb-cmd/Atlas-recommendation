/**
 * UnifiedSimulatorView.test.tsx
 *
 * Regression tests for the unified simulator surface:
 *
 * - Day Painter placeholder must NOT appear in the customer-facing simulator
 * - Save report, share portal and print report actions must be visible
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnifiedSimulatorView from '../UnifiedSimulatorView';
import type { EngineOutputV1, OptionCardV1 } from '../../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOption(
  id: OptionCardV1['id'],
  status: OptionCardV1['status'],
): OptionCardV1 {
  return {
    id,
    label: id,
    status,
    headline: `${id} headline`,
    why: [`${id} is suitable`],
    requirements: [],
    typedRequirements: {
      mustHave: [`Install ${id}`, 'Magnetic filter on primary return'],
      likelyUpgrades: [],
      niceToHave: [],
    },
    heat: { status: 'ok', headline: 'Heat ok', bullets: [] },
    dhw:  { status: 'ok', headline: 'DHW ok',  bullets: [] },
    engineering: { status: 'ok', headline: 'Eng ok', bullets: [] },
    sensitivities: [],
  };
}

const DEMO_ENGINE_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'Combi boiler' },
  explainers: [],
  options: [
    makeOption('combi', 'viable'),
    makeOption('stored_unvented', 'caution'),
  ],
  verdict: {
    title: 'Good match',
    status: 'good',
    reasons: ['Good mains pressure for combi'],
    confidence: { level: 'medium', reasons: [] },
    assumptionsUsed: [],
    primaryReason: 'Low demand favours on-demand hot water',
  },
};

const DEMO_SURVEY: FullSurveyModelV1 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 1.8,
  mainsDynamicFlowLpm: 12,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  bathroomCount: 1,
  occupancyCount: 3,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'professional',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: true,
} as unknown as FullSurveyModelV1;

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Day Painter placeholder ──────────────────────────────────────────────────

describe('UnifiedSimulatorView — Day Painter placeholder regression', () => {
  it('does not render the Day Painter placeholder in the customer-facing simulator', () => {
    render(
      <UnifiedSimulatorView
        engineOutput={DEMO_ENGINE_OUTPUT}
        surveyData={DEMO_SURVEY}
      />,
    );
    // The placeholder div should be absent from the document.
    expect(document.querySelector('[aria-label="Day Painter placeholder"]')).toBeNull();
  });

  it('does not render text saying "placeholder for the next iteration"', () => {
    render(
      <UnifiedSimulatorView
        engineOutput={DEMO_ENGINE_OUTPUT}
        surveyData={DEMO_SURVEY}
      />,
    );
    expect(screen.queryByText(/placeholder for the next iteration/i)).toBeNull();
  });

  it('does not render a Day Painter label chip', () => {
    render(
      <UnifiedSimulatorView
        engineOutput={DEMO_ENGINE_OUTPUT}
        surveyData={DEMO_SURVEY}
      />,
    );
    expect(screen.queryByText(/day painter/i)).toBeNull();
  });
});

// ─── Save / report / share actions ───────────────────────────────────────────

describe('UnifiedSimulatorView — save/report/share actions', () => {
  it('renders a Save report button', () => {
    render(
      <UnifiedSimulatorView
        engineOutput={DEMO_ENGINE_OUTPUT}
        surveyData={DEMO_SURVEY}
      />,
    );
    expect(screen.getByRole('button', { name: /save report/i })).toBeTruthy();
  });

  it('renders a Print report button', () => {
    render(
      <UnifiedSimulatorView
        engineOutput={DEMO_ENGINE_OUTPUT}
        surveyData={DEMO_SURVEY}
      />,
    );
    expect(screen.getByRole('button', { name: /print report/i })).toBeTruthy();
  });

  it('save report button is within the simulator-actions container', () => {
    render(
      <UnifiedSimulatorView
        engineOutput={DEMO_ENGINE_OUTPUT}
        surveyData={DEMO_SURVEY}
      />,
    );
    const actionsContainer = document.querySelector('[data-testid="simulator-actions"]');
    expect(actionsContainer).not.toBeNull();
    const saveBtn = actionsContainer?.querySelector('[data-testid="save-report-btn"]');
    expect(saveBtn).not.toBeNull();
  });

  it('print report button is within the simulator-actions container', () => {
    render(
      <UnifiedSimulatorView
        engineOutput={DEMO_ENGINE_OUTPUT}
        surveyData={DEMO_SURVEY}
      />,
    );
    const actionsContainer = document.querySelector('[data-testid="simulator-actions"]');
    const printBtn = actionsContainer?.querySelector('[data-testid="print-report-btn"]');
    expect(printBtn).not.toBeNull();
  });

  it('share portal button is not visible before saving (requires a saved report ID)', () => {
    render(
      <UnifiedSimulatorView
        engineOutput={DEMO_ENGINE_OUTPUT}
        surveyData={DEMO_SURVEY}
      />,
    );
    expect(screen.queryByRole('button', { name: /share portal/i })).toBeNull();
  });
});
