/**
 * derivePerformanceEnablers.test.ts
 *
 * Unit tests for the derivePerformanceEnablers helper.
 *
 * Tests verify that:
 *   - all five enablers are always returned (gas_supply removed)
 *   - mains_water_suitability derives correctly from cwsSupplyV1
 *   - emitter_suitability uses systemOptimization.condensingModeAvailable and flowTemp
 *   - controls_quality maps installationPolicy correctly
 *   - system_protection uses hasMagneticFilter from input and sludge proxy from result
 *   - hot_water_fit uses combi/stored DHW verdicts and occupancy data
 *   - gas_supply is NOT present in the returned enablers
 */
import { describe, it, expect } from 'vitest';
import { derivePerformanceEnablers } from '../derivePerformanceEnablers';
import type { FullEngineResult } from '../../../engine/schema/EngineInputV2_3';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Minimal stub factory ─────────────────────────────────────────────────────

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Builds the minimal FullEngineResult stub fields that
 * derivePerformanceEnablers actually reads.
 */
function makeResult(overrides: DeepPartial<FullEngineResult> = {}): FullEngineResult {
  const base: DeepPartial<FullEngineResult> = {
    engineOutput: {
      recommendation: { primary: 'System boiler + stored hot water' },
    },
    cwsSupplyV1: {
      hasMeasurements: true,
      hasDynOpPoint: true,
      waterConfidence: 'good',
      meetsUnventedRequirement: true,
      limitation: 'none',
      dynamic: { flowLpm: 15, pressureBar: 1.5 },
      inconsistent: false,
      notes: [],
      source: 'mains_true',
    },
    systemOptimization: {
      condensingModeAvailable: true,
      designFlowTempC: 55,
      installationPolicy: 'full_job',
      spfRange: [2.8, 3.4],
      spfMidpoint: 3.1,
      radiatorType: 'standard',
      notes: [],
    },
    heatPumpRegime: {
      designFlowTempBand: 35,
      spfBand: 'good',
      designCopEstimate: 3.2,
      coldMorningCopEstimate: 2.4,
      flags: [],
      assumptions: [],
    },
    sludgeVsScale: {
      flowDeratePct: 0,
      cyclingLossPct: 0,
      dhwCapacityDeratePct: 0,
      estimatedScaleThicknessMm: 0,
      dhwRecoveryLatencyIncreaseSec: 0,
      primarySludgeCostGbp: 0,
      dhwScaleCostGbp: 0,
      notes: [],
    },
    combiDhwV1: {
      verdict: { combiRisk: 'pass' },
      morningOverlapProbability: 0,
      flags: [],
      assumptions: [],
      maxQtoDhwKw: 30,
      maxQtoDhwKwDerated: 30,
      dhwCapacityDeratePct: 0,
      dhwRequiredKw: null,
      deliveredFlowLpm: null,
    },
    storedDhwV1: {
      verdict: { storedRisk: 'pass' },
      recommended: { type: 'standard', volumeBand: 'medium' },
      flags: [],
      assumptions: [],
      dhwMixing: { mixingValveRecommended: false, inletTempC: 60, outletTempC: 40 },
    },
  };

  // Shallow-merge overrides at each top-level key
  const merged: DeepPartial<FullEngineResult> = { ...base };
  for (const key of Object.keys(overrides) as (keyof FullEngineResult)[]) {
    if (
      overrides[key] !== null &&
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key])
    ) {
      (merged as Record<string, unknown>)[key] = {
        ...(base[key] as object),
        ...(overrides[key] as object),
      };
    } else {
      (merged as Record<string, unknown>)[key] = overrides[key];
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return merged as any as FullEngineResult;
}

