import type { SpatialTwinModelV1, SpatialTwinDeltaSummary } from '../state/spatialTwin.types';

export function buildSpatialTwinCompareSummary(
  model: SpatialTwinModelV1,
): SpatialTwinDeltaSummary {
  const addedEntities: SpatialTwinDeltaSummary['addedEntities'] = [];
  const removedEntities: SpatialTwinDeltaSummary['removedEntities'] = [];
  const changedEntities: SpatialTwinDeltaSummary['changedEntities'] = [];

  // ── Heat sources ──────────────────────────────────────────────────────────
  for (const hs of model.heatSources) {
    if (hs.status === 'proposed') {
      addedEntities.push({ kind: 'heatSource', label: hs.label });
    } else if (hs.status === 'removed') {
      removedEntities.push({ kind: 'heatSource', label: hs.label });
    }
  }

  // ── Stores ────────────────────────────────────────────────────────────────
  for (const store of model.stores) {
    if (store.status === 'proposed') {
      addedEntities.push({ kind: 'store', label: store.label });
    } else if (store.status === 'removed') {
      removedEntities.push({ kind: 'store', label: store.label });
    }
  }

  // ── Controls ──────────────────────────────────────────────────────────────
  for (const ctrl of model.controls) {
    if (ctrl.status === 'proposed') {
      addedEntities.push({ kind: 'control', label: ctrl.label });
    } else if (ctrl.status === 'removed') {
      removedEntities.push({ kind: 'control', label: ctrl.label });
    }
  }

  // ── Pipe runs ─────────────────────────────────────────────────────────────
  for (const pipe of model.pipeRuns) {
    if (pipe.status === 'proposed') {
      addedEntities.push({ kind: 'pipeRun', label: pipe.label });
    } else if (pipe.status === 'removed') {
      removedEntities.push({ kind: 'pipeRun', label: pipe.label });
    }
  }

  // ── Emitters ──────────────────────────────────────────────────────────────
  // Emitters don't carry status in AtlasEmitterV1 — no delta to compute

  const totalChanges = addedEntities.length + removedEntities.length + changedEntities.length;

  return { addedEntities, removedEntities, changedEntities, totalChanges };
}
