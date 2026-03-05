// src/explainers/lego/animation/capacitySummary.ts

import type { LabControls, OutletId } from './types'
import { computeCombiThermalLimit, pipeDiameterCapacityLpm } from '../model/dhwModel'
import { computeCombiOutletTemp } from './thermal'

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
   * Derived from boilerKw, hydraulicFlowLpm, and coldInletC using:
   *   ΔT = (boilerKw × 60) / (flowLpm × 4.19)
   */
  achievedOutTempC?: number
  /**
   * Boiler kW required to reach the DHW setpoint at the current hydraulic flow rate.
   * Only present for combi system type. Used to show "Required: XX kW vs Boiler: YY kW".
   */
  requiredKw?: number
}

export function computeCapacitySummary(c: LabControls): CapacitySummary {
  const activeOutlets = c.outlets.filter(o => o.enabled && o.demandLpm > 0)
  const demandTotalLpm = activeOutlets.reduce((sum, o) => sum + o.demandLpm, 0)

  const isCylinder = c.systemType === 'unvented_cylinder' || c.systemType === 'vented_cylinder'

  // Supply cap: vented cylinders are limited by head pressure
  const ventedCap = c.systemType === 'vented_cylinder' && c.vented
    ? Math.min(c.mainsDynamicFlowLpm, c.vented.headMeters * 6)
    : Infinity
  const supplyCapLpm = c.systemType === 'vented_cylinder' ? ventedCap : c.mainsDynamicFlowLpm

  const pipeCapLpm = pipeDiameterCapacityLpm(c.pipeDiameterMm) ?? Infinity

  // Thermal cap: only meaningful for combi; cylinders deliver from store (no fixed rate limit here)
  const thermalCapLpm = isCylinder
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
  if (!isCylinder && demandTotalLpm > thermalCapLpm)
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

  // Combi thermal outcome: compute achieved outlet temperature from actual hydraulic flow.
  // Only meaningful when there is active flow and the system is a combi.
  const combiThermal = !isCylinder && hydraulicFlowLpm > 0
    ? computeCombiOutletTemp({
        boilerKw: c.combiDhwKw,
        flowLpm: hydraulicFlowLpm,
        coldInletC: c.coldInletC,
        targetTempC: c.dhwSetpointC,
      })
    : undefined

  return {
    demandTotalLpm,
    supplyCapLpm,
    pipeCapLpm,
    thermalCapLpm,
    hydraulicFlowLpm,
    limitingComponent,
    warnings,
    outletDeliveredLpm,
    achievedOutTempC: combiThermal?.achievedOutTempC,
    requiredKw: combiThermal?.requiredKw,
  }
}
