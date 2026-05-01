// src/lib/__tests__/mainsSupply.test.ts
//
// Tests for the canonical MainsSupply shared object helpers.
//
// Coverage:
//   - extractMainsSupplyFromSurvey: source tagging for measured/estimated/default
//   - getEffectiveProposedMainsSupply: passthrough and supply-upgrade override
//   - buildCombiHexRemovalAdjustment: Q ∝ √P correction for combi → stored switch

import { describe, it, expect } from 'vitest'
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1'
import {
  extractMainsSupplyFromSurvey,
  getEffectiveProposedMainsSupply,
  buildCombiHexRemovalAdjustment,
  COMBI_HEX_PRESSURE_DROP_BAR,
} from '../simulator/mainsSupply'
import type { ProposedSupplyAdjustment } from '../simulator/mainsSupply'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function minimalSurvey(overrides: Partial<FullSurveyModelV1> = {}): FullSurveyModelV1 {
  return {
    postcode: 'SW1A 1AA',
    dynamicMainsPressure: 1.0,
    primaryPipeDiameter: 22,
    heatLossWatts: 8000,
    radiatorCount: 10,
    bathroomCount: 1,
    occupancyCount: 2,
    hasLoftConversion: false,
    returnWaterTemp: 45,
    occupancySignature: 'professional',
    buildingMass: 'medium',
    highOccupancy: false,
    preferCombi: false,
    ...overrides,
  }
}

// ─── extractMainsSupplyFromSurvey — source = 'measured' ──────────────────────

