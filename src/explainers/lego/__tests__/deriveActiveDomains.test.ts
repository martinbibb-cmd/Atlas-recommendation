// src/explainers/lego/__tests__/deriveActiveDomains.test.ts
//
// Tests for the deriveActiveDomains() helper.
// Validates that domain-activation rules for combi and stored systems
// correctly separate heating, primary-coil, DHW draw, and cold supply.

import { describe, it, expect } from 'vitest'
import { deriveActiveDomains } from '../playScene/deriveActiveDomains'
import type { DeriveDomainInput } from '../playScene/deriveActiveDomains'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function combiInput(overrides: Partial<DeriveDomainInput> = {}): DeriveDomainInput {
  return {
    systemKind: 'combi',
    heatingDemand: false,
    dhwDraw: false,
    cylinderNeedsReheat: false,
    ...overrides,
  }
}

function storedInput(overrides: Partial<DeriveDomainInput> = {}): DeriveDomainInput {
  return {
    systemKind: 'stored',
    heatingDemand: false,
    dhwDraw: false,
    cylinderNeedsReheat: false,
    ...overrides,
  }
}

// ─── Combi rules ──────────────────────────────────────────────────────────────

describe('deriveActiveDomains — combi', () => {
  it('all domains off when idle', () => {
    const d = deriveActiveDomains(combiInput())
    expect(d.heating).toBe(false)
    expect(d.primary).toBe(false)
    expect(d.dhw).toBe(false)
    expect(d.cold).toBe(false)
  })

  it('heating active, no DHW: heating on, primary off, dhw off', () => {
    const d = deriveActiveDomains(combiInput({ heatingDemand: true }))
    expect(d.heating).toBe(true)
    expect(d.primary).toBe(false)
    expect(d.dhw).toBe(false)
    expect(d.cold).toBe(false)
  })

  it('DHW draw: dhw + cold on; heating suspended (combi priority)', () => {
    const d = deriveActiveDomains(combiInput({ dhwDraw: true }))
    expect(d.dhw).toBe(true)
    expect(d.cold).toBe(true)
    expect(d.heating).toBe(false)
    expect(d.primary).toBe(false)
  })

  it('heating + DHW draw: DHW draw suspends heating', () => {
    const d = deriveActiveDomains(combiInput({ heatingDemand: true, dhwDraw: true }))
    expect(d.dhw).toBe(true)
    expect(d.cold).toBe(true)
    expect(d.heating).toBe(false)
  })

  it('primary is NEVER active for combi (no cylinder coil)', () => {
    const d = deriveActiveDomains(combiInput({
      heatingDemand: true,
      dhwDraw: true,
      cylinderNeedsReheat: true, // ignored for combi
    }))
    expect(d.primary).toBe(false)
  })

  it('cylinderNeedsReheat flag is ignored for combi', () => {
    const d = deriveActiveDomains(combiInput({ cylinderNeedsReheat: true }))
    expect(d.primary).toBe(false)
  })
})

// ─── Stored rules ─────────────────────────────────────────────────────────────

describe('deriveActiveDomains — stored', () => {
  it('all domains off when idle', () => {
    const d = deriveActiveDomains(storedInput())
    expect(d.heating).toBe(false)
    expect(d.primary).toBe(false)
    expect(d.dhw).toBe(false)
    expect(d.cold).toBe(false)
  })

  it('CH only: heating on, primary off, dhw off, cold off', () => {
    const d = deriveActiveDomains(storedInput({ heatingDemand: true }))
    expect(d.heating).toBe(true)
    expect(d.primary).toBe(false)
    expect(d.dhw).toBe(false)
    expect(d.cold).toBe(false)
  })

  it('DHW draw only: dhw + cold on; heating off, primary off', () => {
    const d = deriveActiveDomains(storedInput({ dhwDraw: true }))
    expect(d.dhw).toBe(true)
    expect(d.cold).toBe(true)
    expect(d.heating).toBe(false)
    expect(d.primary).toBe(false)
  })

  it('DHW draw does NOT activate primary coil (no implicit reheat from draw)', () => {
    // A tap draw depletes the store over time; the coil only fires once the
    // hysteresis threshold is crossed — not on every draw event.
    const d = deriveActiveDomains(storedInput({ dhwDraw: true }))
    expect(d.primary).toBe(false)
  })

  it('cylinder reheat only: primary on; heating off, dhw off, cold off', () => {
    const d = deriveActiveDomains(storedInput({ cylinderNeedsReheat: true }))
    expect(d.primary).toBe(true)
    expect(d.heating).toBe(false)
    expect(d.dhw).toBe(false)
    expect(d.cold).toBe(false)
  })

  it('CH + cylinder reheat: heating + primary both on', () => {
    const d = deriveActiveDomains(storedInput({ heatingDemand: true, cylinderNeedsReheat: true }))
    expect(d.heating).toBe(true)
    expect(d.primary).toBe(true)
    expect(d.dhw).toBe(false)
    expect(d.cold).toBe(false)
  })

  it('DHW draw + cylinder reheat: dhw + cold + primary all on; heating off', () => {
    const d = deriveActiveDomains(storedInput({ dhwDraw: true, cylinderNeedsReheat: true }))
    expect(d.dhw).toBe(true)
    expect(d.cold).toBe(true)
    expect(d.primary).toBe(true)
    expect(d.heating).toBe(false)
  })

  it('CH + DHW draw + reheat: all four domains active (S-plan simultaneous)', () => {
    const d = deriveActiveDomains(storedInput({
      heatingDemand: true,
      dhwDraw: true,
      cylinderNeedsReheat: true,
    }))
    expect(d.heating).toBe(true)
    expect(d.primary).toBe(true)
    expect(d.dhw).toBe(true)
    expect(d.cold).toBe(true)
  })

  it('heating does not force dhw on (independent circuits)', () => {
    const d = deriveActiveDomains(storedInput({ heatingDemand: true }))
    expect(d.dhw).toBe(false)
  })

  it('DHW draw does not force heating on (independent circuits)', () => {
    const d = deriveActiveDomains(storedInput({ dhwDraw: true }))
    expect(d.heating).toBe(false)
  })
})

