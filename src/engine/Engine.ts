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

  // ── Step 3: Map FamilyRunnerResult back to FullEngineResultCore ───────────
  // The runner owns its family-specific modules.  For backward compatibility,
  // non-owned modules that FullEngineResultCore requires are computed here as
  // legacy fallbacks.  These fallbacks will be removed in later PRs once
  // callers have migrated to the runner-level result shape.

  const { sludgeVsScale } = result.hydraulic;

  // DHW backward compat — combi modules for stored-system runs
  // Wire dhwCapacityDeratePct into CombiDhwModule: maxQtoDhwKw *= (1 − dhwCapacityDeratePct)
  const combiDhwV1 = result.dhw.combiDhwV1
    ?? runCombiDhwModuleV1(input, sludgeVsScale.dhwCapacityDeratePct);
  const combiStress = result.heating.combiStress
    ?? runCombiStressModule(input);

  // DHW backward compat — stored modules for combi runs
  // combiSimultaneousFailed is used to wire combi stress into the stored DHW path
  const combiSimultaneousFailed = combiDhwV1.flags.some(f => f.id === 'combi-simultaneous-demand');
  const storedDhwV1 = result.dhw.storedDhwV1
    ?? runStoredDhwModuleV1(input, combiSimultaneousFailed);
  const mixergy = result.dhw.mixergy
    ?? runMixergyVolumetricsModule(input);
  const mixergyLegacy = result.dhw.mixergyLegacy
    ?? runMixergyLegacyModule({
        hasIotIntegration: input.hasIotIntegration ?? false,
        installerNetwork: input.installerNetwork ?? 'independent',
        dhwStorageLitres: input.dhwStorageLitres ?? 150,
      });

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
