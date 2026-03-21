/**
 * RealWorldBehaviourModule.test.ts
 *
 * Unit tests for buildRealWorldBehavioursV1.
 *
 * Validates:
 *   - Output shape: 5 scenario cards always returned
 *   - Correct scenario_ids present
 *   - Combi-specific scenario outcomes for strong vs weak mains
 *   - Stored-system scenario outcomes for adequate vs limited capacity
 *   - Mains scenarios correctly identify property-level limiting factor
 *   - Mixergy stratification benefits applied only to Mixergy cylinders
 *   - Standard unvented and vented cylinders do not receive Mixergy-specific benefits
 *   - Low-confidence outcomes when mains is unmeasured
 */

import { describe, it, expect } from 'vitest';
import { runEngine } from '../Engine';
import { buildRealWorldBehavioursV1 } from '../modules/RealWorldBehaviourModule';

// ─── Base fixtures ─────────────────────────────────────────────────────────────

/** Strong mains, 1 bathroom, combi-friendly setup. */
const BASE_COMBI_STRONG_MAINS = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  mainsDynamicFlowLpm: 25,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancyCount: 2,
  occupancySignature: 'professional' as const,
  highOccupancy: false,
  preferCombi: true,
  availableSpace: 'ok' as const,
  coldWaterSource: 'mains_true' as const,
};

/** Weak mains, 2 bathrooms — stored system territory. */
const BASE_STORED_WEAK_MAINS = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 1.2,
  mainsDynamicFlowLpm: 13,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 2,
  occupancyCount: 4,
  occupancySignature: 'professional' as const,
  highOccupancy: true,
  preferCombi: false,
  availableSpace: 'ok' as const,
  coldWaterSource: 'mains_true' as const,
};

/** Strong mains, 2 bathrooms, unvented stored. */
const BASE_STORED_UNVENTED_STRONG = {
  ...BASE_STORED_WEAK_MAINS,
  dynamicMainsPressure: 2.5,
  mainsDynamicFlowLpm: 22,
};

/** Mixergy cylinder input. */
const BASE_MIXERGY = {
  ...BASE_STORED_UNVENTED_STRONG,
  dhwTankType: 'mixergy' as const,
};

/** Standard unvented cylinder (not Mixergy). */
const BASE_STANDARD_UNVENTED = {
  ...BASE_STORED_UNVENTED_STRONG,
  dhwTankType: 'standard' as const,
};

/**
 * No flow measurement — pressure present but no L/min reading.
 * CwsSupplyModule.hasMeasurements = false when flow is absent.
 * We still provide a pressure value to avoid PressureModule crashes.
 */
const BASE_NO_MEASUREMENTS = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 1.5,
  // Intentionally omitting mainsDynamicFlowLpm → hasMeasurements = false
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancyCount: 2,
  occupancySignature: 'professional' as const,
  highOccupancy: false,
  preferCombi: true,
  availableSpace: 'ok' as const,
  coldWaterSource: 'mains_true' as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXPECTED_SCENARIO_IDS = [
  'shower_and_tap',
  'two_showers',
  'bath_filling',
  'peak_household',
  'cold_mains_concurrent',
] as const;

// ─── Shape tests ──────────────────────────────────────────────────────────────

describe('buildRealWorldBehavioursV1 — output shape', () => {
  it('returns exactly 5 scenario cards', () => {
    const result = runEngine(BASE_COMBI_STRONG_MAINS);
    const cards = buildRealWorldBehavioursV1(result, BASE_COMBI_STRONG_MAINS);
    expect(cards).toHaveLength(5);
  });

  it('returns all expected scenario_ids', () => {
    const result = runEngine(BASE_COMBI_STRONG_MAINS);
    const cards = buildRealWorldBehavioursV1(result, BASE_COMBI_STRONG_MAINS);
    const ids = cards.map(c => c.scenario_id);
    for (const expected of EXPECTED_SCENARIO_IDS) {
      expect(ids).toContain(expected);
    }
  });

  it('each card has required fields', () => {
    const result = runEngine(BASE_COMBI_STRONG_MAINS);
    const cards = buildRealWorldBehavioursV1(result, BASE_COMBI_STRONG_MAINS);
    for (const card of cards) {
      expect(typeof card.scenario_id).toBe('string');
      expect(card.scenario_id.length).toBeGreaterThan(0);
      expect(typeof card.title).toBe('string');
      expect(card.title.length).toBeGreaterThan(0);
      expect(typeof card.summary).toBe('string');
      expect(card.summary.length).toBeGreaterThan(0);
      expect(['strong', 'acceptable', 'limited', 'poor']).toContain(
        card.recommended_option_outcome,
      );
    }
  });

  it('confidence is always one of high/medium/low when present', () => {
    const result = runEngine(BASE_COMBI_STRONG_MAINS);
    const cards = buildRealWorldBehavioursV1(result, BASE_COMBI_STRONG_MAINS);
    for (const card of cards) {
      if (card.confidence !== undefined) {
        expect(['high', 'medium', 'low']).toContain(card.confidence);
      }
    }
  });

  it('limiting_factor is one of the valid values when present', () => {
    const result = runEngine(BASE_COMBI_STRONG_MAINS);
    const cards = buildRealWorldBehavioursV1(result, BASE_COMBI_STRONG_MAINS);
    const validFactors = ['mains', 'hot_water_generation', 'stored_volume', 'distribution', 'unknown'];
    for (const card of cards) {
      if (card.limiting_factor !== undefined) {
        expect(validFactors).toContain(card.limiting_factor);
      }
    }
  });
});

