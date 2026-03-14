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

// ─── Storage regime ────────────────────────────────────────────────────────────

describe('runStoredDhwModuleV1 — storage regime', () => {
  const baseStoredInput = {
    postcode: 'SW1A 1AA',
    dynamicMainsPressure: 2.5,
    buildingMass: 'medium' as const,
    primaryPipeDiameter: 22,
    heatLossWatts: 8000,
    radiatorCount: 10,
    hasLoftConversion: false,
    returnWaterTemp: 45,
    bathroomCount: 1,
    occupancySignature: 'professional' as const,
    highOccupancy: false,
    preferCombi: false,
    availableSpace: 'ok' as const,
  };

  it('defaults to boiler_cylinder regime when no dhwStorageRegime is provided', () => {
    const result = runStoredDhwModuleV1(baseStoredInput);
    expect(result.storageRegime).toBe('boiler_cylinder');
  });

  it('emits storageRegime = boiler_cylinder when explicitly set', () => {
    const result = runStoredDhwModuleV1({ ...baseStoredInput, dhwStorageRegime: 'boiler_cylinder' });
    expect(result.storageRegime).toBe('boiler_cylinder');
  });

  it('emits storageRegime = heat_pump_cylinder when explicitly set', () => {
    const result = runStoredDhwModuleV1({ ...baseStoredInput, dhwStorageRegime: 'heat_pump_cylinder' });
    expect(result.storageRegime).toBe('heat_pump_cylinder');
  });

  it('emits usableVolumeFactor for boiler_cylinder close to 1.0', () => {
    const result = runStoredDhwModuleV1({ ...baseStoredInput, dhwStorageRegime: 'boiler_cylinder' });
    expect(result.usableVolumeFactor).toBeCloseTo(1.0, 2);
  });

  it('emits usableVolumeFactor for heat_pump_cylinder less than 1.0', () => {
    const result = runStoredDhwModuleV1({ ...baseStoredInput, dhwStorageRegime: 'heat_pump_cylinder' });
    expect(result.usableVolumeFactor).toBeLessThan(1.0);
    expect(result.usableVolumeFactor).toBeGreaterThan(0);
  });

  it('heat_pump_cylinder usableVolumeFactor is less than boiler_cylinder factor', () => {
    const boiler = runStoredDhwModuleV1({ ...baseStoredInput, dhwStorageRegime: 'boiler_cylinder' });
    const hp = runStoredDhwModuleV1({ ...baseStoredInput, dhwStorageRegime: 'heat_pump_cylinder' });
    expect(hp.usableVolumeFactor).toBeLessThan(boiler.usableVolumeFactor);
  });

  it('emits stored-heat-pump-recovery info flag for heat_pump_cylinder', () => {
    const result = runStoredDhwModuleV1({ ...baseStoredInput, dhwStorageRegime: 'heat_pump_cylinder' });
    const flag = result.flags.find(f => f.id === 'stored-heat-pump-recovery');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('info');
    expect(flag!.detail).toContain('lower temperature');
  });

  it('does NOT emit stored-heat-pump-recovery flag for boiler_cylinder', () => {
    const result = runStoredDhwModuleV1({ ...baseStoredInput, dhwStorageRegime: 'boiler_cylinder' });
    const flag = result.flags.find(f => f.id === 'stored-heat-pump-recovery');
    expect(flag).toBeUndefined();
  });

  it('explicit storeTempC overrides regime-derived temperature', () => {
    const result = runStoredDhwModuleV1({
      ...baseStoredInput,
      dhwStorageRegime: 'heat_pump_cylinder',
      storeTempC: 65,
    });
    expect(result.dhwMixing.storeTempC).toBe(65);
  });

  it('heat_pump_cylinder uses 50°C store by default in dhwMixing', () => {
    const result = runStoredDhwModuleV1({ ...baseStoredInput, dhwStorageRegime: 'heat_pump_cylinder' });
    expect(result.dhwMixing.storeTempC).toBe(50);
  });

  it('boiler_cylinder uses 60°C store by default in dhwMixing', () => {
    const result = runStoredDhwModuleV1({ ...baseStoredInput, dhwStorageRegime: 'boiler_cylinder' });
    expect(result.dhwMixing.storeTempC).toBe(60);
  });

  it('heat_pump_cylinder has higher hotFraction than boiler_cylinder at same tap target', () => {
    const boiler = runStoredDhwModuleV1({ ...baseStoredInput, dhwStorageRegime: 'boiler_cylinder' });
    const hp = runStoredDhwModuleV1({ ...baseStoredInput, dhwStorageRegime: 'heat_pump_cylinder' });
    expect(hp.dhwMixing.hotFraction).toBeGreaterThan(boiler.dhwMixing.hotFraction);
  });
});

