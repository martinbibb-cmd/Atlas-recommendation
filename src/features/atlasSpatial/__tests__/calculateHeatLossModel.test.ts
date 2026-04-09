import { describe, expect, it } from 'vitest';
import { calculateHeatLossModel } from '../calculateHeatLossModel';
import type { AtlasSpatialModelV1, AtlasThermalZoneV1, AtlasEmitterV1 } from '../atlasSpatialModel.types';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeSpatial(overrides: Partial<AtlasSpatialModelV1> = {}): AtlasSpatialModelV1 {
  return {
    version: '1.0',
    propertyId: 'prop-1',
    rooms: [],
    zones: [],
    emitters: [],
    openings: [],
    boundaries: [],
    ...overrides,
  };
}

function makeRoom(roomId: string, label = 'Lounge', roomType = 'living', zoneIds: string[] = []) {
  return { roomId, label, status: 'draft' as const, roomType, zoneIds };
}

function makeZone(overrides: Partial<AtlasThermalZoneV1> & Pick<AtlasThermalZoneV1, 'zoneId' | 'roomId'>): AtlasThermalZoneV1 {
  return {
    label:      overrides.label ?? 'Zone',
    emitterIds: [],
    ...overrides,
  };
}

function makeEmitter(overrides: Partial<AtlasEmitterV1> & Pick<AtlasEmitterV1, 'emitterId' | 'roomId'>): AtlasEmitterV1 {
  return {
    type: 'radiator',
    ...overrides,
  };
}

// ─── Empty / minimal plan ─────────────────────────────────────────────────────

describe('calculateHeatLossModel — empty plan', () => {
  it('returns version 1.0 and matching propertyId', () => {
    const result = calculateHeatLossModel(makeSpatial({ propertyId: 'prop-abc' }));
    expect(result.version).toBe('1.0');
    expect(result.propertyId).toBe('prop-abc');
  });

  it('returns totalHeatLossWatts of 0 for empty spatial model', () => {
    const result = calculateHeatLossModel(makeSpatial());
    expect(result.totalHeatLossWatts).toBe(0);
  });

  it('returns empty roomResults and zoneResults for empty spatial model', () => {
    const result = calculateHeatLossModel(makeSpatial());
    expect(result.roomResults).toHaveLength(0);
    expect(result.zoneResults).toHaveLength(0);
  });

  it('uses supplied calculatedAt timestamp', () => {
    const ts = '2025-01-15T12:00:00.000Z';
    const result = calculateHeatLossModel(makeSpatial(), ts);
    expect(result.calculatedAt).toBe(ts);
  });

  it('sets calculatedAt to a non-empty string when not supplied', () => {
    const result = calculateHeatLossModel(makeSpatial());
    expect(result.calculatedAt).toBeTruthy();
    expect(typeof result.calculatedAt).toBe('string');
  });
});

// ─── Zone heat-loss calculation ───────────────────────────────────────────────

