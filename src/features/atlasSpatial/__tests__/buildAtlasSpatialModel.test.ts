import { describe, expect, it } from 'vitest';
import { buildAtlasSpatialModel } from '../buildAtlasSpatialModel';
import type { PropertyPlan } from '../../../components/floorplan/propertyPlan.types';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makePlan(overrides: Partial<PropertyPlan> = {}): PropertyPlan {
  return {
    version: '1.0',
    propertyId: 'prop-1',
    floors: [],
    placementNodes: [],
    connections: [],
    metadata: {},
    ...overrides,
  };
}

function makeFloor(id: string, rooms = [], walls = [], openings = []) {
  return { id, name: `Floor ${id}`, levelIndex: 0, rooms, walls, openings, zones: [] };
}

function makeRoom(id: string, overrides = {}) {
  return {
    id,
    name: 'Lounge',
    roomType: 'living' as const,
    floorId: 'floor-1',
    x: 0,
    y: 0,
    width: 96,   // 4 m at GRID=24
    height: 120, // 5 m at GRID=24
    ...overrides,
  };
}

function makeWall(id: string, kind: 'external' | 'internal' = 'external') {
  return { id, floorId: 'floor-1', kind, x1: 0, y1: 0, x2: 96, y2: 0 };
}

function makeOpening(id: string, wallId: string, type: 'door' | 'window' = 'window') {
  return { id, floorId: 'floor-1', type, wallId, offsetM: 0.5, widthM: 1.2 };
}

function makeNode(id: string, type: string, roomId: string, emitterOutputKw?: number) {
  return {
    id,
    type: type as any,
    floorId: 'floor-1',
    roomId,
    anchor: { x: 50, y: 50 },
    metadata: {},
    ...(emitterOutputKw !== undefined ? { emitterOutputKw } : {}),
  };
}

// ─── Basic structure ──────────────────────────────────────────────────────────

describe('buildAtlasSpatialModel — basic structure', () => {
  it('returns version 1.0 and the supplied propertyId', () => {
    const result = buildAtlasSpatialModel(makePlan(), 'prop-abc');
    expect(result.version).toBe('1.0');
    expect(result.propertyId).toBe('prop-abc');
  });

  it('includes sourceSessionId when provided', () => {
    const result = buildAtlasSpatialModel(makePlan(), 'prop-1', 'session-xyz');
    expect(result.sourceSessionId).toBe('session-xyz');
  });

  it('omits sourceSessionId when not provided', () => {
    const result = buildAtlasSpatialModel(makePlan(), 'prop-1');
    expect(result.sourceSessionId).toBeUndefined();
  });

  it('returns empty collections for an empty plan', () => {
    const result = buildAtlasSpatialModel(makePlan(), 'prop-1');
    expect(result.rooms).toHaveLength(0);
    expect(result.zones).toHaveLength(0);
    expect(result.emitters).toHaveLength(0);
    expect(result.openings).toHaveLength(0);
    expect(result.boundaries).toHaveLength(0);
  });
});

// ─── Rooms ────────────────────────────────────────────────────────────────────

describe('buildAtlasSpatialModel — rooms', () => {
  it('creates one AtlasRoomV1 per heated room', () => {
    const plan = makePlan({
      floors: [
        makeFloor('floor-1', [makeRoom('r1'), makeRoom('r2', { name: 'Kitchen', roomType: 'kitchen' })]),
      ],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.rooms).toHaveLength(2);
    expect(result.rooms.map((r) => r.roomId)).toEqual(['r1', 'r2']);
  });

  it('excludes outside-typed rooms', () => {
    const plan = makePlan({
      floors: [
        makeFloor('floor-1', [
          makeRoom('r1'),
          makeRoom('r2', { roomType: 'outside', name: 'Garden' }),
        ]),
      ],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0].roomId).toBe('r1');
  });

  it('sets room status to draft', () => {
    const plan = makePlan({ floors: [makeFloor('floor-1', [makeRoom('r1')])] });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.rooms[0].status).toBe('draft');
  });

  it('carries the room label from the source Room name', () => {
    const plan = makePlan({ floors: [makeFloor('floor-1', [makeRoom('r1', { name: 'Master Bedroom' })])] });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.rooms[0].label).toBe('Master Bedroom');
  });

  it('carries the roomType from the source Room', () => {
    const plan = makePlan({ floors: [makeFloor('floor-1', [makeRoom('r1', { roomType: 'bathroom' })])] });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.rooms[0].roomType).toBe('bathroom');
  });

  it('attaches geometry bounding box from canvas coordinates', () => {
    const room = makeRoom('r1', { x: 24, y: 48, width: 96, height: 120 });
    const plan = makePlan({ floors: [makeFloor('floor-1', [room])] });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.rooms[0].geometry?.boundingBox).toEqual({ x: 24, y: 48, width: 96, height: 120 });
    expect(result.rooms[0].geometry?.floorId).toBe('floor-1');
  });
});

