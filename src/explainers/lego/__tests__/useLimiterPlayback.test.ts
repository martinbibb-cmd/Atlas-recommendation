/**
 * Tests for useLimiterPlayback — the display adapter that derives
 * LimiterDisplayState from SystemDiagramDisplayState.
 *
 * Validates that:
 *   - No limiters are reported for a quiet idle combi state
 *   - combi_dhw_limit fires when a combi is drawing hot water
 *   - concurrent_demand fires when 2+ outlets are active
 *   - mains_flow_limit fires when mains-fed supply has concurrent draw
 *   - condensing_lost fires when return temp exceeds 55°C
 *   - cylinder_depleted fires (critical) when fill pct <= 15%
 *   - hasCritical reflects the presence of any critical limiter
 *   - Limiters are capped at 3
 *   - Results are sorted critical → warning → info
 *   - Mixergy usableReserveFactor=1.2 delays cylinder_depleted to lower threshold
 *   - mixergy_stratification info limiter fires during Mixergy DHW draws
 */

import { describe, it, expect } from 'vitest'
import { useLimiterPlayback } from '../simulator/useLimiterPlayback'
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
    phaseLabel: 'Standby',
  }
}

function combiDrawing(): SystemDiagramDisplayState {
  return {
    ...combiIdle(),
    systemMode: 'dhw_draw',
    hotDrawActive: true,
    serviceSwitchingActive: true,
    returnTempC: 48,
    outletDemands: { shower: true, bath: false, kitchen: false },
  }
}

function combiDrawingTwoOutlets(): SystemDiagramDisplayState {
  return {
    ...combiIdle(),
    systemMode: 'dhw_draw',
    hotDrawActive: true,
    serviceSwitchingActive: true,
    returnTempC: 48,
    outletDemands: { shower: true, bath: true, kitchen: false },
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
    cylinderFillPct: 0.70,
    returnTempC: 45,
    phaseLabel: 'Standby',
  }
}

function storedHighReturnTemp(): SystemDiagramDisplayState {
  return {
    ...storedIdle(),
    returnTempC: 60,
    systemMode: 'heating',
  }
}

function storedCylinderDepleted(): SystemDiagramDisplayState {
  return {
    ...storedIdle(),
    cylinderFillPct: 0.10,
  }
}

function storedTwoOutlets(): SystemDiagramDisplayState {
  return {
    ...storedIdle(),
    hotDrawActive: true,
    outletDemands: { shower: true, bath: true, kitchen: false },
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useLimiterPlayback — idle combi', () => {
  it('returns no active limiters for a quiet idle combi', () => {
    const result = useLimiterPlayback(combiIdle())
    expect(result.activeLimiters).toHaveLength(0)
  })

  it('hasCritical is false when there are no limiters', () => {
    const result = useLimiterPlayback(combiIdle())
    expect(result.hasCritical).toBe(false)
  })
})

describe('useLimiterPlayback — combi DHW limit', () => {
  it('fires combi_dhw_limit when combi is drawing hot water', () => {
    const result = useLimiterPlayback(combiDrawing())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('combi_dhw_limit')
  })

  it('combi_dhw_limit severity is warning', () => {
    const result = useLimiterPlayback(combiDrawing())
    const limiter = result.activeLimiters.find(l => l.id === 'combi_dhw_limit')
    expect(limiter?.severity).toBe('warning')
  })

  it('does not fire combi_dhw_limit for a stored system during hot draw', () => {
    const result = useLimiterPlayback(storedTwoOutlets())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('combi_dhw_limit')
  })
})

describe('useLimiterPlayback — concurrent demand', () => {
  it('fires concurrent_demand when 2 outlets are active on combi', () => {
    const result = useLimiterPlayback(combiDrawingTwoOutlets())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('concurrent_demand')
  })

  it('does not fire concurrent_demand when only 1 outlet is active', () => {
    const result = useLimiterPlayback(combiDrawing())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('concurrent_demand')
  })

  it('fires concurrent_demand when 2 outlets are active on stored system', () => {
    const result = useLimiterPlayback(storedTwoOutlets())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('concurrent_demand')
  })
})

