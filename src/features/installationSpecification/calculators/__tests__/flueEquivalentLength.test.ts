/**
 * flueEquivalentLength.test.ts — Unit tests for calculateFlueEquivalentLength.
 *
 * Covers the problem-statement acceptance criteria:
 *   - 3 m straight + 1 × 90° elbow = 5 m generic equivalent.
 *   - 3 m straight + 2 × 45° elbows = 5 m generic equivalent.
 *   - With max allowance 10 m, remaining = 5 m.
 *   - Equivalent exceeding allowance → result 'exceeds_allowance'.
 *   - No max allowance → result 'needs_model_specific_check'.
 *
 * Also covers:
 *   - Physical length accumulation.
 *   - Caller-supplied equivalentLengthM overrides generic rule.
 *   - Generic assumptions recorded in output.
 *   - calculationMode derived from rule set.
 */

import { describe, it, expect } from 'vitest';
import { calculateFlueEquivalentLength } from '../flueEquivalentLength';
import { GENERIC_FLUE_RULES } from '../genericFlueRules';
import type { QuoteFlueRouteV1, FlueRuleSetV1 } from '../quotePlannerTypes';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A manufacturer-specific rule set for use in override tests. */
const MANUFACTURER_RULES: FlueRuleSetV1 = {
  elbow90EquivalentLengthM: 1.5,
  elbow45EquivalentLengthM: 0.75,
  plumeKitEquivalentLengthM: 0.5,
  terminalEquivalentLengthM: 0,
  calculationMode: 'manufacturer_specific',
};

// ─── Acceptance criteria ──────────────────────────────────────────────────────

describe('calculateFlueEquivalentLength — acceptance criteria', () => {
  it('3 m straight + 1 × 90° elbow = 5 m equivalent (generic)', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.physicalLengthM).toBeCloseTo(3, 5);
    expect(result.equivalentLengthM).toBeCloseTo(5, 5); // 3 + 2.0
  });

  it('3 m straight + 2 × 45° elbows = 5 m equivalent (generic)', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_45' },
        { kind: 'elbow_45' },
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.physicalLengthM).toBeCloseTo(3, 5);
    expect(result.equivalentLengthM).toBeCloseTo(5, 5); // 3 + 1.0 + 1.0
  });

  it('with max allowance 10 m, remaining allowance is 5 m', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
      maxEquivalentLengthM: 10,
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.equivalentLengthM).toBeCloseTo(5, 5);
    expect(result.maxEquivalentLengthM).toBe(10);
    expect(result.remainingAllowanceM).toBeCloseTo(5, 5);
    expect(result.result).toBe('within_allowance');
  });

  it('equivalent exceeding allowance produces exceeds_allowance', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 8 },
        { kind: 'elbow_90' },
        { kind: 'elbow_90' },
      ],
      maxEquivalentLengthM: 10,
    };
    // 8 + 2 + 2 = 12 m > 10 m
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.equivalentLengthM).toBeCloseTo(12, 5);
    expect(result.result).toBe('exceeds_allowance');
    expect(result.remainingAllowanceM).toBeCloseTo(-2, 5);
  });

  it('no max allowance produces needs_model_specific_check', () => {
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
    expect(result.remainingAllowanceM).toBeNull();
  });
});

// ─── Physical length accumulation ─────────────────────────────────────────────

describe('calculateFlueEquivalentLength — physical length', () => {
  it('sums physical lengths from all straight segments', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 2 },
        { kind: 'straight', physicalLengthM: 1.5 },
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.physicalLengthM).toBeCloseTo(3.5, 5);
  });

  it('does not count fitting-only segments in physical length', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'elbow_90' },
        { kind: 'elbow_45' },
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.physicalLengthM).toBe(0);
    expect(result.equivalentLengthM).toBeCloseTo(3, 5); // 2.0 + 1.0
  });
});

// ─── Rule override ────────────────────────────────────────────────────────────

describe('calculateFlueEquivalentLength — rule set override', () => {
  it('uses caller-supplied equivalentLengthM when provided on segment', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90', equivalentLengthM: 1.0 }, // override generic 2.0
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.equivalentLengthM).toBeCloseTo(4, 5); // 3 + 1.0
  });

  it('uses manufacturer rule set values when supplied', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
    };
    const result = calculateFlueEquivalentLength(route, MANUFACTURER_RULES);
    expect(result.equivalentLengthM).toBeCloseTo(4.5, 5); // 3 + 1.5
    expect(result.calculationMode).toBe('manufacturer_specific');
  });

  it('declares generic_estimate mode when using generic rules', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [{ kind: 'straight', physicalLengthM: 3 }],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.calculationMode).toBe('generic_estimate');
  });
});

// ─── Assumptions ─────────────────────────────────────────────────────────────

describe('calculateFlueEquivalentLength — assumptions', () => {
  it('records an assumption when the generic 90° rule is applied', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [{ kind: 'elbow_90' }],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.assumptions.length).toBeGreaterThan(0);
    expect(result.assumptions[0]).toMatch(/90/);
    expect(result.assumptions[0]).toMatch(/generic/i);
  });

  it('records an assumption when the generic 45° rule is applied', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [{ kind: 'elbow_45' }],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.assumptions.some((a) => a.includes('45'))).toBe(true);
  });

  it('does not duplicate assumption strings for repeated fitting kinds', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'elbow_90' },
        { kind: 'elbow_90' },
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    // De-duplicated via Set — should appear only once
    const ninetyAssumptions = result.assumptions.filter((a) => a.includes('90°'));
    expect(ninetyAssumptions.length).toBe(1);
  });

  it('records no assumptions when caller provides all equivalentLengthM values', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'elbow_90', equivalentLengthM: 2 },
        { kind: 'elbow_45', equivalentLengthM: 1 },
      ],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.assumptions).toHaveLength(0);
  });

  it('plume kit assumption is recorded when generic rule is applied', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [{ kind: 'plume_kit' }],
    };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.assumptions.some((a) => a.toLowerCase().includes('plume'))).toBe(true);
  });
});

// ─── Empty/edge cases ─────────────────────────────────────────────────────────

describe('calculateFlueEquivalentLength — edge cases', () => {
  it('returns zero lengths for an empty segment list', () => {
    const route: QuoteFlueRouteV1 = { segments: [] };
    const result = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);
    expect(result.physicalLengthM).toBe(0);
    expect(result.equivalentLengthM).toBe(0);
    expect(result.result).toBe('needs_model_specific_check');
  });

  it('uses default GENERIC_FLUE_RULES when no rule set argument is provided', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
      maxEquivalentLengthM: 10,
    };
    // No ruleSet argument — should default to generic
    const result = calculateFlueEquivalentLength(route);
    expect(result.equivalentLengthM).toBeCloseTo(5, 5);
    expect(result.calculationMode).toBe('generic_estimate');
  });
});