// ─── Thermal zones ────────────────────────────────────────────────────────────

describe('buildAtlasSpatialModel — thermal zones', () => {
  it('creates one default zone per heated room', () => {
    const plan = makePlan({
      floors: [makeFloor('floor-1', [makeRoom('r1'), makeRoom('r2', { name: 'Kitchen' })])],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.zones).toHaveLength(2);
  });

  it('zone roomId matches the parent room', () => {
    const plan = makePlan({ floors: [makeFloor('floor-1', [makeRoom('r1')])] });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.zones[0].roomId).toBe('r1');
  });

  it("zone label matches the room's name", () => {
    const plan = makePlan({ floors: [makeFloor('floor-1', [makeRoom('r1', { name: 'Dining Room' })])] });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.zones[0].label).toBe('Dining Room');
  });

  it('default zone ID follows the zone_default_<roomId> convention', () => {
    const plan = makePlan({ floors: [makeFloor('floor-1', [makeRoom('r1')])] });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.zones[0].zoneId).toBe('zone_default_r1');
  });

  it('room zoneIds list contains the default zone ID', () => {
    const plan = makePlan({ floors: [makeFloor('floor-1', [makeRoom('r1')])] });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.rooms[0].zoneIds).toEqual(['zone_default_r1']);
  });

  it('derives floorAreaM2 from canvas dimensions (GRID=24)', () => {
    // width=96 → 4 m, height=120 → 5 m, area = 20 m²
    const plan = makePlan({ floors: [makeFloor('floor-1', [makeRoom('r1', { width: 96, height: 120 })])] });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.zones[0].floorAreaM2).toBeCloseTo(20, 1);
  });

  it('does not create zones for outside-typed rooms', () => {
    const plan = makePlan({
      floors: [
        makeFloor('floor-1', [
          makeRoom('r1'),
          makeRoom('r2', { roomType: 'outside', name: 'Garden' }),
        ]),
      ],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.zones).toHaveLength(1);
    expect(result.zones[0].roomId).toBe('r1');
  });
});

// ─── Emitters ─────────────────────────────────────────────────────────────────

