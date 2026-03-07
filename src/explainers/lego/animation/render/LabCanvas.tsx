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
import { buildPlaySceneModel } from '../../playScene/buildPlaySceneModel'

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
  /**
   * When true, shows the optional open-vent cue on vented cylinder systems.
   * Intended for expert / debug mode only — keep hidden in the default customer-
   * facing Play view to avoid clutter.
   */
  expertMode?: boolean
}) {
  const { controls, summary, onFrame, expertMode = false } = props

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }) // runs every render — intentional: gates on ref comparison, only calls setFrame on actual change

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

  // Heat-source kind — distinguishes heat-pump compressor from gas/oil burner.
  const heatSourceKind = visuals?.heatTransfers.find(h => h.nodeId === 'boiler_burner')?.kind ?? 'burner'
  const isCompressor = heatSourceKind === 'compressor'

  // Current system operating mode — used by the valve position indicator.
  const systemMode = frame.systemMode ?? 'idle'

  // Convenience flags derived from systemMode — reduce repeated condition expressions.
  const isChActive = systemMode === 'heating' || systemMode === 'heating_and_reheat'
  const isHwActive = systemMode === 'dhw_reheat' || systemMode === 'heating_and_reheat'
  // True for S-plan topologies that use two independent zone valves.
  const isSPlanTopology =
    controls.controlTopology === 's_plan' || controls.controlTopology === 's_plan_multi_zone'

  // Heat-transfer glow filter references — applied to the component in the SVG.
  const HEAT_GLOW = 'url(#heat-glow)'

  // ── Play Scene Model ───────────────────────────────────────────────────────
  // Build an explicit scene description from controls + frame.
  // The renderer uses scene.metadata flags instead of repeating inline
  // systemType checks, which prevents contradictions like duplicate cold feeds
  // or a missing heat source when heating is active.
  const scene = buildPlaySceneModel(controls, frame)
  const heatSourceSceneNode = scene.nodes.find(n => n.role === 'heat_source')
  const heatSourceActivity  = heatSourceSceneNode?.activity
  // Activity kind for differentiated glow: 'ch_firing' → soft amber,
  // 'dhw_firing' → stronger orange-red (PR 15).
  const activityKind = heatSourceActivity?.kind ?? 'idle'
  const isDhwFiring  = activityKind === 'dhw_firing'

  // Use scene model flags to gate renderer decisions rather than re-deriving from
  // raw controls/frame.  This is the core contract of the PlaySceneModel layer:
  //   scene.metadata.showHeatSource  → heat-source indicator must be visible
  //   scene.metadata.showHeatingPath → CH supply path + emitter block must be visible
  // These are equivalent to the corresponding simulation-visual flags when the
  // simulation is running, but more robust when visuals are absent (first frame).
  const showHeatSourceIndicator = scene.metadata.showHeatSource
  const showHeatingPathAndEmitters = scene.metadata.showHeatingPath

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

  // ── Emitter / CH circuit layout constants ─────────────────────────────────
  // These are derived from the emitter box position and size so that the CH
  // supply path and arrowhead stay in sync if the emitter box is repositioned.
  const emitterX = 90
  const emitterY = 220
  const emitterW = 130
  const emitterH = 36
  const emitterRightX = emitterX + emitterW            // 220 — right edge of emitter box
  const emitterCenterY = emitterY + Math.round(emitterH / 2)  // 238 — centre of emitter box

  // ── CWS cistern layout constants (vented systems only) ────────────────────
  const cwsX = 325
  const cwsY = 28
  const cwsW = 90
  const cwsH = 30

  return (
    <div style={{ position: 'relative', display: 'block', width: '100%', minWidth: 700 }}>
      <svg width="100%" viewBox="0 0 1000 275" style={{ display: 'block' }}>
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
          {/* Stronger orange-red glow for DHW firing — higher demand visual cue (PR 15). */}
          <filter id="dhw-glow" x="-70%" y="-70%" width="240%" height="240%">
            <feColorMatrix type="matrix"
              values="1 0.6 0 0 0.2
                      0 0.5 0 0 0
                      0 0   0 0 0
                      0 0   0 1 0"
              result="warmed" />
            <feGaussianBlur in="warmed" stdDeviation="8" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Purple glow for the primary circuit (boiler ↔ cylinder coil) — PR5. */}
          <filter id="primary-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feColorMatrix type="matrix"
              values="0.5 0 0.5 0 0.1
                      0   0 0.8 0 0
                      0.3 0 1   0 0.1
                      0   0 0   1 0"
              result="tinted" />
            <feGaussianBlur in="tinted" stdDeviation="5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="cyl-clip">
            <rect x={cylX} y={cylY} width={cylW} height={cylH} rx={18} />
          </clipPath>

          {/* ── CSS keyframe animations for visual realism cues ────────────── */}
          <style>{`
            @keyframes burner-pulse {
              0%, 100% { opacity: 0.55; }
              50%       { opacity: 1.0; }
            }
            @keyframes dhw-burst {
              0%, 100% { opacity: 0.7; }
              40%       { opacity: 1.0; }
            }
            @keyframes compressor-pulse {
              0%, 100% { opacity: 0.4; }
              50%       { opacity: 0.85; }
            }
            @keyframes hex-shimmer {
              0%   { transform: translateX(-40px); opacity: 0.85; }
              75%  { transform: translateX(190px); opacity: 0.35; }
              100% { transform: translateX(190px); opacity: 0; }
            }
            @keyframes heat-rise {
              0%   { transform: translateY(0px);   opacity: 0.8; }
              100% { transform: translateY(-18px); opacity: 0; }
            }
            @keyframes outlet-glow {
              0%, 100% { opacity: 0.18; }
              50%       { opacity: 0.55; }
            }
          `}</style>

          {/* ── Pipe temperature gradients ─────────────────────────────────── */}
          {/* Cold supply: light sky entering → saturated sky toward the heat source */}
          <linearGradient
            id="grad-cold-supply"
            x1={P.mainsX} y1={0} x2={P.boilerX - 60} y2={0}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* DHW hot output: orange leaving the heat source → red at the splitter */}
          <linearGradient
            id="grad-dhw-hot"
            x1={P.boilerX + 120} y1={0} x2={P.splitX} y2={0}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor="#f97316" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>

          {/* Clip region for the plate-HEX shimmer highlight — matches the heat-source box boundary */}
          <clipPath id="heat-src-clip">
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

        {/* ── Mains / cold supply segment ────────────────────────────────── */}
        {/* Hidden for vented cylinders: the CWS cistern block below provides the
            gravity-fed cold supply path.  Showing both would create a misleading
            duplicate cold feed (the side blue feed bug).
            scene.metadata.showGenericColdFeed encodes this rule explicitly so the
            renderer does not have to re-derive it from systemType.               */}
        {scene.metadata.showGenericColdFeed && (
          <>
            {/* When TMV active: only draw from mains to pre-boiler tee. */}
            <path
              d={`M ${P.mainsX} ${P.mainsY} L ${tmvOutletAActive ? P.teeX : P.boilerX - 60} ${P.mainsY}`}
              stroke="url(#grad-cold-supply)" strokeWidth={16} strokeLinecap="round" filter={mainsGlow}
              opacity={THERMAL_COLOR_OPACITY}
            />
            <path
              d={`M ${P.mainsX} ${P.mainsY} L ${tmvOutletAActive ? P.teeX : P.boilerX - 60} ${P.mainsY}`}
              stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round"
            />
            <text x={P.mainsX - 4} y={P.mainsY - 18} fontSize={11} fill="#64748b" textAnchor="start">
              Mains
            </text>
          </>
        )}

        {/* ── CWS cistern indicator — vented / tank-fed systems only ──────── */}
        {/* Shows that the cold supply is gravity-fed from a cold-water storage
            cistern above, not from the mains under pressure.  The animated cold
            feed tokens still flow along the horizontal trunk path, representing
            the horizontal distribution run from the cistern to the cylinder
            cold_in port — consistent with real open-vented plumbing.
            scene.metadata.showCwsRefill encodes this rule explicitly so the
            renderer does not have to re-derive it from systemType.              */}
        {scene.metadata.showCwsRefill && (
          <g>
            {/* CWS cistern box above the cylinder cold_in */}
            <rect x={cwsX} y={cwsY} width={cwsW} height={cwsH} rx={4}
              fill="#e0f2fe" stroke="#0ea5e9" strokeWidth={1.5}
            />
            <text x={cwsX + cwsW / 2} y={cwsY + 13} textAnchor="middle" fontSize={9} fill="#0369a1" fontWeight={600}>CWS cistern</text>
            <text x={cwsX + cwsW / 2} y={cwsY + 25} textAnchor="middle" fontSize={8} fill="#0369a1">gravity feed</text>
            {/* Gravity-drop cold feed pipe: cistern bottom → cylinder cold_in (top edge)
                Rendered in blue (#0ea5e9 + tint) to signal cold / gravity supply. */}
            <path
              d={`M ${cwsX + cwsW / 2} ${cwsY + cwsH} L ${cylX + 10} ${cylY}`}
              stroke="#bae6fd" strokeWidth={10} strokeLinecap="round"
              opacity={0.85}
            />
            <path
              d={`M ${cwsX + cwsW / 2} ${cwsY + cwsH} L ${cylX + 10} ${cylY}`}
              stroke="#0ea5e9" strokeWidth={2} strokeLinecap="round"
            />
            {/* Mid-pipe downward arrow — reinforces gravity direction */}
            {(() => {
              const x1 = cwsX + cwsW / 2
              const y1 = cwsY + cwsH
              const x2 = cylX + 10
              const y2 = cylY
              const mx = (x1 + x2) / 2
              const my = (y1 + y2) / 2
              return (
                <polygon
                  points={`${mx - 5},${my - 5} ${mx + 5},${my - 5} ${mx},${my + 5}`}
                  fill="#0ea5e9" opacity={0.85}
                />
              )
            })()}
            {/* Downward arrow at cylinder cold_in entry */}
            <polygon
              points={`${cylX + 6},${cylY - 4} ${cylX + 14},${cylY - 4} ${cylX + 10},${cylY + 2}`}
              fill="#0ea5e9" opacity={0.9}
            />
            {/* Label below the CWS cistern — confirms tank-fed (not mains-fed) supply */}
            <text x={cwsX + cwsW / 2} y={cwsY + cwsH + 11} textAnchor="middle" fontSize={8} fill="#0369a1">
              Tank-fed cold supply
            </text>
          </g>
        )}

        {/* ── Open vent cue — expert/debug mode only, vented cylinders ────── */}
        {/* A faint rising dashed line from the cylinder top represents the
            classic open-vent safety pipe.  Hidden in the default customer view
            to avoid clutter; revealed when expertMode is true.                */}
        {expertMode && controls.systemType === 'vented_cylinder' && (
          <g opacity={0.45}>
            <line
              x1={cylX + cylW - 15} y1={cylY}
              x2={cylX + cylW - 15} y2={12}
              stroke="#0ea5e9" strokeWidth={2} strokeDasharray="4 3"
              strokeLinecap="round"
            />
            <text x={cylX + cylW - 5} y={10} fontSize={8} fill="#0369a1" textAnchor="start">
              open vent
            </text>
          </g>
        )}

        {/* Tee → boiler entry segment (when TMV active, shown in cold colour) */}
        {tmvOutletAActive && (
          <>
            <path
              d={`M ${P.teeX} ${P.teeY} L ${P.boilerX - 60} ${P.boilerY}`}
              stroke={coldSupplyColor} strokeWidth={16} strokeLinecap="round"
              opacity={THERMAL_COLOR_OPACITY}
            />
            <path
              d={`M ${P.teeX} ${P.teeY} L ${P.boilerX - 60} ${P.boilerY}`}
              stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round"
            />
          </>
        )}

        {/* ── Boiler HEX box (combi) OR Cylinder tank (stored/heat_pump with cylinder) OR Heat pump (no cylinder) ── */}
        {scene.metadata.sceneLayoutKind === 'combi' ? (
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
              filter={plateHexActive ? (isDhwFiring ? 'url(#dhw-glow)' : HEAT_GLOW) : boilerGlow}
            />
            {/* Plate-HEX shimmer highlight — slides across the box during active heat exchange.
                Clip prevents it from overflowing the rounded rect. */}
            {plateHexActive && (
              <g clipPath="url(#heat-src-clip)">
                <rect
                  x={cylX} y={cylY}
                  width={28} height={cylH}
                  fill="white" opacity={0.35}
                  style={{ animation: 'hex-shimmer 1.5s ease-in-out infinite' }}
                />
              </g>
            )}
            <text x={P.boilerX + 30} y={P.boilerY - 6} textAnchor="middle" fontSize={16} fill="#334155" fontWeight={700}>
              Combi DHW HEX
            </text>
            <text x={P.boilerX + 30} y={P.boilerY + 16} textAnchor="middle" fontSize={12}
              fill={burnerActive ? '#c2410c' : '#64748b'}>
              {burnerActive ? 'burner firing · heat transfer active' : 'heat added here'}
            </text>
            {/* Burner / compressor activity pulse — small indicator in the left region of the box.
                Fill and animation vary by activity kind (PR 15):
                  ch_firing   → amber (#fb923c), moderate burner-pulse
                  dhw_firing  → orange-red (#ea580c), faster dhw-burst
                  compressor  → cyan (#67e8f9), slow compressor-pulse */}
            {burnerActive && (
              <g>
                <circle
                  cx={cylX + 20} cy={cylY + cylH / 2}
                  r={9}
                  fill={isCompressor ? '#67e8f9' : isDhwFiring ? '#ea580c' : '#fb923c'}
                  style={{
                    animation: isCompressor
                      ? 'compressor-pulse 2s ease-in-out infinite'
                      : isDhwFiring
                        ? 'dhw-burst 0.6s ease-in-out infinite'
                        : 'burner-pulse 0.9s ease-in-out infinite',
                  }}
                />
                <text
                  x={cylX + 20} y={cylY + cylH / 2 + 5}
                  textAnchor="middle" fontSize={11}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {isCompressor ? '⚡' : '🔥'}
                </text>
              </g>
            )}
          </g>
        ) : scene.metadata.sceneLayoutKind === 'heat_pump' && !isCylinder ? (
          <g>
            {/*
             * Heat pump without cylinder — on-demand hot water, no plate HEX.
             * The heat pump acts as the sole heat source for both CH and DHW.
             * Shows a compressor indicator (⚡) instead of a burner flame (🔥)
             * to make the heat source visually distinct from a combi boiler.
             * sceneLayoutKind = 'heat_pump' ensures this branch is selected
             * even though controls.systemType may be 'combi' (no cylinder).
             */}
            <rect
              x={cylX} y={cylY} width={cylW} height={cylH} rx={18}
              fill="#ecfeff"
              stroke={burnerActive ? '#0891b2' : '#a5f3fc'}
              strokeWidth={burnerActive ? 2.5 : 1}
              filter={burnerActive ? 'url(#primary-glow)' : boilerGlow}
            />
            <text x={P.boilerX + 30} y={P.boilerY - 6} textAnchor="middle" fontSize={16} fill="#0e7490" fontWeight={700}>
              Heat Pump
            </text>
            <text x={P.boilerX + 30} y={P.boilerY + 16} textAnchor="middle" fontSize={12}
              fill={burnerActive ? '#0891b2' : '#64748b'}>
              {burnerActive ? 'compressor running · heat transfer active' : 'on-demand hot water'}
            </text>
            {/* Compressor activity indicator */}
            {burnerActive && (
              <g>
                <circle
                  cx={cylX + 20} cy={cylY + cylH / 2}
                  r={9}
                  fill="#67e8f9"
                  style={{ animation: 'compressor-pulse 2s ease-in-out infinite' }}
                />
                <text
                  x={cylX + 20} y={cylY + cylH / 2 + 5}
                  textAnchor="middle" fontSize={11}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  ⚡
                </text>
              </g>
            )}
          </g>
        ) : (
          <g>
            {/*
             * Storage-state domain: indirect cylinder.
             * The coil glow activates when the primary circuit is passing heat
             * into the stored water (reheat mode).  The domestic draw path is
             * entirely separate — stored water leaves from hot_out at the top,
             * cold feed enters cold_in; neither path is the primary circuit.
             * When CH is active, the boiler fires for the heating circuit;
             * a burner-pulse indicator is shown to make the heat source visible.
             * scene.metadata.showHeatSource / showHeatingPath drive these flags
             * so the renderer does not have to re-derive them from systemMode.
             */}
            {/* Cylinder tank background
                PR5 domain-aware border:
                  primary (coil active)  → purple stroke + primary-glow
                  heating (CH active)    → orange stroke + heat-glow
                  idle                   → grey stroke, no filter            */}
            <rect
              x={cylX} y={cylY} width={cylW} height={cylH} rx={18}
              fill="#f1f5f9"
              stroke={(coilActive || isHwActive) ? '#7c3aed' : (showHeatingPathAndEmitters) ? '#f97316' : '#c9d4e2'}
              strokeWidth={(coilActive || isHwActive || showHeatingPathAndEmitters) ? 2.5 : 2}
              filter={(coilActive || isHwActive) ? 'url(#primary-glow)' : showHeatingPathAndEmitters ? HEAT_GLOW : undefined}
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
              {scene.metadata.sceneLayoutKind === 'heat_pump'
                ? (controls.systemType === 'vented_cylinder' ? 'HP (tank-fed store)' : 'HP (mains-fed store)')
                : controls.systemType === 'vented_cylinder' ? 'Vented cylinder' : 'Unvented cylinder'}
            </text>
            <text x={P.boilerX + 30} y={P.boilerY + 8} textAnchor="middle" fontSize={11}
              fill={(coilActive || showHeatingPathAndEmitters) ? '#c2410c' : '#64748b'}>
              {systemMode === 'heating_and_reheat'
                ? 'CH + coil reheat (S-plan)'
                : coilActive
                  ? 'coil reheating store'
                  : showHeatingPathAndEmitters
                    ? (scene.metadata.sceneLayoutKind === 'heat_pump' ? 'heat pump running — CH' : 'boiler firing — CH')
                    : 'Stored hot water'}
            </text>
            {storeTempC !== null && (
              <text x={P.boilerX + 30} y={P.boilerY + 24} textAnchor="middle" fontSize={11} fill="#b45309">
                {roundTempC(storeTempC)} °C
              </text>
            )}
            {/* ── Primary coil symbol — PR5: always visible, never hidden ──────
                Represents the immersion coil (primary circuit) permanently plumbed
                inside the cylinder.  Purple = primary domain.
                Fades to 0.25 opacity when the coil is not actively reheating so
                the structural circuit remains visible without implying flow.
                Positioned at the bottom-right of the cylinder interior where it
                does not overlap the boiler indicator or the centred text labels.  */}
            {(() => {
              // Highlight the coil when the primary circuit is actively transferring
              // heat (coilActive = simulation visuals, isHwActive = system mode fallback
              // for the first frame before visuals are available).
              const shouldHighlightCoil = coilActive || isHwActive
              // Coil symbol: 3-pass horizontal element in bottom-right of cylinder
              const cx0 = cylX + cylW - 35  // left edge of coil symbol
              const cx1 = cylX + cylW - 13  // right edge of coil symbol
              const cy0 = cylY + 63         // top pass Y
              const cyPitch = 8             // gap between passes
              return (
                <g opacity={shouldHighlightCoil ? 1 : 0.25}>
                  {/* 3 horizontal coil passes */}
                  {([0, 1, 2] as const).map(i => (
                    <line
                      key={i}
                      x1={cx0} y1={cy0 + i * cyPitch}
                      x2={cx1} y2={cy0 + i * cyPitch}
                      stroke="#7c3aed" strokeWidth={2} strokeLinecap="round"
                    />
                  ))}
                  {/* Right-side U-turn: pass 0 → pass 1 */}
                  <path
                    d={`M ${cx1} ${cy0} Q ${cx1 + 4} ${cy0 + cyPitch / 2} ${cx1} ${cy0 + cyPitch}`}
                    stroke="#7c3aed" strokeWidth={2} fill="none" strokeLinecap="round"
                  />
                  {/* Left-side U-turn: pass 1 → pass 2 */}
                  <path
                    d={`M ${cx0} ${cy0 + cyPitch} Q ${cx0 - 4} ${cy0 + cyPitch * 1.5} ${cx0} ${cy0 + cyPitch * 2}`}
                    stroke="#7c3aed" strokeWidth={2} fill="none" strokeLinecap="round"
                  />
                  {/* Domain label */}
                  <text
                    x={(cx0 + cx1) / 2} y={cy0 - 5}
                    textAnchor="middle" fontSize={7} fill="#7c3aed"
                  >
                    {shouldHighlightCoil ? 'coil ▶' : 'Primary coil'}
                  </text>
                </g>
              )
            })()}
            {/* Burner / compressor activity pulse — visible when heat source is active.
                Always rendered (PR5 — never hide the boiler indicator).
                Opacity drops to 0.35 when idle so the full topology remains visible
                even at rest.  Fill and animation reflect the current activity kind:
                  ch_firing   → amber (#fb923c), moderate burner-pulse
                  dhw_firing  → orange-red (#ea580c), faster dhw-burst
                  compressor  → cyan (#67e8f9), slow compressor-pulse */}
            <g opacity={showHeatSourceIndicator ? 1 : 0.35}>
              <circle
                cx={cylX + 20} cy={cylY + cylH / 2}
                r={9}
                fill={
                  !showHeatSourceIndicator ? '#94a3b8'
                  : isCompressor ? '#67e8f9'
                  : isDhwFiring ? '#ea580c'
                  : '#fb923c'
                }
                style={{
                  animation: showHeatSourceIndicator
                    ? (isCompressor
                        ? 'compressor-pulse 2s ease-in-out infinite'
                        : isDhwFiring
                          ? 'dhw-burst 0.6s ease-in-out infinite'
                          : 'burner-pulse 0.9s ease-in-out infinite')
                    : 'none',
                }}
              />
              <text
                x={cylX + 20} y={cylY + cylH / 2 + 5}
                textAnchor="middle" fontSize={11}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {isCompressor ? '⚡' : '🔥'}
              </text>
              {/* "Boiler" label beneath the flame icon — distinguishes the heat source
                  from the DHW store so the CH supply path is clearly boiler-sourced. */}
              <text
                x={cylX + 20} y={cylY + cylH / 2 + 20}
                textAnchor="middle" fontSize={8} fill="#92400e"
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {isCompressor ? 'Heat pump' : 'Boiler'}
              </text>
            </g>
            {/* ── Valve position indicator ──────────────────────────────────
                Shows which port/zone the valve is currently directing flow to.
                For Y-plan (3-port valve): one direction at a time.
                For S-plan (zone valves): both CH and HW can be active simultaneously.
                Positioned just below the cylinder body.                       */}
            <g transform={`translate(${cylX + cylW / 2}, ${cylY + cylH + 16})`}>
              <text textAnchor="middle" fontSize={8} fill="#94a3b8" y={-3}>
                {isSPlanTopology ? 'zone valves' : '3-port valve'}
              </text>
              {/* CH label */}
              <text
                x={-30} y={14} textAnchor="middle" fontSize={9}
                fill={isChActive ? '#f97316' : '#94a3b8'}
                fontWeight={isChActive ? 700 : 400}
              >CH</text>
              {/* Centre dot */}
              <circle cx={0} cy={10} r={4} fill={systemMode === 'idle' ? '#94a3b8' : '#475569'} />
              {/* HW label */}
              <text
                x={30} y={14} textAnchor="middle" fontSize={9}
                fill={isHwActive ? '#0284c7' : '#94a3b8'}
                fontWeight={isHwActive ? 700 : 400}
              >HW</text>
              {/* Direction arrow line — CH side (PR5: always visible, faded when inactive) */}
              <line
                x1={-4} y1={10} x2={-22} y2={10}
                stroke="#f97316" strokeWidth={2} strokeLinecap="round"
                opacity={isChActive ? 1 : 0.2}
              />
              {/* Direction arrow line — HW side (PR5: always visible, faded when inactive) */}
              <line
                x1={4} y1={10} x2={22} y2={10}
                stroke="#0284c7" strokeWidth={2} strokeLinecap="round"
                opacity={isHwActive ? 1 : 0.2}
              />
            </g>
          </g>
        )}

        {/* ── Pipe to splitter ───────────────────────────────────────────── */}
        <path
          d={`M ${P.boilerX + 120} ${P.boilerY} L ${P.splitX} ${P.splitY}`}
          stroke={postHexThermalColor ? 'url(#grad-dhw-hot)' : '#cfd8e3'}
          strokeWidth={16} strokeLinecap="round" filter={pipeGlow}
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
              {/* Active outlet glow ring — pulsing halo around the outlet terminal. */}
              {isEnabled && (
                <circle
                  cx={ox} cy={oy} r={19}
                  fill={postHexThermalColor ?? '#f97316'}
                  style={{ animation: 'outlet-glow 1.6s ease-in-out infinite' }}
                />
              )}
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

        {/* ── Emitter / radiator heat-emission indicator ─────────────────── */}
        {/* Rendered whenever the graph contains a heating circuit (PR5: always
            show full topology).  Opacity drops to 0.35 when CH is inactive so the
            structure remains visible but clearly faint while DHW-only or idle.
            When active the CH supply path is drawn from the boiler indicator
            position (inside the composite box) — NOT from the cylinder domestic
            side — so the heat source is unambiguously the boiler, not the store.
            scene.metadata.showHeatingPath gates this whole section; the renderer
            does not independently re-derive the CH-active flag.                 */}
        {showHeatingPathAndEmitters && (
          <g opacity={isChActive ? 1 : 0.35}>
            {/* CH primary supply pipe — routed from directly below the boiler
                indicator (cylX+20) so the path clearly originates at the boiler,
                not at the cylinder DHW store edge.
                Path: boiler bottom (cylX+20, cylY+cylH) → down → left to emitter. */}
            <path
              d={`M ${cylX + 20} ${cylY + cylH} L ${cylX + 20} ${emitterCenterY} L ${emitterRightX} ${emitterCenterY}`}
              stroke="#f97316" strokeWidth={3} fill="none" strokeLinecap="round"
              opacity={0.8}
            />
            {/* Arrowhead pointing left into the emitter box — tip at emitterRightX */}
            <polygon
              points={`${emitterRightX + 2},${emitterCenterY - 4} ${emitterRightX + 10},${emitterCenterY} ${emitterRightX + 2},${emitterCenterY + 4}`}
              fill="#f97316" opacity={0.8}
            />
            {/* CH supply label centred on the horizontal run */}
            <text x={Math.round((cylX + 20 + emitterRightX) / 2)} y={emitterCenterY - 8} textAnchor="middle" fontSize={9} fill="#ea580c">
              CH supply
            </text>
            {/* Radiator box */}
            <rect x={emitterX} y={emitterY} width={emitterW} height={emitterH} rx={5}
              fill={isChActive ? '#fff7ed' : '#f8fafc'} stroke={isChActive ? '#f97316' : '#94a3b8'} strokeWidth={1.5}
            />
            <text x={emitterX + emitterW / 2} y={emitterY + 13} textAnchor="middle" fontSize={10} fill={isChActive ? '#9a3412' : '#64748b'} fontWeight={700}>Radiators</text>
            <text x={emitterX + emitterW / 2} y={emitterY + 27} textAnchor="middle" fontSize={9} fill={isChActive ? '#c2410c' : '#94a3b8'}>
              {isChActive ? 'heating active' : 'heating off'}
            </text>
            {/* Upward heat-wave glyphs — only animate when CH is actually active. */}
            {isChActive && ([0, 1, 2, 3, 4] as const).map(i => (
              <text
                key={i}
                x={emitterX + 12 + i * 14} y={emitterY - 5}
                textAnchor="middle" fontSize={12} fill="#f97316"
                style={{ animation: `heat-rise 1.5s ease-out ${(i * 0.22).toFixed(2)}s infinite` }}
              >~</text>
            ))}
          </g>
        )}

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

        {/* ── Domain colour legend — PR5 ────────────────────────────────── */}
        {/* Shows the four circuit domains so the schematic is self-explanatory.
            Positioned in the lower-right quadrant, clear of all pipe/outlet paths. */}
        <g transform="translate(730, 215)">
          <text x={0} y={0} fontSize={8} fill="#64748b" fontWeight={600}>Circuit domains</text>
          {(
            [
              { color: '#f97316', label: 'Heating' },
              { color: '#7c3aed', label: 'Primary' },
              { color: '#dc2626', label: 'Hot water' },
              { color: '#0284c7', label: 'Cold' },
            ] as const
          ).map(({ color, label }, i) => (
            <g key={label} transform={`translate(0, ${11 + i * 13})`}>
              <rect x={0} y={-7} width={18} height={7} rx={2} fill={color} opacity={0.75} />
              <text x={22} y={0} fontSize={7.5} fill="#475569">{label}</text>
            </g>
          ))}
        </g>
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

      {/* ── DEV-mode scene debug badge ──────────────────────────────────── */}
      {/* Shows derived systemKind and selected sceneLayoutKind so mismatch
          between classification and rendering is immediately visible.
          Remove once scene-layout selection is stable.                    */}
      {import.meta.env.DEV && (
        <div style={{
          position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(15,23,42,0.85)',
          border: '1px solid #334155',
          borderRadius: 6,
          padding: '3px 10px',
          fontSize: 10,
          fontFamily: 'monospace',
          color: '#94a3b8',
          pointerEvents: 'none',
          zIndex: 30,
          whiteSpace: 'nowrap',
        }}>
          {/* Compare sceneLayoutKind to the expected layout derived from the same
              fallback logic used by buildPlaySceneModel (systemKind or isCylinder).
              Shows green when they match, red when they do not. */}
          kind: <span style={{ color: '#38bdf8' }}>{controls.systemKind ?? '(legacy)'}</span>
          {' · '}
          layout: <span style={{
            color: scene.metadata.sceneLayoutKind === (
              controls.systemKind ?? (isCylinder ? 'stored' : 'combi')
            ) ? '#4ade80' : '#f87171',
          }}>{scene.metadata.sceneLayoutKind}</span>
        </div>
      )}
    </div>
  )
}
