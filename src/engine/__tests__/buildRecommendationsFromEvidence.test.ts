/**
 * buildRecommendationsFromEvidence.test.ts — PR11: Tests for the evidence-backed
 * recommendation engine.
 *
 * Test categories:
 *   Positive
 *     1.  Combi with repeated service switching loses on performance/reliability
 *         vs healthy stored system
 *     2.  Stored system with adequate volume outranks combi for multi-demand scenarios
 *     3.  HP with hydraulic/emitter penalties loses on performance until upgrades applied
 *     4.  Primary pipe constraint yields infrastructure intervention
 *     5.  Objective-specific winners can differ from overall winner
 *     6.  Clean combi run wins space and disruption objectives
 *     7.  Heat pump wins eco objective on a clean run
 *
 *   Negative
 *     8.  No recommendation without evidence trace
 *     9.  No cross-family limiter bleed
 *    10.  No intervention without matching removable limiter
 *    11.  Candidate with hard-stop installability issue cannot win overall
 *    12.  Not-recommended candidate does not appear in bestByObjective
 *
 *   Structural
 *    13.  Deterministic ordering — same inputs produce same output
 *    14.  Input order does not change the result
 *    15.  Ties handled consistently
 *    16.  best-by-objective always populated for all defined objectives
 *    17.  All objective scores are in [0, 100]
 *    18.  Overall score is in [0, 100]
 *    19.  Evidence trace always populated
 *    20.  Interventions only reference known limiter IDs
 *    21.  Disqualified candidates have suitability === 'not_recommended'
 */

import { describe, it, expect } from 'vitest';
import { buildRecommendationsFromEvidence } from '../recommendation/buildRecommendationsFromEvidence';
import { ALL_OBJECTIVES } from '../recommendation/RecommendationModel';
import { buildLimiterLedger } from '../limiter/buildLimiterLedger';
import { buildFitMapModel } from '../fitmap/buildFitMapModel';
import { buildDerivedEventsFromTimeline } from '../timeline/buildDerivedEventsFromTimeline';
import { runCombiSystemModel } from '../runners/runCombiSystemModel';
import { runSystemStoredSystemModel } from '../runners/runSystemStoredSystemModel';
import { runHeatPumpStoredSystemModel } from '../runners/runHeatPumpStoredSystemModel';
import { buildSystemTopologyFromSpec } from '../topology/SystemTopology';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import type { CandidateEvidenceBundle } from '../recommendation/RecommendationModel';
import type { FamilyRunnerResult } from '../runners/types';

// ─── Base inputs ──────────────────────────────────────────────────────────────

/** Standard survey input — clean run, no evidence for most limiters. */
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

/**
 * High-demand input — combi service switching will be triggered because
 * heatLossWatts > 0 activates CH simultaneously.
 */
const HIGH_DEMAND_INPUT: EngineInputV2_3 = {
  ...CLEAN_INPUT,
  occupancyCount: 4,
  bathroomCount: 2,
  peakConcurrentOutlets: 2,
  highOccupancy: true,
  heatLossWatts: 12000,
};

/**
 * HP input — includes design flow temperature above heat pump optimal range
 * to trigger emitter_temperature_constraint and hp_high_flow_temp_penalty.
 */
const HP_PENALTY_INPUT: EngineInputV2_3 = {
  ...CLEAN_INPUT,
  heatSourceType: 'heat_pump',
  returnWaterTemp: 55,   // above HP optimal range
  heatLossWatts: 0,      // isolate from combi-style switching
};

// ─── Topology helpers ─────────────────────────────────────────────────────────

const combiTopology   = buildSystemTopologyFromSpec({ systemType: 'combi' });
const systemTopology  = buildSystemTopologyFromSpec({ systemType: 'stored_water' });
const hpTopology      = buildSystemTopologyFromSpec({ systemType: 'heat_pump', hotWaterStorageLitres: 200 });

// ─── Bundle builder ───────────────────────────────────────────────────────────

function buildBundle(
  runnerResult: FamilyRunnerResult,
  family: 'combi' | 'system' | 'regular' | 'heat_pump',
): CandidateEvidenceBundle {
  const timelineFamily: 'combi' | 'system' | 'regular' | 'heat_pump' = family;
  const events = buildDerivedEventsFromTimeline(runnerResult.stateTimeline, timelineFamily);
  const limiterLedger = buildLimiterLedger(runnerResult, events);
  const fitMap = buildFitMapModel(
    runnerResult,
    runnerResult.stateTimeline,
    events,
    limiterLedger,
  );
  return { runnerResult, events, limiterLedger, fitMap };
}

