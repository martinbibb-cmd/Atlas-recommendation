import type { EngineInputV2_3, FullEngineResult } from './schema/EngineInputV2_3';
import { normalizeInput } from './normalizer/Normalizer';
import { runHydraulicSafetyModule } from './modules/HydraulicSafetyModule';
import { runCombiStressModule } from './modules/CombiStressModule';
import { runMixergyVolumetricsModule } from './modules/MixergyVolumetricsModule';
import { runLifestyleSimulationModule } from './modules/LifestyleSimulationModule';
import { runRedFlagModule } from './modules/RedFlagModule';
import { generateBom } from './modules/BomGenerator';

export function runEngine(input: EngineInputV2_3): FullEngineResult {
  const normalizer = normalizeInput(input);
  const hydraulic = runHydraulicSafetyModule(input);
  const combiStress = runCombiStressModule(input);
  const mixergy = runMixergyVolumetricsModule();
  const lifestyle = runLifestyleSimulationModule(input);
  const redFlags = runRedFlagModule(input);
  const bomItems = generateBom(input, hydraulic, redFlags);

  return { hydraulic, combiStress, mixergy, lifestyle, normalizer, redFlags, bomItems };
}