// ─── Vented head evaluation ────────────────────────────────────────────────────

describe('runStoredDhwModuleV1 — vented head evaluation', () => {
  const baseVentedInput: EngineInputV2_3 = {
    ...baseInput,
    coldWaterSource: 'loft_tank',
    availableSpace: 'ok',
    bathroomCount: 1,
  };

  it('no cwsHeadMetres provided: no head flag, assumption note added', () => {
    const result = runStoredDhwModuleV1(baseVentedInput);
    expect(result.flags.some(f => f.id === 'stored-vented-low-head')).toBe(false);
    expect(result.assumptions.some(a => a.includes('loft-tank supply'))).toBe(true);
  });

  it('cwsHeadMetres >= 0.5 m: adequate head, no flag', () => {
    const result = runStoredDhwModuleV1({ ...baseVentedInput, cwsHeadMetres: 0.7 });
    expect(result.flags.some(f => f.id === 'stored-vented-low-head')).toBe(false);
    expect(result.assumptions.some(a => a.includes('tank-fed head adequate'))).toBe(true);
  });

  it('cwsHeadMetres 0.3–0.5 m: emits low head warn flag', () => {
    const result = runStoredDhwModuleV1({ ...baseVentedInput, cwsHeadMetres: 0.4 });
    const flag = result.flags.find(f => f.id === 'stored-vented-low-head');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
    expect(flag!.detail).toContain('marginal');
    expect(result.verdict.storedRisk).toBe('warn');
  });

  it('cwsHeadMetres < 0.3 m: emits very-low head warn flag', () => {
    const result = runStoredDhwModuleV1({ ...baseVentedInput, cwsHeadMetres: 0.15 });
    const flag = result.flags.find(f => f.id === 'stored-vented-low-head');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
    expect(flag!.detail).toContain('very weak');
    expect(result.verdict.storedRisk).toBe('warn');
  });

  it('very low head: constraintKind is head-limited', () => {
    const result = runStoredDhwModuleV1({ ...baseVentedInput, cwsHeadMetres: 0.2 });
    expect(result.constraintKind).toBe('head-limited');
  });

  it('adequate head: no constraintKind (pass case)', () => {
    const result = runStoredDhwModuleV1({ ...baseVentedInput, cwsHeadMetres: 1.0 });
    expect(result.constraintKind).toBeUndefined();
    expect(result.verdict.storedRisk).toBe('pass');
  });

  it('low head: title mentions head-limited', () => {
    const result = runStoredDhwModuleV1({ ...baseVentedInput, cwsHeadMetres: 0.25 });
    const flag = result.flags.find(f => f.id === 'stored-vented-low-head');
    expect(flag!.title.toLowerCase()).toContain('head-limited');
  });
});

// ─── Unvented mains pressure evaluation ──────────────────────────────────────

