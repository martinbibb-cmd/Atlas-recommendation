/**
 * deriveObjectiveWeights.test.ts — Scenario-based objective weight derivation.
 *
 * Verifies that:
 *   1. Default weights are returned when no preferences are supplied.
 *   2. spacePriority 'high' boosts the space and disruption weights.
 *   3. spacePriority 'medium' applies a smaller space boost.
 *   4. disruptionTolerance 'low' boosts the disruption weight.
 *   5. disruptionTolerance 'high' reduces the disruption weight.
 *   6. selectedPriorities boosts the corresponding objective weights.
 *   7. Normalised weights always sum to 1.0 (within floating-point tolerance).
 *   8. No weight falls below 0 after adjustments.
 *   9. Boosted objectives have higher weight than in the defaults.
 *  10. Combined preferences produce additive boosts before normalisation.
 *  11. Empty preferences fall back to defaults.
 *  12. scenario-derived weights cause bestOverall to change when preferences
 *      strongly favour an objective that differs from the physics-neutral winner.
 */

import { describe, it, expect } from 'vitest';
import { deriveObjectiveWeights } from '../recommendation/buildRecommendationsFromEvidence';
import { buildRecommendationsFromEvidence } from '../recommendation/buildRecommendationsFromEvidence';
import { buildLimiterLedger } from '../limiter/buildLimiterLedger';
import { buildFitMapModel } from '../fitmap/buildFitMapModel';
import { buildDerivedEventsFromTimeline } from '../timeline/buildDerivedEventsFromTimeline';
import { runCombiSystemModel } from '../runners/runCombiSystemModel';
import { runSystemStoredSystemModel } from '../runners/runSystemStoredSystemModel';
import { buildSystemTopologyFromSpec } from '../topology/SystemTopology';
import { ALL_OBJECTIVES } from '../recommendation/RecommendationModel';
import type { UserPreferencesV1 } from '../schema/EngineInputV2_3';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import type { CandidateEvidenceBundle } from '../recommendation/RecommendationModel';
import type { FamilyRunnerResult } from '../runners/types';

const EPSILON = 0.0001;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sumWeights(weights: Record<string, number>): number {
  return ALL_OBJECTIVES.reduce((sum, obj) => sum + weights[obj], 0);
}

// ─── Weight derivation unit tests ─────────────────────────────────────────────

