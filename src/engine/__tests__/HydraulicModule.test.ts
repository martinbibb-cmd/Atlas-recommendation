import { describe, it, expect } from 'vitest';
import { calcFlowLpm, runHydraulicModuleV1, PIPE_THRESHOLDS } from '../modules/HydraulicModule';

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

describe('calcFlowLpm', () => {
  it('returns correct flow for boiler ΔT=20 at 8kW', () => {
    // 8 * 60 / (20 * 4.19) ≈ 5.73 L/min
    expect(calcFlowLpm(8, 20)).toBeCloseTo(5.73, 1);
  });

  it('returns ~4× flow for ASHP ΔT=5 vs boiler ΔT=20 at same power', () => {
    const boilerFlow = calcFlowLpm(8, 20);
    const ashpFlow   = calcFlowLpm(8, 5);
    expect(ashpFlow / boilerFlow).toBeCloseTo(4, 0);
  });
});

describe('HydraulicModuleV1 – result shape', () => {
  it('returns boiler and ashp flow in L/min', () => {
    const result = runHydraulicModuleV1(baseInput);
    expect(result.boiler.flowLpm).toBeGreaterThan(0);
    expect(result.ashp.flowLpm).toBeGreaterThan(0);
    expect(result.boiler.deltaT).toBe(20);
    expect(result.ashp.deltaT).toBe(5);
  });

  it('ashp flowLpm is approximately 4× boiler flowLpm', () => {
    const result = runHydraulicModuleV1(baseInput);
    expect(result.ashp.flowLpm / result.boiler.flowLpm).toBeCloseTo(4, 0);
  });

  it('verdict contains boilerRisk and ashpRisk', () => {
    const result = runHydraulicModuleV1(baseInput);
    expect(['pass', 'warn', 'fail']).toContain(result.verdict.boilerRisk);
    expect(['pass', 'warn', 'fail']).toContain(result.verdict.ashpRisk);
  });

  it('notes is an array', () => {
    const result = runHydraulicModuleV1(baseInput);
    expect(Array.isArray(result.notes)).toBe(true);
  });
});

describe('HydraulicModuleV1 – 22mm pipe', () => {
  it('22mm + 8kW → ASHP warn (caution), boiler pass (viable)', () => {
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 8000 });
    expect(result.verdict.ashpRisk).toBe('warn');
    expect(result.verdict.boilerRisk).toBe('pass');
  });

  it('22mm + 14kW → ASHP fail (rejected)', () => {
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 14000 });
    expect(result.verdict.ashpRisk).toBe('fail');
  });

  it('22mm + 14kW ASHP fail note shows required flow, safe limit and upgrade path', () => {
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 14000 });
    const note = result.notes.find(n => n.includes('ASHP at ΔT'));
    expect(note).toBeDefined();
    expect(note).toContain('L/min');
    expect(note).toContain('22mm pipe max safe flow');
    expect(note).toContain('Upgrade to 28mm');
  });

  it('22mm + 19kW → boiler warn', () => {
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 19000 });
    expect(result.verdict.boilerRisk).toBe('warn');
  });
});

describe('HydraulicModuleV1 – 28mm pipe', () => {
  it('28mm + 14kW → ASHP pass (viable)', () => {
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 14000 });
    expect(result.verdict.ashpRisk).toBe('pass');
  });

  it('28mm + 14kW → boiler pass (viable)', () => {
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 14000 });
    expect(result.verdict.boilerRisk).toBe('pass');
  });

  it('28mm + 14kW produces no notes', () => {
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 14000 });
    expect(result.notes.length).toBe(0);
  });
});

describe('HydraulicModuleV1 – 15mm pipe', () => {
  it('15mm + 5kW → boiler warn or fail (beyond small loads)', () => {
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 15, heatLossWatts: 5000 });
    expect(['warn', 'fail']).toContain(result.verdict.boilerRisk);
  });

  it('15mm + 6kW → boiler fail', () => {
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 15, heatLossWatts: 6000 });
    expect(result.verdict.boilerRisk).toBe('fail');
  });

  it('15mm + 5kW → ASHP fail (beyond safe limit)', () => {
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 15, heatLossWatts: 5000 });
    expect(result.verdict.ashpRisk).toBe('fail');
  });
});

describe('PIPE_THRESHOLDS constants', () => {
  it('15mm ashpFailKw is lower than 22mm ashpFailKw', () => {
    expect(PIPE_THRESHOLDS[15].ashpFailKw).toBeLessThan(PIPE_THRESHOLDS[22].ashpFailKw);
  });

  it('28mm ashpWarnKw is greater than 22mm ashpWarnKw', () => {
    expect(PIPE_THRESHOLDS[28].ashpWarnKw).toBeGreaterThan(PIPE_THRESHOLDS[22].ashpWarnKw);
  });
});

describe('HydraulicModuleV1 – progressive velocity penalty', () => {
  it('returns velocityPenalty = 0 when ASHP velocity is within the safe band', () => {
    // 28mm pipe + 8kW → low velocity, no penalty
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 8000 });
    expect(result.velocityPenalty).toBe(0);
  });

  it('returns velocityPenalty > 0 when ASHP velocity exceeds 1.5 m/s', () => {
    // 15mm pipe + 5kW → very high velocity on narrow pipe
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 15, heatLossWatts: 5000 });
    expect(result.velocityPenalty).toBeGreaterThan(0);
  });

  it('velocityPenalty is clamped to [0, 1]', () => {
    const r1 = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 8000 });
    const r2 = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 15, heatLossWatts: 30000 });
    expect(r1.velocityPenalty).toBeGreaterThanOrEqual(0);
    expect(r1.velocityPenalty).toBeLessThanOrEqual(1);
    expect(r2.velocityPenalty).toBeGreaterThanOrEqual(0);
    expect(r2.velocityPenalty).toBeLessThanOrEqual(1);
  });

  it('effectiveCOP is lower when velocityPenalty > 0', () => {
    const lowPenalty = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 8000 });
    const highPenalty = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 15, heatLossWatts: 8000 });
    expect(highPenalty.effectiveCOP).toBeLessThanOrEqual(lowPenalty.effectiveCOP);
  });

  it('effectiveCOP = baseCOP when velocityPenalty = 0', () => {
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 8000 });
    // base COP is 3.2; with no penalty effectiveCOP should equal 3.2
    expect(result.effectiveCOP).toBeCloseTo(3.2, 1);
  });

  it('ashp.velocityMs is positive for all pipe sizes', () => {
    [15, 22, 28].forEach(diameter => {
      const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: diameter, heatLossWatts: 8000 });
      expect(result.ashp.velocityMs).toBeGreaterThan(0);
    });
  });

  it('wider pipe gives lower ASHP velocity at the same load', () => {
    const r22 = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 22, heatLossWatts: 10000 });
    const r28 = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 28, heatLossWatts: 10000 });
    expect(r22.ashp.velocityMs).toBeGreaterThan(r28.ashp.velocityMs);
  });

  it('velocity penalty note is added when penalty > 0', () => {
    const result = runHydraulicModuleV1({ ...baseInput, primaryPipeDiameter: 15, heatLossWatts: 5000 });
    if (result.velocityPenalty > 0) {
      expect(result.notes.some(n => n.includes('Velocity Penalty'))).toBe(true);
    }
  });
});