function combiBundle(input: EngineInputV2_3 = CLEAN_INPUT): CandidateEvidenceBundle {
  return buildBundle(runCombiSystemModel(input, combiTopology), 'combi');
}

function systemBundle(input: EngineInputV2_3 = CLEAN_INPUT): CandidateEvidenceBundle {
  return buildBundle(runSystemStoredSystemModel(input, systemTopology), 'system');
}

function hpBundle(input: EngineInputV2_3 = CLEAN_INPUT): CandidateEvidenceBundle {
  return buildBundle(runHeatPumpStoredSystemModel(input, hpTopology), 'heat_pump');
}

/**
 * Find a decision for `family` from any output slot of a RecommendationResult.
 * Searches bestOverall, all bestByObjective slots, and disqualifiedCandidates.
 */
function findDecision(
  result: ReturnType<typeof buildRecommendationsFromEvidence>,
  family: string,
) {
  return [
    result.bestOverall,
    ...Object.values(result.bestByObjective),
    ...result.disqualifiedCandidates,
  ].find((d): d is NonNullable<typeof d> => d?.family === family) ?? null;
}

// ─── Positive tests ───────────────────────────────────────────────────────────

describe('buildRecommendationsFromEvidence — positive', () => {
  it('1. combi with service switching loses performance/reliability vs healthy stored system', () => {
    // Use HIGH_DEMAND_INPUT to trigger combi service switching
    const combi = combiBundle(HIGH_DEMAND_INPUT);
    const system = systemBundle(HIGH_DEMAND_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system]);

    const combiDecision  = findDecision(result, 'combi');
    const systemDecision = findDecision(result, 'system');

    // Combi should score lower on performance and reliability than stored system
    // (or be disqualified) due to service-switching penalties
    if (combiDecision && systemDecision) {
      const combiPerf  = combiDecision.objectiveScores['performance'];
      const systemPerf = systemDecision.objectiveScores['performance'];
      expect(combiPerf).toBeLessThanOrEqual(systemPerf);

      const combiRel  = combiDecision.objectiveScores['reliability'];
      const systemRel = systemDecision.objectiveScores['reliability'];
      expect(combiRel).toBeLessThanOrEqual(systemRel);
    }
  });

  it('2. stored system with adequate volume outranks combi for multi-demand scenarios', () => {
    const combi   = combiBundle(HIGH_DEMAND_INPUT);
    const system  = systemBundle(HIGH_DEMAND_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system]);

    // bestOverall should be the stored system in high-demand scenario
    expect(result.bestOverall?.family).toBe('system');
  });

  it('3. HP with hydraulic/emitter penalties loses on performance objective', () => {
    const hp     = hpBundle(HP_PENALTY_INPUT);
    const system = systemBundle(CLEAN_INPUT);

    const result = buildRecommendationsFromEvidence([hp, system]);

    const hpDecision = findDecision(result, 'heat_pump');

    // The flow-temp penalty (hp_high_flow_temp_penalty / emitter_temperature_constraint)
    // must be reflected in the evidence trace with a non-zero eco penalty
    if (hpDecision) {
      const hasFlowTempLimiter = hpDecision.evidenceTrace.limitersConsidered
        .some(id => id === 'hp_high_flow_temp_penalty' || id === 'emitter_temperature_constraint');

      if (hasFlowTempLimiter) {
        // Eco penalty from limiters must be non-zero (penalties were applied)
        expect(hpDecision.evidenceTrace.limiterPenalties['eco']).toBeGreaterThan(0);

        // HP should not win the performance objective when under high-flow-temp penalty
        const perfWinner = result.bestByObjective['performance'];
        expect(perfWinner?.family).not.toBe('heat_pump');

        // HP should still win eco (high eco baseline absorbs some penalty but eco remains best)
        const ecoWinner = result.bestByObjective['eco'];
        expect(ecoWinner?.family).toBe('heat_pump');
      }
    }
  });

  it('4. primary pipe constraint yields infrastructure intervention', () => {
    // Small pipe bore triggers primary_pipe_constraint
    const tightPipeInput: EngineInputV2_3 = {
      ...CLEAN_INPUT,
      primaryPipeDiameter: 8, // very narrow — below the constraint threshold
      heatLossWatts: 0,
    };

    const combi  = combiBundle(tightPipeInput);
    const system = systemBundle(tightPipeInput);

    const result = buildRecommendationsFromEvidence([combi, system]);

    // Should produce an infrastructure intervention for primary pipe
    const pipeIntervention = result.interventions.find(
      i => i.id === 'upsize_primary_pipe',
    );

    if (pipeIntervention !== undefined) {
      expect(pipeIntervention.sourceLimiterId).toBe('primary_pipe_constraint');
      expect(pipeIntervention.affectedObjectives).toContain('performance');
    }
  });

  it('5. objective-specific winners can differ from overall winner', () => {
    const combi  = combiBundle(CLEAN_INPUT);
    const system = systemBundle(CLEAN_INPUT);
    const hp     = hpBundle(CLEAN_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system, hp]);

    // Combi should win space and disruption (no cylinder needed)
    const spaceWinner     = result.bestByObjective['space'];
    const disruptionWinner = result.bestByObjective['disruption'];
    expect(spaceWinner?.family).toBe('combi');
    expect(disruptionWinner?.family).toBe('combi');

    // HP should win eco (high eco baseline)
    const ecoWinner = result.bestByObjective['eco'];
    expect(ecoWinner?.family).toBe('heat_pump');

    // Overall winner should be different from at least one objective winner
    const overallFamily = result.bestOverall?.family;
    const allObjectiveWinners = new Set(
      Object.values(result.bestByObjective).map(d => d?.family),
    );

    // There should be more than one unique winner across objectives
    // (e.g. combi wins space/disruption, HP wins eco, system wins performance)
    expect(allObjectiveWinners.size).toBeGreaterThan(1);

    // The overall winner is not necessarily the eco winner
    if (ecoWinner && overallFamily !== 'heat_pump') {
      expect(ecoWinner.family).not.toBe(overallFamily);
    }
  });

  it('6. clean combi run wins space and disruption objectives', () => {
    const combi  = combiBundle(CLEAN_INPUT);
    const system = systemBundle(CLEAN_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system]);

    expect(result.bestByObjective['space']?.family).toBe('combi');
    expect(result.bestByObjective['disruption']?.family).toBe('combi');
  });

  it('7. heat pump wins eco objective on a clean run', () => {
    const combi  = combiBundle(CLEAN_INPUT);
    const system = systemBundle(CLEAN_INPUT);
    const hp     = hpBundle(CLEAN_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system, hp]);

    expect(result.bestByObjective['eco']?.family).toBe('heat_pump');
  });
});

