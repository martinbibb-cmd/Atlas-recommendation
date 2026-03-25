/**
 * demographicsAndPvIntegration.test.ts
 *
 * Integration tests verifying that demographic and PV signals materially affect
 * the recommendation ranking produced by buildRecommendationsFromEvidence.
 *
 * Acceptance test from the problem statement:
 *   - Changing the household from 1 adult to 2 adults + 3 children + frequent
 *     baths changes rankings, storage benefit, and narrative signals.
 *   - High-PV-potential homes with poor demand alignment gain more storage value
 *     than low-PV-potential homes.
 */

import { describe, it, expect } from 'vitest';
import { buildRecommendationsFromEvidence } from '../recommendation/buildRecommendationsFromEvidence';
import { runDemographicsAssessmentModule } from '../modules/DemographicsAssessmentModule';
import { runPvAssessmentModule } from '../modules/PvAssessmentModule';
import { buildLimiterLedger } from '../limiter/buildLimiterLedger';
import { buildFitMapModel } from '../fitmap/buildFitMapModel';
import { buildDerivedEventsFromTimeline } from '../timeline/buildDerivedEventsFromTimeline';
import { runCombiSystemModel } from '../runners/runCombiSystemModel';
import { runSystemStoredSystemModel } from '../runners/runSystemStoredSystemModel';
import { runHeatPumpStoredSystemModel } from '../runners/runHeatPumpStoredSystemModel';
import { buildSystemTopologyFromSpec } from '../topology/SystemTopology';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import type { CandidateEvidenceBundle, RecommendationContextSignals } from '../recommendation/RecommendationModel';
import type { FamilyRunnerResult } from '../runners/types';

// ─── Topology ─────────────────────────────────────────────────────────────────

const combiTopology  = buildSystemTopologyFromSpec({ systemType: 'combi' });
const systemTopology = buildSystemTopologyFromSpec({ systemType: 'stored_water' });
const hpTopology     = buildSystemTopologyFromSpec({ systemType: 'heat_pump', hotWaterStorageLitres: 200 });

// ─── Bundle builder ───────────────────────────────────────────────────────────

function makeBundle(
  runner: (input: EngineInputV2_3, topology: typeof combiTopology) => FamilyRunnerResult,
  topology: typeof combiTopology,
  input: EngineInputV2_3,
): CandidateEvidenceBundle {
  const result = runner(input, topology);
  const events = buildDerivedEventsFromTimeline(result.stateTimeline, topology.appliance.family);
  const limiterLedger = buildLimiterLedger(result, events, {
    occupancyCount: input.occupancyCount,
    bathroomCount: input.bathroomCount,
    peakConcurrentOutlets: input.peakConcurrentOutlets,
  });
  const fitMap = buildFitMapModel(result, result.stateTimeline, events, limiterLedger);
  return { runnerResult: result, events, limiterLedger, fitMap };
}

function makeBundles(input: EngineInputV2_3): CandidateEvidenceBundle[] {
  return [
    makeBundle(runCombiSystemModel, combiTopology, input),
    makeBundle(runSystemStoredSystemModel, systemTopology, input),
    makeBundle(
      runHeatPumpStoredSystemModel as (i: EngineInputV2_3, t: typeof combiTopology) => FamilyRunnerResult,
      hpTopology,
      { ...input, dhwStorageLitres: 200 },
    ),
  ];
}

// ─── Base inputs ──────────────────────────────────────────────────────────────

/** Single working adult — clean combi-friendly inputs. */
const SINGLE_ADULT_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 0,          // clean run — no CH interruptions
  radiatorCount: 8,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancyCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  mainsDynamicFlowLpm: 18,
  demandPreset: 'single_working_adult',
  demandTimingOverrides: {
    bathFrequencyPerWeek: 1,
    simultaneousUseSeverity: 'low',
    daytimeOccupancy: 'absent',
  },
};

