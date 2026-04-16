import type { AtlasSpatialPatchV1 } from '../state/spatialTwin.types';
import type { SpatialTwinMode } from '../state/spatialTwin.types';

let patchCounter = 0;

export function buildPatchQueueHelpers(sourceMode: SpatialTwinMode) {
  function createPatch(
    entityId: string,
    entityKind: AtlasSpatialPatchV1['entityKind'],
    operation: AtlasSpatialPatchV1['operation'],
    payload: Record<string, unknown>,
  ): AtlasSpatialPatchV1 {
    return {
      patchId: `patch-${++patchCounter}`,
      entityId,
      entityKind,
      operation,
      payload,
      appliedAt: new Date().toISOString(),
      sourceMode,
    };
  }

  function reorderPatches(
    patches: AtlasSpatialPatchV1[],
    fromIndex: number,
    toIndex: number,
  ): AtlasSpatialPatchV1[] {
    const result = [...patches];
    const [item] = result.splice(fromIndex, 1);
    result.splice(toIndex, 0, item);
    return result;
  }

  function removePatches(
    patches: AtlasSpatialPatchV1[],
    patchIds: string[],
  ): AtlasSpatialPatchV1[] {
    const idSet = new Set(patchIds);
    return patches.filter((p) => !idSet.has(p.patchId));
  }

  return { createPatch, reorderPatches, removePatches };
}
