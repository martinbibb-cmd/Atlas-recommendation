/**
 * Tests for useDailyEfficiencySummary — the daily efficiency summary adapter.
 *
 * Validates that computeDailyEfficiencySummary:
 *   - Returns 'boiler' systemKind for combi/unvented/open_vented system choices
 *   - Returns 'heat_pump' systemKind for heat_pump system choice
 *   - Returns a dailyEfficiencyPct in [50, 99] for boilers
 *   - Returns a dailyCop clamped to [1.5, 4.5] for heat pumps
 *   - Efficiency is lower when systemCondition is sludged vs clean
 *   - Efficiency is lower when systemCondition is scaled vs clean
 *   - Family + combi has lower efficiency than professional + combi (more cycling)
 *   - loadCompensation improves efficiency when condensing gain is possible
 *   - explanationLine changes meaningfully with system condition
 *   - Daily COP is lower for family profile than professional (more DHW cycling)
 *   - System condition sludged reduces heat pump COP
 *   - summaryValue is formatted correctly for boilers and heat pumps
 */

import { describe, it, expect } from 'vitest'
import { computeDailyEfficiencySummary } from '../simulator/useDailyEfficiencySummary'
import type { SystemInputs } from '../simulator/systemInputsTypes'
import { DEFAULT_SYSTEM_INPUTS } from '../simulator/systemInputsTypes'
import type { EmitterPrimaryDisplayState } from '../simulator/useEmitterPrimaryModel'

// ─── State factories ──────────────────────────────────────────────────────────

function baseEmitter(overrides: Partial<EmitterPrimaryDisplayState> = {}): EmitterPrimaryDisplayState {
  return {
    requiredFlowTempC: 70,
    estimatedReturnTempC: 58,
    currentLoadFlowTempC: 58,
    currentLoadReturnTempC: 46,
    emitterAdequate: true,
    primaryAdequate: true,
    heatDemandKw: 14,
    primaryCapacityKw: 25,
    estimatedCop: 3.2,
    ...overrides,
  }
}

function baseInputs(overrides: Partial<SystemInputs> = {}): SystemInputs {
  return { ...DEFAULT_SYSTEM_INPUTS, ...overrides }
}

// ─── systemKind ───────────────────────────────────────────────────────────────

describe('computeDailyEfficiencySummary — systemKind', () => {
  it('returns boiler for combi system', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'combi', baseEmitter())
    expect(result.systemKind).toBe('boiler')
  })

  it('returns boiler for unvented system', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'unvented', baseEmitter())
    expect(result.systemKind).toBe('boiler')
  })

  it('returns boiler for open_vented system', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'open_vented', baseEmitter())
    expect(result.systemKind).toBe('boiler')
  })

  it('returns heat_pump for heat pump system', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'heat_pump', baseEmitter())
    expect(result.systemKind).toBe('heat_pump')
  })
})

// ─── Boiler efficiency bounds ─────────────────────────────────────────────────

describe('computeDailyEfficiencySummary — boiler efficiency bounds', () => {
  it('dailyEfficiencyPct is in [50, 99] for a clean system', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'combi', baseEmitter())
    expect(result.dailyEfficiencyPct).toBeGreaterThanOrEqual(50)
    expect(result.dailyEfficiencyPct).toBeLessThanOrEqual(99)
  })

  it('summaryValue for boiler ends with "%"', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'combi', baseEmitter())
    expect(result.summaryValue).toMatch(/%$/)
  })

  it('summaryLabel mentions "efficiency" for boilers', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'combi', baseEmitter())
    expect(result.summaryLabel.toLowerCase()).toContain('efficiency')
  })
})

// ─── Heat pump COP bounds ────────────────────────────────────────────────────

describe('computeDailyEfficiencySummary — heat pump COP bounds', () => {
  it('dailyCop is in [1.5, 4.5] range', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'heat_pump', baseEmitter())
    expect(result.dailyCop).toBeGreaterThanOrEqual(1.5)
    expect(result.dailyCop).toBeLessThanOrEqual(4.5)
  })

  it('summaryValue for heat pump is a number string (no "%")', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'heat_pump', baseEmitter())
    expect(result.summaryValue).not.toMatch(/%/)
    expect(Number(result.summaryValue)).toBeGreaterThan(0)
  })

  it('summaryLabel mentions "COP" for heat pumps', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'heat_pump', baseEmitter())
    expect(result.summaryLabel).toContain('COP')
  })
})

// ─── System condition effects ─────────────────────────────────────────────────

