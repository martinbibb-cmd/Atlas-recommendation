/**
 * componentHealth.test.ts
 *
 * Unit tests for the buildComponentHealthItems helper exported from RecommendationHub.
 *
 * Tests verify that the helper:
 *   - returns an empty array when no component conditions are present
 *   - emits a plate HEX row when combiDhwV1.plateHexConditionBand is set
 *   - emits a cylinder row when storedDhwV1.cylinderCondition is set
 *   - emits a boiler row when boilerEfficiencyModelV1.conditionBand is set
 *   - derives cylinder implications from insulationFactor / coilTransferFactor
 *   - handles good condition bands correctly (no implications for cylinder good)
 *   - handles all four condition bands for all three components
 */
import { describe, it, expect } from 'vitest';
import { buildComponentHealthItems } from '../RecommendationHub';
import type { FullEngineResult } from '../../../engine/schema/EngineInputV2_3';

// ─── Minimal stub factory ─────────────────────────────────────────────────────

/**
 * Builds a minimal FullEngineResult stub sufficient for buildComponentHealthItems.
 * combiDhwV1.plateHexConditionBand, storedDhwV1.cylinderCondition, and
 * boilerEfficiencyModelV1.conditionBand are exercised by the helper.
 */
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
    // Remaining FullEngineResult fields are not accessed by the helper
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FullEngineResult;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildComponentHealthItems', () => {

  // ── Empty / no-evidence cases ─────────────────────────────────────────────

  it('returns empty array when neither plate HEX nor cylinder condition is present', () => {
    const result = makeResult({});
    expect(buildComponentHealthItems(result)).toEqual([]);
  });

  // ── Plate HEX rows ────────────────────────────────────────────────────────

  it('emits a plate HEX item when plateHexConditionBand is set', () => {
    const result = makeResult({ plateHexConditionBand: 'moderate' });
    const items = buildComponentHealthItems(result);
    expect(items).toHaveLength(1);
    expect(items[0].component).toBe('Plate heat exchanger');
    expect(items[0].conditionBand).toBe('moderate');
  });

  it('gives plate HEX good band a positive conditionLabel', () => {
    const result = makeResult({ plateHexConditionBand: 'good' });
    const [item] = buildComponentHealthItems(result);
    expect(item.conditionLabel).toMatch(/no significant fouling/i);
    expect(item.implications).toHaveLength(1);
    expect(item.guidance).toHaveLength(0);
  });

  it('gives plate HEX moderate band an implication and guidance', () => {
    const result = makeResult({ plateHexConditionBand: 'moderate' });
    const [item] = buildComponentHealthItems(result);
    expect(item.conditionLabel).toMatch(/moderate fouling/i);
    expect(item.implications).toHaveLength(1);
    expect(item.guidance.length).toBeGreaterThan(0);
  });

  it('gives plate HEX poor band multiple implications and guidance', () => {
    const result = makeResult({ plateHexConditionBand: 'poor' });
    const [item] = buildComponentHealthItems(result);
    expect(item.conditionLabel).toMatch(/significant fouling/i);
    expect(item.implications.length).toBeGreaterThanOrEqual(2);
    expect(item.implications.some(s => /temperature fluctuation/i.test(s))).toBe(true);
    expect(item.implications.some(s => /short draws|concurrent demand/i.test(s))).toBe(true);
    expect(item.guidance.length).toBeGreaterThan(0);
  });

  it('gives plate HEX severe band multiple implications and guidance', () => {
    const result = makeResult({ plateHexConditionBand: 'severe' });
    const [item] = buildComponentHealthItems(result);
    expect(item.conditionLabel).toMatch(/severe fouling/i);
    expect(item.implications.length).toBeGreaterThanOrEqual(2);
    expect(item.implications.some(s => /temperature fluctuation/i.test(s))).toBe(true);
    expect(item.implications.some(s => /short draws|concurrent demand/i.test(s))).toBe(true);
    expect(item.guidance.length).toBeGreaterThan(0);
  });

  // ── Cylinder rows ─────────────────────────────────────────────────────────

  it('emits a cylinder item when cylinderCondition is set', () => {
    const result = makeResult({
      cylinderCondition: { conditionBand: 'poor', insulationFactor: 0.8, coilTransferFactor: 0.85, standingLossRelative: 1.25 },
    });
    const items = buildComponentHealthItems(result);
    expect(items).toHaveLength(1);
    expect(items[0].component).toBe('Hot water cylinder');
    expect(items[0].conditionBand).toBe('poor');
  });

  it('reports standing loss implication when insulationFactor < 1', () => {
    const result = makeResult({
      cylinderCondition: { conditionBand: 'poor', insulationFactor: 0.8, coilTransferFactor: 1.0, standingLossRelative: 1.25 },
    });
    const [item] = buildComponentHealthItems(result);
    expect(item.implications).toContain('Standing heat loss elevated.');
    expect(item.implications).not.toContain('Recovery slower than expected.');
  });

  it('reports recovery implication when coilTransferFactor < 1', () => {
    const result = makeResult({
      cylinderCondition: { conditionBand: 'moderate', insulationFactor: 1.0, coilTransferFactor: 0.9, standingLossRelative: 1.0 },
    });
    const [item] = buildComponentHealthItems(result);
    expect(item.implications).toContain('Recovery slower than expected.');
    expect(item.implications).not.toContain('Standing heat loss elevated.');
  });

  it('reports both implications when both factors are degraded', () => {
    const result = makeResult({
      cylinderCondition: { conditionBand: 'severe', insulationFactor: 0.7, coilTransferFactor: 0.75, standingLossRelative: 1.43 },
    });
    const [item] = buildComponentHealthItems(result);
    expect(item.implications).toContain('Standing heat loss elevated.');
    expect(item.implications).toContain('Recovery slower than expected.');
  });

  it('emits no implications for a good cylinder', () => {
    const result = makeResult({
      cylinderCondition: { conditionBand: 'good', insulationFactor: 1.0, coilTransferFactor: 1.0, standingLossRelative: 1.0 },
    });
    const [item] = buildComponentHealthItems(result);
    expect(item.conditionLabel).toMatch(/good condition/i);
    expect(item.implications).toHaveLength(0);
  });

  it('cylinder poor band includes maintenance guidance', () => {
    const result = makeResult({
      cylinderCondition: { conditionBand: 'poor', insulationFactor: 0.8, coilTransferFactor: 0.85, standingLossRelative: 1.25 },
    });
    const [item] = buildComponentHealthItems(result);
    expect(item.guidance.length).toBeGreaterThan(0);
    expect(item.guidance.some(s => /insulation|lagging/i.test(s))).toBe(true);
    expect(item.guidance.some(s => /coil/i.test(s))).toBe(true);
  });

  it('cylinder severe band includes upgrade guidance', () => {
    const result = makeResult({
      cylinderCondition: { conditionBand: 'severe', insulationFactor: 0.7, coilTransferFactor: 0.75, standingLossRelative: 1.43 },
    });
    const [item] = buildComponentHealthItems(result);
    expect(item.guidance.some(s => /upgrade/i.test(s))).toBe(true);
  });

  it('cylinder moderate band includes basic insulation guidance', () => {
    const result = makeResult({
      cylinderCondition: { conditionBand: 'moderate', insulationFactor: 0.9, coilTransferFactor: 1.0, standingLossRelative: 1.1 },
    });
    const [item] = buildComponentHealthItems(result);
    expect(item.guidance.length).toBeGreaterThan(0);
    expect(item.guidance.some(s => /insulation|lagging/i.test(s))).toBe(true);
  });

  it('cylinder good band has empty guidance', () => {
    const result = makeResult({
      cylinderCondition: { conditionBand: 'good', insulationFactor: 1.0, coilTransferFactor: 1.0, standingLossRelative: 1.0 },
    });
    const [item] = buildComponentHealthItems(result);
    expect(item.guidance).toEqual([]);
  });

  it('cylinder degraded bands include buffered-experience implication', () => {
    for (const band of ['moderate', 'poor', 'severe'] as const) {
      const result = makeResult({
        cylinderCondition: { conditionBand: band, insulationFactor: 0.85, coilTransferFactor: 0.85, standingLossRelative: 1.18 },
      });
      const [item] = buildComponentHealthItems(result);
      expect(item.implications.some(s => /buffered/i.test(s))).toBe(
        true,
        `Expected buffered-experience implication for conditionBand=${band}`,
      );
    }
  });

  // ── Combined rows ─────────────────────────────────────────────────────────

  it('emits plate HEX row before cylinder row when both are present', () => {
    const result = makeResult({
      plateHexConditionBand: 'moderate',
      cylinderCondition: { conditionBand: 'poor', insulationFactor: 0.8, coilTransferFactor: 0.85, standingLossRelative: 1.25 },
    });
    const items = buildComponentHealthItems(result);
    expect(items).toHaveLength(2);
    expect(items[0].component).toBe('Plate heat exchanger');
    expect(items[1].component).toBe('Hot water cylinder');
  });

  it('does not mutate inputs', () => {
    const result = makeResult({ plateHexConditionBand: 'moderate' });
    const before = JSON.stringify(result);
    buildComponentHealthItems(result);
    expect(JSON.stringify(result)).toBe(before);
  });
});