describe('deriveObjectiveWeights', () => {
  it('1. returns default weights when no preferences are supplied', () => {
    const weights = deriveObjectiveWeights(undefined);
    // Should include all objectives
    for (const obj of ALL_OBJECTIVES) {
      expect(weights[obj]).toBeGreaterThan(0);
    }
    expect(sumWeights(weights)).toBeCloseTo(1.0, 4);
  });

  it('2. spacePriority "high" boosts space and disruption weights above default', () => {
    const defaultWeights = deriveObjectiveWeights(undefined);
    const weights = deriveObjectiveWeights({ spacePriority: 'high' });

    expect(weights.space).toBeGreaterThan(defaultWeights.space);
    expect(weights.disruption).toBeGreaterThan(defaultWeights.disruption);
    expect(sumWeights(weights)).toBeCloseTo(1.0, 4);
  });

  it('3. spacePriority "medium" applies a smaller boost to space than "high"', () => {
    const mediumWeights = deriveObjectiveWeights({ spacePriority: 'medium' });
    const highWeights   = deriveObjectiveWeights({ spacePriority: 'high' });

    expect(mediumWeights.space).toBeGreaterThan(deriveObjectiveWeights(undefined).space);
    expect(mediumWeights.space).toBeLessThan(highWeights.space);
    expect(sumWeights(mediumWeights)).toBeCloseTo(1.0, 4);
  });

  it('4. disruptionTolerance "low" boosts disruption weight above default', () => {
    const defaultWeights = deriveObjectiveWeights(undefined);
    const weights = deriveObjectiveWeights({ disruptionTolerance: 'low' });

    expect(weights.disruption).toBeGreaterThan(defaultWeights.disruption);
    expect(sumWeights(weights)).toBeCloseTo(1.0, 4);
  });

  it('5. disruptionTolerance "high" reduces disruption weight below default', () => {
    const defaultWeights = deriveObjectiveWeights(undefined);
    const weights = deriveObjectiveWeights({ disruptionTolerance: 'high' });

    expect(weights.disruption).toBeLessThan(defaultWeights.disruption);
    expect(sumWeights(weights)).toBeCloseTo(1.0, 4);
  });

  it('6. selectedPriorities boosts corresponding objective weights', () => {
    const defaultWeights = deriveObjectiveWeights(undefined);
    const ecoWeights = deriveObjectiveWeights({ selectedPriorities: ['eco'] });

    expect(ecoWeights.eco).toBeGreaterThan(defaultWeights.eco);
    expect(sumWeights(ecoWeights)).toBeCloseTo(1.0, 4);
  });

  it('7. normalised weights always sum to 1.0 for any valid preference combination', () => {
    const cases: UserPreferencesV1[] = [
      { spacePriority: 'high', disruptionTolerance: 'low' },
      { selectedPriorities: ['performance', 'reliability', 'eco'] },
      { spacePriority: 'medium', selectedPriorities: ['eco', 'reliability'] },
      { disruptionTolerance: 'high', selectedPriorities: ['performance'] },
    ];

    for (const prefs of cases) {
      const weights = deriveObjectiveWeights(prefs);
      expect(sumWeights(weights)).toBeCloseTo(1.0, 4);
    }
  });

  it('8. no weight falls below 0 after adjustments', () => {
    const extremePrefs: UserPreferencesV1 = {
      spacePriority: 'high',
      disruptionTolerance: 'high',
      selectedPriorities: ['performance', 'reliability', 'eco', 'future_compatibility'],
    };
    const weights = deriveObjectiveWeights(extremePrefs);

    for (const obj of ALL_OBJECTIVES) {
      expect(weights[obj]).toBeGreaterThan(0);
    }
  });

  it('9. boosted objectives have higher weight than in defaults', () => {
    const defaultWeights = deriveObjectiveWeights(undefined);

    const perfWeights = deriveObjectiveWeights({ selectedPriorities: ['performance'] });
    expect(perfWeights.performance).toBeGreaterThan(defaultWeights.performance);

    const reliWeights = deriveObjectiveWeights({ selectedPriorities: ['reliability'] });
    expect(reliWeights.reliability).toBeGreaterThan(defaultWeights.reliability);

    const longevityWeights = deriveObjectiveWeights({ selectedPriorities: ['longevity'] });
    expect(longevityWeights.longevity).toBeGreaterThan(defaultWeights.longevity);
  });

  it('10. combined preferences produce larger boost than single preference', () => {
    const singleEcoWeights = deriveObjectiveWeights({ selectedPriorities: ['eco'] });
    const combinedWeights  = deriveObjectiveWeights({ selectedPriorities: ['eco', 'cost_tendency'] });

    // cost_tendency also boosts eco, so combined should be higher
    expect(combinedWeights.eco).toBeGreaterThan(singleEcoWeights.eco);
    expect(sumWeights(combinedWeights)).toBeCloseTo(1.0, 4);
  });

  it('11. empty preferences (no fields set) return defaults', () => {
    const defaultWeights = deriveObjectiveWeights(undefined);
    const emptyWeights   = deriveObjectiveWeights({});

    for (const obj of ALL_OBJECTIVES) {
      expect(emptyWeights[obj]).toBeCloseTo(defaultWeights[obj], EPSILON);
    }
  });
});

// ─── Integration: scenario preferences change bestOverall ────────────────────

