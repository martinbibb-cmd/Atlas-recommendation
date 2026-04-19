/**
 * spatialAlignment.engine.test.ts
 *
 * Unit tests for SpatialAlignmentEngine core functions.
 */

import { describe, it, expect } from 'vitest';
import {
  getRelativePosition,
  projectToViewPlane,
  buildAlignmentInsights,
  deriveInferredPipeLengths,
} from '../spatialAlignment.engine';
import type { AtlasSpatialModelV1 } from '../../atlasSpatial/atlasSpatialModel.types';
import type { AtlasAnchor, AtlasWorldPosition } from '../../atlasSpatial/atlasSpatialModel.types';
import type { CameraPose } from '../spatialAlignment.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePos(x: number, y: number, z: number, confidence: 'confirmed' | 'inferred' = 'confirmed'): AtlasWorldPosition {
  return { x, y, z, confidence, source: 'manual' };
}

function makeAnchor(id: string, label: string, pos: AtlasWorldPosition): AtlasAnchor {
  return { id, label, worldPosition: pos };
}

function makeMinimalModel(): AtlasSpatialModelV1 {
  return {
    version: '1.0',
    propertyId: 'test-prop',
    rooms: [],
    zones: [],
    emitters: [],
    openings: [],
    boundaries: [],
  };
}

// ─── getRelativePosition ──────────────────────────────────────────────────────

describe('getRelativePosition', () => {
  it('returns zero distance when user is at the anchor', () => {
    const user = makePos(5, 5, 1.5);
    const anchor = makeAnchor('boiler', 'boiler', makePos(5, 5, 1.5));
    const result = getRelativePosition(user, anchor);
    expect(result.distanceM).toBe(0);
    expect(result.verticalOffsetM).toBe(0);
  });

  it('calculates correct 3-D distance', () => {
    const user = makePos(0, 0, 0);
    const anchor = makeAnchor('a1', 'boiler', makePos(3, 4, 0));
    const result = getRelativePosition(user, anchor);
    // 3-4-5 triangle
    expect(result.distanceM).toBeCloseTo(5, 2);
  });

  it('reports positive verticalOffset when target is above user', () => {
    const user   = makePos(0, 0, 0);
    const anchor = makeAnchor('cyl', 'cylinder', makePos(0, 0, 2.3));
    const result = getRelativePosition(user, anchor);
    expect(result.verticalOffsetM).toBeCloseTo(2.3, 2);
  });

  it('reports negative verticalOffset when target is below user', () => {
    const user   = makePos(0, 0, 2.3);
    const anchor = makeAnchor('boiler', 'boiler', makePos(0, 0, 0));
    const result = getRelativePosition(user, anchor);
    expect(result.verticalOffsetM).toBeCloseTo(-2.3, 2);
  });

  it('reports north bearing (0°) for a target directly north', () => {
    const user   = makePos(0, 0, 0);
    const anchor = makeAnchor('a', 'boiler', makePos(0, 5, 0));
    const result = getRelativePosition(user, anchor);
    expect(result.bearingDeg).toBeCloseTo(0, 1);
  });

  it('reports east bearing (90°) for a target directly east', () => {
    const user   = makePos(0, 0, 0);
    const anchor = makeAnchor('a', 'boiler', makePos(5, 0, 0));
    const result = getRelativePosition(user, anchor);
    expect(result.bearingDeg).toBeCloseTo(90, 1);
  });
});

// ─── projectToViewPlane ───────────────────────────────────────────────────────

describe('projectToViewPlane', () => {
  function makeCameraNorth(): CameraPose {
    return {
      position: makePos(0, 0, 1.6),
      yawDeg: 0,
      pitchDeg: 0,
      fovHorizontalDeg: 60,
      fovVerticalDeg: 45,
    };
  }

  it('projects a point directly in front of the camera to screen centre', () => {
    const camera = makeCameraNorth();
    const point  = makePos(0, 10, 1.6); // 10 m north, same height
    const result = projectToViewPlane(camera, point);
    expect(result.inFrustum).toBe(true);
    expect(result.u).toBeCloseTo(0.5, 2);
    expect(result.v).toBeCloseTo(0.5, 2);
  });

  it('marks a point behind the camera as not in frustum', () => {
    const camera = makeCameraNorth();
    const point  = makePos(0, -5, 1.6); // behind camera (south)
    const result = projectToViewPlane(camera, point);
    expect(result.inFrustum).toBe(false);
  });

  it('places a point to the right of centre for a rightward offset', () => {
    const camera = makeCameraNorth();
    const point  = makePos(2, 10, 1.6); // 2 m east of forward axis
    const result = projectToViewPlane(camera, point);
    expect(result.inFrustum).toBe(true);
    expect(result.u).toBeGreaterThan(0.5);
  });

  it('places a point above centre for an upward offset', () => {
    const camera = makeCameraNorth();
    const point  = makePos(0, 10, 3.6); // 2 m above camera eye level
    const result = projectToViewPlane(camera, point);
    expect(result.inFrustum).toBe(true);
    expect(result.v).toBeLessThan(0.5); // v=0 is top
  });
});

// ─── buildAlignmentInsights ───────────────────────────────────────────────────

