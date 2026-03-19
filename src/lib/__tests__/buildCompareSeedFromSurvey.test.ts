// src/lib/__tests__/buildCompareSeedFromSurvey.test.ts
//
// Tests for buildCompareSeedFromSurvey — the canonical compare seed builder
// that populates both simulator columns from a survey + engine output.
//
// Coverage:
//   - left side seeds from current surveyed system (via adaptFullSurveyToSimulatorInputs)
//   - right side seeds from first viable engine option
//   - right side falls back to first caution option when no viable exists
//   - right side falls back to combi when options is empty
//   - compare mode is always 'current_vs_proposed'
//   - comparison label is human-readable
//   - builder is deterministic (same input → same output)
//   - right side inherits mains/occupancy truth from survey
//   - right side applies new-installation defaults (clean, weather comp, etc.)
//   - right side does not inherit system condition from current system

import { describe, it, expect } from 'vitest'
import { buildCompareSeedFromSurvey, buildDefaultCompareSeed } from '../simulator/buildCompareSeedFromSurvey'
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1'
import type { EngineOutputV1, OptionCardV1 } from '../../contracts/EngineOutputV1'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function minimalSurvey(overrides: Partial<FullSurveyModelV1> = {}): FullSurveyModelV1 {
  return {
    postcode: 'SW1A 1AA',
    dynamicMainsPressure: 2.5,
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

function makeOptionCard(
  id: OptionCardV1['id'],
  status: OptionCardV1['status'] = 'viable',
): OptionCardV1 {
  return {
    id,
    label: id,
    status,
    headline: `${id} option`,
    why: [],
    requirements: [],
    heat: { status: 'ok', headline: '', bullets: [] },
    dhw: { status: 'ok', headline: '', bullets: [] },
    engineering: { status: 'ok', headline: '', bullets: [] },
    typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
  }
}

function minimalEngineOutput(
  options: OptionCardV1[] = [],
): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'combi' },
    explainers: [],
    options,
    evidence: { items: [] },
    visuals: {},
    meta: {
      engineVersion: '1.0.0',
      contractVersion: '1',
      confidence: { level: 'high', label: 'High confidence' },
      assumptions: [],
    },
  }
}

// ─── compare mode and label ───────────────────────────────────────────────────

describe('buildCompareSeedFromSurvey — compareMode and label', () => {
  it('always returns current_vs_proposed compare mode', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey(),
      minimalEngineOutput([makeOptionCard('combi')]),
    )
    expect(seed.compareMode).toBe('current_vs_proposed')
  })

  it('returns a human-readable comparison label', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey(),
      minimalEngineOutput([makeOptionCard('combi')]),
    )
    expect(seed.comparisonLabel).toMatch(/current/i)
    expect(seed.comparisonLabel).toMatch(/proposed/i)
  })
})

// ─── left (current) side ─────────────────────────────────────────────────────

describe('buildCompareSeedFromSurvey — left (current) side', () => {
  it('derives system choice from currentHeatSourceType (combi)', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({ currentHeatSourceType: 'combi' }),
      minimalEngineOutput([makeOptionCard('stored_unvented')]),
    )
    expect(seed.left.systemChoice).toBe('combi')
  })

  it('derives system choice from currentHeatSourceType (regular → open_vented)', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({ currentHeatSourceType: 'regular' }),
      minimalEngineOutput([makeOptionCard('combi')]),
    )
    expect(seed.left.systemChoice).toBe('open_vented')
  })

  it('derives system choice from currentHeatSourceType (ashp → heat_pump)', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({ currentHeatSourceType: 'ashp' }),
      minimalEngineOutput([makeOptionCard('combi')]),
    )
    expect(seed.left.systemChoice).toBe('heat_pump')
  })

  it('includes mains pressure from survey in left side', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({ dynamicMainsPressure: 3.0 }),
      minimalEngineOutput([makeOptionCard('combi')]),
    )
    expect(seed.left.systemInputs.mainsPressureBar).toBe(3.0)
  })

  it('includes heat loss from survey in left side', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({ heatLossWatts: 10000 }),
      minimalEngineOutput([makeOptionCard('combi')]),
    )
    expect(seed.left.systemInputs.heatLossKw).toBe(10)
  })
})

// ─── right (proposed) side ────────────────────────────────────────────────────

