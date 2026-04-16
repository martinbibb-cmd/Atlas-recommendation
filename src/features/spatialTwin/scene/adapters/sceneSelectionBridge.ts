/**
 * sceneSelectionBridge.ts
 *
 * Bridges 3D scene hit-testing back to canonical entity IDs in the
 * Spatial Twin store.
 *
 * Rules:
 *  - 3D selection must update the same selectedEntityId used by the inspector.
 *  - No duplicate selection models.
 *  - No renderer-owned engineering state.
 *  - Unknown sceneNodeId fails safely (returns null, never throws).
 */

import type { SpatialTwinSceneGraph } from '../sceneGraph.types';
import { getEntityIdFromSceneNodeId } from '../sceneNodeSelectors';

/**
 * Resolve the canonical entity ID from a 3D scene node ID.
 *
 * Call this inside a click handler on the 3D canvas, then dispatch the
 * resulting entityId to selectEntity() in the Spatial Twin store — the same
 * action used by the 2D canvas.
 *
 * Returns null when:
 *  - the scene graph has no node with the given sceneNodeId
 *  - the node is not selectable (handled upstream; kept defensive here)
 */
export function selectSpatialTwinEntityFromSceneNode(
  graph: SpatialTwinSceneGraph,
  sceneNodeId: string,
): string | null {
  const node = graph.nodes.find((n) => n.sceneNodeId === sceneNodeId);
  if (node == null) return null;
  if (!node.appearance.selectable) return null;
  return getEntityIdFromSceneNodeId(graph, sceneNodeId);
}
