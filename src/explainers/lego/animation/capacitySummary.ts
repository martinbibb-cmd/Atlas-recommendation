// src/explainers/lego/animation/capacitySummary.ts

import type { LabControls, OutletId, SystemMode } from './types'
import { computeCombiThermalLimit, pipeDiameterCapacityLpm } from '../model/dhwModel'
import { clampAnimationSetpointC, computeCombiOutletTemp, computeTmvMixer } from './thermal'
import type { TmvOutcome } from './thermal'

export type { TmvOutcome }

function slotForOutletId(outletId: string): 'A' | 'B' | 'C' | null {
  if (outletId === 'A' || outletId === 'OutletA') return 'A'
  if (outletId === 'B' || outletId === 'OutletB') return 'B'
  if (outletId === 'C' || outletId === 'OutletC') return 'C'
  return null
}

export type CapacitySummary = {
  demandTotalLpm: number
  supplyCapLpm: number
  pipeCapLpm: number
  thermalCapLpm: number
  hydraulicFlowLpm: number
  limitingComponent: 'Supply' | 'Pipe' | 'Thermal' | 'Demand'
  warnings: string[]
  /** Hydraulic flow delivered to each outlet, split proportionally by outlet demand. */
  outletDeliveredLpm: Record<OutletId, number>
  /**
   * Achieved combi outlet temperature (°C) — only present for combi system type.
   * For TMV outlets this is the boiler hot-side temperature (T_h), not the mixed
   * delivery temperature (see tmvOutcomes for T_mix per outlet).
   */
  achievedOutTempC?: number
  /**
   * Boiler kW required to reach the DHW setpoint at the current hydraulic flow rate.
   * Only present for combi system type. Used to show "Required: XX kW vs Boiler: YY kW".
   */
  requiredKw?: number
  /**
   * Per-outlet thermostatic mixer valve (TMV) outcomes.
   * Present only for combi system type when at least one shower_mixer outlet has
   * `tmvEnabled = true`.  Undefined entries indicate the outlet has no TMV.
   */
  tmvOutcomes?: Record<OutletId, TmvOutcome | undefined>
  /**
   * True when at least one TMV outlet is saturated (hot supply too cool to reach
   * the target shower temperature).
   */
  tmvSaturated?: boolean
  hexFlowLpm: number
  coldBypassLpm: number
  hotFedCount: number
  mode: SystemMode
  badges: string[]
}