describe('useLimiterPlayback — mains flow limit', () => {
  it('fires mains_flow_limit for mains-fed system with concurrent draw', () => {
    const result = useLimiterPlayback(combiDrawingTwoOutlets())
    const ids = result.activeLimiters.map(l => l.id)
    // combi uses mainsColdIn supply
    expect(ids).toContain('mains_flow_limit')
  })

  it('mains_flow_limit severity is info', () => {
    const result = useLimiterPlayback(combiDrawingTwoOutlets())
    const limiter = result.activeLimiters.find(l => l.id === 'mains_flow_limit')
    // May be capped at MAX_LIMITERS=3 — only assert severity if present
    if (limiter) {
      expect(limiter.severity).toBe('info')
    }
  })
})

describe('useLimiterPlayback — condensing lost', () => {
  it('fires condensing_lost when return temp exceeds 55°C on a boiler system', () => {
    const result = useLimiterPlayback(storedHighReturnTemp())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('condensing_lost')
  })

  it('condensing_lost severity is warning', () => {
    const result = useLimiterPlayback(storedHighReturnTemp())
    const limiter = result.activeLimiters.find(l => l.id === 'condensing_lost')
    expect(limiter?.severity).toBe('warning')
  })

  it('does not fire condensing_lost when return temp is at threshold (55°C)', () => {
    const state: SystemDiagramDisplayState = { ...storedIdle(), returnTempC: 55, systemMode: 'heating' }
    const result = useLimiterPlayback(state)
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('condensing_lost')
  })

  it('does not fire condensing_lost for heat pump systems', () => {
    const hpState: SystemDiagramDisplayState = {
      systemMode: 'heating',
      systemType: 'unvented_cylinder',
      heatSourceType: 'heat_pump',
      serviceSwitchingActive: false,
      supplyOrigins: supplyOriginsForSystemType('unvented_cylinder', { isHeatPump: true }),
      hotDrawActive: false,
      cylinderFillPct: 0.7,
      cop: 3.2,
      phaseLabel: 'Heating',
    }
    const result = useLimiterPlayback(hpState)
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('condensing_lost')
  })
})

describe('useLimiterPlayback — cylinder depleted', () => {
  it('fires cylinder_depleted when fill pct is 10% (below 15% threshold)', () => {
    const result = useLimiterPlayback(storedCylinderDepleted())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('cylinder_depleted')
  })

  it('cylinder_depleted severity is critical', () => {
    const result = useLimiterPlayback(storedCylinderDepleted())
    const limiter = result.activeLimiters.find(l => l.id === 'cylinder_depleted')
    expect(limiter?.severity).toBe('critical')
  })

  it('hasCritical is true when cylinder is depleted', () => {
    const result = useLimiterPlayback(storedCylinderDepleted())
    expect(result.hasCritical).toBe(true)
  })

  it('does not fire cylinder_depleted when fill pct is 20% (above threshold)', () => {
    const state: SystemDiagramDisplayState = { ...storedIdle(), cylinderFillPct: 0.20 }
    const result = useLimiterPlayback(state)
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('cylinder_depleted')
  })

  it('does not fire cylinder_depleted for combi (no cylinder)', () => {
    const result = useLimiterPlayback(combiDrawing())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('cylinder_depleted')
  })
})

