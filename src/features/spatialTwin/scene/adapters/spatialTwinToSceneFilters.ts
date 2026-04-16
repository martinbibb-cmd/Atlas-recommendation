/**
 * spatialTwinToSceneFilters.ts
 *
 * Apply visibility category toggles to a SpatialTwinSceneGraph.
 *
 * Returns a NEW graph object; the source graph is never mutated.
 * Visibility state is a rendering concern — it does not affect canonical data.
 */

import type { SpatialTwinSceneGraph, SpatialTwinSceneNode } from '../sceneGraph.types';
import type { SceneVisibilityState } from '../sceneVisibility.types';
import { entityKindToVisibilityCategory } from '../sceneVisibility.types';

/**
 * Return a copy of the graph with node visibility set according to the
 * given SceneVisibilityState.
 *
 * Label visibility is handled separately: when `labels` is false the node
 * remains visible but its label is cleared.
 */
export function applyVisibilityFilters(
  graph: SpatialTwinSceneGraph,
  visibility: SceneVisibilityState,
): SpatialTwinSceneGraph {
  const nodes: SpatialTwinSceneNode[] = graph.nodes.map((node) => {
    const category = entityKindToVisibilityCategory(node.entityKind);
    const categoryVisible = category != null ? visibility[category] : true;

    return {
      ...node,
      label: visibility.labels ? node.label : undefined,
      appearance: {
        ...node.appearance,
        visible: categoryVisible,
      },
    };
  });

  return { ...graph, nodes };
}
