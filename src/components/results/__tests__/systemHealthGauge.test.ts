/**
 * systemHealthGauge.test.ts
 *
 * Unit tests for the buildSystemHealthLevel helper exported from RecommendationHub.
 *
 * Tests verify that the helper:
 *   - returns null when no component conditions are present
 *   - uses the plate HEX band when only plate HEX is present
 *   - uses the cylinder band when only cylinder is present
 *   - uses the boiler band when only boiler is present
 *   - uses the worst band when multiple components are present
 *   - maps all four bands to the correct level and message
 *   - does not mutate inputs
 */
import { describe, it, expect } from 'vitest';
import { buildSystemHealthLevel } from '../RecommendationHub';
import type { FullEngineResult } from '../../../engine/schema/EngineInputV2_3';

// ─── Minimal stub factory ─────────────────────────────────────────────────────

function makeResult(overrides: {
  plateHexConditionBand?: 'good' | 'moderate' | 'poor' | 'severe';
  cylinderCondition?: {
    conditionBand: 'good' | 'moderate' | 'poor' | 'severe';
    insulationFactor: number;
    coilTransferFactor: number;
    standingLossRelative: number;
  };
  boilerConditionBand?: 'good' | 'moderate' | 'poor' | 'severe';
}): FullEngineResult {
  return {
    combiDhwV1: {
      plateHexConditionBand: overrides.plateHexConditionBand,
    },
    storedDhwV1: {
      cylinderCondition: overrides.cylinderCondition,
      verdict: { storedRisk: 'pass' },
      recommended: { type: 'unknown', volumeBand: 'medium' },
      flags: [],
      assumptions: [],
      dhwMixing: { mixingValveRecommended: false, inletTempC: 60, outletTempC: 40 },
    },
    boilerEfficiencyModelV1: overrides.boilerConditionBand !== undefined
      ? {
          sedbuk: { source: 'unknown', notes: [] },
          age: { factor: 1.0, notes: [] },
          disclaimerNotes: [],
          conditionBand: overrides.boilerConditionBand,
        }
      : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FullEngineResult;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildSystemHealthLevel', () => {

  // ── No evidence ──────────────────────────────────────────────────────────

  it('returns null when no component conditions are present', () => {
    expect(buildSystemHealthLevel(makeResult({}))).toBeNull();
  });

  // ── Plate HEX only ───────────────────────────────────────────────────────

  it('returns Good for plate HEX good band', () => {
    const result = buildSystemHealthLevel(makeResult({ plateHexConditionBand: 'good' }));
    expect(result).not.toBeNull();
    expect(result!.level).toBe('Good');
    expect(result!.message).toBe('Hot water components appear in good condition.');
  });

  it('returns Fair for plate HEX moderate band', () => {
    const result = buildSystemHealthLevel(makeResult({ plateHexConditionBand: 'moderate' }));
    expect(result!.level).toBe('Fair');
    expect(result!.message).toBe('Some performance loss is possible from component condition.');
  });

  it('returns Degraded for plate HEX poor band', () => {
    const result = buildSystemHealthLevel(makeResult({ plateHexConditionBand: 'poor' }));
    expect(result!.level).toBe('Degraded');
    expect(result!.message).toBe('Condition-related hot water performance loss is likely.');
  });

  it('returns Poor for plate HEX severe band', () => {
    const result = buildSystemHealthLevel(makeResult({ plateHexConditionBand: 'severe' }));
    expect(result!.level).toBe('Poor');
    expect(result!.message).toBe('Significant condition-related performance loss is likely.');
  });

  // ── Cylinder only ─────────────────────────────────────────────────────────

  it('returns Good for cylinder good band', () => {
    const result = buildSystemHealthLevel(makeResult({
      cylinderCondition: { conditionBand: 'good', insulationFactor: 1.0, coilTransferFactor: 1.0, standingLossRelative: 1.0 },
    }));
    expect(result!.level).toBe('Good');
  });

  it('returns Fair for cylinder moderate band', () => {
    const result = buildSystemHealthLevel(makeResult({
      cylinderCondition: { conditionBand: 'moderate', insulationFactor: 0.9, coilTransferFactor: 0.9, standingLossRelative: 1.1 },
    }));
    expect(result!.level).toBe('Fair');
  });

  it('returns Degraded for cylinder poor band', () => {
    const result = buildSystemHealthLevel(makeResult({
      cylinderCondition: { conditionBand: 'poor', insulationFactor: 0.8, coilTransferFactor: 0.85, standingLossRelative: 1.25 },
    }));
    expect(result!.level).toBe('Degraded');
  });

  it('returns Poor for cylinder severe band', () => {
    const result = buildSystemHealthLevel(makeResult({
      cylinderCondition: { conditionBand: 'severe', insulationFactor: 0.7, coilTransferFactor: 0.75, standingLossRelative: 1.43 },
    }));
    expect(result!.level).toBe('Poor');
  });

  // ── Both components — worst band wins ─────────────────────────────────────

  it('uses worst band when plate HEX is worse than cylinder', () => {
    const result = buildSystemHealthLevel(makeResult({
      plateHexConditionBand: 'severe',
      cylinderCondition: { conditionBand: 'good', insulationFactor: 1.0, coilTransferFactor: 1.0, standingLossRelative: 1.0 },
    }));
    expect(result!.level).toBe('Poor');
  });

  it('uses worst band when cylinder is worse than plate HEX', () => {
    const result = buildSystemHealthLevel(makeResult({
      plateHexConditionBand: 'good',
      cylinderCondition: { conditionBand: 'poor', insulationFactor: 0.8, coilTransferFactor: 0.85, standingLossRelative: 1.25 },
    }));
    expect(result!.level).toBe('Degraded');
  });

  it('uses worst band when both are the same', () => {
    const result = buildSystemHealthLevel(makeResult({
      plateHexConditionBand: 'moderate',
      cylinderCondition: { conditionBand: 'moderate', insulationFactor: 0.9, coilTransferFactor: 0.9, standingLossRelative: 1.1 },
    }));
    expect(result!.level).toBe('Fair');
  });

  it('plate HEX poor beats cylinder moderate', () => {
    const result = buildSystemHealthLevel(makeResult({
      plateHexConditionBand: 'poor',
      cylinderCondition: { conditionBand: 'moderate', insulationFactor: 0.9, coilTransferFactor: 0.9, standingLossRelative: 1.1 },
    }));
    expect(result!.level).toBe('Degraded');
  });

  it('cylinder severe beats plate HEX poor', () => {
    const result = buildSystemHealthLevel(makeResult({
      plateHexConditionBand: 'poor',
      cylinderCondition: { conditionBand: 'severe', insulationFactor: 0.7, coilTransferFactor: 0.75, standingLossRelative: 1.43 },
    }));
    expect(result!.level).toBe('Poor');
  });

  // ── Boiler only ───────────────────────────────────────────────────────────

  it('returns Good for boiler good band', () => {
    const result = buildSystemHealthLevel(makeResult({ boilerConditionBand: 'good' }));
    expect(result).not.toBeNull();
    expect(result!.level).toBe('Good');
  });

  it('returns Fair for boiler moderate band', () => {
    const result = buildSystemHealthLevel(makeResult({ boilerConditionBand: 'moderate' }));
    expect(result!.level).toBe('Fair');
  });

  it('returns Degraded for boiler poor band', () => {
    const result = buildSystemHealthLevel(makeResult({ boilerConditionBand: 'poor' }));
    expect(result!.level).toBe('Degraded');
  });

  it('returns Poor for boiler severe band', () => {
    const result = buildSystemHealthLevel(makeResult({ boilerConditionBand: 'severe' }));
    expect(result!.level).toBe('Poor');
  });

  // ── Boiler as worst component ──────────────────────────────────────────────

  it('boiler severe beats plate HEX moderate and cylinder good', () => {
    const result = buildSystemHealthLevel(makeResult({
      plateHexConditionBand: 'moderate',
      cylinderCondition: { conditionBand: 'good', insulationFactor: 1.0, coilTransferFactor: 1.0, standingLossRelative: 1.0 },
      boilerConditionBand: 'severe',
    }));
    expect(result!.level).toBe('Poor');
  });

  it('boiler poor is beaten by plate HEX severe', () => {
    const result = buildSystemHealthLevel(makeResult({
      plateHexConditionBand: 'severe',
      boilerConditionBand: 'poor',
    }));
    expect(result!.level).toBe('Poor');
  });

  // ── Stability / mutation ──────────────────────────────────────────────────

  it('does not mutate inputs', () => {
    const result = makeResult({ plateHexConditionBand: 'moderate' });
    const before = JSON.stringify(result);
    buildSystemHealthLevel(result);
    expect(JSON.stringify(result)).toBe(before);
  });
});
