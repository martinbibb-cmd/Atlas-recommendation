/**
 * buildSpatialProofBlock.test.ts
 *
 * Covers:
 *  - returns null when layout has no rooms and no objects
 *  - includes rooms up to 4 in the block
 *  - includes key object labels derived from boiler, cylinder, flue
 *  - assumed routes are labelled "needs verification"
 *  - proposed routes are labelled "proposed"
 *  - existing routes are labelled "existing"
 *  - boiler at confirmed confidence generates "Boiler location recorded"
 *  - boiler at assumed confidence generates "Boiler location to be confirmed on site"
 *  - cylinder at inferred confidence generates "Cylinder position planned"
 *  - discharge route with assumed status generates "Discharge route needs checking"
 *  - discharge route with proposed status generates "Discharge route identified"
 *  - confidenceSummary is capped at 3 items
 *  - block type is 'spatial_proof'
 *  - block id is 'spatial-proof'
 *  - returns null when only walls array is present (rooms and objects empty)
 */

import { describe, it, expect } from 'vitest';
import { buildSpatialProofBlock } from '../modules/buildVisualBlocks';
import type { EngineerLayout } from '../../contracts/EngineerLayout';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPTY_LAYOUT: EngineerLayout = {
  rooms: [],
  walls: [],
  objects: [],
  routes: [],
};

const FULL_LAYOUT: EngineerLayout = {
  rooms: [
    { id: 'r1', name: 'Kitchen' },
    { id: 'r2', name: 'Hallway' },
    { id: 'r3', name: 'Utility room' },
    { id: 'r4', name: 'Airing cupboard' },
    { id: 'r5', name: 'Loft' }, // 5th — should be truncated
  ],
  walls: [],
  objects: [
    {
      id: 'obj1',
      type: 'boiler',
      label: 'Boiler',
      roomId: 'r1',
      positionHint: 'north-east corner of kitchen',
      confidence: 'confirmed',
    },
    {
      id: 'obj2',
      type: 'cylinder',
      label: 'Cylinder',
      roomId: 'r3',
      confidence: 'inferred',
    },
    {
      id: 'obj3',
      type: 'flue',
      confidence: 'assumed',
    },
  ],
  routes: [
    {
      id: 'rt1',
      type: 'discharge',
      status: 'assumed',
      confidence: 'needs_verification',
      fromLabel: 'cylinder',
      toLabel: 'outside',
    },
    {
      id: 'rt2',
      type: 'flow',
      status: 'proposed',
      confidence: 'inferred',
    },
  ],
};

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('buildSpatialProofBlock — basic contract', () => {
  it('returns null when layout has no rooms and no objects', () => {
    expect(buildSpatialProofBlock(EMPTY_LAYOUT)).toBeNull();
  });

  it('returns a block with type spatial_proof', () => {
    const block = buildSpatialProofBlock(FULL_LAYOUT);
    expect(block).not.toBeNull();
    expect(block!.type).toBe('spatial_proof');
  });

  it('returns a block with id spatial-proof', () => {
    const block = buildSpatialProofBlock(FULL_LAYOUT);
    expect(block!.id).toBe('spatial-proof');
  });
});

describe('buildSpatialProofBlock — rooms', () => {
  it('includes room names up to 4', () => {
    const block = buildSpatialProofBlock(FULL_LAYOUT);
    expect(block!.rooms).toHaveLength(4);
    expect(block!.rooms).toContain('Kitchen');
    expect(block!.rooms).toContain('Hallway');
    expect(block!.rooms).not.toContain('Loft'); // 5th room truncated
  });

  it('works with a single room', () => {
    const layout: EngineerLayout = {
      rooms: [{ id: 'r1', name: 'Kitchen' }],
      walls: [],
      objects: [{ id: 'o1', type: 'boiler', confidence: 'confirmed' }],
    };
    const block = buildSpatialProofBlock(layout);
    expect(block!.rooms).toEqual(['Kitchen']);
  });
});

