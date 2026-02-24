import { describe, it, expect } from 'vitest';
import { buildAssumptionsV1 } from '../AssumptionsBuilder';
import type { FullEngineResultCore, EngineInputV2_3 } from '../schema/EngineInputV2_3';

/**
 * Minimal stub for FullEngineResultCore — AssumptionsBuilder only reads from
 * the input, so the core stub can be empty for these tests.
 */
const coreStub = {} as unknown as FullEngineResultCore;

/**
 * A fully-specified input: all key boiler + water fields provided.
 */
const fullySpecifiedInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  staticMainsPressureBar: 3.0,
  mainsDynamicFlowLpm: 18,
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
  currentSystem: {
    boiler: {
      gcNumber: '47-583-03',
      ageYears: 5,
      nominalOutputKw: 24,
    },
  },
};

/**
 * Input with no GC number, no age, no nominal kW, no flow, no heat loss.
 */
const bareMinimumInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 0,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: true,
};

describe('buildAssumptionsV1', () => {
  describe('fully specified input', () => {
    it('returns confidence high when all key fields are provided', () => {
      const { confidence } = buildAssumptionsV1(coreStub, fullySpecifiedInput);
      expect(confidence.level).toBe('high');
    });

    it('does not emit warn assumptions for GC or age when both are provided', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, fullySpecifiedInput);
      const warnAssumptions = assumptions.filter(a => a.severity === 'warn');
      expect(warnAssumptions).toHaveLength(0);
    });

    it('still emits info assumptions for default schedule and τ', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, fullySpecifiedInput);
      const infoIds = assumptions.map(a => a.id);
      expect(infoIds).toContain('timeline-default-schedule');
      expect(infoIds).toContain('timeline-tau-from-sliders');
    });
  });

  describe('missing GC number', () => {
    const input: EngineInputV2_3 = {
      ...fullySpecifiedInput,
      currentSystem: {
        boiler: {
          // gcNumber intentionally omitted
          ageYears: 5,
          nominalOutputKw: 24,
        },
      },
    };

    it('emits the boiler-gc-fallback assumption', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, input);
      const gcAssumption = assumptions.find(a => a.id === 'boiler-gc-fallback');
      expect(gcAssumption).toBeDefined();
      expect(gcAssumption!.severity).toBe('warn');
    });

    it('downgrades confidence to medium', () => {
      const { confidence } = buildAssumptionsV1(coreStub, input);
      expect(confidence.level).toBe('medium');
    });

    it('includes improveBy hint on the assumption', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, input);
      const gcAssumption = assumptions.find(a => a.id === 'boiler-gc-fallback');
      expect(gcAssumption!.improveBy).toBeTruthy();
    });
  });

  describe('missing flow@pressure', () => {
    const input: EngineInputV2_3 = {
      ...fullySpecifiedInput,
      mainsDynamicFlowLpm: undefined,
    };

    it('emits the water-flow-at-pressure-missing assumption', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, input);
      const flowAssumption = assumptions.find(a => a.id === 'water-flow-at-pressure-missing');
      expect(flowAssumption).toBeDefined();
      expect(flowAssumption!.severity).toBe('warn');
    });

    it('downgrades confidence to medium with one missing item', () => {
      const { confidence } = buildAssumptionsV1(coreStub, input);
      expect(confidence.level).toBe('medium');
    });

    it('includes improveBy hint', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, input);
      const a = assumptions.find(a => a.id === 'water-flow-at-pressure-missing');
      expect(a!.improveBy).toBeTruthy();
    });
  });

  describe('many missing fields (bare minimum input)', () => {
    it('downgrades confidence to low when 3+ key items are missing', () => {
      const { confidence } = buildAssumptionsV1(coreStub, bareMinimumInput);
      expect(confidence.level).toBe('low');
    });

    it('emits multiple warn assumptions', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, bareMinimumInput);
      const warnCount = assumptions.filter(a => a.severity === 'warn').length;
      expect(warnCount).toBeGreaterThanOrEqual(3);
    });

    it('emits boiler-gc-fallback when no currentSystem provided', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, bareMinimumInput);
      expect(assumptions.some(a => a.id === 'boiler-gc-fallback')).toBe(true);
    });

    it('emits boiler-age-assumed when no age provided', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, bareMinimumInput);
      expect(assumptions.some(a => a.id === 'boiler-age-assumed')).toBe(true);
    });

    it('emits boiler-nominal-kw-default when no output kW provided', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, bareMinimumInput);
      expect(assumptions.some(a => a.id === 'boiler-nominal-kw-default')).toBe(true);
    });

    it('emits water-flow-at-pressure-missing when no flow provided', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, bareMinimumInput);
      expect(assumptions.some(a => a.id === 'water-flow-at-pressure-missing')).toBe(true);
    });
  });

  describe('confidence reasons', () => {
    it('mentions SEDBUK in reasons when GC is provided', () => {
      const { confidence } = buildAssumptionsV1(coreStub, fullySpecifiedInput);
      expect(confidence.reasons.some(r => r.includes('SEDBUK'))).toBe(true);
    });

    it('mentions band defaults in reasons when GC is missing', () => {
      const input: EngineInputV2_3 = { ...fullySpecifiedInput, currentSystem: undefined };
      const { confidence } = buildAssumptionsV1(coreStub, input);
      expect(confidence.reasons.some(r => r.toLowerCase().includes('band'))).toBe(true);
    });

    it('always includes a reasons array', () => {
      const { confidence } = buildAssumptionsV1(coreStub, bareMinimumInput);
      expect(Array.isArray(confidence.reasons)).toBe(true);
      expect(confidence.reasons.length).toBeGreaterThan(0);
    });
  });

  describe('assumption structure', () => {
    it('all assumptions have required fields', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, bareMinimumInput);
      for (const a of assumptions) {
        expect(typeof a.id).toBe('string');
        expect(typeof a.title).toBe('string');
        expect(typeof a.detail).toBe('string');
        expect(Array.isArray(a.affects)).toBe(true);
        expect(['info', 'warn']).toContain(a.severity);
      }
    });

    it('assumption ids are stable and non-empty', () => {
      const { assumptions } = buildAssumptionsV1(coreStub, bareMinimumInput);
      const ids = assumptions.map(a => a.id);
      for (const id of ids) {
        expect(id.length).toBeGreaterThan(0);
      }
      // No duplicates
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
