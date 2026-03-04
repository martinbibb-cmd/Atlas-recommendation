// src/explainers/lego/animation/capacitySummary.ts

import type { LabControls, OutletId } from './types'
import { computeCombiThermalLimit, pipeDiameterCapacityLpm } from '../model/dhwModel'

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

  return {
    demandTotalLpm,
    supplyCapLpm,
    pipeCapLpm,
    thermalCapLpm,
    hydraulicFlowLpm,
    limitingComponent,
    warnings,
    outletDeliveredLpm,
  }
}
