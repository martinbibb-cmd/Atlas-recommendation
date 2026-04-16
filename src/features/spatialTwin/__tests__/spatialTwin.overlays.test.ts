import { describe, it, expect } from 'vitest';
import { roomHeatLossOverlay } from '../overlays/roomHeatLossOverlay';
import { emitterAdequacyOverlay } from '../overlays/emitterAdequacyOverlay';
import { pipeStressOverlay } from '../overlays/pipeStressOverlay';
import type { SpatialTwinFeatureState, SpatialTwinModelV1 } from '../state/spatialTwin.types';

function makeState(model: SpatialTwinModelV1 | null): SpatialTwinFeatureState {
  return {
    visitId: 'visit-1',
    model,
    patchHistory: [],
    selectedEntityId: null,
    hoveredEntityId: null,
    mode: 'current',
    viewDimension: '2d',
    activeLeftRailSection: 'house',
    activeOverlayIds: [],
    importState: model != null ? 'ready' : 'idle',
    dirty: false,
  };
}

function makeModelWithRooms(): SpatialTwinModelV1 {
  return {
    version: '1.0',
    propertyId: 'prop-1',
    spatial: {
      version: '1.0',
      propertyId: 'prop-1',
      rooms: [
        { roomId: 'room-1', label: 'Kitchen', status: 'complete', roomType: 'kitchen', zoneIds: ['zone-1'] },
        { roomId: 'room-2', label: 'Lounge', status: 'complete', roomType: 'living', zoneIds: ['zone-2'] },
      ],
      zones: [
        { zoneId: 'zone-1', roomId: 'room-1', label: 'Kitchen zone', emitterIds: ['em-1'], floorAreaM2: 12 },
        { zoneId: 'zone-2', roomId: 'room-2', label: 'Lounge zone', emitterIds: [], floorAreaM2: 22 },
      ],
      emitters: [
        { emitterId: 'em-1', roomId: 'room-1', type: 'radiator' },
      ],
      openings: [],
      boundaries: [],
    },
    heatSources: [],
    stores: [],
    controls: [],
    pipeRuns: [
      {
        pipeRunId: 'pipe-1',
        label: 'Main flow',
        diameterMm: 22,
        route: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        status: 'existing',
        certainty: 'probable',
        evidenceIds: [],
      },
      {
        pipeRunId: 'pipe-2',
        label: 'Small branch',
        diameterMm: 10,
        route: [{ x: 0, y: 0 }, { x: 50, y: 50 }],
        status: 'existing',
        certainty: 'inferred',
        evidenceIds: [],
      },
    ],
    evidenceMarkers: [],
  };
}

describe('spatialTwin.overlays', () => {
  describe('roomHeatLossOverlay', () => {
    it('isAvailable returns false when no rooms', () => {
      const state = makeState(null);
      expect(roomHeatLossOverlay.isAvailable(state)).toBe(false);
    });

    it('isAvailable returns true when rooms present', () => {
      const state = makeState(makeModelWithRooms());
      expect(roomHeatLossOverlay.isAvailable(state)).toBe(true);
    });

    it('returns entity colors for each room', () => {
      const state = makeState(makeModelWithRooms());
      const metadata = roomHeatLossOverlay.getMetadata(state);
      expect(metadata.entityColors['room-1']).toBeDefined();
      expect(metadata.entityColors['room-2']).toBeDefined();
    });
  });

  describe('emitterAdequacyOverlay', () => {
    it('returns metadata without error', () => {
      const state = makeState(makeModelWithRooms());
      const metadata = emitterAdequacyOverlay.getMetadata(state);
      expect(metadata.legendItems.length).toBeGreaterThan(0);
    });

    it('colors rooms with emitters as adequate', () => {
      const state = makeState(makeModelWithRooms());
      const metadata = emitterAdequacyOverlay.getMetadata(state);
      // room-1 has em-1 in zone-1
      expect(metadata.entityColors['room-1']).toBe('#86efac');
      // room-2 has no emitters
      expect(metadata.entityColors['room-2']).toBe('#fca5a5');
    });
  });

  describe('pipeStressOverlay', () => {
    it('obeys route data — adequate pipe gets green', () => {
      const state = makeState(makeModelWithRooms());
      const metadata = pipeStressOverlay.getMetadata(state);
      expect(metadata.entityColors['pipe-1']).toBe('#86efac'); // 22 mm
      expect(metadata.entityColors['pipe-2']).toBe('#fca5a5'); // 10 mm — undersized
    });

    it('unknown diameter gets amber', () => {
      const model = makeModelWithRooms();
      model.pipeRuns.push({
        pipeRunId: 'pipe-3',
        label: 'Unknown pipe',
        route: [{ x: 0, y: 0 }, { x: 20, y: 20 }],
        status: 'existing',
        certainty: 'unknown',
        evidenceIds: [],
      });
      const state = makeState(model);
      const metadata = pipeStressOverlay.getMetadata(state);
      expect(metadata.entityColors['pipe-3']).toBe('#fde68a');
    });
  });
});
