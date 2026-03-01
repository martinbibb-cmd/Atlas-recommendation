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

  it('eligibility always contains on_demand, stored_vented, stored_unvented, ashp', () => {
    const { engineOutput } = runEngine(baseInput);
    const ids = engineOutput.eligibility.map(e => e.id);
    expect(ids).toContain('on_demand');
    expect(ids).toContain('stored_vented');
    expect(ids).toContain('stored_unvented');
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
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    const storedVented = engineOutput.eligibility.find(e => e.id === 'stored_vented')!;
    const storedUnvented = engineOutput.eligibility.find(e => e.id === 'stored_unvented')!;
    const ashp = engineOutput.eligibility.find(e => e.id === 'ashp')!;
    expect(onDemand.label).toBe('On Demand (Combi)');
    expect(storedVented.label).toBe('Stored hot water — Vented cylinder');
    expect(storedUnvented.label).toBe('Stored hot water — Unvented cylinder');
    expect(ashp.label).toBe('Air Source Heat Pump');
  });

  it('rejects combi when 2+ bathrooms + high occupancy + peakConcurrentOutlets=2', () => {
    const { engineOutput } = runEngine({ ...baseInput, bathroomCount: 2, highOccupancy: true, peakConcurrentOutlets: 2 });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('rejected');
  });

  it('rejects combi when bathroomCount >= 2 (hard simultaneous-demand gate, even if peakConcurrentOutlets < 2)', () => {
    const { engineOutput } = runEngine({ ...baseInput, bathroomCount: 2, highOccupancy: false });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('rejected');
  });

  it('rejects combi when peakConcurrentOutlets >= 2 (explicit simultaneous demand)', () => {
    const { engineOutput } = runEngine({ ...baseInput, bathroomCount: 2, peakConcurrentOutlets: 2 });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('rejected');
  });

  it('combi is viable for 1 bathroom + low occupancy + professional signature', () => {
    const { engineOutput } = runEngine(baseInput);
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('viable');
  });

  it('stored_vented is rejected when existing loft conversion present', () => {
    const { engineOutput } = runEngine({ ...baseInput, hasLoftConversion: true });
    const storedVented = engineOutput.eligibility.find(e => e.id === 'stored_vented')!;
    expect(storedVented.status).toBe('rejected');
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

  // ── CombiDhwModuleV1 driving On Demand eligibility ───────────────────────

  it('on_demand is rejected when pressure < 1.0 bar (combiDhwV1 pressure lockout)', () => {
    const { engineOutput } = runEngine({ ...baseInput, dynamicMainsPressure: 0.8, bathroomCount: 1 });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('rejected');
  });

  it('on_demand is rejected when peakConcurrentOutlets >= 2 (combiDhwV1 simultaneous demand)', () => {
    const { engineOutput } = runEngine({ ...baseInput, bathroomCount: 1, peakConcurrentOutlets: 2 });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('rejected');
  });

  it('on_demand is caution for steady_home signature with 1 bathroom + 1 outlet', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancySignature: 'steady_home',
    });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('caution');
  });

  it('on_demand is caution for steady signature (V3 alias) with 1 bathroom + 1 outlet', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancySignature: 'steady',
    });
    const onDemand = engineOutput.eligibility.find(e => e.id === 'on_demand')!;
    expect(onDemand.status).toBe('caution');
  });

  it('combiDhwV1 flags are included in engineOutput.redFlags', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      dynamicMainsPressure: 0.5,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
    });
    const pressureFlag = engineOutput.redFlags.find(f => f.id === 'combi-pressure-lockout');
    expect(pressureFlag).toBeDefined();
    expect(pressureFlag!.severity).toBe('fail');
  });

  it('short-draw explainer present when occupancy is steady_home', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
      occupancySignature: 'steady_home',
    });
    const explainer = engineOutput.explainers.find(e => e.id === 'combi-short-draw-collapse');
    expect(explainer).toBeDefined();
    expect(explainer!.body).toContain('28 %');
  });

  it('combiDhwV1 is present in full engine result', () => {
    const result = runEngine(baseInput);
    expect(result.combiDhwV1).toBeDefined();
    expect(['pass', 'warn', 'fail']).toContain(result.combiDhwV1.verdict.combiRisk);
  });

  // ── StoredDhwModuleV1 driving Stored eligibility ──────────────────────────

  it('storedDhwV1 is present in full engine result', () => {
    const result = runEngine(baseInput);
    expect(result.storedDhwV1).toBeDefined();
    expect(['pass', 'warn']).toContain(result.storedDhwV1.verdict.storedRisk);
  });

  it('stored_vented is caution when space is tight and high demand (2 bathrooms)', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      availableSpace: 'tight',
      bathroomCount: 2,
    });
    const storedVented = engineOutput.eligibility.find(e => e.id === 'stored_vented')!;
    expect(storedVented.status).toBe('caution');
  });

  it('stored_vented is viable when availableSpace is "ok" and low demand', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      availableSpace: 'ok',
      bathroomCount: 1,
    });
    const storedVented = engineOutput.eligibility.find(e => e.id === 'stored_vented')!;
    expect(storedVented.status).toBe('viable');
  });

  it('stored_vented is caution when availableSpace is not specified (space unknown)', () => {
    const { engineOutput } = runEngine({ ...baseInput, bathroomCount: 1 });
    const storedVented = engineOutput.eligibility.find(e => e.id === 'stored_vented')!;
    expect(storedVented.status).toBe('caution');
  });

  it('storedDhwV1 flags are included in engineOutput.redFlags', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      availableSpace: 'tight',
      bathroomCount: 2,
    });
    const spaceFlag = engineOutput.redFlags.find(f => f.id === 'stored-space-tight');
    expect(spaceFlag).toBeDefined();
    expect(spaceFlag!.severity).toBe('warn');
  });

  it('Mixergy explainer present when stored recommendation is mixergy', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      availableSpace: 'ok',
      bathroomCount: 2,
    });
    const explainer = engineOutput.explainers.find(e => e.id === 'stored-mixergy-suggested');
    expect(explainer).toBeDefined();
    expect(explainer!.body).toContain('Mixergy');
  });

  // ── Recommendation resolver V1 ────────────────────────────────────────────

  it('recommendation primary is "Stored hot water — unvented cylinder" when on_demand is rejected (2 bathrooms, 2 outlets)', () => {
    const { engineOutput } = runEngine({ ...baseInput, bathroomCount: 2, peakConcurrentOutlets: 2 });
    expect(engineOutput.recommendation.primary).toBe('Stored hot water — unvented cylinder');
  });

  it('recommendation primary is "Stored hot water — unvented cylinder" when pressure lockout fails on_demand', () => {
    const { engineOutput } = runEngine({ ...baseInput, dynamicMainsPressure: 0.5, bathroomCount: 1 });
    expect(engineOutput.recommendation.primary).toBe('Stored hot water — unvented cylinder');
  });

  it('recommendation primary is "Air Source Heat Pump" for steady_home with viable ASHP (28mm)', () => {
    const { engineOutput } = runEngine({
      ...baseInput,
      primaryPipeDiameter: 28,
      heatLossWatts: 8000,
      occupancySignature: 'steady_home',
      bathroomCount: 1,
      peakConcurrentOutlets: 1,
    });
    expect(engineOutput.recommendation.primary).toBe('Air Source Heat Pump');
  });

  // ── Dynamic-pressure-only note deduplication ─────────────────────────────

  it('contextSummary does not duplicate pressure info when only dynamic pressure is provided', () => {
    // baseInput has only dynamicMainsPressure — no static, no flow.
    // Both PressureModule.formattedBullet and CwsSupplyModule.notes would
    // otherwise produce a "dynamic only" pressure bullet; the OutputBuilder
    // should collapse this to a single bullet.
    const { engineOutput } = runEngine(baseInput);
    const bullets = engineOutput.contextSummary?.bullets ?? [];
    const dynamicOnlyBullets = bullets.filter(b =>
      b.toLowerCase().includes('dynamic') && b.toLowerCase().includes('bar'),
    );
    expect(dynamicOnlyBullets.length).toBe(1);
  });

  it('contextSummary retains CWS flow note when flow is measured', () => {
    // When L/min is provided, the CwsSupplyModule note is NOT a duplicate.
    const { engineOutput } = runEngine({ ...baseInput, mainsDynamicFlowLpm: 14 });
    const bullets = engineOutput.contextSummary?.bullets ?? [];
    expect(bullets.some(b => b.includes('L/min'))).toBe(true);
  });
});
