// src/explainers/lego/animation/capacitySummary.ts

import type { LabControls } from './types'
import { computeCombiThermalLimit, pipeDiameterCapacityLpm } from '../model/dhwModel'

export type CapacitySummary = {
  demandTotalLpm: number
  supplyCapLpm: number
  pipeCapLpm: number
  thermalCapLpm: number
  hydraulicFlowLpm: number
  limitingComponent: 'Supply' | 'Pipe' | 'Thermal' | 'Demand'
  warnings: string[]
}

export function computeCapacitySummary(c: LabControls): CapacitySummary {
  const demandTotalLpm = c.outlets * c.demandPerOutletLpm

  const supplyCapLpm = c.mainsDynamicFlowLpm
  const pipeCapLpm = pipeDiameterCapacityLpm(c.pipeDiameterMm) ?? Infinity
  const thermalCapLpm = computeCombiThermalLimit({
    dhwOutputKw: c.combiDhwKw,
    coldTempC: c.coldInletC,
    setpointC: c.dhwSetpointC,
  })

  const hydraulicFlowLpm = Math.min(demandTotalLpm, supplyCapLpm, pipeCapLpm)

  // bottleneck: smallest of (supply, pipe, thermal) relative to demand
  const caps = [
    { name: 'Supply' as const, lpm: supplyCapLpm },
    { name: 'Pipe' as const, lpm: pipeCapLpm },
    { name: 'Thermal' as const, lpm: thermalCapLpm },
  ].sort((a, b) => a.lpm - b.lpm)

  const limitingComponent = caps[0].name

  const warnings: string[] = []
  if (demandTotalLpm > thermalCapLpm) warnings.push('Demand exceeds combi thermal capacity → outlet temperature droop')
  if (demandTotalLpm > pipeCapLpm) warnings.push('Demand exceeds distribution capacity → flow throttled by pipework')
  if (demandTotalLpm > supplyCapLpm) warnings.push('Demand exceeds supply capacity → flow throttled by mains')

  return {
    demandTotalLpm,
    supplyCapLpm,
    pipeCapLpm,
    thermalCapLpm,
    hydraulicFlowLpm,
    limitingComponent,
    warnings,
  }
}
