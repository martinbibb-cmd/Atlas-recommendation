/**
 * Tests for pathMap — verifies mapSToPath correctly interpolates along polylines.
 */

import { describe, it, expect } from 'vitest';
import { mapSToPath } from '../animation/render/pathMap';
import type { Pt } from '../animation/render/pathMap';

describe('mapSToPath — edge cases', () => {
  it('returns the only point for a single-point polyline', () => {
    const pts: Pt[] = [{ x: 5, y: 10 }];
    expect(mapSToPath(0.5, pts)).toEqual({ x: 5, y: 10 });
  });

  it('returns { x: 0, y: 0 } for an empty polyline', () => {
    expect(mapSToPath(0.5, [])).toEqual({ x: 0, y: 0 });
  });
});

describe('mapSToPath — horizontal segment', () => {
  const pts: Pt[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }];

  it('s=0 returns start point', () => {
    const p = mapSToPath(0, pts);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('s=1 returns end point', () => {
    const p = mapSToPath(1, pts);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(0);
  });

  it('s=0.5 returns midpoint', () => {
    const p = mapSToPath(0.5, pts);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(0);
  });
});

describe('mapSToPath — two equal-length segments', () => {
  // Total length = 100 + 100 = 200
  const pts: Pt[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

  it('s=0.5 falls exactly at the corner (end of first segment)', () => {
    const p = mapSToPath(0.5, pts);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(0);
  });

  it('s=0.75 is halfway down the second segment', () => {
    const p = mapSToPath(0.75, pts);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(50);
  });
});

describe('mapSToPath — diagonal segment', () => {
  // Single diagonal from (0,0) to (3,4), length = 5
  const pts: Pt[] = [{ x: 0, y: 0 }, { x: 3, y: 4 }];

  it('s=0.6 returns (1.8, 2.4)', () => {
    const p = mapSToPath(0.6, pts);
    expect(p.x).toBeCloseTo(1.8);
    expect(p.y).toBeCloseTo(2.4);
  });
});

describe('mapSToPath — schematic polyline (real-world positions)', () => {
  // Mirroring the LabCanvas single-outlet polyline
  const pts: Pt[] = [
    { x: 90,  y: 120 },
    { x: 360, y: 120 },
    { x: 540, y: 120 },
    { x: 700, y: 120 },
    { x: 900, y: 120 },
  ];

  it('s=0 starts at mains position', () => {
    const p = mapSToPath(0, pts);
    expect(p.x).toBeCloseTo(90);
    expect(p.y).toBeCloseTo(120);
  });

  it('s=1 ends at outlet position', () => {
    const p = mapSToPath(1, pts);
    expect(p.x).toBeCloseTo(900);
    expect(p.y).toBeCloseTo(120);
  });

  it('midpoint s=0.5 lies between mains and outlet', () => {
    const p = mapSToPath(0.5, pts);
    expect(p.x).toBeGreaterThan(90);
    expect(p.x).toBeLessThan(900);
    expect(p.y).toBeCloseTo(120); // all on same horizontal
  });
});