// ─── Combi — strong mains ─────────────────────────────────────────────────────

describe('buildRealWorldBehavioursV1 — combi, strong mains (25 L/min @ 2.5 bar)', () => {
  it('shower_and_tap: acceptable or better on strong mains combi', () => {
    const result = runEngine(BASE_COMBI_STRONG_MAINS);
    const cards = buildRealWorldBehavioursV1(result, BASE_COMBI_STRONG_MAINS);
    const card = cards.find(c => c.scenario_id === 'shower_and_tap')!;
    expect(['strong', 'acceptable']).toContain(card.recommended_option_outcome);
  });

  it('shower_and_tap: confidence is high when mains is measured', () => {
    const result = runEngine(BASE_COMBI_STRONG_MAINS);
    const cards = buildRealWorldBehavioursV1(result, BASE_COMBI_STRONG_MAINS);
    const card = cards.find(c => c.scenario_id === 'shower_and_tap')!;
    expect(card.confidence).toBe('high');
  });

  it('peak_household: limiting_factor is mains', () => {
    const result = runEngine(BASE_COMBI_STRONG_MAINS);
    const cards = buildRealWorldBehavioursV1(result, BASE_COMBI_STRONG_MAINS);
    const card = cards.find(c => c.scenario_id === 'peak_household')!;
    expect(card.limiting_factor).toBe('mains');
  });

  it('cold_mains_concurrent: limiting_factor is mains', () => {
    const result = runEngine(BASE_COMBI_STRONG_MAINS);
    const cards = buildRealWorldBehavioursV1(result, BASE_COMBI_STRONG_MAINS);
    const card = cards.find(c => c.scenario_id === 'cold_mains_concurrent')!;
    expect(card.limiting_factor).toBe('mains');
  });
});

// ─── Stored — weak mains, high demand ────────────────────────────────────────

describe('buildRealWorldBehavioursV1 — stored, weak mains (13 L/min @ 1.2 bar, 2 bathrooms)', () => {
  it('peak_household: outcome is limited or poor on weak mains', () => {
    const result = runEngine(BASE_STORED_WEAK_MAINS);
    const cards = buildRealWorldBehavioursV1(result, BASE_STORED_WEAK_MAINS);
    const card = cards.find(c => c.scenario_id === 'peak_household')!;
    expect(['limited', 'poor']).toContain(card.recommended_option_outcome);
  });

  it('peak_household: limiting_factor is mains', () => {
    const result = runEngine(BASE_STORED_WEAK_MAINS);
    const cards = buildRealWorldBehavioursV1(result, BASE_STORED_WEAK_MAINS);
    const card = cards.find(c => c.scenario_id === 'peak_household')!;
    expect(card.limiting_factor).toBe('mains');
  });

  it('cold_mains_concurrent: outcome is limited or poor on weak mains', () => {
    const result = runEngine(BASE_STORED_WEAK_MAINS);
    const cards = buildRealWorldBehavioursV1(result, BASE_STORED_WEAK_MAINS);
    const card = cards.find(c => c.scenario_id === 'cold_mains_concurrent')!;
    expect(['limited', 'poor']).toContain(card.recommended_option_outcome);
  });

  it('stored system performs better than combi on two_showers with adequate stored volume', () => {
    const resultStored = runEngine(BASE_STORED_UNVENTED_STRONG);
    const cardsStored = buildRealWorldBehavioursV1(resultStored, BASE_STORED_UNVENTED_STRONG);
    const storedCard = cardsStored.find(c => c.scenario_id === 'two_showers')!;

    const combiInput = { ...BASE_STORED_UNVENTED_STRONG, preferCombi: true };
    const resultCombi = runEngine(combiInput);
    const cardsCombi = buildRealWorldBehavioursV1(resultCombi, combiInput);
    const combiCard = cardsCombi.find(c => c.scenario_id === 'two_showers')!;

    const outcomeRank = { strong: 3, acceptable: 2, limited: 1, poor: 0 };
    // Stored should rank at least as well as combi for back-to-back showers on adequate supply.
    expect(outcomeRank[storedCard.recommended_option_outcome])
      .toBeGreaterThanOrEqual(outcomeRank[combiCard.recommended_option_outcome]);
  });
});

