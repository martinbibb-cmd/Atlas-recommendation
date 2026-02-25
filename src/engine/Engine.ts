import type { EngineInputV2_3, FullEngineResult, FullEngineResultCore } from './schema/EngineInputV2_3';
import { normalizeInput } from './normalizer/Normalizer';
import { runHydraulicSafetyModule } from './modules/HydraulicSafetyModule';
import { runHydraulicModuleV1 } from './modules/HydraulicModule';
import { runCombiStressModule } from './modules/CombiStressModule';
import { runCombiDhwModuleV1 } from './modules/CombiDhwModule';
import { runStoredDhwModuleV1 } from './modules/StoredDhwModule';
import { runMixergyVolumetricsModule } from './modules/MixergyVolumetricsModule';
import { runLifestyleSimulationModule } from './modules/LifestyleSimulationModule';
import { runRedFlagModule } from './modules/RedFlagModule';
import { generateBom } from './modules/BomGenerator';
import { runLegacyInfrastructureModule } from './modules/LegacyInfrastructureModule';
import { runSludgeVsScaleModule } from './modules/SludgeVsScaleModule';
import { runSystemOptimizationModule } from './modules/SystemOptimizationModule';
import { runMetallurgyEdgeModule } from './modules/MetallurgyEdgeModule';
import { runMixergyLegacyModule } from './modules/MixergyLegacyModule';
import { runSpecEdgeModule } from './modules/SpecEdgeModule';
import { runGridFlexModule } from './modules/GridFlexModule';
import { runHeatPumpRegimeModuleV1 } from './modules/HeatPumpRegimeModule';
import { analysePressure } from './modules/PressureModule';
import { runCwsSupplyModuleV1 } from './modules/CwsSupplyModule';
import { lookupSedbukV1 } from './modules/SedbukModule';
import { runBoilerSizingModuleV1 } from './modules/BoilerSizingModule';
import { buildBoilerEfficiencyModelV1 } from './modules/BoilerEfficiencyModelV1';
import { buildEngineOutputV1 } from './OutputBuilder';
import { runFabricModelV1 } from './modules/FabricModelModule';


function interpolateDemandKw(minuteIdx: number, hourlyDemandKw: number[]): number {
  const minute = minuteIdx * 15;
  const hour = Math.floor(minute / 60);
  const frac = (minute % 60) / 60;
  const h0 = hour % 24;
  const h1 = (hour + 1) % 24;
  const d0 = hourlyDemandKw[h0] ?? 0;
  const d1 = hourlyDemandKw[h1] ?? 0;
  return Math.max(0, d0 + (d1 - d0) * frac);
}

export function runEngine(input: EngineInputV2_3): FullEngineResult {
  const normalizer = normalizeInput(input);
  const hydraulic = runHydraulicSafetyModule(input);
  const hydraulicV1 = runHydraulicModuleV1(input);
  const combiStress = runCombiStressModule(input);
  const combiDhwV1 = runCombiDhwModuleV1(input);
  const combiSimultaneousFailed = combiDhwV1.flags.some(f => f.id === 'combi-simultaneous-demand');
  const storedDhwV1 = runStoredDhwModuleV1(input, combiSimultaneousFailed);
  const mixergy = runMixergyVolumetricsModule(input);
  const lifestyle = runLifestyleSimulationModule(input);
  const redFlags = runRedFlagModule(input);
  const bomItems = generateBom(input, hydraulic, redFlags);
  const legacyInfrastructure = runLegacyInfrastructureModule(input);

  const sludgeVsScale = runSludgeVsScaleModule({
    pipingTopology: input.pipingTopology ?? 'two_pipe',
    hasMagneticFilter: input.hasMagneticFilter ?? false,
    waterHardnessCategory: normalizer.waterHardnessCategory,
    systemAgeYears: input.systemAgeYears ?? 0,
    annualGasSpendGbp: input.annualGasSpendGbp,
  });

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

  const mixergyLegacy = runMixergyLegacyModule({
    hasIotIntegration: input.hasIotIntegration ?? false,
    installerNetwork: input.installerNetwork ?? 'independent',
    dhwStorageLitres: input.dhwStorageLitres ?? 150,
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

  // SEDBUK baseline — only computed when currentSystem.boiler is provided
  const boilerInput = input.currentSystem?.boiler;
  const sedbukV1 = boilerInput
    ? lookupSedbukV1({
        gcNumber:   boilerInput.gcNumber,
        ageYears:   boilerInput.ageYears,
        condensing: boilerInput.condensing,
      })
    : undefined;

  // Boiler sizing — only computed when currentSystem.boiler is provided
  const peakHeatLossKw = input.heatLossWatts != null ? input.heatLossWatts / 1000 : null;
  const sizingV1 = boilerInput
    ? runBoilerSizingModuleV1(
        boilerInput.nominalOutputKw,
        boilerInput.type,
        peakHeatLossKw,
      )
    : undefined;

  const demandHeatKw96 = lifestyle.hourlyData.length > 0
    ? Array.from({ length: 96 }, (_, i) => parseFloat(interpolateDemandKw(i, lifestyle.hourlyData.map(h => h.demandKw)).toFixed(3)))
    : undefined;

  const boilerEfficiencyModelV1 = boilerInput
    ? buildBoilerEfficiencyModelV1({
        gcNumber: boilerInput.gcNumber,
        ageYears: boilerInput.ageYears,
        type: boilerInput.type,
        condensing: boilerInput.condensing,
        nominalOutputKw: boilerInput.nominalOutputKw,
        peakHeatLossKw,
        demandHeatKw96,
      })
    : undefined;

  // Fabric model V1 — only computed when input.building is provided
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

  const core: FullEngineResultCore = {
    hydraulic,
    hydraulicV1,
    combiStress,
    combiDhwV1,
    storedDhwV1,
    mixergy,
    lifestyle,
    normalizer,
    redFlags,
    bomItems,
    legacyInfrastructure,
    sludgeVsScale,
    systemOptimization,
    metallurgyEdge,
    mixergyLegacy,
    specEdge,
    gridFlex,
    heatPumpRegime,
    pressureAnalysis,
    cwsSupplyV1,
    sedbukV1,
    sizingV1,
    boilerEfficiencyModelV1,
    fabricModelV1,
  };

  const engineOutput = buildEngineOutputV1(core, input);
  return { ...core, engineOutput };
}