describe('useLimiterPlayback — ordering and cap', () => {
  it('critical limiters appear before warning limiters', () => {
    const state: SystemDiagramDisplayState = {
      ...storedIdle(),
      cylinderFillPct: 0.10,       // critical: cylinder_depleted
      returnTempC: 60,              // warning: condensing_lost
      systemMode: 'heating',
    }
    const result = useLimiterPlayback(state)
    const severities = result.activeLimiters.map(l => l.severity)
    const criticalIndex = severities.indexOf('critical')
    const warningIndex  = severities.indexOf('warning')
    expect(criticalIndex).toBeLessThan(warningIndex)
  })

  it('caps active limiters at 3', () => {
    // Trigger: cylinder_depleted (critical) + condensing_lost (warning) +
    //          concurrent_demand (warning) + mains_flow_limit (info) = 4 potential
    const state: SystemDiagramDisplayState = {
      ...storedIdle(),
      cylinderFillPct: 0.10,
      returnTempC: 60,
      systemMode: 'heating',
      outletDemands: { shower: true, bath: true, kitchen: false },
      hotDrawActive: true,
    }
    const result = useLimiterPlayback(state)
    expect(result.activeLimiters.length).toBeLessThanOrEqual(3)
  })
})

// ─── targetComponent ──────────────────────────────────────────────────────────

describe('useLimiterPlayback — targetComponent', () => {
  it('combi_dhw_limit targets boiler and pipe-dhw-hot lane', () => {
    const result = useLimiterPlayback(combiDrawing())
    const limiter = result.activeLimiters.find(l => l.id === 'combi_dhw_limit')
    expect(limiter?.targetComponent).toEqual(['boiler', 'pipe-dhw-hot'])
  })

  it('concurrent_demand targets plate_hex on combi system', () => {
    const result = useLimiterPlayback(combiDrawingTwoOutlets())
    const limiter = result.activeLimiters.find(l => l.id === 'concurrent_demand')
    expect(limiter?.targetComponent).toBe('plate_hex')
  })

  it('concurrent_demand targets cylinder on stored system', () => {
    const result = useLimiterPlayback(storedTwoOutlets())
    const limiter = result.activeLimiters.find(l => l.id === 'concurrent_demand')
    expect(limiter?.targetComponent).toBe('cylinder')
  })

  it('cylinder_depleted targets cylinder and pipe-stored-hot lane', () => {
    const result = useLimiterPlayback(storedCylinderDepleted())
    const limiter = result.activeLimiters.find(l => l.id === 'cylinder_depleted')
    expect(limiter?.targetComponent).toEqual(['cylinder', 'pipe-stored-hot'])
  })

  it('condensing_lost targets boiler and pipe-return', () => {
    const result = useLimiterPlayback(storedHighReturnTemp())
    const limiter = result.activeLimiters.find(l => l.id === 'condensing_lost')
    expect(limiter?.targetComponent).toEqual(['boiler', 'pipe-return'])
  })

  it('mains_flow_limit targets mains and pipe-cold-feed lane', () => {
    const result = useLimiterPlayback(combiDrawingTwoOutlets())
    const limiter = result.activeLimiters.find(l => l.id === 'mains_flow_limit')
    if (limiter) {
      expect(limiter.targetComponent).toEqual(['mains', 'pipe-cold-feed'])
    }
  })
})

// ─── combiPowerKw and coldInletTempC parameters ───────────────────────────────