// ─── Mixergy vs standard unvented ─────────────────────────────────────────────

describe('buildRealWorldBehavioursV1 — Mixergy vs standard unvented stratification', () => {
  it('Mixergy-specific bath_filling explanation references stratification', () => {
    const result = runEngine(BASE_MIXERGY);
    const cards = buildRealWorldBehavioursV1(result, BASE_MIXERGY);
    const card = cards.find(c => c.scenario_id === 'bath_filling')!;
    expect(card.explanation?.toLowerCase()).toMatch(/stratification|mixergy/i);
  });

  it('standard unvented bath_filling explanation does NOT reference Mixergy stratification', () => {
    const result = runEngine(BASE_STANDARD_UNVENTED);
    const cards = buildRealWorldBehavioursV1(result, BASE_STANDARD_UNVENTED);
    const card = cards.find(c => c.scenario_id === 'bath_filling')!;
    // Standard unvented should not have Mixergy-specific language
    expect(card.explanation?.toLowerCase()).not.toMatch(/mixergy.*stratif|stratif.*mixergy/i);
  });

  it('Mixergy two_showers explanation references stratification', () => {
    const result = runEngine(BASE_MIXERGY);
    const cards = buildRealWorldBehavioursV1(result, BASE_MIXERGY);
    const card = cards.find(c => c.scenario_id === 'two_showers')!;
    expect(card.explanation?.toLowerCase()).toMatch(/stratification|mixergy/i);
  });

  it('standard unvented two_showers explanation does NOT apply Mixergy stratification language', () => {
    const result = runEngine(BASE_STANDARD_UNVENTED);
    const cards = buildRealWorldBehavioursV1(result, BASE_STANDARD_UNVENTED);
    const card = cards.find(c => c.scenario_id === 'two_showers')!;
    expect(card.explanation?.toLowerCase()).not.toMatch(/mixergy.*stratif|stratif.*mixergy/i);
  });

  it('Mixergy shower_and_tap explanation references stratification', () => {
    const result = runEngine(BASE_MIXERGY);
    const cards = buildRealWorldBehavioursV1(result, BASE_MIXERGY);
    const card = cards.find(c => c.scenario_id === 'shower_and_tap')!;
    expect(card.explanation?.toLowerCase()).toMatch(/stratification|mixergy/i);
  });
});

// ─── No mains measurements ────────────────────────────────────────────────────

describe('buildRealWorldBehavioursV1 — no mains measurements', () => {
  it('peak_household: confidence is low when mains not measured', () => {
    const result = runEngine(BASE_NO_MEASUREMENTS);
    const cards = buildRealWorldBehavioursV1(result, BASE_NO_MEASUREMENTS);
    const card = cards.find(c => c.scenario_id === 'peak_household')!;
    expect(card.confidence).toBe('low');
  });

  it('cold_mains_concurrent: confidence is low when mains not measured', () => {
    const result = runEngine(BASE_NO_MEASUREMENTS);
    const cards = buildRealWorldBehavioursV1(result, BASE_NO_MEASUREMENTS);
    const card = cards.find(c => c.scenario_id === 'cold_mains_concurrent')!;
    expect(card.confidence).toBe('low');
  });

  it('cold_mains_concurrent: explanation mentions that mains was not tested', () => {
    const result = runEngine(BASE_NO_MEASUREMENTS);
    const cards = buildRealWorldBehavioursV1(result, BASE_NO_MEASUREMENTS);
    const card = cards.find(c => c.scenario_id === 'cold_mains_concurrent')!;
    expect(card.explanation?.toLowerCase()).toMatch(/not measured|unmeasured/i);
  });

  it('shower_and_tap: confidence is low when mains not measured', () => {
    const result = runEngine(BASE_NO_MEASUREMENTS);
    const cards = buildRealWorldBehavioursV1(result, BASE_NO_MEASUREMENTS);
    const card = cards.find(c => c.scenario_id === 'shower_and_tap')!;
    expect(card.confidence).toBe('low');
  });
});

// ─── Integration: OutputBuilder includes realWorldBehaviours ──────────────────

describe('OutputBuilder integration', () => {
  it('EngineOutputV1 includes realWorldBehaviours when input is provided', () => {
    const result = runEngine(BASE_COMBI_STRONG_MAINS);
    expect(result.engineOutput.realWorldBehaviours).toBeDefined();
    expect(Array.isArray(result.engineOutput.realWorldBehaviours)).toBe(true);
    expect(result.engineOutput.realWorldBehaviours!.length).toBe(5);
  });

  it('all scenario_ids are present in engine output', () => {
    const result = runEngine(BASE_COMBI_STRONG_MAINS);
    const ids = result.engineOutput.realWorldBehaviours!.map(c => c.scenario_id);
    for (const expected of EXPECTED_SCENARIO_IDS) {
      expect(ids).toContain(expected);
    }
  });
});
