/**
 * sceneVisibility.types.ts
 *
 * Visibility toggle categories for the 3D dollhouse view.
 *
 * Toggling visibility NEVER mutates the canonical SpatialTwinModelV1.
 * It is a pure rendering concern that lives in the scene layer only.
 */

export type SceneVisibilityCategory =
  | 'rooms'
  | 'objects'
  | 'pipes'
  | 'evidence'
  | 'labels';

export type SceneVisibilityState = Record<SceneVisibilityCategory, boolean>;

export const DEFAULT_SCENE_VISIBILITY: SceneVisibilityState = {
  rooms: true,
  objects: true,
  pipes: true,
  evidence: true,
  labels: true,
};

/**
 * Return a new visibility state with the given category toggled.
 * Pure function — does not mutate the input.
 */
export function toggleVisibilityCategory(
  current: SceneVisibilityState,
  category: SceneVisibilityCategory,
): SceneVisibilityState {
  return { ...current, [category]: !current[category] };
}

/**
 * Map a scene entity kind to the visibility category it belongs to.
 */
export function entityKindToVisibilityCategory(
  kind: string,
): SceneVisibilityCategory | null {
  switch (kind) {
    case 'room':
      return 'rooms';
    case 'emitter':
    case 'heatSource':
    case 'store':
      return 'objects';
    case 'pipeRun':
      return 'pipes';
    case 'evidence':
      return 'evidence';
    default:
      return null;
  }
}
