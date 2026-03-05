// src/explainers/lego/animation/types.ts

import type { CylinderStore } from './storage'

export type OutletId = 'A' | 'B' | 'C'
export type OutletKind = 'shower_mixer' | 'basin' | 'bath'

export type OutletControl = {
  id: OutletId
  enabled: boolean
  kind: OutletKind
  demandLpm: number
  /**
   * Whether a thermostatic mixer valve (TMV) is installed on this outlet.
   * Only meaningful for `shower_mixer` outlets.
   * Defaults to `true` for shower_mixer in `defaultOutlets()`.
   */
  tmvEnabled?: boolean
  /**
   * Target shower delivery temperature when TMV is installed (°C).
   * The TMV blends hot and cold supplies to reach this temperature.
   * Defaults to 40 °C.
   */
  tmvTargetTempC?: number
}

/** Default outlet configuration: A (shower, enabled, TMV on), B (basin), C (bath). */
export function defaultOutlets(): OutletControl[] {
  return [
    { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10, tmvEnabled: true,  tmvTargetTempC: 40 },
    { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5 },
    { id: 'C', enabled: false, kind: 'bath',         demandLpm: 18 },
  ]
}

/**
 * Which path segment a token is currently travelling.
 * COLD_A: cold supply bypass to outlet A's thermostatic mixer valve (bypasses HEX).
 */
export type LabRoute = 'MAIN' | 'A' | 'B' | 'C' | 'COLD_A'

export type LabToken = {
  id: string
  // 0..1 along the current route's polyline
  s: number
  // flow/velocity proxy
  v: number
  // pressure proxy (size)
  p: number
  // heat content above cold baseline (proxy, use J/kg style units)
  hJPerKg: number
  // which polyline this token is currently on
  route: LabRoute
  /**
   * Outlet pre-assigned at spawn time so the draw junction upstream of the
   * boiler already "knows" where this packet of water is destined.
   * Tokens without a pre-assignment (e.g. manually created in tests) fall
   * back to the hash-based deterministic roulette at the split point.
   */
  assignedOutlet?: OutletId
}

/** Distinguishes combi (on-demand) from stored hot water systems. */
export type SystemType = 'combi' | 'unvented_cylinder' | 'vented_cylinder'

export type CylinderControls = {
  volumeL: number       // e.g. 150 / 180 / 210
  initialTempC: number  // e.g. 55
  reheatKw: number      // boiler/coil power into the store, e.g. 12
}

export type VentedControls = {
  headMeters: number    // e.g. 3
}

export type LabControls = {
  systemType: SystemType

  coldInletC: 5 | 10 | 15
  dhwSetpointC: number        // default 50

  // supply + distribution
  mainsDynamicFlowLpm: number // e.g. 6..25
  pipeDiameterMm: 15 | 22     // v1

  // combi-only
  combiDhwKw: number          // e.g. 24..40

  // cylinder-only
  cylinder?: CylinderControls
  vented?: VentedControls

  outlets: OutletControl[]    // A/B/C per-outlet demand configuration
}

/** Rolling EMA temperature sample collected from tokens exiting an outlet branch. */
export type OutletSample = { tempC: number; count: number }

export type LabFrame = {
  nowMs: number
  tokens: LabToken[]
  /** Fractional spawn carry-over (deterministic, avoids Math.random). */
  spawnAccumulator: number
  /** Monotonically increasing counter for unique token IDs. */
  nextTokenId: number
  /** Per-outlet temperature samples (EMA from tokens exiting each branch). */
  outletSamples: Record<OutletId, OutletSample>
  /** Cylinder thermal store state (only present for cylinder system types). */
  cylinderStore?: CylinderStore
}