describe('useLimiterPlayback — combiPowerKw and coldInletTempC', () => {
  it('combi_dhw_limit explanation uses default 30 kW when no combiPowerKw provided', () => {
    const result = useLimiterPlayback(combiDrawing())
    const limiter = result.activeLimiters.find(l => l.id === 'combi_dhw_limit')
    // Flow at 30 kW, default coldInletTempC=10, ΔT=45-10=35°C:
    // round(30 * 860 / (60 * 35)) = round(12.29) = 12 L/min
    expect(limiter?.explanation).toContain('30 kW')
    expect(limiter?.explanation).toContain('12 L/min')
    expect(limiter?.explanation).toContain('35°C rise')
  })

  it('combi_dhw_limit explanation uses custom combiPowerKw', () => {
    const result = useLimiterPlayback(combiDrawing(), 24)
    const limiter = result.activeLimiters.find(l => l.id === 'combi_dhw_limit')
    // Flow at 24 kW, default coldInletTempC=10, ΔT=35°C:
    // round(24 * 860 / (60 * 35)) = round(9.83) = 10 L/min
    expect(limiter?.explanation).toContain('24 kW')
    expect(limiter?.explanation).toContain('10 L/min')
  })

  it('combi_dhw_limit flow rate increases when cold inlet temp is higher (smaller ΔT)', () => {
    // Cold inlet 15°C → ΔT = 45-15 = 30°C → flow = round(30*860/(60*30)) = round(14.33) = 14 L/min
    const result = useLimiterPlayback(combiDrawing(), 30, 15)
    const limiter = result.activeLimiters.find(l => l.id === 'combi_dhw_limit')
    expect(limiter?.explanation).toContain('14 L/min')
    expect(limiter?.explanation).toContain('30°C rise')
  })

  it('combi_dhw_limit flow rate decreases when cold inlet temp is lower (larger ΔT)', () => {
    // Cold inlet 5°C → ΔT = 45-5 = 40°C → flow = round(30*860/(60*40)) = round(10.75) = 11 L/min
    const result = useLimiterPlayback(combiDrawing(), 30, 5)
    const limiter = result.activeLimiters.find(l => l.id === 'combi_dhw_limit')
    expect(limiter?.explanation).toContain('11 L/min')
    expect(limiter?.explanation).toContain('40°C rise')
  })
})

// ─── New emitter / primary circuit limiters ───────────────────────────────────

import { useEmitterPrimaryModel } from '../simulator/useEmitterPrimaryModel'
import type { EmitterPrimaryDisplayState } from '../simulator/useEmitterPrimaryModel'

function emitterStateDefault(): EmitterPrimaryDisplayState {
  // Default: radiators, 22mm pipe, 1.0× factor → flowTemp = 70°C, not adequate
  return useEmitterPrimaryModel({
    emitterCapacityFactor: 1.0,
    primaryPipeSize: '22mm',
    emitterType: 'radiators',
    weatherCompensation: false,
  })
}

function emitterStateOversized(): EmitterPrimaryDisplayState {
  // Oversized radiators: flowTemp ≈ 53.8°C, adequate
  return useEmitterPrimaryModel({
    emitterCapacityFactor: 1.0,
    primaryPipeSize: '22mm',
    emitterType: 'oversized_radiators',
    weatherCompensation: false,
  })
}

function emitterStateUfh(): EmitterPrimaryDisplayState {
  // UFH: flowTemp ≈ 38.9°C, low-temp capable
  return useEmitterPrimaryModel({
    emitterCapacityFactor: 1.0,
    primaryPipeSize: '22mm',
    emitterType: 'ufh',
    weatherCompensation: false,
  })
}

function emitterStateSmallPipe(): EmitterPrimaryDisplayState {
  // 15mm pipe: primary capacity 12 kW < BASE_HEAT_DEMAND_KW (14 kW)
  return useEmitterPrimaryModel({
    emitterCapacityFactor: 1.0,
    primaryPipeSize: '15mm',
    emitterType: 'radiators',
    weatherCompensation: false,
  })
}

describe('useLimiterPlayback — emitter_undersized', () => {
  it('fires emitter_undersized when default radiators produce 70°C flow temp', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, emitterStateDefault())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('emitter_undersized')
  })

  it('emitter_undersized severity is warning', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, emitterStateDefault())
    const limiter = result.activeLimiters.find(l => l.id === 'emitter_undersized')
    expect(limiter?.severity).toBe('warning')
  })

  it('emitter_undersized targets emitters', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, emitterStateDefault())
    const limiter = result.activeLimiters.find(l => l.id === 'emitter_undersized')
    expect(limiter?.targetComponent).toBe('emitters')
  })

  it('does not fire emitter_undersized when oversized radiators lower flow below 65°C', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, emitterStateOversized())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('emitter_undersized')
  })

  it('does not fire emitter_undersized when no emitter state is provided', () => {
    const result = useLimiterPlayback(storedIdle())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('emitter_undersized')
  })
})

