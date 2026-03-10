/**
 * Tests for useEfficiencyPlayback — the efficiency display adapter hook.
 *
 * Validates that the hook:
 *   - Identifies boiler vs heat-pump systemKind correctly
 *   - Returns returnTempC from diagramState for boiler systems
 *   - Forwards condensingState for boiler systems
 *   - Does NOT populate condensingState for heat pump systems
 *   - Derives the correct headlineEfficiencyText for each state
 *   - Derives the correct statusTone for each condensing state
 *   - Shows 'System idle' headline and 'idle' tone when systemMode is 'idle'
 *   - Emits 'CH paused during on-demand hot water' penalty for serviceSwitchingActive
 *   - Emits 'High return temp reducing condensing gain' penalty for not_condensing
 *   - Returns no penalties when system is clean / condensing
 *   - statusDescription is populated for boiler systems with condensingState
 *   - statusDescription is empty for heat pump systems and idle states
 */

import { describe, it, expect } from 'vitest'
import { useEfficiencyPlayback } from '../simulator/useEfficiencyPlayback'
import type { SystemDiagramDisplayState } from '../simulator/useSystemDiagramPlayback'
import { supplyOriginsForSystemType } from '../sim/supplyOrigins'
import { deriveCondensingState } from '../sim/condensingState'

// ─── State factories ──────────────────────────────────────────────────────────

function combiIdle(): SystemDiagramDisplayState {
  return {
    systemMode: 'idle',
    systemType: 'combi',
    heatSourceType: 'combi',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('combi'),
    hotDrawActive: false,
    condensingState: deriveCondensingState(48),
    returnTempC: 48,
  }
}

function combiHeatingCondensing(): SystemDiagramDisplayState {
  return {
    systemMode: 'heating',
    systemType: 'combi',
    heatSourceType: 'combi',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('combi'),
    hotDrawActive: false,
    condensingState: deriveCondensingState(43),
    returnTempC: 43,
  }
}

function combiBorderline(): SystemDiagramDisplayState {
  return {
    systemMode: 'dhw_draw',
    systemType: 'combi',
    heatSourceType: 'combi',
    serviceSwitchingActive: true,
    supplyOrigins: supplyOriginsForSystemType('combi'),
    hotDrawActive: true,
    condensingState: deriveCondensingState(52),
    returnTempC: 52,
  }
}

function combiNotCondensing(): SystemDiagramDisplayState {
  return {
    systemMode: 'heating',
    systemType: 'combi',
    heatSourceType: 'combi',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('combi'),
    hotDrawActive: false,
    condensingState: deriveCondensingState(60),
    returnTempC: 60,
  }
}

function storedHeating(): SystemDiagramDisplayState {
  return {
    systemMode: 'heating',
    systemType: 'unvented_cylinder',
    heatSourceType: 'system_boiler',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('unvented_cylinder'),
    hotDrawActive: false,
    condensingState: deriveCondensingState(44),
    returnTempC: 44,
    cylinderFillPct: 0.7,
  }
}

function storedReheatNotCondensing(): SystemDiagramDisplayState {
  return {
    systemMode: 'dhw_reheat',
    systemType: 'unvented_cylinder',
    heatSourceType: 'system_boiler',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('unvented_cylinder'),
    hotDrawActive: false,
    condensingState: deriveCondensingState(57),
    returnTempC: 57,
    cylinderFillPct: 0.4,
  }
}

function ventedHeating(): SystemDiagramDisplayState {
  return {
    systemMode: 'heating',
    systemType: 'vented_cylinder',
    heatSourceType: 'system_boiler',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('vented_cylinder'),
    hotDrawActive: false,
    condensingState: deriveCondensingState(44),
    returnTempC: 44,
    cylinderFillPct: 0.65,
  }
}

function heatPumpHeating(): SystemDiagramDisplayState {
  return {
    systemMode: 'heating',
    systemType: 'unvented_cylinder',
    heatSourceType: 'heat_pump',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('unvented_cylinder'),
    hotDrawActive: false,
    // No condensingState or returnTempC for heat pumps
  }
}

