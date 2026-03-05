import { describe, it, expect } from 'vitest';
import {
  buildInitialMixergyState,
  stepMixergyStratification,
} from '../modules/MixergyStratificationModule';
import type { MixergyStratificationInput } from '../schema/EngineInputV2_3';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a no-op timestep input (no draw, no heat, pump off). */
function idle(overrides: Partial<MixergyStratificationInput> = {}): MixergyStratificationInput {
  return {
    state: buildInitialMixergyState(150, 60),
    dtSeconds: 60,
    drawLitres: 0,
    coldInTempC: 10,
    heatPowerKw: 0,
    pumpFlowLpm: 0,
    targetDhwTempC: 55,
    ...overrides,
  };
}

// ─── buildInitialMixergyState ─────────────────────────────────────────────────

describe('buildInitialMixergyState', () => {
  it('divides total volume equally across 5 layers', () => {
    const state = buildInitialMixergyState(150, 60);
    expect(state.layerVolLitres).toBe(30);
  });

  it('sets all layer temperatures to the initial value', () => {
    const state = buildInitialMixergyState(150, 55);
    expect(state.temp).toEqual([55, 55, 55, 55, 55]);
  });

  it('works for non-standard cylinder sizes (e.g. 210 L)', () => {
    const state = buildInitialMixergyState(210, 65);
    expect(state.layerVolLitres).toBe(42);
    state.temp.forEach(t => expect(t).toBe(65));
  });
});

// ─── Step A: Draw-off ─────────────────────────────────────────────────────────

describe('stepMixergyStratification – Step A draw-off', () => {
  it('does not change temperatures when draw is zero', () => {
    const result = stepMixergyStratification(idle({ drawLitres: 0 }));
    expect(result.nextState.temp).toEqual([60, 60, 60, 60, 60]);
  });

  it('blends cold make-up water into layer 4 when drawing', () => {
    const result = stepMixergyStratification(idle({ drawLitres: 15, coldInTempC: 10 }));
    // Layer 4 should have cooled toward 10 °C (half-layer draw → 50 % blend)
    expect(result.nextState.temp[4]).toBeLessThan(60);
    expect(result.nextState.temp[4]).toBeGreaterThan(10);
  });

  it('pulls lower layers upward: temp[0] is warmer than its drawn-in replacement', () => {
    // Start with a gradient: hot top, cold bottom
    const state = buildInitialMixergyState(150, 10);
    state.temp = [60, 55, 40, 25, 10];
    const result = stepMixergyStratification(idle({ state, drawLitres: 15, coldInTempC: 10 }));
    // Layer 0 should blend in layer 1 value (55 °C) → cooler than 60, warmer than 55
    expect(result.nextState.temp[0]).toBeLessThan(60);
    expect(result.nextState.temp[0]).toBeGreaterThan(55);
  });

  it('moves thermocline upward during heavy draw', () => {
    // Full layer draw = 30 L → fraction = 1 → each layer fully replaced by the one below
    const state = buildInitialMixergyState(150, 10);
    state.temp = [60, 50, 40, 30, 10];
    const result = stepMixergyStratification(idle({ state, drawLitres: 30, coldInTempC: 10 }));
    // Each layer should equal the one that was below it
    expect(result.nextState.temp[0]).toBeCloseTo(50);
    expect(result.nextState.temp[1]).toBeCloseTo(40);
    expect(result.nextState.temp[2]).toBeCloseTo(30);
    expect(result.nextState.temp[3]).toBeCloseTo(10);
    expect(result.nextState.temp[4]).toBeCloseTo(10);
  });

  it('delivered temperature equals layer 0 after the step', () => {
    const state = buildInitialMixergyState(150, 10);
    state.temp = [60, 50, 40, 30, 10];
    const result = stepMixergyStratification(idle({ state, drawLitres: 15, coldInTempC: 10 }));
    expect(result.deliveredTempC).toBe(result.nextState.temp[0]);
  });
});

// ─── Step B: Heating ──────────────────────────────────────────────────────────

describe('stepMixergyStratification – Step B heating', () => {
  it('raises only layer 0 when heat is applied', () => {
    const before = buildInitialMixergyState(150, 40);
    const result = stepMixergyStratification(
      idle({ state: before, heatPowerKw: 3, dtSeconds: 600 }),
    );
    // Layer 0 must have risen
    expect(result.nextState.temp[0]).toBeGreaterThan(40);
    // Layers 1–4 must be unchanged
    for (let i = 1; i < 5; i++) {
      expect(result.nextState.temp[i]).toBeCloseTo(40);
    }
  });

  it('does not heat when power is zero', () => {
    const result = stepMixergyStratification(idle({ heatPowerKw: 0 }));
    expect(result.nextState.temp[0]).toBeCloseTo(60);
  });

  it('temperature rise is proportional to power × time', () => {
    // dT = (P_kW × 1000 × dt_s) / (mass_kg × 4190)
    // mass = 30 L × 1 kg/L = 30 kg
    // dT = (3000 × 60) / (30 × 4190) = 1.4354... °C
    const state = buildInitialMixergyState(150, 40);
    const result = stepMixergyStratification(
      idle({ state, heatPowerKw: 3, dtSeconds: 60 }),
    );
    const expectedDelta = (3000 * 60) / (30 * 4190);
    expect(result.nextState.temp[0]).toBeCloseTo(40 + expectedDelta, 3);
  });

  it('delivers higher temperature to the outlet when heated', () => {
    const cold = buildInitialMixergyState(150, 20);
    const result = stepMixergyStratification(
      idle({ state: cold, heatPowerKw: 10, dtSeconds: 3600 }),
    );
    expect(result.deliveredTempC).toBeGreaterThan(20);
  });
});

