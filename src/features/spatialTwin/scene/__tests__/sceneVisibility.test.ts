import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SCENE_VISIBILITY,
  toggleVisibilityCategory,
  entityKindToVisibilityCategory,
} from '../sceneVisibility.types';
import { applyVisibilityFilters } from '../adapters/spatialTwinToSceneFilters';
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
        label: 'Boiler',
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
        appearance: { tone: 'neutral', selectable: true, visible: true },
      },
      {
        sceneNodeId: 'scene::ev-1',
        entityId: 'ev-1',
        entityKind: 'evidence',
        branch: 'shared',
        label: 'Photo',
        geometry: { type: 'billboard', position: { x: 20, y: 20, z: 0 }, icon: 'photo' },
        appearance: { tone: 'neutral', selectable: true, visible: true },
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

describe('sceneVisibility', () => {
  describe('DEFAULT_SCENE_VISIBILITY', () => {
    it('all categories default to true', () => {
      expect(DEFAULT_SCENE_VISIBILITY.rooms).toBe(true);
      expect(DEFAULT_SCENE_VISIBILITY.objects).toBe(true);
      expect(DEFAULT_SCENE_VISIBILITY.pipes).toBe(true);
      expect(DEFAULT_SCENE_VISIBILITY.evidence).toBe(true);
      expect(DEFAULT_SCENE_VISIBILITY.labels).toBe(true);
    });
  });

  describe('toggleVisibilityCategory', () => {
    it('toggles a category off', () => {
      const result = toggleVisibilityCategory(DEFAULT_SCENE_VISIBILITY, 'rooms');
      expect(result.rooms).toBe(false);
    });

    it('toggles a category back on', () => {
      const off = toggleVisibilityCategory(DEFAULT_SCENE_VISIBILITY, 'rooms');
      const on = toggleVisibilityCategory(off, 'rooms');
      expect(on.rooms).toBe(true);
    });

    it('does not mutate input', () => {
      const before = { ...DEFAULT_SCENE_VISIBILITY };
      toggleVisibilityCategory(DEFAULT_SCENE_VISIBILITY, 'pipes');
      expect(DEFAULT_SCENE_VISIBILITY.pipes).toBe(before.pipes);
    });
  });

  describe('entityKindToVisibilityCategory', () => {
    it('maps room → rooms', () => {
      expect(entityKindToVisibilityCategory('room')).toBe('rooms');
    });
    it('maps emitter → objects', () => {
      expect(entityKindToVisibilityCategory('emitter')).toBe('objects');
    });
    it('maps heatSource → objects', () => {
      expect(entityKindToVisibilityCategory('heatSource')).toBe('objects');
    });
    it('maps store → objects', () => {
      expect(entityKindToVisibilityCategory('store')).toBe('objects');
    });
    it('maps pipeRun → pipes', () => {
      expect(entityKindToVisibilityCategory('pipeRun')).toBe('pipes');
    });
    it('maps evidence → evidence', () => {
      expect(entityKindToVisibilityCategory('evidence')).toBe('evidence');
    });
    it('returns null for unknown kind', () => {
      expect(entityKindToVisibilityCategory('unknown_kind')).toBeNull();
    });
  });

  describe('applyVisibilityFilters', () => {
    it('hiding rooms sets room nodes to not visible', () => {
      const vis = { ...DEFAULT_SCENE_VISIBILITY, rooms: false };
      const result = applyVisibilityFilters(makeGraph(), vis);
      const roomNode = result.nodes.find((n) => n.entityKind === 'room');
      expect(roomNode?.appearance.visible).toBe(false);
    });

    it('hiding pipes sets pipe nodes to not visible', () => {
      const vis = { ...DEFAULT_SCENE_VISIBILITY, pipes: false };
      const result = applyVisibilityFilters(makeGraph(), vis);
      const pipeNode = result.nodes.find((n) => n.entityKind === 'pipeRun');
      expect(pipeNode?.appearance.visible).toBe(false);
    });

    it('hiding objects hides heat sources and emitters', () => {
      const vis = { ...DEFAULT_SCENE_VISIBILITY, objects: false };
      const result = applyVisibilityFilters(makeGraph(), vis);
      const objNode = result.nodes.find((n) => n.entityKind === 'heatSource');
      expect(objNode?.appearance.visible).toBe(false);
    });

    it('hiding labels clears node labels but keeps nodes visible', () => {
      const vis = { ...DEFAULT_SCENE_VISIBILITY, labels: false };
      const result = applyVisibilityFilters(makeGraph(), vis);
      const roomNode = result.nodes.find((n) => n.entityKind === 'room');
      expect(roomNode?.appearance.visible).toBe(true);
      expect(roomNode?.label).toBeUndefined();
    });

    it('hiding evidence hides evidence nodes only', () => {
      const vis = { ...DEFAULT_SCENE_VISIBILITY, evidence: false };
      const result = applyVisibilityFilters(makeGraph(), vis);
      const evNode = result.nodes.find((n) => n.entityKind === 'evidence');
      expect(evNode?.appearance.visible).toBe(false);
      // rooms should still be visible
      const roomNode = result.nodes.find((n) => n.entityKind === 'room');
      expect(roomNode?.appearance.visible).toBe(true);
    });

    it('does not mutate the source graph', () => {
      const graph = makeGraph();
      const vis = { ...DEFAULT_SCENE_VISIBILITY, rooms: false };
      applyVisibilityFilters(graph, vis);
      expect(graph.nodes[0]?.appearance.visible).toBe(true);
    });
  });
});
