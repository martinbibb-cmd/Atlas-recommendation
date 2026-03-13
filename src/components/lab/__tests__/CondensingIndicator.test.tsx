/**
 * CondensingIndicator.test.tsx
 *
 * PR 5 — Condensing Signal Audit
 *
 * Validates that CondensingIndicator:
 *   - Shows "not available" state when condensingState is null or omitted
 *   - Renders the progress bar with correct aria attributes when data is supplied
 *   - Shows the expert debug panel with correct values
 *   - Reflects condensing, borderline, and non-condensing zone states
 *   - computeCondensingPct returns correct values at key temperatures
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CondensingIndicator, { computeCondensingPct } from '../CondensingIndicator';
import type { CondensingStateResult } from '../../../engine/schema/EngineInputV2_3';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCondensingState(
  overrides: Partial<CondensingStateResult> & { flowTempC: number; fullLoadReturnC: number },
): CondensingStateResult {
  return {
    zone: overrides.fullLoadReturnC < 55
      ? 'condensing'
      : overrides.fullLoadReturnC <= 65
        ? 'borderline'
        : 'non_condensing',
    typicalReturnC: overrides.fullLoadReturnC - 10,
    condensingThresholdC: 55,
    estimatedCondensingFractionPct: 80,
    returnTempSource: 'derived',
    drivers: [],
    notes: [],
    ...overrides,
  };
}

// ─── computeCondensingPct ─────────────────────────────────────────────────────

describe('computeCondensingPct', () => {
  it('returns 100 % at 35 °C (fully optimal)', () => {
    expect(computeCondensingPct(35)).toBe(100);
  });

  it('returns 0 % at 65 °C (non-condensing threshold)', () => {
    expect(computeCondensingPct(65)).toBe(0);
  });

  it('returns 50 % at 50 °C (midpoint)', () => {
    expect(computeCondensingPct(50)).toBe(50);
  });

  it('clamps to 100 % below 35 °C', () => {
    expect(computeCondensingPct(20)).toBe(100);
  });

  it('clamps to 0 % above 65 °C', () => {
    expect(computeCondensingPct(75)).toBe(0);
  });

  it('condensing fraction decreases as return temperature increases', () => {
    expect(computeCondensingPct(40)).toBeGreaterThan(computeCondensingPct(50));
    expect(computeCondensingPct(50)).toBeGreaterThan(computeCondensingPct(60));
  });
});

// ─── Not-available state ──────────────────────────────────────────────────────

describe('CondensingIndicator — not available state', () => {
  it('renders "not available" when condensingState is null', () => {
    render(<CondensingIndicator condensingState={null} />);
    expect(screen.getByText('— not available')).toBeTruthy();
  });

  it('renders "not available" when condensingState is omitted', () => {
    render(<CondensingIndicator />);
    expect(screen.getByText('— not available')).toBeTruthy();
  });

  it('applies the correct aria-label for not-available state', () => {
    render(<CondensingIndicator condensingState={null} />);
    const el = screen.getByLabelText('Condensing operation: not available');
    expect(el).toBeTruthy();
  });

  it('does not render a progress bar when condensingState is null', () => {
    render(<CondensingIndicator condensingState={null} />);
    expect(document.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('still renders the heading when not available', () => {
    render(<CondensingIndicator condensingState={null} />);
    expect(screen.getByText('Condensing Operation')).toBeTruthy();
  });
});

// ─── Data-driven state ────────────────────────────────────────────────────────

describe('CondensingIndicator — condensing zone (return < 55 °C)', () => {
  it('renders a progress bar with correct aria-valuenow', () => {
    const cs = makeCondensingState({ flowTempC: 70, fullLoadReturnC: 50 });
    render(<CondensingIndicator condensingState={cs} />);
    const bar = document.querySelector('[role="progressbar"]');
    expect(bar).toBeTruthy();
    expect(bar!.getAttribute('aria-valuenow')).toBe(String(computeCondensingPct(50)));
  });

  it('shows "Full condensing operation" label', () => {
    // 40 °C return → 83 % → green band
    const cs = makeCondensingState({ flowTempC: 60, fullLoadReturnC: 40 });
    render(<CondensingIndicator condensingState={cs} />);
    expect(screen.getByText('Full condensing operation')).toBeTruthy();
  });
});

describe('CondensingIndicator — borderline zone (55–65 °C return)', () => {
  it('shows "Partial condensing operation" label', () => {
    // 60 °C return → 17 % → red band?  No: 60 °C → pct = 17 → red.
    // Let's use 50 °C → 50 % → amber.
    const cs = makeCondensingState({ flowTempC: 70, fullLoadReturnC: 50, zone: 'borderline' });
    render(<CondensingIndicator condensingState={cs} />);
    // 50 % falls in the amber band → "Partial condensing operation"
    expect(screen.getByText('Partial condensing operation')).toBeTruthy();
  });
});

describe('CondensingIndicator — non-condensing zone (return > 65 °C)', () => {
  it('shows "Non-condensing — return temp too high" label', () => {
    // 70 °C return → 0 % → red band
    const cs = makeCondensingState({ flowTempC: 90, fullLoadReturnC: 70, zone: 'non_condensing' });
    render(<CondensingIndicator condensingState={cs} />);
    expect(screen.getByText('Non-condensing — return temp too high')).toBeTruthy();
  });
});

// ─── Expert debug panel ───────────────────────────────────────────────────────

describe('CondensingIndicator — expert debug panel', () => {
  it('shows the debug panel when condensingState is provided', () => {
    const cs = makeCondensingState({ flowTempC: 70, fullLoadReturnC: 50 });
    render(<CondensingIndicator condensingState={cs} />);
    const debug = document.querySelector('[aria-label="Condensing signal debug"]');
    expect(debug).toBeTruthy();
  });

  it('displays the flow temperature', () => {
    const cs = makeCondensingState({ flowTempC: 70, fullLoadReturnC: 50 });
    render(<CondensingIndicator condensingState={cs} />);
    expect(screen.getByText('70 °C')).toBeTruthy();
  });

  it('displays the return temperature', () => {
    const cs = makeCondensingState({ flowTempC: 70, fullLoadReturnC: 50 });
    render(<CondensingIndicator condensingState={cs} />);
    expect(screen.getByText('50.0 °C')).toBeTruthy();
  });

  it('displays the condensing threshold', () => {
    const cs = makeCondensingState({ flowTempC: 70, fullLoadReturnC: 50 });
    render(<CondensingIndicator condensingState={cs} />);
    expect(screen.getByText('55 °C')).toBeTruthy();
  });

  it('displays the source label for derived return', () => {
    const cs = makeCondensingState({ flowTempC: 70, fullLoadReturnC: 50, returnTempSource: 'derived' });
    render(<CondensingIndicator condensingState={cs} />);
    expect(screen.getByText('derived (flowTempC − ΔT)')).toBeTruthy();
  });

  it('displays the source label for onePipeCascade return', () => {
    const cs = makeCondensingState({ flowTempC: 90, fullLoadReturnC: 48, returnTempSource: 'onePipeCascade' });
    render(<CondensingIndicator condensingState={cs} />);
    expect(screen.getByText('onePipeCascade (measured)')).toBeTruthy();
  });

  it('shows condensing state emoji in the debug panel for condensing zone', () => {
    const cs = makeCondensingState({ flowTempC: 70, fullLoadReturnC: 50, zone: 'condensing' });
    render(<CondensingIndicator condensingState={cs} />);
    expect(screen.getByText('✅ Condensing')).toBeTruthy();
  });

  it('shows borderline state emoji in the debug panel for borderline zone', () => {
    const cs = makeCondensingState({ flowTempC: 75, fullLoadReturnC: 55, zone: 'borderline' });
    render(<CondensingIndicator condensingState={cs} />);
    expect(screen.getByText('⚠️ Borderline')).toBeTruthy();
  });

  it('shows non-condensing state emoji in the debug panel for non_condensing zone', () => {
    const cs = makeCondensingState({ flowTempC: 90, fullLoadReturnC: 70, zone: 'non_condensing' });
    render(<CondensingIndicator condensingState={cs} />);
    expect(screen.getByText('🔴 Not condensing')).toBeTruthy();
  });

  it('does not show the debug panel when condensingState is null', () => {
    render(<CondensingIndicator condensingState={null} />);
    const debug = document.querySelector('[aria-label="Condensing signal debug"]');
    expect(debug).toBeNull();
  });
});
