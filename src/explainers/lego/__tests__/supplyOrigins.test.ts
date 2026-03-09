/**
 * Tests for supplyOrigins.ts — explicit supply-origin mapping.
 *
 * Validates that supplyOriginsForSystemType() returns the correct source nodes
 * for each system type, heat pump variant, and heating-circuit presence flag.
 */

import { describe, it, expect } from 'vitest'
import { supplyOriginsForSystemType } from '../sim/supplyOrigins'

describe('supplyOriginsForSystemType — combi', () => {
  it('combi: mainsColdIn present, no cwsTankCold, no dhwHotStore', () => {
    const origins = supplyOriginsForSystemType('combi')
    expect(origins.mainsColdIn).toBe('mains_cold_in')
    expect(origins.cwsTankCold).toBeUndefined()
    expect(origins.dhwHotStore).toBeUndefined()
  })

  it('combi: primaryHeatingLoop present by default', () => {
    const origins = supplyOriginsForSystemType('combi')
    expect(origins.primaryHeatingLoop).toBe('primary_heating_loop')
  })

  it('combi: primaryHeatingLoop absent when hasHeatingCircuit = false', () => {
    const origins = supplyOriginsForSystemType('combi', { hasHeatingCircuit: false })
    expect(origins.primaryHeatingLoop).toBeUndefined()
  })

  it('combi: outsideHeatSource absent (not a heat pump)', () => {
    const origins = supplyOriginsForSystemType('combi')
    expect(origins.outsideHeatSource).toBeUndefined()
  })
})

describe('supplyOriginsForSystemType — unvented_cylinder', () => {
  it('unvented: mainsColdIn present', () => {
    const origins = supplyOriginsForSystemType('unvented_cylinder')
    expect(origins.mainsColdIn).toBe('mains_cold_in')
  })

  it('unvented: dhwHotStore present', () => {
    const origins = supplyOriginsForSystemType('unvented_cylinder')
    expect(origins.dhwHotStore).toBe('dhw_hot_store')
  })

  it('unvented: cwsTankCold absent', () => {
    const origins = supplyOriginsForSystemType('unvented_cylinder')
    expect(origins.cwsTankCold).toBeUndefined()
  })

  it('unvented: primaryHeatingLoop present by default', () => {
    const origins = supplyOriginsForSystemType('unvented_cylinder')
    expect(origins.primaryHeatingLoop).toBe('primary_heating_loop')
  })
})

describe('supplyOriginsForSystemType — vented_cylinder', () => {
  it('vented: cwsTankCold present, not mainsColdIn', () => {
    const origins = supplyOriginsForSystemType('vented_cylinder')
    expect(origins.cwsTankCold).toBe('cws_tank_cold')
    expect(origins.mainsColdIn).toBeUndefined()
  })

  it('vented: dhwHotStore present', () => {
    const origins = supplyOriginsForSystemType('vented_cylinder')
    expect(origins.dhwHotStore).toBe('dhw_hot_store')
  })

  it('vented: primaryHeatingLoop present by default', () => {
    const origins = supplyOriginsForSystemType('vented_cylinder')
    expect(origins.primaryHeatingLoop).toBe('primary_heating_loop')
  })
})

describe('supplyOriginsForSystemType — heat pump variant', () => {
  it('unvented + heat pump: outsideHeatSource present', () => {
    const origins = supplyOriginsForSystemType('unvented_cylinder', { isHeatPump: true })
    expect(origins.outsideHeatSource).toBe('outside_heat_source')
  })

  it('vented + heat pump: outsideHeatSource present', () => {
    const origins = supplyOriginsForSystemType('vented_cylinder', { isHeatPump: true })
    expect(origins.outsideHeatSource).toBe('outside_heat_source')
  })

  it('combi (non-HP): outsideHeatSource absent even with isHeatPump false', () => {
    const origins = supplyOriginsForSystemType('combi', { isHeatPump: false })
    expect(origins.outsideHeatSource).toBeUndefined()
  })
})

describe('supplyOriginsForSystemType — no heating circuit', () => {
  it('vented without heating circuit: primaryHeatingLoop absent', () => {
    const origins = supplyOriginsForSystemType('vented_cylinder', { hasHeatingCircuit: false })
    expect(origins.primaryHeatingLoop).toBeUndefined()
  })

  it('unvented without heating circuit: primaryHeatingLoop absent', () => {
    const origins = supplyOriginsForSystemType('unvented_cylinder', { hasHeatingCircuit: false })
    expect(origins.primaryHeatingLoop).toBeUndefined()
  })
})