function heatPumpIdle(): SystemDiagramDisplayState {
  return {
    systemMode: 'idle',
    systemType: 'unvented_cylinder',
    heatSourceType: 'heat_pump',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('unvented_cylinder'),
    hotDrawActive: false,
  }
}

// ─── Tests: systemKind ────────────────────────────────────────────────────────

describe('useEfficiencyPlayback — systemKind', () => {
  it('combi boiler maps to boiler systemKind', () => {
    const result = useEfficiencyPlayback(combiHeatingCondensing())
    expect(result.systemKind).toBe('boiler')
  })

  it('system_boiler maps to boiler systemKind', () => {
    const result = useEfficiencyPlayback(storedHeating())
    expect(result.systemKind).toBe('boiler')
  })

  it('heat_pump maps to heat_pump systemKind', () => {
    const result = useEfficiencyPlayback(heatPumpHeating())
    expect(result.systemKind).toBe('heat_pump')
  })
})

// ─── Tests: returnTempC ───────────────────────────────────────────────────────

describe('useEfficiencyPlayback — returnTempC', () => {
  it('returnTempC is forwarded for combi condensing state', () => {
    const result = useEfficiencyPlayback(combiHeatingCondensing())
    expect(result.returnTempC).toBe(43)
  })

  it('returnTempC is forwarded for borderline state', () => {
    const result = useEfficiencyPlayback(combiBorderline())
    expect(result.returnTempC).toBe(52)
  })

  it('returnTempC is forwarded for not_condensing state', () => {
    const result = useEfficiencyPlayback(combiNotCondensing())
    expect(result.returnTempC).toBe(60)
  })

  it('returnTempC is undefined for heat pump', () => {
    const result = useEfficiencyPlayback(heatPumpHeating())
    expect(result.returnTempC).toBeUndefined()
  })
})

// ─── Tests: condensingState ───────────────────────────────────────────────────

describe('useEfficiencyPlayback — condensingState', () => {
  it('condensingState is condensing for low return temp', () => {
    const result = useEfficiencyPlayback(combiHeatingCondensing())
    expect(result.condensingState).toBe('condensing')
  })

  it('condensingState is borderline for mid return temp', () => {
    const result = useEfficiencyPlayback(combiBorderline())
    expect(result.condensingState).toBe('borderline')
  })

  it('condensingState is not_condensing for high return temp', () => {
    const result = useEfficiencyPlayback(combiNotCondensing())
    expect(result.condensingState).toBe('not_condensing')
  })

  it('condensingState is undefined for heat pump — no fake condensing label', () => {
    const result = useEfficiencyPlayback(heatPumpHeating())
    expect(result.condensingState).toBeUndefined()
  })
})

// ─── Tests: headlineEfficiencyText ───────────────────────────────────────────

describe('useEfficiencyPlayback — headlineEfficiencyText', () => {
  it('idle combi returns "System idle"', () => {
    const result = useEfficiencyPlayback(combiIdle())
    expect(result.headlineEfficiencyText).toBe('System idle')
  })

  it('condensing boiler returns "Condensing active"', () => {
    const result = useEfficiencyPlayback(combiHeatingCondensing())
    expect(result.headlineEfficiencyText).toBe('Condensing active')
  })

  it('borderline boiler returns "Near condensing threshold"', () => {
    const result = useEfficiencyPlayback(combiBorderline())
    expect(result.headlineEfficiencyText).toBe('Near condensing threshold')
  })

  it('not_condensing boiler returns "Not condensing"', () => {
    const result = useEfficiencyPlayback(combiNotCondensing())
    expect(result.headlineEfficiencyText).toBe('Not condensing')
  })

  it('heat pump active returns "Heat pump running"', () => {
    const result = useEfficiencyPlayback(heatPumpHeating())
    expect(result.headlineEfficiencyText).toBe('Heat pump running')
  })

  it('heat pump idle returns "System idle"', () => {
    const result = useEfficiencyPlayback(heatPumpIdle())
    expect(result.headlineEfficiencyText).toBe('System idle')
  })

  it('stored system condensing returns "Condensing active"', () => {
    const result = useEfficiencyPlayback(storedHeating())
    expect(result.headlineEfficiencyText).toBe('Condensing active')
  })

  it('vented cylinder condensing returns "Condensing active"', () => {
    const result = useEfficiencyPlayback(ventedHeating())
    expect(result.headlineEfficiencyText).toBe('Condensing active')
  })
})

