/**
 * runEngine.ts — PR2/PR3/PR12: Topology-aware engine orchestrator.
 *
 * PR3  family-gated DHW: each family runner owns only its DHW fields; no
 *      cross-family fallback paths.
 * PR12 multi-family evidence: all four candidate families are run so that
 *      `buildRecommendationsFromEvidence` can rank them against each other.
 *      The primary family (current heat source) still drives FullEngineResultCore.
 *      The canonical recommendation result is exposed via `FullEngineResult.recommendationResult`.
 */
import type { EngineInputV2_3, FullEngineResult, FullEngineResultCore } from './schema/EngineInputV2_3';
import { buildEngineOutputV1 } from './OutputBuilder';
import { runEngineInputValidation } from './modules/EngineInputValidationModule';
import { buildSystemTopologyFromSpec } from './topology/SystemTopology';
import type { SystemTopology } from './topology/SystemTopology';
import type { HeatSourceBehaviourInput } from './modules/HeatSourceBehaviourModel';
import { runCombiSystemModel } from './runners/runCombiSystemModel';
import { runSystemStoredSystemModel } from './runners/runSystemStoredSystemModel';
import { runRegularStoredSystemModel } from './runners/runRegularStoredSystemModel';
import { runHeatPumpStoredSystemModel } from './runners/runHeatPumpStoredSystemModel';
import type { FamilyRunnerResult } from './runners/types';
import { assertValidDhwOwnership } from './runners/dhwOwnership';
import { buildDerivedEventsFromTimeline } from './timeline/buildDerivedEventsFromTimeline';
import { buildLimiterLedger } from './limiter/buildLimiterLedger';
import { buildFitMapModel } from './fitmap/buildFitMapModel';
import { buildRecommendationsFromEvidence } from './recommendation/buildRecommendationsFromEvidence';
import type { CandidateEvidenceBundle } from './recommendation/RecommendationModel';
import { runDemographicsAssessmentModule } from './modules/DemographicsAssessmentModule';
import { runPvAssessmentModule } from './modules/PvAssessmentModule';

/**
 * Maps EngineInputV2_3.currentHeatSourceType to a HeatSourceBehaviourInput.systemType
 * for building the PR1 SystemTopology.
 *
 * Mapping:
 *   'combi'   → 'combi'        → appliance.family: 'combi'
 *   'system'  → 'stored_water' → appliance.family: 'system'
 *   'regular' → 'open_vented'  → appliance.family: 'open_vented'
 *   'ashp'    → 'heat_pump'    → appliance.family: 'heat_pump'
 *   'other' / undefined → 'stored_water' (conservative default)
 */
function toHeatSourceSystemType(
  heatSourceType: EngineInputV2_3['currentHeatSourceType'],
): HeatSourceBehaviourInput['systemType'] {
  switch (heatSourceType) {
    case 'combi':   return 'combi';
    case 'ashp':    return 'heat_pump';
    case 'regular': return 'open_vented';
    case 'system':
    case 'other':
    default:        return 'stored_water';
  }
}

/**
 * Selects the topology-aware family runner based on the appliance family in the
 * PR1 topology.
 *
 * Runner ownership:
 *   'combi'                  → runCombiSystemModel
 *   'system'                 → runSystemStoredSystemModel
 *   'heat_pump'              → runHeatPumpStoredSystemModel
 *   'regular' / 'open_vented'→ runRegularStoredSystemModel
 */
function selectRunner(
  topology: SystemTopology,
): (input: EngineInputV2_3, topology: SystemTopology) => FamilyRunnerResult {
  switch (topology.appliance.family) {
    case 'combi':      return runCombiSystemModel;
    case 'system':     return runSystemStoredSystemModel;
    case 'heat_pump':  return runHeatPumpStoredSystemModel;
    case 'regular':
    case 'open_vented': return runRegularStoredSystemModel;
  }
}