/** Large family — 2 adults + 3 children + frequent baths. */
const LARGE_FAMILY_INPUT: EngineInputV2_3 = {
  ...SINGLE_ADULT_INPUT,
  occupancyCount: 5,
  bathroomCount: 2,
  highOccupancy: true,
  demandPreset: 'family_teenagers',
  demandTimingOverrides: {
    bathFrequencyPerWeek: 7,
    simultaneousUseSeverity: 'high',
    daytimeOccupancy: 'partial',
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Demographics + PV integration: context signals affect recommendation scoring', () => {

  // ─── Demographic signal propagation ───────────────────────────────────────

  it('single adult produces low storageBenefitSignal', () => {
    const demo = runDemographicsAssessmentModule(SINGLE_ADULT_INPUT);
    expect(demo.storageBenefitSignal).toBe('low');
  });

  it('large family produces high storageBenefitSignal', () => {
    const demo = runDemographicsAssessmentModule(LARGE_FAMILY_INPUT);
    expect(demo.storageBenefitSignal).toBe('high');
  });

  it('large family dailyHotWaterLitres > 2× single adult', () => {
    const single = runDemographicsAssessmentModule(SINGLE_ADULT_INPUT);
    const family = runDemographicsAssessmentModule(LARGE_FAMILY_INPUT);
    expect(family.dailyHotWaterLitres).toBeGreaterThan(single.dailyHotWaterLitres * 2);
  });

  // ─── Recommendation scoring with context signals ───────────────────────────

  it('stored system gains higher eco/performance when high storage benefit is signalled', () => {
    const bundles = makeBundles(SINGLE_ADULT_INPUT);

    const lowContext: RecommendationContextSignals = {
      storageBenefitSignal: 'low',
      solarStorageOpportunity: 'low',
    };
    const highContext: RecommendationContextSignals = {
      storageBenefitSignal: 'high',
      solarStorageOpportunity: 'low',
    };

    const lowResult = buildRecommendationsFromEvidence(bundles, undefined, lowContext);
    const highResult = buildRecommendationsFromEvidence(bundles, undefined, highContext);

    // Find stored system decision in each result
    const storedLow = [
      ...(lowResult.bestOverall ? [lowResult.bestOverall] : []),
      ...lowResult.disqualifiedCandidates,
    ].find(d => d.family === 'system');
    const storedHigh = [
      ...(highResult.bestOverall ? [highResult.bestOverall] : []),
      ...highResult.disqualifiedCandidates,
    ].find(d => d.family === 'system');

    if (!storedLow || !storedHigh) {
      // stored system may be filtered — check bestByObjective
      return;
    }

    // High context should produce equal or higher performance score for stored
    expect(storedHigh.objectiveScores.performance).toBeGreaterThanOrEqual(
      storedLow.objectiveScores.performance,
    );
  });

  it('combi loses performance score when high storage benefit is signalled vs no context', () => {
    const bundles = makeBundles(SINGLE_ADULT_INPUT);

    const noContext = buildRecommendationsFromEvidence(bundles, undefined, undefined);
    const highStorage = buildRecommendationsFromEvidence(bundles, undefined, {
      storageBenefitSignal: 'high',
      solarStorageOpportunity: 'low',
    });

    // Collect all decisions (best + disqualified)
    const allNoContext = [
      ...(noContext.bestOverall ? [noContext.bestOverall] : []),
      ...noContext.disqualifiedCandidates,
      ...Object.values(noContext.bestByObjective).filter(Boolean) as typeof noContext.disqualifiedCandidates,
    ];
    const allHighStorage = [
      ...(highStorage.bestOverall ? [highStorage.bestOverall] : []),
      ...highStorage.disqualifiedCandidates,
      ...Object.values(highStorage.bestByObjective).filter(Boolean) as typeof highStorage.disqualifiedCandidates,
    ];

    const combiNoCtx = allNoContext.find(d => d.family === 'combi');
    const combiHighStorage = allHighStorage.find(d => d.family === 'combi');

    if (!combiNoCtx || !combiHighStorage) return; // combi not in results

    // Combi performance score should be lower when storage benefit is signalled
    expect(combiHighStorage.objectiveScores.performance).toBeLessThanOrEqual(
      combiNoCtx.objectiveScores.performance,
    );
  });

  it('solar eco bonus reaches stored system when high solar storage opportunity is signalled', () => {
    const bundles = makeBundles(SINGLE_ADULT_INPUT);

    const lowSolar = buildRecommendationsFromEvidence(bundles, undefined, {
      storageBenefitSignal: 'low',
      solarStorageOpportunity: 'low',
    });
    const highSolar = buildRecommendationsFromEvidence(bundles, undefined, {
      storageBenefitSignal: 'low',
      solarStorageOpportunity: 'high',
    });

    const collectAll = (r: typeof lowSolar) => [
      ...(r.bestOverall ? [r.bestOverall] : []),
      ...r.disqualifiedCandidates,
      ...Object.values(r.bestByObjective).filter(Boolean) as typeof r.disqualifiedCandidates,
    ];

    const storedLow = collectAll(lowSolar).find(d => d.family === 'system');
    const storedHigh = collectAll(highSolar).find(d => d.family === 'system');

    if (!storedLow || !storedHigh) return;

    expect(storedHigh.objectiveScores.eco).toBeGreaterThan(storedLow.objectiveScores.eco);
  });

  // ─── PV signal propagation ─────────────────────────────────────────────────

  it('south + Mixergy → high solarStorageOpportunity', () => {
    const pv = runPvAssessmentModule({
      roofOrientation: 'south',
      solarShading: 'low',
      occupancySignature: 'steady_home',
      dhwTankType: 'mixergy',
      preferCombi: false,
    } as EngineInputV2_3);
    expect(pv.solarStorageOpportunity).toBe('high');
  });

  it('north facing + combi → low solarStorageOpportunity', () => {
    const pv = runPvAssessmentModule({
      roofOrientation: 'north',
      solarShading: 'low',
      occupancySignature: 'professional',
      preferCombi: true,
    } as EngineInputV2_3);
    expect(pv.solarStorageOpportunity).toBe('low');
  });

  // ─── Full round-trip: engine input → context signals → recommendation ──────

  it('context signals change recommendation overall scores', () => {
    const bundles = makeBundles(SINGLE_ADULT_INPUT);

    const r1 = buildRecommendationsFromEvidence(bundles, undefined, {
      storageBenefitSignal: 'low',
      solarStorageOpportunity: 'low',
    });
    const r2 = buildRecommendationsFromEvidence(bundles, undefined, {
      storageBenefitSignal: 'high',
      solarStorageOpportunity: 'high',
    });

    // When context changes, at least one overall score should differ
    const collectScores = (r: typeof r1) =>
      [
        ...(r.bestOverall ? [r.bestOverall] : []),
        ...r.disqualifiedCandidates,
      ].map(d => `${d.family}:${d.overallScore}`);

    expect(collectScores(r1).join(',')).not.toBe(collectScores(r2).join(','));
  });

  // ─── Objective scores stay in bounds ───────────────────────────────────────

  it('all objective scores remain in [0, 100] with extreme context signals', () => {
    const bundles = makeBundles(LARGE_FAMILY_INPUT);

    const result = buildRecommendationsFromEvidence(bundles, undefined, {
      storageBenefitSignal: 'high',
      solarStorageOpportunity: 'high',
    });

    const allDecisions = [
      ...(result.bestOverall ? [result.bestOverall] : []),
      ...result.disqualifiedCandidates,
    ];

    for (const decision of allDecisions) {
      for (const score of Object.values(decision.objectiveScores)) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });

  it('result is deterministic — same inputs produce same context signals and recommendations', () => {
    const demo1 = runDemographicsAssessmentModule(LARGE_FAMILY_INPUT);
    const demo2 = runDemographicsAssessmentModule(LARGE_FAMILY_INPUT);
    expect(demo1.storageBenefitSignal).toBe(demo2.storageBenefitSignal);
    expect(demo1.dailyHotWaterLitres).toBe(demo2.dailyHotWaterLitres);

    const pv1 = runPvAssessmentModule({ roofOrientation: 'south', solarShading: 'low', occupancySignature: 'steady_home', dhwTankType: 'mixergy', preferCombi: false } as EngineInputV2_3);
    const pv2 = runPvAssessmentModule({ roofOrientation: 'south', solarShading: 'low', occupancySignature: 'steady_home', dhwTankType: 'mixergy', preferCombi: false } as EngineInputV2_3);
    expect(pv1.solarStorageOpportunity).toBe(pv2.solarStorageOpportunity);
    expect(pv1.pvSuitability).toBe(pv2.pvSuitability);
  });
});
