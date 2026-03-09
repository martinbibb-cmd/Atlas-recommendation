import { describe, it, expect } from 'vitest';
import { runStoredDhwModuleV1 } from '../modules/StoredDhwModule';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

const baseInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
};

describe('runStoredDhwModuleV1', () => {
  // ── Space OK (no space constraint) ────────────────────────────────────────

  it('returns pass when availableSpace is "ok" and low demand', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'ok', bathroomCount: 1 });
    expect(result.verdict.storedRisk).toBe('pass');
    expect(result.flags.some(f => f.id === 'stored-space-tight')).toBe(false);
    expect(result.flags.some(f => f.id === 'stored-space-unknown')).toBe(false);
  });

  it('recommends standard cylinder when space is ok and demand is low', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'ok', bathroomCount: 1 });
    expect(result.recommended.type).toBe('standard');
    expect(result.recommended.volumeBand).toBe('small');
  });

  // ── Space tight ────────────────────────────────────────────────────────────

  it('returns warn when availableSpace is "tight"', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'tight', bathroomCount: 1 });
    expect(result.verdict.storedRisk).toBe('warn');
    const flag = result.flags.find(f => f.id === 'stored-space-tight');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
    expect(flag!.title).toBe('Space constraint');
  });

  it('recommends mixergy when space is tight regardless of demand', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'tight', bathroomCount: 1 });
    expect(result.recommended.type).toBe('mixergy');
  });

  it('returns warn + mixergy when space is tight and high demand (2 bathrooms)', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'tight', bathroomCount: 2 });
    expect(result.verdict.storedRisk).toBe('warn');
    expect(result.recommended.type).toBe('mixergy');
    const spaceFlag = result.flags.find(f => f.id === 'stored-space-tight');
    expect(spaceFlag).toBeDefined();
    expect(spaceFlag!.detail).toContain('Mixergy');
  });

  // ── Space unknown ──────────────────────────────────────────────────────────

  it('returns warn when availableSpace is "unknown"', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'unknown', bathroomCount: 1 });
    expect(result.verdict.storedRisk).toBe('warn');
    const flag = result.flags.find(f => f.id === 'stored-space-unknown');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
  });

  it('defaults to unknown space when availableSpace is not provided', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, bathroomCount: 1 });
    expect(result.verdict.storedRisk).toBe('warn');
    expect(result.flags.some(f => f.id === 'stored-space-unknown')).toBe(true);
  });

  // ── High demand flag ───────────────────────────────────────────────────────

  it('adds high-demand info flag when bathroomCount >= 2', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'ok', bathroomCount: 2 });
    const flag = result.flags.find(f => f.id === 'stored-high-demand');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('info');
  });

  it('adds high-demand info flag when occupancyCount >= 4', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'ok', bathroomCount: 1, occupancyCount: 4 });
    const flag = result.flags.find(f => f.id === 'stored-high-demand');
    expect(flag).toBeDefined();
  });

  it('does not add high-demand flag for 1 bathroom + low occupancy', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'ok', bathroomCount: 1 });
    expect(result.flags.some(f => f.id === 'stored-high-demand')).toBe(false);
  });

  // ── Combi simultaneous-demand failure → stored solves it ─────────────────

  it('adds stored-solves-simultaneous-demand flag when combi simultaneous demand failed', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'ok', bathroomCount: 1 }, true);
    const flag = result.flags.find(f => f.id === 'stored-solves-simultaneous-demand');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('info');
    expect(flag!.title).toBe('Stored cylinder solves simultaneous demand');
  });

  it('does not add stored-solves-simultaneous-demand flag when combi did not fail', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'ok' }, false);
    expect(result.flags.some(f => f.id === 'stored-solves-simultaneous-demand')).toBe(false);
  });

  // ── Volume band sizing ─────────────────────────────────────────────────────

  it('recommends large volume when 3+ bathrooms', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'ok', bathroomCount: 3 });
    expect(result.recommended.volumeBand).toBe('large');
  });

  it('recommends medium volume when 2 bathrooms', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'ok', bathroomCount: 2 });
    expect(result.recommended.volumeBand).toBe('medium');
  });

  it('recommends large volume when occupancyCount >= 5', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'ok', bathroomCount: 1, occupancyCount: 5 });
    expect(result.recommended.volumeBand).toBe('large');
  });

  // ── Mixergy recommended for high demand regardless of space being ok ───────

  it('recommends mixergy when high demand even with ok space', () => {
    const result = runStoredDhwModuleV1({ ...baseInput, availableSpace: 'ok', bathroomCount: 2 });
    expect(result.recommended.type).toBe('mixergy');
  });
});

