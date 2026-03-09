/**
 * Tests for PR7 condensing-state indicator — `condensingState.ts`.
 *
 * Covers:
 *  - deriveCondensingState threshold mapping (< 50, 50–55, > 55)
 *  - boundary / edge values at exactly 50 and 55
 *  - isBoilerHeatSource — boiler types return true, heat_pump returns false
 *  - condensingStateBadgeText — expected labels for each state
 *  - condensingStateDescription — contains the word "condensing" and
 *    mentions return temperature
 *  - Stable derivation — pure functions with no observable side effects
 */

import { describe, it, expect } from 'vitest'
import {
  deriveCondensingState,
  isBoilerHeatSource,
  condensingStateBadgeText,
  condensingStateDescription,
  CONDENSING_RETURN_THRESHOLD_C,
  CONDENSING_BORDERLINE_LOW_C,
} from '../sim/condensingState'
import type { HeatSourceType } from '../animation/types'

// ─── Constants ────────────────────────────────────────────────────────────────

describe('module constants', () => {
  it('CONDENSING_RETURN_THRESHOLD_C is 55', () => {
    expect(CONDENSING_RETURN_THRESHOLD_C).toBe(55)
  })

  it('CONDENSING_BORDERLINE_LOW_C is 50', () => {
    expect(CONDENSING_BORDERLINE_LOW_C).toBe(50)
  })
})

// ─── deriveCondensingState — threshold mapping ────────────────────────────────

describe('deriveCondensingState — below borderline zone', () => {
  it('returns "condensing" for 30 °C', () => {
    expect(deriveCondensingState(30)).toBe('condensing')
  })

  it('returns "condensing" for 45 °C', () => {
    expect(deriveCondensingState(45)).toBe('condensing')
  })

  it('returns "condensing" for 49.9 °C', () => {
    expect(deriveCondensingState(49.9)).toBe('condensing')
  })
})

describe('deriveCondensingState — borderline zone', () => {
  it('returns "borderline" at exactly 50 °C (lower boundary)', () => {
    expect(deriveCondensingState(50)).toBe('borderline')
  })

  it('returns "borderline" at 52 °C (mid-zone)', () => {
    expect(deriveCondensingState(52)).toBe('borderline')
  })

  it('returns "borderline" at exactly 55 °C (upper boundary — still borderline)', () => {
    expect(deriveCondensingState(55)).toBe('borderline')
  })
})

describe('deriveCondensingState — above threshold', () => {
  it('returns "not_condensing" at 55.1 °C (just above threshold)', () => {
    expect(deriveCondensingState(55.1)).toBe('not_condensing')
  })

  it('returns "not_condensing" at 60 °C', () => {
    expect(deriveCondensingState(60)).toBe('not_condensing')
  })

  it('returns "not_condensing" at 75 °C', () => {
    expect(deriveCondensingState(75)).toBe('not_condensing')
  })
})

describe('deriveCondensingState — stable derivation (no mutation)', () => {
  it('calling twice with the same input returns the same value', () => {
    expect(deriveCondensingState(48)).toBe(deriveCondensingState(48))
    expect(deriveCondensingState(52)).toBe(deriveCondensingState(52))
    expect(deriveCondensingState(60)).toBe(deriveCondensingState(60))
  })
})

// ─── isBoilerHeatSource — boiler-only applicability ───────────────────────────

describe('isBoilerHeatSource — boiler types', () => {
  const boilerTypes: HeatSourceType[] = ['combi', 'system_boiler', 'regular_boiler']

  for (const t of boilerTypes) {
    it(`returns true for "${t}"`, () => {
      expect(isBoilerHeatSource(t)).toBe(true)
    })
  }
})

describe('isBoilerHeatSource — non-boiler types', () => {
  it('returns false for "heat_pump"', () => {
    expect(isBoilerHeatSource('heat_pump')).toBe(false)
  })
})

// ─── condensingStateBadgeText ─────────────────────────────────────────────────

describe('condensingStateBadgeText', () => {
  it('returns a string containing "Condensing" for condensing state', () => {
    expect(condensingStateBadgeText('condensing')).toContain('Condensing')
  })

  it('returns a string containing "Borderline" for borderline state', () => {
    expect(condensingStateBadgeText('borderline')).toContain('Borderline')
  })

  it('returns a string containing "Not condensing" for not_condensing state', () => {
    expect(condensingStateBadgeText('not_condensing')).toContain('Not condensing')
  })

  it('badge texts are distinct for each state', () => {
    const texts = [
      condensingStateBadgeText('condensing'),
      condensingStateBadgeText('borderline'),
      condensingStateBadgeText('not_condensing'),
    ]
    const unique = new Set(texts)
    expect(unique.size).toBe(3)
  })
})

// ─── condensingStateDescription ───────────────────────────────────────────────

describe('condensingStateDescription — content checks', () => {
  it('condensing description mentions latent heat recovery', () => {
    const desc = condensingStateDescription('condensing')
    expect(desc.toLowerCase()).toContain('latent heat')
  })

  it('borderline description mentions threshold/efficiency', () => {
    const desc = condensingStateDescription('borderline')
    expect(desc.toLowerCase()).toMatch(/threshold|efficiency/)
  })

  it('not_condensing description mentions return temperature', () => {
    const desc = condensingStateDescription('not_condensing')
    expect(desc.toLowerCase()).toContain('return temperature')
  })

  it('all descriptions are non-empty strings', () => {
    expect(condensingStateDescription('condensing').length).toBeGreaterThan(0)
    expect(condensingStateDescription('borderline').length).toBeGreaterThan(0)
    expect(condensingStateDescription('not_condensing').length).toBeGreaterThan(0)
  })

  it('descriptions are distinct for each state', () => {
    const descs = [
      condensingStateDescription('condensing'),
      condensingStateDescription('borderline'),
      condensingStateDescription('not_condensing'),
    ]
    const unique = new Set(descs)
    expect(unique.size).toBe(3)
  })
})
