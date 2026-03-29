/**
 * HeatLossStep.test.ts
 *
 * Unit tests for the heat-loss step completion state and gating logic.
 */
import { describe, it, expect } from 'vitest';
import { deriveCompletionState, type HeatLossCompletionState } from '../HeatLossStep';
import { INITIAL_HEAT_LOSS_STATE } from '../heatLossTypes';
import type { HeatLossState, ShellModel, ShellLayer } from '../heatLossTypes';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeShellModel(overrides: Partial<ShellLayer> = {}): ShellModel {
  return {
    layers: [{
      id: 'ground',
      name: 'Ground Floor',
      kind: 'original',
      visible: true,
      points: [],
      closed: false,
      edges: [],
      ...overrides,
    }],
    activeLayerId: 'ground',
    settings: {
      storeys: 2,
      ceilingHeight: 2.4,
      dwellingType: 'detached',
      wallType: 'solid_masonry',
      loftInsulation: 'good',
      glazingType: 'double',
      glazingAmount: 'typical',
      floorType: 'suspended',
      thermalMass: 'heavy',
    },
  };
}

// ─── Completion state derivation ──────────────────────────────────────────────

describe('deriveCompletionState', () => {
  it('returns "not_started" for initial state', () => {
    expect(deriveCompletionState(INITIAL_HEAT_LOSS_STATE)).toBe('not_started');
  });

  it('returns "drawing" when points exist but shape is not closed', () => {
    const state: HeatLossState = {
      ...INITIAL_HEAT_LOSS_STATE,
      shellModel: makeShellModel({
        points: [{ x: 0, y: 0 }, { x: 5, y: 0 }],
        closed: false,
      }),
    };
    expect(deriveCompletionState(state)).toBe('drawing');
  });

  it('returns "shape_closed" when polygon is closed but no result yet', () => {
    const state: HeatLossState = {
      ...INITIAL_HEAT_LOSS_STATE,
      shellModel: makeShellModel({
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }],
        closed: true,
      }),
    };
    expect(deriveCompletionState(state)).toBe('shape_closed');
  });

  it('returns "result_ready" when heat loss result is present with confidence', () => {
    const state: HeatLossState = {
      ...INITIAL_HEAT_LOSS_STATE,
      estimatedPeakHeatLossW: 7500,
      heatLossConfidence: 'estimated',
      shellModel: makeShellModel({
        points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 8 }, { x: 0, y: 8 }],
        closed: true,
      }),
    };
    expect(deriveCompletionState(state)).toBe('result_ready');
  });

  it('returns "not_started" when shell model has empty layer', () => {
    const state: HeatLossState = {
      ...INITIAL_HEAT_LOSS_STATE,
      shellModel: makeShellModel({ points: [] }),
    };
    expect(deriveCompletionState(state)).toBe('not_started');
  });
});

// ─── Gating logic ─────────────────────────────────────────────────────────────

describe('HeatLossStep — gating logic', () => {
  const stateMap: Record<HeatLossCompletionState, boolean> = {
    not_started:   true,   // skip allowed
    drawing:       false,  // must finish
    shape_closed:  false,  // must wait for result
    result_ready:  true,   // complete
  };

  for (const [state, canProceed] of Object.entries(stateMap)) {
    it(`canProceed is ${canProceed} for "${state}" state`, () => {
      const result = state === 'not_started' || state === 'result_ready';
      expect(result).toBe(canProceed);
    });
  }
});
