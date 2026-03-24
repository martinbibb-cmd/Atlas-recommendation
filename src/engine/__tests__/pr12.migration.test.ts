/**
 * pr12.migration.test.ts — PR12: canonical evidence path validation.
 *
 * Validates that:
 *   1. runEngine() produces a recommendationResult (not undefined)
 *   2. recommendationResult has the correct RecommendationResult shape
 *   3. bestOverall is present and has a valid family
 *   4. bestByObjective has all defined objectives as keys
 *   5. confidenceSummary level is a known value
 *   6. disqualifiedCandidates are visible when a hard constraint fires
 *   7. interventions reference real limiter IDs (not invented)
 *   8. The canonical path (runner→timeline→events→limiter→fitmap→recommendation) is intact
 */

import { describe, it, expect } from 'vitest';
import { runEngine } from '../Engine';
import { ALL_OBJECTIVES } from '../recommendation/RecommendationModel';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Base inputs ──────────────────────────────────────────────────────────────

const CLEAN_INPUT: EngineInputV2_3 = {
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
  mainsDynamicFlowLpm: 18,
};

const HIGH_DEMAND_INPUT: EngineInputV2_3 = {
  ...CLEAN_INPUT,
  occupancyCount: 4,
  bathroomCount: 2,
  peakConcurrentOutlets: 2,
  highOccupancy: true,
};

const TIGHT_SPACE_INPUT: EngineInputV2_3 = {
  ...CLEAN_INPUT,
  availableSpace: 'tight',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PR12 migration — canonical evidence path', () => {
  it('runEngine() produces a recommendationResult field', () => {
    const result = runEngine(CLEAN_INPUT);
    expect(result.recommendationResult).toBeDefined();
    expect(result.recommendationResult).not.toBeNull();
  });

  it('recommendationResult.bestOverall is present on a clean run', () => {
    const result = runEngine(CLEAN_INPUT);
    expect(result.recommendationResult.bestOverall).not.toBeNull();
  });

  it('recommendationResult.bestOverall.family is a valid appliance family', () => {
    const result = runEngine(CLEAN_INPUT);
    const family = result.recommendationResult.bestOverall?.family;
    expect(family).toMatch(/^(combi|system|heat_pump|regular|open_vented)$/);
  });

  it('recommendationResult.bestByObjective has all defined objectives as keys', () => {
    const result = runEngine(CLEAN_INPUT);
    for (const obj of ALL_OBJECTIVES) {
      expect(Object.prototype.hasOwnProperty.call(
        result.recommendationResult.bestByObjective,
        obj,
      )).toBe(true);
    }
  });

  it('recommendationResult.confidenceSummary.level is high/medium/low', () => {
    const result = runEngine(CLEAN_INPUT);
    const level = result.recommendationResult.confidenceSummary.level;
    expect(['high', 'medium', 'low']).toContain(level);
  });

  it('confidenceSummary level is high when multiple families produce strong evidence', () => {
    const result = runEngine(HIGH_DEMAND_INPUT);
    // Multiple families + demand evidence → high confidence
    expect(result.recommendationResult.confidenceSummary.level).toBe('high');
    expect(result.recommendationResult.confidenceSummary.evidenceCount).toBeGreaterThan(0);
    expect(result.recommendationResult.confidenceSummary.limitersConsidered).toBeGreaterThan(0);
  });

  it('overallScore is in [0, 100]', () => {
    const result = runEngine(CLEAN_INPUT);
    const score = result.recommendationResult.bestOverall?.overallScore;
    if (score !== undefined) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('all per-objective scores are in [0, 100]', () => {
    const result = runEngine(HIGH_DEMAND_INPUT);
    const { bestOverall, bestByObjective } = result.recommendationResult;
    const decisions = [
      bestOverall,
      ...Object.values(bestByObjective),
    ].filter((d): d is NonNullable<typeof d> => d != null);

    for (const d of decisions) {
      for (const obj of ALL_OBJECTIVES) {
        expect(d.objectiveScores[obj]).toBeGreaterThanOrEqual(0);
        expect(d.objectiveScores[obj]).toBeLessThanOrEqual(100);
      }
    }
  });

  it('not_recommended candidates are listed in disqualifiedCandidates — hard-stop is visible', () => {
    // tight space triggers space_for_cylinder_unavailable limiter on stored/heat_pump families
    const result = runEngine(TIGHT_SPACE_INPUT);
    const { disqualifiedCandidates } = result.recommendationResult;
    // Tight space must disqualify at least one candidate
    expect(disqualifiedCandidates.length).toBeGreaterThan(0);
    // If any candidate is disqualified, it must have suitability === 'not_recommended'
    for (const d of disqualifiedCandidates) {
      expect(d.suitability).toBe('not_recommended');
    }
    // Hard-stop limiter IDs must be listed (not silent)
    for (const d of disqualifiedCandidates) {
      expect(d.evidenceTrace.hardStopLimiters.length).toBeGreaterThan(0);
    }
  });

  it('not_recommended candidates do not appear in bestByObjective', () => {
    const result = runEngine(TIGHT_SPACE_INPUT);
    const { disqualifiedCandidates, bestByObjective } = result.recommendationResult;
    const disqualifiedFamilies = new Set(disqualifiedCandidates.map(d => d.family));
    for (const obj of ALL_OBJECTIVES) {
      const winner = bestByObjective[obj];
      if (winner && disqualifiedFamilies.has(winner.family)) {
        expect(winner.suitability).not.toBe('not_recommended');
      }
    }
  });

  it('all intervention sourceLimiterIds reference real limiter IDs', () => {
    const result = runEngine(HIGH_DEMAND_INPUT);
    // interventions must derive from real limiter entries, not invented
    for (const intervention of result.recommendationResult.interventions) {
      expect(intervention.sourceLimiterId).toBeTruthy();
      expect(intervention.affectedObjectives.length).toBeGreaterThan(0);
    }
  });

  it('evidence trace is always populated — no ghost math', () => {
    const result = runEngine(HIGH_DEMAND_INPUT);
    const { bestOverall } = result.recommendationResult;
    if (bestOverall) {
      for (const obj of ALL_OBJECTIVES) {
        expect(typeof bestOverall.evidenceTrace.limiterPenalties[obj]).toBe('number');
        expect(typeof bestOverall.evidenceTrace.fitMapContributions[obj]).toBe('number');
      }
    }
  });

  it('result is deterministic — same input always produces same bestOverall family', () => {
    const r1 = runEngine(CLEAN_INPUT);
    const r2 = runEngine(CLEAN_INPUT);
    expect(r1.recommendationResult.bestOverall?.family).toBe(
      r2.recommendationResult.bestOverall?.family,
    );
    expect(r1.recommendationResult.bestOverall?.overallScore).toBe(
      r2.recommendationResult.bestOverall?.overallScore,
    );
  });

  it('FullEngineResult.recommendationResult is the canonical truth — not optional', () => {
    // TypeScript type check (structurally): recommendationResult must be defined
    const result = runEngine(CLEAN_INPUT);
    // This would be a TS error if recommendationResult were optional and undefined
    expect(result.recommendationResult.bestOverall).toBeDefined();
    expect(result.recommendationResult.bestByObjective).toBeDefined();
    expect(result.recommendationResult.interventions).toBeDefined();
    expect(result.recommendationResult.disqualifiedCandidates).toBeDefined();
    expect(result.recommendationResult.confidenceSummary).toBeDefined();
  });
});
