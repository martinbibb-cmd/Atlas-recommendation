import { describe, it, expect } from 'vitest';
import { runEngine } from '../Engine';
import { buildEngineOutputV1 } from '../OutputBuilder';

const baseInput = {
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
  preferCombi: true,
};

describe('OutputBuilder visuals', () => {
  it('engineOutput includes a visuals array', () => {
    const { engineOutput } = runEngine(baseInput);
    expect(Array.isArray(engineOutput.visuals)).toBe(true);
    expect((engineOutput.visuals ?? []).length).toBeGreaterThan(0);
  });

  it('emits a pressure_drop visual', () => {
    const { engineOutput } = runEngine(baseInput);
    const visual = engineOutput.visuals?.find(v => v.type === 'pressure_drop');
    expect(visual).toBeDefined();
    expect(visual!.id).toBe('pressure_drop');
    expect(typeof visual!.data.dynamicBar).toBe('number');
  });

  it('pressure_drop visual includes staticBar and dropBar when static pressure is provided (no quality field)', () => {
    const input = { ...baseInput, staticMainsPressureBar: 3.5 };
    const { engineOutput } = runEngine(input);
    const visual = engineOutput.visuals?.find(v => v.type === 'pressure_drop');
    expect(visual).toBeDefined();
    expect(typeof visual!.data.staticBar).toBe('number');
    expect(typeof visual!.data.dropBar).toBe('number');
    expect(visual!.data.quality).toBeUndefined();
  });

  it('emits an ashp_flow visual with boiler and ASHP L/min', () => {
    const { engineOutput } = runEngine(baseInput);
    const visual = engineOutput.visuals?.find(v => v.type === 'ashp_flow');
    expect(visual).toBeDefined();
    expect(typeof visual!.data.boilerFlowLpm).toBe('number');
    expect(typeof visual!.data.ashpFlowLpm).toBe('number');
    expect(visual!.data.ashpFlowLpm).toBeGreaterThan(visual!.data.boilerFlowLpm);
    expect(typeof visual!.data.multiplier).toBe('number');
  });

  it('ashp_flow visual title is "System flow requirement at design ΔT"', () => {
    const { engineOutput } = runEngine(baseInput);
    const visual = engineOutput.visuals?.find(v => v.type === 'ashp_flow');
    expect(visual!.title).toBe('System flow requirement at design ΔT');
  });

  it('ashp_flow visual labels include "Primary circuit flow requirement" for both boiler and ASHP', () => {
    const { engineOutput } = runEngine(baseInput);
    const visual = engineOutput.visuals?.find(v => v.type === 'ashp_flow');
    expect(visual!.data.labels?.boiler).toContain('Primary circuit flow requirement');
    expect(visual!.data.labels?.ashp).toContain('Primary circuit flow requirement');
  });

  it('ashp_flow visual multiplier is ≈ 4 (ASHP ΔT 5°C vs boiler ΔT 20°C)', () => {
    const { engineOutput } = runEngine(baseInput);
    const visual = engineOutput.visuals?.find(v => v.type === 'ashp_flow');
    expect(visual!.data.multiplier).toBeCloseTo(4.0, 0);
  });

  it('emits a dhw_outlets visual', () => {
    const { engineOutput } = runEngine(baseInput);
    const visual = engineOutput.visuals?.find(v => v.type === 'dhw_outlets');
    expect(visual).toBeDefined();
    expect(['pass', 'warn', 'fail']).toContain(visual!.data.combiRisk);
    expect(typeof visual!.data.simultaneousFail).toBe('boolean');
  });

  it('dhw_outlets simultaneousFail is true when bathroomCount >= 2', () => {
    const { engineOutput } = runEngine({ ...baseInput, bathroomCount: 2 });
    const visual = engineOutput.visuals?.find(v => v.type === 'dhw_outlets');
    expect(visual!.data.simultaneousFail).toBe(true);
  });

  it('emits a space_footprint visual', () => {
    const { engineOutput } = runEngine(baseInput);
    const visual = engineOutput.visuals?.find(v => v.type === 'space_footprint');
    expect(visual).toBeDefined();
    expect(['pass', 'warn']).toContain(visual!.data.storedRisk);
    expect(typeof visual!.data.mixergyLitres).toBe('number');
    expect(typeof visual!.data.conventionalLitres).toBe('number');
    expect(typeof visual!.data.footprintSavingPct).toBe('number');
  });

  it('visuals are present even when buildEngineOutputV1 is called without input (no options)', () => {
    const result = runEngine(baseInput);
    // Call without input — options will be undefined but visuals must still be present
    const output = buildEngineOutputV1(result);
    expect(Array.isArray(output.visuals)).toBe(true);
    expect((output.visuals ?? []).length).toBeGreaterThan(0);
    expect(output.options).toBeUndefined();
  });

  it('all visual ids are unique within a single output', () => {
    const { engineOutput } = runEngine(baseInput);
    const ids = (engineOutput.visuals ?? []).map(v => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all visuals have a type from the allowed set', () => {
    const allowed = new Set(['pressure_drop', 'ashp_flow', 'dhw_outlets', 'space_footprint', 'timeline_24h']);
    const { engineOutput } = runEngine(baseInput);
    for (const v of engineOutput.visuals ?? []) {
      expect(allowed.has(v.type)).toBe(true);
    }
  });
});
