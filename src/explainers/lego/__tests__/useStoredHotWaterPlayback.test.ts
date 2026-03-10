/**
 * Tests for useStoredHotWaterPlayback — the stored hot water display adapter.
 *
 * Validates that the hook:
 *   - Returns null for combi systems (no thermal store)
 *   - Returns null when cylinderFillPct is absent
 *   - Computes availableHotWaterL from fillPct × cylinderSizeLitres
 *   - deliveryTempC is within expected bounds (38–55°C)
 *   - topTempC > bottomTempC for all fill levels
 *   - isReheatActive reflects systemMode === 'dhw_reheat' | 'heating_and_reheat'
 *
 * Mixergy vs standard:
 *   - Mixergy usableReserveFraction > standard at same cylinderFillPct (due to ×1.2)
 *   - Mixergy deliveryTempC >= standard at same cylinderFillPct
 *   - Mixergy topTempC >= standard at same cylinderFillPct
 *   - Mixergy availableHotWaterL >= standard at same cylinderFillPct
 */

import { describe, it, expect } from 'vitest'
import { useStoredHotWaterPlayback } from '../simulator/useStoredHotWaterPlayback'
import type { SystemDiagramDisplayState } from '../simulator/useSystemDiagramPlayback'
import { supplyOriginsForSystemType } from '../sim/supplyOrigins'
import type { CylinderType } from '../simulator/systemInputsTypes'

// ─── State factories ──────────────────────────────────────────────────────────

function makeStoredState(
  overrides: Partial<SystemDiagramDisplayState> = {},
): SystemDiagramDisplayState {
  return {
    systemMode: 'idle',
    systemType: 'unvented_cylinder',
    heatSourceType: 'system_boiler',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('unvented_cylinder'),
    hotDrawActive: false,
    cylinderFillPct: 0.70,
    phaseLabel: 'Standby',
    ...overrides,
  }
}

