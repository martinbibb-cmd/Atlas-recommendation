import type { SpatialTwinFeatureState } from './spatialTwin.types';
import type { SpatialTwinAction } from './spatialTwin.actions';
import {
  INIT_TWIN,
  IMPORT_STARTED,
  IMPORT_SUCCEEDED,
  IMPORT_FAILED,
  SELECT_ENTITY,
  HOVER_ENTITY,
  DESELECT_ENTITY,
  SET_MODE,
  SET_LEFT_RAIL_SECTION,
  TOGGLE_OVERLAY,
  APPLY_PATCH,
  RESET_PATCHES,
} from './spatialTwin.actions';
import { applyLocalSpatialPatch } from '../patches/applyLocalSpatialPatch';

export const initialSpatialTwinState: SpatialTwinFeatureState = {
  visitId: '',
  model: null,
  patchHistory: [],
  selectedEntityId: null,
  hoveredEntityId: null,
  mode: 'current',
  activeLeftRailSection: 'house',
  activeOverlayIds: [],
  importState: 'idle',
  dirty: false,
};

export function spatialTwinReducer(
  state: SpatialTwinFeatureState,
  action: SpatialTwinAction,
): SpatialTwinFeatureState {
  switch (action.type) {
    case INIT_TWIN:
      return {
        ...initialSpatialTwinState,
        visitId: action.payload.visitId,
      };

    case IMPORT_STARTED:
      return { ...state, importState: 'loading', lastError: undefined };

    case IMPORT_SUCCEEDED:
      return {
        ...state,
        importState: 'ready',
        model: action.payload.model,
        sourceSessionId: action.payload.model.sourceSessionId,
        lastError: undefined,
      };

    case IMPORT_FAILED:
      return {
        ...state,
        importState: 'failed',
        lastError: action.payload.error,
      };

    case SELECT_ENTITY:
      return { ...state, selectedEntityId: action.payload.entityId };

    case HOVER_ENTITY:
      return { ...state, hoveredEntityId: action.payload.entityId };

    case DESELECT_ENTITY:
      return { ...state, selectedEntityId: null };

    case SET_MODE:
      return { ...state, mode: action.payload.mode, selectedEntityId: null };

    case SET_LEFT_RAIL_SECTION:
      return { ...state, activeLeftRailSection: action.payload.section };

    case TOGGLE_OVERLAY: {
      const id = action.payload.overlayId;
      const active = state.activeOverlayIds;
      return {
        ...state,
        activeOverlayIds: active.includes(id)
          ? active.filter((o) => o !== id)
          : [...active, id],
      };
    }

    case APPLY_PATCH: {
      const patch = action.payload.patch;
      const updatedModel =
        state.model != null
          ? applyLocalSpatialPatch(state.model, patch)
          : state.model;
      return {
        ...state,
        model: updatedModel,
        patchHistory: [...state.patchHistory, patch],
        dirty: true,
      };
    }

    case RESET_PATCHES:
      return { ...state, patchHistory: [], dirty: false };

    default:
      return state;
  }
}