describe('calculateHeatLossModel — zone heat-loss calculation', () => {
  it('returns one zoneResult per zone', () => {
    const spatial = makeSpatial({
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1'])],
      zones: [makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 15, heightM: 2.4, exposedPerimeterM: 10 })],
    });
    const result = calculateHeatLossModel(spatial);
    expect(result.zoneResults).toHaveLength(1);
    expect(result.zoneResults[0].zoneId).toBe('z1');
  });

  it('calculates non-zero heat loss for a zone with explicit geometry', () => {
    const spatial = makeSpatial({
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1'])],
      zones: [makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 20, heightM: 2.4, exposedPerimeterM: 16 })],
    });
    const result = calculateHeatLossModel(spatial);
    expect(result.zoneResults[0].heatLossWatts).toBeGreaterThan(0);
  });

  it('uses explicit floorAreaM2 over bounding-box derivation', () => {
    const zoneWithExplicitArea = makeZone({
      zoneId: 'z1', roomId: 'r1',
      floorAreaM2: 10,      // explicit
      heightM: 2.4,
      exposedPerimeterM: 10,
      geometry: {
        boundingBox: { x: 0, y: 0, width: 240, height: 360 }, // 10m × 15m = 150 m² — should NOT be used
      },
    });
    const spatial = makeSpatial({
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1'])],
      zones: [zoneWithExplicitArea],
    });
    const result = calculateHeatLossModel(spatial);
    expect(result.zoneResults[0].floorAreaM2).toBe(10);
  });

  it('derives floorAreaM2 from bounding box when explicit value is absent (GRID=24)', () => {
    // 96 × 120 canvas units → 4 m × 5 m = 20 m²
    const zone = makeZone({
      zoneId: 'z1', roomId: 'r1',
      geometry: { boundingBox: { x: 0, y: 0, width: 96, height: 120 } },
      heightM: 2.4,
      exposedPerimeterM: 10,
    });
    const spatial = makeSpatial({
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1'])],
      zones: [zone],
    });
    const result = calculateHeatLossModel(spatial);
    expect(result.zoneResults[0].floorAreaM2).toBeCloseTo(20, 1);
  });

  it('uses designTempC when explicitly set on the zone', () => {
    // Same geometry but different design temp → different heat loss
    const mkSpatial = (designTempC: number) =>
      makeSpatial({
        rooms: [makeRoom('r1', 'Lounge', 'living', ['z1'])],
        zones: [makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 15, heightM: 2.4, exposedPerimeterM: 10, designTempC })],
      });

    const result21 = calculateHeatLossModel(mkSpatial(21));
    const result15 = calculateHeatLossModel(mkSpatial(15));
    expect(result21.zoneResults[0].heatLossWatts).toBeGreaterThan(result15.zoneResults[0].heatLossWatts);
  });

  it('applies BS EN 12831 living room design temp (21°C) when no designTempC', () => {
    // ΔT for living = 21 - 0 = 21 K. ΔT for bedroom = 18 - 0 = 18 K.
    // Same geometry → living room should have higher heat loss.
    const mkSpatial = (roomType: string) =>
      makeSpatial({
        rooms: [makeRoom('r1', 'Room', roomType, ['z1'])],
        zones: [makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 15, heightM: 2.4, exposedPerimeterM: 10 })],
      });

    const livingResult  = calculateHeatLossModel(mkSpatial('living'));
    const bedroomResult = calculateHeatLossModel(mkSpatial('bedroom'));
    expect(livingResult.zoneResults[0].heatLossWatts).toBeGreaterThan(bedroomResult.zoneResults[0].heatLossWatts);
  });

  it('treats cavity_uninsulated the same as solid_masonry (high heat-loss band)', () => {
    const mkSpatial = (wallConstruction: any) =>
      makeSpatial({
        rooms: [makeRoom('r1', 'Lounge', 'living', ['z1'])],
        zones: [makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 15, heightM: 2.4, exposedPerimeterM: 10, wallConstruction })],
      });

    const cavityResult  = calculateHeatLossModel(mkSpatial('cavity_uninsulated'));
    const masonryResult = calculateHeatLossModel(mkSpatial('solid_masonry'));
    expect(cavityResult.zoneResults[0].heatLossWatts).toBeCloseTo(masonryResult.zoneResults[0].heatLossWatts, 1);
  });

  it('cavity_insulated produces lower heat loss than cavity_uninsulated', () => {
    const mkSpatial = (wallConstruction: any) =>
      makeSpatial({
        rooms: [makeRoom('r1', 'Lounge', 'living', ['z1'])],
        zones: [makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 15, heightM: 2.4, exposedPerimeterM: 10, wallConstruction })],
      });

    const insulated   = calculateHeatLossModel(mkSpatial('cavity_insulated'));
    const uninsulated = calculateHeatLossModel(mkSpatial('cavity_uninsulated'));
    expect(insulated.zoneResults[0].heatLossWatts).toBeLessThan(uninsulated.zoneResults[0].heatLossWatts);
  });

  it('subtracts window area from opaque wall area in heat-loss calculation', () => {
    const mkSpatial = (windowAreaM2: number) =>
      makeSpatial({
        rooms: [makeRoom('r1', 'Lounge', 'living', ['z1'])],
        zones: [makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 15, heightM: 2.4, exposedPerimeterM: 10, windowAreaM2 })],
      });

    // Larger window area → opaque wall area decreases → wall loss decreases
    // BUT glazing loss increases. Net effect depends on U-values; with higher
    // window U-value the total is higher, not lower. We just check the
    // fabricWallLossW is lower for the larger window case.
    const smallWindow = calculateHeatLossModel(mkSpatial(0.5));
    const largeWindow = calculateHeatLossModel(mkSpatial(3.0));
    expect(smallWindow.zoneResults[0].fabricWallLossW).toBeGreaterThan(largeWindow.zoneResults[0].fabricWallLossW);
    expect(smallWindow.zoneResults[0].fabricGlazingLossW).toBeLessThan(largeWindow.zoneResults[0].fabricGlazingLossW);
  });
});

