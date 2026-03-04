// src/explainers/lego/animation/types.ts

export type LabToken = {
  id: string
  // 0..1 along a path segment (we keep this generic for now)
  s: number
  // flow/velocity proxy
  v: number
  // pressure proxy (size)
  p: number
  // heat content above cold baseline (proxy, use J/kg style units)
  hJPerKg: number
}

export type LabControls = {
  // DHW (combi) controls
  coldInletC: 5 | 10 | 15
  dhwSetpointC: number        // default 50
  combiDhwKw: number          // e.g. 24..40
  mainsDynamicFlowLpm: number // e.g. 6..25
  pipeDiameterMm: 15 | 22     // v1
  outlets: 1 | 2 | 3
  demandPerOutletLpm: number  // e.g. 4..20
}

export type LabFrame = {
  nowMs: number
  tokens: LabToken[]
  /** Fractional spawn carry-over (deterministic, avoids Math.random). */
  spawnAccumulator: number
  /** Monotonically increasing counter for unique token IDs. */
  nextTokenId: number
}