describe('runStoredDhwModuleV1 — unvented mains pressure evaluation', () => {
  const baseUnventedInput: EngineInputV2_3 = {
    ...baseInput,
    coldWaterSource: 'mains_true',
    availableSpace: 'ok',
    bathroomCount: 1,
    mainsDynamicFlowLpm: 25,
    mainsDynamicFlowLpmKnown: true,
  };

  it('adequate pressure (>= 1.5 bar): no mains-limited flag', () => {
    const result = runStoredDhwModuleV1({
      ...baseUnventedInput,
      dynamicMainsPressure: 2.5,
    });
    expect(result.flags.some(f => f.id === 'stored-mains-limited')).toBe(false);
    expect(result.verdict.storedRisk).toBe('pass');
  });

  it('low pressure (< 1.5 bar): emits stored-mains-limited warn flag', () => {
    const result = runStoredDhwModuleV1({
      ...baseUnventedInput,
      dynamicMainsPressure: 1.2,
    });
    const flag = result.flags.find(f => f.id === 'stored-mains-limited');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
    expect(result.verdict.storedRisk).toBe('warn');
  });

  it('low pressure: constraintKind is mains-limited', () => {
    const result = runStoredDhwModuleV1({
      ...baseUnventedInput,
      dynamicMainsPressure: 1.0,
    });
    expect(result.constraintKind).toBe('mains-limited');
  });

  it('dynamicMainsPressureBar alias takes precedence over legacy dynamicMainsPressure', () => {
    // Legacy field says 0.8 bar but preferred alias says 2.0 bar → alias wins
    const result = runStoredDhwModuleV1({
      ...baseUnventedInput,
      dynamicMainsPressure: 0.8,
      dynamicMainsPressureBar: 2.0,
    });
    expect(result.flags.some(f => f.id === 'stored-mains-limited')).toBe(false);
  });

  it('low pressure flag detail mentions mains-limited', () => {
    const result = runStoredDhwModuleV1({
      ...baseUnventedInput,
      dynamicMainsPressure: 1.3,
    });
    const flag = result.flags.find(f => f.id === 'stored-mains-limited');
    expect(flag!.detail.toLowerCase()).toContain('mains-limited');
  });

  it('low pressure alongside adequate flow: both constraint and flow adequacy respected', () => {
    const result = runStoredDhwModuleV1({
      ...baseUnventedInput,
      dynamicMainsPressure: 1.1,
      mainsDynamicFlowLpm: 25,
      mainsDynamicFlowLpmKnown: true,
    });
    // mains-limited should be present (pressure gate)
    expect(result.flags.some(f => f.id === 'stored-mains-limited')).toBe(true);
    // low-flow flag should NOT be present (flow is adequate)
    expect(result.flags.some(f => f.id === 'stored-unvented-low-flow')).toBe(false);
  });
});

// ─── Thermal capacity evaluation ──────────────────────────────────────────────

describe('runStoredDhwModuleV1 — thermal capacity evaluation', () => {
  const baseThermalInput: EngineInputV2_3 = {
    ...baseInput,
    availableSpace: 'ok',
    bathroomCount: 1,
    occupancyCount: 2,
  };

  it('no cylinderVolumeLitres: no thermal-capacity flag', () => {
    const result = runStoredDhwModuleV1(baseThermalInput);
    expect(result.flags.some(f => f.id === 'stored-thermal-capacity-limited')).toBe(false);
  });

  it('adequate volume for 1 bath / 2 occupants: no thermal-capacity flag', () => {
    const result = runStoredDhwModuleV1({
      ...baseThermalInput,
      cylinderVolumeLitres: 120,
    });
    expect(result.flags.some(f => f.id === 'stored-thermal-capacity-limited')).toBe(false);
    expect(result.verdict.storedRisk).toBe('pass');
  });

  it('undersized cylinder for 1 bath / 2 occupants: emits thermal-capacity-limited warn', () => {
    // 1 bath: min = 1 × 80 = 80L, with floor 100L
    const result = runStoredDhwModuleV1({
      ...baseThermalInput,
      cylinderVolumeLitres: 60,
    });
    const flag = result.flags.find(f => f.id === 'stored-thermal-capacity-limited');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
    expect(result.verdict.storedRisk).toBe('warn');
  });

  it('undersized for 2 baths / 3 occupants: constraintKind is thermal-capacity-limited', () => {
    // 2 baths: min = 2 × 80 + 1 × 25 = 185L
    const result = runStoredDhwModuleV1({
      ...baseThermalInput,
      bathroomCount: 2,
      occupancyCount: 3,
      cylinderVolumeLitres: 120,
    });
    expect(result.constraintKind).toBe('thermal-capacity-limited');
    expect(result.flags.some(f => f.id === 'stored-thermal-capacity-limited')).toBe(true);
  });

  it('adequate volume for 2 baths / 3 occupants: no thermal flag', () => {
    const result = runStoredDhwModuleV1({
      ...baseThermalInput,
      bathroomCount: 2,
      occupancyCount: 3,
      cylinderVolumeLitres: 210,
    });
    expect(result.flags.some(f => f.id === 'stored-thermal-capacity-limited')).toBe(false);
  });

  it('high simultaneousDrawSeverity increases minimum volume threshold', () => {
    // 1 bath: base min = 100L; with high severity × 1.2 = 120L
    const resultLow = runStoredDhwModuleV1({
      ...baseThermalInput,
      cylinderVolumeLitres: 110,
      simultaneousDrawSeverity: 'low',
    });
    const resultHigh = runStoredDhwModuleV1({
      ...baseThermalInput,
      cylinderVolumeLitres: 110,
      simultaneousDrawSeverity: 'high',
    });
    // 110L passes for low severity but fails for high
    expect(resultLow.flags.some(f => f.id === 'stored-thermal-capacity-limited')).toBe(false);
    expect(resultHigh.flags.some(f => f.id === 'stored-thermal-capacity-limited')).toBe(true);
  });

  it('thermal-capacity-limited detail mentions cylinder volume and minimum', () => {
    const result = runStoredDhwModuleV1({
      ...baseThermalInput,
      cylinderVolumeLitres: 70,
    });
    const flag = result.flags.find(f => f.id === 'stored-thermal-capacity-limited');
    expect(flag!.detail).toContain('70 L');
    expect(flag!.detail.toLowerCase()).toContain('thermal-capacity-limited');
  });
});

