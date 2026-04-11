/**
 * atlasSpatialToAtlasPropertyPatch.test.ts
 */

import { describe, it, expect } from 'vitest';
import { atlasSpatialToAtlasPropertyPatch } from '../adapters/atlasSpatialToAtlasPropertyPatch';
import type { AtlasSpatialModelV1 } from '../../atlasSpatial/atlasSpatialModel.types';

// ─── Fixture ──────────────────────────────────────────────────────────────────

const MINIMAL_SPATIAL: AtlasSpatialModelV1 = {
  version: '1.0',
  propertyId: 'prop_123',
  rooms: [
    {
      roomId: 'room_lounge',
      label: 'Lounge',
      status: 'complete',
      roomType: 'living',
      zoneIds: ['zone_lounge'],
      geometry: {
        floorId: 'floor_gf',
        boundingBox: { x: 0, y: 0, width: 120, height: 96 },  // 5m × 4m at GRID=24
      },
    },
    {
      roomId: 'room_kitchen',
      label: 'Kitchen',
      status: 'complete',
      roomType: 'kitchen',
      zoneIds: ['zone_kitchen'],
      geometry: {
        floorId: 'floor_gf',
        boundingBox: { x: 120, y: 0, width: 96, height: 72 },  // 4m × 3m
      },
    },
  ],
  zones: [
    {
      zoneId: 'zone_lounge',
      roomId: 'room_lounge',
      label: 'Lounge',
      emitterIds: ['emitter_rad1'],
      designTempC: 21,
    },
    {
      zoneId: 'zone_kitchen',
      roomId: 'room_kitchen',
      label: 'Kitchen',
      emitterIds: [],
    },
  ],
  emitters: [
    {
      emitterId: 'emitter_rad1',
      roomId: 'room_lounge',
      type: 'radiator',
      outputWattsAtDt50: 1200,
      outputWattsAtDesign: 900,
    },
  ],
  openings: [
    {
      openingId: 'opening_win1',
      roomId: 'room_lounge',
      wallId: 'wall_ext_north',
      type: 'window',
      widthM: 1.2,
      heightM: 1.4,
    },
  ],
  boundaries: [
    {
      boundaryId: 'boundary_ext_north',
      kind: 'external',
      wallIds: ['wall_ext_north'],
    },
    {
      boundaryId: 'boundary_party',
      kind: 'party',
      wallIds: ['wall_party_east'],
    },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('atlasSpatialToAtlasPropertyPatch', () => {
  describe('rooms', () => {
    it('produces one RoomV1 per AtlasRoomV1', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      expect(patch.building?.rooms).toHaveLength(2);
    });

    it('maps room labels and IDs', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const lounge = patch.building?.rooms?.find(r => r.roomId === 'room_lounge');
      expect(lounge?.label).toBe('Lounge');
    });

    it('derives floorId from room geometry', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const lounge = patch.building?.rooms?.find(r => r.roomId === 'room_lounge');
      expect(lounge?.floorId).toBe('floor_gf');
    });

    it('calculates areaM2 from bounding box (5m × 4m = 20m²)', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const lounge = patch.building?.rooms?.find(r => r.roomId === 'room_lounge');
      // 120 × 96 canvas units ÷ 24 = 5m × 4m = 20m²
      expect(lounge?.areaM2?.value).toBeCloseTo(20, 2);
      expect(lounge?.areaM2?.source).toBe('scanned');
    });
  });

  describe('floors', () => {
    it('derives one FloorV1 per unique floorId in room geometry', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      expect(patch.building?.floors).toHaveLength(1);
      expect(patch.building?.floors?.[0]?.floorId).toBe('floor_gf');
    });

    it('falls back to default floor when no room geometry is present', () => {
      const spatial: AtlasSpatialModelV1 = {
        ...MINIMAL_SPATIAL,
        rooms: [
          { ...MINIMAL_SPATIAL.rooms[0]!, geometry: undefined },
        ],
      };
      const patch = atlasSpatialToAtlasPropertyPatch(spatial);
      expect(patch.building?.floors).toHaveLength(1);
      expect(patch.building?.floors?.[0]?.floorId).toBe('floor_0');
    });
  });

  describe('zones', () => {
    it('produces one ThermalZoneV1 per AtlasThermalZoneV1', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      expect(patch.building?.zones).toHaveLength(2);
    });

    it('links zone to parent room via roomIds array', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const zone = patch.building?.zones?.find(z => z.zoneId === 'zone_lounge');
      expect(zone?.roomIds).toEqual(['room_lounge']);
    });

    it('wraps designTempC in a FieldValue', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const zone = patch.building?.zones?.find(z => z.zoneId === 'zone_lounge');
      expect(zone?.designTempC?.value).toBe(21);
      expect(zone?.designTempC?.source).toBe('defaulted');
    });
  });

  describe('emitters', () => {
    it('maps radiator type to panel_radiator', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const emitter = patch.building?.emitters?.[0];
      expect(emitter?.type).toBe('panel_radiator');
    });

    it('wraps outputWattsAtDt50 in ratedOutputW FieldValue', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const emitter = patch.building?.emitters?.[0];
      expect(emitter?.ratedOutputW?.value).toBe(1200);
    });

    it('wraps outputWattsAtDesign in correctedOutputW with derived source', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const emitter = patch.building?.emitters?.[0];
      expect(emitter?.correctedOutputW?.value).toBe(900);
      expect(emitter?.correctedOutputW?.source).toBe('derived');
    });
  });

  describe('openings', () => {
    it('maps window type correctly', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const opening = patch.building?.openings?.[0];
      expect(opening?.type).toBe('window');
    });

    it('links opening to boundary via wall ID index', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const opening = patch.building?.openings?.[0];
      expect(opening?.boundaryId).toBe('boundary_ext_north');
    });

    it('wraps widthM in a FieldValue', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const opening = patch.building?.openings?.[0];
      expect(opening?.widthM?.value).toBe(1.2);
    });
  });

  describe('boundaries', () => {
    it('maps external boundary kind to external_wall type', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const boundary = patch.building?.boundaries?.find(b => b.boundaryId === 'boundary_ext_north');
      expect(boundary?.type).toBe('external_wall');
    });

    it('maps party boundary kind to party_wall type', () => {
      const patch = atlasSpatialToAtlasPropertyPatch(MINIMAL_SPATIAL);
      const boundary = patch.building?.boundaries?.find(b => b.boundaryId === 'boundary_party');
      expect(boundary?.type).toBe('party_wall');
    });
  });

  describe('empty spatial model', () => {
    it('produces empty arrays for all building sub-models', () => {
      const empty: AtlasSpatialModelV1 = {
        version: '1.0',
        propertyId: 'prop_empty',
        rooms: [],
        zones: [],
        emitters: [],
        openings: [],
        boundaries: [],
      };
      const patch = atlasSpatialToAtlasPropertyPatch(empty);
      expect(patch.building?.rooms).toHaveLength(0);
      expect(patch.building?.zones).toHaveLength(0);
      expect(patch.building?.emitters).toHaveLength(0);
    });
  });
});
