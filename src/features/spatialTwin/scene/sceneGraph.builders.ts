/**
 * sceneGraph.builders.ts
 *
 * Low-level geometry helpers for building SpatialTwinSceneNode instances.
 *
 * Rules:
 * - Pure functions; no side-effects.
 * - Every node must carry a canonical entityId.
 * - No physics or recommendation logic here.
 */

import type {
  SpatialTwinSceneNode,
  SceneNodeGeometry,
  SceneNodeTone,
  SceneNodeBranch,
  SceneEntityKind,
  Vec3,
} from './sceneGraph.types';

// ─── Canvas constants ─────────────────────────────────────────────────────────

/** Canvas units per metre (matches FloorPlanBuilder GRID). */
export const GRID = 24;

/** Default room extrusion height: 2.5 m in canvas units. */
export const DEFAULT_ROOM_HEIGHT = 2.5 * GRID; // 60 units

/** Default pipe elevation above floor: 0.3 m in canvas units. */
export const DEFAULT_PIPE_ELEVATION = 0.3 * GRID; // ~7 units

// ─── Scene node ID helpers ────────────────────────────────────────────────────

/**
 * Build a stable, unique scene node ID from an entity ID and optional suffix.
 * The suffix allows multiple nodes from the same entity in compare mode.
 */
export function makeSceneNodeId(entityId: string, suffix = ''): string {
  return suffix.length > 0 ? `${entityId}::${suffix}` : `scene::${entityId}`;
}

// ─── Node factory helpers ─────────────────────────────────────────────────────

interface NodeFactoryInput {
  entityId: string;
  entityKind: SceneEntityKind;
  branch: SceneNodeBranch;
  tone: SceneNodeTone;
  label?: string;
  geometry: SceneNodeGeometry;
  dashed?: boolean;
  selectable?: boolean;
  certainty?: string;
  status?: string;
}

export function makeNode(input: NodeFactoryInput): SpatialTwinSceneNode {
  return {
    sceneNodeId: makeSceneNodeId(input.entityId, input.branch === 'shared' ? '' : input.branch),
    entityId: input.entityId,
    entityKind: input.entityKind,
    branch: input.branch,
    label: input.label,
    geometry: input.geometry,
    appearance: {
      tone: input.tone,
      dashed: input.dashed ?? false,
      selectable: input.selectable ?? true,
      visible: true,
    },
    debug:
      input.certainty != null || input.status != null
        ? { certainty: input.certainty, status: input.status }
        : undefined,
  };
}

// ─── Bounding box → extruded polygon ─────────────────────────────────────────

/**
 * Convert an axis-aligned bounding box to an extruded-polygon geometry.
 * The four corners are listed counter-clockwise from top-left.
 */
export function boundingBoxToExtrudedPolygon(
  box: { x: number; y: number; width: number; height: number },
  heightUnits: number,
): Extract<SceneNodeGeometry, { type: 'extrudedPolygon' }> {
  const { x, y, width, height } = box;
  return {
    type: 'extrudedPolygon',
    points: [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ],
    height: heightUnits,
  };
}

// ─── Centroid helper ──────────────────────────────────────────────────────────

/** Return the centroid of an axis-aligned bounding box as a Vec3 at ground level. */
export function boundingBoxCentroid(
  box: { x: number; y: number; width: number; height: number },
  z = 0,
): Vec3 {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, z };
}