// ─── Unvented / vented cold-water source tests ────────────────────────────────

describe('runStoredDhwModuleV1 — vented vs unvented logic', () => {
  it('unvented with unknown flow → warns about unconfirmed mains flow', () => {
    const result = runStoredDhwModuleV1({
      ...baseInput,
      coldWaterSource: 'mains_true',
      availableSpace: 'ok',
      bathroomCount: 1,
    });
    const flag = result.flags.find(f => f.id === 'stored-unvented-flow-unknown');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
    expect(result.verdict.storedRisk).toBe('warn');
  });

  it('unvented with low measured flow → warns about performance', () => {
    const result = runStoredDhwModuleV1({
      ...baseInput,
      coldWaterSource: 'mains_true',
      availableSpace: 'ok',
      bathroomCount: 1,
      mainsDynamicFlowLpm: 12,
      mainsDynamicFlowLpmKnown: true,
    });
    const flag = result.flags.find(f => f.id === 'stored-unvented-low-flow');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
    expect(result.verdict.storedRisk).toBe('warn');
  });

  it('unvented with adequate measured flow (>= 18 L/min) → no mains flow warn', () => {
    const result = runStoredDhwModuleV1({
      ...baseInput,
      coldWaterSource: 'mains_true',
      availableSpace: 'ok',
      bathroomCount: 1,
      mainsDynamicFlowLpm: 25,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(result.flags.some(f => f.id === 'stored-unvented-low-flow')).toBe(false);
    expect(result.flags.some(f => f.id === 'stored-unvented-flow-unknown')).toBe(false);
  });

  it('unvented with adequate mains flow: space-unknown flag is info, not warn', () => {
    const result = runStoredDhwModuleV1({
      ...baseInput,
      coldWaterSource: 'mains_true',
      availableSpace: 'unknown',
      bathroomCount: 1,
      mainsDynamicFlowLpm: 30,
      mainsDynamicFlowLpmKnown: true,
    });
    const spaceFlag = result.flags.find(f => f.id === 'stored-space-unknown');
    expect(spaceFlag).toBeDefined();
    expect(spaceFlag!.severity).toBe('info');
    // No warn flags → verdict should be pass
    expect(result.verdict.storedRisk).toBe('pass');
  });

  it('vented (loft_tank): space-unknown keeps warn severity (mains gate not relevant)', () => {
    const result = runStoredDhwModuleV1({
      ...baseInput,
      coldWaterSource: 'loft_tank',
      availableSpace: 'unknown',
      bathroomCount: 1,
    });
    const spaceFlag = result.flags.find(f => f.id === 'stored-space-unknown');
    expect(spaceFlag).toBeDefined();
    expect(spaceFlag!.severity).toBe('warn');
    expect(result.verdict.storedRisk).toBe('warn');
  });
});

// ─── Regression tests for specific screenshot scenarios ───────────────────────

describe('runStoredDhwModuleV1 — scenario regressions', () => {
  it('regression #2: 7+ occupants, 2 bath, unvented, mainsFlow=30 → pass (not caution)', () => {
    // Previously returned 'warn' (Caution) — incorrectly for unvented with good mains
    const result = runStoredDhwModuleV1({
      ...baseInput,
      bathroomCount: 2,
      occupancyCount: 7,
      availableSpace: 'unknown',
      coldWaterSource: 'mains_true',
      mainsDynamicFlowLpm: 30,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(result.verdict.storedRisk).toBe('pass');
  });
});

// ─── Cylinder condition degradation ───────────────────────────────────────────

describe('runStoredDhwModuleV1 — cylinder condition', () => {
  const baseStoredInput: EngineInputV2_3 = {
    ...baseInput,
    availableSpace: 'ok',
  };

  it('returns no cylinderCondition when no cylinder evidence is provided', () => {
    const result = runStoredDhwModuleV1(baseStoredInput);
    expect(result.cylinderCondition).toBeUndefined();
  });

  it('returns cylinderCondition when cylinderInsulationFactor is provided', () => {
    const result = runStoredDhwModuleV1({
      ...baseStoredInput,
      cylinderInsulationFactor: 0.90,
      cylinderCoilTransferFactor: 0.80,
      cylinderConditionBand: 'poor',
    });
    expect(result.cylinderCondition).toBeDefined();
    expect(result.cylinderCondition!.insulationFactor).toBe(0.90);
    expect(result.cylinderCondition!.coilTransferFactor).toBe(0.80);
    expect(result.cylinderCondition!.conditionBand).toBe('poor');
  });

  it('standingLossRelative is > 1.0 when insulationFactor < 1.0', () => {
    const result = runStoredDhwModuleV1({
      ...baseStoredInput,
      cylinderInsulationFactor: 0.80,
      cylinderCoilTransferFactor: 0.80,
      cylinderConditionBand: 'poor',
    });
    expect(result.cylinderCondition!.standingLossRelative).toBeGreaterThan(1.0);
  });

  it('good condition band: no cylinder condition flag emitted', () => {
    const result = runStoredDhwModuleV1({
      ...baseStoredInput,
      cylinderInsulationFactor: 0.97,
      cylinderCoilTransferFactor: 1.0,
      cylinderConditionBand: 'good',
    });
    expect(result.flags.some(f => f.id === 'stored-cylinder-condition')).toBe(false);
  });

  it('moderate condition band: emits info flag', () => {
    const result = runStoredDhwModuleV1({
      ...baseStoredInput,
      cylinderInsulationFactor: 0.88,
      cylinderCoilTransferFactor: 0.90,
      cylinderConditionBand: 'moderate',
    });
    const flag = result.flags.find(f => f.id === 'stored-cylinder-condition');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('info');
  });

  it('poor condition band: emits warn flag', () => {
    const result = runStoredDhwModuleV1({
      ...baseStoredInput,
      cylinderInsulationFactor: 0.78,
      cylinderCoilTransferFactor: 0.80,
      cylinderConditionBand: 'poor',
    });
    const flag = result.flags.find(f => f.id === 'stored-cylinder-condition');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
    expect(result.verdict.storedRisk).toBe('warn');
  });

  it('severe condition band: emits warn flag with replacement guidance', () => {
    const result = runStoredDhwModuleV1({
      ...baseStoredInput,
      cylinderInsulationFactor: 0.68,
      cylinderCoilTransferFactor: 0.70,
      cylinderConditionBand: 'severe',
    });
    const flag = result.flags.find(f => f.id === 'stored-cylinder-condition');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
    expect(flag!.detail.toLowerCase()).toContain('replacement');
  });

  it('degraded cylinder (insulationFactor=0.75) has standingLossRelative ~1.33', () => {
    const result = runStoredDhwModuleV1({
      ...baseStoredInput,
      cylinderInsulationFactor: 0.75,
      cylinderCoilTransferFactor: 0.90,
      cylinderConditionBand: 'poor',
    });
    // 1 / 0.75 = 1.3333...
    expect(result.cylinderCondition!.standingLossRelative).toBeCloseTo(1.33, 1);
  });

  it('cylinder with only insulation degraded (coil clean): flag mentions standing losses', () => {
    const result = runStoredDhwModuleV1({
      ...baseStoredInput,
      cylinderInsulationFactor: 0.80,
      cylinderCoilTransferFactor: 1.0,
      cylinderConditionBand: 'poor',
    });
    const flag = result.flags.find(f => f.id === 'stored-cylinder-condition');
    expect(flag!.detail).toContain('standing loss');
  });

  it('cylinder with only coil degraded: flag mentions recovery time', () => {
    const result = runStoredDhwModuleV1({
      ...baseStoredInput,
      cylinderInsulationFactor: 0.97,
      cylinderCoilTransferFactor: 0.70,
      cylinderConditionBand: 'moderate',
    });
    const flag = result.flags.find(f => f.id === 'stored-cylinder-condition');
    expect(flag!.detail).toContain('recovery time');
  });

  it('cylinder condition flag includes insulation and coil factor values in detail', () => {
    const result = runStoredDhwModuleV1({
      ...baseStoredInput,
      cylinderInsulationFactor: 0.82,
      cylinderCoilTransferFactor: 0.80,
      cylinderConditionBand: 'poor',
    });
    const flag = result.flags.find(f => f.id === 'stored-cylinder-condition');
    expect(flag!.detail).toContain('0.82');
    expect(flag!.detail).toContain('0.80');
  });
});
