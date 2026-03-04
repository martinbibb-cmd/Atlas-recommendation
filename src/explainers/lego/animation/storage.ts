// src/explainers/lego/animation/storage.ts

import { tempToHeatJPerKg, heatToTempC } from './thermal'

/** Specific heat capacity of water at ~20 °C (J/kg·K). */
const CP = 4180 // J/kgK

export type CylinderStore = {
  volumeL: number
  /** Energy stored above cold baseline (J). */
  energyJ: number
}

/**
 * Initialise a cylinder store at a given temperature.
 */
export function createCylinderStore(params: {
  volumeL: number
  coldInletC: number
  initialTempC: number
}): CylinderStore {
  const massKg = params.volumeL // 1 L ≈ 1 kg
  const hJPerKg = tempToHeatJPerKg({ coldInletC: params.coldInletC, tempC: params.initialTempC })
  return { volumeL: params.volumeL, energyJ: massKg * hJPerKg }
}

/**
 * Derive the uniform store temperature from its energy content.
 */
export function cylinderTempC(params: { store: CylinderStore; coldInletC: number }): number {
  const massKg = params.store.volumeL
  const hJPerKg = massKg > 0 ? params.store.energyJ / massKg : 0
  return heatToTempC({ coldInletC: params.coldInletC, hJPerKg })
}

/**
 * Add reheat energy to the store for one time-step.
 * reheatKw: boiler/coil power delivered to the store (kW)
 * dtS: elapsed time in seconds
 */
export function addReheatEnergy(params: {
  store: CylinderStore
  reheatKw: number
  dtS: number
}): CylinderStore {
  return { ...params.store, energyJ: params.store.energyJ + params.reheatKw * 1000 * params.dtS }
}

/**
 * Remove energy from the store proportional to the hot-water draw.
 * drawLpm: volumetric flow at the hot outlet (L/min)
 * deliveredTempC: temperature at which hot water is delivered
 * coldInletC: cold feed temperature (replaces drawn hot water)
 * dtS: elapsed time in seconds
 */
export function removeDrawEnergy(params: {
  store: CylinderStore
  coldInletC: number
  drawLpm: number
  deliveredTempC: number
  dtS: number
}): CylinderStore {
  const mKg = (params.drawLpm / 60) * params.dtS
  const deltaT = Math.max(0, params.deliveredTempC - params.coldInletC)
  const qJ = mKg * CP * deltaT
  return { ...params.store, energyJ: Math.max(0, params.store.energyJ - qJ) }
}