describe('extractMainsSupplyFromSurvey — measured source', () => {
  it('tags source as measured when mainsDynamicFlowLpmKnown is true', () => {
    const supply = extractMainsSupplyFromSurvey(
      minimalSurvey({ mainsDynamicFlowLpm: 7, mainsDynamicFlowLpmKnown: true }),
    )
    expect(supply.source).toBe('measured')
  })

  it('captures flow value when measured', () => {
    const supply = extractMainsSupplyFromSurvey(
      minimalSurvey({ mainsDynamicFlowLpm: 7, mainsDynamicFlowLpmKnown: true }),
    )
    expect(supply.dynamicFlowLpm).toBe(7)
  })

  it('captures dynamic pressure from dynamicMainsPressure when measured', () => {
    const supply = extractMainsSupplyFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.0,
        mainsDynamicFlowLpm: 7,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    expect(supply.dynamicPressureBar).toBe(1.0)
  })

  it('prefers dynamicMainsPressureBar over dynamicMainsPressure', () => {
    const supply = extractMainsSupplyFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.0,
        dynamicMainsPressureBar: 2.5,
        mainsDynamicFlowLpm: 7,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    expect(supply.dynamicPressureBar).toBe(2.5)
  })

  it('captures static pressure when provided', () => {
    const supply = extractMainsSupplyFromSurvey(
      minimalSurvey({
        staticMainsPressureBar: 3.0,
        mainsDynamicFlowLpm: 7,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    expect(supply.staticPressureBar).toBe(3.0)
  })
})

// ─── extractMainsSupplyFromSurvey — source = 'estimated' ─────────────────────

describe('extractMainsSupplyFromSurvey — estimated source', () => {
  it('tags source as estimated when flow is present but Known flag is absent', () => {
    const supply = extractMainsSupplyFromSurvey(
      minimalSurvey({ mainsDynamicFlowLpm: 7 }),
    )
    expect(supply.source).toBe('estimated')
  })

  it('tags source as estimated when mainsDynamicFlowLpmKnown is false', () => {
    const supply = extractMainsSupplyFromSurvey(
      minimalSurvey({ mainsDynamicFlowLpm: 7, mainsDynamicFlowLpmKnown: false }),
    )
    expect(supply.source).toBe('estimated')
  })

  it('still captures flow value when estimated', () => {
    const supply = extractMainsSupplyFromSurvey(
      minimalSurvey({ mainsDynamicFlowLpm: 7, mainsDynamicFlowLpmKnown: false }),
    )
    expect(supply.dynamicFlowLpm).toBe(7)
  })

  it('tags pressure-only survey as estimated when no flow is recorded', () => {
    // Survey has a pressure value (required field) but no flow measurement.
    // The supply should be estimated, not measured.
    const supply = extractMainsSupplyFromSurvey(
      minimalSurvey({ dynamicMainsPressure: 1.0 }),
    )
    expect(supply.source).toBe('estimated')
    expect(supply.dynamicPressureBar).toBe(1.0)
    expect(supply.dynamicFlowLpm).toBeNull()
  })
})

// ─── extractMainsSupplyFromSurvey — source = 'default' ───────────────────────

describe('extractMainsSupplyFromSurvey — default source', () => {
  it('tags source as default when pressure is zero and no flow', () => {
    const supply = extractMainsSupplyFromSurvey(
      minimalSurvey({ dynamicMainsPressure: 0 }),
    )
    expect(supply.source).toBe('default')
  })
})

// ─── getEffectiveProposedMainsSupply — no adjustment ─────────────────────────

describe('getEffectiveProposedMainsSupply — no supply upgrade', () => {
  it('returns measured supply unchanged when no adjustment is provided', () => {
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.0,
        mainsDynamicFlowLpm: 7,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    const effective = getEffectiveProposedMainsSupply(measured, undefined)
    expect(effective.dynamicFlowLpm).toBe(7)
    expect(effective.dynamicPressureBar).toBe(1.0)
    expect(effective.source).toBe('measured')
  })

  it('returns measured supply unchanged when adjustment type is none', () => {
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.0,
        mainsDynamicFlowLpm: 7,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    const adjustment: ProposedSupplyAdjustment = { type: 'none' }
    const effective = getEffectiveProposedMainsSupply(measured, adjustment)
    expect(effective.dynamicFlowLpm).toBe(7)
    expect(effective.dynamicPressureBar).toBe(1.0)
  })

  it('returns estimated supply unchanged when no adjustment', () => {
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({ dynamicMainsPressure: 1.0, mainsDynamicFlowLpm: 7 }),
    )
    const effective = getEffectiveProposedMainsSupply(measured, undefined)
    expect(effective.dynamicFlowLpm).toBe(7)
    expect(effective.source).toBe('estimated')
  })
})

// ─── getEffectiveProposedMainsSupply — with booster upgrade ──────────────────

describe('getEffectiveProposedMainsSupply — booster proposed', () => {
  it('overrides flow when booster is proposed', () => {
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.0,
        mainsDynamicFlowLpm: 7,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    const adjustment: ProposedSupplyAdjustment = {
      type: 'booster',
      adjustedDynamicFlowLpm: 18,
      adjustedDynamicPressureBar: 2.5,
      note: 'with booster set',
    }
    const effective = getEffectiveProposedMainsSupply(measured, adjustment)
    expect(effective.dynamicFlowLpm).toBe(18)
    expect(effective.dynamicPressureBar).toBe(2.5)
  })

  it('preserves source from measured supply after booster upgrade', () => {
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.0,
        mainsDynamicFlowLpm: 7,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    const adjustment: ProposedSupplyAdjustment = {
      type: 'booster',
      adjustedDynamicFlowLpm: 18,
    }
    const effective = getEffectiveProposedMainsSupply(measured, adjustment)
    expect(effective.source).toBe('measured')
  })

  it('preserves un-adjusted fields from measured supply', () => {
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({
        staticMainsPressureBar: 3.5,
        dynamicMainsPressure: 1.0,
        mainsDynamicFlowLpm: 7,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    const adjustment: ProposedSupplyAdjustment = {
      type: 'accumulator',
      adjustedDynamicFlowLpm: 20,
      // no adjustedDynamicPressureBar — pressure stays as measured
    }
    const effective = getEffectiveProposedMainsSupply(measured, adjustment)
    expect(effective.dynamicFlowLpm).toBe(20)
    expect(effective.dynamicPressureBar).toBe(1.0)
    expect(effective.staticPressureBar).toBe(3.5)
  })
})

// ─── buildCombiHexRemovalAdjustment ──────────────────────────────────────────

describe('buildCombiHexRemovalAdjustment', () => {
  it('returns combi_hex_removal type when pressure and flow are valid', () => {
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.5,
        mainsDynamicFlowLpm: 19,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    const adjustment = buildCombiHexRemovalAdjustment(measured)
    expect(adjustment.type).toBe('combi_hex_removal')
  })

  it('corrects flow upward using Q ∝ √P', () => {
    // At 1.5 bar with 0.3 bar HEX drop:
    //   adjustedFlow = 19 × √(1.5 / 1.2) ≈ 21.2 L/min
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.5,
        mainsDynamicFlowLpm: 19,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    const adjustment = buildCombiHexRemovalAdjustment(measured)
    expect(adjustment.adjustedDynamicFlowLpm).toBeGreaterThan(19)
    expect(adjustment.adjustedDynamicFlowLpm).toBeCloseTo(21.2, 0)
  })

  it('preserves measured pressure unchanged', () => {
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.5,
        mainsDynamicFlowLpm: 19,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    const adjustment = buildCombiHexRemovalAdjustment(measured)
    expect(adjustment.adjustedDynamicPressureBar).toBe(1.5)
  })

  it('returns type none when mains pressure is at or below HEX drop threshold', () => {
    // Cannot correct if pressure ≤ COMBI_HEX_PRESSURE_DROP_BAR
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: COMBI_HEX_PRESSURE_DROP_BAR,
        mainsDynamicFlowLpm: 5,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    const adjustment = buildCombiHexRemovalAdjustment(measured)
    expect(adjustment.type).toBe('none')
  })

  it('returns type none when no flow measurement is available', () => {
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({ dynamicMainsPressure: 1.5 }),
    )
    const adjustment = buildCombiHexRemovalAdjustment(measured)
    expect(adjustment.type).toBe('none')
  })

  it('produces a note explaining the correction', () => {
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.5,
        mainsDynamicFlowLpm: 19,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    const adjustment = buildCombiHexRemovalAdjustment(measured)
    expect(adjustment.note).toBeDefined()
    expect(adjustment.note).toMatch(/HEX/i)
  })

  it('getEffectiveProposedMainsSupply correctly applies combi_hex_removal adjustment', () => {
    const measured = extractMainsSupplyFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.5,
        mainsDynamicFlowLpm: 19,
        mainsDynamicFlowLpmKnown: true,
      }),
    )
    const adjustment = buildCombiHexRemovalAdjustment(measured)
    const effective = getEffectiveProposedMainsSupply(measured, adjustment)
    expect(effective.dynamicFlowLpm).toBeGreaterThan(19)
    expect(effective.dynamicPressureBar).toBe(1.5)
  })
})
