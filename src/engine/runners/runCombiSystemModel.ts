/**
 * runCombiSystemModel.ts — PR2: Topology-aware runner for combi boiler systems.
 *
 * This runner owns the combi-sensitive module calls.  It is the only runner that
 * receives a topology with `drawOff` defined (`drawOff.source === 'combi_direct'`).
 *
 * Owned modules:
 *   - runCombiDhwModuleV1   (combi DHW ramp, simultaneous-demand risk)
 *   - runCombiStressModule  (purge loss, short-draw efficiency, condensing stress)
 *
 * Common modules (also called in stored-system runners):
 *   - normalizeInput, runHydraulicSafetyModule, runSludgeVsScaleModule,
 *     runHydraulicModuleV1, runLifestyleSimulationModule, runRedFlagModule,
 *     generateBom, runLegacyInfrastructureModule, runSystemOptimizationModule,
 *     runMetallurgyEdgeModule, runSpecEdgeModule, runGridFlexModule,
 *     runHeatPumpRegimeModuleV1, analysePressure, runCwsSupplyModuleV1,
 *     lookupSedbukV1, runBoilerSizingModuleV1, buildBoilerEfficiencyModelV1,
 *     runFabricModelV1, runSmartTopUpController, runSolarBoostModule,
 *     runCondensingStateModule, runCondensingRuntimeModule
 *
 * Design rule: this runner must never be called with a hydronic topology.
 * The `SystemTopology` passed in must have `appliance.family === 'combi'`
 * and `drawOff` defined.
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';
import { normalizeInput } from '../normalizer/Normalizer';
import { runHydraulicSafetyModule } from '../modules/HydraulicSafetyModule';
import { runHydraulicModuleV1 } from '../modules/HydraulicModule';
import { runCombiStressModule } from '../modules/CombiStressModule';
import { runCombiDhwModuleV1 } from '../modules/CombiDhwModule';
import { runCombiDhwPhaseModel, adaptEngineInputToCombiPhase } from '../modules/CombiDhwPhaseModel';
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
import { buildCombiStateTimeline } from '../timeline/buildCombiStateTimeline';

/**
 * Runs all engine modules for a combi boiler system.
 *
 * This is the only runner that owns `combiDhwV1` and `combiStress`.
 * The `topology` passed in must reflect a combi appliance
 * (`appliance.family === 'combi'`, `drawOff` defined).
 *
 * @param input    Raw engine input from the survey layer.
 * @param topology PR1 topology contract — must be a combi topology.
 */
export function runCombiSystemModel(
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

  // ── Combi-owned modules ───────────────────────────────────────────────────
  // These modules are the responsibility of the combi runner.  The combi
  // topology guarantees a direct draw-off path, so these results are
  // physically meaningful only in this runner.
  const combiDhwV1 = runCombiDhwModuleV1(input, sludgeVsScale.dhwCapacityDeratePct);
  const combiDhwPhase = runCombiDhwPhaseModel(adaptEngineInputToCombiPhase(input));
  const combiStress = runCombiStressModule(input);

  // PR6: Build canonical internal state timeline from combi phase model result.
  const stateTimeline = buildCombiStateTimeline(combiDhwPhase, topology.appliance.family);

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
      // PR3: canonical DHW envelope — combi runner owns combiDhwV1 only.
      // storedDhwV1, mixergy, and mixergyLegacy must be absent for this family.
      // PR5: combiDhwPhase added — combi direct-DHW service-switching phase model.
      kind: 'direct_combi',
      sourcePath: 'combi_runner',
      combiDhwV1,
      combiDhwPhase,
    },
    heating: {
      lifestyle,
      // Combi runner owns combiStress
      combiStress,
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
    stateTimeline,
  };
}
