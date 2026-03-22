/**
 * Tests for useDrawOffPlayback — the draw-off display adapter hook.
 *
 * Validates that the hook:
 *   - Returns all outlets idle when hotDrawActive is false
 *   - Opens shower (and bath for stored) when hotDrawActive is true
 *   - Uses on_demand hotSource for combi, stored hotSource for cylinder systems
 *   - Shows concurrency pain (bath constrained) for combi during serviceSwitching
 *   - Stored/vented: both shower and bath open without constraint during draw
 *   - Labels coldSource as 'cws' for vented systems (cwsTankCold present)
 *   - Sets isCylinder correctly per systemType
 *   - Sets combiAtCapacity only for combi + serviceSwitchingActive
 *   - Never creates outlet states from systemType booleans — uses supplyOrigins
 */

import { describe, it, expect } from 'vitest'
import { useDrawOffPlayback } from '../simulator/useDrawOffPlayback'
import type { SystemDiagramDisplayState } from '../simulator/useSystemDiagramPlayback'
import { supplyOriginsForSystemType } from '../sim/supplyOrigins'

// ─── State factories ──────────────────────────────────────────────────────────

function combiIdle(): SystemDiagramDisplayState {
  return {
    systemMode: 'idle',
    systemType: 'combi',
    heatSourceType: 'combi',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('combi'),
    hotDrawActive: false,
  }
}

function combiDrawSwitching(): SystemDiagramDisplayState {
  return {
    ...combiIdle(),
    systemMode: 'dhw_draw',
    serviceSwitchingActive: true,
    hotDrawActive: true,
  }
}

function combiDrawNoSwitching(): SystemDiagramDisplayState {
  return {
    ...combiIdle(),
    systemMode: 'dhw_draw',
    serviceSwitchingActive: false,
    hotDrawActive: true,
  }
}

function storedIdle(): SystemDiagramDisplayState {
  return {
    systemMode: 'idle',
    systemType: 'unvented_cylinder',
    heatSourceType: 'system_boiler',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('unvented_cylinder'),
    hotDrawActive: false,
    cylinderFillPct: 0.7,
  }
}

function storedDraw(): SystemDiagramDisplayState {
  return { ...storedIdle(), hotDrawActive: true, cylinderFillPct: 0.55 }
}

function storedReheat(): SystemDiagramDisplayState {
  return { ...storedIdle(), systemMode: 'dhw_reheat' }
}

function ventedDraw(): SystemDiagramDisplayState {
  return {
    systemMode: 'heating',
    systemType: 'vented_cylinder',
    heatSourceType: 'system_boiler',
    serviceSwitchingActive: false,
    supplyOrigins: supplyOriginsForSystemType('vented_cylinder'),
    hotDrawActive: true,
    cylinderFillPct: 0.65,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useDrawOffPlayback — idle state', () => {
  it('all outlets are closed when hotDrawActive is false (combi idle)', () => {
    const result = useDrawOffPlayback(combiIdle())
    expect(result.outletStates.every(o => !o.open)).toBe(true)
  })

  it('all outlets are closed when hotDrawActive is false (stored idle)', () => {
    const result = useDrawOffPlayback(storedIdle())
    expect(result.outletStates.every(o => !o.open)).toBe(true)
  })

  it('returns three outlet slots even when all are idle', () => {
    const result = useDrawOffPlayback(combiIdle())
    expect(result.outletStates).toHaveLength(3)
  })
})

describe('useDrawOffPlayback — combi draw with service switching', () => {
  it('shower is open during draw', () => {
    const result = useDrawOffPlayback(combiDrawSwitching())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    expect(shower?.open).toBe(true)
  })

  it('shower has mixed_hot_running service', () => {
    const result = useDrawOffPlayback(combiDrawSwitching())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    expect(shower?.service).toBe('mixed_hot_running')
  })

  it('shower hotSource is on_demand for combi', () => {
    const result = useDrawOffPlayback(combiDrawSwitching())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    expect(shower?.hotSource).toBe('on_demand')
  })

  it('shower coldSource is mains for combi', () => {
    const result = useDrawOffPlayback(combiDrawSwitching())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    expect(shower?.coldSource).toBe('mains')
  })

  it('bath is open and constrained when serviceSwitchingActive', () => {
    const result = useDrawOffPlayback(combiDrawSwitching())
    const bath = result.outletStates.find(o => o.outletId === 'bath')
    expect(bath?.open).toBe(true)
    expect(bath?.isConstrained).toBe(true)
  })

  it('bath constraint reason mentions concurrent demand', () => {
    const result = useDrawOffPlayback(combiDrawSwitching())
    const bath = result.outletStates.find(o => o.outletId === 'bath')
    expect(bath?.constraintReason).toContain('concurrent demand')
  })

  it('serviceSwitchingActive is forwarded to output', () => {
    const result = useDrawOffPlayback(combiDrawSwitching())
    expect(result.serviceSwitchingActive).toBe(true)
  })

  it('combiAtCapacity is true when combi + serviceSwitchingActive', () => {
    const result = useDrawOffPlayback(combiDrawSwitching())
    expect(result.combiAtCapacity).toBe(true)
  })

  it('isCylinder is false for combi', () => {
    const result = useDrawOffPlayback(combiDrawSwitching())
    expect(result.isCylinder).toBe(false)
  })
})

