/**
 * flueEquivalentLength.integration.test.ts
 *
 * Integration tests covering the new segment kinds added by the flue route builder.
 *
 * Acceptance criteria (from problem statement):
 *   - Horizontal flue with 3 m straight + 1 × 90° = 5 m equivalent (generic estimate).
 *   - Two 45° elbows add 2.0 m generic equivalent.
 *   - Missing manufacturer max → needs_model_specific_check.
 *   - Known max → within_allowance or exceeds_allowance.
 *   - Calculation summary clearly labels generic estimate.
 *
 * Also covers new segment kinds:
 *   - offset = 2 × 45° equivalent = 2.0 m generic estimate.
 *   - vertical_terminal and horizontal_terminal treated as terminal (0 m default).
 *   - roof_flashing contributes 0 m.
 */

import { describe, it, expect } from 'vitest';
import { calculateFlueEquivalentLength } from '../flueEquivalentLength';
import { GENERIC_FLUE_RULES } from '../genericFlueRules';
import type { QuoteFlueRouteV1 } from '../quotePlannerTypes';

// ─── Problem-statement acceptance criteria ────────────────────────────────────

describe('flueEquivalentLength — problem-statement acceptance criteria', () => {
  it('horizontal flue: 3 m straight + 1 × 90° = 5 m equivalent estimate', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.equivalentLengthM).toBeCloseTo(5, 5);
    expect(result.calculationMode).toBe('generic_estimate');
  });

  it('two 45° elbows add 2.0 m generic equivalent', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'elbow_45' },
        { kind: 'elbow_45' },
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.equivalentLengthM).toBeCloseTo(2.0, 5);
    expect(result.calculationMode).toBe('generic_estimate');
  });

  it('missing manufacturer max → needs_model_specific_check', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
      // maxEquivalentLengthM deliberately omitted
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.result).toBe('needs_model_specific_check');
    expect(result.maxEquivalentLengthM).toBeNull();
  });

  it('known max below equivalent → exceeds_allowance', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 8 },
        { kind: 'elbow_90' },
        { kind: 'elbow_90' },
      ],
      maxEquivalentLengthM: 10,
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.result).toBe('exceeds_allowance');
    expect(result.equivalentLengthM).toBeCloseTo(12, 5);
  });

  it('known max above equivalent → within_allowance', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
      maxEquivalentLengthM: 10,
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.result).toBe('within_allowance');
    expect(result.remainingAllowanceM).toBeCloseTo(5, 5);
  });

  it('generic estimate is declared in calculationMode', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [{ kind: 'elbow_90' }],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.calculationMode).toBe('generic_estimate');
  });

  it('assumptions array labels generic estimate for 90° elbow', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [{ kind: 'elbow_90' }],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.assumptions[0]).toMatch(/generic/i);
    expect(result.assumptions[0]).toMatch(/90/);
  });
});

// ─── New segment kinds ────────────────────────────────────────────────────────

describe('flueEquivalentLength — new segment kinds', () => {
  it('offset = 2 × 45° equivalent = 2.0 m generic estimate', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [{ kind: 'offset' }],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.equivalentLengthM).toBeCloseTo(2.0, 5);
    expect(result.assumptions.some((a) => a.toLowerCase().includes('offset'))).toBe(true);
  });

  it('vertical_terminal contributes 0 m equivalent (same as terminal)', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'vertical_terminal' },
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.equivalentLengthM).toBeCloseTo(3, 5);
  });

  it('horizontal_terminal contributes 0 m equivalent (same as terminal)', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 2.5 },
        { kind: 'horizontal_terminal' },
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.equivalentLengthM).toBeCloseTo(2.5, 5);
  });

  it('roof_flashing contributes 0 m equivalent', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 4 },
        { kind: 'roof_flashing' },
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.equivalentLengthM).toBeCloseTo(4, 5);
  });

  it('complex run: 3 m straight + 1 × 90° + 1 offset = 7.0 m equivalent', () => {
    // 3 + 2.0 (90°) + 2.0 (offset ≈ 2 × 45°) = 7.0 m
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
        { kind: 'offset' },
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.equivalentLengthM).toBeCloseTo(7.0, 5);
  });
});

// ─── flueActions integration ──────────────────────────────────────────────────