// ─── Heat pump cylinder efficiency penalty ────────────────────────────────────

describe('runStoredDhwModuleV1 — heat pump cylinder efficiency penalty', () => {
  const baseHpInput: EngineInputV2_3 = {
    ...baseInput,
    availableSpace: 'ok',
    bathroomCount: 1,
    dhwStorageRegime: 'heat_pump_cylinder',
  };

  it('heat_pump_cylinder: emits stored-heat-pump-efficiency-penalty warn flag', () => {
    const result = runStoredDhwModuleV1(baseHpInput);
    const flag = result.flags.find(f => f.id === 'stored-heat-pump-efficiency-penalty');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
  });

  it('heat_pump_cylinder: efficiency penalty flag detail mentions COP', () => {
    const result = runStoredDhwModuleV1(baseHpInput);
    const flag = result.flags.find(f => f.id === 'stored-heat-pump-efficiency-penalty');
    expect(flag!.detail.toLowerCase()).toContain('cop');
  });

  it('heat_pump_cylinder: efficiency penalty flag detail mentions reduced-efficiency', () => {
    const result = runStoredDhwModuleV1(baseHpInput);
    const flag = result.flags.find(f => f.id === 'stored-heat-pump-efficiency-penalty');
    expect(flag!.detail.toLowerCase()).toContain('reduced-efficiency');
  });

  it('heat_pump_cylinder: storedRisk is warn (efficiency penalty is a warn flag)', () => {
    const result = runStoredDhwModuleV1(baseHpInput);
    expect(result.verdict.storedRisk).toBe('warn');
  });

  it('heat_pump_cylinder: constraintKind is reduced-efficiency-hot-water', () => {
    const result = runStoredDhwModuleV1(baseHpInput);
    expect(result.constraintKind).toBe('reduced-efficiency-hot-water');
  });

  it('boiler_cylinder: no efficiency-penalty flag', () => {
    const result = runStoredDhwModuleV1({ ...baseHpInput, dhwStorageRegime: 'boiler_cylinder' });
    expect(result.flags.some(f => f.id === 'stored-heat-pump-efficiency-penalty')).toBe(false);
  });

  it('heat_pump_cylinder: both stored-heat-pump-recovery (info) and efficiency-penalty (warn) are present', () => {
    const result = runStoredDhwModuleV1(baseHpInput);
    const recoveryFlag = result.flags.find(f => f.id === 'stored-heat-pump-recovery');
    const penaltyFlag = result.flags.find(f => f.id === 'stored-heat-pump-efficiency-penalty');
    expect(recoveryFlag).toBeDefined();
    expect(penaltyFlag).toBeDefined();
    expect(recoveryFlag!.severity).toBe('info');
    expect(penaltyFlag!.severity).toBe('warn');
  });

  it('head-limited takes priority over reduced-efficiency constraintKind', () => {
    const result = runStoredDhwModuleV1({
      ...baseHpInput,
      coldWaterSource: 'loft_tank',
      dhwStorageRegime: 'heat_pump_cylinder',
      cwsHeadMetres: 0.2,
    });
    // Head-limited should take precedence over the HP efficiency penalty
    expect(result.constraintKind).toBe('head-limited');
  });
});

// ─── Mixergy path remains distinct ───────────────────────────────────────────

