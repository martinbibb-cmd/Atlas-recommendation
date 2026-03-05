// src/explainers/lego/animation/render/LabCanvas.tsx

import React from 'react'
import type { LabControls, LabFrame, OutletId } from '../types'
import type { CapacitySummary } from '../capacitySummary'
import { stepSimulation } from '../simulation'
import { createCylinderStore, cylinderTempC } from '../storage'
import { TokensLayer } from './TokensLayer'
import { ThermalLegend } from './ThermalLegend'
import { THERMAL_BANDS, tempToThermalColor, roundTempC } from '../thermal'
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

/** Usable hot-water threshold (°C): minimum delivery temperature for comfortable domestic hot water use. */
const USABLE_HOT_THRESHOLD_C = 45

function makeInitialFrame(controls: LabControls): LabFrame {
  const isCylinder = controls.systemType === 'unvented_cylinder' || controls.systemType === 'vented_cylinder'
  const cylinderStore =
    isCylinder && controls.cylinder
      ? createCylinderStore({
          volumeL: controls.cylinder.volumeL,
          coldInletC: controls.coldInletC,
          initialTempC: controls.cylinder.initialTempC,
        })
      : undefined
  return {
    nowMs: 0,
    tokens: [],
    spawnAccumulator: 0,
    nextTokenId: 0,
    outletSamples: { ...EMPTY_OUTLET_SAMPLES },
    cylinderStore,
  }
}

