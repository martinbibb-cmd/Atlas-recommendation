/**
 * runRegularStoredSystemModel.ts — PR2: Topology-aware runner for regular (open-vented)
 * boiler installations.
 *
 * This runner owns the stored-water module calls for traditional open-vented boiler
 * configurations (e.g. a regular/heat-only boiler with a vented hot-water cylinder fed
 * from a cold-water storage cistern in the loft).  It operates without a direct
 * draw-off path: the topology has `drawOff === undefined`.
 *
 * In UK terminology, a "regular" boiler is a heat-only boiler that heats water for
 * both central heating and a separate hot-water cylinder.  When paired with an
 * open-vented (gravity-fed, tank-fed) cylinder, the system is classified as
 * `appliance.family === 'open_vented'` in the PR1 topology.
 *
 * Owned modules:
 *   - runStoredDhwModuleV1       (stored DHW capacity, vented cylinder sizing)
 *   - runMixergyVolumetricsModule (Mixergy equivalent volume and footprint, when applicable)
 *   - runMixergyLegacyModule     (Mixergy legacy settings, when applicable)
 *
 * Common modules: same as the other stored-system runners.
 *
 * Design rule: this runner must not be called with a combi topology.
 * The `SystemTopology` passed in must have `appliance.family === 'regular'` or
 * `appliance.family === 'open_vented'`, and `drawOff === undefined`.
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import { normalizeInput } from '../normalizer/Normalizer';
import { runHydraulicSafetyModule } from '../modules/HydraulicSafetyModule';
import { runHydraulicModuleV1 } from '../modules/HydraulicModule';
import { runStoredDhwModuleV1 } from '../modules/StoredDhwModule';
import { runStoredDhwPhaseModel, adaptEngineInputToStoredPhase } from '../modules/StoredDhwPhaseModel';
import { runMixergyVolumetricsModule } from '../modules/MixergyVolumetricsModule';
import { runMixergyLegacyModule } from '../modules/MixergyLegacyModule';
import { runLifestyleSimulationModule } from '../modules/LifestyleSimulationModule';
import { runRedFlagModule } from '../modules/RedFlagModule';
import { generateBom } from '../modules/BomGenerator';
import { runLegacyInfrastructureModule } from '../modules/LegacyInfrastructureModule';
import { runSludgeVsScaleModule } from '../modules/SludgeVsScaleModule';
import { runSystemOptimizationModule } from '../modules/SystemOptimizationModule';
import { runMetallurgyEdgeModule } from '../modules/MetallurgyEdgeModule';
import { runSpecEdgeModule } from '../modules/SpecEdgeModule';
import { runGridFlexModule } from '../modules/GridFlexModule';
import { runHeatPumpRegimeModuleV1 } from '../modules/HeatPumpRegimeModule';
import { analysePressure } from '../modules/PressureModule';
import { runCwsSupplyModuleV1 } from '../modules/CwsSupplyModule';
import { lookupSedbukV1 } from '../modules/SedbukModule';
import { runBoilerSizingModuleV1 } from '../modules/BoilerSizingModule';
import { buildBoilerEfficiencyModelV1 } from '../modules/BoilerEfficiencyModelV1';
import { runFabricModelV1 } from '../modules/FabricModelModule';
import { runSmartTopUpController } from '../modules/SmartTopUpController';
import { runSolarBoostModule } from '../modules/SolarBoostModule';
import { runCondensingStateModule } from '../modules/CondensingStateModule';
import { runCondensingRuntimeModule } from '../modules/CondensingRuntimeModule';
import type { SystemTopology } from '../topology/SystemTopology';
import type { FamilyRunnerResult } from './types';
import { buildDemandHeatKw96, computeAverageLoadFraction } from './sharedRunnerUtils';

/**
 * Runs all engine modules for a regular (open-vented) boiler installation.
 *
 * This runner owns `storedDhwV1`, `mixergy`, and `mixergyLegacy`.
 * The `topology` passed in must reflect a hydronic appliance with
 * `appliance.family === 'regular'` or `appliance.family === 'open_vented'`,
 * and `drawOff === undefined`.
 *
 * @param input    Raw engine input from the survey layer.
 * @param topology PR1 topology contract — must be a regular/open-vented topology.
 */