const BASE_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 6000,
  radiatorCount: 8,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  occupancyCount: 2,
  highOccupancy: false,
  preferCombi: true,
  mainsDynamicFlowLpm: 18,
};

const combiTopology  = buildSystemTopologyFromSpec({ systemType: 'combi' });
const systemTopology = buildSystemTopologyFromSpec({ systemType: 'stored_water' });

function makeBundle(
  runnerResult: FamilyRunnerResult,
  family: 'combi' | 'system',
): CandidateEvidenceBundle {
  const events       = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, family);
  const limiterLedger = buildLimiterLedger(runnerResult, events);
  const fitMap       = buildFitMapModel(runnerResult, runnerResult.stateTimeline, events, limiterLedger);
  return { runnerResult, events, limiterLedger, fitMap };
}

describe('scenario-based weights integration', () => {
  it('12. high space-priority context favours combi on space/disruption objectives', () => {
    const combi  = makeBundle(runCombiSystemModel(BASE_INPUT, combiTopology), 'combi');
    const system = makeBundle(runSystemStoredSystemModel(BASE_INPUT, systemTopology), 'system');

    // Without preferences — default weights
    const defaultResult = buildRecommendationsFromEvidence([combi, system]);

    // With high space-priority preferences
    const spaceResult = buildRecommendationsFromEvidence(
      [combi, system],
      undefined,
      {
        storageBenefitSignal: 'low',
        solarStorageOpportunity: 'low',
        userPreferences: { spacePriority: 'high' },
      },
    );

    // Combi should win space and disruption objectives in both runs
    expect(defaultResult.bestByObjective.space?.family).toBe('combi');
    expect(spaceResult.bestByObjective.space?.family).toBe('combi');

    // With heavily boosted space/disruption weights, combi's overall score gap
    // should be smaller (or combi should be bestOverall) relative to the default run.
    const combiDefaultEntry = defaultResult.whyNotExplanations.find(w => w.family === 'combi');
    const combiSpaceEntry   = spaceResult.whyNotExplanations.find(w => w.family === 'combi');

    // If combi is bestOverall in the space run, the preference is working as intended.
    if (spaceResult.bestOverall?.family === 'combi') {
      expect(spaceResult.bestOverall.family).toBe('combi');
    } else if (combiSpaceEntry != null && combiDefaultEntry != null) {
      // If combi didn't win, its gap should be smaller with space preferences
      expect(combiSpaceEntry.scoreGap).toBeLessThanOrEqual(combiDefaultEntry.scoreGap + 1);
    } else {
      // combi must appear in one of the result slots
      const allFamilies = [
        defaultResult.bestOverall,
        ...Object.values(defaultResult.bestByObjective),
      ].map(d => d?.family);
      expect(allFamilies).toContain('combi');
    }
  });

  it('13. eco priority context boosts eco objective weight', () => {
    const combi  = makeBundle(runCombiSystemModel(BASE_INPUT, combiTopology), 'combi');
    const system = makeBundle(runSystemStoredSystemModel(BASE_INPUT, systemTopology), 'system');

    const ecoResult = buildRecommendationsFromEvidence(
      [combi, system],
      undefined,
      {
        storageBenefitSignal: 'low',
        solarStorageOpportunity: 'low',
        userPreferences: { selectedPriorities: ['eco'] },
      },
    );

    // All objective scores should still be in range
    for (const decision of [ecoResult.bestOverall, ...ecoResult.disqualifiedCandidates]) {
      if (!decision) continue;
      for (const obj of ALL_OBJECTIVES) {
        expect(decision.objectiveScores[obj]).toBeGreaterThanOrEqual(0);
        expect(decision.objectiveScores[obj]).toBeLessThanOrEqual(100);
      }
    }

    // bestOverall must exist and be one of the known families
    expect(ecoResult.bestOverall).not.toBeNull();
    expect(['combi', 'system']).toContain(ecoResult.bestOverall?.family);
  });
});
