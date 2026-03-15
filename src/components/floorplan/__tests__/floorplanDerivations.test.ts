import { describe, expect, it } from 'vitest';
import { createManualRoom, canPlaceInProfessionalPlan, deriveFloorplanOutputs, computeExposedPerimeterM } from '../floorplanDerivations';
import type { PropertyPlan, Room } from '../propertyPlan.types';

function makePlan(): PropertyPlan {
  return {
    version: '1.0',
    propertyId: 'p1',
    floors: [{ id: 'f1', name: 'Ground', levelIndex: 0, rooms: [], walls: [], openings: [], zones: [] }],
    placementNodes: [],
    connections: [],
    metadata: {},
  };
}

describe('floorplan room creation', () => {
  it('creates a manual room with width/length/level and default height', () => {
    const room = createManualRoom({
      name: 'Kitchen',
      widthM: 4,
      lengthM: 3,
      floorId: 'f1',
      defaultHeightM: 2.4,
    }, 'r1');

    expect(room.name).toBe('Kitchen');
    expect(room.floorId).toBe('f1');
    expect(room.areaM2).toBe(12);
    expect(room.volumeM3).toBe(28.8);
  });
});

describe('floorplan component placement', () => {
  it('allows core planning components and blocks irrelevant parts', () => {
    expect(canPlaceInProfessionalPlan('heat_source_heat_pump')).toBe(true);
    expect(canPlaceInProfessionalPlan('dhw_unvented_cylinder')).toBe(true);
    expect(canPlaceInProfessionalPlan('radiator_loop')).toBe(true);
    expect(canPlaceInProfessionalPlan('tap_outlet')).toBe(false);
  });
});

describe('computeExposedPerimeterM', () => {
  const GRID = 24;

  it('returns full perimeter when room has no heated neighbours', () => {
    const room: Room = { id: 'r1', floorId: 'f1', name: 'Lounge', roomType: 'living', x: 0, y: 0, width: 4 * GRID, height: 4 * GRID };
    // No neighbours → fully exposed
    expect(computeExposedPerimeterM(room, [room])).toBe(16); // 2*(4+4) = 16 m
  });

  it('reduces exposed perimeter when one side is covered by an adjacent heated room', () => {
    const lounge: Room = { id: 'r1', floorId: 'f1', name: 'Lounge', roomType: 'living', x: 0, y: 0, width: 4 * GRID, height: 4 * GRID };
    const kitchen: Room = { id: 'r2', floorId: 'f1', name: 'Kitchen', roomType: 'kitchen', x: 4 * GRID, y: 0, width: 3 * GRID, height: 4 * GRID };
    // Lounge right side (4m) fully covered by kitchen → exposed = 16 - 4 = 12 m
    expect(computeExposedPerimeterM(lounge, [lounge, kitchen])).toBe(12);
  });

  it('treats outside-typed rooms as external (does not reduce exposed perimeter)', () => {
    const lounge: Room = { id: 'r1', floorId: 'f1', name: 'Lounge', roomType: 'living', x: 0, y: 0, width: 4 * GRID, height: 4 * GRID };
    const outside: Room = { id: 'r2', floorId: 'f1', name: 'Outside', roomType: 'outside', x: 4 * GRID, y: 0, width: 3 * GRID, height: 4 * GRID };
    // outside does not protect → full perimeter remains 16 m
    expect(computeExposedPerimeterM(lounge, [lounge, outside])).toBe(16);
  });

  it('handles partial coverage correctly', () => {
    const lounge: Room = { id: 'r1', floorId: 'f1', name: 'Lounge', roomType: 'living', x: 0, y: 0, width: 4 * GRID, height: 4 * GRID };
    // Hallway covers only the bottom half of the lounge's right side
    const hall: Room = { id: 'r2', floorId: 'f1', name: 'Hallway', roomType: 'hallway', x: 4 * GRID, y: 2 * GRID, width: 2 * GRID, height: 2 * GRID };
    // Right side 4m; 2m covered → 2m exposed on right. Total = 4+4+4+2 = 14 m
    expect(computeExposedPerimeterM(lounge, [lounge, hall])).toBe(14);
  });
});

