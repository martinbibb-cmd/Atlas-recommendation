// src/explainers/lego/animation/types.ts

export type OutletId = 'A' | 'B' | 'C'
export type OutletKind = 'shower_mixer' | 'basin' | 'bath'

export type OutletControl = {
  id: OutletId
  enabled: boolean
  kind: OutletKind
  demandLpm: number
}

/** Default outlet configuration: A (shower, enabled), B (basin), C (bath). */
export function defaultOutlets(): OutletControl[] {
  return [
    { id: 'A', enabled: true,  kind: 'shower_mixer', demandLpm: 10 },
    { id: 'B', enabled: false, kind: 'basin',        demandLpm: 5 },
    { id: 'C', enabled: false, kind: 'bath',         demandLpm: 18 },
  ]
}

/** Which path segment a token is currently travelling. */
export type LabRoute = 'MAIN' | 'A' | 'B' | 'C'

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
}

export type LabControls = {
  // DHW (combi) controls
  coldInletC: 5 | 10 | 15
  dhwSetpointC: number        // default 50
  combiDhwKw: number          // e.g. 24..40
  mainsDynamicFlowLpm: number // e.g. 6..25
  pipeDiameterMm: 15 | 22     // v1
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
}
