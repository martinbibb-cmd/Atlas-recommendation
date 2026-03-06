// src/explainers/lego/animation/render/LabCanvas.tsx

import React from 'react'
import type { LabControls, LabFrame, OutletId } from '../types'
import type { CapacitySummary } from '../capacitySummary'
import { stepSimulation } from '../simulation'
import { createCylinderStore, cylinderTempC } from '../storage'
import { TokensLayer } from './TokensLayer'
import { ThermalLegend } from './ThermalLegend'
import { THERMAL_BANDS, tempToThermalColor, roundTempC } from '../thermal'
import { buildPolylines, SCHEMATIC_P, branchSvgPath } from './pathMap'

/** Baseline frame time at 60 fps (ms). */
const DEFAULT_FRAME_TIME_MS = 16
/** Maximum allowed dt to prevent large jumps after tab suspension (ms). */
const MAX_FRAME_TIME_MS = 50

/** Opacity applied to thermally-coloured pipe segments so the centre-line
 *  marker remains visible on top of the warm fill. */
const THERMAL_COLOR_OPACITY = 0.75

// Use positions from pathMap (single source of truth)
const P = SCHEMATIC_P

const OUTLET_LABELS: Record<OutletId, string> = { A: 'Outlet A', B: 'Outlet B', C: 'Outlet C' }
const OUTLET_KIND_LABELS: Record<string, string> = {
  shower_mixer: 'Shower',
  basin: 'Basin',
  bath: 'Bath',
  cold_tap: 'Cold tap',
}

const EMPTY_OUTLET_SAMPLES: LabFrame['outletSamples'] = {
  A: { tempC: 0, count: 0 },
  B: { tempC: 0, count: 0 },
  C: { tempC: 0, count: 0 },
}

/** Usable hot-water threshold (°C): minimum delivery temperature for comfortable domestic hot water use. */
const USABLE_HOT_THRESHOLD_C = 45

/**
 * Reference maximum temperature (°C) for the cylinder fill fraction display.
 * 0 = cold inlet, 1 = this temperature.  Matches the calculation in simulation.ts.
 */
const CYLINDER_FILL_MAX_C = 80

/**
 * Compute the cylinder fill fraction from a store temperature.
 * Extracted as a shared helper so the renderer and simulation use the same formula.
 * Returns a value in [0, 1].
 */