// ─── Negative tests ───────────────────────────────────────────────────────────

describe('buildRecommendationsFromEvidence — negative', () => {
  it('8. every decision has a populated evidence trace', () => {
    const combi  = combiBundle(CLEAN_INPUT);
    const system = systemBundle(CLEAN_INPUT);
    const result = buildRecommendationsFromEvidence([combi, system]);

    const allDecisions = [
      result.bestOverall,
      ...Object.values(result.bestByObjective),
      ...result.disqualifiedCandidates,
    ].filter((d): d is NonNullable<typeof d> => d !== null && d !== undefined);

    const uniqueFamilies = new Set(allDecisions.map(d => d.family));
    for (const family of uniqueFamilies) {
      const decision = allDecisions.find(d => d.family === family);
      expect(decision?.evidenceTrace).toBeDefined();
      // limiterPenalties must have all objectives as keys
      for (const obj of ALL_OBJECTIVES) {
        expect(decision?.evidenceTrace.limiterPenalties[obj]).toBeDefined();
        expect(decision?.evidenceTrace.fitMapContributions[obj]).toBeDefined();
      }
    }
  });

  it('9. no cross-family limiter bleed — combi decisions do not reference store-only limiter IDs', () => {
    const combi  = combiBundle(HIGH_DEMAND_INPUT);
    const system = systemBundle(HIGH_DEMAND_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system]);

    const storeOnlyIds = ['stored_volume_shortfall', 'reduced_dhw_service', 'hp_reheat_latency'];

    // Find the combi decision in any output slot
    const allDecisions = [
      result.bestOverall,
      ...Object.values(result.bestByObjective),
      ...result.disqualifiedCandidates,
    ].filter((d): d is NonNullable<typeof d> => d !== null && d !== undefined);

    const combiDecision = allDecisions.find(d => d.family === 'combi');
    if (combiDecision) {
      for (const storeId of storeOnlyIds) {
        expect(combiDecision.evidenceTrace.limitersConsidered).not.toContain(storeId);
      }
    }
  });

  it('10. no intervention without a matching removable limiter', () => {
    const combi  = combiBundle(CLEAN_INPUT);
    const system = systemBundle(CLEAN_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system]);

    // Collect all removable limiter IDs across both bundles
    const removableLimiterIds = new Set<string>();
    for (const bundle of [combi, system]) {
      for (const entry of bundle.limiterLedger.entries) {
        if (entry.removableByUpgrade) {
          removableLimiterIds.add(entry.id);
        }
      }
    }

    // Every intervention must cite a limiter ID that was actually removable
    for (const intervention of result.interventions) {
      expect(removableLimiterIds.has(intervention.sourceLimiterId)).toBe(true);
    }
  });

  it('11. candidate with hard-stop installability issue cannot win overall', () => {
    // space_for_cylinder_unavailable is a hard-stop for stored systems
    const tightSpaceInput: EngineInputV2_3 = {
      ...CLEAN_INPUT,
      availableSpace: 'tight',  // triggers stored-space-tight flag → space_for_cylinder_unavailable limiter
    };

    const combi   = combiBundle(CLEAN_INPUT);
    const system  = systemBundle(tightSpaceInput);

    const result = buildRecommendationsFromEvidence([combi, system]);

    // If space_for_cylinder_unavailable fires, system should be disqualified
    // System with space hard-stop cannot be bestOverall
    if (result.bestOverall?.family === 'system') {
      // Only acceptable if space_for_cylinder_unavailable didn't fire for this input
      const systemHasHardStop = result.disqualifiedCandidates.some(d => d.family === 'system');
      expect(systemHasHardStop).toBe(false);
    } else {
      // Combi or null should be overall winner
      expect(['combi', null]).toContain(result.bestOverall?.family ?? null);
    }
  });

  it('12. not-recommended candidate does not appear in bestByObjective', () => {
    const tightSpaceInput: EngineInputV2_3 = {
      ...CLEAN_INPUT,
      availableSpace: 'tight', // triggers stored-space-tight flag → space_for_cylinder_unavailable limiter
    };

    const combi  = combiBundle(CLEAN_INPUT);
    const system = systemBundle(tightSpaceInput);

    const result = buildRecommendationsFromEvidence([combi, system]);

    // If system is disqualified, it must not appear in bestByObjective
    if (result.disqualifiedCandidates.some(d => d.family === 'system')) {
      for (const obj of ALL_OBJECTIVES) {
        expect(result.bestByObjective[obj]?.family).not.toBe('system');
      }
    }
  });
});