describe('useDrawOffPlayback — combi draw without service switching', () => {
  it('bath is closed when serviceSwitchingActive is false', () => {
    const result = useDrawOffPlayback(combiDrawNoSwitching())
    const bath = result.outletStates.find(o => o.outletId === 'bath')
    expect(bath?.open).toBe(false)
  })

  it('combiAtCapacity is false when serviceSwitchingActive is false', () => {
    const result = useDrawOffPlayback(combiDrawNoSwitching())
    expect(result.combiAtCapacity).toBe(false)
  })
})

describe('useDrawOffPlayback — stored hot draw', () => {
  it('shower is open during draw', () => {
    const result = useDrawOffPlayback(storedDraw())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    expect(shower?.open).toBe(true)
  })

  it('bath is open during stored draw', () => {
    const result = useDrawOffPlayback(storedDraw())
    const bath = result.outletStates.find(o => o.outletId === 'bath')
    expect(bath?.open).toBe(true)
  })

  it('shower and bath are constrained when concurrent demand on a mains-fed stored system exceeds budget', () => {
    // unvented cylinder is mains-fed.  Shower (9.5) + Bath (8.0) = 17.5 L/min > 12 L/min mains.
    const result = useDrawOffPlayback(storedDraw())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    const bath   = result.outletStates.find(o => o.outletId === 'bath')
    expect(shower?.isConstrained).toBe(true)
    expect(bath?.isConstrained).toBe(true)
  })

  it('constraint reason mentions shared cold main', () => {
    const result = useDrawOffPlayback(storedDraw())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    expect(shower?.constraintReason).toMatch(/shared cold main/i)
  })

  it('shower flowLpm is throttled below solo rate under concurrent demand', () => {
    const result = useDrawOffPlayback(storedDraw())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    // Solo rate is 9.5 L/min; throttled rate must be less.
    expect(shower?.flowLpm).toBeLessThan(9.5)
  })

  it('total delivered flow does not exceed the mains budget', () => {
    const result = useDrawOffPlayback(storedDraw())
    const total = result.outletStates
      .filter(o => o.open && o.coldSource !== 'cws')
      .reduce((sum, o) => sum + o.flowLpm, 0)
    // Must not exceed 12 L/min (DEMO_MAINS_FLOW_LPM).
    expect(total).toBeLessThanOrEqual(12.1)
  })

  it('shower hotSource is stored for cylinder', () => {
    const result = useDrawOffPlayback(storedDraw())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    expect(shower?.hotSource).toBe('stored')
  })

  it('isCylinder is true for unvented_cylinder', () => {
    const result = useDrawOffPlayback(storedDraw())
    expect(result.isCylinder).toBe(true)
  })

  it('combiAtCapacity is false for stored system', () => {
    const result = useDrawOffPlayback(storedDraw())
    expect(result.combiAtCapacity).toBe(false)
  })
})

describe('useDrawOffPlayback — stored reheat (no draw)', () => {
  it('all outlets are closed during reheat (no user draw)', () => {
    const result = useDrawOffPlayback(storedReheat())
    expect(result.outletStates.every(o => !o.open)).toBe(true)
  })

  it('systemMode is dhw_reheat — drives Stored hot water buffering banner in panel', () => {
    const result = useDrawOffPlayback(storedReheat())
    expect(result.systemMode).toBe('dhw_reheat')
    expect(result.isCylinder).toBe(true)
  })
})

describe('useDrawOffPlayback — vented cylinder', () => {
  it('coldSource is cws for vented (cwsTankCold present in supplyOrigins)', () => {
    const result = useDrawOffPlayback(ventedDraw())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    expect(shower?.coldSource).toBe('cws')
  })

  it('hotSource is stored for vented cylinder', () => {
    const result = useDrawOffPlayback(ventedDraw())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    expect(shower?.hotSource).toBe('stored')
  })

  it('isCylinder is true for vented_cylinder', () => {
    const result = useDrawOffPlayback(ventedDraw())
    expect(result.isCylinder).toBe(true)
  })

  it('both shower and bath open for vented (CWS-fed, no mains sharing constraint)', () => {
    const result = useDrawOffPlayback(ventedDraw())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    const bath = result.outletStates.find(o => o.outletId === 'bath')
    expect(shower?.open).toBe(true)
    expect(bath?.open).toBe(true)
    // CWS outlets do not share the pressurised mains — no mains constraint.
    expect(shower?.isConstrained).toBe(false)
    expect(bath?.isConstrained).toBe(false)
  })
})