describe('computeDailyEfficiencySummary — system condition', () => {
  it('sludged system has lower boiler efficiency than clean', () => {
    const clean   = computeDailyEfficiencySummary(baseInputs({ systemCondition: 'clean'   }), 'combi', baseEmitter())
    const sludged = computeDailyEfficiencySummary(baseInputs({ systemCondition: 'sludged' }), 'combi', baseEmitter())
    expect(sludged.dailyEfficiencyPct!).toBeLessThan(clean.dailyEfficiencyPct!)
  })

  it('scaled system has lower boiler efficiency than clean', () => {
    const clean  = computeDailyEfficiencySummary(baseInputs({ systemCondition: 'clean'  }), 'combi', baseEmitter())
    const scaled = computeDailyEfficiencySummary(baseInputs({ systemCondition: 'scaled' }), 'combi', baseEmitter())
    expect(scaled.dailyEfficiencyPct!).toBeLessThan(clean.dailyEfficiencyPct!)
  })

  it('sludged explanation mentions magnetite', () => {
    const result = computeDailyEfficiencySummary(
      baseInputs({ systemCondition: 'sludged' }),
      'combi',
      baseEmitter(),
    )
    expect(result.explanationLine.toLowerCase()).toContain('magnetite')
  })

  it('scaled explanation mentions scale', () => {
    const result = computeDailyEfficiencySummary(
      baseInputs({ systemCondition: 'scaled' }),
      'combi',
      baseEmitter(),
    )
    expect(result.explanationLine.toLowerCase()).toContain('scale')
  })

  it('sludged HP system has lower COP than clean', () => {
    const clean   = computeDailyEfficiencySummary(baseInputs({ systemCondition: 'clean'   }), 'heat_pump', baseEmitter())
    const sludged = computeDailyEfficiencySummary(baseInputs({ systemCondition: 'sludged' }), 'heat_pump', baseEmitter())
    expect(sludged.dailyCop!).toBeLessThan(clean.dailyCop!)
  })
})

// ─── Occupancy profile effects ────────────────────────────────────────────────

describe('computeDailyEfficiencySummary — occupancy profile effects', () => {
  it('family + combi has lower efficiency than professional + combi', () => {
    const professional = computeDailyEfficiencySummary(
      baseInputs({ occupancyProfile: 'professional' }),
      'combi',
      baseEmitter(),
    )
    const family = computeDailyEfficiencySummary(
      baseInputs({ occupancyProfile: 'family' }),
      'combi',
      baseEmitter(),
    )
    expect(family.dailyEfficiencyPct!).toBeLessThan(professional.dailyEfficiencyPct!)
  })

  it('family + heat_pump has lower COP than professional + heat_pump', () => {
    const professional = computeDailyEfficiencySummary(
      baseInputs({ occupancyProfile: 'professional' }),
      'heat_pump',
      baseEmitter(),
    )
    const family = computeDailyEfficiencySummary(
      baseInputs({ occupancyProfile: 'family' }),
      'heat_pump',
      baseEmitter(),
    )
    expect(family.dailyCop!).toBeLessThan(professional.dailyCop!)
  })
})

// ─── Load compensation effects ────────────────────────────────────────────────

describe('computeDailyEfficiencySummary — load compensation', () => {
  it('load compensation improves boiler efficiency when emitters allow low return temps', () => {
    // Low return temp emitter (good for condensing)
    const goodEmitter = baseEmitter({ estimatedReturnTempC: 58, currentLoadReturnTempC: 40 })
    const without = computeDailyEfficiencySummary(
      baseInputs({ loadCompensation: false }),
      'combi',
      goodEmitter,
    )
    const with_ = computeDailyEfficiencySummary(
      baseInputs({ loadCompensation: true }),
      'combi',
      goodEmitter,
    )
    expect(with_.dailyEfficiencyPct!).toBeGreaterThan(without.dailyEfficiencyPct!)
  })

  it('load compensation improves heat pump COP', () => {
    const without = computeDailyEfficiencySummary(
      baseInputs({ loadCompensation: false }),
      'heat_pump',
      baseEmitter(),
    )
    const with_ = computeDailyEfficiencySummary(
      baseInputs({ loadCompensation: true }),
      'heat_pump',
      baseEmitter(),
    )
    expect(with_.dailyCop!).toBeGreaterThan(without.dailyCop!)
  })
})

// ─── explanation line is always a non-empty string ───────────────────────────

describe('computeDailyEfficiencySummary — explanationLine', () => {
  it('is always a non-empty string for boiler', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'combi', baseEmitter())
    expect(typeof result.explanationLine).toBe('string')
    expect(result.explanationLine.length).toBeGreaterThan(0)
  })

  it('is always a non-empty string for heat pump', () => {
    const result = computeDailyEfficiencySummary(baseInputs(), 'heat_pump', baseEmitter())
    expect(typeof result.explanationLine).toBe('string')
    expect(result.explanationLine.length).toBeGreaterThan(0)
  })
})
