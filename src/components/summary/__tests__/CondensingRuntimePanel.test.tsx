/**
 * CondensingRuntimePanel.test.tsx
 *
 * PR 7 — Condensing Runtime Panel
 *
 * Validates that CondensingRuntimePanel:
 *   - Shows "not available" state when condensingRuntime is null or omitted
 *   - Renders the percentage, band label, and progress bar when data is supplied
 *   - Shows current condensing state separately from runtime estimate
 *   - Renders positive and negative driver strings with correct styling
 *   - Shows proxy caveat when proxy drivers are present
 *   - Handles missing condensingState gracefully
 *
 * Test cases:
 *   - Strong low-temp case (high condensing runtime)
 *   - Hotter-flow / weaker-emitter case (low runtime)
 *   - S-plan vs Y-plan comparison
 *   - Mixergy vs standard stored-water comparison
 *   - Missing data / unavailable case
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CondensingRuntimePanel from '../CondensingRuntimePanel';
import type {
  CondensingRuntimeResult,
  CondensingRuntimeDriver,
  CondensingStateResult,
} from '../../../engine/schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDriver(
  id: CondensingRuntimeDriver['id'],
  influence: CondensingRuntimeDriver['influence'],
  detail = 'detail text',
): CondensingRuntimeDriver {
  return { id, label: id, influence, scoreContribution: 0, detail };
}

function makeCondensingRuntime(
  overrides: Partial<CondensingRuntimeResult> = {},
): CondensingRuntimeResult {
  return {
    estimatedCondensingRuntimePct: 68,
    drivers: [
      makeDriver('current_condensing_state', 'positive'),
      makeDriver('design_flow_temperature', 'positive'),
      makeDriver('emitter_suitability', 'positive'),
      makeDriver('control_type', 'positive'),
      makeDriver('system_separation_arrangement', 'neutral'),
      makeDriver('dhw_demand_stability', 'neutral'),
      makeDriver('primary_suitability_proxy', 'neutral'),
    ],
    positiveWording: [],
    negativeWording: [],
    notes: [],
    ...overrides,
  };
}

function makeCondensingState(
  zone: CondensingStateResult['zone'] = 'condensing',
): CondensingStateResult {
  return {
    zone,
    flowTempC: 70,
    fullLoadReturnC: 50,
    typicalReturnC: 45,
    condensingThresholdC: 55,
    estimatedCondensingFractionPct: 72,
    returnTempSource: 'derived',
    drivers: [],
    notes: [],
  };
}

// ─── Not-available state ──────────────────────────────────────────────────────

describe('CondensingRuntimePanel — not available state', () => {
  it('renders "not available" when condensingRuntime is null', () => {
    render(<CondensingRuntimePanel condensingRuntime={null} />);
    expect(screen.getByText('— not available')).toBeTruthy();
  });

  it('renders "not available" when condensingRuntime is omitted', () => {
    render(<CondensingRuntimePanel />);
    expect(screen.getByText('— not available')).toBeTruthy();
  });

  it('shows the panel title even when not available', () => {
    render(<CondensingRuntimePanel condensingRuntime={null} />);
    expect(screen.getByText('Estimated Condensing Runtime')).toBeTruthy();
  });

  it('applies the unavailable aria-label', () => {
    render(<CondensingRuntimePanel condensingRuntime={null} />);
    const el = screen.getByLabelText('Estimated Condensing Runtime: not available');
    expect(el).toBeTruthy();
  });

  it('does not render a progress bar when unavailable', () => {
    render(<CondensingRuntimePanel condensingRuntime={null} />);
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
  });
});

// ─── Data-driven state ────────────────────────────────────────────────────────

describe('CondensingRuntimePanel — percentage and band', () => {
  it('renders the percentage when data is supplied', () => {
    render(<CondensingRuntimePanel condensingRuntime={makeCondensingRuntime({ estimatedCondensingRuntimePct: 68 })} />);
    expect(screen.getByText('68%')).toBeTruthy();
  });

  it('shows "Moderate" band at 68 %', () => {
    render(<CondensingRuntimePanel condensingRuntime={makeCondensingRuntime({ estimatedCondensingRuntimePct: 68 })} />);
    expect(screen.getByText('Moderate')).toBeTruthy();
  });

  it('shows "High" band at 70 %', () => {
    render(<CondensingRuntimePanel condensingRuntime={makeCondensingRuntime({ estimatedCondensingRuntimePct: 70 })} />);
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('shows "High" band at 85 % (strong low-temp case)', () => {
    render(<CondensingRuntimePanel condensingRuntime={makeCondensingRuntime({ estimatedCondensingRuntimePct: 85 })} />);
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('shows "Low" band at 35 % (hotter-flow / weaker-emitter case)', () => {
    render(<CondensingRuntimePanel condensingRuntime={makeCondensingRuntime({ estimatedCondensingRuntimePct: 35 })} />);
    expect(screen.getByText('Low')).toBeTruthy();
  });

  it('shows "Low" band at 0 %', () => {
    render(<CondensingRuntimePanel condensingRuntime={makeCondensingRuntime({ estimatedCondensingRuntimePct: 0 })} />);
    expect(screen.getByText('Low')).toBeTruthy();
  });

  it('renders a progress bar with correct aria-valuenow', () => {
    render(<CondensingRuntimePanel condensingRuntime={makeCondensingRuntime({ estimatedCondensingRuntimePct: 68 })} />);
    const bar = document.querySelector('[role="progressbar"]');
    expect(bar).toBeTruthy();
    expect(bar!.getAttribute('aria-valuenow')).toBe('68');
  });

  it('applies the correct aria-label to the panel', () => {
    render(<CondensingRuntimePanel condensingRuntime={makeCondensingRuntime({ estimatedCondensingRuntimePct: 68 })} />);
    expect(screen.getByLabelText('Estimated Condensing Runtime: 68%')).toBeTruthy();
  });
});

// ─── Current condensing state ─────────────────────────────────────────────────

describe('CondensingRuntimePanel — current condensing state', () => {
  it('shows "Condensing now" when zone is condensing', () => {
    render(
      <CondensingRuntimePanel
        condensingRuntime={makeCondensingRuntime()}
        condensingState={makeCondensingState('condensing')}
      />,
    );
    expect(screen.getByText('✅ Condensing now')).toBeTruthy();
  });

  it('shows "Borderline" when zone is borderline', () => {
    render(
      <CondensingRuntimePanel
        condensingRuntime={makeCondensingRuntime()}
        condensingState={makeCondensingState('borderline')}
      />,
    );
    expect(screen.getByText('⚠️ Borderline')).toBeTruthy();
  });

  it('shows "Not condensing" when zone is non_condensing', () => {
    render(
      <CondensingRuntimePanel
        condensingRuntime={makeCondensingRuntime()}
        condensingState={makeCondensingState('non_condensing')}
      />,
    );
    expect(screen.getByText('🔴 Not condensing')).toBeTruthy();
  });

  it('shows "not available" badge when condensingState is null', () => {
    render(
      <CondensingRuntimePanel
        condensingRuntime={makeCondensingRuntime()}
        condensingState={null}
      />,
    );
    expect(screen.getByText('— not available')).toBeTruthy();
  });

  it('shows "not available" badge when condensingState is omitted', () => {
    render(<CondensingRuntimePanel condensingRuntime={makeCondensingRuntime()} />);
    expect(screen.getByText('— not available')).toBeTruthy();
  });

  it('shows "Current state" section heading when runtime data present', () => {
    render(<CondensingRuntimePanel condensingRuntime={makeCondensingRuntime()} />);
    expect(screen.getByText('Current state')).toBeTruthy();
  });
});

// ─── Driver wording ───────────────────────────────────────────────────────────

describe('CondensingRuntimePanel — driver wording', () => {
  it('renders positive wording with + icon', () => {
    const runtime = makeCondensingRuntime({
      positiveWording: ['Separated heating and hot water control supports steadier operation.'],
    });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.getByText('Separated heating and hot water control supports steadier operation.')).toBeTruthy();
    const icons = document.querySelectorAll('.crt-panel__driver-icon');
    expect(Array.from(icons).some(el => el.textContent === '+')).toBe(true);
  });

  it('renders negative wording with − icon', () => {
    const runtime = makeCondensingRuntime({
      negativeWording: ['Primary performance may limit lower-temperature operation at higher loads.'],
    });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.getByText('Primary performance may limit lower-temperature operation at higher loads.')).toBeTruthy();
    const icons = document.querySelectorAll('.crt-panel__driver-icon');
    expect(Array.from(icons).some(el => el.textContent === '−')).toBe(true);
  });

  it('renders both positive and negative wording together', () => {
    const runtime = makeCondensingRuntime({
      positiveWording: ['Mixergy demand mirroring reduces cycling and supports steadier condensing operation.'],
      negativeWording: ['Fixed high flow temperature (no weather compensation) reduces condensing hours.'],
    });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.getByText('Mixergy demand mirroring reduces cycling and supports steadier condensing operation.')).toBeTruthy();
    expect(screen.getByText('Fixed high flow temperature (no weather compensation) reduces condensing hours.')).toBeTruthy();
  });

  it('shows "Main drivers" section heading when wording is present', () => {
    const runtime = makeCondensingRuntime({
      positiveWording: ['Emitters support condensing operation at the target flow temperature.'],
    });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.getByText('Main drivers')).toBeTruthy();
  });

  it('hides "Main drivers" section when wording arrays are empty', () => {
    const runtime = makeCondensingRuntime({ positiveWording: [], negativeWording: [] });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.queryByText('Main drivers')).toBeNull();
  });
});

// ─── Proxy caveat ─────────────────────────────────────────────────────────────

describe('CondensingRuntimePanel — proxy caveat', () => {
  it('shows caveat when primary_suitability_proxy driver is present', () => {
    const runtime = makeCondensingRuntime({
      drivers: [makeDriver('primary_suitability_proxy', 'neutral', 'some detail')],
    });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.getByRole('note')).toBeTruthy();
    expect(screen.getByText(/inferred from survey responses/)).toBeTruthy();
  });

  it('shows caveat when control_type driver is present', () => {
    const runtime = makeCondensingRuntime({
      drivers: [makeDriver('control_type', 'positive', 'full install detail')],
    });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.getByRole('note')).toBeTruthy();
  });

  it('shows caveat when system_separation_arrangement detail mentions "not recorded"', () => {
    const runtime = makeCondensingRuntime({
      drivers: [
        makeDriver('system_separation_arrangement', 'neutral', 'System zone arrangement not recorded — assuming Y-plan baseline.'),
      ],
    });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.getByRole('note')).toBeTruthy();
  });

  it('does not show caveat when none of the proxy driver IDs are present', () => {
    const runtime = makeCondensingRuntime({
      drivers: [
        makeDriver('current_condensing_state', 'positive'),
        makeDriver('design_flow_temperature', 'positive'),
        makeDriver('emitter_suitability', 'positive'),
        makeDriver('dhw_demand_stability', 'positive'),
      ],
    });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});

// ─── S-plan vs Y-plan comparison ─────────────────────────────────────────────

describe('CondensingRuntimePanel — S-plan vs Y-plan comparison', () => {
  it('S-plan: shows positive driver for system separation', () => {
    const runtime = makeCondensingRuntime({
      estimatedCondensingRuntimePct: 75,
      positiveWording: ['Separated heating and hot water control supports steadier operation.'],
    });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.getByText('Separated heating and hot water control supports steadier operation.')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('Y-plan: no separation wording when system is Y-plan (neutral)', () => {
    const runtime = makeCondensingRuntime({
      estimatedCondensingRuntimePct: 68,
      positiveWording: [],
    });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.queryByText('Separated heating and hot water control supports steadier operation.')).toBeNull();
    expect(screen.getByText('Moderate')).toBeTruthy();
  });
});

// ─── Mixergy comparison ───────────────────────────────────────────────────────

describe('CondensingRuntimePanel — Mixergy vs standard stored-water', () => {
  it('Mixergy: shows demand mirroring positive wording', () => {
    const runtime = makeCondensingRuntime({
      estimatedCondensingRuntimePct: 78,
      positiveWording: ['Mixergy demand mirroring reduces cycling and supports steadier condensing operation.'],
    });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.getByText('Mixergy demand mirroring reduces cycling and supports steadier condensing operation.')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('standard cylinder: no Mixergy wording', () => {
    const runtime = makeCondensingRuntime({
      estimatedCondensingRuntimePct: 65,
      positiveWording: [],
    });
    render(<CondensingRuntimePanel condensingRuntime={runtime} />);
    expect(screen.queryByText(/Mixergy/)).toBeNull();
    expect(screen.getByText('Moderate')).toBeTruthy();
  });
});
