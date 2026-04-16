import { describe, it, expect } from 'vitest';
import { buildSceneGraphFromSpatialTwin } from '../buildSceneGraphFromSpatialTwin';
import type { SpatialTwinModelV1 } from '../../state/spatialTwin.types';

function makeModel(): SpatialTwinModelV1 {
  return {
    version: '1.0',
    propertyId: 'prop-1',
    spatial: {
      version: '1.0',
      propertyId: 'prop-1',
      rooms: [
        {
          roomId: 'room-1',
          label: 'Lounge',
          status: 'complete',
          roomType: 'living',
          zoneIds: ['zone-1'],
          geometry: {
            floorId: 'floor-1',
            boundingBox: { x: 0, y: 0, width: 96, height: 72 },
          },
        },
        {
          roomId: 'room-2',
          label: 'Kitchen',
          status: 'complete',
          roomType: 'kitchen',
          zoneIds: ['zone-2'],
        },
      ],
      zones: [
        { zoneId: 'zone-1', roomId: 'room-1', label: 'Lounge zone', emitterIds: ['em-1'] },
        { zoneId: 'zone-2', roomId: 'room-2', label: 'Kitchen zone', emitterIds: [] },
      ],
      emitters: [
        { emitterId: 'em-1', roomId: 'room-1', type: 'radiator' },
      ],
      openings: [],
      boundaries: [],
    },
    heatSources: [
      { heatSourceId: 'hs-1', label: 'Combi Boiler', type: 'combi_boiler', status: 'existing', certainty: 'confirmed', evidenceIds: [] },
      { heatSourceId: 'hs-2', label: 'New Heat Pump', type: 'heat_pump', status: 'proposed', certainty: 'confirmed', evidenceIds: [] },
    ],
    stores: [
      { storeId: 'store-1', label: 'Hot Water Cylinder', type: 'cylinder', status: 'existing', certainty: 'confirmed', evidenceIds: [] },
    ],
    controls: [],
    pipeRuns: [
      {
        pipeRunId: 'pipe-1',
        label: 'Flow main',
        diameterMm: 22,
        route: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        status: 'existing',
        certainty: 'confirmed',
        evidenceIds: [],
      },
    ],
    evidenceMarkers: [
      {
        evidenceId: 'ev-1',
        kind: 'photo',
        label: 'Boiler photo',
        position: { x: 50, y: 50 },
      },
    ],
  };
}

describe('buildSceneGraphFromSpatialTwin', () => {
  it('produces deterministic output from the same input', () => {
    const model = makeModel();
    const g1 = buildSceneGraphFromSpatialTwin(model, 'current');
    const g2 = buildSceneGraphFromSpatialTwin(model, 'current');
    expect(g1.nodes.map((n) => n.sceneNodeId)).toEqual(g2.nodes.map((n) => n.sceneNodeId));
    expect(g1.metadata.sourceModelId).toBe(g2.metadata.sourceModelId);
  });

  it('preserves source model id in metadata', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'current');
    expect(graph.metadata.sourceModelId).toBe('prop-1');
  });

  it('preserves source revision in metadata', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'current');
    expect(graph.metadata.sourceRevision).toBe(1);
  });

  it('all scene nodes have canonical entityIds', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'current');
    for (const node of graph.nodes) {
      expect(node.entityId).toBeTruthy();
    }
  });

  it('includes room nodes', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'current');
    const roomNodes = graph.nodes.filter((n) => n.entityKind === 'room');
    expect(roomNodes).toHaveLength(2);
    expect(roomNodes.some((n) => n.entityId === 'room-1')).toBe(true);
  });

  it('includes emitter nodes', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'current');
    const emitterNodes = graph.nodes.filter((n) => n.entityKind === 'emitter');
    expect(emitterNodes).toHaveLength(1);
    expect(emitterNodes[0]?.entityId).toBe('em-1');
  });

  it('includes evidence marker nodes', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'current');
    const evNodes = graph.nodes.filter((n) => n.entityKind === 'evidence');
    expect(evNodes).toHaveLength(1);
    expect(evNodes[0]?.entityId).toBe('ev-1');
  });

  it('current mode excludes proposed heat source', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'current');
    const hsNodes = graph.nodes.filter((n) => n.entityKind === 'heatSource');
    const ids = hsNodes.map((n) => n.entityId);
    expect(ids).toContain('hs-1');
    expect(ids).not.toContain('hs-2');
  });

  it('proposed mode includes proposed heat source', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'proposed');
    const hsNodes = graph.nodes.filter((n) => n.entityKind === 'heatSource');
    const ids = hsNodes.map((n) => n.entityId);
    expect(ids).toContain('hs-2');
  });

  it('compare mode includes all heat sources', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'compare');
    const hsNodes = graph.nodes.filter((n) => n.entityKind === 'heatSource');
    const ids = hsNodes.map((n) => n.entityId);
    expect(ids).toContain('hs-1');
    expect(ids).toContain('hs-2');
  });

  it('does not mutate the source model', () => {
    const model = makeModel();
    const original = JSON.stringify(model);
    buildSceneGraphFromSpatialTwin(model, 'compare');
    expect(JSON.stringify(model)).toBe(original);
  });

  it('omitEvidence option excludes evidence nodes', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'current', { omitEvidence: true });
    const evNodes = graph.nodes.filter((n) => n.entityKind === 'evidence');
    expect(evNodes).toHaveLength(0);
  });

  it('omitPipes option excludes pipe nodes', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'current', { omitPipes: true });
    const pipeNodes = graph.nodes.filter((n) => n.entityKind === 'pipeRun');
    expect(pipeNodes).toHaveLength(0);
  });

  it('room with bounding box gets extrudedPolygon geometry', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'current');
    const lounge = graph.nodes.find((n) => n.entityId === 'room-1');
    expect(lounge?.geometry.type).toBe('extrudedPolygon');
  });

  it('metadata.generatedAt is an ISO string', () => {
    const graph = buildSceneGraphFromSpatialTwin(makeModel(), 'current');
    expect(() => new Date(graph.metadata.generatedAt)).not.toThrow();
    expect(new Date(graph.metadata.generatedAt).toISOString()).toBe(graph.metadata.generatedAt);
  });
});
