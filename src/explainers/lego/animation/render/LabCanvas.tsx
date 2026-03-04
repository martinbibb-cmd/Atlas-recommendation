// src/explainers/lego/animation/render/LabCanvas.tsx

import React from 'react'
import type { LabControls, LabFrame } from '../types'
import { stepSimulation } from '../simulation'
import { TokensLayer } from './TokensLayer'

/** Baseline frame time at 60 fps (ms). */
const DEFAULT_FRAME_TIME_MS = 16
/** Maximum allowed dt to prevent large jumps after tab suspension (ms). */
const MAX_FRAME_TIME_MS = 50

export function LabCanvas(props: {
  controls: LabControls
}) {
  const { controls } = props

  const controlsRef = React.useRef(controls)
  React.useLayoutEffect(() => { controlsRef.current = controls })

  const [frame, setFrame] = React.useState<LabFrame>(() => ({
    nowMs: 0,
    tokens: [],
    spawnAccumulator: 0,
    nextTokenId: 0,
  }))

  const lastTsRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    let raf = 0

    const loop = (ts: number) => {
      const last = lastTsRef.current
      lastTsRef.current = ts
      const dtMs = last === null ? DEFAULT_FRAME_TIME_MS : Math.min(MAX_FRAME_TIME_MS, ts - last) // cap dt

      setFrame(prev => stepSimulation({ frame: prev, dtMs, controls: controlsRef.current }))

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <svg width="100%" viewBox="0 0 1000 240" style={{ display: 'block' }}>
      {/* Simple guide path — drawn first so HEX rect renders on top */}
      <path d="M 80 120 L 880 120" stroke="#cfd8e3" strokeWidth={14} strokeLinecap="round" />
      <path d="M 80 120 L 880 120" stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round" />

      {/* HEX zone */}
      <rect x={380} y={78} width={240} height={84} rx={18} fill="#eef2f7" stroke="#c9d4e2" />
      <text x={500} y={105} textAnchor="middle" fontSize={16} fill="#334155" fontWeight={700}>
        Combi DHW HEX
      </text>
      <text x={500} y={128} textAnchor="middle" fontSize={12} fill="#64748b">
        heat added here
      </text>

      <TokensLayer tokens={frame.tokens} coldInletC={controls.coldInletC} />
    </svg>
  )
}