describe('runStoredDhwModuleV1 — Mixergy path', () => {
  const baseMixergyInput: EngineInputV2_3 = {
    ...baseInput,
    availableSpace: 'tight',
    bathroomCount: 2,
    occupancyCount: 4,
    dhwTankType: 'mixergy',
  };

  it('tight space + high demand: recommends mixergy', () => {
    const result = runStoredDhwModuleV1(baseMixergyInput);
    expect(result.recommended.type).toBe('mixergy');
  });

  it('tight space: emits stored-space-tight warn flag', () => {
    const result = runStoredDhwModuleV1(baseMixergyInput);
    expect(result.flags.some(f => f.id === 'stored-space-tight')).toBe(true);
  });

  it('high demand: emits stored-high-demand info flag', () => {
    const result = runStoredDhwModuleV1(baseMixergyInput);
    expect(result.flags.some(f => f.id === 'stored-high-demand')).toBe(true);
  });

  it('Mixergy with ok space and low demand: recommends mixergy only when dhwTankType=mixergy', () => {
    const result = runStoredDhwModuleV1({
      ...baseInput,
      availableSpace: 'ok',
      bathroomCount: 1,
      dhwTankType: 'mixergy',
    });
    // Low demand + ok space → standard cylinder recommended by default (Mixergy is dhwTankType input, not output override)
    expect(result.recommended.type).toBe('standard');
  });

  it('Mixergy path: no heat-pump efficiency-penalty flag (boiler regime)', () => {
    const result = runStoredDhwModuleV1({
      ...baseMixergyInput,
      dhwStorageRegime: 'boiler_cylinder',
    });
    expect(result.flags.some(f => f.id === 'stored-heat-pump-efficiency-penalty')).toBe(false);
  });

  it('Mixergy with unvented and adequate mains: no mains-limited flag', () => {
    const result = runStoredDhwModuleV1({
      ...baseMixergyInput,
      coldWaterSource: 'mains_true',
      mainsDynamicFlowLpm: 25,
      mainsDynamicFlowLpmKnown: true,
      dynamicMainsPressure: 2.5,
    });
    expect(result.flags.some(f => f.id === 'stored-mains-limited')).toBe(false);
  });
});

// ─── constraintKind priority ordering ────────────────────────────────────────

describe('runStoredDhwModuleV1 — constraintKind priority ordering', () => {
  const baseOrderInput: EngineInputV2_3 = {
    ...baseInput,
    availableSpace: 'ok',
    bathroomCount: 1,
    occupancyCount: 2,
  };

  it('no constraints: constraintKind is undefined', () => {
    const result = runStoredDhwModuleV1({ ...baseOrderInput, dynamicMainsPressure: 2.5 });
    expect(result.constraintKind).toBeUndefined();
  });

  it('mains-limited alone: constraintKind is mains-limited', () => {
    const result = runStoredDhwModuleV1({
      ...baseOrderInput,
      coldWaterSource: 'mains_true',
      dynamicMainsPressure: 1.0,
      mainsDynamicFlowLpm: 25,
      mainsDynamicFlowLpmKnown: true,
    });
    expect(result.constraintKind).toBe('mains-limited');
  });

  it('thermal-capacity-limited alone: constraintKind is thermal-capacity-limited', () => {
    const result = runStoredDhwModuleV1({
      ...baseOrderInput,
      cylinderVolumeLitres: 60,
    });
    expect(result.constraintKind).toBe('thermal-capacity-limited');
  });

  it('recovery-limited via severely fouled coil: constraintKind is recovery-limited', () => {
    const result = runStoredDhwModuleV1({
      ...baseOrderInput,
      cylinderInsulationFactor: 0.97,
      cylinderCoilTransferFactor: 0.75,
      cylinderConditionBand: 'poor',
    });
    expect(result.constraintKind).toBe('recovery-limited');
  });

  it('thermal-capacity-limited takes priority over recovery-limited', () => {
    const result = runStoredDhwModuleV1({
      ...baseOrderInput,
      cylinderVolumeLitres: 60,
      cylinderInsulationFactor: 0.97,
      cylinderCoilTransferFactor: 0.75,
      cylinderConditionBand: 'poor',
    });
    // thermal-capacity-limited is higher priority than recovery-limited
    expect(result.constraintKind).toBe('thermal-capacity-limited');
  });
});
