// src/explainers/lego/animation/simulation.ts

import type { LabControls, LabFrame, LabToken } from './types'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

/**
 * PR1: keep it deliberately minimal.
 * - Tokens move forward at their velocity proxy.
 * - No heat sources yet. Tokens start at h=0 (cold baseline).
 * Later PRs will add heat injection/extraction and storage.
 */
export function stepSimulation(params: {
  frame: LabFrame
  dtMs: number
  controls: LabControls
}): LabFrame {
  const { frame, dtMs } = params

  const dt = dtMs / 1000

  const tokens: LabToken[] = frame.tokens.map(t => {
    const sNext = clamp(t.s + t.v * dt, 0, 1)
    return { ...t, s: sNext }
  })

  return {
    nowMs: frame.nowMs + dtMs,
    tokens,
  }
}

/**
 * Helper to create an initial set of cold tokens, evenly distributed along the path.
 */
export function createColdTokens(params: {
  count: number
  velocity: number
  pressure: number
}): LabToken[] {
  const tokens: LabToken[] = []
  for (let i = 0; i < params.count; i++) {
    tokens.push({
      id: `t_${i}`,
      s: i / params.count, // evenly distributed along the path
      v: params.velocity,
      p: params.pressure,
      hJPerKg: 0,
    })
  }
  return tokens
}
