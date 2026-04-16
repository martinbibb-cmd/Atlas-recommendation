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
  SET_VIEW_DIMENSION,
  CREATE_SCENARIO,
  RENAME_SCENARIO,
  DUPLICATE_SCENARIO,
  DELETE_SCENARIO,
  SET_ACTIVE_SCENARIO,
  APPLY_SCENARIO_PATCH,
  SET_SCENARIO_RECOMMENDED,
  SET_SCENARIO_INCLUDE_IN_REPORT,
} from './spatialTwin.actions';
import { applyLocalSpatialPatch } from '../patches/applyLocalSpatialPatch';

export const initialSpatialTwinState: SpatialTwinFeatureState = {
  visitId: '',
  model: null,
  patchHistory: [],
  selectedEntityId: null,
  hoveredEntityId: null,
  mode: 'current',
  viewDimension: '2d',
  activeLeftRailSection: 'house',
  activeOverlayIds: [],
  importState: 'idle',
  dirty: false,
  scenarios: [],
  patchesByScenario: {},
  activeScenarioId: null,
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

    case SET_VIEW_DIMENSION:
      return { ...state, viewDimension: action.payload.viewDimension };

    // ── Scenario actions ─────────────────────────────────────────────────────

    case CREATE_SCENARIO: {
      const { scenarioId, name, intent, description, createdAt } = action.payload;
      const scenario = {
        scenarioId,
        name,
        intent,
        ...(description != null ? { description } : {}),
        patchIds: [],
        createdAt,
        updatedAt: createdAt,
        includeInReport: true,
      };
      return {
        ...state,
        scenarios: [...state.scenarios, scenario],
        patchesByScenario: { ...state.patchesByScenario, [scenarioId]: [] },
      };
    }

    case RENAME_SCENARIO: {
      const { scenarioId, name, updatedAt } = action.payload;
      return {
        ...state,
        scenarios: state.scenarios.map((s) =>
          s.scenarioId === scenarioId ? { ...s, name, updatedAt } : s,
        ),
      };
    }

    case DUPLICATE_SCENARIO: {
      const { sourceScenarioId, newScenarioId, name, createdAt } = action.payload;
      const source = state.scenarios.find((s) => s.scenarioId === sourceScenarioId);
      if (source == null) return state;
      const sourcePatches = state.patchesByScenario[sourceScenarioId] ?? [];
      const newScenario = {
        ...source,
        scenarioId: newScenarioId,
        name,
        patchIds: sourcePatches.map((p) => p.patchId),
        createdAt,
        updatedAt: createdAt,
        isRecommended: false,
        isSelectedByUser: false,
      };
      return {
        ...state,
        scenarios: [...state.scenarios, newScenario],
        patchesByScenario: {
          ...state.patchesByScenario,
          [newScenarioId]: sourcePatches.map((p) => ({ ...p })),
        },
      };
    }

    case DELETE_SCENARIO: {
      const { scenarioId } = action.payload;
      const nextPatchesByScenario = { ...state.patchesByScenario };
      delete nextPatchesByScenario[scenarioId];
      return {
        ...state,
        scenarios: state.scenarios.filter((s) => s.scenarioId !== scenarioId),
        patchesByScenario: nextPatchesByScenario,
        activeScenarioId:
          state.activeScenarioId === scenarioId ? null : state.activeScenarioId,
      };
    }

    case SET_ACTIVE_SCENARIO:
      return { ...state, activeScenarioId: action.payload.scenarioId };

    case APPLY_SCENARIO_PATCH: {
      const { scenarioId, patch } = action.payload;
      const existing = state.patchesByScenario[scenarioId] ?? [];
      const updatedPatches = [...existing, patch];
      const updatedScenarios = state.scenarios.map((s) =>
        s.scenarioId === scenarioId
          ? {
              ...s,
              patchIds: [...s.patchIds, patch.patchId],
              updatedAt: patch.appliedAt,
            }
          : s,
      );
      return {
        ...state,
        scenarios: updatedScenarios,
        patchesByScenario: { ...state.patchesByScenario, [scenarioId]: updatedPatches },
        dirty: true,
      };
    }

    case SET_SCENARIO_RECOMMENDED: {
      const { scenarioId, isRecommended } = action.payload;
      return {
        ...state,
        scenarios: state.scenarios.map((s) =>
          s.scenarioId === scenarioId ? { ...s, isRecommended } : s,
        ),
      };
    }

    case SET_SCENARIO_INCLUDE_IN_REPORT: {
      const { scenarioId, includeInReport } = action.payload;
      return {
        ...state,
        scenarios: state.scenarios.map((s) =>
          s.scenarioId === scenarioId ? { ...s, includeInReport } : s,
        ),
      };
    }

    default:
      return state;
  }
}