describe('buildSpatialProofBlock — key objects', () => {
  it('surfaces boiler with position hint', () => {
    const block = buildSpatialProofBlock(FULL_LAYOUT);
    const boilerEntry = block!.keyObjects.find((o) => o.toLowerCase().includes('boiler'));
    expect(boilerEntry).toBeDefined();
    expect(boilerEntry).toContain('north-east corner of kitchen');
  });

  it('surfaces cylinder with room name fallback', () => {
    const block = buildSpatialProofBlock(FULL_LAYOUT);
    const cylinderEntry = block!.keyObjects.find((o) => o.toLowerCase().includes('cylinder'));
    expect(cylinderEntry).toBeDefined();
    expect(cylinderEntry).toContain('Utility room');
  });

  it('includes flue without location when no hint or room', () => {
    const block = buildSpatialProofBlock(FULL_LAYOUT);
    const flueEntry = block!.keyObjects.find((o) => o.toLowerCase().includes('flue'));
    expect(flueEntry).toBeDefined();
    expect(flueEntry).toBe('Flue');
  });
});

describe('buildSpatialProofBlock — route summaries', () => {
  it('labels assumed routes as needs verification', () => {
    const block = buildSpatialProofBlock(FULL_LAYOUT);
    const dischargeRoute = block!.routeSummary.find((r) => r.toLowerCase().includes('discharge'));
    expect(dischargeRoute).toBeDefined();
    expect(dischargeRoute).toContain('needs verification');
    expect(dischargeRoute).not.toContain('confirmed');
  });

  it('labels proposed routes as proposed', () => {
    const block = buildSpatialProofBlock(FULL_LAYOUT);
    const flowRoute = block!.routeSummary.find((r) => r.toLowerCase().includes('heating flow'));
    expect(flowRoute).toBeDefined();
    expect(flowRoute).toContain('proposed');
  });

  it('labels existing routes as existing', () => {
    const layout: EngineerLayout = {
      rooms: [{ id: 'r1', name: 'Kitchen' }],
      walls: [],
      objects: [{ id: 'o1', type: 'boiler', confidence: 'confirmed' }],
      routes: [
        { id: 'rt1', type: 'condensate', status: 'existing', confidence: 'confirmed' },
      ],
    };
    const block = buildSpatialProofBlock(layout);
    expect(block!.routeSummary[0]).toContain('existing');
  });
});

describe('buildSpatialProofBlock — confidence summary', () => {
  it('generates "Boiler location recorded" for confirmed boiler', () => {
    const block = buildSpatialProofBlock(FULL_LAYOUT);
    expect(block!.confidenceSummary).toContain('Boiler location recorded');
  });

  it('generates "Cylinder position planned" for inferred cylinder', () => {
    const block = buildSpatialProofBlock(FULL_LAYOUT);
    expect(block!.confidenceSummary).toContain('Cylinder position planned');
  });

  it('generates "Discharge route needs checking" for assumed discharge route', () => {
    const block = buildSpatialProofBlock(FULL_LAYOUT);
    expect(block!.confidenceSummary).toContain('Discharge route needs checking');
  });

  it('generates "Boiler location to be confirmed on site" for assumed boiler', () => {
    const layout: EngineerLayout = {
      rooms: [{ id: 'r1', name: 'Kitchen' }],
      walls: [],
      objects: [{ id: 'o1', type: 'boiler', confidence: 'assumed' }],
    };
    const block = buildSpatialProofBlock(layout);
    expect(block!.confidenceSummary).toContain('Boiler location to be confirmed on site');
  });

  it('generates "Discharge route identified" when discharge route is proposed (not assumed)', () => {
    const layout: EngineerLayout = {
      rooms: [{ id: 'r1', name: 'Kitchen' }],
      walls: [],
      objects: [{ id: 'o1', type: 'boiler', confidence: 'confirmed' }],
      routes: [
        { id: 'rt1', type: 'discharge', status: 'proposed', confidence: 'inferred' },
      ],
    };
    const block = buildSpatialProofBlock(layout);
    expect(block!.confidenceSummary).toContain('Discharge route identified');
  });

  it('caps confidenceSummary at 3 items', () => {
    const block = buildSpatialProofBlock(FULL_LAYOUT);
    expect(block!.confidenceSummary.length).toBeLessThanOrEqual(3);
  });

  it('falls back to "Room layout recorded" when no objects', () => {
    const layout: EngineerLayout = {
      rooms: [{ id: 'r1', name: 'Kitchen' }],
      walls: [],
      objects: [],
    };
    const block = buildSpatialProofBlock(layout);
    expect(block!.confidenceSummary).toContain('Room layout recorded');
  });
});

describe('buildSpatialProofBlock — null cases', () => {
  it('returns null when only walls are present (rooms and objects empty)', () => {
    const layout: EngineerLayout = {
      rooms: [],
      walls: [{ id: 'w1', roomId: 'r1' }],
      objects: [],
    };
    expect(buildSpatialProofBlock(layout)).toBeNull();
  });
});
