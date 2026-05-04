/**
 * getFlueRulesForModel.test.ts — Tests for the manufacturer/model flue rule hook.
 *
 * Acceptance criteria (from problem statement):
 *   - Exact rule overrides generic elbow values.
 *   - Missing model falls back to generic.
 *   - Manufacturer rule labels calculation as manufacturer_specific.
 *   - Generic fallback labels calculation as generic_estimate.
 *
 * Also covers:
 *   - Range-level match when no model entry exists.
 *   - Partial segment equivalents fall back per-fitting to generic defaults.
 *   - `getFlueRuleUiLabel` returns correct display strings.
 *   - `calculateFlueEquivalentLengthForModel` integrates lookup + calculation.
 *   - maxEquivalentLengthM from catalog entry is forwarded when route omits it.
 */

import { describe, it, expect } from 'vitest';
import {
  getFlueRulesForModel,
  getFlueRuleUiLabel,
  LABEL_MANUFACTURER_SPECIFIC,
  LABEL_GENERIC_ESTIMATE,
} from '../getFlueRulesForModel';
import { GENERIC_FLUE_RULES } from '../../calculators/genericFlueRules';
import { calculateFlueEquivalentLength } from '../../calculators/flueEquivalentLength';
import { calculateFlueEquivalentLengthForModel } from '../../calculators/flueEquivalentLength';
import type { QuoteFlueRouteV1 } from '../../calculators/quotePlannerTypes';

// ─── Fixtures — seed manufacturers ───────────────────────────────────────────

// The seed file contains DEMO_MANUFACTURER_A / DEMO_MODEL_25 and DEMO_MODEL_30.
const KNOWN_MFR = 'DEMO_MANUFACTURER_A';
const KNOWN_MODEL_25 = 'DEMO_MODEL_25';
const KNOWN_MODEL_30 = 'DEMO_MODEL_30';
const KNOWN_RANGE_B = 'DEMO_RANGE_Y';
const KNOWN_MFR_B = 'DEMO_MANUFACTURER_B';

// ─── Exact model match ────────────────────────────────────────────────────────

describe('getFlueRulesForModel — exact model match', () => {
  it('resolves manufacturer_specific when an exact model entry exists', () => {
    const result = getFlueRulesForModel(KNOWN_MFR, KNOWN_MODEL_25);
    expect(result.resolved).toBe('manufacturer_specific');
  });

  it('matchedEntry is not null for an exact model match', () => {
    const result = getFlueRulesForModel(KNOWN_MFR, KNOWN_MODEL_25);
    expect(result.matchedEntry).not.toBeNull();
    expect(result.matchedEntry?.model).toBe(KNOWN_MODEL_25);
  });

  it('exact rule overrides generic elbow_90 value (1.5 m vs generic 2.0 m)', () => {
    const result = getFlueRulesForModel(KNOWN_MFR, KNOWN_MODEL_25);
    // Seed: DEMO_MANUFACTURER_A / DEMO_MODEL_25 has elbow_90 = 1.5
    expect(result.ruleSet.elbow90EquivalentLengthM).toBe(1.5);
    // Confirm this differs from the generic default
    expect(result.ruleSet.elbow90EquivalentLengthM).not.toBe(
      GENERIC_FLUE_RULES.elbow90EquivalentLengthM,
    );
  });

  it('exact rule overrides generic elbow_45 value (0.75 m vs generic 1.0 m)', () => {
    const result = getFlueRulesForModel(KNOWN_MFR, KNOWN_MODEL_25);
    expect(result.ruleSet.elbow45EquivalentLengthM).toBe(0.75);
    expect(result.ruleSet.elbow45EquivalentLengthM).not.toBe(
      GENERIC_FLUE_RULES.elbow45EquivalentLengthM,
    );
  });

  it('calculation mode on resolved rule set is manufacturer_specific', () => {
    const result = getFlueRulesForModel(KNOWN_MFR, KNOWN_MODEL_25);
    expect(result.ruleSet.calculationMode).toBe('manufacturer_specific');
  });

  it('lookup is case-insensitive for manufacturer name', () => {
    const lower = getFlueRulesForModel(KNOWN_MFR.toLowerCase(), KNOWN_MODEL_25);
    expect(lower.resolved).toBe('manufacturer_specific');
  });

  it('lookup is case-insensitive for model name', () => {
    const lower = getFlueRulesForModel(KNOWN_MFR, KNOWN_MODEL_25.toLowerCase());
    expect(lower.resolved).toBe('manufacturer_specific');
  });

  it('different models resolve to different maxEquivalentLengthM', () => {
    const r25 = getFlueRulesForModel(KNOWN_MFR, KNOWN_MODEL_25);
    const r30 = getFlueRulesForModel(KNOWN_MFR, KNOWN_MODEL_30);
    // Seed: DEMO_MODEL_25 → 10 m; DEMO_MODEL_30 → 12 m
    expect(r25.matchedEntry?.maxEquivalentLengthM).toBe(10);
    expect(r30.matchedEntry?.maxEquivalentLengthM).toBe(12);
  });
});

