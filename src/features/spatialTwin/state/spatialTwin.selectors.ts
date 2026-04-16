import type { SpatialTwinFeatureState } from './spatialTwin.types';

export function selectVisibleRooms(state: SpatialTwinFeatureState) {
  if (state.model == null) return [];
  return state.model.spatial.rooms;
}

export function selectVisibleHeatSources(state: SpatialTwinFeatureState) {
  if (state.model == null) return [];
  const sources = state.model.heatSources;
  if (state.mode === 'current') {
    return sources.filter((s) => s.status === 'existing' || s.status === 'unchanged');
  }
  if (state.mode === 'proposed') {
    return sources.filter((s) => s.status !== 'removed');
  }
  return sources;
}

export function selectVisibleEmitters(state: SpatialTwinFeatureState) {
  if (state.model == null) return [];
  return state.model.spatial.emitters;
}

export function selectSelectedEntity(state: SpatialTwinFeatureState) {
  if (state.model == null || state.selectedEntityId == null) return null;
  const id = state.selectedEntityId;

  const room = state.model.spatial.rooms.find((r) => r.roomId === id);
  if (room != null) return { kind: 'room' as const, entity: room };

  const emitter = state.model.spatial.emitters.find((e) => e.emitterId === id);
  if (emitter != null) return { kind: 'emitter' as const, entity: emitter };

  const heatSource = state.model.heatSources.find((h) => h.heatSourceId === id);
  if (heatSource != null) return { kind: 'heatSource' as const, entity: heatSource };

  const store = state.model.stores.find((s) => s.storeId === id);
  if (store != null) return { kind: 'store' as const, entity: store };

  const pipeRun = state.model.pipeRuns.find((p) => p.pipeRunId === id);
  if (pipeRun != null) return { kind: 'pipeRun' as const, entity: pipeRun };

  const control = state.model.controls.find((c) => c.controlId === id);
  if (control != null) return { kind: 'control' as const, entity: control };

  const evidence = state.model.evidenceMarkers.find((e) => e.evidenceId === id);
  if (evidence != null) return { kind: 'evidence' as const, entity: evidence };

  return null;
}

export function selectOverlayIsActive(
  state: SpatialTwinFeatureState,
  overlayId: string,
): boolean {
  return state.activeOverlayIds.includes(overlayId);
}