function makeInput(overrides: Partial<EngineInputV2_3> = {}): EngineInputV2_3 {
  return {
    occupancyCount: 2,
    bathroomCount: 1,
    hasMagneticFilter: true,
    ...overrides,
  } as unknown as EngineInputV2_3;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('derivePerformanceEnablers', () => {

  it('always returns exactly 5 enablers', () => {
    const result = makeResult();
    const enablers = derivePerformanceEnablers(result);
    expect(enablers).toHaveLength(5);
  });

  it('returns enablers with the expected IDs in order', () => {
    const result = makeResult();
    const ids = derivePerformanceEnablers(result).map(e => e.id);
    expect(ids).toEqual([
      'mains_water_suitability',
      'emitter_suitability',
      'controls_quality',
      'system_protection',
      'hot_water_fit',
    ]);
  });

  it('gas_supply is not returned as an enabler', () => {
    const result = makeResult();
    const ids = derivePerformanceEnablers(result).map(e => e.id);
    expect(ids).not.toContain('gas_supply');
  });

  it('all enablers have non-empty label, detail, and a valid status', () => {
    const result = makeResult();
    for (const e of derivePerformanceEnablers(result)) {
      expect(e.label.length).toBeGreaterThan(0);
      expect(e.detail.length).toBeGreaterThan(0);
      expect(['ok', 'warning', 'missing']).toContain(e.status);
    }
  });

  // ── mains_water_suitability ──────────────────────────────────────────────

  describe('mains_water_suitability', () => {

    it('ok when flow measured and unvented requirement met', () => {
      const result = makeResult({
        cwsSupplyV1: {
          hasMeasurements: true, waterConfidence: 'good',
          meetsUnventedRequirement: true, limitation: 'none',
          inconsistent: false, notes: [], source: 'mains_true', hasDynOpPoint: true,
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'mains_water_suitability')!;
      expect(e.status).toBe('ok');
    });

    it('missing when no flow measurement', () => {
      const result = makeResult({
        cwsSupplyV1: {
          hasMeasurements: false, waterConfidence: 'missing',
          meetsUnventedRequirement: false, limitation: 'unknown',
          inconsistent: false, notes: [], source: 'unknown', hasDynOpPoint: false,
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'mains_water_suitability')!;
      expect(e.status).toBe('missing');
    });

    it('warning when water confidence is suspect', () => {
      const result = makeResult({
        cwsSupplyV1: {
          hasMeasurements: true, waterConfidence: 'suspect',
          meetsUnventedRequirement: false, limitation: 'none',
          inconsistent: true, notes: [], source: 'mains_true', hasDynOpPoint: true,
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'mains_water_suitability')!;
      expect(e.status).toBe('warning');
    });

    it('warning when limitation is flow', () => {
      const result = makeResult({
        cwsSupplyV1: {
          hasMeasurements: true, waterConfidence: 'good',
          meetsUnventedRequirement: false, limitation: 'flow',
          inconsistent: false, notes: [], source: 'mains_true', hasDynOpPoint: true,
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'mains_water_suitability')!;
      expect(e.status).toBe('warning');
    });

    it('warning when limitation is pressure', () => {
      const result = makeResult({
        cwsSupplyV1: {
          hasMeasurements: true, waterConfidence: 'good',
          meetsUnventedRequirement: false, limitation: 'pressure',
          inconsistent: false, notes: [], source: 'mains_true', hasDynOpPoint: true,
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'mains_water_suitability')!;
      expect(e.status).toBe('warning');
    });
  });

  // ── emitter_suitability ──────────────────────────────────────────────────

  describe('emitter_suitability', () => {

    it('ok when condensing mode is available and flow temp is moderate', () => {
      const result = makeResult({
        systemOptimization: {
          condensingModeAvailable: true, designFlowTempC: 55,
          installationPolicy: 'full_job', spfRange: [2.8, 3.4],
          spfMidpoint: 3.1, radiatorType: 'standard', notes: [],
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'emitter_suitability')!;
      expect(e.status).toBe('ok');
    });

    it('warning when design flow temp is high (≥ 65 °C)', () => {
      const result = makeResult({
        systemOptimization: {
          condensingModeAvailable: false, designFlowTempC: 70,
          installationPolicy: 'high_temp_retrofit', spfRange: [2.5, 3.0],
          spfMidpoint: 2.75, radiatorType: 'standard', notes: [],
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'emitter_suitability')!;
      expect(e.status).toBe('warning');
      expect(e.detail).toContain('70');
    });

    it('warning when condensing mode not available and flow temp is below threshold', () => {
      const result = makeResult({
        systemOptimization: {
          condensingModeAvailable: false, designFlowTempC: 60,
          installationPolicy: 'high_temp_retrofit', spfRange: [2.5, 3.0],
          spfMidpoint: 2.75, radiatorType: 'standard', notes: [],
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'emitter_suitability')!;
      expect(e.status).toBe('warning');
    });

    it('ok for heat pump with 35 °C band', () => {
      const result = makeResult({
        engineOutput: { recommendation: { primary: 'Air source heat pump' } } as FullEngineResult['engineOutput'],
        heatPumpRegime: {
          designFlowTempBand: 35, spfBand: 'good',
          designCopEstimate: 3.5, coldMorningCopEstimate: 2.6,
          flags: [], assumptions: [],
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'emitter_suitability')!;
      expect(e.status).toBe('ok');
    });

    it('warning for heat pump with 50 °C band', () => {
      const result = makeResult({
        engineOutput: { recommendation: { primary: 'Air source heat pump' } } as FullEngineResult['engineOutput'],
        heatPumpRegime: {
          designFlowTempBand: 50, spfBand: 'poor',
          designCopEstimate: 2.2, coldMorningCopEstimate: 1.9,
          flags: [], assumptions: [],
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'emitter_suitability')!;
      expect(e.status).toBe('warning');
    });
  });

  // ── controls_quality ─────────────────────────────────────────────────────

  describe('controls_quality', () => {

    it('ok for full_job installation policy', () => {
      const result = makeResult({
        systemOptimization: {
          condensingModeAvailable: true, designFlowTempC: 55,
          installationPolicy: 'full_job', spfRange: [2.8, 3.4],
          spfMidpoint: 3.1, radiatorType: 'standard', notes: [],
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'controls_quality')!;
      expect(e.status).toBe('ok');
    });

    it('warning for high_temp_retrofit installation policy', () => {
      const result = makeResult({
        systemOptimization: {
          condensingModeAvailable: false, designFlowTempC: 70,
          installationPolicy: 'high_temp_retrofit', spfRange: [2.5, 3.0],
          spfMidpoint: 2.75, radiatorType: 'standard', notes: [],
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'controls_quality')!;
      expect(e.status).toBe('warning');
    });
  });

  // ── system_protection ────────────────────────────────────────────────────

  describe('system_protection', () => {

    it('ok when input.hasMagneticFilter is true', () => {
      const result = makeResult();
      const input = makeInput({ hasMagneticFilter: true });
      const e = derivePerformanceEnablers(result, input).find(x => x.id === 'system_protection')!;
      expect(e.status).toBe('ok');
      expect(e.detail).toMatch(/filtration recorded/i);
    });

    it('warning when input.hasMagneticFilter is false', () => {
      const result = makeResult();
      const input = makeInput({ hasMagneticFilter: false });
      const e = derivePerformanceEnablers(result, input).find(x => x.id === 'system_protection')!;
      expect(e.status).toBe('warning');
      expect(e.detail).toMatch(/no magnetic/i);
    });

    it('warning when input is absent but sludge penalty is active', () => {
      const result = makeResult({
        sludgeVsScale: {
          flowDeratePct: 0.1, cyclingLossPct: 0.02,
          dhwCapacityDeratePct: 0, estimatedScaleThicknessMm: 0,
          dhwRecoveryLatencyIncreaseSec: 0, primarySludgeCostGbp: 50,
          dhwScaleCostGbp: 0, notes: [],
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'system_protection')!;
      expect(e.status).toBe('warning');
    });

    it('missing when input is absent and no sludge penalty', () => {
      const result = makeResult({
        sludgeVsScale: {
          flowDeratePct: 0, cyclingLossPct: 0,
          dhwCapacityDeratePct: 0, estimatedScaleThicknessMm: 0,
          dhwRecoveryLatencyIncreaseSec: 0, primarySludgeCostGbp: 0,
          dhwScaleCostGbp: 0, notes: [],
        },
      });
      const e = derivePerformanceEnablers(result).find(x => x.id === 'system_protection')!;
      expect(e.status).toBe('missing');
    });
  });

  // ── hot_water_fit ────────────────────────────────────────────────────────

  describe('hot_water_fit', () => {

    it('missing when occupancy data is absent', () => {
      const result = makeResult();
      const input = makeInput({ occupancyCount: undefined, bathroomCount: undefined });
      const e = derivePerformanceEnablers(result, input).find(x => x.id === 'hot_water_fit')!;
      expect(e.status).toBe('missing');
    });

    it('missing when no input is provided', () => {
      const result = makeResult();
      const e = derivePerformanceEnablers(result).find(x => x.id === 'hot_water_fit')!;
      expect(e.status).toBe('missing');
    });

    it('ok for stored system with pass verdict', () => {
      const result = makeResult({
        engineOutput: { recommendation: { primary: 'System boiler + stored hot water' } } as FullEngineResult['engineOutput'],
        storedDhwV1: {
          verdict: { storedRisk: 'pass' },
          recommended: { type: 'standard', volumeBand: 'medium' },
          flags: [], assumptions: [],
          dhwMixing: { mixingValveRecommended: false, inletTempC: 60, outletTempC: 40 },
        },
      });
      const input = makeInput({ occupancyCount: 3, bathroomCount: 2 });
      const e = derivePerformanceEnablers(result, input).find(x => x.id === 'hot_water_fit')!;
      expect(e.status).toBe('ok');
    });

    it('warning for stored system with warn verdict', () => {
      const result = makeResult({
        engineOutput: { recommendation: { primary: 'System boiler + stored hot water' } } as FullEngineResult['engineOutput'],
        storedDhwV1: {
          verdict: { storedRisk: 'warn' },
          recommended: { type: 'standard', volumeBand: 'medium' },
          flags: [], assumptions: [],
          dhwMixing: { mixingValveRecommended: false, inletTempC: 60, outletTempC: 40 },
        },
      });
      const input = makeInput({ occupancyCount: 5, bathroomCount: 3 });
      const e = derivePerformanceEnablers(result, input).find(x => x.id === 'hot_water_fit')!;
      expect(e.status).toBe('warning');
    });

    it('ok for combi with pass verdict', () => {
      const result = makeResult({
        engineOutput: { recommendation: { primary: 'Combi boiler' } } as FullEngineResult['engineOutput'],
        combiDhwV1: {
          verdict: { combiRisk: 'pass' },
          morningOverlapProbability: 0,
          flags: [], assumptions: [],
          maxQtoDhwKw: 30, maxQtoDhwKwDerated: 30, dhwCapacityDeratePct: 0,
          dhwRequiredKw: null, deliveredFlowLpm: null,
        },
      });
      const input = makeInput({ occupancyCount: 2, bathroomCount: 1 });
      const e = derivePerformanceEnablers(result, input).find(x => x.id === 'hot_water_fit')!;
      expect(e.status).toBe('ok');
    });

    it('warning for combi with fail verdict', () => {
      const result = makeResult({
        engineOutput: { recommendation: { primary: 'Combi boiler' } } as FullEngineResult['engineOutput'],
        combiDhwV1: {
          verdict: { combiRisk: 'fail' },
          morningOverlapProbability: 0.7,
          flags: [], assumptions: [],
          maxQtoDhwKw: 30, maxQtoDhwKwDerated: 30, dhwCapacityDeratePct: 0,
          dhwRequiredKw: null, deliveredFlowLpm: null,
        },
      });
      const input = makeInput({ occupancyCount: 4, bathroomCount: 2 });
      const e = derivePerformanceEnablers(result, input).find(x => x.id === 'hot_water_fit')!;
      expect(e.status).toBe('warning');
    });
  });

  // ── Mutation safety ──────────────────────────────────────────────────────

  it('does not mutate result or input', () => {
    const result = makeResult();
    const input = makeInput();
    const before = JSON.stringify({ result, input });
    derivePerformanceEnablers(result, input);
    expect(JSON.stringify({ result, input })).toBe(before);
  });
});