// ─── Emitter adequacy ─────────────────────────────────────────────────────────

describe('calculateHeatLossModel — emitter adequacy', () => {
  function makeSpatialWithEmitter(outputWattsAtDesign: number, heatLossW: number) {
    // Construct geometry that gives approximately heatLossW total loss.
    // Use floorAreaM2 and exposedPerimeterM to engineer a known target.
    // For simplicity, set wallConstruction to 'solid_masonry' (U=1.6).
    // Use designTempC=21, outdoor=0, ΔT=21.
    // Wall: 1.6 × exposedPerimeterM × heightM × 21
    // Ceiling: 0.35 × area × 21
    // Floor: 0.45 × area × 21
    // We directly override heatLossWatts via zone-level inputs tuned for the test.
    // Use a tiny room with exact floorAreaM2 chosen so total ≈ heatLossW.
    // Easier: just set a large room so total > all emitter sizes we test.

    const spatial: AtlasSpatialModelV1 = {
      version: '1.0',
      propertyId: 'prop-1',
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1'])],
      zones: [makeZone({
        zoneId: 'z1', roomId: 'r1',
        floorAreaM2: 20, heightM: 2.4, exposedPerimeterM: 16,
        wallConstruction: 'solid_masonry',
        designTempC: 21,
        emitterIds: ['e1'],
      })],
      emitters: [makeEmitter({ emitterId: 'e1', roomId: 'r1', zoneId: 'z1', outputWattsAtDesign })],
      openings: [],
      boundaries: [],
    };
    void heatLossW; // used only to communicate test intent to the reader
    return spatial;
  }

  it('classifies zone as no_emitter when no emitter is assigned', () => {
    const spatial = makeSpatial({
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1'])],
      zones: [makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 20, heightM: 2.4, exposedPerimeterM: 16 })],
    });
    const result = calculateHeatLossModel(spatial);
    expect(result.zoneResults[0].adequacyStatus).toBe('no_emitter');
    expect(result.zoneResults[0].totalEmitterOutputWatts).toBe(0);
  });

  it('classifies zone as undersized when emitter output < heat demand', () => {
    // Room heat loss ≈ 1.6×(16×2.4)×21 + 0.35×20×21 + 0.45×20×21 ≈ 1289+147+189 ≈ 1625 W
    // Emitter = 500 W → ratio ≈ 0.31 → undersized
    const spatial = makeSpatialWithEmitter(500, 1625);
    const result  = calculateHeatLossModel(spatial);
    expect(result.zoneResults[0].adequacyStatus).toBe('undersized');
  });

  it('classifies zone as oversized when emitter output > 1.8× heat demand', () => {
    // Heat loss ≈ 1625 W. Emitter = 4000 W → ratio ≈ 2.46 → oversized
    const spatial = makeSpatialWithEmitter(4000, 1625);
    const result  = calculateHeatLossModel(spatial);
    expect(result.zoneResults[0].adequacyStatus).toBe('oversized');
  });

  it('classifies zone as adequate when emitter output is 1–1.8× heat demand', () => {
    // Heat loss ≈ 1625 W. Emitter = 2000 W → ratio ≈ 1.23 → adequate
    const spatial = makeSpatialWithEmitter(2000, 1625);
    const result  = calculateHeatLossModel(spatial);
    expect(result.zoneResults[0].adequacyStatus).toBe('adequate');
  });

  it('computes shortfallWatts as heatLossWatts − totalEmitterOutputWatts', () => {
    const spatial = makeSpatialWithEmitter(1000, 0);
    const result  = calculateHeatLossModel(spatial);
    const zone    = result.zoneResults[0];
    expect(zone.shortfallWatts).toBeCloseTo(zone.heatLossWatts - zone.totalEmitterOutputWatts, 1);
  });

  it('sums multiple emitter outputs for a zone', () => {
    const spatial: AtlasSpatialModelV1 = {
      version: '1.0',
      propertyId: 'prop-1',
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1'])],
      zones: [makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 20, heightM: 2.4, exposedPerimeterM: 16, emitterIds: ['e1', 'e2'] })],
      emitters: [
        makeEmitter({ emitterId: 'e1', roomId: 'r1', zoneId: 'z1', outputWattsAtDesign: 800 }),
        makeEmitter({ emitterId: 'e2', roomId: 'r1', zoneId: 'z1', outputWattsAtDesign: 600 }),
      ],
      openings: [],
      boundaries: [],
    };
    const result = calculateHeatLossModel(spatial);
    expect(result.zoneResults[0].totalEmitterOutputWatts).toBe(1400);
  });

  it('falls back to outputWattsAtDt50 when outputWattsAtDesign is absent', () => {
    const spatial: AtlasSpatialModelV1 = {
      version: '1.0',
      propertyId: 'prop-1',
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1'])],
      zones: [makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 20, heightM: 2.4, exposedPerimeterM: 16, emitterIds: ['e1'] })],
      emitters: [makeEmitter({ emitterId: 'e1', roomId: 'r1', zoneId: 'z1', outputWattsAtDt50: 1200 })],
      openings: [],
      boundaries: [],
    };
    const result = calculateHeatLossModel(spatial);
    expect(result.zoneResults[0].totalEmitterOutputWatts).toBe(1200);
  });
});

