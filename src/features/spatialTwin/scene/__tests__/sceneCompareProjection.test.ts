import { describe, it, expect } from 'vitest';
import { buildSceneGraphFromSpatialTwin } from '../buildSceneGraphFromSpatialTwin';
import type { SpatialTwinModelV1 } from '../../state/spatialTwin.types';

function makeCompareModel(): SpatialTwinModelV1 {
  return {
    version: '1.0',
    propertyId: 'prop-compare',
    spatial: {
      version: '1.0',
      propertyId: 'prop-compare',
      rooms: [
        {
          roomId: 'room-1',
          label: 'Lounge',
          status: 'complete',
          roomType: 'living',
          zoneIds: [],
        },
      ],
      zones: [],
      emitters: [],
      openings: [],
      boundaries: [],
    },
    heatSources: [
      { heatSourceId: 'hs-existing', label: 'Old Combi', type: 'combi_boiler', status: 'existing', certainty: 'confirmed', evidenceIds: [] },
      { heatSourceId: 'hs-removed', label: 'Back Boiler', type: 'back_boiler', status: 'removed', certainty: 'confirmed', evidenceIds: [] },
      { heatSourceId: 'hs-proposed', label: 'New Heat Pump', type: 'heat_pump', status: 'proposed', certainty: 'confirmed', evidenceIds: [] },
    ],
    stores: [
      { storeId: 'store-new', label: 'New Cylinder', type: 'cylinder', status: 'proposed', certainty: 'confirmed', evidenceIds: [] },
    ],
    controls: [],
    pipeRuns: [
      { pipeRunId: 'pipe-existing', label: 'Existing pipe', diameterMm: 22, route: [{ x: 0, y: 0 }, { x: 50, y: 50 }], status: 'existing', certainty: 'confirmed', evidenceIds: [] },
      { pipeRunId: 'pipe-proposed', label: 'New pipe run', diameterMm: 22, route: [{ x: 50, y: 50 }, { x: 100, y: 100 }], status: 'proposed', certainty: 'confirmed', evidenceIds: [] },
    ],
    evidenceMarkers: [],
  };
}

describe('sceneCompareProjection', () => {
  describe('current mode', () => {
    it('shows existing heat source', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'current');
      const ids = g.nodes.filter((n) => n.entityKind === 'heatSource').map((n) => n.entityId);
      expect(ids).toContain('hs-existing');
    });

    it('does not show proposed heat source in current mode', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'current');
      const ids = g.nodes.filter((n) => n.entityKind === 'heatSource').map((n) => n.entityId);
      expect(ids).not.toContain('hs-proposed');
    });

    it('does not show removed entity in current mode', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'current');
      const ids = g.nodes.filter((n) => n.entityKind === 'heatSource').map((n) => n.entityId);
      expect(ids).not.toContain('hs-removed');
    });

    it('shows existing pipe run in current mode', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'current');
      const ids = g.nodes.filter((n) => n.entityKind === 'pipeRun').map((n) => n.entityId);
      expect(ids).toContain('pipe-existing');
    });
  });

  describe('proposed mode', () => {
    it('shows proposed heat source', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'proposed');
      const ids = g.nodes.filter((n) => n.entityKind === 'heatSource').map((n) => n.entityId);
      expect(ids).toContain('hs-proposed');
    });

    it('does not show removed entity in proposed mode', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'proposed');
      const ids = g.nodes.filter((n) => n.entityKind === 'heatSource').map((n) => n.entityId);
      expect(ids).not.toContain('hs-removed');
    });

    it('shows proposed store', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'proposed');
      const ids = g.nodes.filter((n) => n.entityKind === 'store').map((n) => n.entityId);
      expect(ids).toContain('store-new');
    });

    it('shows proposed pipe run', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'proposed');
      const ids = g.nodes.filter((n) => n.entityKind === 'pipeRun').map((n) => n.entityId);
      expect(ids).toContain('pipe-proposed');
    });
  });

  describe('compare mode', () => {
    it('includes all heat sources including removed', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'compare');
      const ids = g.nodes.filter((n) => n.entityKind === 'heatSource').map((n) => n.entityId);
      expect(ids).toContain('hs-existing');
      expect(ids).toContain('hs-removed');
      expect(ids).toContain('hs-proposed');
    });

    it('proposed entity gets proposed tone', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'compare');
      const proposed = g.nodes.find((n) => n.entityId === 'hs-proposed');
      expect(proposed?.appearance.tone).toBe('proposed');
    });

    it('removed entity gets ghost tone in compare mode', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'compare');
      const removed = g.nodes.find((n) => n.entityId === 'hs-removed');
      expect(removed?.appearance.tone).toBe('ghost');
    });

    it('proposed entity gets proposed branch', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'compare');
      const proposed = g.nodes.find((n) => n.entityId === 'hs-proposed');
      expect(proposed?.branch).toBe('proposed');
    });

    it('removed entity gets current branch', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'compare');
      const removed = g.nodes.find((n) => n.entityId === 'hs-removed');
      expect(removed?.branch).toBe('current');
    });

    it('proposed pipe run is dashed in compare mode', () => {
      const g = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'compare');
      const pipe = g.nodes.find((n) => n.entityId === 'pipe-proposed');
      expect(pipe?.appearance.dashed).toBe(true);
    });

    it('rooms are always shared across all modes', () => {
      const current = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'current');
      const proposed = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'proposed');
      const compare = buildSceneGraphFromSpatialTwin(makeCompareModel(), 'compare');
      for (const g of [current, proposed, compare]) {
        const roomNodes = g.nodes.filter((n) => n.entityKind === 'room');
        for (const node of roomNodes) {
          expect(node.branch).toBe('shared');
        }
      }
    });

    it('stable projection on same input', () => {
      const model = makeCompareModel();
      const g1 = buildSceneGraphFromSpatialTwin(model, 'compare');
      const g2 = buildSceneGraphFromSpatialTwin(model, 'compare');
      expect(g1.nodes.map((n) => n.sceneNodeId)).toEqual(g2.nodes.map((n) => n.sceneNodeId));
    });
  });
});
