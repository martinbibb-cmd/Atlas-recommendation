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
  coldInletC: 5 | 10 | 15
}

export type LabFrame = {
  nowMs: number
  tokens: LabToken[]
}