// ─── Generic fallback ─────────────────────────────────────────────────────────

describe('getFlueRulesForModel — generic fallback', () => {
  it('resolves generic_estimate when manufacturer is unknown', () => {
    const result = getFlueRulesForModel('UNKNOWN_MANUFACTURER');
    expect(result.resolved).toBe('generic_estimate');
  });

  it('resolves generic_estimate when model is unknown for a known manufacturer', () => {
    const result = getFlueRulesForModel(KNOWN_MFR, 'NONEXISTENT_MODEL_99');
    expect(result.resolved).toBe('generic_estimate');
  });

  it('matchedEntry is null on generic fallback', () => {
    const result = getFlueRulesForModel('UNKNOWN_MANUFACTURER');
    expect(result.matchedEntry).toBeNull();
  });

  it('generic fallback rule set has same values as GENERIC_FLUE_RULES', () => {
    const result = getFlueRulesForModel('UNKNOWN_MANUFACTURER');
    expect(result.ruleSet.elbow90EquivalentLengthM).toBe(
      GENERIC_FLUE_RULES.elbow90EquivalentLengthM,
    );
    expect(result.ruleSet.elbow45EquivalentLengthM).toBe(
      GENERIC_FLUE_RULES.elbow45EquivalentLengthM,
    );
    expect(result.ruleSet.plumeKitEquivalentLengthM).toBe(
      GENERIC_FLUE_RULES.plumeKitEquivalentLengthM,
    );
    expect(result.ruleSet.terminalEquivalentLengthM).toBe(
      GENERIC_FLUE_RULES.terminalEquivalentLengthM,
    );
  });

  it('generic fallback calculationMode is generic_estimate', () => {
    const result = getFlueRulesForModel('UNKNOWN_MANUFACTURER');
    expect(result.ruleSet.calculationMode).toBe('generic_estimate');
  });
});

// ─── Range-level match ────────────────────────────────────────────────────────

describe('getFlueRulesForModel — range-level match', () => {
  it('resolves manufacturer_specific via range when no model entry exists', () => {
    const result = getFlueRulesForModel(KNOWN_MFR_B, undefined, KNOWN_RANGE_B);
    expect(result.resolved).toBe('manufacturer_specific');
    expect(result.matchedEntry?.range).toBe(KNOWN_RANGE_B);
  });

  it('range match plume_kit override is applied (1.0 m for DEMO_MANUFACTURER_B)', () => {
    const result = getFlueRulesForModel(KNOWN_MFR_B, undefined, KNOWN_RANGE_B);
    // Seed: DEMO_MANUFACTURER_B / DEMO_RANGE_Y has plume_kit = 1.0
    expect(result.ruleSet.plumeKitEquivalentLengthM).toBe(1.0);
  });
});

// ─── UI label ─────────────────────────────────────────────────────────────────

describe('getFlueRuleUiLabel', () => {
  it('returns LABEL_MANUFACTURER_SPECIFIC for manufacturer_specific', () => {
    expect(getFlueRuleUiLabel('manufacturer_specific')).toBe(LABEL_MANUFACTURER_SPECIFIC);
    expect(getFlueRuleUiLabel('manufacturer_specific')).toBe('Manufacturer-specific');
  });

  it('returns LABEL_GENERIC_ESTIMATE for generic_estimate', () => {
    expect(getFlueRuleUiLabel('generic_estimate')).toBe(LABEL_GENERIC_ESTIMATE);
    expect(getFlueRuleUiLabel('generic_estimate')).toBe('Generic estimate — check MI');
  });
});

// ─── Integration with calculateFlueEquivalentLength ───────────────────────────