function cylinderChargePct(storeTempC: number, coldInletC: number): number {
  return Math.max(0, Math.min(1, (storeTempC - coldInletC) / (CYLINDER_FILL_MAX_C - coldInletC)))
}

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
    particles: [],
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

  // ── TMV state ──────────────────────────────────────────────────────────────
  // Detect if outlet A is an active TMV shower_mixer.
  const outletA = controls.outlets.find(o => o.id === 'A')
  const tmvOutletAActive = !isCylinder &&
    outletA?.enabled === true &&
    outletA?.kind === 'shower_mixer' &&
    outletA?.tmvEnabled === true &&
    summary.hydraulicFlowLpm > 0

  const tmvOutcomeA = summary.tmvOutcomes?.A
  const tmvSaturated = summary.tmvSaturated === true

  // Build polylines — when TMV outlet A is active, outlet A branch ends at the
  // mixer node rather than the full outlet terminal.
  const { main: polyMain, branchA, branchB, branchC, coldBypassA } = buildPolylines({
    tmvOutletA: tmvOutletAActive,
  })

  // Post-HEX pipe and outlet branch colour — driven by achieved outlet temperature (combi),
  // or store temperature (cylinder), so the visual matches what the water actually delivers.
  const postHexThermalColor: string | undefined = (() => {
    if (!isCylinder && summary.achievedOutTempC !== undefined && summary.hydraulicFlowLpm > 0) {
      return tempToThermalColor(summary.achievedOutTempC)
    }
    if (isCylinder && frame.cylinderStore) {
      const storeT = cylinderTempC({ store: frame.cylinderStore, coldInletC: controls.coldInletC })
      return tempToThermalColor(storeT)
    }
    return undefined
  })()

  // Cold supply bypass colour — always cold-inlet colour.
  const coldSupplyColor = tempToThermalColor(controls.coldInletC)

  // Mixed-water outlet colour (outlet A → mixer → terminal) — T_mix from TMV outcome,
  // or same as hot-branch colour if no TMV.
  const mixedOutletColor: string | undefined = tmvOutletAActive && tmvOutcomeA
    ? tempToThermalColor(tmvOutcomeA.T_mix)
    : postHexThermalColor

  // Combi thermal failure indicator:
  // - TMV mode: failing = TMV saturated (T_mix < T_t)
  // - Non-TMV mode: failing = boiler outlet below setpoint
  const combiIsFailing = !isCylinder && summary.hydraulicFlowLpm > 0 && (
    tmvOutletAActive
      ? tmvSaturated
      : (summary.achievedOutTempC !== undefined &&
         summary.achievedOutTempC < controls.dhwSetpointC - 0.5)
  )

  // Outlet positions for SVG rendering
  const outletXMap: Record<OutletId, number> = {
    A: P.outlet1X,
    B: P.outlet2X,
    C: P.outlet3X,
  }
  const outletYMap: Record<OutletId, number> = {
    A: P.outlet1Y,
    B: P.outlet2Y,
    C: P.outlet3Y,
  }

  // The splitter node is always visible since we always have 3 defined outlet branches.
  const showSplitter = true

  // ── Simulation visuals — heat-transfer domain ─────────────────────────────
  // Derive active states from the structured visuals emitted by stepSimulation().
  // This separates "component is firing" (heat transfer) from "component is a bottleneck"
  // (capacity limiting, used for the existing boilerGlow).
  const visuals = frame.visuals
  const burnerActive = visuals?.heatTransfers.find(h => h.nodeId === 'boiler_burner')?.active ?? false
  const plateHexActive = visuals?.heatTransfers.find(h => h.nodeId === 'combi_hex')?.active ?? false
  const coilActive = visuals?.heatTransfers.find(h => h.nodeId === 'cylinder_coil')?.active ?? false

  // Heat-transfer glow filter references — applied to the component in the SVG.
  const HEAT_GLOW = 'url(#heat-glow)'

  // Cylinder store display values
  const storeTempC =
    isCylinder && frame.cylinderStore
      ? cylinderTempC({ store: frame.cylinderStore, coldInletC: controls.coldInletC })
      : null
  const usableHot = storeTempC !== null ? storeTempC >= USABLE_HOT_THRESHOLD_C : null

  // Cylinder tank fill — prefer visuals.storageStates (authoritative simulation output)
  // and fall back to direct store calculation for backwards compatibility.
  const cylinderFillFraction = (() => {
    const sv = visuals?.storageStates.find(s => s.nodeId === 'cylinder')
    if (sv?.active && sv.chargePct !== undefined) return sv.chargePct
    return storeTempC !== null ? cylinderChargePct(storeTempC, controls.coldInletC) : 0
  })()

  // Cylinder tank SVG dimensions (replaces HEX box)
  const cylX = P.boilerX - 60
  const cylY = P.boilerY - 44
  const cylW = 180
  const cylH = 88
  const fillH = cylH * cylinderFillFraction
  const fillY = cylY + (cylH - fillH)
  const fillColor = storeTempC !== null ? tempToThermalColor(storeTempC) : '#cfd8e3'

  return (
    <div style={{ position: 'relative', display: 'block', width: '100%', minWidth: 700 }}>
      <svg width="100%" viewBox="0 0 1000 260" style={{ display: 'block' }}>
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Warm amber glow used when a heat-transfer component is actively firing. */}
          <filter id="heat-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feColorMatrix type="matrix"
              values="1 0.4 0 0 0.1
                      0 0.7 0 0 0
                      0 0   0 0 0
                      0 0   0 1 0"
              result="warmed" />
            <feGaussianBlur in="warmed" stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="cyl-clip">
            <rect x={cylX} y={cylY} width={cylW} height={cylH} rx={18} />
          </clipPath>
        </defs>

        {/* ── TMV cold supply bypass (above boiler, only when TMV active) ──── */}
        {tmvOutletAActive && (
          <g>
            {/* Cold supply pipe: tee → above boiler → mixer */}
            <path
              d={`M ${P.teeX} ${P.teeY} L ${P.teeX} ${P.coldBypassY} L ${P.mixerAX} ${P.coldBypassY} L ${P.mixerAX} ${P.mixerAY}`}
              stroke={coldSupplyColor} strokeWidth={16} strokeLinecap="round" fill="none"
              opacity={THERMAL_COLOR_OPACITY}
            />
            <path
              d={`M ${P.teeX} ${P.teeY} L ${P.teeX} ${P.coldBypassY} L ${P.mixerAX} ${P.coldBypassY} L ${P.mixerAX} ${P.mixerAY}`}
              stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round" fill="none"
            />
            {/* Cold supply label */}
            <text x={P.teeX + (P.mixerAX - P.teeX) / 2} y={P.coldBypassY - 6}
              fontSize={9} fill="#0ea5e9" textAnchor="middle">
              Cold supply {tmvOutcomeA ? `${tmvOutcomeA.F_c.toFixed(1)} L/min` : ''}
            </text>

            {/* Pre-boiler tee node */}
            <circle cx={P.teeX} cy={P.teeY} r={8} fill="#64748b" />
            <text x={P.teeX} y={P.teeY + 20} fontSize={9} fill="#64748b" textAnchor="middle">Tee</text>

            {/* Thermostatic mixer valve node */}
            <circle cx={P.mixerAX} cy={P.mixerAY} r={10} fill="#f59e0b" stroke="#92400e" strokeWidth={2} />
            <text x={P.mixerAX} y={P.mixerAY - 14} fontSize={9} fill="#92400e" textAnchor="middle" fontWeight={700}>
              TMV
            </text>

            {/* Mixed-water outlet: mixer → shower terminal */}
            <path
              d={`M ${P.mixerAX} ${P.mixerAY} L ${P.outlet1X} ${P.outlet1Y}`}
              stroke={mixedOutletColor ?? '#cfd8e3'} strokeWidth={16} strokeLinecap="round"
              opacity={mixedOutletColor ? THERMAL_COLOR_OPACITY : 1}
            />
            <path
              d={`M ${P.mixerAX} ${P.mixerAY} L ${P.outlet1X} ${P.outlet1Y}`}
              stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round"
            />

            {/* Hot supply label (post-HEX branch to mixer) */}
            {tmvOutcomeA && (
              <text
                x={(P.splitX + P.mixerAX) / 2}
                y={P.outlet1Y - 8}
                fontSize={9} fill="#b45309" textAnchor="middle"
              >
                Hot supply {tmvOutcomeA.F_h.toFixed(1)} L/min · {roundTempC(tmvOutcomeA.T_h)} °C
              </text>
            )}
          </g>
        )}

        {/* ── Mains segment ──────────────────────────────────────────────── */}
        {/* When TMV active: only draw from mains to pre-boiler tee. */}
        <path
          d={`M ${P.mainsX} ${P.mainsY} L ${tmvOutletAActive ? P.teeX : P.boilerX - 60} ${P.mainsY}`}
          stroke="#cfd8e3" strokeWidth={16} strokeLinecap="round" filter={mainsGlow}
        />
        <path
          d={`M ${P.mainsX} ${P.mainsY} L ${tmvOutletAActive ? P.teeX : P.boilerX - 60} ${P.mainsY}`}
          stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round"
        />
        <text x={P.mainsX - 4} y={P.mainsY - 18} fontSize={11} fill="#64748b" textAnchor="start">
          {controls.systemType === 'vented_cylinder' ? 'Cold feed' : 'Mains'}
        </text>

        {/* Tee → boiler entry segment (when TMV active, shown in cold colour) */}
        {tmvOutletAActive && (
          <>
            <path
              d={`M ${P.teeX} ${P.teeY} L ${P.boilerX - 60} ${P.boilerY}`}
              stroke="#cfd8e3" strokeWidth={16} strokeLinecap="round"
            />
            <path
              d={`M ${P.teeX} ${P.teeY} L ${P.boilerX - 60} ${P.boilerY}`}
              stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round"
            />
          </>
        )}

        {/* ── Boiler HEX box (combi) OR Cylinder tank (stored) ───────────── */}
        {!isCylinder ? (
          <g>
            {/*
             * Heat-transfer domain: combi plate HEX.
             * The `heat-glow` filter activates when the burner/plate-HEX are
             * transferring heat (DHW draw mode).  This is distinct from the
             * capacity-limit glow (boilerGlow) which fires when the boiler is
             * the flow-limiting component.
             */}
            <rect
              x={cylX} y={cylY} width={cylW} height={cylH} rx={18}
              fill="#eef2f7"
              stroke={plateHexActive ? '#f97316' : '#c9d4e2'}
              strokeWidth={plateHexActive ? 2.5 : 1}
              filter={plateHexActive ? HEAT_GLOW : boilerGlow}
            />
            <text x={P.boilerX + 30} y={P.boilerY - 6} textAnchor="middle" fontSize={16} fill="#334155" fontWeight={700}>
              Combi DHW HEX
            </text>
            <text x={P.boilerX + 30} y={P.boilerY + 16} textAnchor="middle" fontSize={12}
              fill={burnerActive ? '#c2410c' : '#64748b'}>
              {burnerActive ? 'burner firing · heat transfer active' : 'heat added here'}
            </text>
          </g>
        ) : (
          <g>
            {/*
             * Storage-state domain: indirect cylinder.
             * The coil glow activates when the primary circuit is passing heat
             * into the stored water (reheat mode).  The domestic draw path is
             * entirely separate — stored water leaves from hot_out at the top,
             * mains/cold enters cold_in at the bottom; neither path is the
             * primary circuit.
             */}
            {/* Cylinder tank background */}
            <rect
              x={cylX} y={cylY} width={cylW} height={cylH} rx={18}
              fill="#f1f5f9"
              stroke={coilActive ? '#f97316' : '#c9d4e2'}
              strokeWidth={coilActive ? 2.5 : 2}
              filter={coilActive ? HEAT_GLOW : undefined}
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
            <text x={P.boilerX + 30} y={P.boilerY + 8} textAnchor="middle" fontSize={11}
              fill={coilActive ? '#c2410c' : '#64748b'}>
              {coilActive ? 'coil reheating store' : 'Stored hot water'}
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
          stroke={postHexThermalColor ?? '#cfd8e3'} strokeWidth={16} strokeLinecap="round" filter={pipeGlow}
          opacity={postHexThermalColor ? THERMAL_COLOR_OPACITY : 1}
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
          const ox = outletXMap[outlet.id]
          const oy = outletYMap[outlet.id]
          const isEnabled = outlet.enabled
          const centerStroke = isEnabled ? '#8aa1b6' : '#cbd5e1'
          const delivered = summary.outletDeliveredLpm[outlet.id]
          const sample = frame.outletSamples[outlet.id]

          // For TMV outlet A: branch goes to mixer (mixerAX, mixerAY), not terminal.
          const isTmvA = outlet.id === 'A' && tmvOutletAActive
          const branchEndX = isTmvA ? P.mixerAX : ox
          const branchEndY = isTmvA ? P.mixerAY : oy
          const pathD = branchSvgPath(P.splitX, P.splitY, branchEndX, branchEndY, P.branchBendR)

          // Colour for this branch: TMV outlet A hot branch uses hot colour (T_h),
          // mixed outlet is drawn separately; other outlets use postHexThermalColor.
          const branchColor = isEnabled ? (postHexThermalColor ?? '#cfd8e3') : '#e2e8f0'

          return (
            <g key={outlet.id}>
              {/* Branch pipe — 90° off-take + swept bend */}
              <path
                d={pathD}
                stroke={branchColor}
                strokeWidth={16} strokeLinecap="round" fill="none"
                opacity={isEnabled ? (postHexThermalColor ? THERMAL_COLOR_OPACITY : 1) : 0.4}
              />
              <path
                d={pathD}
                stroke={centerStroke} strokeWidth={2} strokeLinecap="round" fill="none"
                opacity={isEnabled ? 1 : 0.4}
              />

              {/* Outlet label */}
              <text x={ox + 6} y={oy - 8} textAnchor="start" fontSize={12} fill={isEnabled ? '#334155' : '#94a3b8'} fontWeight={600}>
                {OUTLET_LABELS[outlet.id]} · {OUTLET_KIND_LABELS[outlet.kind]}
              </text>

              {/* Readout badge: delivered L/min + temperature */}
              {isEnabled && (
                <g>
                  <text x={ox + 6} y={oy + 8} textAnchor="start" fontSize={11} fill="#0f766e">
                    {delivered.toFixed(1)} L/min
                  </text>
                  {sample.count > 0 && (
                    <text x={ox + 6} y={oy + 22} textAnchor="start" fontSize={11}
                      fill={combiIsFailing ? '#b91c1c' : '#b45309'}>
                      ~{roundTempC(sample.tempC)} °C
                    </text>
                  )}
                  {/* TMV outlet A: show target and mixed temp */}
                  {isTmvA && tmvOutcomeA && (
                    <>
                      <text x={ox + 6} y={oy + 36} textAnchor="start" fontSize={10}
                        fill={tmvSaturated ? '#b91c1c' : '#0f766e'}>
                        Mix: {roundTempC(tmvOutcomeA.T_mix)} °C
                        {tmvSaturated ? ' ⚠' : ' ✓'}
                      </text>
                      <text x={ox + 6} y={oy + 50} textAnchor="start" fontSize={10} fill="#64748b">
                        Target: {outletA?.tmvTargetTempC ?? 40} °C
                      </text>
                    </>
                  )}
                  {/* Show achieved vs target when non-TMV combi can't hit target */}
                  {!isCylinder && !isTmvA && summary.achievedOutTempC !== undefined && combiIsFailing && (
                    <text x={ox + 6} y={oy + 36} textAnchor="start" fontSize={10} fill="#b91c1c">
                      ⚠ target {controls.dhwSetpointC} °C
                    </text>
                  )}
                </g>
              )}
              {!isEnabled && (
                <text x={ox + 6} y={oy + 8} textAnchor="start" fontSize={11} fill="#94a3b8">
                  off
                </text>
              )}
            </g>
          )
        })}

        {/* ── Flow Particles ──────────────────────────────────────────────── */}
        <TokensLayer
          particles={frame.particles}
          coldInletC={controls.coldInletC}
          polyMain={polyMain}
          polyA={branchA}
          polyB={branchB}
          polyC={branchC}
          polyColdA={coldBypassA}
          hydraulicFlowLpm={summary.hydraulicFlowLpm}
          demandTotalLpm={summary.demandTotalLpm}
          postHexThermalColor={postHexThermalColor}
        />
      </svg>

      {/* ── Usable hot water indicator (cylinder only) ─────────────────── */}
      {isCylinder && usableHot !== null && (
        <div style={{
          position: 'absolute', top: 8, right: 8,
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
      <div style={{ position: 'absolute', top: 8, left: 8, pointerEvents: 'none' }}>
        <ThermalLegend
          coldInletC={controls.coldInletC}
          setpointC={tmvOutletAActive && outletA?.tmvTargetTempC
            ? outletA.tmvTargetTempC
            : controls.dhwSetpointC}
          bands={THERMAL_BANDS}
          achievedTempC={!isCylinder ? summary.achievedOutTempC : undefined}
        />
      </div>

      {/* ── TMV status callout (combi + TMV mode) ─────────────────────── */}
      {tmvOutletAActive && tmvOutcomeA && (
        <div
          style={{
            position: 'absolute', bottom: 8, left: 8,
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            pointerEvents: 'none',
            zIndex: 20,
            lineHeight: 1.6,
            maxWidth: 210,
          }}
        >
          <div style={{ fontWeight: 700, color: '#92400e' }}>
            Thermostatic mixer valve (TMV)
          </div>
          <div style={{ color: '#78350f' }}>
            Cold in: {controls.coldInletC} °C
          </div>
          <div style={{ color: '#b45309' }}>
            Hot supply: {roundTempC(tmvOutcomeA.T_h)} °C
          </div>
          <div style={{ color: '#0f766e' }}>
            Target: {outletA?.tmvTargetTempC ?? 40} °C
          </div>
          <div style={{ fontWeight: 600, color: tmvSaturated ? '#b91c1c' : '#065f46' }}>
            Delivered: {roundTempC(tmvOutcomeA.T_mix)} °C
            {tmvSaturated ? ' ⚠' : ' ✓'}
          </div>
          {tmvOutcomeA.F_c > 0.05 && (
            <div style={{ color: '#0369a1', fontSize: 10 }}>
              Cold bypass: {tmvOutcomeA.F_c.toFixed(1)} L/min
            </div>
          )}
        </div>
      )}

      {/* ── "Can't hit target" callout (combi only, non-TMV or TMV saturated) ── */}
      {combiIsFailing && (
        <div
          role="alert"
          aria-live="polite"
          style={{
            position: 'absolute', bottom: 8, right: 8,
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 11,
            fontWeight: 700,
            color: '#b91c1c',
            pointerEvents: 'none',
            zIndex: 20,
            lineHeight: 1.5,
          }}
        >
          {tmvOutletAActive && tmvOutcomeA ? (
            <>
              <div>⚠ TMV saturated: can&apos;t reach target</div>
              <div style={{ fontWeight: 400 }}>
                −{roundTempC(tmvOutcomeA.shortfallC)} °C short
              </div>
              <div style={{ fontWeight: 400, fontSize: 10, color: '#7f1d1d' }}>
                Need {outletA?.tmvTargetTempC ?? 40} °C · hot supply {roundTempC(tmvOutcomeA.T_h)} °C
              </div>
            </>
          ) : (
            <>
              <div>⚠ Can&apos;t hit target</div>
              {summary.achievedOutTempC !== undefined && (
                <>
                  <div style={{ fontWeight: 400 }}>
                    −{Math.abs(roundTempC(controls.dhwSetpointC - summary.achievedOutTempC))} °C short
                  </div>
                  <div style={{ fontWeight: 400, fontSize: 10, color: '#7f1d1d' }}>
                    Need {controls.dhwSetpointC} °C
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