describe('buildCompareSeedFromSurvey — right (proposed) side', () => {
  it('uses first viable option for system choice (stored_unvented → unvented)', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey(),
      minimalEngineOutput([makeOptionCard('stored_unvented', 'viable')]),
    )
    expect(seed.right.systemChoice).toBe('unvented')
  })

  it('uses first viable option when multiple options exist', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey(),
      minimalEngineOutput([
        makeOptionCard('combi', 'caution'),
        makeOptionCard('stored_unvented', 'viable'),
        makeOptionCard('ashp', 'viable'),
      ]),
    )
    expect(seed.right.systemChoice).toBe('unvented')
  })

  it('falls back to first caution option when no viable option exists', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey(),
      minimalEngineOutput([
        makeOptionCard('ashp', 'caution'),
        makeOptionCard('stored_unvented', 'rejected'),
      ]),
    )
    expect(seed.right.systemChoice).toBe('heat_pump')
  })

  it('falls back to combi when options array is empty', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey(),
      minimalEngineOutput([]),
    )
    expect(seed.right.systemChoice).toBe('combi')
  })

  it('maps stored_vented option to open_vented system choice', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey(),
      minimalEngineOutput([makeOptionCard('stored_vented', 'viable')]),
    )
    expect(seed.right.systemChoice).toBe('open_vented')
  })

  it('maps ashp option to heat_pump system choice', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey(),
      minimalEngineOutput([makeOptionCard('ashp', 'viable')]),
    )
    expect(seed.right.systemChoice).toBe('heat_pump')
  })

  it('applies new-installation defaults: clean system condition', () => {
    const survey = minimalSurvey({
      fullSurvey: {
        heatingCondition: { bleedWaterColour: 'brown' },
      } as FullSurveyModelV1['fullSurvey'],
    })
    const seed = buildCompareSeedFromSurvey(
      survey,
      minimalEngineOutput([makeOptionCard('combi', 'viable')]),
    )
    expect(seed.right.systemInputs.systemCondition).toBe('clean')
  })

  it('applies new-installation defaults: weather compensation enabled', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey(),
      minimalEngineOutput([makeOptionCard('combi', 'viable')]),
    )
    expect(seed.right.systemInputs.weatherCompensation).toBe(true)
  })

  it('applies new-installation defaults: load compensation enabled', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey(),
      minimalEngineOutput([makeOptionCard('combi', 'viable')]),
    )
    expect(seed.right.systemInputs.loadCompensation).toBe(true)
  })

  it('applies new-installation defaults: 22mm primary pipe', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({ primaryPipeDiameter: 15 }),
      minimalEngineOutput([makeOptionCard('combi', 'viable')]),
    )
    expect(seed.right.systemInputs.primaryPipeSize).toBe('22mm')
  })

  it('inherits mains pressure from survey in right side', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({ dynamicMainsPressure: 4.0 }),
      minimalEngineOutput([makeOptionCard('stored_unvented', 'viable')]),
    )
    expect(seed.right.systemInputs.mainsPressureBar).toBe(4.0)
  })

  it('inherits measured mains flow from survey in right side', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({ mainsDynamicFlowLpm: 7, mainsDynamicFlowLpmKnown: true }),
      minimalEngineOutput([makeOptionCard('stored_unvented', 'viable')]),
    )
    expect(seed.right.systemInputs.mainsFlowLpm).toBe(7)
  })

  it('inherits estimated mains flow (mainsDynamicFlowLpmKnown absent) in right side', () => {
    // Even when the Known flag is not set, the flow should still be used for
    // the proposed side — it is tagged 'estimated' but should not fall back
    // to the 20 L/min default.
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({ mainsDynamicFlowLpm: 7 }),
      minimalEngineOutput([makeOptionCard('stored_unvented', 'viable')]),
    )
    expect(seed.right.systemInputs.mainsFlowLpm).toBe(7)
  })

  it('proposed side matches current side for measured mains supply', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.0,
        mainsDynamicFlowLpm: 7,
        mainsDynamicFlowLpmKnown: true,
      }),
      minimalEngineOutput([makeOptionCard('stored_unvented', 'viable')]),
    )
    // Both sides should show the same house supply facts
    expect(seed.right.systemInputs.mainsPressureBar).toBe(
      seed.left.systemInputs.mainsPressureBar,
    )
    expect(seed.right.systemInputs.mainsFlowLpm).toBe(7)
  })

  it('inherits heat loss from survey in right side', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({ heatLossWatts: 12000 }),
      minimalEngineOutput([makeOptionCard('combi', 'viable')]),
    )
    expect(seed.right.systemInputs.heatLossKw).toBe(12)
  })

  it('does not inherit system condition from current (sludged) system', () => {
    const survey = minimalSurvey({
      fullSurvey: {
        heatingCondition: { magneticDebrisEvidence: true },
      } as FullSurveyModelV1['fullSurvey'],
    })
    const seed = buildCompareSeedFromSurvey(
      survey,
      minimalEngineOutput([makeOptionCard('stored_unvented', 'viable')]),
    )
    expect(seed.left.systemInputs.systemCondition).toBe('sludged')
    expect(seed.right.systemInputs.systemCondition).toBe('clean')
  })
})