describe('floorplan derived outputs', () => {
  it('computes room heat loss, emitter sizing, route lengths, and feasibility', () => {
    const plan = makePlan();
    plan.floors[0].rooms.push(
      { id: 'outside', floorId: 'f1', name: 'Outside', roomType: 'outside', x: 0, y: 0, width: 48, height: 48 },
      { id: 'lounge', floorId: 'f1', name: 'Lounge', roomType: 'living', x: 48, y: 48, width: 96, height: 96, areaM2: 16, heightM: 2.4 },
    );
    plan.placementNodes.push(
      { id: 'n1', type: 'heat_source_heat_pump', floorId: 'f1', roomId: 'outside', anchor: { x: 24, y: 24 }, metadata: {} },
      { id: 'n2', type: 'radiator_loop', floorId: 'f1', roomId: 'lounge', anchor: { x: 96, y: 96 }, metadata: {} },
    );
    plan.connections.push({
      id: 'c1',
      type: 'flow',
      fromNodeId: 'n1',
      toNodeId: 'n2',
      routeMode: 'manual',
      route: [{ x: 24, y: 24 }, { x: 120, y: 24 }, { x: 120, y: 96 }],
    });

    const output = deriveFloorplanOutputs(plan, 2.4);

    // Heat loss uses physics-based formula (U_wall × exposedWall + U_ceil + U_floor) × ΔT
    expect(output.roomHeatLossKw.find((r) => r.roomId === 'lounge')?.heatLossKw).toBeGreaterThan(1.5);
    expect(output.emitterSizing.find((r) => r.roomId === 'lounge')?.suggestedRadiatorKw).toBeGreaterThan(1.7);
    expect(output.routeLengthsM[0].lengthM).toBe(7);
    expect(output.totalPipeLengthM).toBe(15.4);
    expect(output.feasibilityChecks.hasOutdoorHeatPump).toBe(true);

    // Outside room should not appear in heated-room metrics
    expect(output.roomMetrics.find((m) => m.roomId === 'outside')).toBeUndefined();
    // Lounge should appear with correct dimensions
    const loungeMetrics = output.roomMetrics.find((m) => m.roomId === 'lounge');
    expect(loungeMetrics).toBeDefined();
    expect(loungeMetrics?.widthM).toBe(4);
    expect(loungeMetrics?.lengthM).toBe(4);
    expect(loungeMetrics?.areaM2).toBe(16);
    // Lounge is isolated (outside room doesn't count) → fully exposed perimeter = 16 m
    expect(loungeMetrics?.exposedPerimeterM).toBe(16);
  });

  it('roomEmitterOutputKw is null when radiator_loop node has no emitterOutputKw', () => {
    const plan = makePlan();
    plan.floors[0].rooms.push(
      { id: 'lounge', floorId: 'f1', name: 'Lounge', roomType: 'living', x: 0, y: 0, width: 96, height: 96 },
    );
    plan.placementNodes.push(
      { id: 'n1', type: 'radiator_loop', floorId: 'f1', roomId: 'lounge', anchor: { x: 48, y: 48 }, metadata: {} },
    );
    const output = deriveFloorplanOutputs(plan, 2.4);
    expect(output.emitterSizing.find((r) => r.roomId === 'lounge')?.roomEmitterOutputKw).toBeNull();
  });

  it('roomEmitterOutputKw sums emitterOutputKw for nodes placed in the same room', () => {
    const plan = makePlan();
    plan.floors[0].rooms.push(
      { id: 'lounge', floorId: 'f1', name: 'Lounge', roomType: 'living', x: 0, y: 0, width: 96, height: 96 },
    );
    plan.placementNodes.push(
      { id: 'n1', type: 'radiator_loop', floorId: 'f1', roomId: 'lounge', anchor: { x: 24, y: 24 }, emitterOutputKw: 1.2, metadata: {} },
      { id: 'n2', type: 'ufh_loop',      floorId: 'f1', roomId: 'lounge', anchor: { x: 48, y: 48 }, emitterOutputKw: 0.8, metadata: {} },
    );
    const output = deriveFloorplanOutputs(plan, 2.4);
    expect(output.emitterSizing.find((r) => r.roomId === 'lounge')?.roomEmitterOutputKw).toBe(2.0);
  });

  it('roomEmitterOutputKw rounds to 2 decimal places (floating-point precision)', () => {
    const plan = makePlan();
    plan.floors[0].rooms.push(
      { id: 'lounge', floorId: 'f1', name: 'Lounge', roomType: 'living', x: 0, y: 0, width: 96, height: 96 },
    );
    // 0.7 + 0.7 = 1.3999999… in IEEE 754 — must be rounded to 1.4
    plan.placementNodes.push(
      { id: 'n1', type: 'radiator_loop', floorId: 'f1', roomId: 'lounge', anchor: { x: 24, y: 24 }, emitterOutputKw: 0.7, metadata: {} },
      { id: 'n2', type: 'radiator_loop', floorId: 'f1', roomId: 'lounge', anchor: { x: 48, y: 48 }, emitterOutputKw: 0.7, metadata: {} },
    );
    const output = deriveFloorplanOutputs(plan, 2.4);
    expect(output.emitterSizing.find((r) => r.roomId === 'lounge')?.roomEmitterOutputKw).toBe(1.4);
  });

  it('roomEmitterOutputKw is not affected by emitter nodes in other rooms', () => {
    const plan = makePlan();
    plan.floors[0].rooms.push(
      { id: 'lounge', floorId: 'f1', name: 'Lounge', roomType: 'living', x: 0, y: 0, width: 96, height: 96 },
      { id: 'kitchen', floorId: 'f1', name: 'Kitchen', roomType: 'kitchen', x: 96, y: 0, width: 48, height: 48 },
    );
    plan.placementNodes.push(
      { id: 'n1', type: 'radiator_loop', floorId: 'f1', roomId: 'lounge',   anchor: { x: 48, y: 48 }, emitterOutputKw: 1.5, metadata: {} },
      { id: 'n2', type: 'radiator_loop', floorId: 'f1', roomId: 'kitchen',  anchor: { x: 110, y: 10 }, emitterOutputKw: 0.9, metadata: {} },
    );
    const output = deriveFloorplanOutputs(plan, 2.4);
    expect(output.emitterSizing.find((r) => r.roomId === 'lounge')?.roomEmitterOutputKw).toBe(1.5);
    expect(output.emitterSizing.find((r) => r.roomId === 'kitchen')?.roomEmitterOutputKw).toBe(0.9);
  });

  it('adds siting flags for misplaced components', () => {
    const plan = makePlan();
    plan.floors[0].rooms.push(
      { id: 'lounge', floorId: 'f1', name: 'Lounge', roomType: 'living', x: 0, y: 0, width: 96, height: 96 },
      { id: 'utility', floorId: 'f1', name: 'Utility', roomType: 'utility', x: 96, y: 0, width: 48, height: 48 },
    );
    plan.placementNodes.push(
      // Boiler in lounge → warn
      { id: 'b1', type: 'heat_source_combi', floorId: 'f1', roomId: 'lounge', anchor: { x: 48, y: 48 }, metadata: {} },
      // Cylinder in utility → ok
      { id: 'c1', type: 'dhw_unvented_cylinder', floorId: 'f1', roomId: 'utility', anchor: { x: 110, y: 10 }, metadata: {} },
    );

    const output = deriveFloorplanOutputs(plan, 2.4);
    const boilerFlag = output.sitingFlags.find((f) => f.nodeId === 'b1');
    const cylinderFlag = output.sitingFlags.find((f) => f.nodeId === 'c1');

    expect(boilerFlag?.status).toBe('warn');
    expect(cylinderFlag?.status).toBe('ok');
  });

  it('flags heat pump correctly when placed outdoors vs indoors', () => {
    const plan = makePlan();
    plan.floors[0].rooms.push(
      { id: 'garden', floorId: 'f1', name: 'Garden', roomType: 'outside', x: 0, y: 0, width: 48, height: 48 },
      { id: 'kit', floorId: 'f1', name: 'Kitchen', roomType: 'kitchen', x: 48, y: 0, width: 72, height: 48 },
    );
    plan.placementNodes.push(
      { id: 'hp1', type: 'heat_source_heat_pump', floorId: 'f1', roomId: 'garden', anchor: { x: 24, y: 24 }, metadata: {} },
    );
    const okOutput = deriveFloorplanOutputs(plan, 2.4);
    expect(okOutput.sitingFlags.find((f) => f.nodeId === 'hp1')?.status).toBe('ok');

    // Move heat pump to kitchen → warn
    plan.placementNodes[0] = { ...plan.placementNodes[0], roomId: 'kit' };
    const warnOutput = deriveFloorplanOutputs(plan, 2.4);
    expect(warnOutput.sitingFlags.find((f) => f.nodeId === 'hp1')?.status).toBe('warn');
  });
});