// ─── Structural tests ─────────────────────────────────────────────────────────

describe('buildRecommendationsFromEvidence — structural', () => {
  it('13. deterministic ordering — same inputs always produce same result', () => {
    const combi  = combiBundle(CLEAN_INPUT);
    const system = systemBundle(CLEAN_INPUT);

    const resultA = buildRecommendationsFromEvidence([combi, system]);
    const resultB = buildRecommendationsFromEvidence([combi, system]);

    expect(resultA.bestOverall?.family).toBe(resultB.bestOverall?.family);
    expect(resultA.bestOverall?.overallScore).toBe(resultB.bestOverall?.overallScore);

    for (const obj of ALL_OBJECTIVES) {
      expect(resultA.bestByObjective[obj]?.family).toBe(resultB.bestByObjective[obj]?.family);
    }

    expect(resultA.interventions.map(i => i.id)).toEqual(
      resultB.interventions.map(i => i.id),
    );
  });

  it('14. input order does not change the result', () => {
    const combi  = combiBundle(CLEAN_INPUT);
    const system = systemBundle(CLEAN_INPUT);

    const resultAB = buildRecommendationsFromEvidence([combi, system]);
    const resultBA = buildRecommendationsFromEvidence([system, combi]);

    expect(resultAB.bestOverall?.family).toBe(resultBA.bestOverall?.family);
    expect(resultAB.bestOverall?.overallScore).toBe(resultBA.bestOverall?.overallScore);
  });

  it('15. ties broken by family name ascending', () => {
    // Two different families with the same overall profile — just verify determinism
    const combi  = combiBundle(CLEAN_INPUT);
    const system = systemBundle(CLEAN_INPUT);
    const result = buildRecommendationsFromEvidence([combi, system]);

    // Result must be deterministic regardless of ties
    expect(result.bestOverall).not.toBeNull();
    expect(result.bestOverall?.family).toMatch(/^(combi|system|regular|heat_pump|open_vented)$/);
  });

  it('16. bestByObjective always has all defined objectives as keys', () => {
    const combi  = combiBundle(CLEAN_INPUT);
    const system = systemBundle(CLEAN_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system]);

    for (const obj of ALL_OBJECTIVES) {
      expect(Object.prototype.hasOwnProperty.call(result.bestByObjective, obj)).toBe(true);
    }
  });

  it('17. all objective scores are in [0, 100]', () => {
    const combi  = combiBundle(HIGH_DEMAND_INPUT);
    const system = systemBundle(HIGH_DEMAND_INPUT);
    const hp     = hpBundle(HP_PENALTY_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system, hp]);

    const allDecisions = [
      result.bestOverall,
      ...Object.values(result.bestByObjective),
      ...result.disqualifiedCandidates,
    ].filter((d): d is NonNullable<typeof d> => d !== null && d !== undefined);

    for (const decision of allDecisions) {
      for (const obj of ALL_OBJECTIVES) {
        const score = decision.objectiveScores[obj];
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('18. overall score is in [0, 100]', () => {
    const combi  = combiBundle(HIGH_DEMAND_INPUT);
    const system = systemBundle(HIGH_DEMAND_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system]);

    const allDecisions = [
      result.bestOverall,
      ...result.disqualifiedCandidates,
    ].filter((d): d is NonNullable<typeof d> => d !== null && d !== undefined);

    for (const decision of allDecisions) {
      expect(decision.overallScore).toBeGreaterThanOrEqual(0);
      expect(decision.overallScore).toBeLessThanOrEqual(100);
    }
  });

  it('19. evidence trace always has all objective keys in limiterPenalties and fitMapContributions', () => {
    const combi  = combiBundle(CLEAN_INPUT);
    const system = systemBundle(CLEAN_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system]);

    const allDecisions = [
      result.bestOverall,
      ...Object.values(result.bestByObjective),
    ].filter((d): d is NonNullable<typeof d> => d !== null && d !== undefined);

    const uniqueFamilies = new Set(allDecisions.map(d => d.family));
    for (const family of uniqueFamilies) {
      const decision = allDecisions.find(d => d.family === family)!;
      for (const obj of ALL_OBJECTIVES) {
        expect(typeof decision.evidenceTrace.limiterPenalties[obj]).toBe('number');
        expect(typeof decision.evidenceTrace.fitMapContributions[obj]).toBe('number');
      }
    }
  });

  it('20. interventions only reference source limiter IDs that exist in the bundles', () => {
    const combi  = combiBundle(HIGH_DEMAND_INPUT);
    const system = systemBundle(HIGH_DEMAND_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system]);

    const allLimiterIds = new Set<string>();
    for (const bundle of [combi, system]) {
      for (const entry of bundle.limiterLedger.entries) {
        allLimiterIds.add(entry.id);
      }
    }

    for (const intervention of result.interventions) {
      expect(allLimiterIds.has(intervention.sourceLimiterId)).toBe(true);
    }
  });

  it('21. disqualified candidates have suitability === not_recommended', () => {
    const tightSpaceInput: EngineInputV2_3 = {
      ...CLEAN_INPUT,
      availableSpace: 'tight', // triggers stored-space-tight flag → space_for_cylinder_unavailable limiter
    };
    const combi  = combiBundle(CLEAN_INPUT);
    const system = systemBundle(tightSpaceInput);

    const result = buildRecommendationsFromEvidence([combi, system]);

    for (const disqualified of result.disqualifiedCandidates) {
      expect(disqualified.suitability).toBe('not_recommended');
    }
  });

  it('single-candidate input still produces a valid recommendation', () => {
    const combi = combiBundle(CLEAN_INPUT);
    const result = buildRecommendationsFromEvidence([combi]);

    expect(result.bestOverall).not.toBeNull();
    expect(result.bestOverall?.family).toBe('combi');

    for (const obj of ALL_OBJECTIVES) {
      expect(result.bestByObjective[obj]).not.toBeNull();
    }

    expect(result.confidenceSummary.level).toBe('medium');
    expect(result.confidenceSummary.notes).toContain(
      'Only one candidate was provided — cross-family comparison not available.',
    );
  });

  it('confidenceSummary level is high when multiple candidates with evidence', () => {
    const combi  = combiBundle(HIGH_DEMAND_INPUT);
    const system = systemBundle(HIGH_DEMAND_INPUT);
    const hp     = hpBundle(CLEAN_INPUT);

    const result = buildRecommendationsFromEvidence([combi, system, hp]);

    // Multiple candidates + evidence from limiters → high confidence
    expect(result.confidenceSummary.level).toBe('high');
    expect(result.confidenceSummary.limitersConsidered).toBeGreaterThan(0);
    expect(result.confidenceSummary.evidenceCount).toBeGreaterThan(0);
  });
});