describe('getFlueRulesForModel + calculateFlueEquivalentLength integration', () => {
  it('manufacturer rule produces different equivalent length than generic', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
    };
    const mfrResult = getFlueRulesForModel(KNOWN_MFR, KNOWN_MODEL_25);
    const mfrCalc = calculateFlueEquivalentLength(route, mfrResult.ruleSet);

    const genericCalc = calculateFlueEquivalentLength(route, GENERIC_FLUE_RULES);

    // Manufacturer: 3 + 1.5 = 4.5 m; Generic: 3 + 2.0 = 5.0 m
    expect(mfrCalc.equivalentLengthM).toBeCloseTo(4.5, 5);
    expect(genericCalc.equivalentLengthM).toBeCloseTo(5.0, 5);
    expect(mfrCalc.equivalentLengthM).not.toBeCloseTo(genericCalc.equivalentLengthM, 5);
  });

  it('manufacturer rule labels calculation as manufacturer_specific', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [{ kind: 'elbow_90' }],
    };
    const { ruleSet } = getFlueRulesForModel(KNOWN_MFR, KNOWN_MODEL_25);
    const calc = calculateFlueEquivalentLength(route, ruleSet);
    expect(calc.calculationMode).toBe('manufacturer_specific');
  });

  it('generic fallback labels calculation as generic_estimate', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [{ kind: 'elbow_90' }],
    };
    const { ruleSet } = getFlueRulesForModel('UNKNOWN_MANUFACTURER');
    const calc = calculateFlueEquivalentLength(route, ruleSet);
    expect(calc.calculationMode).toBe('generic_estimate');
  });

  it('manufacturer rule with maxEquivalentLengthM: within_allowance for short run', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
      maxEquivalentLengthM: 10,
    };
    const { ruleSet } = getFlueRulesForModel(KNOWN_MFR, KNOWN_MODEL_25);
    // 3 + 1.5 = 4.5 m, max = 10 m → within_allowance
    const calc = calculateFlueEquivalentLength(route, ruleSet);
    expect(calc.result).toBe('within_allowance');
    expect(calc.calculationMode).toBe('manufacturer_specific');
  });

  it('manufacturer rule with maxEquivalentLengthM: exceeds_allowance for long run', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 8 },
        { kind: 'elbow_90' },
        { kind: 'elbow_90' },
      ],
      maxEquivalentLengthM: 10,
    };
    const { ruleSet } = getFlueRulesForModel(KNOWN_MFR, KNOWN_MODEL_25);
    // 8 + 1.5 + 1.5 = 11 m > 10 m → exceeds_allowance
    const calc = calculateFlueEquivalentLength(route, ruleSet);
    expect(calc.result).toBe('exceeds_allowance');
    expect(calc.calculationMode).toBe('manufacturer_specific');
  });
});

// ─── calculateFlueEquivalentLengthForModel ────────────────────────────────────

describe('calculateFlueEquivalentLengthForModel', () => {
  it('returns manufacturer_specific resolution for known model', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
    };
    const result = calculateFlueEquivalentLengthForModel(route, KNOWN_MFR, KNOWN_MODEL_25);
    expect(result.resolution.resolved).toBe('manufacturer_specific');
    expect(result.calculation.calculationMode).toBe('manufacturer_specific');
    expect(result.calculation.equivalentLengthM).toBeCloseTo(4.5, 5);
  });

  it('returns generic_estimate resolution for unknown manufacturer', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
    };
    const result = calculateFlueEquivalentLengthForModel(
      route,
      'UNKNOWN_MANUFACTURER',
    );
    expect(result.resolution.resolved).toBe('generic_estimate');
    expect(result.calculation.calculationMode).toBe('generic_estimate');
    expect(result.calculation.equivalentLengthM).toBeCloseTo(5.0, 5);
  });

  it('forwards catalog maxEquivalentLengthM when route omits it', () => {
    // DEMO_MODEL_25 has maxEquivalentLengthM = 10 in seed
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
      // no maxEquivalentLengthM
    };
    const result = calculateFlueEquivalentLengthForModel(route, KNOWN_MFR, KNOWN_MODEL_25);
    // 3 + 1.5 = 4.5 m; catalog max = 10 m → within_allowance
    expect(result.calculation.maxEquivalentLengthM).toBe(10);
    expect(result.calculation.result).toBe('within_allowance');
  });

  it('route maxEquivalentLengthM takes precedence over catalog value', () => {
    // DEMO_MODEL_25 has catalog max = 10 m, but route explicitly sets max = 4
    const route: QuoteFlueRouteV1 = {
      segments: [
        { kind: 'straight', physicalLengthM: 3 },
        { kind: 'elbow_90' },
      ],
      maxEquivalentLengthM: 4,
    };
    const result = calculateFlueEquivalentLengthForModel(route, KNOWN_MFR, KNOWN_MODEL_25);
    // 3 + 1.5 = 4.5 m > 4 m → exceeds_allowance
    expect(result.calculation.maxEquivalentLengthM).toBe(4);
    expect(result.calculation.result).toBe('exceeds_allowance');
  });

  it('returns needs_model_specific_check when no max is available anywhere', () => {
    const route: QuoteFlueRouteV1 = {
      segments: [{ kind: 'elbow_90' }],
    };
    const result = calculateFlueEquivalentLengthForModel(
      route,
      'UNKNOWN_MANUFACTURER',
    );
    // Generic fallback has no catalog maxEquivalentLengthM; route has none either
    expect(result.calculation.result).toBe('needs_model_specific_check');
  });
});