// ─── Boiler rows ──────────────────────────────────────────────────────────────

describe('buildComponentHealthItems — boiler rows', () => {

  it('emits a boiler item when boilerConditionBand is set', () => {
    const result = makeResult({ boilerConditionBand: 'moderate' });
    const items = buildComponentHealthItems(result);
    expect(items).toHaveLength(1);
    expect(items[0].component).toBe('Boiler');
    expect(items[0].conditionBand).toBe('moderate');
  });

  it('does not emit a boiler item when boilerEfficiencyModelV1 is absent', () => {
    const result = makeResult({});
    expect(buildComponentHealthItems(result)).toHaveLength(0);
  });

  it('boiler good band — has one implication, no guidance', () => {
    const result = makeResult({ boilerConditionBand: 'good' });
    const [item] = buildComponentHealthItems(result);
    expect(item.conditionLabel).toMatch(/operating as expected/i);
    expect(item.implications).toHaveLength(1);
    expect(item.guidance).toHaveLength(0);
  });

  it('boiler moderate band — has implication and guidance', () => {
    const result = makeResult({ boilerConditionBand: 'moderate' });
    const [item] = buildComponentHealthItems(result);
    expect(item.conditionLabel).toMatch(/moderate degradation/i);
    expect(item.implications.length).toBeGreaterThan(0);
    expect(item.implications.some(s => /efficiency/i.test(s))).toBe(true);
    expect(item.guidance.length).toBeGreaterThan(0);
  });

  it('boiler poor band — mentions condensing gain in guidance', () => {
    const result = makeResult({ boilerConditionBand: 'poor' });
    const [item] = buildComponentHealthItems(result);
    expect(item.conditionLabel).toMatch(/performance degraded/i);
    expect(item.implications.some(s => /condensing/i.test(s))).toBe(true);
    expect(item.guidance.some(s => /service|setup|flow temperature|condensing/i.test(s))).toBe(true);
  });

  it('boiler severe band — mentions service or replacement in guidance', () => {
    const result = makeResult({ boilerConditionBand: 'severe' });
    const [item] = buildComponentHealthItems(result);
    expect(item.conditionLabel).toMatch(/significant degradation/i);
    expect(item.guidance.some(s => /service|replacement/i.test(s))).toBe(true);
  });

  it('boiler row is distinct from plate HEX and cylinder rows', () => {
    const result = makeResult({
      plateHexConditionBand: 'moderate',
      cylinderCondition: { conditionBand: 'good', insulationFactor: 1.0, coilTransferFactor: 1.0, standingLossRelative: 1.0 },
      boilerConditionBand: 'poor',
    });
    const items = buildComponentHealthItems(result);
    expect(items).toHaveLength(3);
    const components = items.map(i => i.component);
    expect(components).toContain('Plate heat exchanger');
    expect(components).toContain('Hot water cylinder');
    expect(components).toContain('Boiler');
  });

  it('boiler row appears after plate HEX and cylinder rows', () => {
    const result = makeResult({
      plateHexConditionBand: 'moderate',
      cylinderCondition: { conditionBand: 'good', insulationFactor: 1.0, coilTransferFactor: 1.0, standingLossRelative: 1.0 },
      boilerConditionBand: 'poor',
    });
    const items = buildComponentHealthItems(result);
    expect(items[2].component).toBe('Boiler');
  });
});
