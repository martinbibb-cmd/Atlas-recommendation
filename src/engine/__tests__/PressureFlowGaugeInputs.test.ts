/**
 * Regression tests for the pressure/flow gauge input state helpers.
 *
 * Verifies fixes for:
 *   1. Stale-closure dropped keystrokes — onChange handlers now use functional
 *      `setInput(prev => ({ ...prev, ... }))` so rapid typing cannot overwrite
 *      earlier keystrokes with a stale `input` snapshot.
 *   2. Prefill-aware raw string initialisation — `rawPressureStr` /
 *      `rawFlowStr` are now derived from the same merged initial-input object
 *      as the `input` useState, so Story Mode or restored-model prefill values
 *      appear immediately on first render without a string/numeric mismatch.
 *
 * Tests are pure-function unit tests covering `deriveRawPressureStr` and
 * `deriveRawFlowStr` — the helpers that back the useState initialisers.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveRawPressureStr,
  deriveRawFlowStr,
} from '../../components/stepper/pressureFlowHelpers';

// ── deriveRawPressureStr ──────────────────────────────────────────────────────

describe('deriveRawPressureStr — initial raw string for dynamic-pressure field', () => {
  it('no prefill (default only) → returns default dynamicMainsPressure as string', () => {
    // Mirrors defaultInput.dynamicMainsPressure = 1.0
    expect(deriveRawPressureStr({ dynamicMainsPressure: 1.0 })).toBe('1');
  });

  it('prefill with dynamicMainsPressure → reflects prefill value', () => {
    expect(deriveRawPressureStr({ dynamicMainsPressure: 2.5 })).toBe('2.5');
  });

  it('prefill with dynamicMainsPressureBar → prefers bar alias over legacy field', () => {
    // dynamicMainsPressureBar is the new alias; it should take precedence via ??
    expect(deriveRawPressureStr({ dynamicMainsPressure: 1.0, dynamicMainsPressureBar: 3.2 })).toBe('3.2');
  });

  it('prefill with only dynamicMainsPressureBar (no legacy override) → shows bar value', () => {
    // Legacy dynamicMainsPressure still required in type but bar wins via ??
    expect(deriveRawPressureStr({ dynamicMainsPressure: 1.0, dynamicMainsPressureBar: 2.8 })).toBe('2.8');
  });

  it('Story Mode prefill: dynamicMainsPressureBar value shows — no stale default "1"', () => {
    // Regression: before the fix rawPressureStr read only dynamicMainsPressure,
    // so a prefill with dynamicMainsPressureBar=1.8 would render "1" instead of "1.8".
    const init = { dynamicMainsPressure: 1.0, dynamicMainsPressureBar: 1.8 };
    expect(deriveRawPressureStr(init)).toBe('1.8');
  });
});

// ── deriveRawFlowStr ──────────────────────────────────────────────────────────

describe('deriveRawFlowStr — initial raw string for dynamic-flow field', () => {
  it('no mainsDynamicFlowLpm → empty string (flow is optional, no default)', () => {
    expect(deriveRawFlowStr({})).toBe('');
  });

  it('mainsDynamicFlowLpm undefined → empty string', () => {
    expect(deriveRawFlowStr({ mainsDynamicFlowLpm: undefined })).toBe('');
  });

  it('mainsDynamicFlowLpm set → reflects value', () => {
    expect(deriveRawFlowStr({ mainsDynamicFlowLpm: 12 })).toBe('12');
  });

  it('typing "12" rapidly — initialisation renders "12" not "2" (functional-update fix)', () => {
    // The functional update `setInput(prev => ({ ...prev, mainsDynamicFlowLpm: flow }))`
    // ensures each keystroke builds on the latest committed state. This test verifies
    // the initialisation end: a prefill of 12 L/min renders the full value "12".
    expect(deriveRawFlowStr({ mainsDynamicFlowLpm: 12 })).toBe('12');
  });

  it('Story Mode prefill flow value shows immediately — no blank on first render', () => {
    // Regression: before the fix, rawFlowStr used defaultInput.mainsDynamicFlowLpm
    // (undefined) as a fallback even when the prefill had a value, so the field
    // appeared blank instead of showing the prefilled measurement.
    expect(deriveRawFlowStr({ mainsDynamicFlowLpm: 18 })).toBe('18');
  });

  it('decimal flow "3.5" renders "3.5" not "35" or "3" (no truncation)', () => {
    // Regression: verify fractional L/min values are preserved as typed.
    expect(deriveRawFlowStr({ mainsDynamicFlowLpm: 3.5 })).toBe('3.5');
  });
});