function makeCombiState(): SystemDiagramDisplayState {
  return {
    systemMode: 'idle',
    systemType: 'combi',
    heatSourceType: 'combi',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('combi'),
    hotDrawActive: false,
    phaseLabel: 'Standby',
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useStoredHotWaterPlayback', () => {
  // ── Null returns ───────────────────────────────────────────────────────────

  it('returns null for combi systems', () => {
    const result = useStoredHotWaterPlayback(makeCombiState(), 'unvented', 150)
    expect(result).toBeNull()
  })

  it('returns null when cylinderFillPct is absent', () => {
    const state = makeStoredState({ cylinderFillPct: undefined })
    const result = useStoredHotWaterPlayback(state, 'unvented', 150)
    expect(result).toBeNull()
  })

  // ── Basic values ───────────────────────────────────────────────────────────

  it('computes availableHotWaterL as usableReserveFraction × cylinderSizeLitres (standard)', () => {
    const state = makeStoredState({ cylinderFillPct: 0.6 })
    const result = useStoredHotWaterPlayback(state, 'unvented', 150)!
    // standard: usableReserveFraction = cylinderFillPct = 0.6 → 90 L
    expect(result.availableHotWaterL).toBe(90)
  })

  it('availableHotWaterL is rounded integer', () => {
    const state = makeStoredState({ cylinderFillPct: 0.7 })
    const result = useStoredHotWaterPlayback(state, 'unvented', 150)!
    expect(Number.isInteger(result.availableHotWaterL)).toBe(true)
  })

  it('deliveryTempC is within 38–55°C range for full range of fill (standard)', () => {
    const fills = [0.1, 0.3, 0.5, 0.7, 0.9, 1.0]
    for (const fill of fills) {
      const state = makeStoredState({ cylinderFillPct: fill })
      const result = useStoredHotWaterPlayback(state, 'unvented', 150)!
      expect(result.deliveryTempC).toBeGreaterThanOrEqual(38)
      expect(result.deliveryTempC).toBeLessThanOrEqual(55)
    }
  })

  it('topTempC > bottomTempC at all fill levels (standard)', () => {
    const fills = [0.1, 0.3, 0.5, 0.7, 1.0]
    for (const fill of fills) {
      const state = makeStoredState({ cylinderFillPct: fill })
      const result = useStoredHotWaterPlayback(state, 'unvented', 150)!
      expect(result.topTempC).toBeGreaterThan(result.bottomTempC)
    }
  })

  it('usableReserveFraction equals cylinderFillPct for standard cylinder', () => {
    const state = makeStoredState({ cylinderFillPct: 0.55 })
    const result = useStoredHotWaterPlayback(state, 'unvented', 150)!
    expect(result.usableReserveFraction).toBe(0.55)
  })

  // ── Reheat state ───────────────────────────────────────────────────────────

  it('isReheatActive is false when idle', () => {
    const state = makeStoredState({ systemMode: 'idle' })
    const result = useStoredHotWaterPlayback(state, 'unvented', 150)!
    expect(result.isReheatActive).toBe(false)
  })

  it('isReheatActive is true when systemMode is dhw_reheat', () => {
    const state = makeStoredState({ systemMode: 'dhw_reheat' })
    const result = useStoredHotWaterPlayback(state, 'unvented', 150)!
    expect(result.isReheatActive).toBe(true)
  })

  it('isReheatActive is true when systemMode is heating_and_reheat', () => {
    const state = makeStoredState({ systemMode: 'heating_and_reheat' })
    const result = useStoredHotWaterPlayback(state, 'unvented', 150)!
    expect(result.isReheatActive).toBe(true)
  })

  it('isReheatActive is false during active hot draw (not a reheat phase)', () => {
    const state = makeStoredState({ systemMode: 'heating', hotDrawActive: true })
    const result = useStoredHotWaterPlayback(state, 'unvented', 150)!
    expect(result.isReheatActive).toBe(false)
  })

  // ── Pass-through fields ────────────────────────────────────────────────────

  it('cylinderSizeLitres is passed through unchanged', () => {
    const state = makeStoredState()
    const result = useStoredHotWaterPlayback(state, 'unvented', 210)!
    expect(result.cylinderSizeLitres).toBe(210)
  })

  it('cylinderType is passed through unchanged', () => {
    const types: CylinderType[] = ['unvented', 'open_vented', 'mixergy']
    for (const t of types) {
      const state = makeStoredState()
      const result = useStoredHotWaterPlayback(state, t, 150)!
      expect(result.cylinderType).toBe(t)
    }
  })

  // ── Open vented ────────────────────────────────────────────────────────────

  it('works for open_vented system type', () => {
    const state = makeStoredState({ systemType: 'vented_cylinder', cylinderFillPct: 0.65 })
    const result = useStoredHotWaterPlayback(state, 'open_vented', 140)!
    expect(result).not.toBeNull()
    expect(result.availableHotWaterL).toBe(91)
    expect(result.cylinderType).toBe('open_vented')
  })

  // ── Mixergy advantage ──────────────────────────────────────────────────────

  it('Mixergy usableReserveFraction is 1.2× the fill fraction (clamped to 1.0)', () => {
    const state = makeStoredState({ cylinderFillPct: 0.6 })
    const result = useStoredHotWaterPlayback(state, 'mixergy', 150)!
    // 0.6 × 1.2 = 0.72
    expect(result.usableReserveFraction).toBeCloseTo(0.72, 5)
  })

  it('Mixergy usableReserveFraction is clamped to 1.0 when fill × 1.2 exceeds 1.0', () => {
    const state = makeStoredState({ cylinderFillPct: 1.0 })
    const result = useStoredHotWaterPlayback(state, 'mixergy', 150)!
    expect(result.usableReserveFraction).toBe(1.0)
  })

  it('Mixergy availableHotWaterL is greater than standard at same fill fraction', () => {
    const fill = 0.6
    const size = 150
    const state = makeStoredState({ cylinderFillPct: fill })
    const standard = useStoredHotWaterPlayback(state, 'unvented', size)!
    const mixergy = useStoredHotWaterPlayback(state, 'mixergy', size)!
    expect(mixergy.availableHotWaterL).toBeGreaterThan(standard.availableHotWaterL)
  })

  it('Mixergy deliveryTempC >= standard deliveryTempC at same fill fraction', () => {
    const fills = [0.3, 0.5, 0.7]
    for (const fill of fills) {
      const state = makeStoredState({ cylinderFillPct: fill })
      const standard = useStoredHotWaterPlayback(state, 'unvented', 150)!
      const mixergy = useStoredHotWaterPlayback(state, 'mixergy', 150)!
      expect(mixergy.deliveryTempC).toBeGreaterThanOrEqual(standard.deliveryTempC)
    }
  })

  it('Mixergy topTempC >= standard topTempC at same fill fraction', () => {
    const fills = [0.3, 0.5, 0.7]
    for (const fill of fills) {
      const state = makeStoredState({ cylinderFillPct: fill })
      const standard = useStoredHotWaterPlayback(state, 'unvented', 150)!
      const mixergy = useStoredHotWaterPlayback(state, 'mixergy', 150)!
      expect(mixergy.topTempC).toBeGreaterThanOrEqual(standard.topTempC)
    }
  })

  it('Mixergy topTempC stays near 60°C at moderate fill (stratification benefit)', () => {
    // At 70% fill, Mixergy top should be at or near setpoint (60°C)
    const state = makeStoredState({ cylinderFillPct: 0.70 })
    const result = useStoredHotWaterPlayback(state, 'mixergy', 150)!
    expect(result.topTempC).toBeGreaterThanOrEqual(58)
  })

  it('Mixergy bottomTempC is colder than standard at same fill (steeper gradient)', () => {
    const state = makeStoredState({ cylinderFillPct: 0.6 })
    const standard = useStoredHotWaterPlayback(state, 'unvented', 150)!
    const mixergy = useStoredHotWaterPlayback(state, 'mixergy', 150)!
    expect(mixergy.bottomTempC).toBeLessThanOrEqual(standard.bottomTempC)
  })

  // ── Cylinder size variations ───────────────────────────────────────────────

  it('availableHotWaterL scales linearly with cylinderSizeLitres', () => {
    const fill = 0.8
    const state = makeStoredState({ cylinderFillPct: fill })
    const small = useStoredHotWaterPlayback(state, 'unvented', 120)!
    const large = useStoredHotWaterPlayback(state, 'unvented', 300)!
    expect(large.availableHotWaterL).toBeGreaterThan(small.availableHotWaterL)
    // 120 × 0.8 = 96, 300 × 0.8 = 240
    expect(small.availableHotWaterL).toBe(96)
    expect(large.availableHotWaterL).toBe(240)
  })

  // ── Full cylinder ──────────────────────────────────────────────────────────

  it('full standard cylinder returns max delivery temp and full available litres', () => {
    const state = makeStoredState({ cylinderFillPct: 1.0 })
    const result = useStoredHotWaterPlayback(state, 'unvented', 150)!
    expect(result.availableHotWaterL).toBe(150)
    expect(result.deliveryTempC).toBe(55)
    expect(result.usableReserveFraction).toBe(1.0)
  })
})
