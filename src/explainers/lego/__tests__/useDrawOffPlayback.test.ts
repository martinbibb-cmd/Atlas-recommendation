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

  it('bath is open during stored draw (concurrent draws at full spec)', () => {
    const result = useDrawOffPlayback(storedDraw())
    const bath = result.outletStates.find(o => o.outletId === 'bath')
    expect(bath?.open).toBe(true)
  })

  it('bath is NOT constrained during stored draw', () => {
    const result = useDrawOffPlayback(storedDraw())
    const bath = result.outletStates.find(o => o.outletId === 'bath')
    expect(bath?.isConstrained).toBe(false)
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

  it('both shower and bath open for vented (stored draws at full spec)', () => {
    const result = useDrawOffPlayback(ventedDraw())
    const shower = result.outletStates.find(o => o.outletId === 'shower')
    const bath = result.outletStates.find(o => o.outletId === 'bath')
    expect(shower?.open).toBe(true)
    expect(bath?.open).toBe(true)
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
