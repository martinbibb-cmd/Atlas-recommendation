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
import { buildEngineOutputV1 } from './OutputBuilder';

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
  };

  const engineOutput = buildEngineOutputV1(core);
  return { ...core, engineOutput };
}
