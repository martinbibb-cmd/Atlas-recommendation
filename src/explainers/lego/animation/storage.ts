// src/explainers/lego/animation/storage.ts

import { tempToHeatJPerKg, heatToTempC } from './thermal'

/** Specific heat capacity of water at ~20 °C (J/kg·K). */
const CP = 4180 // J/kgK

/**
 * Default standing heat-loss coefficient (kW per litre of storage volume).
 * Corresponds to ~1.5 kWh/24 h for a 180 L cylinder — typical ERP-grade insulation.
 * Use to derive a default standingLossKw when the caller does not supply one:
 *   standingLossKw = volumeL × STANDING_LOSS_KW_PER_L
 */
export const STANDING_LOSS_KW_PER_L = 1.5 / (24 * 180) // ≈ 3.47 × 10⁻⁴ kW/L

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

/**
 * Apply one time-step of standing (ambient) heat loss to the store.
 *
 * standingLossKw: total heat-loss rate to the surrounding room (kW).
 *   Derive a sensible default as: volumeL × STANDING_LOSS_KW_PER_L
 * dtS: elapsed simulated time in seconds.
 *
 * The store temperature will decline slowly over time even when no hot water
 * is drawn and no reheat is applied.  At real-time (1×) the loss is imperceptible;
 * at accelerated time scales (300×, 1800×) the gradual cool-down becomes visible,
 * making long-term standing losses observable in demos without falsifying the physics.
 */
export function applyStandingLoss(params: {
  store: CylinderStore
  standingLossKw: number
  dtS: number
}): CylinderStore {
  const lostJ = params.standingLossKw * 1000 * params.dtS
  return { ...params.store, energyJ: Math.max(0, params.store.energyJ - lostJ) }
}