describe('useDrawOffPlayback — systemMode passthrough', () => {
  it('systemMode is forwarded to output', () => {
    const result = useDrawOffPlayback(combiDrawSwitching())
    expect(result.systemMode).toBe('dhw_draw')
  })

  it('systemMode idle is forwarded correctly', () => {
    const result = useDrawOffPlayback(combiIdle())
    expect(result.systemMode).toBe('idle')
  })
})

describe('useDrawOffPlayback — storedHotWaterState integration', () => {
  it('storedHotWaterState is null for combi systems', () => {
    const result = useDrawOffPlayback(combiIdle(), 'unvented', 150)
    expect(result.storedHotWaterState).toBeNull()
  })

  it('storedHotWaterState is present for unvented cylinder', () => {
    const result = useDrawOffPlayback(storedDraw(), 'unvented', 150)
    expect(result.storedHotWaterState).not.toBeNull()
  })

  it('storedHotWaterState reflects cylinderSizeLitres and cylinderType', () => {
    const result = useDrawOffPlayback(storedDraw(), 'mixergy', 210)
    expect(result.storedHotWaterState?.cylinderSizeLitres).toBe(210)
    expect(result.storedHotWaterState?.cylinderType).toBe('mixergy')
  })

  it('storedHotWaterState is present for vented cylinder', () => {
    const result = useDrawOffPlayback(ventedDraw(), 'open_vented', 140)
    expect(result.storedHotWaterState).not.toBeNull()
  })

  it('storedHotWaterState defaults are used when cylinderType/size not provided', () => {
    const result = useDrawOffPlayback(storedDraw())
    // Should still return state (defaults: 'unvented', 150)
    expect(result.storedHotWaterState).not.toBeNull()
    expect(result.storedHotWaterState?.cylinderSizeLitres).toBe(150)
    expect(result.storedHotWaterState?.cylinderType).toBe('unvented')
  })
})

describe('useDrawOffPlayback — shared mains budget (stored unvented)', () => {
  function storedDrawWithOutlets(outlets: { shower: boolean; bath: boolean; kitchen: boolean }): SystemDiagramDisplayState {
    return {
      ...storedIdle(),
      hotDrawActive: true,
      outletDemands: outlets,
    }
  }

  it('solo shower on mains-fed stored: not constrained (no sharing required)', () => {
    const result = useDrawOffPlayback(storedDrawWithOutlets({ shower: true, bath: false, kitchen: false }))
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    expect(shower?.isConstrained).toBe(false)
    expect(shower?.flowLpm).toBeCloseTo(9.5)
  })

  it('shower + bath concurrent: both constrained because 9.5+8.0=17.5 > 12 L/min mains', () => {
    const result = useDrawOffPlayback(storedDrawWithOutlets({ shower: true, bath: true, kitchen: false }))
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    const bath   = result.outletStates.find(o => o.outletId === 'bath')
    expect(shower?.isConstrained).toBe(true)
    expect(bath?.isConstrained).toBe(true)
  })

  it('shower + bath + kitchen: total delivered ≤ 12 L/min shared budget', () => {
    const result = useDrawOffPlayback(storedDrawWithOutlets({ shower: true, bath: true, kitchen: true }))
    const total = result.outletStates
      .filter(o => o.open && o.coldSource !== 'cws')
      .reduce((sum, o) => sum + o.flowLpm, 0)
    expect(total).toBeLessThanOrEqual(12.1)
  })

  it('shower (mains) + kitchen (mains): each receives a proportional share', () => {
    const result = useDrawOffPlayback(storedDrawWithOutlets({ shower: true, bath: false, kitchen: true }))
    const shower  = result.outletStates.find(o => o.outletId === 'shower')
    const kitchen = result.outletStates.find(o => o.outletId === 'kitchen')
    // Demand: shower 9.5 + kitchen 5.5 = 15 L/min > 12 mains → both throttled
    expect(shower?.isConstrained).toBe(true)
    expect(kitchen?.isConstrained).toBe(true)
    // shower gets (9.5/15)*12 ≈ 7.6 L/min; kitchen gets (5.5/15)*12 ≈ 4.4 L/min
    expect(shower?.flowLpm).toBeLessThan(9.5)
    expect(kitchen?.flowLpm).toBeLessThan(5.5)
    const total = (shower?.flowLpm ?? 0) + (kitchen?.flowLpm ?? 0)
    expect(total).toBeLessThanOrEqual(12.1)
  })
})
