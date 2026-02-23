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
