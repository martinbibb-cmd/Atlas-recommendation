/**
 * sceneNodeSelectors.ts
 *
 * Pure lookup helpers for the SpatialTwinSceneGraph.
 * No side-effects; no mutation of the graph.
 */

import type { SpatialTwinSceneGraph, SpatialTwinSceneNode } from './sceneGraph.types';

/**
 * Find the scene node that carries the given canonical entity ID.
 * Returns the first match; entity IDs should be unique in the graph.
 */
export function getNodeByEntityId(
  graph: SpatialTwinSceneGraph,
  entityId: string,
): SpatialTwinSceneNode | null {
  return graph.nodes.find((n) => n.entityId === entityId) ?? null;
}

/**
 * Resolve the canonical entity ID from a scene node ID.
 * Returns null when the node is not found (fail-safe; never throws).
 */
export function getEntityIdFromSceneNodeId(
  graph: SpatialTwinSceneGraph,
  sceneNodeId: string,
): string | null {
  return graph.nodes.find((n) => n.sceneNodeId === sceneNodeId)?.entityId ?? null;
}

/**
 * Return all scene nodes that belong to the given branch.
 */
export function getNodesByBranch(
  graph: SpatialTwinSceneGraph,
  branch: SpatialTwinSceneNode['branch'],
): SpatialTwinSceneNode[] {
  return graph.nodes.filter((n) => n.branch === branch);
}

/**
 * Return all scene nodes of the given entity kind.
 */
export function getNodesByKind(
  graph: SpatialTwinSceneGraph,
  kind: SpatialTwinSceneNode['entityKind'],
): SpatialTwinSceneNode[] {
  return graph.nodes.filter((n) => n.entityKind === kind);
}
