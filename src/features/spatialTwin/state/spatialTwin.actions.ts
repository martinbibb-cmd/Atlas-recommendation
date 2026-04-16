import type {
  SpatialTwinModelV1,
  SpatialTwinMode,
  SpatialTwinLeftRailSection,
  AtlasSpatialPatchV1,
  SpatialTwinViewDimension,
  ScenarioIntent,
} from './spatialTwin.types';

// ─── Action type constants ───────────────────────────────────────────────────

export const INIT_TWIN = 'spatialTwin/INIT_TWIN' as const;
export const IMPORT_STARTED = 'spatialTwin/IMPORT_STARTED' as const;
export const IMPORT_SUCCEEDED = 'spatialTwin/IMPORT_SUCCEEDED' as const;
export const IMPORT_FAILED = 'spatialTwin/IMPORT_FAILED' as const;
export const SELECT_ENTITY = 'spatialTwin/SELECT_ENTITY' as const;
export const HOVER_ENTITY = 'spatialTwin/HOVER_ENTITY' as const;
export const DESELECT_ENTITY = 'spatialTwin/DESELECT_ENTITY' as const;
export const SET_MODE = 'spatialTwin/SET_MODE' as const;
export const SET_LEFT_RAIL_SECTION = 'spatialTwin/SET_LEFT_RAIL_SECTION' as const;
export const TOGGLE_OVERLAY = 'spatialTwin/TOGGLE_OVERLAY' as const;
export const APPLY_PATCH = 'spatialTwin/APPLY_PATCH' as const;
export const RESET_PATCHES = 'spatialTwin/RESET_PATCHES' as const;
export const SET_VIEW_DIMENSION = 'spatialTwin/SET_VIEW_DIMENSION' as const;

// ─── Scenario action type constants ──────────────────────────────────────────

export const CREATE_SCENARIO = 'spatialTwin/CREATE_SCENARIO' as const;
export const RENAME_SCENARIO = 'spatialTwin/RENAME_SCENARIO' as const;
export const DUPLICATE_SCENARIO = 'spatialTwin/DUPLICATE_SCENARIO' as const;
export const DELETE_SCENARIO = 'spatialTwin/DELETE_SCENARIO' as const;
export const SET_ACTIVE_SCENARIO = 'spatialTwin/SET_ACTIVE_SCENARIO' as const;
export const APPLY_SCENARIO_PATCH = 'spatialTwin/APPLY_SCENARIO_PATCH' as const;
export const SET_SCENARIO_RECOMMENDED = 'spatialTwin/SET_SCENARIO_RECOMMENDED' as const;
export const SET_SCENARIO_INCLUDE_IN_REPORT = 'spatialTwin/SET_SCENARIO_INCLUDE_IN_REPORT' as const;

// ─── Action interfaces ───────────────────────────────────────────────────────

export interface InitTwinAction {
  type: typeof INIT_TWIN;
  payload: { visitId: string };
}

export interface ImportStartedAction {
  type: typeof IMPORT_STARTED;
}

export interface ImportSucceededAction {
  type: typeof IMPORT_SUCCEEDED;
  payload: { model: SpatialTwinModelV1 };
}

export interface ImportFailedAction {
  type: typeof IMPORT_FAILED;
  payload: { error: string };
}

export interface SelectEntityAction {
  type: typeof SELECT_ENTITY;
  payload: { entityId: string };
}

export interface HoverEntityAction {
  type: typeof HOVER_ENTITY;
  payload: { entityId: string | null };
}

export interface DeselectEntityAction {
  type: typeof DESELECT_ENTITY;
}

export interface SetModeAction {
  type: typeof SET_MODE;
  payload: { mode: SpatialTwinMode };
}

export interface SetLeftRailSectionAction {
  type: typeof SET_LEFT_RAIL_SECTION;
  payload: { section: SpatialTwinLeftRailSection };
}

export interface ToggleOverlayAction {
  type: typeof TOGGLE_OVERLAY;
  payload: { overlayId: string };
}

export interface ApplyPatchAction {
  type: typeof APPLY_PATCH;
  payload: { patch: AtlasSpatialPatchV1 };
}

export interface ResetPatchesAction {
  type: typeof RESET_PATCHES;
}

export interface SetViewDimensionAction {
  type: typeof SET_VIEW_DIMENSION;
  payload: { viewDimension: SpatialTwinViewDimension };
}

export type SpatialTwinAction =
  | InitTwinAction
  | ImportStartedAction
  | ImportSucceededAction
  | ImportFailedAction
  | SelectEntityAction
  | HoverEntityAction
  | DeselectEntityAction
  | SetModeAction
  | SetLeftRailSectionAction
  | ToggleOverlayAction
  | ApplyPatchAction
  | ResetPatchesAction
  | SetViewDimensionAction
  | CreateScenarioAction
  | RenameScenarioAction
  | DuplicateScenarioAction
  | DeleteScenarioAction
  | SetActiveScenarioAction
  | ApplyScenarioPatchAction
  | SetScenarioRecommendedAction
  | SetScenarioIncludeInReportAction;

// ─── Scenario action interfaces ───────────────────────────────────────────────

