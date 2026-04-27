/**
 * RecommendationVerdictV1.test.ts
 *
 * Regression tests for the single locked recommendation verdict.
 *
 * Invariants tested:
 *   1. A hard-rejected combi can never appear as recommendedFamily.
 *   2. An ASHP flagged for pipework can only appear in futurePath, not as
 *      recommendedFamily or in alternatives.
 *   3. Stored hot water wins for high-concurrency even if lifestyle says boiler.
 *   4. CustomerPresentationV1 contains exactly one verdictHeadline (the recommendation).
 */

import { describe, it, expect } from 'vitest';
import { runEngine } from '../Engine';
import { buildRecommendationVerdict, buildCustomerPresentation } from '../recommendation/buildRecommendationVerdict';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Shared base input ────────────────────────────────────────────────────────

const BASE_INPUT: EngineInputV2_3 = {
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

// ─── Regression 1: rejected combi can never be recommended ────────────────────

describe('Regression 1 — rejected combi cannot appear as recommended', () => {
  // Combi is rejected when: low mains pressure (<0.3 bar) OR 2+ bathrooms + high occupancy.
  it('combi is not recommendedFamily when mains pressure is below minimum (< 0.3 bar)', () => {
    const input: EngineInputV2_3 = {
      ...BASE_INPUT,
      dynamicMainsPressure: 0.2, // below 0.3 bar minimum — combi burner cannot fire
    };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);

    expect(verdict.recommendedFamily).not.toBe('combi');
  });

  it('combi appears in rejectedSystems when mains pressure is below minimum', () => {
    const input: EngineInputV2_3 = {
      ...BASE_INPUT,
      dynamicMainsPressure: 0.2,
    };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);

    const rejectedFamilies = verdict.rejectedSystems.map(r => r.family);
    expect(rejectedFamilies).toContain('combi');
  });

  it('combi is not recommendedFamily when 2+ bathrooms + high occupancy', () => {
    const input: EngineInputV2_3 = {
      ...BASE_INPUT,
      bathroomCount: 2,
      highOccupancy: true,
    };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);

    expect(verdict.recommendedFamily).not.toBe('combi');
    const rejectedFamilies = verdict.rejectedSystems.map(r => r.family);
    expect(rejectedFamilies).toContain('combi');
  });

  it('verdictHeadline does not mention combi when combi is rejected', () => {
    const input: EngineInputV2_3 = {
      ...BASE_INPUT,
      dynamicMainsPressure: 0.15,
    };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);
    const presentation = buildCustomerPresentation(verdict);

    expect(presentation.verdictHeadline?.toLowerCase()).not.toContain('combi');
  });
});

// ─── Regression 2: ASHP with pipework flag → conditional only ─────────────────

describe('Regression 2 — ASHP with pipework flag appears in futurePath only', () => {
  // flagAshp fires when: 22mm primary pipes + heat loss > 8 kW.
  // rejectAshp fires only for one-pipe topology.
  it('ASHP with 22mm pipes and high heat loss is flagged (not hard-rejected)', () => {
    const input: EngineInputV2_3 = {
      ...BASE_INPUT,
      primaryPipeDiameter: 22,
      heatLossWatts: 9000, // > 8000 W — triggers flagAshp
      pipingTopology: 'two_pipe', // two-pipe → flagged only, not rejected
    };
    const result = runEngine(input);

    expect(result.redFlags.flagAshp).toBe(true);
    expect(result.redFlags.rejectAshp).toBe(false);
  });

  it('flagged ASHP appears in futurePath, not as recommendedFamily', () => {
    const input: EngineInputV2_3 = {
      ...BASE_INPUT,
      primaryPipeDiameter: 22,
      heatLossWatts: 9000,
      pipingTopology: 'two_pipe',
    };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);

    // ASHP must not be the primary recommendation
    expect(verdict.recommendedFamily).not.toBe('heat_pump');

    // ASHP must appear in futurePath (conditional)
    const futurePathFamilies = verdict.futurePath.map(f => f.family);
    expect(futurePathFamilies).toContain('heat_pump');
  });

  it('flagged ASHP does not appear in alternatives', () => {
    const input: EngineInputV2_3 = {
      ...BASE_INPUT,
      primaryPipeDiameter: 22,
      heatLossWatts: 9000,
      pipingTopology: 'two_pipe',
    };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);

    const alternativeFamilies = verdict.alternatives.map(a => a.family);
    expect(alternativeFamilies).not.toContain('heat_pump');
  });

  it('presentation futurePath contains ASHP when it is flagged', () => {
    const input: EngineInputV2_3 = {
      ...BASE_INPUT,
      primaryPipeDiameter: 22,
      heatLossWatts: 9000,
      pipingTopology: 'two_pipe',
    };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);
    const presentation = buildCustomerPresentation(verdict);

    const futureLabels = presentation.futurePath.map(f => f.label.toLowerCase());
    expect(futureLabels.some(l => l.includes('heat pump') || l.includes('ashp'))).toBe(true);
  });
});

