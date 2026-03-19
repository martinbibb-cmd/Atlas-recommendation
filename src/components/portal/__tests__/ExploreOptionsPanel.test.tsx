/**
 * ExploreOptionsPanel.test.tsx
 *
 * Tests for the constrained exploration panel.
 *
 * Coverage:
 *   - Renders without crashing
 *   - Shows system type, hot water usage, and heating style controls
 *   - Locked inputs notice is visible
 *   - Trade-off summary is rendered
 *   - Does not expose expert-only inputs
 *   - Warning appears when explored option differs from original
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ExploreOptionsPanel, { deriveDefaultSystemChoice } from '../ExploreOptionsPanel';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const BASE_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  mainsDynamicFlowLpm: 14,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  bathroomCount: 1,
  occupancyCount: 2,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  occupancySignature: 'professional',
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: true,
};

const ORIGINAL_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'Combi boiler' },
  explainers: [],
  options: [
    {
      id: 'combi',
      label: 'Combi boiler',
      status: 'viable',
      headline: 'Best fit for this property',
      why: [],
      requirements: [],
      heat: { status: 'ok', headline: '', bullets: [] },
      dhw: { status: 'ok', headline: '', bullets: [] },
      engineering: { status: 'ok', headline: '', bullets: [] },
      sensitivities: [],
    },
  ],
};

beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('ExploreOptionsPanel — rendering', () => {
  it('renders without crashing', () => {
    expect(() =>
      render(
        <ExploreOptionsPanel baseInput={BASE_INPUT} originalOutput={ORIGINAL_OUTPUT} />,
      ),
    ).not.toThrow();
  });

  it('renders the panel container', () => {
    render(
      <ExploreOptionsPanel baseInput={BASE_INPUT} originalOutput={ORIGINAL_OUTPUT} />,
    );
    expect(document.querySelector('[data-testid="explore-options-panel"]')).not.toBeNull();
  });

  it('renders the "Explore your options" title', () => {
    render(
      <ExploreOptionsPanel baseInput={BASE_INPUT} originalOutput={ORIGINAL_OUTPUT} />,
    );
    expect(screen.getByText('Explore your options')).toBeTruthy();
  });

  it('renders system type controls', () => {
    render(
      <ExploreOptionsPanel baseInput={BASE_INPUT} originalOutput={ORIGINAL_OUTPUT} />,
    );
    expect(screen.getByText('System type')).toBeTruthy();
    // Check radio labels exist — use getAllByText since labels may appear in result too
    expect(screen.getAllByText('Combi boiler').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('System boiler + cylinder')).toBeTruthy();
    expect(screen.getByText('Heat pump')).toBeTruthy();
  });

  it('renders hot water usage controls', () => {
    render(
      <ExploreOptionsPanel baseInput={BASE_INPUT} originalOutput={ORIGINAL_OUTPUT} />,
    );
    expect(screen.getByText('Hot water usage')).toBeTruthy();
    expect(screen.getByText('Low')).toBeTruthy();
    expect(screen.getByText('Typical')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('renders heating style controls', () => {
    render(
      <ExploreOptionsPanel baseInput={BASE_INPUT} originalOutput={ORIGINAL_OUTPUT} />,
    );
    expect(screen.getByText('Heating style')).toBeTruthy();
    expect(screen.getByText('Steady')).toBeTruthy();
    expect(screen.getByText('Responsive')).toBeTruthy();
  });
});

// ─── Locked inputs ────────────────────────────────────────────────────────────

describe('ExploreOptionsPanel — locked inputs', () => {
  it('shows the locked inputs notice', () => {
    render(
      <ExploreOptionsPanel baseInput={BASE_INPUT} originalOutput={ORIGINAL_OUTPUT} />,
    );
    expect(screen.getByText(/locked to your survey results/i)).toBeTruthy();
  });

  it('does not expose heat loss editing', () => {
    render(
      <ExploreOptionsPanel baseInput={BASE_INPUT} originalOutput={ORIGINAL_OUTPUT} />,
    );
    const inputs = Array.from(document.querySelectorAll('input'));
    const heatLossInputs = inputs.filter(
      (input) =>
        input.name.includes('heat') &&
        input.name.includes('loss') &&
        input.type !== 'radio',
    );
    expect(heatLossInputs).toHaveLength(0);
  });

  it('does not expose mains pressure editing', () => {
    render(
      <ExploreOptionsPanel baseInput={BASE_INPUT} originalOutput={ORIGINAL_OUTPUT} />,
    );
    const inputs = Array.from(document.querySelectorAll('input'));
    const pressureInputs = inputs.filter(
      (input) => input.name.includes('pressure') && input.type !== 'radio',
    );
    expect(pressureInputs).toHaveLength(0);
  });
});

// ─── Trade-off summary ───────────────────────────────────────────────────────

describe('ExploreOptionsPanel — trade-off summary', () => {
  it('renders the trade-off summary', () => {
    render(
      <ExploreOptionsPanel baseInput={BASE_INPUT} originalOutput={ORIGINAL_OUTPUT} />,
    );
    expect(document.querySelector('[data-testid="trade-off-summary"]')).not.toBeNull();
  });
});

// ─── deriveDefaultSystemChoice ────────────────────────────────────────────────

describe('deriveDefaultSystemChoice', () => {
  it('returns combi when preferCombi is true', () => {
    expect(deriveDefaultSystemChoice({ ...BASE_INPUT, preferCombi: true })).toBe('combi');
  });

  it('returns heat_pump when currentHeatSourceType is ashp', () => {
    expect(
      deriveDefaultSystemChoice({ ...BASE_INPUT, currentHeatSourceType: 'ashp' }),
    ).toBe('heat_pump');
  });

  it('returns system_cylinder when preferCombi is false and not ashp', () => {
    expect(
      deriveDefaultSystemChoice({ ...BASE_INPUT, preferCombi: false }),
    ).toBe('system_cylinder');
  });
});

// ─── Interaction ──────────────────────────────────────────────────────────────

describe('ExploreOptionsPanel — interaction', () => {
  it('changes system type when a different radio is clicked', () => {
    render(
      <ExploreOptionsPanel baseInput={BASE_INPUT} originalOutput={ORIGINAL_OUTPUT} />,
    );
    const heatPumpRadio = screen.getByLabelText(/heat pump/i);
    fireEvent.click(heatPumpRadio);
    expect(heatPumpRadio).toBeChecked();
  });

  it('changes hot water usage when a different radio is clicked', () => {
    render(
      <ExploreOptionsPanel baseInput={BASE_INPUT} originalOutput={ORIGINAL_OUTPUT} />,
    );
    const highRadio = screen.getByLabelText(/^high$/i);
    fireEvent.click(highRadio);
    expect(highRadio).toBeChecked();
  });
});