// ─── measuredMainsSupply in CompareSeed ──────────────────────────────────────

describe('buildCompareSeedFromSurvey — measuredMainsSupply', () => {
  it('includes measuredMainsSupply tagged measured when flow is confirmed', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({
        dynamicMainsPressure: 1.0,
        mainsDynamicFlowLpm: 7,
        mainsDynamicFlowLpmKnown: true,
      }),
      minimalEngineOutput([makeOptionCard('combi')]),
    )
    expect(seed.measuredMainsSupply).toBeDefined()
    expect(seed.measuredMainsSupply?.source).toBe('measured')
    expect(seed.measuredMainsSupply?.dynamicFlowLpm).toBe(7)
    expect(seed.measuredMainsSupply?.dynamicPressureBar).toBe(1.0)
  })

  it('includes measuredMainsSupply tagged estimated when flow is unconfirmed', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey({ dynamicMainsPressure: 1.0, mainsDynamicFlowLpm: 7 }),
      minimalEngineOutput([makeOptionCard('combi')]),
    )
    expect(seed.measuredMainsSupply?.source).toBe('estimated')
    expect(seed.measuredMainsSupply?.dynamicFlowLpm).toBe(7)
  })

  it('includes proposedSupplyAdjustment type none by default', () => {
    const seed = buildCompareSeedFromSurvey(
      minimalSurvey(),
      minimalEngineOutput([makeOptionCard('combi')]),
    )
    expect(seed.proposedSupplyAdjustment?.type).toBe('none')
  })
})

// ─── determinism ─────────────────────────────────────────────────────────────

describe('buildCompareSeedFromSurvey — determinism', () => {
  it('produces identical output on repeated calls with same input', () => {
    const survey = minimalSurvey({ currentHeatSourceType: 'combi', heatLossWatts: 9000 })
    const output = minimalEngineOutput([
      makeOptionCard('stored_unvented', 'viable'),
      makeOptionCard('ashp', 'caution'),
    ])
    const seed1 = buildCompareSeedFromSurvey(survey, output)
    const seed2 = buildCompareSeedFromSurvey(survey, output)
    expect(seed1.left.systemChoice).toBe(seed2.left.systemChoice)
    expect(seed1.right.systemChoice).toBe(seed2.right.systemChoice)
    expect(seed1.compareMode).toBe(seed2.compareMode)
    expect(seed1.left.systemInputs.mainsPressureBar).toBe(seed2.left.systemInputs.mainsPressureBar)
    expect(seed1.right.systemInputs.systemCondition).toBe(seed2.right.systemInputs.systemCondition)
  })
})

// ─── buildDefaultCompareSeed ─────────────────────────────────────────────────

describe('buildDefaultCompareSeed', () => {
  it('returns a valid CompareSeed', () => {
    const seed = buildDefaultCompareSeed()
    expect(seed.compareMode).toBe('current_vs_proposed')
    expect(seed.left.systemChoice).toBeDefined()
    expect(seed.right.systemChoice).toBeDefined()
  })

  it('right side has improved defaults applied', () => {
    const seed = buildDefaultCompareSeed()
    expect(seed.right.systemInputs.weatherCompensation).toBe(true)
    expect(seed.right.systemInputs.loadCompensation).toBe(true)
    expect(seed.right.systemInputs.systemCondition).toBe('clean')
  })
})