// ─── Step C: Pump recirculation ───────────────────────────────────────────────

describe('stepMixergyStratification – Step C pump recirculation', () => {
  it('does not change temperatures when pump is off', () => {
    const result = stepMixergyStratification(idle({ pumpFlowLpm: 0 }));
    expect(result.nextState.temp).toEqual([60, 60, 60, 60, 60]);
  });

  it('with pump on, hot zone expands downward (lower layers warm up)', () => {
    // Hot top, cold bottom
    const state = buildInitialMixergyState(150, 10);
    state.temp = [60, 60, 60, 10, 10];
    const result = stepMixergyStratification(
      idle({ state, pumpFlowLpm: 6, dtSeconds: 60 }),
    );
    // Layer 3 (previously 10 °C) should have warmed toward layer 2 (60 °C)
    expect(result.nextState.temp[3]).toBeGreaterThan(10);
  });

  it('bottom layer cools after pump advects cold toward the top', () => {
    const state = buildInitialMixergyState(150, 10);
    state.temp = [65, 65, 65, 65, 10];
    const result = stepMixergyStratification(
      idle({ state, pumpFlowLpm: 6, dtSeconds: 60 }),
    );
    // Layer 4 should warm as it draws in the layer above (65 °C)
    expect(result.nextState.temp[4]).toBeGreaterThan(10);
  });

  it('layer 0 is slightly cooled by incoming cold from the base (pre-heat injection)', () => {
    // Uniform hot cylinder with very cold bottom
    const state = buildInitialMixergyState(150, 10);
    state.temp = [65, 65, 65, 65, 5];
    const result = stepMixergyStratification(
      idle({ state, pumpFlowLpm: 6, dtSeconds: 60 }),
    );
    // Layer 0 should be slightly below 65 °C because cold base water is injected
    expect(result.nextState.temp[0]).toBeLessThan(65);
  });

  it('usable hot litres grow over many pump+heat timesteps from a partly charged state', () => {
    // Start with only top 2 layers hot (layers 0–1 = 60 °C, layers 2–4 = 10 °C).
    // Use 10-minute timesteps and a slow pump (0.5 L/min) with a 3 kW immersion
    // element.  After 30 ticks (5 hours) of continuous heating + pumping the hot
    // band must have expanded downward past layer 2.
    // f = pumpFlowLpm * dtMin / layerVol = 0.5 * 10 / 30 ≈ 0.167 per tick.
    // Equilibrium layer-0 temperature ≈ 82 °C — well above the usable threshold.
    const state = buildInitialMixergyState(150, 10);
    state.temp = [60, 60, 10, 10, 10];

    let current = state;
    for (let tick = 0; tick < 30; tick++) {
      const result = stepMixergyStratification({
        state: current,
        dtSeconds: 600, // 10 minutes per tick (5-hour recovery window)
        drawLitres: 0,
        coldInTempC: 10,
        heatPowerKw: 3,
        pumpFlowLpm: 0.5,
        targetDhwTempC: 55,
      });
      current = result.nextState;
    }

    // After 5 hours of combined heating + pumping, all layers should have
    // warmed above the usable threshold (targetDhwTempC − 5 = 50 °C).
    const initialUsable = 2 * 30; // litres: 2 hot layers × 30 L each
    let finalUsable = 0;
    current.temp.forEach(t => {
      if (t >= 50) finalUsable += 30;
    });
    expect(finalUsable).toBeGreaterThan(initialUsable);
  });
});

// ─── usableHotLitres metric ───────────────────────────────────────────────────

describe('stepMixergyStratification – usableHotLitres', () => {
  it('counts all layers when all are above threshold', () => {
    const result = stepMixergyStratification(idle({ targetDhwTempC: 55 }));
    // All layers at 60 °C ≥ 50 °C (55 − 5) → 5 × 30 L = 150 L
    expect(result.usableHotLitres).toBe(150);
  });

  it('counts zero layers when all are below threshold', () => {
    const state = buildInitialMixergyState(150, 10);
    const result = stepMixergyStratification(idle({ state, targetDhwTempC: 55 }));
    // All layers at 10 °C < 50 °C → 0 L
    expect(result.usableHotLitres).toBe(0);
  });

  it('counts only the layers above threshold in a stratified cylinder', () => {
    const state = buildInitialMixergyState(150, 10);
    state.temp = [60, 60, 10, 10, 10];
    const result = stepMixergyStratification(idle({ state, targetDhwTempC: 55 }));
    // Layers 0 & 1 ≥ 50 °C → 2 × 30 = 60 L
    expect(result.usableHotLitres).toBe(60);
  });
});

// ─── State immutability ───────────────────────────────────────────────────────

describe('stepMixergyStratification – state immutability', () => {
  it('does not mutate the input state', () => {
    const state = buildInitialMixergyState(150, 60);
    const originalTemp = [...state.temp] as [number, number, number, number, number];
    stepMixergyStratification(idle({ state, heatPowerKw: 5, drawLitres: 10, pumpFlowLpm: 6 }));
    expect(state.temp).toEqual(originalTemp);
  });
});
