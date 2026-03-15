import { describe, expect, it } from 'vitest';
import {
  adaptFloorplanToAtlasInputs,
  type AtlasFloorplanInputs,
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
        { roomId: 'r1', roomName: 'Lounge', suggestedRadiatorKw: 3.0 },
        { roomId: 'r2', roomName: 'Hallway', suggestedRadiatorKw: 1.2 },
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
      emitterSizing: [{ roomId: 'r1', roomName: 'Dining', suggestedRadiatorKw: 2.5 }],
    });
    const result = adaptFloorplanToAtlasInputs(derived);
    expect(result.emitterAdequacyHints[0].status).toBe('review_recommended');
  });

  it('returns empty emitterAdequacyHints when no emitter sizing data', () => {
    const result = adaptFloorplanToAtlasInputs(makeDerived());
    expect(result.emitterAdequacyHints).toHaveLength(0);
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