// ─── Regression 3: stored hot water wins for high concurrency ─────────────────

describe('Regression 3 — stored hot water wins for high-concurrency regardless of lifestyle', () => {
  // professional lifestyle → would naively prefer boiler (fast_reheat)
  // but 2 bathrooms + high occupancy must cause combi rejection → stored wins
  it('stored-water family wins for professional lifestyle with 2 bathrooms + high occupancy', () => {
    const input: EngineInputV2_3 = {
      ...BASE_INPUT,
      occupancySignature: 'professional', // lifestyle says fast_reheat / boiler preference
      bathroomCount: 2,
      highOccupancy: true,               // combi hard-rejected by RedFlagModule
    };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);

    // Combi must be rejected
    expect(verdict.rejectedSystems.some(r => r.family === 'combi')).toBe(true);

    // Recommended family must NOT be combi
    expect(verdict.recommendedFamily).not.toBe('combi');

    // Recommended family should be a stored-water variant
    const storedFamilies: string[] = ['system', 'regular', 'open_vented'];
    expect(
      verdict.recommendedFamily === null || storedFamilies.includes(verdict.recommendedFamily),
    ).toBe(true);
  });

  it('lifestyle fast_reheat signal is listed but does not override physics rejection', () => {
    const input: EngineInputV2_3 = {
      ...BASE_INPUT,
      occupancySignature: 'professional',
      bathroomCount: 2,
      highOccupancy: true,
    };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);

    // Lifestyle signal is still captured
    expect(verdict.lifestyleSignals).toContain('fast_reheat');

    // But the recommendation is not combi
    expect(verdict.recommendedFamily).not.toBe('combi');
  });
});

// ─── Regression 4: presentation has exactly one recommendation headline ────────

