import { describe, expect, it } from 'vitest';
import { createManualRoom, canPlaceInProfessionalPlan, deriveFloorplanOutputs } from '../floorplanDerivations';
import type { PropertyPlan } from '../propertyPlan.types';

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
    expect(output.roomHeatLossKw.find((r) => r.roomId === 'lounge')?.heatLossKw).toBeGreaterThan(1.5);
    expect(output.emitterSizing.find((r) => r.roomId === 'lounge')?.suggestedRadiatorKw).toBeGreaterThan(1.7);
    expect(output.routeLengthsM[0].lengthM).toBe(7);
    expect(output.totalPipeLengthM).toBe(15.4);
    expect(output.feasibilityChecks.hasOutdoorHeatPump).toBe(true);
  });
});
