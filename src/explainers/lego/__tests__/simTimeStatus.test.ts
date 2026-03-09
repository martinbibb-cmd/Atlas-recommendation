// src/explainers/lego/__tests__/simTimeStatus.test.ts
//
// Tests for the sim-time-bar status badge helpers (render/simTimeStatus.ts).
//
// Coverage:
//   - systemTypeLabel: correct label per SystemType / DerivedSystemKind
//   - serviceModeSummary: correct short label per SystemMode

import { describe, it, expect } from 'vitest'
import { systemTypeLabel, serviceModeSummary } from '../animation/render/simTimeStatus'

// ─── systemTypeLabel ──────────────────────────────────────────────────────────

describe('systemTypeLabel', () => {
  it('returns "Combi boiler" for combi systemType', () => {
    expect(systemTypeLabel('combi', undefined)).toBe('Combi boiler')
    expect(systemTypeLabel('combi', 'combi')).toBe('Combi boiler')
  })

  it('returns "Unvented cylinder" for unvented_cylinder systemType', () => {
    expect(systemTypeLabel('unvented_cylinder', undefined)).toBe('Unvented cylinder')
    expect(systemTypeLabel('unvented_cylinder', 'stored')).toBe('Unvented cylinder')
  })

  it('returns "Vented cylinder" for vented_cylinder systemType', () => {
    expect(systemTypeLabel('vented_cylinder', undefined)).toBe('Vented cylinder')
    expect(systemTypeLabel('vented_cylinder', 'stored')).toBe('Vented cylinder')
  })

  it('returns "Heat pump" when systemKind is heat_pump, regardless of systemType', () => {
    expect(systemTypeLabel('vented_cylinder', 'heat_pump')).toBe('Heat pump')
    expect(systemTypeLabel('unvented_cylinder', 'heat_pump')).toBe('Heat pump')
  })

  it('falls back to "Combi boiler" for unknown systemType', () => {
    expect(systemTypeLabel('unknown_future_type', undefined)).toBe('Combi boiler')
  })
})

// ─── serviceModeSummary ───────────────────────────────────────────────────────

describe('serviceModeSummary', () => {
  it('returns "Idle" for idle mode', () => {
    expect(serviceModeSummary('idle')).toBe('Idle')
  })

  it('returns "CH" for heating mode', () => {
    expect(serviceModeSummary('heating')).toBe('CH')
  })

  it('returns "DHW" for dhw_draw mode', () => {
    expect(serviceModeSummary('dhw_draw')).toBe('DHW')
  })

  it('returns "Reheat" for dhw_reheat mode', () => {
    expect(serviceModeSummary('dhw_reheat')).toBe('Reheat')
  })

  it('returns "CH + Reheat" for heating_and_reheat mode', () => {
    expect(serviceModeSummary('heating_and_reheat')).toBe('CH + Reheat')
  })

  it('returns "Idle" for any unknown mode', () => {
    expect(serviceModeSummary('unknown_mode')).toBe('Idle')
    expect(serviceModeSummary('')).toBe('Idle')
  })
})