export function computeCapacitySummary(c: LabControls): CapacitySummary {
  const activeOutlets = c.outlets.filter(o => o.enabled && o.demandLpm > 0)
  const demandTotalLpm = activeOutlets.reduce((sum, o) => sum + o.demandLpm, 0)

  const isCylinder = c.systemType === 'unvented_cylinder' || c.systemType === 'vented_cylinder'
  const heatSourceType = c.heatSourceType ?? (c.systemType === 'combi' ? 'combi' : 'system_boiler')
  const isCombi = heatSourceType === 'combi'
  const hasStoredDhw = c.graphFacts?.hasStoredDhw ?? isCylinder

  // Supply cap: vented cylinders are limited by head pressure
  const ventedCap = c.systemType === 'vented_cylinder' && c.vented
    ? Math.min(c.mainsDynamicFlowLpm, c.vented.headMeters * 6)
    : Infinity
  const supplyCapLpm = c.systemType === 'vented_cylinder' ? ventedCap : c.mainsDynamicFlowLpm

  const pipeCapLpm = pipeDiameterCapacityLpm(c.pipeDiameterMm) ?? Infinity

  // Thermal cap: only meaningful for combi; cylinders deliver from store (no fixed rate limit here)
  const thermalCapLpm = !isCombi
    ? Infinity
    : computeCombiThermalLimit({
        dhwOutputKw: c.combiDhwKw,
        coldTempC: c.coldInletC,
        setpointC: c.dhwSetpointC,
      })

  const hydraulicFlowLpm = Math.min(demandTotalLpm, supplyCapLpm, pipeCapLpm)

  // If no demand, bottleneck is "Demand" itself (nothing is being asked for).
  let limitingComponent: CapacitySummary['limitingComponent']
  if (demandTotalLpm === 0) {
    limitingComponent = 'Demand'
  } else {
    // bottleneck: smallest of (supply, pipe, thermal) relative to demand
    const caps = [
      { name: 'Supply' as const, lpm: supplyCapLpm },
      { name: 'Pipe' as const, lpm: pipeCapLpm },
      { name: 'Thermal' as const, lpm: thermalCapLpm },
    ].sort((a, b) => a.lpm - b.lpm)
    limitingComponent = caps[0].name
  }

  const warnings: string[] = []
  if (isCombi && demandTotalLpm > thermalCapLpm)
    warnings.push('Demand exceeds combi thermal capacity → outlet temperature droop')
  if (demandTotalLpm > pipeCapLpm)
    warnings.push('Demand exceeds distribution capacity → flow throttled by pipework')
  if (demandTotalLpm > supplyCapLpm)
    warnings.push('Demand exceeds supply capacity → flow throttled by mains')

  // Split hydraulic flow proportionally to each active outlet's demand
  const outletDeliveredLpm: Record<OutletId, number> = { A: 0, B: 0, C: 0 }
  if (demandTotalLpm > 0) {
    for (const o of activeOutlets) {
      outletDeliveredLpm[o.id] = hydraulicFlowLpm * (o.demandLpm / demandTotalLpm)
    }
  }

  const bindings = c.outletBindings ?? {}
  const hotFedIds = new Set(c.graphFacts?.hotFedOutletNodeIds ?? [])
  const coldOnlyIds = new Set(c.graphFacts?.coldOnlyOutletNodeIds ?? [])

  let hexFlowLpm = 0
  let coldBypassLpm = 0
  let hotFedCount = 0

  for (const o of activeOutlets) {
    const delivered = outletDeliveredLpm[o.id]
    const slot = slotForOutletId(o.id)
    const nodeId = slot ? bindings[slot] : undefined

    if (nodeId && coldOnlyIds.has(nodeId)) {
      coldBypassLpm += delivered
      continue
    }

    if (nodeId && hotFedIds.has(nodeId)) {
      hexFlowLpm += delivered
      hotFedCount += 1
      continue
    }

    // fallback: treat unbound outlets as hot-fed (keeps old behaviour)
    hexFlowLpm += delivered
    hotFedCount += 1
  }

  // Combi thermal outcome: compute achieved outlet temperature from HEX flow (hydraulic minus bypass).
  // Only meaningful when there is active flow through the HEX and the system is a combi.
  const combiThermal = isCombi && hexFlowLpm > 0
    ? computeCombiOutletTemp({
        boilerKw: c.combiDhwKw,
        flowLpm: hexFlowLpm,
        coldInletC: c.coldInletC,
        targetTempC: clampAnimationSetpointC(c.dhwSetpointC),
      })
    : undefined

  // ── TMV outcomes (combi only) ─────────────────────────────────────────────
  // For each active shower_mixer outlet with tmvEnabled, compute the mixer physics.
  // The boiler hot-side temperature (T_h) is computed from the hot-side flow (F_h)
  // through the HEX — which is less than the full outlet demand (F_out), because
  // the cold supply bypass (F_c = F_out − F_h) bypasses the HEX entirely.
  let tmvOutcomes: Record<OutletId, TmvOutcome | undefined> | undefined
  let tmvSaturated: boolean | undefined
  let achievedOutTempC = combiThermal?.achievedOutTempC
  let requiredKw = combiThermal?.requiredKw

  if (isCombi && hydraulicFlowLpm > 0) {
    const tmvActive = activeOutlets.some(
      o => o.kind === 'shower_mixer' && o.tmvEnabled
    )

    if (tmvActive) {
      tmvOutcomes = { A: undefined, B: undefined, C: undefined }
      let anyTmvSaturated = false
      let firstTmvT_h: number | undefined

      for (const o of activeOutlets) {
        if (o.kind === 'shower_mixer' && o.tmvEnabled) {
          const F_out = outletDeliveredLpm[o.id]
          const outcome = computeTmvMixer({
            boilerKw: c.combiDhwKw,
            combiSetpointC: c.dhwSetpointC,
            coldInTempC: c.coldInletC,
            showerDeliveredLpm: F_out,
            targetTempC: o.tmvTargetTempC ?? 40,
          })
          tmvOutcomes[o.id] = outcome
          if (outcome.saturated) anyTmvSaturated = true
          if (firstTmvT_h === undefined) firstTmvT_h = outcome.T_h
        }
      }

      tmvSaturated = anyTmvSaturated

      // Override achievedOutTempC with the boiler hot-side temperature from the
      // first TMV outlet — this drives the post-HEX pipe colour in the animation.
      if (firstTmvT_h !== undefined) {
        achievedOutTempC = firstTmvT_h
        // requiredKw stays as-is (informational only for non-TMV display)
      }
    }
  }

  const heatingDemandKw = c.heatDemandKw ?? 0
  const hotDrawActive = hexFlowLpm > 0.01
  let mode: SystemMode = 'idle'
  if (isCombi) {
    if (hotDrawActive) mode = 'dhw_draw'
    else if (heatingDemandKw > 0.1) mode = 'heating'
  } else {
    if (heatingDemandKw > 0.1) mode = 'heating'
    else if (hasStoredDhw) mode = 'dhw_reheat'
  }

  const badges: string[] = []
  if (isCombi && mode === 'dhw_draw') badges.push('During DHW draw, CH paused')
  if (hasStoredDhw) badges.push('DHW draw uses store; reheat scheduled')

  return {
    demandTotalLpm,
    supplyCapLpm,
    pipeCapLpm,
    thermalCapLpm,
    hydraulicFlowLpm,
    limitingComponent,
    warnings,
    outletDeliveredLpm,
    achievedOutTempC,
    requiredKw,
    tmvOutcomes,
    tmvSaturated,
    hexFlowLpm,
    coldBypassLpm,
    hotFedCount,
    mode,
    badges,
  }
}