export function runEngine(input: EngineInputV2_3): FullEngineResult {
  // ── Step 1: Build topology from input — determines which runner to delegate to ──
  const systemType = toHeatSourceSystemType(input.currentHeatSourceType);
  const topology = buildSystemTopologyFromSpec({ systemType });

  // ── Step 2: Delegate to the topology-aware family runner ─────────────────
  const runner = selectRunner(topology);
  const result = runner(input, topology);

  // ── Step 3: Assert DHW ownership before mapping to legacy shape ───────────
  // PR3: assertValidDhwOwnership throws if a runner has cross-contaminated the
  // DHW envelope (e.g. stored fields present in a combi result).
  assertValidDhwOwnership(result.dhw, result.topology);

  // ── Step 4: Map FamilyRunnerResult back to FullEngineResultCore ───────────
  // PR12: DHW topology-flattening fallback paths removed.  Each runner always
  // populates its own family's DHW fields; the fallback (?? runXxx) guards
  // are no longer needed and would mask runner bugs if retained.

  const isCombi = result.topology.appliance.family === 'combi';

  const core: FullEngineResultCore = {
    hydraulic: result.hydraulic.safety,
    hydraulicV1: result.hydraulic.v1,
    combiStress:  isCombi ? result.heating.combiStress : undefined,
    combiDhwV1:   isCombi ? result.dhw.combiDhwV1      : undefined,
    storedDhwV1: !isCombi ? result.dhw.storedDhwV1     : undefined,
    mixergy:     !isCombi ? result.dhw.mixergy          : undefined,
    lifestyle: result.heating.lifestyle,
    normalizer: result.normalizer,
    redFlags: result.advisories.redFlags,
    bomItems: result.advisories.bomItems,
    legacyInfrastructure: result.lifecycle.legacyInfrastructure,
    sludgeVsScale: result.hydraulic.sludgeVsScale,
    systemOptimization: result.efficiency.systemOptimization,
    metallurgyEdge: result.lifecycle.metallurgyEdge,
    mixergyLegacy: !isCombi ? result.dhw.mixergyLegacy : undefined,
    specEdge: result.lifecycle.specEdge,
    gridFlex: result.advisories.gridFlex,
    heatPumpRegime: result.heating.heatPumpRegime,
    pressureAnalysis: result.hydraulic.pressureAnalysis,
    cwsSupplyV1: result.hydraulic.cwsSupplyV1,
    sedbukV1: result.efficiency.sedbukV1,
    sizingV1: result.efficiency.sizingV1,
    boilerEfficiencyModelV1: result.efficiency.boilerEfficiencyModelV1,
    fabricModelV1: result.lifecycle.fabricModelV1,
    smartTopUp: result.lifecycle.smartTopUp,
    solarBoost: result.lifecycle.solarBoost,
    condensingState: result.efficiency.condensingState,
    condensingRuntime: result.efficiency.condensingRuntime,
    demographicOutputs: runDemographicsAssessmentModule(input),
    pvAssessment: runPvAssessmentModule(input),
  };

  // ── Step 5: Build evidence bundles for all candidate families ─────────────
  // PR12: Run every candidate family to produce the limiter ledger and fit-map
  // evidence required by buildRecommendationsFromEvidence.
  // The primary family result (already computed above) is reused instead of
  // re-running the same family runner a second time.
  const candidateFamilySpecs: Array<{ systemType: HeatSourceBehaviourInput['systemType'] }> = [
    { systemType: 'combi' },
    { systemType: 'stored_water' },
    { systemType: 'heat_pump' },
    { systemType: 'open_vented' },
  ];

  const bundles: CandidateEvidenceBundle[] = candidateFamilySpecs.map(spec => {
    const familyTopology = buildSystemTopologyFromSpec({
      systemType: spec.systemType,
      hotWaterStorageLitres: spec.systemType === 'heat_pump'
        ? (input.dhwStorageLitres ?? 150)
        : undefined,
    });
    // Reuse the primary result when the candidate family matches to avoid redundant computation.
    const isPrimaryFamily = spec.systemType === systemType;
    const familyResult: FamilyRunnerResult = isPrimaryFamily
      ? result
      : selectRunner(familyTopology)(input, familyTopology);
    const events = buildDerivedEventsFromTimeline(familyResult.stateTimeline, familyTopology.appliance.family);
    const limiterLedger = buildLimiterLedger(familyResult, events, {
      occupancyCount: input.occupancyCount,
      bathroomCount: input.bathroomCount,
      peakConcurrentOutlets: input.peakConcurrentOutlets,
    });
    const fitMap = buildFitMapModel(
      familyResult,
      familyResult.stateTimeline,
      events,
      limiterLedger,
    );
    return { runnerResult: familyResult, events, limiterLedger, fitMap };
  });

  const recommendationResult = buildRecommendationsFromEvidence(bundles, input.productConstraints, {
    storageBenefitSignal: core.demographicOutputs.storageBenefitSignal,
    solarStorageOpportunity: core.pvAssessment.solarStorageOpportunity,
    userPreferences: input.preferences,
  });

  // Pass canonicalBestFamily so engineOutput.recommendation.primary always
  // mirrors recommendationResult.bestOverall — keeping every surface in sync.
  const engineOutput = buildEngineOutputV1(core, input, recommendationResult.bestOverall?.family ?? null);
  const inputValidation = runEngineInputValidation(input);
  return { ...core, engineOutput, inputValidation, recommendationResult };
}
