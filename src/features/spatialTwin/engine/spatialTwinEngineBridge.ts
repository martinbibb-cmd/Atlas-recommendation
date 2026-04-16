import type { SpatialTwinModelV1 } from '../state/spatialTwin.types';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';
import { projectSpatialTwinToEngineInput } from './projectSpatialTwinToEngineInput';

const ENGINE_INPUT_DEFAULTS: Partial<EngineInputV2_3> = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.0,
  bathroomCount: 1,
  occupancyCount: 2,
  heatLossWatts: 6000,
  radiatorCount: 8,
  returnWaterTemp: 50,
  buildingMass: 'medium',
  highOccupancy: false,
  preferCombi: false,
  currentHeatSourceType: 'combi',
  occupancySignature: 'steady',
};

export function runEngineFromSpatialTwin(
  spatial: SpatialTwinModelV1,
  survey: Partial<EngineInputV2_3>,
  mode: 'current' | 'proposed',
): Partial<EngineInputV2_3> {
  const projected = projectSpatialTwinToEngineInput(spatial, survey, mode);
  return { ...ENGINE_INPUT_DEFAULTS, ...projected };
}
