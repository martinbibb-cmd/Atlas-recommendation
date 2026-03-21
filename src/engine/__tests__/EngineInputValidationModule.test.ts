/**
 * EngineInputValidationModule.test.ts
 *
 * Tests for the engine input validation guard.
 *
 * Verifies that:
 *   - Critical inputs that are missing AND collectable by the survey UI are
 *     reported and cause confidence degradation.
 *   - Inputs that the UI never collects (e.g. GC number) do NOT degrade confidence.
 *   - The engine runs safely with partial input (no throws, no panics).
 *   - Inputs already provided do not generate false-positive missing entries.
 */

import { describe, it, expect } from 'vitest';
import { runEngineInputValidation } from '../modules/EngineInputValidationModule';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import { runEngine } from '../Engine';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fullInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 2,
  occupancySignature: 'professional',
  occupancyCount: 3,
  highOccupancy: false,
  preferCombi: false,
  mainsDynamicFlowLpm: 15,
  mainsDynamicFlowLpmKnown: true,
  currentBoilerAgeYears: 8,
  currentBoilerOutputKw: 24,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EngineInputValidation — missing critical inputs', () => {
  it('reports no missing critical inputs when all key fields are provided', () => {
    const result = runEngineInputValidation(fullInput);
    expect(result.missingCriticalInputs).toHaveLength(0);
    expect(result.degradedConfidence).toBe(false);
  });

  it('reports heat_loss as missing when heatLossWatts is absent', () => {
    const input: EngineInputV2_3 = { ...fullInput, heatLossWatts: undefined as unknown as number };
    const result = runEngineInputValidation(input);
    expect(result.missingCriticalInputs).toContain('heat_loss');
    expect(result.degradedConfidence).toBe(true);
  });

  it('reports boiler_age as missing when age fields are absent', () => {
    const input: EngineInputV2_3 = {
      ...fullInput,
      currentBoilerAgeYears: undefined,
      currentSystem: undefined,
    };
    const result = runEngineInputValidation(input);
    expect(result.missingCriticalInputs).toContain('boiler_age');
    expect(result.degradedConfidence).toBe(true);
  });

  it('reports boiler_output as missing when output fields are absent', () => {
    const input: EngineInputV2_3 = {
      ...fullInput,
      currentBoilerOutputKw: undefined,
      currentSystem: undefined,
    };
    const result = runEngineInputValidation(input);
    expect(result.missingCriticalInputs).toContain('boiler_output');
    expect(result.degradedConfidence).toBe(true);
  });
});

describe('EngineInputValidation — non-penalised fields (UI never collects)', () => {
  it('does NOT degrade confidence for absent GC number (no UI collection path)', () => {
    // GC number has no survey question; absence must never penalise confidence.
    const input: EngineInputV2_3 = {
      ...fullInput,
      currentSystem: {
        boiler: {
          // No gcNumber field
          ageYears: 8,
          nominalOutputKw: 24,
        } as EngineInputV2_3['currentSystem'] extends { boiler?: infer B } ? B : never,
      },
    };
    const result = runEngineInputValidation(input);
    // GC number absence is non-penalised — boiler_gc_number must not appear
    // in missingCriticalInputs at all (it's handled by AssumptionsBuilder as 'info').
    expect(result.missingCriticalInputs).not.toContain('boiler_gc_number');
    // Confidence is not degraded for GC number alone.
    // (Other critical fields are satisfied by fullInput spread.)
    expect(result.degradedConfidence).toBe(false);
  });
});

describe('EngineInputValidation — engine runs safely with partial input', () => {
  it('engine does not throw with completely minimal input', () => {
    const minimalInput: EngineInputV2_3 = {
      postcode: 'SW1A 1AA',
      preferCombi: false,
      buildingMass: 'medium',
      primaryPipeDiameter: 22,
      heatLossWatts: 0,
      radiatorCount: 5,
      hasLoftConversion: false,
      returnWaterTemp: 45,
      bathroomCount: 1,
      occupancySignature: 'professional',
      highOccupancy: false,
      dynamicMainsPressure: 2.0,
    };
    expect(() => runEngine(minimalInput)).not.toThrow();
  });

  it('inputValidation is present in the full engine result', () => {
    const result = runEngine(fullInput);
    expect(result.inputValidation).toBeDefined();
    expect(typeof result.inputValidation.degradedConfidence).toBe('boolean');
    expect(Array.isArray(result.inputValidation.missingCriticalInputs)).toBe(true);
  });

  it('full input with all key fields produces non-degraded confidence', () => {
    const result = runEngine(fullInput);
    expect(result.inputValidation.degradedConfidence).toBe(false);
    expect(result.inputValidation.missingCriticalInputs).toHaveLength(0);
  });

  it('partial input (missing heat loss) produces degraded confidence', () => {
    const partial: EngineInputV2_3 = {
      ...fullInput,
      heatLossWatts: 0,  // zero triggers the missing check
    };
    const result = runEngine(partial);
    expect(result.inputValidation.degradedConfidence).toBe(true);
    expect(result.inputValidation.missingCriticalInputs).toContain('heat_loss');
  });
});

describe('EngineInputValidation — no false-positive missing entries', () => {
  it('boilerAgeYears via currentSystem.boiler is not reported as missing', () => {
    const input: EngineInputV2_3 = {
      ...fullInput,
      currentBoilerAgeYears: undefined,
      currentSystem: {
        boiler: {
          ageYears: 10,
          nominalOutputKw: 24,
        } as EngineInputV2_3['currentSystem'] extends { boiler?: infer B } ? B : never,
      },
    };
    const result = runEngineInputValidation(input);
    expect(result.missingCriticalInputs).not.toContain('boiler_age');
  });

  it('boilerOutputKw via currentSystem.boiler is not reported as missing', () => {
    const input: EngineInputV2_3 = {
      ...fullInput,
      currentBoilerOutputKw: undefined,
      currentSystem: {
        boiler: {
          ageYears: 10,
          nominalOutputKw: 28,
        } as EngineInputV2_3['currentSystem'] extends { boiler?: infer B } ? B : never,
      },
    };
    const result = runEngineInputValidation(input);
    expect(result.missingCriticalInputs).not.toContain('boiler_output');
  });
});