describe('useLimiterPlayback — primary_circuit_limit', () => {
  it('fires primary_circuit_limit when 15mm pipe has insufficient capacity', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, emitterStateSmallPipe())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('primary_circuit_limit')
  })

  it('primary_circuit_limit severity is warning', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, emitterStateSmallPipe())
    const limiter = result.activeLimiters.find(l => l.id === 'primary_circuit_limit')
    expect(limiter?.severity).toBe('warning')
  })

  it('primary_circuit_limit targets pipe-flow', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, emitterStateSmallPipe())
    const limiter = result.activeLimiters.find(l => l.id === 'primary_circuit_limit')
    expect(limiter?.targetComponent).toBe('pipe-flow')
  })

  it('does not fire primary_circuit_limit when 22mm pipe is adequate', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, emitterStateDefault())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('primary_circuit_limit')
  })

  it('does not fire primary_circuit_limit when no emitter state is provided', () => {
    const result = useLimiterPlayback(storedIdle())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('primary_circuit_limit')
  })
})

describe('useLimiterPlayback — low_temp_capable', () => {
  it('fires low_temp_capable when UFH produces sub-50°C flow temperature', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, emitterStateUfh())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('low_temp_capable')
  })

  it('low_temp_capable severity is info', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, emitterStateUfh())
    const limiter = result.activeLimiters.find(l => l.id === 'low_temp_capable')
    expect(limiter?.severity).toBe('info')
  })

  it('low_temp_capable targets emitters', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, emitterStateUfh())
    const limiter = result.activeLimiters.find(l => l.id === 'low_temp_capable')
    expect(limiter?.targetComponent).toBe('emitters')
  })

  it('does not fire low_temp_capable when flow temp is 65°C (above 50°C threshold)', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, emitterStateDefault())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('low_temp_capable')
  })

  it('does not fire low_temp_capable when no emitter state is provided', () => {
    const result = useLimiterPlayback(storedIdle())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('low_temp_capable')
  })
})

// ─── Mixergy cylinder behaviour ───────────────────────────────────────────────

describe('useLimiterPlayback — Mixergy usableReserveFactor', () => {
  // MIXERGY_USABLE_RESERVE_FACTOR = 1.2
  // Standard fires when fillPct <= 0.15.
  // Mixergy fires when fillPct * 1.2 <= 0.15 → fillPct <= 0.125.

  it('cylinder_depleted fires for standard cylinder at 15% fill', () => {
    const state: SystemDiagramDisplayState = { ...storedIdle(), cylinderFillPct: 0.15 }
    const result = useLimiterPlayback(state, 30, 10, undefined, 'unvented')
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('cylinder_depleted')
  })

  it('cylinder_depleted does NOT fire for Mixergy at 15% fill (stratification gives extra reserve)', () => {
    // 0.15 * 1.2 = 0.18 > 0.15 threshold → no depletion
    const state: SystemDiagramDisplayState = { ...storedIdle(), cylinderFillPct: 0.15 }
    const result = useLimiterPlayback(state, 30, 10, undefined, 'mixergy')
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('cylinder_depleted')
  })

  it('cylinder_depleted fires for Mixergy at 10% fill (below effective threshold)', () => {
    // 0.10 * 1.2 = 0.12 <= 0.15 → depleted
    const state: SystemDiagramDisplayState = { ...storedIdle(), cylinderFillPct: 0.10 }
    const result = useLimiterPlayback(state, 30, 10, undefined, 'mixergy')
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('cylinder_depleted')
  })

  it('cylinder_depleted does NOT fire for Mixergy at 13% fill (just above effective threshold)', () => {
    // 0.13 * 1.2 = 0.156 > 0.15 → not depleted
    const state: SystemDiagramDisplayState = { ...storedIdle(), cylinderFillPct: 0.13 }
    const result = useLimiterPlayback(state, 30, 10, undefined, 'mixergy')
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('cylinder_depleted')
  })
})