export function LabCanvas(props: {
  controls: LabControls
  summary: CapacitySummary
  onFrame?: (frame: LabFrame) => void
}) {
  const { controls, summary, onFrame } = props

  const controlsRef = React.useRef(controls)
  React.useLayoutEffect(() => { controlsRef.current = controls })

  const onFrameRef = React.useRef(onFrame)
  React.useLayoutEffect(() => { onFrameRef.current = onFrame })

  const [frame, setFrame] = React.useState<LabFrame>(() => makeInitialFrame(controls))

  // Reset cylinder store when systemType or cylinder params change.
  // We explicitly track the primitive values that should trigger a reset;
  // the controls.cylinder object reference may change on every render.
  const prevSystemTypeRef = React.useRef(controls.systemType)
  const prevCylVolumeRef  = React.useRef(controls.cylinder?.volumeL)
  const prevCylTempRef    = React.useRef(controls.cylinder?.initialTempC)
  React.useEffect(() => {
    const typeChanged = prevSystemTypeRef.current !== controls.systemType
    const volChanged  = prevCylVolumeRef.current  !== controls.cylinder?.volumeL
    const tmpChanged  = prevCylTempRef.current    !== controls.cylinder?.initialTempC
    if (typeChanged || volChanged || tmpChanged) {
      prevSystemTypeRef.current = controls.systemType
      prevCylVolumeRef.current  = controls.cylinder?.volumeL
      prevCylTempRef.current    = controls.cylinder?.initialTempC
      setFrame(makeInitialFrame(controls))
    }
  }) // run every render and gate on ref comparison — safe because setFrame is only called on actual change

  const lastTsRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    let raf = 0

    const loop = (ts: number) => {
      const last = lastTsRef.current
      lastTsRef.current = ts
      const dtMs = last === null ? DEFAULT_FRAME_TIME_MS : Math.min(MAX_FRAME_TIME_MS, ts - last)

      setFrame(prev => {
        const next = stepSimulation({ frame: prev, dtMs, controls: controlsRef.current })
        onFrameRef.current?.(next)
        return next
      })

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const isCylinder = controls.systemType === 'unvented_cylinder' || controls.systemType === 'vented_cylinder'

  const GLOW = 'url(#glow)'
  const NONE = 'none'
  const glowFor = (component: CapacitySummary['limitingComponent']) =>
    summary.limitingComponent === component ? GLOW : NONE

  const pipeGlow   = glowFor('Pipe')
  const boilerGlow = glowFor('Thermal')
  const mainsGlow  = glowFor('Supply')

  const { main: polyMain, branchA, branchB, branchC } = buildPolylines()

  // Outlet positions for SVG rendering
  const outletYMap: Record<OutletId, number> = {
    A: P.outlet1Y,
    B: P.outlet2Y,
    C: P.outlet3Y,
  }

  // The splitter node is always visible since we always have 3 defined outlet branches.
  const showSplitter = true

  // Cylinder store display values
  const storeTempC =
    isCylinder && frame.cylinderStore
      ? cylinderTempC({ store: frame.cylinderStore, coldInletC: controls.coldInletC })
      : null
  const usableHot = storeTempC !== null ? storeTempC >= USABLE_HOT_THRESHOLD_C : null

  // Cylinder tank fill: 0% at coldInletC, 100% at 80 °C
  const cylinderFillFraction =
    storeTempC !== null
      ? Math.max(0, Math.min(1, (storeTempC - controls.coldInletC) / (80 - controls.coldInletC)))
      : 0

  // Cylinder tank SVG dimensions (replaces HEX box)
  const cylX = P.boilerX - 60
  const cylY = P.boilerY - 44
  const cylW = 180
  const cylH = 88
  const fillH = cylH * cylinderFillFraction
  const fillY = cylY + (cylH - fillH)
  const fillColor = storeTempC !== null ? tempToThermalColor(storeTempC) : '#cfd8e3'

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
          <clipPath id="cyl-clip">
            <rect x={cylX} y={cylY} width={cylW} height={cylH} rx={18} />
          </clipPath>
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
          {controls.systemType === 'vented_cylinder' ? 'Cold feed' : 'Mains'}
        </text>

        {/* ── Boiler HEX box (combi) OR Cylinder tank (stored) ───────────── */}
        {!isCylinder ? (
          <g>
            <rect
              x={cylX} y={cylY} width={cylW} height={cylH} rx={18}
              fill="#eef2f7" stroke="#c9d4e2" filter={boilerGlow}
            />
            <text x={P.boilerX + 30} y={P.boilerY - 6} textAnchor="middle" fontSize={16} fill="#334155" fontWeight={700}>
              Combi DHW HEX
            </text>
            <text x={P.boilerX + 30} y={P.boilerY + 16} textAnchor="middle" fontSize={12} fill="#64748b">
              heat added here
            </text>
          </g>
        ) : (
          <g>
            {/* Cylinder tank background */}
            <rect
              x={cylX} y={cylY} width={cylW} height={cylH} rx={18}
              fill="#f1f5f9" stroke="#c9d4e2" strokeWidth={2}
            />
            {/* Thermal fill — clips to rounded rect */}
            <rect
              x={cylX} y={fillY} width={cylW} height={fillH}
              fill={fillColor} opacity={0.75} clipPath="url(#cyl-clip)"
            />
            {/* Border overlay */}
            <rect
              x={cylX} y={cylY} width={cylW} height={cylH} rx={18}
              fill="none" stroke="#94a3b8" strokeWidth={2}
            />
            <text x={P.boilerX + 30} y={P.boilerY - 10} textAnchor="middle" fontSize={13} fill="#334155" fontWeight={700}>
              {controls.systemType === 'vented_cylinder' ? 'Vented cylinder' : 'Unvented cylinder'}
            </text>
            <text x={P.boilerX + 30} y={P.boilerY + 8} textAnchor="middle" fontSize={11} fill="#64748b">
              Stored hot water
            </text>
            {storeTempC !== null && (
              <text x={P.boilerX + 30} y={P.boilerY + 24} textAnchor="middle" fontSize={11} fill="#b45309">
                {roundTempC(storeTempC)} °C
              </text>
            )}
          </g>
        )}

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
                      ~{roundTempC(sample.tempC)} °C
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
          hydraulicFlowLpm={summary.hydraulicFlowLpm}
          demandTotalLpm={summary.demandTotalLpm}
        />
      </svg>

      {/* ── Usable hot water indicator (cylinder only) ─────────────────── */}
      {isCylinder && usableHot !== null && (
        <div style={{
          position: 'absolute', top: 8, left: 8,
          background: usableHot ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${usableHot ? '#16a34a' : '#dc2626'}`,
          borderRadius: 8,
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 600,
          color: usableHot ? '#15803d' : '#b91c1c',
          pointerEvents: 'none',
        }}>
          Usable hot water: {usableHot ? 'Yes' : 'No'}
        </div>
      )}

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