// ─── Tests: statusTone ────────────────────────────────────────────────────────

describe('useEfficiencyPlayback — statusTone', () => {
  it('idle system has idle tone', () => {
    const result = useEfficiencyPlayback(combiIdle())
    expect(result.statusTone).toBe('idle')
  })

  it('condensing boiler has good tone', () => {
    const result = useEfficiencyPlayback(combiHeatingCondensing())
    expect(result.statusTone).toBe('good')
  })

  it('borderline boiler has warning tone', () => {
    const result = useEfficiencyPlayback(combiBorderline())
    expect(result.statusTone).toBe('warning')
  })

  it('not_condensing boiler has poor tone', () => {
    const result = useEfficiencyPlayback(combiNotCondensing())
    expect(result.statusTone).toBe('poor')
  })

  it('active heat pump has good tone', () => {
    const result = useEfficiencyPlayback(heatPumpHeating())
    expect(result.statusTone).toBe('good')
  })

  it('idle heat pump has idle tone', () => {
    const result = useEfficiencyPlayback(heatPumpIdle())
    expect(result.statusTone).toBe('idle')
  })
})

// ─── Tests: penalties ────────────────────────────────────────────────────────

describe('useEfficiencyPlayback — penalties', () => {
  it('no penalties when condensing and no service switching', () => {
    const result = useEfficiencyPlayback(combiHeatingCondensing())
    expect(result.penalties).toHaveLength(0)
  })

  it('CH paused penalty appears when serviceSwitchingActive', () => {
    const result = useEfficiencyPlayback(combiBorderline())
    expect(result.penalties).toContain('CH paused during on-demand hot water')
  })

  it('high return temp penalty appears when not_condensing', () => {
    const result = useEfficiencyPlayback(combiNotCondensing())
    expect(result.penalties).toContain('High return temp reducing condensing gain')
  })

  it('no high-return-temp penalty when condensing', () => {
    const result = useEfficiencyPlayback(combiHeatingCondensing())
    expect(result.penalties).not.toContain('High return temp reducing condensing gain')
  })

  it('high return temp penalty appears for stored not_condensing', () => {
    const result = useEfficiencyPlayback(storedReheatNotCondensing())
    expect(result.penalties).toContain('High return temp reducing condensing gain')
  })

  it('no CH paused penalty for stored system (never serviceSwitchingActive)', () => {
    const result = useEfficiencyPlayback(storedHeating())
    expect(result.penalties).not.toContain('CH paused during on-demand hot water')
  })

  it('penalties is empty array when heat pump is active', () => {
    const result = useEfficiencyPlayback(heatPumpHeating())
    expect(result.penalties).toHaveLength(0)
  })
})

// ─── Tests: statusDescription ────────────────────────────────────────────────

describe('useEfficiencyPlayback — statusDescription', () => {
  it('statusDescription is non-empty for condensing boiler', () => {
    const result = useEfficiencyPlayback(combiHeatingCondensing())
    expect(result.statusDescription).not.toBe('')
    expect(result.statusDescription).toContain('latent heat')
  })

  it('statusDescription is non-empty for borderline boiler', () => {
    const result = useEfficiencyPlayback(combiBorderline())
    expect(result.statusDescription).not.toBe('')
  })

  it('statusDescription is non-empty for not_condensing boiler', () => {
    const result = useEfficiencyPlayback(combiNotCondensing())
    expect(result.statusDescription).not.toBe('')
  })

  it('statusDescription is empty string when system is idle', () => {
    const result = useEfficiencyPlayback(combiIdle())
    expect(result.statusDescription).toBe('')
  })

  it('statusDescription is empty string for heat pump', () => {
    const result = useEfficiencyPlayback(heatPumpHeating())
    expect(result.statusDescription).toBe('')
  })
})
