/**
 * useBehaviourTimeline.test.ts
 *
 * Regression tests for the behaviour timeline helper functions.
 *
 * Bug #1: deriveRawHeatKw was incorrectly returning COP × heatLossKw for heat
 * pump systems, inflating a 14–15 kW design heat loss to ~42–51 kW.  The
 * correct formula is:
 *
 *   heatOutputKw = heatLossKw          (HP thermal output matches demand)
 *   electricalInputKw = heatLossKw / COP  (not represented in this function)
 */

import { describe, it, expect } from 'vitest'
import { deriveRawHeatKw } from '../simulator/useBehaviourTimeline'
import type { SystemDiagramDisplayState } from '../simulator/useSystemDiagramPlayback'
import { DEFAULT_SYSTEM_INPUTS } from '../simulator/systemInputsTypes'
import { supplyOriginsForSystemType } from '../sim/supplyOrigins'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Typical design heat loss value (kW) for mid-sized UK home. */
const DESIGN_HEAT_LOSS_KW = 14

/** Boiler nominal output (kW) — deliberately larger than heat loss (oversized). */
const BOILER_OUTPUT_KW = 24

/** Combi plate-HEX power (kW). */
const COMBI_POWER_KW = 30

const SYSTEM_INPUTS = {
  ...DEFAULT_SYSTEM_INPUTS,
  combiPowerKw:   COMBI_POWER_KW,
  heatLossKw:     DESIGN_HEAT_LOSS_KW,
  boilerOutputKw: BOILER_OUTPUT_KW,
}

function makeHeatPumpState(
  systemMode: SystemDiagramDisplayState['systemMode'],
  cop = 3.5,
): SystemDiagramDisplayState {
  return {
    systemMode,
    systemType: 'unvented_cylinder',
    heatSourceType: 'heat_pump',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('unvented_cylinder'),
    hotDrawActive: false,
    cop,
    phaseLabel: 'Heating',
  }
}

function makeCombiState(
  systemMode: SystemDiagramDisplayState['systemMode'],
): SystemDiagramDisplayState {
  return {
    systemMode,
    systemType: 'combi',
    heatSourceType: 'combi',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('combi'),
    hotDrawActive: false,
    phaseLabel: 'Standby',
  }
}

function makeBoilerState(
  systemMode: SystemDiagramDisplayState['systemMode'],
): SystemDiagramDisplayState {
  return {
    systemMode,
    systemType: 'unvented_cylinder',
    heatSourceType: 'system_boiler',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('unvented_cylinder'),
    hotDrawActive: false,
    phaseLabel: 'Heating',
  }
}

// ─── Bug #1 regression: HP output must NOT be COP × heat loss ────────────────

describe('deriveRawHeatKw – heat pump', () => {
  it('returns heatLossKw (not COP × heatLossKw) when heating', () => {
    const state = makeHeatPumpState('heating', 3.5)
    const result = deriveRawHeatKw(state, SYSTEM_INPUTS)
    // Correct: thermal output = design heat loss
    expect(result).toBe(DESIGN_HEAT_LOSS_KW)
    // Regression guard: must NOT be COP-multiplied (~49 kW would be the buggy result)
    expect(result).not.toBeCloseTo(3.5 * DESIGN_HEAT_LOSS_KW, 0)
  })

  it('returns heatLossKw when in dhw_reheat mode', () => {
    const state = makeHeatPumpState('dhw_reheat', 3.0)
    expect(deriveRawHeatKw(state, SYSTEM_INPUTS)).toBe(DESIGN_HEAT_LOSS_KW)
  })

  it('returns heatLossKw when in heating_and_reheat mode', () => {
    const state = makeHeatPumpState('heating_and_reheat', 4.0)
    expect(deriveRawHeatKw(state, SYSTEM_INPUTS)).toBe(DESIGN_HEAT_LOSS_KW)
  })

  it('returns 0 when idle', () => {
    expect(deriveRawHeatKw(makeHeatPumpState('idle'), SYSTEM_INPUTS)).toBe(0)
  })

  it('COP value does not affect thermal output (it affects electrical input only)', () => {
    const lowCop  = deriveRawHeatKw(makeHeatPumpState('heating', 1.5), SYSTEM_INPUTS)
    const highCop = deriveRawHeatKw(makeHeatPumpState('heating', 5.0), SYSTEM_INPUTS)
    // Thermal output should be the same regardless of COP
    expect(lowCop).toBe(DESIGN_HEAT_LOSS_KW)
    expect(highCop).toBe(DESIGN_HEAT_LOSS_KW)
    expect(lowCop).toBe(highCop)
  })

  it('heat output does not exceed design heat loss + 5% for any reasonable COP', () => {
    // Ensures no COP-multiplication can creep back in
    for (const cop of [1.5, 2.0, 3.0, 3.5, 4.0, 5.0]) {
      const output = deriveRawHeatKw(makeHeatPumpState('heating', cop), SYSTEM_INPUTS)
      expect(output).toBeLessThanOrEqual(DESIGN_HEAT_LOSS_KW * 1.05)
    }
  })
})

// ─── Combi and boiler should use their own power constants ───────────────────

describe('deriveRawHeatKw – combi', () => {
  it('returns combiPowerKw during DHW draw', () => {
    expect(deriveRawHeatKw(makeCombiState('dhw_draw'), SYSTEM_INPUTS)).toBe(COMBI_POWER_KW)
  })

  it('returns boilerOutputKw during heating', () => {
    expect(deriveRawHeatKw(makeCombiState('heating'), SYSTEM_INPUTS)).toBe(BOILER_OUTPUT_KW)
  })

  it('returns 0 when idle', () => {
    expect(deriveRawHeatKw(makeCombiState('idle'), SYSTEM_INPUTS)).toBe(0)
  })
})

describe('deriveRawHeatKw – system boiler', () => {
  it('returns boilerOutputKw during heating', () => {
    expect(deriveRawHeatKw(makeBoilerState('heating'), SYSTEM_INPUTS)).toBe(BOILER_OUTPUT_KW)
  })

  it('returns boilerOutputKw during dhw_reheat', () => {
    expect(deriveRawHeatKw(makeBoilerState('dhw_reheat'), SYSTEM_INPUTS)).toBe(BOILER_OUTPUT_KW)
  })

  it('returns 0 during dhw_draw (boiler not firing)', () => {
    expect(deriveRawHeatKw(makeBoilerState('dhw_draw'), SYSTEM_INPUTS)).toBe(0)
  })

  it('returns 0 when idle', () => {
    expect(deriveRawHeatKw(makeBoilerState('idle'), SYSTEM_INPUTS)).toBe(0)
  })
})