describe('useLimiterPlayback — mixergy_stratification limiter', () => {
  it('fires mixergy_stratification when Mixergy cylinder has an active hot draw', () => {
    const state: SystemDiagramDisplayState = {
      ...storedIdle(),
      hotDrawActive: true,
      outletDemands: { shower: true, bath: false, kitchen: false },
    }
    const result = useLimiterPlayback(state, 30, 10, undefined, 'mixergy')
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('mixergy_stratification')
  })

  it('mixergy_stratification severity is info', () => {
    const state: SystemDiagramDisplayState = { ...storedIdle(), hotDrawActive: true }
    const result = useLimiterPlayback(state, 30, 10, undefined, 'mixergy')
    const limiter = result.activeLimiters.find(l => l.id === 'mixergy_stratification')
    expect(limiter?.severity).toBe('info')
  })

  it('mixergy_stratification targets cylinder', () => {
    const state: SystemDiagramDisplayState = { ...storedIdle(), hotDrawActive: true }
    const result = useLimiterPlayback(state, 30, 10, undefined, 'mixergy')
    const limiter = result.activeLimiters.find(l => l.id === 'mixergy_stratification')
    expect(limiter?.targetComponent).toBe('cylinder')
  })

  it('does NOT fire mixergy_stratification when cylinder is idle (no draw)', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, undefined, 'mixergy')
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('mixergy_stratification')
  })

  it('does NOT fire mixergy_stratification for standard unvented cylinder', () => {
    const state: SystemDiagramDisplayState = { ...storedIdle(), hotDrawActive: true }
    const result = useLimiterPlayback(state, 30, 10, undefined, 'unvented')
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('mixergy_stratification')
  })

  it('does NOT fire mixergy_stratification when no cylinderType provided', () => {
    const state: SystemDiagramDisplayState = { ...storedIdle(), hotDrawActive: true }
    const result = useLimiterPlayback(state)
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('mixergy_stratification')
  })
})

// ─── System condition (sludge / scale) limiters ───────────────────────────────

describe('useLimiterPlayback — system condition', () => {
  it('does NOT fire a condition limiter when systemCondition is "clean"', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, undefined, undefined, 'clean')
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('sludge_build_up')
    expect(ids).not.toContain('scale_build_up')
  })

  it('does NOT fire a condition limiter when systemCondition is omitted', () => {
    const result = useLimiterPlayback(storedIdle())
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('sludge_build_up')
    expect(ids).not.toContain('scale_build_up')
  })

  it('fires sludge_build_up when systemCondition is "sludged"', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, undefined, undefined, 'sludged')
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('sludge_build_up')
  })

  it('sludge_build_up severity is warning', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, undefined, undefined, 'sludged')
    const limiter = result.activeLimiters.find(l => l.id === 'sludge_build_up')
    expect(limiter?.severity).toBe('warning')
  })

  it('sludge_build_up targets boiler', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, undefined, undefined, 'sludged')
    const limiter = result.activeLimiters.find(l => l.id === 'sludge_build_up')
    expect(limiter?.targetComponent).toBe('boiler')
  })

  it('fires scale_build_up when systemCondition is "scaled"', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, undefined, undefined, 'scaled')
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).toContain('scale_build_up')
  })

  it('scale_build_up severity is warning', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, undefined, undefined, 'scaled')
    const limiter = result.activeLimiters.find(l => l.id === 'scale_build_up')
    expect(limiter?.severity).toBe('warning')
  })

  it('scale_build_up targets boiler', () => {
    const result = useLimiterPlayback(storedIdle(), 30, 10, undefined, undefined, 'scaled')
    const limiter = result.activeLimiters.find(l => l.id === 'scale_build_up')
    expect(limiter?.targetComponent).toBe('boiler')
  })

  it('does NOT fire sludge_build_up for combi idle with clean condition', () => {
    const result = useLimiterPlayback(combiIdle(), 30, 10, undefined, undefined, 'clean')
    const ids = result.activeLimiters.map(l => l.id)
    expect(ids).not.toContain('sludge_build_up')
  })
})
