import type { AtlasSpatialPatchV1 } from '../state/spatialTwin.types';
import type { SpatialTwinMode } from '../state/spatialTwin.types';

/**
 * Generates a unique patch ID using a high-resolution timestamp plus a
 * per-millisecond sequence suffix.  This avoids the shared-counter race that
 * arises when multiple `buildPatchQueueHelpers` instances are live at once.
 */
function generatePatchId(): string {
  const ts = Date.now();
  const rand = Math.floor(performance.now() * 1000) % 100000;
  return `patch-${ts}-${rand}`;
}

export function buildPatchQueueHelpers(sourceMode: SpatialTwinMode) {
  function createPatch(
    entityId: string,
    entityKind: AtlasSpatialPatchV1['entityKind'],
    operation: AtlasSpatialPatchV1['operation'],
    payload: Record<string, unknown>,
  ): AtlasSpatialPatchV1 {
    return {
      patchId: generatePatchId(),
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