// ─── Room rollup ──────────────────────────────────────────────────────────────

describe('calculateHeatLossModel — room rollup', () => {
  it('returns one roomResult per room', () => {
    const spatial = makeSpatial({
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1']), makeRoom('r2', 'Bedroom', 'bedroom', ['z2'])],
      zones: [
        makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 15, heightM: 2.4, exposedPerimeterM: 10 }),
        makeZone({ zoneId: 'z2', roomId: 'r2', floorAreaM2: 12, heightM: 2.4, exposedPerimeterM: 8 }),
      ],
    });
    const result = calculateHeatLossModel(spatial);
    expect(result.roomResults).toHaveLength(2);
  });

  it('rolls up zone heat losses to room total', () => {
    const spatial = makeSpatial({
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1', 'z2'])],
      zones: [
        makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 10, heightM: 2.4, exposedPerimeterM: 8 }),
        makeZone({ zoneId: 'z2', roomId: 'r1', floorAreaM2: 10, heightM: 2.4, exposedPerimeterM: 8 }),
      ],
    });
    const result  = calculateHeatLossModel(spatial);
    const z1Loss  = result.zoneResults.find((z) => z.zoneId === 'z1')!.heatLossWatts;
    const z2Loss  = result.zoneResults.find((z) => z.zoneId === 'z2')!.heatLossWatts;
    const roomTotal = result.roomResults[0].heatLossWatts;
    expect(roomTotal).toBeCloseTo(z1Loss + z2Loss, 1);
  });

  it('aggregates emitter output across zones in the same room', () => {
    const spatial: AtlasSpatialModelV1 = {
      version: '1.0',
      propertyId: 'prop-1',
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1', 'z2'])],
      zones: [
        makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 10, heightM: 2.4, exposedPerimeterM: 8, emitterIds: ['e1'] }),
        makeZone({ zoneId: 'z2', roomId: 'r1', floorAreaM2: 10, heightM: 2.4, exposedPerimeterM: 8, emitterIds: ['e2'] }),
      ],
      emitters: [
        makeEmitter({ emitterId: 'e1', roomId: 'r1', zoneId: 'z1', outputWattsAtDesign: 700 }),
        makeEmitter({ emitterId: 'e2', roomId: 'r1', zoneId: 'z2', outputWattsAtDesign: 900 }),
      ],
      openings: [],
      boundaries: [],
    };
    const result = calculateHeatLossModel(spatial);
    expect(result.roomResults[0].totalEmitterOutputWatts).toBe(1600);
  });

  it('propagates worst-case adequacy from zones to room (undersized takes precedence)', () => {
    const spatial: AtlasSpatialModelV1 = {
      version: '1.0',
      propertyId: 'prop-1',
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1', 'z2'])],
      zones: [
        makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 20, heightM: 2.4, exposedPerimeterM: 16, emitterIds: ['e1'] }),
        makeZone({ zoneId: 'z2', roomId: 'r1', floorAreaM2: 5,  heightM: 2.4, exposedPerimeterM: 6,  emitterIds: ['e2'] }),
      ],
      emitters: [
        makeEmitter({ emitterId: 'e1', roomId: 'r1', zoneId: 'z1', outputWattsAtDesign: 200 }),   // undersized
        makeEmitter({ emitterId: 'e2', roomId: 'r1', zoneId: 'z2', outputWattsAtDesign: 5000 }),  // oversized
      ],
      openings: [],
      boundaries: [],
    };
    const result = calculateHeatLossModel(spatial);
    expect(result.roomResults[0].adequacyStatus).toBe('undersized');
  });

  it('includes zone IDs in the room result', () => {
    const spatial = makeSpatial({
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1', 'z2'])],
      zones: [
        makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 10, heightM: 2.4, exposedPerimeterM: 8 }),
        makeZone({ zoneId: 'z2', roomId: 'r1', floorAreaM2: 10, heightM: 2.4, exposedPerimeterM: 8 }),
      ],
    });
    const result = calculateHeatLossModel(spatial);
    expect(result.roomResults[0].zoneIds).toContain('z1');
    expect(result.roomResults[0].zoneIds).toContain('z2');
  });
});

// ─── Property total ───────────────────────────────────────────────────────────

describe('calculateHeatLossModel — property total', () => {
  it('totalHeatLossWatts is the sum of all room heat losses', () => {
    const spatial = makeSpatial({
      rooms: [makeRoom('r1', 'Lounge', 'living', ['z1']), makeRoom('r2', 'Bedroom', 'bedroom', ['z2'])],
      zones: [
        makeZone({ zoneId: 'z1', roomId: 'r1', floorAreaM2: 15, heightM: 2.4, exposedPerimeterM: 10 }),
        makeZone({ zoneId: 'z2', roomId: 'r2', floorAreaM2: 12, heightM: 2.4, exposedPerimeterM: 8 }),
      ],
    });
    const result     = calculateHeatLossModel(spatial);
    const manualSum  = result.roomResults.reduce((s, r) => s + r.heatLossWatts, 0);
    expect(result.totalHeatLossWatts).toBeCloseTo(manualSum, 1);
  });
});
