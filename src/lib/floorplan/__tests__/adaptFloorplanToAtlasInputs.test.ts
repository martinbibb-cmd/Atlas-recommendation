import { describe, expect, it } from 'vitest';
import {
  adaptFloorplanToAtlasInputs,
  aggregateEmitterCoverage,
  type AtlasFloorplanInputs,
  type EmitterAdequacyHint,
} from '../adaptFloorplanToAtlasInputs';
import type { DerivedFloorplanOutput } from '../../../components/floorplan/floorplanDerivations';

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeDerived(overrides: Partial<DerivedFloorplanOutput> = {}): DerivedFloorplanOutput {
  return {
    roomMetrics: [],
    roomHeatLossKw: [],
    emitterSizing: [],
    routeLengthsM: [],
    totalPipeLengthM: 0,
    feasibilityChecks: { hasOutdoorHeatPump: false, hasHeatSource: false, hasEmitters: false },
    sitingFlags: [],
    ...overrides,
  };
}

// ─── Heat-loss refinement ─────────────────────────────────────────────────────

describe('adaptFloorplanToAtlasInputs — heat-loss refinement', () => {
  it('aggregates room heat losses into refinedHeatLossKw', () => {
    const derived = makeDerived({
      roomHeatLossKw: [
        { roomId: 'r1', roomName: 'Lounge', heatLossKw: 1.5 },
        { roomId: 'r2', roomName: 'Kitchen', heatLossKw: 0.9 },
        { roomId: 'r3', roomName: 'Bedroom', heatLossKw: 0.7 },
      ],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    expect(result.refinedHeatLossKw).toBe(3.1);
  });

  it('returns refinedHeatLossKw of 0 when no heated rooms', () => {
    const result = adaptFloorplanToAtlasInputs(makeDerived());
    expect(result.refinedHeatLossKw).toBe(0);
  });

  it('passes roomHeatLossBreakdown through unchanged', () => {
    const breakdown = [
      { roomId: 'r1', roomName: 'Hall', heatLossKw: 0.5 },
    ];
    const result = adaptFloorplanToAtlasInputs(makeDerived({ roomHeatLossKw: breakdown }));
    expect(result.roomHeatLossBreakdown).toEqual(breakdown);
  });

  it('marks isReliable true when at least one heated room has non-zero heat loss', () => {
    const derived = makeDerived({
      roomHeatLossKw: [{ roomId: 'r1', roomName: 'Lounge', heatLossKw: 2.0 }],
    });
    expect(adaptFloorplanToAtlasInputs(derived).isReliable).toBe(true);
  });

  it('marks isReliable false when no heated rooms are present', () => {
    expect(adaptFloorplanToAtlasInputs(makeDerived()).isReliable).toBe(false);
  });
});

// ─── Emitter adequacy hints ───────────────────────────────────────────────────

describe('adaptFloorplanToAtlasInputs — emitter adequacy hints', () => {
  it('marks rooms with suggestedRadiatorKw >= 2.5 as review_recommended', () => {
    const derived = makeDerived({
      emitterSizing: [
        { roomId: 'r1', roomName: 'Lounge', suggestedRadiatorKw: 3.0, roomEmitterOutputKw: null },
        { roomId: 'r2', roomName: 'Hallway', suggestedRadiatorKw: 1.2, roomEmitterOutputKw: null },
      ],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    const lounge = result.emitterAdequacyHints.find((h) => h.roomId === 'r1');
    const hall = result.emitterAdequacyHints.find((h) => h.roomId === 'r2');
    expect(lounge?.status).toBe('review_recommended');
    expect(hall?.status).toBe('adequate');
  });

  it('marks room at exactly 2.5 kW as review_recommended (boundary)', () => {
    const derived = makeDerived({
      emitterSizing: [{ roomId: 'r1', roomName: 'Dining', suggestedRadiatorKw: 2.5, roomEmitterOutputKw: null }],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    expect(result.emitterAdequacyHints[0].status).toBe('review_recommended');
  });

  it('returns empty emitterAdequacyHints when no emitter sizing data', () => {
    const result = adaptFloorplanToAtlasInputs(makeDerived());
    expect(result.emitterAdequacyHints).toHaveLength(0);
  });

  // ── Coverage-ratio tests ─────────────────────────────────────────────────

  it('marks room as undersized when coverage ratio < 1', () => {
    const derived = makeDerived({
      roomHeatLossKw: [{ roomId: 'r1', roomName: 'Lounge', heatLossKw: 2.0 }],
      emitterSizing: [
        // roomEmitterOutputKw = 1.8, heatLoss = 2.0 → ratio = 0.9 < 1
        { roomId: 'r1', roomName: 'Lounge', suggestedRadiatorKw: 2.3, roomEmitterOutputKw: 1.8 },
      ],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    const lounge = result.emitterAdequacyHints.find((h) => h.roomId === 'r1');
    expect(lounge?.status).toBe('undersized');
    expect(lounge?.roomEmitterOutputKw).toBe(1.8);
  });

  it('marks room as oversized when coverage ratio > 1.8', () => {
    const derived = makeDerived({
      roomHeatLossKw: [{ roomId: 'r1', roomName: 'Lounge', heatLossKw: 2.0 }],
      emitterSizing: [
        // roomEmitterOutputKw = 4.0, heatLoss = 2.0 → ratio = 2.0 > 1.8
        { roomId: 'r1', roomName: 'Lounge', suggestedRadiatorKw: 2.3, roomEmitterOutputKw: 4.0 },
      ],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    const lounge = result.emitterAdequacyHints.find((h) => h.roomId === 'r1');
    expect(lounge?.status).toBe('oversized');
    expect(lounge?.roomEmitterOutputKw).toBe(4.0);
  });

  it('marks room as adequate when coverage ratio is between 1 and 1.8', () => {
    const derived = makeDerived({
      roomHeatLossKw: [{ roomId: 'r1', roomName: 'Lounge', heatLossKw: 2.0 }],
      emitterSizing: [
        // roomEmitterOutputKw = 3.0, heatLoss = 2.0 → ratio = 1.5 (within 1–1.8)
        { roomId: 'r1', roomName: 'Lounge', suggestedRadiatorKw: 2.3, roomEmitterOutputKw: 3.0 },
      ],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    const lounge = result.emitterAdequacyHints.find((h) => h.roomId === 'r1');
    expect(lounge?.status).toBe('adequate');
    expect(lounge?.roomEmitterOutputKw).toBe(3.0);
  });

  it('marks room as undersized at exactly coverage ratio = 1 boundary (not undersized)', () => {
    const derived = makeDerived({
      roomHeatLossKw: [{ roomId: 'r1', roomName: 'Lounge', heatLossKw: 2.0 }],
      emitterSizing: [
        // ratio exactly 1.0 → adequate (not strictly < 1)
        { roomId: 'r1', roomName: 'Lounge', suggestedRadiatorKw: 2.3, roomEmitterOutputKw: 2.0 },
      ],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    expect(result.emitterAdequacyHints[0].status).toBe('adequate');
  });

  it('marks room as oversized at exactly coverage ratio = 1.8 boundary (not oversized)', () => {
    const derived = makeDerived({
      roomHeatLossKw: [{ roomId: 'r1', roomName: 'Lounge', heatLossKw: 2.0 }],
      emitterSizing: [
        // ratio exactly 1.8 → adequate (not strictly > 1.8)
        { roomId: 'r1', roomName: 'Lounge', suggestedRadiatorKw: 2.3, roomEmitterOutputKw: 3.6 },
      ],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    expect(result.emitterAdequacyHints[0].status).toBe('adequate');
  });

  it('falls back to review_recommended logic when roomEmitterOutputKw is null', () => {
    const derived = makeDerived({
      roomHeatLossKw: [{ roomId: 'r1', roomName: 'Lounge', heatLossKw: 3.0 }],
      emitterSizing: [
        // No installed data — suggestedRadiatorKw = 3.45 (> 2.5) → review_recommended
        { roomId: 'r1', roomName: 'Lounge', suggestedRadiatorKw: 3.45, roomEmitterOutputKw: null },
      ],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    expect(result.emitterAdequacyHints[0].status).toBe('review_recommended');
    expect(result.emitterAdequacyHints[0].roomEmitterOutputKw).toBeUndefined();
  });
});

// ─── Siting constraint hints ──────────────────────────────────────────────────

describe('adaptFloorplanToAtlasInputs — siting constraint hints', () => {
  it('collects warning messages for boiler placed in wrong room', () => {
    const derived = makeDerived({
      sitingFlags: [
        {
          objectType: 'boiler',
          nodeId: 'b1',
          status: 'warn',
          message: 'Boiler in "Lounge" — preferred rooms: kitchen, utility',
        },
      ],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    const boilerHint = result.sitingConstraintHints.find((h) => h.objectType === 'boiler');
    expect(boilerHint).toBeDefined();
    expect(boilerHint?.hasWarning).toBe(true);
    expect(boilerHint?.warningMessages).toHaveLength(1);
    expect(boilerHint?.warningMessages[0]).toContain('Lounge');
  });

  it('marks ok siting flags as hasWarning=false', () => {
    const derived = makeDerived({
      sitingFlags: [
        {
          objectType: 'cylinder',
          nodeId: 'c1',
          status: 'ok',
          message: 'Cylinder in "Utility" — suitable room type',
        },
      ],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    const cylinderHint = result.sitingConstraintHints.find((h) => h.objectType === 'cylinder');
    expect(cylinderHint?.hasWarning).toBe(false);
    expect(cylinderHint?.warningMessages).toHaveLength(0);
  });

  it('only includes object types that appear in sitingFlags', () => {
    const derived = makeDerived({
      sitingFlags: [
        { objectType: 'boiler', nodeId: 'b1', status: 'ok', message: 'ok' },
      ],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    const types = result.sitingConstraintHints.map((h) => h.objectType);
    expect(types).toContain('boiler');
    expect(types).not.toContain('cylinder');
    expect(types).not.toContain('heat_pump');
  });

  it('returns empty sitingConstraintHints when no siting flags', () => {
    const result = adaptFloorplanToAtlasInputs(makeDerived());
    expect(result.sitingConstraintHints).toHaveLength(0);
  });
});

// ─── Pipe length hints ────────────────────────────────────────────────────────

describe('adaptFloorplanToAtlasInputs — pipe length hints', () => {
  it('passes totalPipeLengthM through to hints', () => {
    const derived = makeDerived({ totalPipeLengthM: 24.6 });
    const result = adaptFloorplanToAtlasInputs(derived);
    expect(result.pipeLengthEstimateHints.totalEstimateM).toBe(24.6);
  });

  it('formats label as planning estimate', () => {
    const derived = makeDerived({ totalPipeLengthM: 12 });
    const result = adaptFloorplanToAtlasInputs(derived);
    expect(result.pipeLengthEstimateHints.label).toContain('12');
    expect(result.pipeLengthEstimateHints.label).toContain('planning estimate');
  });
});

// ─── Graceful fallback ────────────────────────────────────────────────────────

describe('adaptFloorplanToAtlasInputs — graceful fallback', () => {
  it('returns a valid AtlasFloorplanInputs structure for a completely empty floor plan', () => {
    const result: AtlasFloorplanInputs = adaptFloorplanToAtlasInputs(makeDerived());
    expect(result.refinedHeatLossKw).toBe(0);
    expect(result.emitterAdequacyHints).toHaveLength(0);
    expect(result.roomHeatLossBreakdown).toHaveLength(0);
    expect(result.sitingConstraintHints).toHaveLength(0);
    expect(result.pipeLengthEstimateHints.totalEstimateM).toBe(0);
    expect(result.isReliable).toBe(false);
  });
});

// ─── aggregateEmitterCoverage ─────────────────────────────────────────────────

function makeHint(
  overrides: Partial<EmitterAdequacyHint> & Pick<EmitterAdequacyHint, 'roomId' | 'roomName' | 'status'>,
): EmitterAdequacyHint {
  return {
    suggestedRadiatorKw: 2.0,
    ...overrides,
  };
}

describe('aggregateEmitterCoverage — insufficient data', () => {
  it('returns insufficient_data when hints list is empty', () => {
    const result = aggregateEmitterCoverage([]);
    expect(result.coverageClassification).toBe('insufficient_data');
    expect(result.impliedOversizingFactor).toBeNull();
    expect(result.hasActualData).toBe(false);
  });

  it('returns insufficient_data when all hints lack installed output data', () => {
    const hints = [
      makeHint({ roomId: 'r1', roomName: 'Lounge', status: 'review_recommended' }),
      makeHint({ roomId: 'r2', roomName: 'Kitchen', status: 'adequate' }),
    ];
    const result = aggregateEmitterCoverage(hints);
    expect(result.coverageClassification).toBe('insufficient_data');
    expect(result.impliedOversizingFactor).toBeNull();
    expect(result.hasActualData).toBe(false);
    expect(result.undersizedRooms).toHaveLength(0);
    expect(result.oversizedRooms).toHaveLength(0);
  });
});

describe('aggregateEmitterCoverage — classification', () => {
  it('classifies all_adequate when all data rooms are adequate', () => {
    const hints = [
      makeHint({ roomId: 'r1', roomName: 'Lounge', status: 'adequate', roomEmitterOutputKw: 2.0, suggestedRadiatorKw: 1.5 }),
      makeHint({ roomId: 'r2', roomName: 'Kitchen', status: 'adequate', roomEmitterOutputKw: 1.5, suggestedRadiatorKw: 1.2 }),
    ];
    const result = aggregateEmitterCoverage(hints);
    expect(result.coverageClassification).toBe('all_adequate');
    expect(result.hasActualData).toBe(true);
    expect(result.undersizedRooms).toHaveLength(0);
    expect(result.oversizedRooms).toHaveLength(0);
  });

  it('classifies all_oversized when all data rooms are oversized', () => {
    const hints = [
      makeHint({ roomId: 'r1', roomName: 'Lounge', status: 'oversized', roomEmitterOutputKw: 4.5, suggestedRadiatorKw: 2.0 }),
      makeHint({ roomId: 'r2', roomName: 'Hall', status: 'oversized', roomEmitterOutputKw: 3.0, suggestedRadiatorKw: 1.0 }),
    ];
    const result = aggregateEmitterCoverage(hints);
    expect(result.coverageClassification).toBe('all_oversized');
    expect(result.oversizedRooms).toEqual(['Lounge', 'Hall']);
  });

  it('classifies majority_undersized when more than 50% of rooms are undersized', () => {
    const hints = [
      makeHint({ roomId: 'r1', roomName: 'Lounge', status: 'undersized', roomEmitterOutputKw: 1.0, suggestedRadiatorKw: 2.0 }),
      makeHint({ roomId: 'r2', roomName: 'Kitchen', status: 'undersized', roomEmitterOutputKw: 0.8, suggestedRadiatorKw: 1.5 }),
      makeHint({ roomId: 'r3', roomName: 'Bedroom', status: 'adequate', roomEmitterOutputKw: 2.5, suggestedRadiatorKw: 2.0 }),
    ];
    const result = aggregateEmitterCoverage(hints);
    expect(result.coverageClassification).toBe('majority_undersized');
    expect(result.undersizedRooms).toEqual(['Lounge', 'Kitchen']);
  });

  it('classifies mixed when some undersized and some adequate', () => {
    const hints = [
      makeHint({ roomId: 'r1', roomName: 'Lounge', status: 'undersized', roomEmitterOutputKw: 0.8, suggestedRadiatorKw: 2.0 }),
      makeHint({ roomId: 'r2', roomName: 'Kitchen', status: 'adequate', roomEmitterOutputKw: 2.5, suggestedRadiatorKw: 2.0 }),
      makeHint({ roomId: 'r3', roomName: 'Bedroom', status: 'adequate', roomEmitterOutputKw: 2.0, suggestedRadiatorKw: 1.5 }),
    ];
    const result = aggregateEmitterCoverage(hints);
    expect(result.coverageClassification).toBe('mixed');
    expect(result.undersizedRooms).toEqual(['Lounge']);
  });
});

describe('aggregateEmitterCoverage — impliedOversizingFactor', () => {
  it('returns a factor close to 1.0 when emitters match demand', () => {
    const hints = [
      makeHint({ roomId: 'r1', roomName: 'Lounge', status: 'adequate', roomEmitterOutputKw: 2.0, suggestedRadiatorKw: 2.0 }),
    ];
    const result = aggregateEmitterCoverage(hints);
    expect(result.impliedOversizingFactor).toBeCloseTo(1.0);
  });

  it('returns a factor > 1 when emitters exceed demand', () => {
    const hints = [
      makeHint({ roomId: 'r1', roomName: 'Lounge', status: 'oversized', roomEmitterOutputKw: 3.6, suggestedRadiatorKw: 2.0 }),
    ];
    const result = aggregateEmitterCoverage(hints);
    expect(result.impliedOversizingFactor).toBeGreaterThan(1.0);
  });

  it('returns a factor < 1 when emitters are undersized', () => {
    const hints = [
      makeHint({ roomId: 'r1', roomName: 'Lounge', status: 'undersized', roomEmitterOutputKw: 1.0, suggestedRadiatorKw: 2.0 }),
    ];
    const result = aggregateEmitterCoverage(hints);
    expect(result.impliedOversizingFactor).toBeLessThan(1.0);
    expect(result.impliedOversizingFactor).toBeGreaterThanOrEqual(0.5);
  });

  it('weights larger rooms more heavily in the average', () => {
    // r1: big room, adequate at 1.0x coverage
    // r2: small room, oversized at 2.0x coverage
    // Weighted average should be closer to 1.0 due to r1's larger weight.
    const hints = [
      makeHint({ roomId: 'r1', roomName: 'Lounge', status: 'adequate', roomEmitterOutputKw: 3.0, suggestedRadiatorKw: 3.0 }),
      makeHint({ roomId: 'r2', roomName: 'WC', status: 'oversized', roomEmitterOutputKw: 1.0, suggestedRadiatorKw: 0.5 }),
    ];
    // r1 coverage = 1.0, weight = 3.0
    // r2 coverage = 2.0, weight = 0.5
    // weighted avg = (1.0*3.0 + 2.0*0.5) / (3.0 + 0.5) = 4/3.5 ≈ 1.14
    const result = aggregateEmitterCoverage(hints);
    expect(result.impliedOversizingFactor).toBeCloseTo(4 / 3.5, 2);
  });
});

describe('adaptFloorplanToAtlasInputs — wholeSystemEmitterAdequacy', () => {
  it('includes wholeSystemEmitterAdequacy in the output', () => {
    const derived = makeDerived({
      roomHeatLossKw: [{ roomId: 'r1', roomName: 'Lounge', heatLossKw: 2.0 }],
      emitterSizing: [
        { roomId: 'r1', roomName: 'Lounge', suggestedRadiatorKw: 2.0, roomEmitterOutputKw: 3.0 },
      ],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    expect(result.wholeSystemEmitterAdequacy).toBeDefined();
    expect(result.wholeSystemEmitterAdequacy.hasActualData).toBe(true);
  });

  it('returns insufficient_data adequacy for empty floor plan', () => {
    const result = adaptFloorplanToAtlasInputs(makeDerived());
    expect(result.wholeSystemEmitterAdequacy.coverageClassification).toBe('insufficient_data');
    expect(result.wholeSystemEmitterAdequacy.hasActualData).toBe(false);
  });
});