describe('buildAtlasSpatialModel — emitters', () => {
  it('creates emitters from radiator_loop placement nodes', () => {
    const plan = makePlan({
      floors: [makeFloor('floor-1', [makeRoom('r1')])],
      placementNodes: [makeNode('n1', 'radiator_loop', 'r1')],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.emitters).toHaveLength(1);
    expect(result.emitters[0].type).toBe('radiator');
  });

  it('creates emitters from ufh_loop placement nodes', () => {
    const plan = makePlan({
      floors: [makeFloor('floor-1', [makeRoom('r1')])],
      placementNodes: [makeNode('n1', 'ufh_loop', 'r1')],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.emitters[0].type).toBe('ufh');
  });

  it('ignores non-emitter placement nodes (boiler, cylinder, etc.)', () => {
    const plan = makePlan({
      floors: [makeFloor('floor-1', [makeRoom('r1')])],
      placementNodes: [
        makeNode('n1', 'heat_source_combi', 'r1'),
        makeNode('n2', 'dhw_unvented_cylinder', 'r1'),
      ],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.emitters).toHaveLength(0);
  });

  it('ignores emitters placed in outside rooms', () => {
    const plan = makePlan({
      floors: [
        makeFloor('floor-1', [makeRoom('r1', { roomType: 'outside' })]),
      ],
      placementNodes: [makeNode('n1', 'radiator_loop', 'r1')],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.emitters).toHaveLength(0);
  });

  it('ignores emitters with no roomId', () => {
    const plan = makePlan({
      floors: [makeFloor('floor-1', [makeRoom('r1')])],
      placementNodes: [{ ...makeNode('n1', 'radiator_loop', 'r1'), roomId: undefined }],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.emitters).toHaveLength(0);
  });

  it('assigns emitter to the default zone for its room', () => {
    const plan = makePlan({
      floors: [makeFloor('floor-1', [makeRoom('r1')])],
      placementNodes: [makeNode('n1', 'radiator_loop', 'r1')],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.emitters[0].zoneId).toBe('zone_default_r1');
  });

  it('registers emitter ID on the default zone', () => {
    const plan = makePlan({
      floors: [makeFloor('floor-1', [makeRoom('r1')])],
      placementNodes: [makeNode('n1', 'radiator_loop', 'r1')],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    const zone = result.zones.find((z) => z.zoneId === 'zone_default_r1');
    expect(zone?.emitterIds).toContain('emitter_n1');
  });

  it('converts emitterOutputKw to outputWattsAtDesign', () => {
    const plan = makePlan({
      floors: [makeFloor('floor-1', [makeRoom('r1')])],
      placementNodes: [makeNode('n1', 'radiator_loop', 'r1', 1.5)],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.emitters[0].outputWattsAtDesign).toBe(1500);
  });

  it('links emitter back to originating node via objectId', () => {
    const plan = makePlan({
      floors: [makeFloor('floor-1', [makeRoom('r1')])],
      placementNodes: [makeNode('n1', 'radiator_loop', 'r1')],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.emitters[0].objectId).toBe('n1');
  });
});

// ─── Openings ─────────────────────────────────────────────────────────────────

describe('buildAtlasSpatialModel — openings', () => {
  it('creates AtlasOpeningV1 entries from floor plan openings', () => {
    const plan = makePlan({
      floors: [
        makeFloor(
          'floor-1',
          [makeRoom('r1')],
          [makeWall('w1', 'external')],
          [makeOpening('o1', 'w1', 'window')],
        ),
      ],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.openings).toHaveLength(1);
    expect(result.openings[0].openingId).toBe('o1');
    expect(result.openings[0].type).toBe('window');
    expect(result.openings[0].widthM).toBe(1.2);
  });

  it('links opening to a heated room via wall roomIds', () => {
    const wall = { ...makeWall('w1', 'external'), roomIds: ['r1'] };
    const plan = makePlan({
      floors: [
        makeFloor(
          'floor-1',
          [makeRoom('r1')],
          [wall],
          [makeOpening('o1', 'w1')],
        ),
      ],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.openings[0].roomId).toBe('r1');
  });

  it('returns empty openings for a plan with no openings', () => {
    const plan = makePlan({ floors: [makeFloor('floor-1', [makeRoom('r1')])] });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.openings).toHaveLength(0);
  });
});

// ─── Boundaries ───────────────────────────────────────────────────────────────

describe('buildAtlasSpatialModel — boundaries', () => {
  it('creates one boundary per wall', () => {
    const plan = makePlan({
      floors: [
        makeFloor(
          'floor-1',
          [makeRoom('r1')],
          [makeWall('w1', 'external'), makeWall('w2', 'internal')],
        ),
      ],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.boundaries).toHaveLength(2);
  });

  it('classifies external walls as external boundaries', () => {
    const plan = makePlan({
      floors: [makeFloor('floor-1', [makeRoom('r1')], [makeWall('w1', 'external')])],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.boundaries[0].kind).toBe('external');
  });

  it('classifies internal walls as internal_heated boundaries', () => {
    const plan = makePlan({
      floors: [makeFloor('floor-1', [makeRoom('r1')], [makeWall('w1', 'internal')])],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.boundaries[0].kind).toBe('internal_heated');
  });

  it('includes the source wall ID in wallIds', () => {
    const plan = makePlan({
      floors: [makeFloor('floor-1', [makeRoom('r1')], [makeWall('w1')])],
    });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.boundaries[0].wallIds).toContain('w1');
  });

  it('returns empty boundaries for a plan with no walls', () => {
    const plan = makePlan({ floors: [makeFloor('floor-1', [makeRoom('r1')])] });
    const result = buildAtlasSpatialModel(plan, 'prop-1');
    expect(result.boundaries).toHaveLength(0);
  });
});
