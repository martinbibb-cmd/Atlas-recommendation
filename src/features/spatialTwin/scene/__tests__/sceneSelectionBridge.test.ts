import { describe, it, expect } from 'vitest';
import { selectSpatialTwinEntityFromSceneNode } from '../adapters/sceneSelectionBridge';
import type { SpatialTwinSceneGraph } from '../sceneGraph.types';

function makeGraph(): SpatialTwinSceneGraph {
  return {
    nodes: [
      {
        sceneNodeId: 'scene::room-1',
        entityId: 'room-1',
        entityKind: 'room',
        branch: 'shared',
        label: 'Lounge',
        geometry: {
          type: 'extrudedPolygon',
          points: [{ x: 0, y: 0 }, { x: 48, y: 0 }, { x: 48, y: 48 }, { x: 0, y: 48 }],
          height: 60,
        },
        appearance: { tone: 'neutral', selectable: true, visible: true },
      },
      {
        sceneNodeId: 'scene::hs-1',
        entityId: 'hs-1',
        entityKind: 'heatSource',
        branch: 'current',
        label: 'Combi Boiler',
        geometry: {
          type: 'box',
          width: 18,
          depth: 14.4,
          height: 28.8,
          position: { x: 240, y: 120, z: 0 },
        },
        appearance: { tone: 'neutral', selectable: true, visible: true },
      },
      {
        sceneNodeId: 'scene::pipe-1',
        entityId: 'pipe-1',
        entityKind: 'pipeRun',
        branch: 'current',
        label: 'Main flow',
        geometry: {
          type: 'polyline3d',
          points: [{ x: 0, y: 0, z: 7 }, { x: 100, y: 100, z: 7 }],
        },
        appearance: { tone: 'neutral', selectable: false, visible: true },
      },
    ],
    metadata: {
      mode: 'current',
      generatedAt: new Date().toISOString(),
      sourceModelId: 'prop-1',
      sourceRevision: 1,
    },
  };
}

describe('selectSpatialTwinEntityFromSceneNode', () => {
  it('returns canonical entityId for known sceneNodeId', () => {
    const graph = makeGraph();
    const entityId = selectSpatialTwinEntityFromSceneNode(graph, 'scene::room-1');
    expect(entityId).toBe('room-1');
  });

  it('returns canonical entityId for heat source node', () => {
    const graph = makeGraph();
    const entityId = selectSpatialTwinEntityFromSceneNode(graph, 'scene::hs-1');
    expect(entityId).toBe('hs-1');
  });

  it('returns null for unknown sceneNodeId', () => {
    const graph = makeGraph();
    const result = selectSpatialTwinEntityFromSceneNode(graph, 'scene::does-not-exist');
    expect(result).toBeNull();
  });

  it('returns null for non-selectable nodes', () => {
    const graph = makeGraph();
    // pipe-1 has selectable: false
    const result = selectSpatialTwinEntityFromSceneNode(graph, 'scene::pipe-1');
    expect(result).toBeNull();
  });

  it('does not throw when graph has no nodes', () => {
    const emptyGraph: SpatialTwinSceneGraph = {
      nodes: [],
      metadata: {
        mode: 'current',
        generatedAt: new Date().toISOString(),
        sourceModelId: 'prop-1',
        sourceRevision: 1,
      },
    };
    expect(() => selectSpatialTwinEntityFromSceneNode(emptyGraph, 'scene::anything')).not.toThrow();
    expect(selectSpatialTwinEntityFromSceneNode(emptyGraph, 'scene::anything')).toBeNull();
  });
});