export function runRegularStoredSystemModel(
  input: EngineInputV2_3,
  topology: SystemTopology,
): FamilyRunnerResult {
  const normalizer = normalizeInput(input);

  if (input.maintenance?.serviceLevelPct) {
    normalizer.tenYearEfficiencyDecayPct *= (1 - input.maintenance.serviceLevelPct / 100);
  }

  const safety = runHydraulicSafetyModule(input);

  const sludgeVsScale = runSludgeVsScaleModule({
    pipingTopology: input.pipingTopology ?? 'two_pipe',
    hasMagneticFilter: input.hasMagneticFilter ?? false,
    waterHardnessCategory: normalizer.waterHardnessCategory,
    systemAgeYears: input.systemAgeYears ?? 0,
    annualGasSpendGbp: input.annualGasSpendGbp,
  });

  const v1 = runHydraulicModuleV1(input, sludgeVsScale.flowDeratePct);

  // ── Stored-system-owned modules ───────────────────────────────────────────
  // The hydronic topology guarantees no direct draw-off path.  DHW is served
  // via the vented (tank-fed) hot-water cylinder.
  const storedDhwV1 = runStoredDhwModuleV1(input, false);
  // PR4: model draw-off from store and recharge as separate phases.
  const storedDhwPhase = runStoredDhwPhaseModel(
    adaptEngineInputToStoredPhase(input, 'boiler_stored'),
  );
  const mixergy = runMixergyVolumetricsModule(input);
  const mixergyLegacy = runMixergyLegacyModule({
    hasIotIntegration: input.hasIotIntegration ?? false,
    installerNetwork: input.installerNetwork ?? 'independent',
    dhwStorageLitres: input.dhwStorageLitres ?? 150,
  });

  const lifestyle = runLifestyleSimulationModule(input, sludgeVsScale.cyclingLossPct);

  const redFlags = runRedFlagModule(input);
  const bomItems = generateBom(input, safety, redFlags);
  const legacyInfrastructure = runLegacyInfrastructureModule(input);

  const systemOptimization = runSystemOptimizationModule({
    installationPolicy: input.installationPolicy ?? 'high_temp_retrofit',
    heatLossWatts: input.heatLossWatts,
    radiatorCount: input.radiatorCount,
  });

  const metallurgyEdge = runMetallurgyEdgeModule({
    hasSoftener: input.hasSoftener ?? false,
    waterHardnessCategory: normalizer.waterHardnessCategory,
    preferredMetallurgy: input.preferredMetallurgy,
  });

  const specEdge = runSpecEdgeModule({
    installationPolicy: input.installationPolicy ?? 'high_temp_retrofit',
    heatLossWatts: input.heatLossWatts,
    unitModulationFloorKw: input.unitModulationFloorKw ?? 3,
    waterHardnessCategory: normalizer.waterHardnessCategory,
    hasSoftener: input.hasSoftener ?? false,
    hasMagneticFilter: input.hasMagneticFilter ?? false,
    dhwTankType: input.dhwTankType,
    annualGasSpendGbp: input.annualGasSpendGbp,
    preferredMetallurgy: input.preferredMetallurgy,
  });

  const gridFlex = input.gridFlexInput
    ? runGridFlexModule(input.gridFlexInput)
    : undefined;

  const heatPumpRegime = runHeatPumpRegimeModuleV1(input);

  const dynamicBar = input.dynamicMainsPressureBar ?? input.dynamicMainsPressure;
  const pressureAnalysis = analysePressure(dynamicBar, input.staticMainsPressureBar);
  const cwsSupplyV1 = runCwsSupplyModuleV1(input);

  const boilerInput = input.currentSystem?.boiler;
  const sedbukV1 = boilerInput
    ? lookupSedbukV1({
        gcNumber:   boilerInput.gcNumber,
        ageYears:   boilerInput.ageYears,
        condensing: boilerInput.condensing,
      })
    : undefined;

  const peakHeatLossKw = input.heatLossWatts != null ? input.heatLossWatts / 1000 : null;
  const sizingV1 = boilerInput
    ? runBoilerSizingModuleV1(
        boilerInput.nominalOutputKw,
        boilerInput.type,
        peakHeatLossKw,
      )
    : undefined;

  const demandHeatKw96 = buildDemandHeatKw96(lifestyle);

  const boilerEfficiencyModelV1 = boilerInput
    ? buildBoilerEfficiencyModelV1({
        gcNumber: boilerInput.gcNumber,
        ageYears: boilerInput.ageYears,
        type: boilerInput.type,
        condensing: boilerInput.condensing,
        nominalOutputKw: boilerInput.nominalOutputKw,
        peakHeatLossKw,
        demandHeatKw96,
        inputSedbukPct: input.currentBoilerSedbukPct,
        boilerConditionBand: input.boilerConditionBand,
      })
    : undefined;

  const fabricModelV1 = input.building
    ? runFabricModelV1({
        wallType:       input.building.fabric?.wallType,
        insulationLevel: input.building.fabric?.insulationLevel,
        glazing:        input.building.fabric?.glazing,
        roofInsulation: input.building.fabric?.roofInsulation,
        airTightness:   input.building.fabric?.airTightness,
        thermalMass:    input.building.thermalMass,
      })
    : undefined;

  const smartTopUp = input.dhwTankType === 'mixergy'
    ? runSmartTopUpController(input)
    : undefined;

  const solarBoost = input.solarBoost?.enabled
    ? runSolarBoostModule(input)
    : undefined;

  const condensingState = runCondensingStateModule({
    flowTempC: input.supplyTempC ?? 70,
    returnTempC: legacyInfrastructure.onePipe?.averageReturnTempC,
    averageLoadFraction: computeAverageLoadFraction(lifestyle),
  });

  const condensingRuntime = runCondensingRuntimeModule({
    condensingState,
    flowTempC: input.supplyTempC ?? 70,
    condensingModeAvailable: systemOptimization.condensingModeAvailable,
    installationPolicy: systemOptimization.installationPolicy,
    systemPlanType: input.systemPlanType,
    dhwTankType: input.dhwTankType,
    primaryPipeDiameter: input.primaryPipeDiameter,
    heatLossWatts: input.heatLossWatts,
  });

  return {
    topology,
    normalizer,
    hydraulic: {
      safety,
      v1,
      sludgeVsScale,
      pressureAnalysis,
      cwsSupplyV1,
    },
    dhw: {
      // PR3: canonical DHW envelope — regular runner owns storedDhwV1, mixergy, mixergyLegacy.
      // combiDhwV1 and combiStress must be absent for this family.
      kind: 'stored',
      sourcePath: 'regular_runner',
      storedDhwV1,
      storedDhwPhase,
      mixergy,
      mixergyLegacy,
    },
    heating: {
      lifestyle,
      heatPumpRegime,
    },
    efficiency: {
      systemOptimization,
      condensingState,
      condensingRuntime,
      sedbukV1,
      sizingV1,
      boilerEfficiencyModelV1,
    },
    lifecycle: {
      metallurgyEdge,
      specEdge,
      legacyInfrastructure,
      fabricModelV1,
      smartTopUp,
      solarBoost,
    },
    advisories: {
      redFlags,
      bomItems,
      gridFlex,
    },
  };
}
