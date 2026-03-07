/**
 * Tests for pathMap — verifies mapSToPath correctly interpolates along polylines.
 */

import { describe, it, expect } from 'vitest';
import { mapSToPath, buildPolylines, SCHEMATIC_P, STORED_HEX_END } from '../animation/render/pathMap';
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

// ─── buildPolylines — stored-cylinder trunk ───────────────────────────────────

describe('buildPolylines — combi trunk (default)', () => {
  const { main } = buildPolylines()

  it('trunk starts at mains position at P.mainsY', () => {
    expect(main[0].x).toBe(SCHEMATIC_P.mainsX)
    expect(main[0].y).toBe(SCHEMATIC_P.mainsY)
  })

  it('trunk ends at splitter', () => {
    const last = main[main.length - 1]
    expect(last.x).toBe(SCHEMATIC_P.splitX)
    expect(last.y).toBe(SCHEMATIC_P.splitY)
  })

  it('trunk passes through boiler entry (boilerX - 60)', () => {
    const passesBoiler = main.some(pt => pt.x === SCHEMATIC_P.boilerX - 60)
    expect(passesBoiler).toBe(true)
  })
})

describe('buildPolylines — stored-cylinder trunk', () => {
  const { main } = buildPolylines({ isStoredCylinder: true })
  const { mainsX, splitX, splitY, coldRailY, cylX, cylY, cylW, cylH,
          cylColdInOffsetX, cylHotOutOffsetY } = SCHEMATIC_P

  it('trunk starts at mains X at cold-rail Y (not mainsY)', () => {
    expect(main[0].x).toBe(mainsX)
    expect(main[0].y).toBe(coldRailY)
    // Must not start at trunk level (P.mainsY = 130) — the cold rail is below
    expect(main[0].y).not.toBe(SCHEMATIC_P.mainsY)
  })

  it('trunk ends at splitter', () => {
    const last = main[main.length - 1]
    expect(last.x).toBe(splitX)
    expect(last.y).toBe(splitY)
  })

  it('trunk does NOT pass through the boiler/heat-pump box on domestic path', () => {
    // The combi trunk routes through (boilerX-60, mainsY) as the heat-source
    // entry point.  The stored trunk must NOT include this point — the heat
    // source should only appear on the primary circuit, not the domestic path.
    const boilerEntryX = SCHEMATIC_P.boilerX - 60  // 360
    const trunkLevel   = SCHEMATIC_P.mainsY         // 130
    const passesBoilerEntry = main.some(
      pt => pt.x === boilerEntryX && pt.y === trunkLevel,
    )
    expect(passesBoilerEntry).toBe(false)
  })

  it('trunk includes cylinder cold_in (bottom of cylinder)', () => {
    const cylColdInY = cylY + cylH              // 174
    const cylColdInX = cylX + cylColdInOffsetX  // 390
    const hasColdIn = main.some(pt => pt.x === cylColdInX && pt.y === cylColdInY)
    expect(hasColdIn).toBe(true)
  })

  it('trunk includes cylinder hot_out (near top of cylinder, right edge)', () => {
    const cylHotOutX = cylX + cylW              // 540
    const cylHotOutY = cylY + cylHotOutOffsetY  //  98
    const hasHotOut = main.some(pt => pt.x === cylHotOutX && pt.y === cylHotOutY)
    expect(hasHotOut).toBe(true)
  })

  it('cold-rail segment stays at coldRailY', () => {
    // The first two points should be on the cold rail
    expect(main[0].y).toBe(coldRailY)
    expect(main[1].y).toBe(coldRailY)
  })
})

describe('STORED_HEX_END', () => {
  it('is between 0 and 1', () => {
    expect(STORED_HEX_END).toBeGreaterThan(0)
    expect(STORED_HEX_END).toBeLessThan(1)
  })

  it('is approximately 0.527 (cylinder top exit fraction)', () => {
    // 382 / 724 ≈ 0.527
    expect(STORED_HEX_END).toBeCloseTo(382 / 724, 3)
  })

  it('is less than 0.82 (the S_SPLIT branching threshold)', () => {
    // S_SPLIT = 0.82 in simulation.ts — the s-fraction at which MAIN particles
    // branch to outlet routes.  STORED_HEX_END must be < S_SPLIT so particles
    // turn hot BEFORE they branch, giving correct colour on outlet branches.
    const S_SPLIT = 0.82
    expect(STORED_HEX_END).toBeLessThan(S_SPLIT)
  })
})
