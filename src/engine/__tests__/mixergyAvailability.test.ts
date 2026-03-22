/**
 * mixergyAvailability.test.ts
 *
 * Tests for PR1 Mixergy-as-cylinder-type fixes:
 *
 *   1. Stratification Bug — active stratification must ONLY appear for
 *      dhwTankType === 'mixergy', never for standard unvented or open vented.
 *
 *   2. Mixergy Availability — Mixergy must be available wherever a cylinder
 *      is used (system boiler, regular/vented, heat pump) and must NOT be
 *      available for combi (no stored volume).
 *
 *   3. Advice correctness — engine advice correctly reflects the system +
 *      cylinder combination.
 */

import { describe, it, expect } from 'vitest';
import { runEngine } from '../Engine';
import { runSpecEdgeModule } from '../modules/SpecEdgeModule';
import { buildRealWorldBehavioursV1 } from '../modules/RealWorldBehaviourModule';
import type { EngineInputV2_3, SpecEdgeInput } from '../schema/EngineInputV2_3';
import { isStandardCylinder, hasActivStratification } from '../schema/EngineInputV2_3';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Stored system — moderate mains, 2 bathrooms. */
const BASE_STORED: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  mainsDynamicFlowLpm: 20,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 2,
  occupancyCount: 3,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: false,
  coldWaterSource: 'mains_true',
  availableSpace: 'ok',
};

const BASE_SPEC_EDGE: SpecEdgeInput = {
  installationPolicy: 'full_job',
  heatLossWatts: 8000,
  unitModulationFloorKw: 3,
  waterHardnessCategory: 'hard',
  hasSoftener: false,
  hasMagneticFilter: false,
};

// ─── DhwTankType helper tests ─────────────────────────────────────────────────

describe('DhwTankType helpers', () => {
  it('hasActivStratification returns true only for mixergy', () => {
    expect(hasActivStratification('mixergy')).toBe(true);
    expect(hasActivStratification('standard')).toBe(false);
    expect(hasActivStratification('standard_unvented')).toBe(false);
    expect(hasActivStratification('standard_vented')).toBe(false);
    expect(hasActivStratification(undefined)).toBe(false);
  });

  it('isStandardCylinder returns true for all non-mixergy types', () => {
    expect(isStandardCylinder('standard')).toBe(true);
    expect(isStandardCylinder('standard_unvented')).toBe(true);
    expect(isStandardCylinder('standard_vented')).toBe(true);
    expect(isStandardCylinder('mixergy')).toBe(false);
    expect(isStandardCylinder(undefined)).toBe(false);
  });
});

// ─── Stratification gating in SpecEdgeModule ─────────────────────────────────

describe('Stratification — SpecEdgeModule gates on dhwTankType', () => {
  it('standard cylinder: no Mixergy gas-saving metric', () => {
    const result = runSpecEdgeModule({ ...BASE_SPEC_EDGE, dhwTankType: 'standard' });
    expect(result.mixergyGasSavingPct).toBeUndefined();
    expect(result.mixergyFootprintReductionPct).toBeUndefined();
  });

  it('standard_unvented cylinder: no Mixergy gas-saving metric', () => {
    const result = runSpecEdgeModule({ ...BASE_SPEC_EDGE, dhwTankType: 'standard_unvented' });
    expect(result.mixergyGasSavingPct).toBeUndefined();
    expect(result.mixergyFootprintReductionPct).toBeUndefined();
  });

  it('standard_vented cylinder: no Mixergy gas-saving metric', () => {
    const result = runSpecEdgeModule({ ...BASE_SPEC_EDGE, dhwTankType: 'standard_vented' });
    expect(result.mixergyGasSavingPct).toBeUndefined();
    expect(result.mixergyFootprintReductionPct).toBeUndefined();
  });

  it('mixergy: Mixergy gas-saving metric present', () => {
    const result = runSpecEdgeModule({ ...BASE_SPEC_EDGE, dhwTankType: 'mixergy' });
    expect(result.mixergyGasSavingPct).toBeDefined();
    expect(result.mixergyFootprintReductionPct).toBeDefined();
  });
});

// ─── Stratification gating in RealWorldBehaviourModule ───────────────────────

