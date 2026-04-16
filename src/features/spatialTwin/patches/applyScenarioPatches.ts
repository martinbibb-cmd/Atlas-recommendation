import type { SpatialTwinModelV1, AtlasSpatialPatchV1 } from '../state/spatialTwin.types';
import { applyLocalSpatialPatch } from './applyLocalSpatialPatch';

/**
 * Project a scenario view by replaying its patch stack on top of the base model.
 *
 * Patches are applied in the order they appear in the array.
 * The base model is never mutated — a new model is returned for each call.
 *
 * @param base    The canonical base SpatialTwinModelV1.
 * @param patches Ordered patches belonging to the scenario (may be empty).
 * @returns       The projected model with all scenario patches applied.
 */
export function applyScenarioPatches(
  base: SpatialTwinModelV1,
  patches: AtlasSpatialPatchV1[],
): SpatialTwinModelV1 {
  return patches.reduce<SpatialTwinModelV1>(
    (model, patch) => applyLocalSpatialPatch(model, patch),
    base,
  );
}