// ─── PR8 boundary-condition regression tests ─────────────────────────────────
//
// These tests lock in the subtle "don't regress" cases identified in PR8.
// Each scenario is named after the system state it models so future
// "helpful simplifications" that break stored behaviour will surface here.

describe('PR8 boundary — stored draw with charged cylinder', () => {
  // Cylinder has charge — no reheat needed.  Only DHW draw is active.
  // Primary coil must NOT fire — the stored energy is enough.
  it('dhw: true, cold: true, primary: false, heating: false', () => {
    const d = deriveActiveDomains(storedInput({
      dhwDraw: true,
      cylinderNeedsReheat: false,
    }))
    expect(d.dhw).toBe(true)
    expect(d.cold).toBe(true)
    expect(d.primary).toBe(false)
    expect(d.heating).toBe(false)
  })
})

describe('PR8 boundary — stored draw plus heating call', () => {
  // Tap is open AND thermostat is calling for heat.
  // Both heating and DHW circuits run; primary coil fires only if reheat needed.
  it('dhwDraw + heatingDemand, no reheat: heating true, dhw true, primary false', () => {
    const d = deriveActiveDomains(storedInput({
      heatingDemand: true,
      dhwDraw: true,
      cylinderNeedsReheat: false,
    }))
    expect(d.heating).toBe(true)
    expect(d.dhw).toBe(true)
    expect(d.cold).toBe(true)
    expect(d.primary).toBe(false)
  })

  it('dhwDraw + heatingDemand + reheat: all four domains active', () => {
    const d = deriveActiveDomains(storedInput({
      heatingDemand: true,
      dhwDraw: true,
      cylinderNeedsReheat: true,
    }))
    expect(d.heating).toBe(true)
    expect(d.dhw).toBe(true)
    expect(d.cold).toBe(true)
    expect(d.primary).toBe(true)
  })
})

describe('PR8 boundary — stored reheat only (no draw, no CH)', () => {
  // Store dropped below threshold; coil fires but no tap open and no CH demand.
  it('primary: true, heating: false, dhw: false, cold: false', () => {
    const d = deriveActiveDomains(storedInput({
      cylinderNeedsReheat: true,
    }))
    expect(d.primary).toBe(true)
    expect(d.heating).toBe(false)
    expect(d.dhw).toBe(false)
    expect(d.cold).toBe(false)
  })
})

describe('PR8 boundary — combi DHW priority / CH suspension', () => {
  // On a combi, a hot-water draw suspends the heating circuit.
  // This is the "simplified priority model" documented in deriveActiveDomains.
  it('combi DHW draw suspends heating even when thermostat is calling', () => {
    const d = deriveActiveDomains(combiInput({
      heatingDemand: true,
      dhwDraw: true,
    }))
    expect(d.dhw).toBe(true)
    expect(d.cold).toBe(true)
    expect(d.heating).toBe(false)
    expect(d.primary).toBe(false)
  })

  it('combi DHW draw alone: dhw + cold on, heating + primary off', () => {
    const d = deriveActiveDomains(combiInput({ dhwDraw: true }))
    expect(d.dhw).toBe(true)
    expect(d.cold).toBe(true)
    expect(d.heating).toBe(false)
    expect(d.primary).toBe(false)
  })

  it('combi primary is NEVER active regardless of cylinderNeedsReheat', () => {
    // Combi systems have no cylinder — the reheat flag must be ignored.
    const d = deriveActiveDomains(combiInput({
      dhwDraw: true,
      cylinderNeedsReheat: true,
    }))
    expect(d.primary).toBe(false)
  })
})