describe('Stratification — RealWorldBehaviourModule gates on dhwTankType', () => {
  it('standard unvented: bath_filling does NOT reference stratification', () => {
    const input = { ...BASE_STORED, dhwTankType: 'standard' as const };
    const engineResult = runEngine(input);
    const cards = buildRealWorldBehavioursV1(engineResult, input);
    const card = cards.find(c => c.scenario_id === 'bath_filling');
    expect(card?.explanation?.toLowerCase()).not.toMatch(/stratification|mixergy/i);
  });

  it('standard_unvented: bath_filling does NOT reference stratification', () => {
    const input = { ...BASE_STORED, dhwTankType: 'standard_unvented' as const };
    const engineResult = runEngine(input);
    const cards = buildRealWorldBehavioursV1(engineResult, input);
    const card = cards.find(c => c.scenario_id === 'bath_filling');
    expect(card?.explanation?.toLowerCase()).not.toMatch(/stratification|mixergy/i);
  });

  it('standard_vented: bath_filling does NOT reference stratification', () => {
    const input = { ...BASE_STORED, dhwTankType: 'standard_vented' as const };
    const engineResult = runEngine(input);
    const cards = buildRealWorldBehavioursV1(engineResult, input);
    const card = cards.find(c => c.scenario_id === 'bath_filling');
    expect(card?.explanation?.toLowerCase()).not.toMatch(/stratification|mixergy/i);
  });

  it('mixergy: bath_filling references stratification', () => {
    const input = { ...BASE_STORED, dhwTankType: 'mixergy' as const };
    const engineResult = runEngine(input);
    const cards = buildRealWorldBehavioursV1(engineResult, input);
    const card = cards.find(c => c.scenario_id === 'bath_filling');
    expect(card?.explanation?.toLowerCase()).toMatch(/stratification|mixergy/i);
  });
});

// ─── Mixergy Availability — engine handles all cylinder types ─────────────────

describe('Mixergy Availability — engine accepts all DhwTankType values', () => {
  it('engine runs with dhwTankType=standard_unvented without error', () => {
    expect(() =>
      runEngine({ ...BASE_STORED, dhwTankType: 'standard_unvented' }),
    ).not.toThrow();
  });

  it('engine runs with dhwTankType=standard_vented without error', () => {
    expect(() =>
      runEngine({ ...BASE_STORED, dhwTankType: 'standard_vented' }),
    ).not.toThrow();
  });

  it('engine runs with dhwTankType=mixergy without error', () => {
    expect(() =>
      runEngine({ ...BASE_STORED, dhwTankType: 'mixergy' }),
    ).not.toThrow();
  });

  it('engine runs with legacy dhwTankType=standard without error (backward compat)', () => {
    expect(() =>
      runEngine({ ...BASE_STORED, dhwTankType: 'standard' }),
    ).not.toThrow();
  });
});

// ─── Mixergy availability: system boiler, regular, heat pump — all valid ─────

describe('Mixergy Availability — valid alongside stored-cylinder systems', () => {
  it('system boiler + Mixergy: engine recommends stored option', () => {
    const result = runEngine({
      ...BASE_STORED,
      dhwTankType: 'mixergy',
      currentHeatSourceType: 'system',
    });
    // Engine should produce a stored-system recommendation (not combi)
    const primary = result.engineOutput.recommendation.primary;
    expect(primary).not.toBe('combi');
  });

  it('regular boiler + Mixergy: engine recommends stored option', () => {
    const result = runEngine({
      ...BASE_STORED,
      dhwTankType: 'mixergy',
      currentHeatSourceType: 'regular',
    });
    const primary = result.engineOutput.recommendation.primary;
    expect(primary).not.toBe('combi');
  });
});

// ─── Mixergy not available for combi — UI gates this, engine warns ────────────

describe('Mixergy Availability — not for combi', () => {
  it('combi preference + Mixergy: engine still runs safely (UI prevents this)', () => {
    // The UI prevents selecting Mixergy for a combi system.
    // If the input somehow arrives, the engine must not throw.
    const combiWithMixergy: EngineInputV2_3 = {
      ...BASE_STORED,
      preferCombi: true,
      bathroomCount: 1,
      occupancyCount: 2,
      dhwTankType: 'mixergy',
    };
    expect(() => runEngine(combiWithMixergy)).not.toThrow();
  });
});

// ─── ComparisonSystemType — mixergy_open_vented ───────────────────────────────

import { computeSystemHourPhysics } from '../schema/ScenarioProfileV1';

describe('ComparisonSystemType — mixergy_open_vented physics', () => {
  it('mixergy_open_vented returns stored-boiler physics (same as stored_vented and mixergy)', () => {
    const mixeryOpenVented = computeSystemHourPhysics(
      'mixergy_open_vented', 5, 2, 12, 3.0, false, 60,
    );
    const storedVented = computeSystemHourPhysics(
      'stored_vented', 5, 2, 12, 3.0, false, 60,
    );
    expect(mixeryOpenVented).toEqual(storedVented);
  });

  it('mixergy_open_vented physics matches mixergy (mains-fed variant)', () => {
    const mixeryOpenVented = computeSystemHourPhysics(
      'mixergy_open_vented', 4, 3, 8, 3.0, false, 60,
    );
    const mixergy = computeSystemHourPhysics(
      'mixergy', 4, 3, 8, 3.0, false, 60,
    );
    expect(mixeryOpenVented).toEqual(mixergy);
  });
});
