// src/explainers/lego/animation/render/LabCanvas.tsx

import React from 'react'
import type { LabControls, LabFrame } from '../types'
import type { CapacitySummary } from '../capacitySummary'
import { stepSimulation } from '../simulation'
import { TokensLayer } from './TokensLayer'
import { ThermalLegend } from './ThermalLegend'
import { THERMAL_BANDS } from '../thermal'
import { buildPolylines, SCHEMATIC_P } from './pathMap'

/** Baseline frame time at 60 fps (ms). */
const DEFAULT_FRAME_TIME_MS = 16
/** Maximum allowed dt to prevent large jumps after tab suspension (ms). */
const MAX_FRAME_TIME_MS = 50

// Use positions from pathMap (single source of truth)
const P = SCHEMATIC_P

export function LabCanvas(props: {
  controls: LabControls
  summary: CapacitySummary
}) {
  const { controls, summary } = props

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
      const dtMs = last === null ? DEFAULT_FRAME_TIME_MS : Math.min(MAX_FRAME_TIME_MS, ts - last)

      setFrame(prev => stepSimulation({ frame: prev, dtMs, controls: controlsRef.current }))

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const GLOW = 'url(#glow)'
  const NONE = 'none'
  const glowFor = (component: CapacitySummary['limitingComponent']) =>
    summary.limitingComponent === component ? GLOW : NONE

  const pipeGlow    = glowFor('Pipe')
  const boilerGlow  = glowFor('Thermal')
  const mainsGlow   = glowFor('Supply')

  const { main: mainPolyline, branch1, branch2 } = buildPolylines(controls.outlets)

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <svg width="100%" viewBox="0 0 1000 240" style={{ display: 'block' }}>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* ── Mains segment ──────────────────────────────────────────────── */}
        <path
          d={`M ${P.mainsX} ${P.mainsY} L ${P.boilerX - 60} ${P.boilerY}`}
          stroke="#cfd8e3" strokeWidth={16} strokeLinecap="round" filter={mainsGlow}
        />
        <path
          d={`M ${P.mainsX} ${P.mainsY} L ${P.boilerX - 60} ${P.boilerY}`}
          stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round"
        />
        <text x={P.mainsX - 4} y={P.mainsY - 18} fontSize={11} fill="#64748b" textAnchor="start">
          Mains
        </text>

        {/* ── Boiler HEX box ─────────────────────────────────────────────── */}
        <rect
          x={P.boilerX - 60} y={P.boilerY - 44} width={180} height={88} rx={18}
          fill="#eef2f7" stroke="#c9d4e2" filter={boilerGlow}
        />
        <text x={P.boilerX + 30} y={P.boilerY - 6} textAnchor="middle" fontSize={16} fill="#334155" fontWeight={700}>
          Combi DHW HEX
        </text>
        <text x={P.boilerX + 30} y={P.boilerY + 16} textAnchor="middle" fontSize={12} fill="#64748b">
          heat added here
        </text>

        {/* ── Pipe to splitter ───────────────────────────────────────────── */}
        <path
          d={`M ${P.boilerX + 120} ${P.boilerY} L ${P.splitX} ${P.splitY}`}
          stroke="#cfd8e3" strokeWidth={16} strokeLinecap="round" filter={pipeGlow}
        />
        <path
          d={`M ${P.boilerX + 120} ${P.boilerY} L ${P.splitX} ${P.splitY}`}
          stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round"
        />

        {/* ── Outlets ────────────────────────────────────────────────────── */}
        {controls.outlets === 1 ? (
          <>
            <path
              d={`M ${P.splitX} ${P.splitY} L ${P.outlet1X} ${P.splitY}`}
              stroke="#cfd8e3" strokeWidth={16} strokeLinecap="round"
            />
            <path
              d={`M ${P.splitX} ${P.splitY} L ${P.outlet1X} ${P.splitY}`}
              stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round"
            />
            <text x={P.outlet1X + 4} y={P.splitY + 4} textAnchor="start" fontSize={12} fill="#334155">
              Outlet
            </text>
          </>
        ) : (
          <>
            {/* Splitter symbol */}
            <circle cx={P.splitX} cy={P.splitY} r={8} fill="#8aa1b6" />

            {/* Branch to outlet A */}
            <path
              d={`M ${P.splitX} ${P.splitY} L ${P.outlet1X} ${P.outlet1Y}`}
              stroke="#cfd8e3" strokeWidth={16} strokeLinecap="round"
            />
            <path
              d={`M ${P.splitX} ${P.splitY} L ${P.outlet1X} ${P.outlet1Y}`}
              stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round"
            />
            <text x={P.outlet1X + 4} y={P.outlet1Y - 4} textAnchor="start" fontSize={12} fill="#334155">
              Outlet A
            </text>

            {/* Branch to outlet B */}
            <path
              d={`M ${P.splitX} ${P.splitY} L ${P.outlet2X} ${P.outlet2Y}`}
              stroke="#cfd8e3" strokeWidth={16} strokeLinecap="round"
            />
            <path
              d={`M ${P.splitX} ${P.splitY} L ${P.outlet2X} ${P.outlet2Y}`}
              stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round"
            />
            <text x={P.outlet2X + 4} y={P.outlet2Y + 16} textAnchor="start" fontSize={12} fill="#334155">
              Outlet B
            </text>
          </>
        )}

        {/* ── Tokens ─────────────────────────────────────────────────────── */}
        <TokensLayer
          tokens={frame.tokens}
          coldInletC={controls.coldInletC}
          mainPolyline={mainPolyline}
          branch1={branch1}
          branch2={branch2}
          outlets={controls.outlets}
        />
      </svg>

      {/* ── Thermal legend overlay ─────────────────────────────────────── */}
      <div style={{ position: 'absolute', top: 8, right: 8, pointerEvents: 'none' }}>
        <ThermalLegend
          coldInletC={controls.coldInletC}
          setpointC={controls.dhwSetpointC}
          bands={THERMAL_BANDS}
        />
      </div>
    </div>
  )
}
