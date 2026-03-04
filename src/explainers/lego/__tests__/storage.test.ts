/**
 * Tests for the cylinder storage model (storage.ts).
 *
 * Covers: createCylinderStore, cylinderTempC, addReheatEnergy, removeDrawEnergy.
 */

import { describe, it, expect } from 'vitest';
import {
  createCylinderStore,
  cylinderTempC,
  addReheatEnergy,
  removeDrawEnergy,
} from '../animation/storage';
import type { CylinderStore } from '../animation/storage';

// ─── createCylinderStore ─────────────────────────────────────────────────────

describe('createCylinderStore', () => {
  it('returns energyJ > 0 when initialTempC > coldInletC', () => {
    const store = createCylinderStore({ volumeL: 180, coldInletC: 10, initialTempC: 55 })
    expect(store.energyJ).toBeGreaterThan(0)
  })

  it('returns energyJ = 0 when initialTempC equals coldInletC', () => {
    const store = createCylinderStore({ volumeL: 180, coldInletC: 10, initialTempC: 10 })
    expect(store.energyJ).toBe(0)
  })

  it('stores the correct volume', () => {
    const store = createCylinderStore({ volumeL: 150, coldInletC: 10, initialTempC: 55 })
    expect(store.volumeL).toBe(150)
  })

  it('larger volume stores proportionally more energy at the same temperature', () => {
    const s180 = createCylinderStore({ volumeL: 180, coldInletC: 10, initialTempC: 55 })
    const s150 = createCylinderStore({ volumeL: 150, coldInletC: 10, initialTempC: 55 })
    expect(s180.energyJ).toBeGreaterThan(s150.energyJ)
    expect(s180.energyJ / s150.energyJ).toBeCloseTo(180 / 150, 3)
  })
})

// ─── cylinderTempC ───────────────────────────────────────────────────────────

describe('cylinderTempC', () => {
  it('round-trips: store created at T gives back T', () => {
    const store = createCylinderStore({ volumeL: 180, coldInletC: 10, initialTempC: 55 })
    expect(cylinderTempC({ store, coldInletC: 10 })).toBeCloseTo(55, 1)
  })

  it('returns coldInletC when energyJ = 0', () => {
    const store: CylinderStore = { volumeL: 180, energyJ: 0 }
    expect(cylinderTempC({ store, coldInletC: 10 })).toBe(10)
  })
})

// ─── addReheatEnergy ─────────────────────────────────────────────────────────

describe('addReheatEnergy', () => {
  it('increases energyJ', () => {
    const store = createCylinderStore({ volumeL: 180, coldInletC: 10, initialTempC: 40 })
    const heated = addReheatEnergy({ store, reheatKw: 12, dtS: 1 })
    expect(heated.energyJ).toBeGreaterThan(store.energyJ)
  })

  it('adds exactly reheatKw × 1000 × dtS joules', () => {
    const store: CylinderStore = { volumeL: 180, energyJ: 100000 }
    const heated = addReheatEnergy({ store, reheatKw: 12, dtS: 1 })
    expect(heated.energyJ).toBeCloseTo(100000 + 12000, 0)
  })

  it('does not mutate the original store', () => {
    const store: CylinderStore = { volumeL: 180, energyJ: 100000 }
    addReheatEnergy({ store, reheatKw: 12, dtS: 1 })
    expect(store.energyJ).toBe(100000)
  })

  it('preserves volumeL', () => {
    const store: CylinderStore = { volumeL: 180, energyJ: 100000 }
    const heated = addReheatEnergy({ store, reheatKw: 12, dtS: 1 })
    expect(heated.volumeL).toBe(180)
  })
})

// ─── removeDrawEnergy ────────────────────────────────────────────────────────

describe('removeDrawEnergy', () => {
  it('decreases energyJ when hot water is drawn', () => {
    const store = createCylinderStore({ volumeL: 180, coldInletC: 10, initialTempC: 55 })
    const drawn = removeDrawEnergy({
      store,
      coldInletC: 10,
      drawLpm: 10,
      deliveredTempC: 55,
      dtS: 60,
    })
    expect(drawn.energyJ).toBeLessThan(store.energyJ)
  })

  it('removes zero energy when drawLpm is 0', () => {
    const store: CylinderStore = { volumeL: 180, energyJ: 500000 }
    const drawn = removeDrawEnergy({ store, coldInletC: 10, drawLpm: 0, deliveredTempC: 55, dtS: 1 })
    expect(drawn.energyJ).toBe(500000)
  })

  it('clamps energyJ to 0 — never goes negative', () => {
    const store: CylinderStore = { volumeL: 180, energyJ: 1 }
    const drawn = removeDrawEnergy({
      store,
      coldInletC: 10,
      drawLpm: 30,
      deliveredTempC: 80,
      dtS: 3600,
    })
    expect(drawn.energyJ).toBe(0)
  })

  it('removes zero energy when deliveredTempC equals coldInletC', () => {
    const store: CylinderStore = { volumeL: 180, energyJ: 500000 }
    const drawn = removeDrawEnergy({
      store,
      coldInletC: 10,
      drawLpm: 10,
      deliveredTempC: 10,
      dtS: 60,
    })
    expect(drawn.energyJ).toBe(500000)
  })

  it('does not mutate the original store', () => {
    const store: CylinderStore = { volumeL: 180, energyJ: 500000 }
    removeDrawEnergy({ store, coldInletC: 10, drawLpm: 10, deliveredTempC: 55, dtS: 60 })
    expect(store.energyJ).toBe(500000)
  })
})

// ─── reheat + drawdown cycle ─────────────────────────────────────────────────

describe('cylinder reheat + drawdown cycle', () => {
  it('temperature recovers after draw when reheat power is sufficient', () => {
    let store = createCylinderStore({ volumeL: 180, coldInletC: 10, initialTempC: 55 })

    // Simulate 5 min draw at 10 L/min
    store = removeDrawEnergy({ store, coldInletC: 10, drawLpm: 10, deliveredTempC: 55, dtS: 300 })
    const tempAfterDraw = cylinderTempC({ store, coldInletC: 10 })

    // Simulate 10 min reheat at 12 kW
    store = addReheatEnergy({ store, reheatKw: 12, dtS: 600 })
    const tempAfterReheat = cylinderTempC({ store, coldInletC: 10 })

    expect(tempAfterDraw).toBeLessThan(55)
    expect(tempAfterReheat).toBeGreaterThan(tempAfterDraw)
  })
})
