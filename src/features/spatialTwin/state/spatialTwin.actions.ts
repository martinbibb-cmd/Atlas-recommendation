import type {
  SpatialTwinModelV1,
  SpatialTwinMode,
  SpatialTwinLeftRailSection,
  AtlasSpatialPatchV1,
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
  | ResetPatchesAction;

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