describe('Regression 4 — CustomerPresentationV1 has exactly one verdictHeadline', () => {
  it('verdictHeadline is a non-empty string for a standard professional input', () => {
    const result = runEngine(BASE_INPUT);
    const verdict = buildRecommendationVerdict(result, BASE_INPUT);
    const presentation = buildCustomerPresentation(verdict);

    expect(typeof presentation.verdictHeadline).toBe('string');
    expect(presentation.verdictHeadline!.length).toBeGreaterThan(0);
  });

  it('verdictHeadline is a single string (not an array)', () => {
    const result = runEngine(BASE_INPUT);
    const verdict = buildRecommendationVerdict(result, BASE_INPUT);
    const presentation = buildCustomerPresentation(verdict);

    expect(Array.isArray(presentation.verdictHeadline)).toBe(false);
  });

  it('buildCustomerPresentation produces all required fields', () => {
    const result = runEngine(BASE_INPUT);
    const verdict = buildRecommendationVerdict(result, BASE_INPUT);
    const presentation = buildCustomerPresentation(verdict);

    expect(presentation).toHaveProperty('verdictHeadline');
    expect(presentation).toHaveProperty('primaryReason');
    expect(presentation).toHaveProperty('whatThisAvoids');
    expect(presentation).toHaveProperty('whatNeedsChecking');
    expect(presentation).toHaveProperty('futurePath');
    expect(presentation).toHaveProperty('ruledOut');
    expect(presentation).toHaveProperty('alternatives');
    expect(presentation).toHaveProperty('lifestyleFitSignal');
  });

  it('verdictHeadline is "No suitable system identified" when all candidates rejected', () => {
    // Craft a scenario where combi is rejected (low pressure) and we pass a
    // verdict with null recommendedFamily to buildCustomerPresentation directly.
    const nullVerdict = {
      recommendedFamily: null,
      recommendedLabel: null,
      primaryReason: null,
      whatThisAvoids: [],
      checkItems: [],
      alternatives: [],
      rejectedSystems: [],
      futurePath: [],
      lifestyleSignals: [],
      confidence: 'low' as const,
    };
    const presentation = buildCustomerPresentation(nullVerdict);
    expect(presentation.verdictHeadline).toBe('No suitable system identified');
  });

  it('lifestyleFitSignal correctly maps fast_reheat', () => {
    const input: EngineInputV2_3 = { ...BASE_INPUT, occupancySignature: 'professional' };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);
    const presentation = buildCustomerPresentation(verdict);

    expect(presentation.lifestyleFitSignal).toBe('Fast reheat preference');
  });

  it('lifestyleFitSignal correctly maps steady_low_temp', () => {
    const input: EngineInputV2_3 = {
      ...BASE_INPUT,
      occupancySignature: 'steady_home',
      primaryPipeDiameter: 28,
    };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);
    const presentation = buildCustomerPresentation(verdict);

    expect(presentation.lifestyleFitSignal).toBe('Steady low-temperature preference');
  });

  it('lifestyleFitSignal correctly maps stored_resilience', () => {
    const input: EngineInputV2_3 = { ...BASE_INPUT, occupancySignature: 'shift_worker' };
    const result = runEngine(input);
    const verdict = buildRecommendationVerdict(result, input);
    const presentation = buildCustomerPresentation(verdict);

    expect(presentation.lifestyleFitSignal).toBe('Stored-water resilience preference');
  });
});

// ─── Regression 5: LifestyleSimulationModule emits lifestyleNeeds ─────────────

describe('Regression 5 — LifestyleSimulationModule emits lifestyleNeeds signals', () => {
  it('professional signature emits fast_reheat need', () => {
    const result = runEngine({ ...BASE_INPUT, occupancySignature: 'professional' });
    expect(result.lifestyle.lifestyleNeeds).toContain('fast_reheat');
  });

  it('steady_home signature emits steady_low_temp need', () => {
    const result = runEngine({ ...BASE_INPUT, occupancySignature: 'steady_home' });
    expect(result.lifestyle.lifestyleNeeds).toContain('steady_low_temp');
  });

  it('shift_worker signature emits stored_resilience need', () => {
    const result = runEngine({ ...BASE_INPUT, occupancySignature: 'shift_worker' });
    expect(result.lifestyle.lifestyleNeeds).toContain('stored_resilience');
  });

  it('lifestyleNeeds is always a non-empty array', () => {
    for (const sig of ['professional', 'steady_home', 'steady', 'shift_worker', 'shift'] as const) {
      const result = runEngine({ ...BASE_INPUT, occupancySignature: sig });
      expect(Array.isArray(result.lifestyle.lifestyleNeeds)).toBe(true);
      expect(result.lifestyle.lifestyleNeeds.length).toBeGreaterThan(0);
    }
  });
});

// ─── Regression 6: Engine exposes verdictV1 ──────────────────────────────────

describe('Regression 6 — runEngine exposes verdictV1', () => {
  it('verdictV1 is present on FullEngineResult', () => {
    const result = runEngine(BASE_INPUT);
    expect(result.verdictV1).toBeDefined();
  });

  it('verdictV1.recommendedFamily is a valid ApplianceFamily or null', () => {
    const result = runEngine(BASE_INPUT);
    const validFamilies = ['combi', 'system', 'heat_pump', 'regular', 'open_vented', null];
    expect(validFamilies).toContain(result.verdictV1.recommendedFamily);
  });

  it('verdictV1.confidence is high/medium/low', () => {
    const result = runEngine(BASE_INPUT);
    expect(['high', 'medium', 'low']).toContain(result.verdictV1.confidence);
  });
});
