// src/explainers/lego/animation/render/LabCanvas.tsx

import React from 'react'
import type { LabControls, LabFrame, OutletId } from '../types'
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

const OUTLET_LABELS: Record<OutletId, string> = { A: 'Outlet A', B: 'Outlet B', C: 'Outlet C' }
const OUTLET_KIND_LABELS: Record<string, string> = {
  shower_mixer: 'Shower',
  basin: 'Basin',
  bath: 'Bath',
}

const EMPTY_OUTLET_SAMPLES: LabFrame['outletSamples'] = {
  A: { tempC: 0, count: 0 },
  B: { tempC: 0, count: 0 },
  C: { tempC: 0, count: 0 },
}

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
    outletSamples: { ...EMPTY_OUTLET_SAMPLES },
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

  const { main: polyMain, branchA, branchB, branchC } = buildPolylines()

  // Outlet positions for SVG rendering
  const outletYMap: Record<OutletId, number> = {
    A: P.outlet1Y,
    B: P.outlet2Y,
    C: P.outlet3Y,
  }

  // The splitter node is always visible since we always have 3 defined outlet branches.
  const showSplitter = true

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <svg width="100%" viewBox="0 0 1000 260" style={{ display: 'block' }}>
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

        {/* ── Splitter node ──────────────────────────────────────────────── */}
        {showSplitter && (
          <circle cx={P.splitX} cy={P.splitY} r={9} fill="#8aa1b6" />
        )}

        {/* ── Outlet branches ────────────────────────────────────────────── */}
        {(controls.outlets as typeof controls.outlets).map(outlet => {
          const oy = outletYMap[outlet.id]
          const isEnabled = outlet.enabled
          const strokeColor = isEnabled ? '#cfd8e3' : '#e2e8f0'
          const centerStroke = isEnabled ? '#8aa1b6' : '#cbd5e1'
          const delivered = summary.outletDeliveredLpm[outlet.id]
          const sample = frame.outletSamples[outlet.id]

          return (
            <g key={outlet.id}>
              {/* Branch pipe */}
              <path
                d={`M ${P.splitX} ${P.splitY} L ${P.outlet1X} ${oy}`}
                stroke={strokeColor} strokeWidth={16} strokeLinecap="round"
                opacity={isEnabled ? 1 : 0.4}
              />
              <path
                d={`M ${P.splitX} ${P.splitY} L ${P.outlet1X} ${oy}`}
                stroke={centerStroke} strokeWidth={2} strokeLinecap="round"
                opacity={isEnabled ? 1 : 0.4}
              />

              {/* Outlet label */}
              <text x={P.outlet1X + 6} y={oy - 8} textAnchor="start" fontSize={12} fill={isEnabled ? '#334155' : '#94a3b8'} fontWeight={600}>
                {OUTLET_LABELS[outlet.id]} · {OUTLET_KIND_LABELS[outlet.kind]}
              </text>

              {/* Readout badge: delivered L/min + temperature */}
              {isEnabled && (
                <g>
                  <text x={P.outlet1X + 6} y={oy + 8} textAnchor="start" fontSize={11} fill="#0f766e">
                    {delivered.toFixed(1)} L/min
                  </text>
                  {sample.count > 0 && (
                    <text x={P.outlet1X + 6} y={oy + 22} textAnchor="start" fontSize={11} fill="#b45309">
                      ~{sample.tempC.toFixed(0)} °C
                    </text>
                  )}
                </g>
              )}
              {!isEnabled && (
                <text x={P.outlet1X + 6} y={oy + 8} textAnchor="start" fontSize={11} fill="#94a3b8">
                  off
                </text>
              )}
            </g>
          )
        })}

        {/* ── Tokens ─────────────────────────────────────────────────────── */}
        <TokensLayer
          tokens={frame.tokens}
          coldInletC={controls.coldInletC}
          polyMain={polyMain}
          polyA={branchA}
          polyB={branchB}
          polyC={branchC}
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
