// src/explainers/lego/animation/render/LabCanvas.tsx

import React from 'react'
import type { LabControls, LabFrame } from '../types'
import { createColdTokens, stepSimulation } from '../simulation'
import { TokensLayer } from './TokensLayer'

/** Baseline frame time at 60 fps (ms). */
const DEFAULT_FRAME_TIME_MS = 16
/** Maximum allowed dt to prevent large jumps after tab suspension (ms). */
const MAX_FRAME_TIME_MS = 50

export function LabCanvas(props: {
  controls: LabControls
}) {
  const { controls } = props

  const [frame, setFrame] = React.useState<LabFrame>(() => ({
    nowMs: 0,
    tokens: createColdTokens({ count: 80, velocity: 0.12, pressure: 0.6 }),
  }))

  const lastTsRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    let raf = 0

    const loop = (ts: number) => {
      const last = lastTsRef.current
      lastTsRef.current = ts
      const dtMs = last === null ? DEFAULT_FRAME_TIME_MS : Math.min(MAX_FRAME_TIME_MS, ts - last) // cap dt

      setFrame(prev => stepSimulation({ frame: prev, dtMs, controls }))

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [controls.coldInletC])

  return (
    <svg width="100%" viewBox="0 0 1000 240" style={{ display: 'block' }}>
      {/* Simple guide path */}
      <path d="M 80 120 L 880 120" stroke="#cfd8e3" strokeWidth={14} strokeLinecap="round" />
      <path d="M 80 120 L 880 120" stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round" />

      <TokensLayer tokens={frame.tokens} coldInletC={controls.coldInletC} />
    </svg>
  )
}
