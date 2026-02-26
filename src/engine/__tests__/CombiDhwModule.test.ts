import { describe, it, expect } from 'vitest';
import { runCombiDhwModuleV1 } from '../modules/CombiDhwModule';
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

describe('runCombiDhwModuleV1', () => {
  it('returns pass when pressure is adequate, 1 bathroom, 1 outlet, professional signature', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, peakConcurrentOutlets: 1 });
    expect(result.verdict.combiRisk).toBe('pass');
    expect(result.flags).toHaveLength(0);
  });

  // ── Rule 1: Pressure lockout ─────────────────────────────────────────────

  it('returns fail when dynamicMainsPressure < 1.0 bar', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, dynamicMainsPressure: 0.8 });
    expect(result.verdict.combiRisk).toBe('fail');
    const flag = result.flags.find(f => f.id === 'combi-pressure-lockout');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('fail');
    expect(flag!.title).toBe('Combi safety cut-off risk');
  });

  it('returns pass when dynamicMainsPressure is exactly 1.0 bar', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, dynamicMainsPressure: 1.0, peakConcurrentOutlets: 1 });
    expect(result.flags.some(f => f.id === 'combi-pressure-lockout')).toBe(false);
  });

  it('detail includes the actual pressure value', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, dynamicMainsPressure: 0.6 });
    const flag = result.flags.find(f => f.id === 'combi-pressure-lockout')!;
    expect(flag.detail).toContain('0.6 bar');
  });

  // ── Rule 2: Simultaneous demand ──────────────────────────────────────────

  it('returns fail when bathroomCount >= 2', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 2, peakConcurrentOutlets: 1 });
    expect(result.verdict.combiRisk).toBe('fail');
    const flag = result.flags.find(f => f.id === 'combi-simultaneous-demand');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('fail');
    expect(flag!.title).toBe('Hot water starvation likely');
  });

  it('returns fail when peakConcurrentOutlets >= 2 (even with 1 bathroom)', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 2 });
    expect(result.verdict.combiRisk).toBe('fail');
    const flag = result.flags.find(f => f.id === 'combi-simultaneous-demand');
    expect(flag).toBeDefined();
  });

  it('returns fail for peakConcurrentOutlets = 3', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 3 });
    expect(result.verdict.combiRisk).toBe('fail');
  });

  it('detail mentions bathroom count when outlets not the trigger', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 3, peakConcurrentOutlets: 1 });
    const flag = result.flags.find(f => f.id === 'combi-simultaneous-demand')!;
    expect(flag.detail).toContain('3 bathrooms');
  });

  it('detail mentions concurrent outlets when that is the trigger', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 2 });
    const flag = result.flags.find(f => f.id === 'combi-simultaneous-demand')!;
    expect(flag.detail).toContain('2 concurrent outlets');
  });

  it('adds assumption when peakConcurrentOutlets is not provided', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1 });
    expect(result.assumptions.some(a => a.includes('peakConcurrentOutlets not provided'))).toBe(true);
  });

  // ── Rule 3: Short-draw collapse ──────────────────────────────────────────

  it('adds warn for steady_home signature', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 1, occupancySignature: 'steady_home' });
    const flag = result.flags.find(f => f.id === 'combi-short-draw-collapse');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
  });

  it('adds warn for "steady" V3 alias', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 1, occupancySignature: 'steady' });
    const flag = result.flags.find(f => f.id === 'combi-short-draw-collapse');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
  });

  it('adds warn for shift_worker signature', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 1, occupancySignature: 'shift_worker' });
    const flag = result.flags.find(f => f.id === 'combi-short-draw-collapse');
    expect(flag).toBeDefined();
  });

  it('adds warn for "shift" V3 alias', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 1, occupancySignature: 'shift' });
    const flag = result.flags.find(f => f.id === 'combi-short-draw-collapse');
    expect(flag).toBeDefined();
  });

  it('no short-draw warn for professional signature', () => {
    const result = runCombiDhwModuleV1({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 1, occupancySignature: 'professional' });
    expect(result.flags.some(f => f.id === 'combi-short-draw-collapse')).toBe(false);
  });

  // ── verdict combiRisk = 'warn' when only short-draw flag present ─────────

  it('returns warn (not fail) when only short-draw risk present', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancySignature: 'steady_home',
      dynamicMainsPressure: 2.5,
    });
    expect(result.verdict.combiRisk).toBe('warn');
  });

  // ── Combinations ─────────────────────────────────────────────────────────

  it('fail takes precedence over warn (low pressure + steady_home)', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      dynamicMainsPressure: 0.5,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancySignature: 'steady_home',
    });
    expect(result.verdict.combiRisk).toBe('fail');
    expect(result.flags.length).toBe(2); // pressure-lockout + short-draw
  });

  // ── Rule 4: Three-person household caution ───────────────────────────────

  it('adds warn for occupancyCount === 3 when no simultaneous-demand fail', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancyCount: 3,
    });
    const flag = result.flags.find(f => f.id === 'combi-three-person-caution');
    expect(flag).toBeDefined();
    expect(flag!.severity).toBe('warn');
    expect(result.verdict.combiRisk).toBe('warn');
  });

  it('occupancyCount === 2 does not add three-person caution', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancyCount: 2,
    });
    expect(result.flags.some(f => f.id === 'combi-three-person-caution')).toBe(false);
    expect(result.verdict.combiRisk).toBe('pass');
  });

  it('three-person caution is suppressed when simultaneous-demand fail is already raised', () => {
    const result = runCombiDhwModuleV1({
      ...baseInput,
      bathroomCount: 2,
      peakConcurrentOutlets: 1,
      occupancyCount: 3,
    });
    expect(result.flags.some(f => f.id === 'combi-three-person-caution')).toBe(false);
    expect(result.verdict.combiRisk).toBe('fail');
  });
});
