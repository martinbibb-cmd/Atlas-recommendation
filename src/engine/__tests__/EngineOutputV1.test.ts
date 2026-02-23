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

describe('EngineOutputV1 shape', () => {
  it('includes engineOutput in runEngine result', () => {
    const result = runEngine(baseInput);
    expect(result.engineOutput).toBeDefined();
  });

  it('engineOutput has required fields', () => {
    const { engineOutput } = runEngine(baseInput);
    expect(Array.isArray(engineOutput.eligibility)).toBe(true);
    expect(Array.isArray(engineOutput.redFlags)).toBe(true);
    expect(typeof engineOutput.recommendation.primary).toBe('string');
    expect(engineOutput.recommendation.primary.length).toBeGreaterThan(0);
    expect(Array.isArray(engineOutput.explainers)).toBe(true);
  });

  it('eligibility always contains instant, stored, ashp', () => {
    const { engineOutput } = runEngine(baseInput);
    const ids = engineOutput.eligibility.map(e => e.id);
    expect(ids).toContain('instant');
    expect(ids).toContain('stored');
    expect(ids).toContain('ashp');
  });

  it('eligibility items have valid status values', () => {
    const { engineOutput } = runEngine(baseInput);
    for (const item of engineOutput.eligibility) {
      expect(['viable', 'rejected', 'caution']).toContain(item.status);
    }
  });

  it('eligibility labels are stable for a given input', () => {
    const { engineOutput } = runEngine(baseInput);
    const instant = engineOutput.eligibility.find(e => e.id === 'instant')!;
    const stored = engineOutput.eligibility.find(e => e.id === 'stored')!;
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(instant.label).toBe('Combi / Instantaneous');
    expect(stored.label).toBe('Stored Cylinder');
    expect(ashp.label).toBe('Air Source Heat Pump');
  });

  it('rejects combi when 2+ bathrooms + high occupancy', () => {
    const { engineOutput } = runEngine({ ...baseInput, bathroomCount: 2, highOccupancy: true });
    const instant = engineOutput.eligibility.find(e => e.id === 'instant')!;
    expect(instant.status).toBe('rejected');
  });

  it('combi is viable for 1 bathroom + low occupancy', () => {
    const { engineOutput } = runEngine(baseInput);
    const instant = engineOutput.eligibility.find(e => e.id === 'instant')!;
    expect(instant.status).toBe('viable');
  });

  it('stored is rejected when loft conversion present', () => {
    const { engineOutput } = runEngine({ ...baseInput, hasLoftConversion: true });
    const stored = engineOutput.eligibility.find(e => e.id === 'stored')!;
    expect(stored.status).toBe('rejected');
  });

  it('ashp is caution for 22mm pipes with high heat loss', () => {
    const { engineOutput } = runEngine({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 10000 });
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(ashp.status).toBe('caution');
  });

  it('ashp is rejected for one-pipe topology', () => {
    const { engineOutput } = runEngine({ ...baseInput, pipingTopology: 'one_pipe' });
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(ashp.status).toBe('rejected');
  });

  it('red flags have valid severity values', () => {
    const { engineOutput } = runEngine({ ...baseInput, bathroomCount: 2, highOccupancy: true });
    for (const flag of engineOutput.redFlags) {
      expect(['info', 'warn', 'fail']).toContain(flag.severity);
      expect(typeof flag.title).toBe('string');
      expect(typeof flag.detail).toBe('string');
      expect(flag.title.length).toBeGreaterThan(0);
    }
  });

  it('meta block contains engineVersion and contractVersion', () => {
    const { engineOutput } = runEngine(baseInput);
    expect(engineOutput.meta?.engineVersion).toBe('0.2.0');
    expect(engineOutput.meta?.contractVersion).toBe('2.3');
  });

  it('recommendation primary is non-empty string for all occupancy signatures', () => {
    const signatures = ['professional', 'steady_home', 'shift_worker', 'steady', 'shift'] as const;
    for (const sig of signatures) {
      const { engineOutput } = runEngine({ ...baseInput, occupancySignature: sig });
      expect(typeof engineOutput.recommendation.primary).toBe('string');
      expect(engineOutput.recommendation.primary.length).toBeGreaterThan(0);
    }
  });

  // ── HydraulicModuleV1 driving ASHP eligibility ────────────────────────────

  it('ashp is rejected when hydraulicV1 ashpRisk is fail (22mm + 14kW)', () => {
    const { engineOutput } = runEngine({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 14000 });
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(ashp.status).toBe('rejected');
  });

  it('ashp is caution when hydraulicV1 ashpRisk is warn (22mm + 8kW)', () => {
    const { engineOutput } = runEngine({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 8000 });
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(ashp.status).toBe('caution');
  });

  it('ashp is viable for 28mm + 14kW (hydraulicV1 ashpRisk pass)', () => {
    const { engineOutput } = runEngine({ ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 14000 });
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(ashp.status).toBe('viable');
  });

  it('ashp rejected for 22mm + 14kW has a reason string', () => {
    const { engineOutput } = runEngine({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 14000 });
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(typeof ashp.reason).toBe('string');
    expect((ashp.reason as string).length).toBeGreaterThan(0);
  });

  it('hydraulic ASHP explainer present when ashpRisk is not pass', () => {
    const { engineOutput } = runEngine({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 8000 });
    const explainer = engineOutput.explainers.find(e => e.id === 'hydraulic-ashp-flow');
    expect(explainer).toBeDefined();
    expect(explainer!.body).toContain('4.0×');
  });

  it('hydraulicV1 is present in full engine result', () => {
    const result = runEngine(baseInput);
    expect(result.hydraulicV1).toBeDefined();
    expect(result.hydraulicV1.boiler.flowLpm).toBeGreaterThan(0);
    expect(result.hydraulicV1.ashp.flowLpm).toBeGreaterThan(0);
  });
});
