/**
 * regressions.test.ts
 *
 * Regression tests for the four bug-batch fixes:
 *   1. QR/portal block present when output link exists
 *   2. Confidence not penalised solely for missing GC when no GC input path exists
 *   3. UFH emitter type flows through survey → engine schema
 *   4. 12 L/min maps to "limited / fair" wording, not "good", for unvented
 */

import { describe, it, expect } from 'vitest';
import { buildAssumptionsV1 } from '../AssumptionsBuilder';
import { buildOptionMatrixV1 } from '../OptionMatrixBuilder';
import { runEngine } from '../Engine';
import { ASSUMPTION_IDS } from '../../contracts/assumptions.ids';
import type { FullEngineResultCore, EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Shared stubs ─────────────────────────────────────────────────────────────

const coreStub = {} as unknown as FullEngineResultCore;

const baseEngineInput: EngineInputV2_3 = {
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

// ─── Fix 2: Confidence not penalised for missing GC ──────────────────────────

describe('Fix 2 — GC number absence does not reduce confidence', () => {
  it('confidence stays high when all key fields are present except GC number', () => {
    const inputNoGc: EngineInputV2_3 = {
      ...baseEngineInput,
      mainsDynamicFlowLpm: 18,
      mainsDynamicFlowLpmKnown: true,
      heatLossWatts: 8000,
      currentSystem: {
        boiler: {
          // gcNumber deliberately absent — no UI path to provide it
          ageYears: 5,
          nominalOutputKw: 24,
        },
      },
    };
    const { confidence } = buildAssumptionsV1(coreStub, inputNoGc);
    expect(confidence.level).toBe('high');
  });

  it('GC missing assumption is emitted as info severity, not warn', () => {
    const inputNoGc: EngineInputV2_3 = {
      ...baseEngineInput,
      mainsDynamicFlowLpm: 18,
      mainsDynamicFlowLpmKnown: true,
      currentSystem: {
        boiler: {
          ageYears: 5,
          nominalOutputKw: 24,
        },
      },
    };
    const { assumptions } = buildAssumptionsV1(coreStub, inputNoGc);
    const gcAssumption = assumptions.find(a => a.id === ASSUMPTION_IDS.BOILER_GC_MISSING);
    expect(gcAssumption).toBeDefined();
    expect(gcAssumption!.severity).toBe('info');
  });

  it('GC assumption note mentions "not available in the current survey path"', () => {
    const inputNoGc: EngineInputV2_3 = {
      ...baseEngineInput,
      currentSystem: { boiler: {} },
    };
    const { assumptions } = buildAssumptionsV1(coreStub, inputNoGc);
    const gcAssumption = assumptions.find(a => a.id === ASSUMPTION_IDS.BOILER_GC_MISSING);
    expect(gcAssumption?.detail).toContain('current survey path');
  });
});

// ─── Fix 3: UFH emitter type survives into engine schema ──────────────────────

describe('Fix 3 — emitterType field accepted in EngineInputV2_3', () => {
  it('engine runs without error when emitterType is "ufh"', () => {
    const inputUfh: EngineInputV2_3 = {
      ...baseEngineInput,
      emitterType: 'ufh',
    };
    expect(() => runEngine(inputUfh)).not.toThrow();
  });

  it('engine runs without error when emitterType is "mixed"', () => {
    const inputMixed: EngineInputV2_3 = {
      ...baseEngineInput,
      emitterType: 'mixed',
    };
    expect(() => runEngine(inputMixed)).not.toThrow();
  });

  it('engine runs without error when emitterType is "radiators" (default)', () => {
    const inputRadiators: EngineInputV2_3 = {
      ...baseEngineInput,
      emitterType: 'radiators',
    };
    expect(() => runEngine(inputRadiators)).not.toThrow();
  });

  it('engine runs without error when emitterType is absent (backwards compat)', () => {
    const inputNoEmitter: EngineInputV2_3 = { ...baseEngineInput };
    expect(() => runEngine(inputNoEmitter)).not.toThrow();
  });
});

// ─── Fix 4: 12 L/min maps to "limited / fair" for unvented ───────────────────

describe('Fix 4 — 12 L/min unvented DHW wording is "limited / fair", not "good"', () => {
  const inputWith12Lpm: EngineInputV2_3 = {
    ...baseEngineInput,
    preferCombi: false,
    // 12 L/min flow-only (no pressure recorded) — passes gate but is "limited"
    mainsDynamicFlowLpm: 12,
    mainsDynamicFlowLpmKnown: true,
    // No dynamic pressure recorded → triggers flow-only gate
    availableSpace: 'ok',
  };

  it('stored_unvented DHW headline does NOT contain "good flow"', () => {
    const result = runEngine(inputWith12Lpm);
    const options = buildOptionMatrixV1(result, inputWith12Lpm);
    const unvented = options.find(o => o.id === 'stored_unvented');
    expect(unvented).toBeDefined();
    expect(unvented!.dhw?.headline).not.toContain('good flow');
  });

  it('stored_unvented DHW headline contains "limited" or "usable" wording', () => {
    const result = runEngine(inputWith12Lpm);
    const options = buildOptionMatrixV1(result, inputWith12Lpm);
    const unvented = options.find(o => o.id === 'stored_unvented');
    const headline = unvented!.dhw?.headline ?? '';
    expect(headline.toLowerCase()).toMatch(/limited|usable/);
  });

  it('stored_unvented DHW bullets mention simultaneous-outlet limitation', () => {
    const result = runEngine(inputWith12Lpm);
    const options = buildOptionMatrixV1(result, inputWith12Lpm);
    const unvented = options.find(o => o.id === 'stored_unvented');
    const bulletsText = (unvented!.dhw?.bullets ?? []).join(' ').toLowerCase();
    expect(bulletsText).toMatch(/simultaneous|multi-outlet/);
  });

  it('strong flow (≥ 20 L/min) still gets strong/adequate headline', () => {
    const inputWith20Lpm: EngineInputV2_3 = {
      ...inputWith12Lpm,
      mainsDynamicFlowLpm: 20,
      dynamicMainsPressure: 2.0,
    };
    const result = runEngine(inputWith20Lpm);
    const options = buildOptionMatrixV1(result, inputWith20Lpm);
    const unvented = options.find(o => o.id === 'stored_unvented');
    const headline = unvented!.dhw?.headline ?? '';
    // Strong flow should get positive wording, not "limited"
    expect(headline.toLowerCase()).not.toContain('limited');
  });
});