describe('buildAlignmentInsights', () => {
  it('returns empty array when no anchors exist', () => {
    const model = makeMinimalModel();
    expect(buildAlignmentInsights(model)).toEqual([]);
  });

  it('returns empty array for a single anchor (reference only)', () => {
    const model: AtlasSpatialModelV1 = {
      ...makeMinimalModel(),
      anchors: [makeAnchor('boiler', 'boiler', makePos(0, 0, 0))],
    };
    expect(buildAlignmentInsights(model)).toHaveLength(0);
  });

  it('correctly identifies cylinder as above the boiler', () => {
    const model: AtlasSpatialModelV1 = {
      ...makeMinimalModel(),
      anchors: [
        makeAnchor('boiler', 'boiler', makePos(0, 0, 0.5)),
        makeAnchor('cyl',    'cylinder', makePos(0, 0, 2.8)),
      ],
    };
    const [insight] = buildAlignmentInsights(model);
    expect(insight.anchorId).toBe('cyl');
    expect(insight.relation).toBe('above');
    expect(insight.verticalDistanceM).toBeCloseTo(2.3, 2);
  });

  it('correctly identifies a component as below the reference', () => {
    const model: AtlasSpatialModelV1 = {
      ...makeMinimalModel(),
      anchors: [
        makeAnchor('boiler', 'boiler', makePos(0, 0, 2)),
        makeAnchor('pump',   'pump',   makePos(1, 0, 0.5)),
      ],
    };
    const [insight] = buildAlignmentInsights(model);
    expect(insight.relation).toBe('below');
    expect(insight.verticalDistanceM).toBeCloseTo(1.5, 2);
  });

  it('marks same_level when vertical difference < 5 cm', () => {
    const model: AtlasSpatialModelV1 = {
      ...makeMinimalModel(),
      anchors: [
        makeAnchor('boiler', 'boiler',         makePos(0, 0, 1.0)),
        makeAnchor('cu',     'consumer_unit',  makePos(2, 0, 1.03)),
      ],
    };
    const [insight] = buildAlignmentInsights(model);
    expect(insight.relation).toBe('same_level');
  });

  it('uses first anchor as reference when no boiler is present', () => {
    const model: AtlasSpatialModelV1 = {
      ...makeMinimalModel(),
      anchors: [
        makeAnchor('ref', 'consumer_unit', makePos(0, 0, 1)),
        makeAnchor('cyl', 'cylinder',      makePos(0, 0, 3)),
      ],
    };
    const [insight] = buildAlignmentInsights(model);
    expect(insight.anchorId).toBe('cyl');
    expect(insight.relation).toBe('above');
  });

  it('attaches derivationReason for inferred anchor positions', () => {
    const model: AtlasSpatialModelV1 = {
      ...makeMinimalModel(),
      anchors: [
        makeAnchor('boiler', 'boiler',   makePos(0, 0, 0)),
        makeAnchor('cyl',    'cylinder', { x: 0, y: 0, z: 2.5, confidence: 'inferred', source: 'derived' }),
      ],
    };
    const [insight] = buildAlignmentInsights(model);
    expect(insight.confidence).toBe('inferred');
    expect(insight.derivationReason).toBeDefined();
    expect(typeof insight.derivationReason).toBe('string');
  });
});

// ─── deriveInferredPipeLengths ────────────────────────────────────────────────

describe('deriveInferredPipeLengths', () => {
  it('returns empty array when no routes exist', () => {
    const model = makeMinimalModel();
    expect(deriveInferredPipeLengths(model)).toEqual([]);
  });

  it('returns empty array when only cable/flue routes exist', () => {
    const model: AtlasSpatialModelV1 = {
      ...makeMinimalModel(),
      inferredRoutes: [
        {
          id: 'flue-1',
          type: 'flue',
          path: [makePos(0,0,0), makePos(0,0,3)],
          confidence: 'inferred',
          reason: 'straight up from boiler',
        },
      ],
    };
    expect(deriveInferredPipeLengths(model)).toHaveLength(0);
  });

  it('calculates pipe length for a straight horizontal route', () => {
    const model: AtlasSpatialModelV1 = {
      ...makeMinimalModel(),
      inferredRoutes: [
        {
          id: 'pipe-1',
          type: 'pipe',
          path: [makePos(0,0,0), makePos(10,0,0)],
          confidence: 'inferred',
          reason: 'kitchen tap + boiler alignment',
        },
      ],
    };
    const [result] = deriveInferredPipeLengths(model);
    expect(result.totalLengthM).toBeCloseTo(10, 2);
    expect(result.confidence).toBe('inferred');
    expect(result.reason).toBe('kitchen tap + boiler alignment');
  });

  it('correctly sums a multi-segment route', () => {
    const model: AtlasSpatialModelV1 = {
      ...makeMinimalModel(),
      inferredRoutes: [
        {
          id: 'pipe-2',
          type: 'pipe',
          path: [makePos(0,0,0), makePos(3,0,0), makePos(3,4,0)],
          confidence: 'inferred',
          reason: 'test route',
        },
      ],
    };
    const [result] = deriveInferredPipeLengths(model);
    // segment 1: 3 m, segment 2: 4 m
    expect(result.totalLengthM).toBeCloseTo(7, 2);
  });

  it('handles a single-point path (zero length) without error', () => {
    const model: AtlasSpatialModelV1 = {
      ...makeMinimalModel(),
      inferredRoutes: [
        {
          id: 'pipe-3',
          type: 'pipe',
          path: [makePos(0,0,0)],
          confidence: 'inferred',
          reason: 'single point',
        },
      ],
    };
    const [result] = deriveInferredPipeLengths(model);
    expect(result.totalLengthM).toBe(0);
  });
});
