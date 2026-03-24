/**
 * runHeatPumpStoredSystemModel.ts — PR2: Topology-aware runner for heat pump
 * installations.
 *
 * This runner owns the stored-water module calls for air-source and ground-source
 * heat pump configurations.  Heat pumps always charge a dedicated hot-water cylinder
 * (typically unvented, at a lower store temperature than a boiler cylinder).
 * The topology has `drawOff === undefined`.
 *
 * Owned modules:
 *   - runStoredDhwModuleV1       (stored DHW capacity, HP cylinder sizing, COP penalty)
 *   - runMixergyVolumetricsModule (Mixergy equivalent volume and footprint, when applicable)
 *   - runMixergyLegacyModule     (Mixergy legacy settings, when applicable)
 *
 * The heat pump regime (`runHeatPumpRegimeModuleV1`) is a common module run in all
 * runners, but its results are most directly relevant here.
 *
 * Common modules: same as the other stored-system runners.
 *
 * Design rule: this runner must not be called with a combi topology.
 * The `SystemTopology` passed in must have `appliance.family === 'heat_pump'`
 * and `drawOff === undefined`.
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import { normalizeInput } from '../normalizer/Normalizer';
import { runHydraulicSafetyModule } from '../modules/HydraulicSafetyModule';
import { runHydraulicModuleV1 } from '../modules/HydraulicModule';
import { runStoredDhwModuleV1 } from '../modules/StoredDhwModule';
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
 * Runs all engine modules for a heat pump installation.
 *
 * This runner owns `storedDhwV1`, `mixergy`, and `mixergyLegacy`.
 * The `topology` passed in must reflect a hydronic appliance with
 * `appliance.family === 'heat_pump'` and `drawOff === undefined`.
 *
 * @param input    Raw engine input from the survey layer.
 * @param topology PR1 topology contract — must be a heat pump topology.
 */
export function runHeatPumpStoredSystemModel(
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
  // Heat pumps always charge a cylinder — the topology has no direct draw-off
  // path.  The heat pump regime is the primary heat-source model for this family.
  const storedDhwV1 = runStoredDhwModuleV1(input, false);
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

  // Heat pump regime is the primary heat-source behaviour model for this family.
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
      // Stored-system runner owns storedDhwV1, mixergy, and mixergyLegacy;
      // combiDhwV1 and combiStress are absent (combi runner owns those).
      storedDhwV1,
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
