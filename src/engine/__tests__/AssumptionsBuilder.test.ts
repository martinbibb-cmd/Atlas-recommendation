import { describe, it, expect } from 'vitest';
import { runEngine } from '../Engine';

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

describe('AssumptionsBuilder', () => {
  it('emits assumption for missing GC number and downgrades confidence', () => {
    const { engineOutput } = runEngine(baseInput);
    const assumptions = engineOutput.meta?.assumptions ?? [];
    const gcAssumption = assumptions.find(a => a.id === 'assumption-no-gc-number');
    expect(gcAssumption).toBeDefined();
    expect(gcAssumption!.severity).toBe('warn');
    expect(gcAssumption!.improveBy).toBeDefined();
    // GC missing → medium or low confidence
    expect(engineOutput.meta?.confidence?.level).not.toBe('high');
  });

  it('emits assumption for missing boiler age', () => {
    const { engineOutput } = runEngine(baseInput);
    const assumptions = engineOutput.meta?.assumptions ?? [];
    const ageAssumption = assumptions.find(a => a.id === 'assumption-no-boiler-age');
    expect(ageAssumption).toBeDefined();
    expect(ageAssumption!.severity).toBe('warn');
  });

  it('emits assumption for missing dynamic flow (L/min @ bar)', () => {
    const { engineOutput } = runEngine(baseInput);
    const assumptions = engineOutput.meta?.assumptions ?? [];
    const flowAssumption = assumptions.find(a => a.id === 'assumption-no-dynamic-flow');
    expect(flowAssumption).toBeDefined();
    expect(flowAssumption!.severity).toBe('warn');
    expect(flowAssumption!.affects).toContain('options');
  });

  it('does NOT emit dynamic flow assumption when mainsDynamicFlowLpm is provided', () => {
    const { engineOutput } = runEngine({ ...baseInput, mainsDynamicFlowLpm: 14 });
    const assumptions = engineOutput.meta?.assumptions ?? [];
    const flowAssumption = assumptions.find(a => a.id === 'assumption-no-dynamic-flow');
    expect(flowAssumption).toBeUndefined();
  });

  it('always emits default DHW schedule and tau assumptions as info', () => {
    const { engineOutput } = runEngine(baseInput);
    const assumptions = engineOutput.meta?.assumptions ?? [];
    const scheduleAssumption = assumptions.find(a => a.id === 'assumption-default-dhw-schedule');
    const tauAssumption = assumptions.find(a => a.id === 'assumption-tau-from-sliders');
    expect(scheduleAssumption).toBeDefined();
    expect(scheduleAssumption!.severity).toBe('info');
    expect(tauAssumption).toBeDefined();
    expect(tauAssumption!.severity).toBe('info');
  });

  it('confidence is low when many key items are missing (no GC, no age, no nominal kW, no flow)', () => {
    // baseInput has none of: gcNumber, boilerAge, nominalOutputKw, mainsDynamicFlowLpm
    // That is 4 missing → low
    const { engineOutput } = runEngine(baseInput);
    expect(engineOutput.meta?.confidence?.level).toBe('low');
  });

  it('confidence is medium when 1-2 key items are missing', () => {
    // Provide GC + age; missing nominalOutputKw and mainsDynamicFlowLpm (2 missing) → medium
    const { engineOutput } = runEngine({
      ...baseInput,
      currentSystem: {
        boiler: {
          gcNumber: 'GC-12345',
          ageYears: 5,
          // nominalOutputKw intentionally omitted
        },
      },
      // mainsDynamicFlowLpm intentionally omitted
    });
    expect(engineOutput.meta?.confidence?.level).toBe('medium');
  });

  it('confidence is high when all key items (GC, age, nominalKw, flow) are provided', () => {
    // Provide everything: GC + age + nominalKw + flow. But sizingV1.peakHeatLossKw
    // may still be null if the engine doesn't have a contract peakHeatLossKw.
    // The heatLossWatts field maps to peakHeatLossKw via sizing; if sizingV1 is not
    // returned (no current boiler) peakHeatLossKw check is skipped, so high is achievable.
    const { engineOutput } = runEngine({
      ...baseInput,
      mainsDynamicFlowLpm: 14,
      currentSystem: {
        boiler: {
          gcNumber: 'GC-12345',
          ageYears: 5,
          nominalOutputKw: 24,
        },
      },
    });
    // No static pressure → info assumption only (not counted)
    // GC ✓, age ✓, nominalKw ✓, flow ✓ → 0 warn missing → high
    expect(engineOutput.meta?.confidence?.level).toBe('high');
  });

  it('confidence reasons array is populated', () => {
    const { engineOutput } = runEngine(baseInput);
    const reasons = engineOutput.meta?.confidence?.reasons ?? [];
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons.some(r => r.toLowerCase().includes('boiler'))).toBe(true);
  });

  it('meta.confidence and meta.assumptions are present in engineOutput', () => {
    const { engineOutput } = runEngine(baseInput);
    expect(engineOutput.meta?.confidence).toBeDefined();
    expect(Array.isArray(engineOutput.meta?.assumptions)).toBe(true);
  });

  it('confidence.level is one of high/medium/low', () => {
    const { engineOutput } = runEngine(baseInput);
    expect(['high', 'medium', 'low']).toContain(engineOutput.meta?.confidence?.level);
  });
});
