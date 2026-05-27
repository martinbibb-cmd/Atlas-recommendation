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

// ─── CondensingQuality — deriveCondensingQuality ──────────────────────────────

import {
  deriveCondensingQuality,
  condensingQualityLabel,
  condensingQualityDescription,
} from '../sim/condensingState'
import type { CondensingQuality } from '../sim/condensingState'

describe('deriveCondensingQuality', () => {
  it('returns condensing_reliably when design load return temp < 50°C', () => {
    // e.g. UFH or oversized radiators at design load
    expect(deriveCondensingQuality(45, 45)).toBe('condensing_reliably')
    expect(deriveCondensingQuality(49, 40)).toBe('condensing_reliably')
  })

  it('returns can_condense_at_low_load when design return ≥ 50°C but current < 50°C', () => {
    // Standard radiators (design 58°C) with load compensation (current 46°C)
    expect(deriveCondensingQuality(58, 46)).toBe('can_condense_at_low_load')
    expect(deriveCondensingQuality(65, 40)).toBe('can_condense_at_low_load')
  })

  it('returns high_flow_temp_required when current return is in borderline zone (50–55°C)', () => {
    expect(deriveCondensingQuality(60, 52)).toBe('high_flow_temp_required')
    expect(deriveCondensingQuality(60, 55)).toBe('high_flow_temp_required')
  })

  it('returns rarely_condensing when both design and current return > 55°C', () => {
    expect(deriveCondensingQuality(70, 58)).toBe('rarely_condensing')
    expect(deriveCondensingQuality(65, 60)).toBe('rarely_condensing')
  })

  it('without load compensation (design == current), standard radiators are rarely_condensing', () => {
    // Standard radiators: requiredFlowTempC = 70°C, estimatedReturnTempC = 58°C
    expect(deriveCondensingQuality(58, 58)).toBe('rarely_condensing')
  })

  it('with load compensation, standard radiators can condense at low load', () => {
    // Load comp: currentLoadReturnTempC = 58 − 12 = 46°C
    expect(deriveCondensingQuality(58, 46)).toBe('can_condense_at_low_load')
  })
})

describe('condensingQualityLabel', () => {
  const allQualities: CondensingQuality[] = [
    'condensing_reliably',
    'can_condense_at_low_load',
    'high_flow_temp_required',
    'rarely_condensing',
  ]

  it('returns a non-empty label for every quality state', () => {
    allQualities.forEach(q => {
      expect(condensingQualityLabel(q).length).toBeGreaterThan(0)
    })
  })

  it('labels are distinct for each quality state', () => {
    const labels = allQualities.map(condensingQualityLabel)
    const unique = new Set(labels)
    expect(unique.size).toBe(4)
  })

  it('condensing_reliably label contains "reliably"', () => {
    expect(condensingQualityLabel('condensing_reliably').toLowerCase()).toContain('reliably')
  })

  it('can_condense_at_low_load label mentions load', () => {
    expect(condensingQualityLabel('can_condense_at_low_load').toLowerCase()).toContain('load')
  })

  it('rarely_condensing label mentions "rarely"', () => {
    expect(condensingQualityLabel('rarely_condensing').toLowerCase()).toContain('rarely')
  })
})

describe('condensingQualityDescription', () => {
  const allQualities: CondensingQuality[] = [
    'condensing_reliably',
    'can_condense_at_low_load',
    'high_flow_temp_required',
    'rarely_condensing',
  ]

  it('returns a non-empty description for every quality state', () => {
    allQualities.forEach(q => {
      expect(condensingQualityDescription(q).length).toBeGreaterThan(0)
    })
  })

  it('descriptions are distinct for each quality state', () => {
    const descs = allQualities.map(condensingQualityDescription)
    const unique = new Set(descs)
    expect(unique.size).toBe(4)
  })
})