import {
  buildFlueRouteDraft,
  addFlueSegment,
  removeFlueSegment,
  updateFlueFamily,
  updateFlueLocations,
  updateMaxEquivalentLength,
  applyManualOverride,
} from '../../model/flueActions';

describe('flueActions — build and mutate', () => {
  it('buildFlueRouteDraft produces a route with generic_estimate mode', () => {
    const route = buildFlueRouteDraft();
    expect(route.calculationMode).toBe('generic_estimate');
    expect(route.family).toBe('unknown');
    expect(route.geometry?.segments).toHaveLength(0);
  });

  it('addFlueSegment: 3 m straight gives 3.0 m equivalent', () => {
    let route = buildFlueRouteDraft();
    route = addFlueSegment(route, { kind: 'straight', physicalLengthM: 3 });
    expect(route.calculation?.equivalentLengthM).toBeCloseTo(3, 5);
  });

  it('addFlueSegment: 3 m + 90° = 5.0 m', () => {
    let route = buildFlueRouteDraft();
    route = addFlueSegment(route, { kind: 'straight', physicalLengthM: 3 });
    route = addFlueSegment(route, { kind: 'elbow_90' });
    expect(route.calculation?.equivalentLengthM).toBeCloseTo(5, 5);
    expect(route.calculation?.result).toBe('needs_model_specific_check');
  });

  it('removeFlueSegment: removing the elbow leaves 3.0 m', () => {
    let route = buildFlueRouteDraft();
    route = addFlueSegment(route, { kind: 'straight', physicalLengthM: 3 });
    route = addFlueSegment(route, { kind: 'elbow_90' });
    route = removeFlueSegment(route, 1); // remove the elbow
    expect(route.calculation?.equivalentLengthM).toBeCloseTo(3, 5);
    expect(route.geometry?.segments).toHaveLength(1);
  });

  it('removeFlueSegment: out-of-range index is silently ignored', () => {
    let route = buildFlueRouteDraft();
    route = addFlueSegment(route, { kind: 'straight', physicalLengthM: 2 });
    const before = route;
    const after = removeFlueSegment(route, 99);
    expect(after).toBe(before); // same reference — not mutated
  });

  it('updateFlueFamily updates the family field', () => {
    let route = buildFlueRouteDraft();
    route = updateFlueFamily(route, 'horizontal_rear');
    expect(route.family).toBe('horizontal_rear');
  });

  it('updateFlueLocations sets boiler and terminal location IDs', () => {
    let route = buildFlueRouteDraft();
    route = updateFlueLocations(route, 'loc-boiler-1', 'loc-terminal-1');
    expect(route.boilerLocationId).toBe('loc-boiler-1');
    expect(route.terminalLocationId).toBe('loc-terminal-1');
  });

  it('updateMaxEquivalentLength with 10 m → within_allowance for 5 m route', () => {
    let route = buildFlueRouteDraft();
    route = addFlueSegment(route, { kind: 'straight', physicalLengthM: 3 });
    route = addFlueSegment(route, { kind: 'elbow_90' });
    route = updateMaxEquivalentLength(route, 10);
    expect(route.calculation?.result).toBe('within_allowance');
    expect(route.calculation?.remainingAllowanceM).toBeCloseTo(5, 5);
  });

  it('updateMaxEquivalentLength with 4 m → exceeds_allowance for 5 m route', () => {
    let route = buildFlueRouteDraft();
    route = addFlueSegment(route, { kind: 'straight', physicalLengthM: 3 });
    route = addFlueSegment(route, { kind: 'elbow_90' });
    route = updateMaxEquivalentLength(route, 4);
    expect(route.calculation?.result).toBe('exceeds_allowance');
  });

  it('applyManualOverride sets calculationMode to manual_override', () => {
    let route = buildFlueRouteDraft();
    route = applyManualOverride(route, 6.5, 10);
    expect(route.calculationMode).toBe('manual_override');
    expect(route.calculation?.calculationMode).toBe('manual_override');
    expect(route.calculation?.equivalentLengthM).toBeCloseTo(6.5, 5);
    expect(route.calculation?.result).toBe('within_allowance');
  });

  it('applyManualOverride without max → needs_model_specific_check', () => {
    let route = buildFlueRouteDraft();
    route = applyManualOverride(route, 5);
    expect(route.calculation?.result).toBe('needs_model_specific_check');
  });
});
