/**
 * runEngine.ts — PR2/PR3: Topology-aware engine orchestrator.
 *
 * PR3 change: `runEngine()` no longer computes both combi and stored DHW paths
 * for every input.  Fallback logic is now restricted to the selected family:
 *   - combi family  → may backfill combiDhwV1 and combiStress only
 *   - hydronic families → may backfill storedDhwV1, mixergy, and mixergyLegacy only
 * Cross-family DHW fields remain absent (undefined) in the FullEngineResultCore output.
 */
import type { EngineInputV2_3, FullEngineResult, FullEngineResultCore } from './schema/EngineInputV2_3';
import { runCombiDhwModuleV1 } from './modules/CombiDhwModule';
import { runCombiStressModule } from './modules/CombiStressModule';
import { runStoredDhwModuleV1 } from './modules/StoredDhwModule';
import { runMixergyVolumetricsModule } from './modules/MixergyVolumetricsModule';
import { runMixergyLegacyModule } from './modules/MixergyLegacyModule';
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
  // PR3: Fallback logic is now family-gated.  Only fields valid for the selected
  // family are ever backfilled — the cross-family fallback paths from PR2 have
  // been removed.

  const { sludgeVsScale } = result.hydraulic;
  const isCombi = result.topology.appliance.family === 'combi';

  // ── Combi-family DHW fallbacks (valid only when isCombi) ──────────────────
  // The combi runner always populates combiDhwV1 and combiStress directly, so
  // these fallbacks should never fire in practice.  They are retained only as
  // a last-resort guard in case a future refactor leaves the runner output
  // incomplete.  For hydronic families these branches are never entered.
  const combiDhwV1 = isCombi
    ? (result.dhw.combiDhwV1 ?? runCombiDhwModuleV1(input, sludgeVsScale.dhwCapacityDeratePct))
    : undefined;
  const combiStress = isCombi
    ? (result.heating.combiStress ?? runCombiStressModule(input))
    : undefined;

  // ── Hydronic-family DHW fallbacks (valid only when !isCombi) ─────────────
  // Similarly, the hydronic runners always populate storedDhwV1/mixergy directly.
  // combiSimultaneousFailed is not meaningful for hydronic runners, so it is
  // omitted from the stored fallback path.
  const storedDhwV1 = !isCombi
    ? (result.dhw.storedDhwV1 ?? runStoredDhwModuleV1(input, false))
    : undefined;
  const mixergy = !isCombi
    ? (result.dhw.mixergy ?? runMixergyVolumetricsModule(input))
    : undefined;
  const mixergyLegacy = !isCombi
    ? (result.dhw.mixergyLegacy ?? runMixergyLegacyModule({
        hasIotIntegration: input.hasIotIntegration ?? false,
        installerNetwork: input.installerNetwork ?? 'independent',
        dhwStorageLitres: input.dhwStorageLitres ?? 150,
      }))
    : undefined;

  const core: FullEngineResultCore = {
    hydraulic: result.hydraulic.safety,
    hydraulicV1: result.hydraulic.v1,
    combiStress,
    combiDhwV1,
    storedDhwV1,
    mixergy,
    lifestyle: result.heating.lifestyle,
    normalizer: result.normalizer,
    redFlags: result.advisories.redFlags,
    bomItems: result.advisories.bomItems,
    legacyInfrastructure: result.lifecycle.legacyInfrastructure,
    sludgeVsScale,
    systemOptimization: result.efficiency.systemOptimization,
    metallurgyEdge: result.lifecycle.metallurgyEdge,
    mixergyLegacy,
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
  };

  const engineOutput = buildEngineOutputV1(core, input);
  const inputValidation = runEngineInputValidation(input);
  return { ...core, engineOutput, inputValidation };
}
