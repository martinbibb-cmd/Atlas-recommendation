// src/lib/__tests__/mainsSupply.test.ts
//
// Tests for the canonical MainsSupply shared object helpers.
//
// Coverage:
//   - extractMainsSupplyFromSurvey: source tagging for measured/estimated/default
//   - getEffectiveProposedMainsSupply: passthrough and supply-upgrade override

import { describe, it, expect } from 'vitest'
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1'
import {
  extractMainsSupplyFromSurvey,
  getEffectiveProposedMainsSupply,
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