export interface CreateScenarioAction {
  type: typeof CREATE_SCENARIO;
  payload: {
    scenarioId: string;
    name: string;
    intent: ScenarioIntent;
    description?: string;
    createdAt: string;
  };
}

export interface RenameScenarioAction {
  type: typeof RENAME_SCENARIO;
  payload: { scenarioId: string; name: string; updatedAt: string };
}

export interface DuplicateScenarioAction {
  type: typeof DUPLICATE_SCENARIO;
  payload: {
    sourceScenarioId: string;
    newScenarioId: string;
    name: string;
    createdAt: string;
  };
}

export interface DeleteScenarioAction {
  type: typeof DELETE_SCENARIO;
  payload: { scenarioId: string };
}

export interface SetActiveScenarioAction {
  type: typeof SET_ACTIVE_SCENARIO;
  payload: { scenarioId: string | null };
}

export interface ApplyScenarioPatchAction {
  type: typeof APPLY_SCENARIO_PATCH;
  payload: { scenarioId: string; patch: AtlasSpatialPatchV1 };
}

export interface SetScenarioRecommendedAction {
  type: typeof SET_SCENARIO_RECOMMENDED;
  payload: { scenarioId: string; isRecommended: boolean };
}

export interface SetScenarioIncludeInReportAction {
  type: typeof SET_SCENARIO_INCLUDE_IN_REPORT;
  payload: { scenarioId: string; includeInReport: boolean };
}

// ─── Scenario action creators ─────────────────────────────────────────────────

export const createScenario = (
  scenarioId: string,
  name: string,
  intent: ScenarioIntent,
  description?: string,
): CreateScenarioAction => ({
  type: CREATE_SCENARIO,
  payload: { scenarioId, name, intent, description, createdAt: new Date().toISOString() },
});

export const renameScenario = (
  scenarioId: string,
  name: string,
): RenameScenarioAction => ({
  type: RENAME_SCENARIO,
  payload: { scenarioId, name, updatedAt: new Date().toISOString() },
});

export const duplicateScenario = (
  sourceScenarioId: string,
  newScenarioId: string,
  name: string,
): DuplicateScenarioAction => ({
  type: DUPLICATE_SCENARIO,
  payload: { sourceScenarioId, newScenarioId, name, createdAt: new Date().toISOString() },
});

export const deleteScenario = (scenarioId: string): DeleteScenarioAction => ({
  type: DELETE_SCENARIO,
  payload: { scenarioId },
});

export const setActiveScenario = (scenarioId: string | null): SetActiveScenarioAction => ({
  type: SET_ACTIVE_SCENARIO,
  payload: { scenarioId },
});

export const applyScenarioPatch = (
  scenarioId: string,
  patch: AtlasSpatialPatchV1,
): ApplyScenarioPatchAction => ({
  type: APPLY_SCENARIO_PATCH,
  payload: { scenarioId, patch },
});

export const setScenarioRecommended = (
  scenarioId: string,
  isRecommended: boolean,
): SetScenarioRecommendedAction => ({
  type: SET_SCENARIO_RECOMMENDED,
  payload: { scenarioId, isRecommended },
});

export const setScenarioIncludeInReport = (
  scenarioId: string,
  includeInReport: boolean,
): SetScenarioIncludeInReportAction => ({
  type: SET_SCENARIO_INCLUDE_IN_REPORT,
  payload: { scenarioId, includeInReport },
});

// ─── Action creators ─────────────────────────────────────────────────────────

export const initTwin = (visitId: string): InitTwinAction => ({
  type: INIT_TWIN,
  payload: { visitId },
});

export const importStarted = (): ImportStartedAction => ({
  type: IMPORT_STARTED,
});

export const importSucceeded = (model: SpatialTwinModelV1): ImportSucceededAction => ({
  type: IMPORT_SUCCEEDED,
  payload: { model },
});

export const importFailed = (error: string): ImportFailedAction => ({
  type: IMPORT_FAILED,
  payload: { error },
});

export const selectEntity = (entityId: string): SelectEntityAction => ({
  type: SELECT_ENTITY,
  payload: { entityId },
});

export const hoverEntity = (entityId: string | null): HoverEntityAction => ({
  type: HOVER_ENTITY,
  payload: { entityId },
});

export const deselectEntity = (): DeselectEntityAction => ({
  type: DESELECT_ENTITY,
});

export const setMode = (mode: SpatialTwinMode): SetModeAction => ({
  type: SET_MODE,
  payload: { mode },
});

export const setLeftRailSection = (
  section: SpatialTwinLeftRailSection,
): SetLeftRailSectionAction => ({
  type: SET_LEFT_RAIL_SECTION,
  payload: { section },
});

export const toggleOverlay = (overlayId: string): ToggleOverlayAction => ({
  type: TOGGLE_OVERLAY,
  payload: { overlayId },
});

export const applyPatch = (patch: AtlasSpatialPatchV1): ApplyPatchAction => ({
  type: APPLY_PATCH,
  payload: { patch },
});

export const resetPatches = (): ResetPatchesAction => ({
  type: RESET_PATCHES,
});

export const setViewDimension = (viewDimension: SpatialTwinViewDimension): SetViewDimensionAction => ({
  type: SET_VIEW_DIMENSION,
  payload: { viewDimension },
});
