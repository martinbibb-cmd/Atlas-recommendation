import { describe, it, expect } from 'vitest';
import { spatialTwinReducer, initialSpatialTwinState } from '../state/spatialTwin.reducer';
import {
  initTwin,
  importSucceeded,
  applyPatch,
  selectEntity,
  setMode,
} from '../state/spatialTwin.actions';
import type { SpatialTwinModelV1 } from '../state/spatialTwin.types';

function makeMinimalModel(): SpatialTwinModelV1 {
  return {
    version: '1.0',
    propertyId: 'prop-1',
    sourceSessionId: 'session-abc',
    spatial: {
      version: '1.0',
      propertyId: 'prop-1',
      rooms: [{ roomId: 'room-1', label: 'Kitchen', status: 'draft', roomType: 'other', zoneIds: [] }],
      zones: [],
      emitters: [],
      openings: [],
      boundaries: [],
    },
    heatSources: [],
    stores: [],
    controls: [],
    pipeRuns: [],
    evidenceMarkers: [],
  };
}

describe('spatialTwinReducer', () => {
  it('INIT_TWIN sets visitId', () => {
    const state = spatialTwinReducer(initialSpatialTwinState, initTwin('visit-99'));
    expect(state.visitId).toBe('visit-99');
  });

  it('IMPORT_SUCCEEDED sets model and importState to ready', () => {
    const model = makeMinimalModel();
    const state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(model));
    expect(state.importState).toBe('ready');
    expect(state.model).toBe(model);
  });

  it('APPLY_PATCH adds patch to history', () => {
    const model = makeMinimalModel();
    const withModel = spatialTwinReducer(initialSpatialTwinState, importSucceeded(model));
    const patch = {
      patchId: 'p-1',
      entityId: 'room-1',
      entityKind: 'room' as const,
      operation: 'set_label' as const,
      payload: { label: 'Living Room' },
      appliedAt: '2024-01-01T00:00:00Z',
      sourceMode: 'current' as const,
    };
    const state = spatialTwinReducer(withModel, applyPatch(patch));
    expect(state.patchHistory).toHaveLength(1);
    expect(state.dirty).toBe(true);
  });

  it('SELECT_ENTITY sets selectedEntityId', () => {
    const state = spatialTwinReducer(initialSpatialTwinState, selectEntity('room-1'));
    expect(state.selectedEntityId).toBe('room-1');
  });

  it('SET_MODE switches mode', () => {
    const state = spatialTwinReducer(initialSpatialTwinState, setMode('proposed'));
    expect(state.mode).toBe('proposed');
  });

  it('does not mutate prior state', () => {
    const before = { ...initialSpatialTwinState };
    const after = spatialTwinReducer(initialSpatialTwinState, setMode('proposed'));
    expect(after).not.toBe(initialSpatialTwinState);
    expect(initialSpatialTwinState.mode).toBe(before.mode);
  });
});
