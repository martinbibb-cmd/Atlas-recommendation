// src/explainers/lego/animation/render/LabCanvas.tsx

import React from 'react'
import type { LabControls, LabFrame, OutletControl, SimTimeState, LabConditionState } from '../types'
import type { CapacitySummary } from '../capacitySummary'
import { stepSimulation } from '../simulation'
import { createCylinderStore, cylinderTempC } from '../storage'
import { TokensLayer } from './TokensLayer'
import { ThermalLegend } from './ThermalLegend'
import { THERMAL_BANDS, tempToThermalColor, roundTempC } from '../thermal'
import { buildPolylines, SCHEMATIC_P, branchSvgPath, STORED_HEX_END } from './pathMap'
import { buildPlaySceneModel } from '../../playScene/buildPlaySceneModel'
import { SchematicFaceToken } from '../../builder/SchematicFace'
import { DrawOffPanel } from './DrawOffPanel'
import { WaterSupplyPanel } from './WaterSupplyPanel'
import { ConditionPanel } from './ConditionPanel'
import { deriveOutletDisplayStates } from '../../state/outletDisplayState'
import { derivePlaybackMode } from '../../sim/surveyAdapter'
import { systemTypeLabel, serviceModeSummary } from './simTimeStatus'
import {
  deriveCondensingState,
  isBoilerHeatSource,
  condensingStateBadgeText,
  condensingStateDescription,
} from '../../sim/condensingState'

/** Baseline frame time at 60 fps (ms). */
const DEFAULT_FRAME_TIME_MS = 16
/** Maximum allowed dt to prevent large jumps after tab suspension (ms). */
const MAX_FRAME_TIME_MS = 50

/** Opacity applied to thermally-coloured pipe segments so the centre-line
 *  marker remains visible on top of the warm fill. */
const THERMAL_COLOR_OPACITY = 0.75

// Use positions from pathMap (single source of truth)
const P = SCHEMATIC_P

/** Return a human-readable label for an outlet slot (e.g. 'A' → 'Outlet A'). */
function outletLabel(slotId: string): string {
  return `Outlet ${slotId}`
}

const OUTLET_KIND_LABELS: Record<string, string> = {
  shower_mixer: 'Shower',
  basin: 'Basin',
  bath: 'Bath',
  cold_tap: 'Cold tap',
}

/** Build an empty outlet-samples map from the current outlet list. */
function emptyOutletSamples(outlets: OutletControl[]): LabFrame['outletSamples'] {
  const samples: LabFrame['outletSamples'] = {}
  for (const o of outlets) {
    samples[o.id] = { tempC: 0, count: 0 }
  }
  // Always include A/B/C so legacy paths that index directly still work.
  if (!samples['A']) samples['A'] = { tempC: 0, count: 0 }
  if (!samples['B']) samples['B'] = { tempC: 0, count: 0 }
  if (!samples['C']) samples['C'] = { tempC: 0, count: 0 }
  return samples
}

/** Usable hot-water threshold (°C): minimum delivery temperature for comfortable domestic hot water use. */
const USABLE_HOT_THRESHOLD_C = 45

/**
 * Reference maximum temperature (°C) for the cylinder fill fraction display.
 * 0 = cold inlet, 1 = this temperature.  Matches the calculation in simulation.ts.
 */
const CYLINDER_FILL_MAX_C = 80

/** Opacity of the Mixergy top-down hot band overlay (purple tint). */
const MIXERGY_FILL_OPACITY = 0.18

/** Half-height of the Y-plan 3-port valve diamond shape (pixels) — used for srcFlowLineEndY. */
const VALVE_DIAMOND_HALF_H = 10

/** Radius of each S-plan zone valve circle (pixels) — used for srcFlowLineEndY. */
const ZONE_VALVE_RADIUS = 8

/**
 * Determine whether an outlet control is cold-only (draws from cold supply only,
 * never from the hot-water service).
 *
 * Priority order:
 *   1. Outlet-level `serviceClass` field (populated by graphToLabControls from
 *      topology analysis) — authoritative when present.
 *   2. `kind === 'cold_tap'` — always cold regardless of graph facts.
 *   3. Graph-fact lookup via `builderNodeId` or `outletBindings` — backward
 *      compat for older LabControls objects that predate the serviceClass field.
 *
 * Cold-only outlets must:
 *   - NOT appear on the hot branch from the splitter
 *   - NOT contribute to DHW demand
 *   - NOT consume stored hot water
 *   - Be rendered with a cold (blue) colour scheme
 */
function isColdOnlyOutlet(outlet: OutletControl, controls: LabControls): boolean {
  // 1. Outlet-level service class (authoritative)
  if (outlet.serviceClass === 'cold_only') return true
  if (outlet.serviceClass === 'mixed' || outlet.serviceClass === 'hot_only') return false

  // 2. Kind-based fallback
  if (outlet.kind === 'cold_tap') return true

  // 3. Graph-fact lookup (backward compat)
  const nodeId = outlet.builderNodeId ?? controls.outletBindings?.[outlet.id]
  return !!(nodeId && controls.graphFacts?.coldOnlyOutletNodeIds.includes(nodeId))
}

/**
 * Compute the cylinder fill fraction from a store temperature.
 * Extracted as a shared helper so the renderer and simulation use the same formula.
 * Returns a value in [0, 1].
 */
function cylinderChargePct(storeTempC: number, coldInletC: number): number {
  return Math.max(0, Math.min(1, (storeTempC - coldInletC) / (CYLINDER_FILL_MAX_C - coldInletC)))
}

/**
 * Return the cylinder label for the Play schematic.
 * Uses the scene metadata instead of raw controls.systemType to ensure
 * Mixergy cylinders are labelled distinctly from standard unvented cylinders.
 */
function cylinderLabel(
  sceneLayoutKind: 'combi' | 'stored' | 'heat_pump',
  systemType: string,
  isMixergy: boolean | undefined,
): string {
  if (sceneLayoutKind === 'heat_pump') {
    return systemType === 'vented_cylinder' ? 'HP (tank-fed store)' : 'HP (mains-fed store)'
  }
  if (systemType === 'vented_cylinder') return 'Vented cylinder'
  if (isMixergy) return 'Mixergy cylinder'
  return 'Unvented cylinder'
}

/**
 * Derive the PartKind for the cylinder schematic face from scene metadata.
 * Used by both the SchematicFaceToken face and the coil/fill overlays so that
 * both use the same builder token visual.
 */
function cylinderFaceKindFromMeta(
  systemType: string,
  isMixergy: boolean | undefined,
): 'dhw_mixergy' | 'dhw_vented_cylinder' | 'dhw_unvented_cylinder' {
  if (isMixergy) return 'dhw_mixergy'
  if (systemType === 'vented_cylinder') return 'dhw_vented_cylinder'
  return 'dhw_unvented_cylinder'
}

/**
 * Return the valve/control-topology indicator label for the Play schematic.
 * Uses scene.metadata.controlTopologyKind (graph-derived) when available,
 * falling back to the legacy isSPlanTopology flag for backwards compatibility.
 */
function controlTopologyLabel(
  controlTopologyKind: string | undefined,
  isSPlanFallback: boolean,
): string {
  switch (controlTopologyKind) {
    case 's_plan_multi_zone': return 'zone valves (multi-zone)'
    case 's_plan':            return 'zone valves (S-plan)'
    case 'y_plan':            return '3-port valve (Y-plan)'
    case 'hp_diverter':       return 'HP diverter valve'
    default:                  return isSPlanFallback ? 'zone valves' : '3-port valve'
  }
}


/**
 * Return a human-readable label for a cold-source kind.
 * Used by both mixed outlet labels and cold-only outlet badges to ensure
 * consistent terminology across both rendering paths.
 *
 * cws   → 'CWS (pressure-matched)' — gravity-fed CWS rail; pressure matches hot side
 * mains → 'mains'                  — pressurised direct cold water
 */
function coldSourceKindLabel(kind: 'mains' | 'cws'): string {
  return kind === 'cws' ? 'CWS (pressure-matched)' : 'mains'
}

/**
 * Return the SVG fill colour for a cold-source kind indicator.
 * Distinct tones for CWS (teal/cyan) vs mains (sky blue) so the two rails
 * are visually distinguishable at a glance.
 */
function coldSourceKindColor(kind: 'mains' | 'cws'): string {
  return kind === 'cws' ? '#0891b2' : '#0284c7'
}

/**
 * Format elapsed simulated seconds as a human-readable time string.
 * ≤ 60 min: "Nm NNs"   e.g. "3m 22s"
 * > 60 min: "Nh NNm"   e.g. "1h 05m"
 */
function formatSimTime(totalSeconds: number): string {
  const s = Math.floor(totalSeconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`
  return `${m}m ${sec.toString().padStart(2, '0')}s`
}

/** Supported time-scale multiplier values. */
const TIME_SCALE_OPTIONS: readonly number[] = [1, 10, 60, 300, 1800]

function makeInitialFrame(controls: LabControls): LabFrame {
  const isCylinderSystem =
    controls.systemType === 'unvented_cylinder' || controls.systemType === 'vented_cylinder'
  const cylinderStore =
    isCylinderSystem && controls.cylinder
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
    outletSamples: emptyOutletSamples(controls.outlets),
    cylinderStore,
    simTimeSeconds: 0,
    standingLossKwhTotal: isCylinderSystem ? 0 : undefined,
  }
}

export function LabCanvas(props: {
  controls: LabControls
  summary: CapacitySummary
  onFrame?: (frame: LabFrame) => void
}) {
  const { controls, summary, onFrame } = props

  // ── Water supply manual overrides (PR6) ───────────────────────────────────
  // These are lab-side state — they do not feed back to the survey adapter or
  // engine models.  The simulation uses the effective controls derived below.
  const [manualFlowLpm, setManualFlowLpm] = React.useState<number | undefined>(undefined)
  const [manualPressureBar, setManualPressureBar] = React.useState<number | undefined>(undefined)
  const [manualColdInletC, setManualColdInletC] = React.useState<5 | 10 | 15 | undefined>(undefined)

  // ── Condition state (PR6) ─────────────────────────────────────────────────
  // Forwarded to stepSimulation() as scenario modifiers.  Clean state = no effect.
  const [conditionState, setConditionState] = React.useState<LabConditionState>({
    heatingCircuit: 'clean',
    hotWaterSide: 'clean',
  })

  // ── Effective controls — merge manual water-supply overrides ──────────────
  // Only creates a new object when an override is set.  The simulation always
  // uses these values, so overrides are reflected immediately in playback.
  const effectiveControls: LabControls = React.useMemo(() => {
    if (manualFlowLpm === undefined && manualColdInletC === undefined) return controls
    return {
      ...controls,
      mainsDynamicFlowLpm: manualFlowLpm ?? controls.mainsDynamicFlowLpm,
      coldInletC: manualColdInletC ?? controls.coldInletC,
    }
  }, [controls, manualFlowLpm, manualColdInletC])

  // Keep refs current so the animation loop always reads the latest values.
  const effectiveControlsRef = React.useRef(effectiveControls)
  React.useLayoutEffect(() => { effectiveControlsRef.current = effectiveControls })

  const conditionStateRef = React.useRef(conditionState)
  React.useLayoutEffect(() => { conditionStateRef.current = conditionState })

  const manualPressureBarRef = React.useRef(manualPressureBar)
  React.useLayoutEffect(() => { manualPressureBarRef.current = manualPressureBar })

  const onFrameRef = React.useRef(onFrame)
  React.useLayoutEffect(() => { onFrameRef.current = onFrame })

  const [frame, setFrame] = React.useState<LabFrame>(() => makeInitialFrame(controls))

  // ── Simulation time-scale state ────────────────────────────────────────────
  // timeScale and isPaused are UI controls; simTimeSeconds lives in the frame.
  // Use a ref so the animation loop always reads the latest value without
  // needing to be recreated.
  const [simTimeState, setSimTimeState] = React.useState<SimTimeState>({
    timeScale: 1,
    isPaused: false,
  })
  const simTimeStateRef = React.useRef(simTimeState)
  React.useLayoutEffect(() => { simTimeStateRef.current = simTimeState })

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
      const realDtMs = last === null ? DEFAULT_FRAME_TIME_MS : Math.min(MAX_FRAME_TIME_MS, ts - last)

      const { timeScale, isPaused } = simTimeStateRef.current
      if (!isPaused) {
        // Scale the integration timestep — physics stays in real units.
        const simDtMs = realDtMs * timeScale
        setFrame(prev => {
          const next = stepSimulation({
            frame: prev,
            dtMs: simDtMs,
            controls: effectiveControlsRef.current,
            conditionState: conditionStateRef.current,
            dynamicPressureBar: manualPressureBarRef.current,
          })
          onFrameRef.current?.(next)
          return next
        })
      }

      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  /** Advance simulation by a fixed number of simulated seconds (step mode). */
  const handleStep = React.useCallback((stepSeconds: number) => {
    setFrame(prev => stepSimulation({
      frame: prev,
      dtMs: stepSeconds * 1000,
      controls: effectiveControlsRef.current,
      conditionState: conditionStateRef.current,
      dynamicPressureBar: manualPressureBarRef.current,
    }))
  }, [])

  const isCylinder = controls.systemType === 'unvented_cylinder' || controls.systemType === 'vented_cylinder'

  // ── Playback mode ──────────────────────────────────────────────────────────
  // Derived from whether survey-backed physics inputs are present.
  // Used to display the mode badge so users can distinguish demo defaults
  // from real survey-backed playback.
  const playbackMode = derivePlaybackMode(controls.playbackInputs)

  // ── Override summary (PR6) ────────────────────────────────────────────────
  // True when the user has manually overridden any water-supply value.
  const hasWaterOverride = manualFlowLpm !== undefined || manualPressureBar !== undefined || manualColdInletC !== undefined
  // True when condition state differs from the all-clean default.
  const hasConditionChange = conditionState.heatingCircuit !== 'clean' || conditionState.hotWaterSide !== 'clean'

  // ── Condensing-state badge (PR7) ──────────────────────────────────────────
  // Derived from the return-water temperature in the CH heat balance.
  // Only shown for boiler-based heat sources — heat pumps use a different
  // efficiency model and must not receive a condensing-mode badge.
  // chBalance is only populated when emitterLoads are configured, so the badge
  // is intentionally absent in illustrative-only configurations without a
  // quantified heat balance — keeping the display truthful.
  const effectiveHeatSourceType =
    controls.heatSourceType ?? (controls.systemType === 'combi' ? 'combi' : 'system_boiler')
  const showCondensingBadge =
    isBoilerHeatSource(effectiveHeatSourceType) &&
    frame.chBalance?.returnTempC !== undefined
  const condensingState = showCondensingBadge
    ? deriveCondensingState(frame.chBalance!.returnTempC)
    : undefined

  // Effective cold inlet — reflects manual override when set.
  // Used throughout the render layer so visual pipe colours stay consistent
  // with the physics inputs the simulation actually received.
  const effectiveColdInletC = effectiveControls.coldInletC

  // ── Play Scene Model ───────────────────────────────────────────────────────
  // Build an explicit scene description from controls + frame.
  // The renderer uses scene.metadata flags instead of repeating inline
  // systemType checks, which prevents contradictions like duplicate cold feeds
  // or a missing heat source when heating is active.
  // Declared early so isStoredLayout is available for buildPolylines() below.
  const scene = buildPlaySceneModel(controls, frame)
  const isStoredLayout = scene.metadata.sceneLayoutKind !== 'combi'

  const GLOW = 'url(#glow)'
  const NONE = 'none'
  const glowFor = (component: CapacitySummary['limitingComponent']) =>
    summary.limitingComponent === component ? GLOW : NONE

  const pipeGlow   = glowFor('Pipe')
  const boilerGlow = glowFor('Thermal')
  const mainsGlow  = glowFor('Supply')

  // ── TMV state ──────────────────────────────────────────────────────────────
  // The TMV always lives on the first hot outlet (slot 'A' in the standard
  // assignment scheme).  We use the first hot outlet as the reference instead
  // of hard-coding slot 'A' so the logic stays correct for graphs where outlet
  // nodes are assigned starting from a letter other than A.
  const tmvReferenceOutlet = controls.outlets.find(o => !isColdOnlyOutlet(o, controls))
  const tmvOutletAActive = !isCylinder &&
    tmvReferenceOutlet?.enabled === true &&
    tmvReferenceOutlet?.kind === 'shower_mixer' &&
    tmvReferenceOutlet?.tmvEnabled === true &&
    summary.hydraulicFlowLpm > 0

  // The outletA alias is kept for backward-compat references below (e.g. display
  // of tmvTargetTempC in the sidebar).  It is the same as tmvReferenceOutlet.
  const outletA = tmvReferenceOutlet
  const tmvOutcomeA = tmvReferenceOutlet ? summary.tmvOutcomes?.[tmvReferenceOutlet.id] : undefined
  const tmvSaturated = summary.tmvSaturated === true

  // Build polylines — when TMV outlet A is active, outlet A branch ends at the
  // mixer node rather than the full outlet terminal.
  // For stored-cylinder systems (isCylinder && isStoredLayout) use the domestic
  // circuit trunk (cold rail → cylinder → splitter) so particles never travel
  // through the heat-source box on the domestic path.
  const extraSlots = controls.outlets.filter(o => !isColdOnlyOutlet(o, controls)).slice(3).map(o => o.id)
  const {
    main: polyMain, branchA, branchB, branchC, coldBypassA, extraBranches,
  } = buildPolylines({
    tmvOutletA: tmvOutletAActive,
    isStoredCylinder: isCylinder && isStoredLayout,
    extraOutletSlots: extraSlots,
  })

  // Post-HEX pipe and outlet branch colour — driven by achieved outlet temperature (combi),
  // or store temperature (cylinder), so the visual matches what the water actually delivers.
  const postHexThermalColor: string | undefined = (() => {
    if (!isCylinder && summary.achievedOutTempC !== undefined && summary.hydraulicFlowLpm > 0) {
      return tempToThermalColor(summary.achievedOutTempC)
    }
    if (isCylinder && frame.cylinderStore) {
      const storeT = cylinderTempC({ store: frame.cylinderStore, coldInletC: effectiveColdInletC })
      return tempToThermalColor(storeT)
    }
    return undefined
  })()

  // Cold supply bypass colour — always cold-inlet colour.
  const coldSupplyColor = tempToThermalColor(effectiveColdInletC)

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

  // ── Dynamic outlet positions ──────────────────────────────────────────────
  // The first three outlets use the fixed SCHEMATIC_P positions (A, B, C).
  // Additional outlets (D, E, …) are stacked below outlet C, 55 px apart.
  const EXTRA_BRANCH_SPACING = 55
  const hotOutlets = controls.outlets.filter(o => !isColdOnlyOutlet(o, controls))
  const outletXMap: Record<string, number> = {}
  const outletYMap: Record<string, number> = {}
  hotOutlets.forEach((outlet, index) => {
    switch (index) {
      case 0: outletXMap[outlet.id] = P.outlet1X; outletYMap[outlet.id] = P.outlet1Y; break
      case 1: outletXMap[outlet.id] = P.outlet2X; outletYMap[outlet.id] = P.outlet2Y; break
      case 2: outletXMap[outlet.id] = P.outlet3X; outletYMap[outlet.id] = P.outlet3Y; break
      default:
        // Extra outlets stacked below outlet C.
        outletXMap[outlet.id] = P.outlet3X
        outletYMap[outlet.id] = P.outlet3Y + (index - 2) * EXTRA_BRANCH_SPACING
    }
  })

  // The splitter node is always visible since we always have at least one outlet branch.
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

  // Combi service switching — read from scene metadata (authoritative, set by simulation).
  // When true, the boiler output is fully diverted to the DHW plate HEX; CH is suspended.
  // The renderer must NOT re-derive this from systemMode to keep logic centralised.
  const serviceSwitchingActive = scene.metadata.serviceSwitchingActive ?? false

  // Heat-transfer glow filter references — applied to the component in the SVG.
  const HEAT_GLOW = 'url(#heat-glow)'

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
      ? cylinderTempC({ store: frame.cylinderStore, coldInletC: effectiveColdInletC })
      : null
  const usableHot = storeTempC !== null ? storeTempC >= USABLE_HOT_THRESHOLD_C : null

  // ── CH numerical model outputs ────────────────────────────────────────────
  // When the simulation ran the energy-balance model, frame.chBalance carries
  // derived flow and return temperatures.  Use these to colour the CH supply
  // and return pipes with real physics rather than a fixed domain colour.
  const chBalance = frame.chBalance
  // CH supply pipe colour — driven by flow temperature when chBalance is available.
  const chFlowColor = isChActive
    ? (chBalance ? tempToThermalColor(chBalance.flowTempC) : '#f97316')
    : '#f97316'
  // CH return pipe colour — driven by return temperature when chBalance is available.
  const chReturnColor = isChActive && chBalance
    ? tempToThermalColor(chBalance.returnTempC)
    : '#94a3b8'
  // Label strings for CH supply and return temperature readouts.
  const chFlowLabel = chBalance
    ? `CH supply · ${Math.round(chBalance.flowTempC)} °C · ${chBalance.deliveredKw.toFixed(1)} kW`
    : 'CH supply'
  const chReturnLabel = chBalance
    ? `Return · ${Math.round(chBalance.returnTempC)} °C`
    : 'Common return'

  // Cylinder tank fill — prefer visuals.storageStates (authoritative simulation output)
  // and fall back to direct store calculation for backwards compatibility.
  const cylinderFillFraction = (() => {
    const sv = visuals?.storageStates.find(s => s.nodeId === 'cylinder')
    if (sv?.active && sv.chargePct !== undefined) return sv.chargePct
    return storeTempC !== null ? cylinderChargePct(storeTempC, effectiveColdInletC) : 0
  })()

  // Cylinder tank SVG dimensions — derived from SCHEMATIC_P so pathMap and
  // LabCanvas always share the same geometry.
  const cylX = P.cylX
  const cylY = P.cylY
  const cylW = P.cylW
  const cylH = P.cylH
  const fillH = cylH * cylinderFillFraction
  const fillY = cylY + (cylH - fillH)
  const fillColor = storeTempC !== null ? tempToThermalColor(storeTempC) : '#cfd8e3'

  // ── Stored-system heat source box layout (PR16) ───────────────────────────
  // For stored/heat_pump systems, the boiler or heat pump is a SEPARATE node
  // rendered to the LEFT of the cylinder box.  It connects to the cylinder via
  // the primary coil and to the heating emitters via the CH supply.
  // This prevents the cylinder from visually appearing to be the heat source.
  const heatSrcBoxX = cylX - 165        // left edge of heat source box
  const heatSrcBoxY = cylY              // top — same height as cylinder
  const heatSrcBoxW = 145              // narrower than the cylinder box
  const heatSrcBoxH = cylH             // same height as cylinder
  const heatSrcCenterX = heatSrcBoxX + heatSrcBoxW / 2  // 127  (approx centre)
  // Cold-supply pipe Y for stored unvented systems: runs below both boxes to avoid
  // passing through the heat source area (cold feed goes to cylinder, not boiler).
  // ── Cold rail Y — shared cold-supply rail for all layout kinds ───────────
  // Runs just below the appliance boxes (HEX for combi; heat source + cylinder
  // for stored/HP).  All cold-water paths branch from this rail:
  //   combi     — U-shaped route: mains → down → rail → up into HEX cold_in
  //   stored    — horizontal rail at same Y, branching up into cylinder bottom
  //   open-vent — CWS gravity feed drops to the same level, then branches up
  //   cold taps — branch downward from this rail (never on the hot service)
  const coldRailY = P.coldRailY  // just below both appliance boxes (≈180 px)

  // Cylinder port coordinates — derived from SCHEMATIC_P named offsets so
  // LabCanvas and pathMap always agree on where cold_in / hot_out sit.
  const cylColdInX = cylX + P.cylColdInOffsetX  // 390 — cold_in entry X (30 px from left)
  const cylHotOutY = cylY + P.cylHotOutOffsetY  //  98 — hot_out Y (12 px from top)

  // ── Stored-system valve layout ────────────────────────────────────────────
  // The control valve sits below the heat source box on the source flow path.
  // All topologies (Y-plan, S-plan, none) share the same vertical anchor so that
  // the CH supply path can originate from a consistent point below the valve.
  const storedValveY = heatSrcBoxY + heatSrcBoxH + 22   // valve centre Y
  const storedValveBottomY = storedValveY + Math.max(VALVE_DIAMOND_HALF_H, ZONE_VALVE_RADIUS) + 2

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

  // ── Cylinder schematic face kind ──────────────────────────────────────────
  // Derived from scene metadata + systemType so both the face visual and the
  // coil/fill overlays use the same kind as the builder token.
  const cylinderFaceKind = cylinderFaceKindFromMeta(
    controls.systemType,
    scene.metadata.isMixergy,
  )

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

          {/* Combi DHW warm-up: the HEX ramps cold mains water to hot.
              The pipe from HEX exit to splitter shows this transition so the
              output does not look instantly fully hot.
              cold blue (HEX entry side) → warm yellow → orange → hot red. */}
          <linearGradient
            id="grad-combi-warmup"
            x1={P.boilerX + 120} y1={0} x2={P.splitX} y2={0}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%"   stopColor="#7dd3fc" />
            <stop offset="20%"  stopColor="#fbbf24" />
            <stop offset="55%"  stopColor="#f97316" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>

          {/* Clip region for the plate-HEX shimmer highlight — matches the heat-source box boundary */}
          <clipPath id="heat-src-clip">
            <rect x={cylX} y={cylY} width={cylW} height={cylH} rx={18} />
          </clipPath>
        </defs>

        {/* ── Structural zone overlays — passive tinted backgrounds only ─────── */}
        {/* No strokes: zone rects must never draw borders over pipes/components.
            Labels are corner-only; pointer-events none and aria-hidden.           */}
        <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
          {/* Living areas zone (outlets): always visible */}
          <rect x={640} y={44} width={356} height={188} rx={6}
            fill="rgba(219,234,254,0.12)" />
          <text x={648} y={56} fontSize={9} fontWeight={600}
            fill="#60a5fa" opacity={0.65} letterSpacing="0.04em">
            LIVING AREAS
          </text>

          {/* Emitter zone — ground / first floor */}
          <rect x={84} y={213} width={142} height={50} rx={4}
            fill="rgba(220,252,231,0.14)" />
          <text x={91} y={224} fontSize={8} fontWeight={600}
            fill="#22c55e" opacity={0.65} letterSpacing="0.04em">
            GROUND FLOOR
          </text>

          {/* Airing cupboard zone (cylinder) — stored / HP only */}
          {isStoredLayout && (
            <>
              <rect x={cylX - 4} y={cylY - 14} width={cylW + 8} height={cylH + 18} rx={6}
                fill="rgba(186,230,253,0.12)" />
              <text x={cylX + 2} y={cylY - 4} fontSize={9} fontWeight={600}
                fill="#0ea5e9" opacity={0.65} letterSpacing="0.04em">
                AIRING CUPBOARD
              </text>
            </>
          )}

          {/* Roof space (CWS / F&E tank) — vented systems only */}
          {controls.systemType === 'vented_cylinder' && (
            <>
              <rect x={cwsX - 4} y={cwsY - 4} width={cwsW + 8} height={cwsH + 8} rx={4}
                fill="rgba(203,213,225,0.14)" />
              <text x={cwsX + 2} y={cwsY - 6} fontSize={8} fontWeight={600}
                fill="#94a3b8" opacity={0.72} letterSpacing="0.04em">
                ROOF SPACE
              </text>
            </>
          )}

          {/* Plant room / outside zone (heat source) */}
          {isStoredLayout ? (
            <>
              <rect x={heatSrcBoxX - 4} y={heatSrcBoxY - 14} width={heatSrcBoxW + 8} height={heatSrcBoxH + 18} rx={6}
                fill={scene.metadata.sceneLayoutKind === 'heat_pump'
                  ? 'rgba(209,250,229,0.12)'
                  : 'rgba(254,243,199,0.12)'} />
              <text x={heatSrcBoxX + 2} y={heatSrcBoxY - 4} fontSize={9} fontWeight={600}
                fill={scene.metadata.sceneLayoutKind === 'heat_pump' ? '#10b981' : '#d97706'}
                opacity={0.65} letterSpacing="0.04em">
                {scene.metadata.sceneLayoutKind === 'heat_pump' ? 'OUTSIDE' : 'PLANT ROOM'}
              </text>
            </>
          ) : (
            <>
              <rect x={270} y={78} width={310} height={100} rx={6}
                fill="rgba(254,243,199,0.12)" />
              <text x={278} y={90} fontSize={9} fontWeight={600}
                fill="#d97706" opacity={0.65} letterSpacing="0.04em">
                PLANT ROOM
              </text>
            </>
          )}
        </g>

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
        {/* For stored/heat_pump systems (PR16): the cold supply feeds the CYLINDER,
            not the boiler.  Route below the heat source box to avoid visual confusion
            that implies cold water passes through the boiler.
            For combi systems: unchanged horizontal run at P.mainsY.              */}
        {scene.metadata.showGenericColdFeed && (
          isStoredLayout ? (
            // ── Stored system cold supply — routes below both appliance boxes ──
            // mains (left) → cold rail (horizontal) → cylinder cold_in (bottom)
            <>
              <path
                d={`M ${P.mainsX} ${coldRailY} L ${cylColdInX} ${coldRailY}`}
                stroke="url(#grad-cold-supply)" strokeWidth={12} strokeLinecap="round"
                opacity={THERMAL_COLOR_OPACITY}
              />
              <path
                d={`M ${P.mainsX} ${coldRailY} L ${cylColdInX} ${coldRailY}`}
                stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round"
              />
              {/* Short vertical entry into cylinder bottom */}
              <path
                d={`M ${cylColdInX} ${coldRailY} L ${cylColdInX} ${cylY + cylH}`}
                stroke="#bae6fd" strokeWidth={8} strokeLinecap="round" opacity={0.85}
              />
              <path
                d={`M ${cylColdInX} ${coldRailY} L ${cylColdInX} ${cylY + cylH}`}
                stroke="#0ea5e9" strokeWidth={2} strokeLinecap="round"
              />
              {/* Downward arrow at cylinder cold_in entry */}
              <polygon
                points={`${cylColdInX - 5},${cylY + cylH - 5} ${cylColdInX + 5},${cylY + cylH - 5} ${cylColdInX},${cylY + cylH + 1}`}
                fill="#0ea5e9" opacity={0.9}
              />
              <text x={P.mainsX - 4} y={coldRailY - 6} fontSize={10} fill="#0369a1" textAnchor="start">
                Mains cold rail
              </text>
            </>
          ) : (
            // ── Combi — U-shaped cold rail: mains → down → rail → up into HEX cold_in ──
            // Rather than running a straight pipe at the same level as the hot trunk
            // (which implies cold and hot share a single pipe), the cold supply drops
            // from the mains entry point to the cold rail below the HEX box, runs
            // along that rail, then rises into the HEX cold_in.  This clearly shows:
            //   cold rail (bottom) → branch up into combi HEX
            //   hot trunk (right)  ← hot water exits the HEX on the opposite side
            <>
              {/* U-shaped cold supply: mains → cold rail → HEX cold_in */}
              {/* When TMV active: only route to pre-boiler tee, not all the way to HEX */}
              <path
                d={
                  tmvOutletAActive
                    ? `M ${P.mainsX} ${P.mainsY} L ${P.mainsX} ${coldRailY} L ${P.teeX} ${coldRailY} L ${P.teeX} ${P.mainsY}`
                    : `M ${P.mainsX} ${P.mainsY} L ${P.mainsX} ${coldRailY} L ${cylX} ${coldRailY} L ${cylX} ${P.mainsY}`
                }
                stroke="url(#grad-cold-supply)" strokeWidth={16} strokeLinecap="round"
                strokeLinejoin="round" filter={mainsGlow}
                opacity={THERMAL_COLOR_OPACITY}
              />
              <path
                d={
                  tmvOutletAActive
                    ? `M ${P.mainsX} ${P.mainsY} L ${P.mainsX} ${coldRailY} L ${P.teeX} ${coldRailY} L ${P.teeX} ${P.mainsY}`
                    : `M ${P.mainsX} ${P.mainsY} L ${P.mainsX} ${coldRailY} L ${cylX} ${coldRailY} L ${cylX} ${P.mainsY}`
                }
                stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              />
              {/* Mains cold rail label at the bottom horizontal segment */}
              <text x={P.mainsX - 4} y={coldRailY - 6} fontSize={11} fill="#0369a1" textAnchor="start">
                Mains cold rail
              </text>
            </>
          )
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
            {/* Gravity-drop cold feed pipe: cistern bottom → cylinder cold_in (BOTTOM).
                The cold supply enters the cylinder at the BOTTOM (cold_in port), not the top.
                The section of the pipe inside the cylinder rect is hidden behind it — only
                the visible drop from the cistern to the cylinder top edge is rendered;
                the cold_in arrow below explicitly marks where cold enters.           */}
            <path
              d={`M ${cwsX + cwsW / 2} ${cwsY + cwsH} L ${cylX + 10} ${cylY + cylH}`}
              stroke="#bae6fd" strokeWidth={10} strokeLinecap="round"
              opacity={0.85}
            />
            <path
              d={`M ${cwsX + cwsW / 2} ${cwsY + cwsH} L ${cylX + 10} ${cylY + cylH}`}
              stroke="#0ea5e9" strokeWidth={2} strokeLinecap="round"
            />
            {/* Mid-pipe downward arrow — reinforces gravity direction */}
            {(() => {
              const x1 = cwsX + cwsW / 2
              const y1 = cwsY + cwsH
              const x2 = cylX + 10
              const y2 = cylY + cylH  // bottom of cylinder (cold_in port)
              const mx = (x1 + x2) / 2
              const my = (y1 + y2) / 2
              return (
                <polygon
                  points={`${mx - 5},${my - 5} ${mx + 5},${my - 5} ${mx},${my + 5}`}
                  fill="#0ea5e9" opacity={0.85}
                />
              )
            })()}
            {/* Downward arrow at cylinder cold_in entry (bottom of cylinder) */}
            <polygon
              points={`${cylX + 6},${cylY + cylH - 4} ${cylX + 14},${cylY + cylH - 4} ${cylX + 10},${cylY + cylH + 2}`}
              fill="#0ea5e9" opacity={0.9}
            />
            {/* Label below the CWS cistern — confirms tank-fed (not mains-fed) supply */}
            <text x={cwsX + cwsW / 2} y={cwsY + cwsH + 11} textAnchor="middle" fontSize={8} fill="#0369a1">
              Tank-fed cold supply
            </text>
            {/* CWS cold rail label — distinguishes the gravity-fed rail from the mains cold rail */}
            <text x={cwsX + cwsW / 2} y={cwsY + cwsH + 22} textAnchor="middle" fontSize={8} fill="#0891b2" fontWeight={600}>
              CWS cold rail
            </text>
          </g>
        )}

        {/* ── Open vent cue — simplified indicator for vented cylinders ────── */}
        {/* A faint dashed line from the cylinder top represents the open-vent
            safety pipe connecting to the cistern above.  Shown for all vented
            cylinder systems (not expert-only) as a simplified conceptual indicator
            of the open-vented storage convention — no pipe-for-pipe geometry.     */}
        {controls.systemType === 'vented_cylinder' && (
          <g opacity={0.5}>
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
             * SchematicFaceToken renders the same face as the builder combi token,
             * showing the CH/DHW zone divider and fire indicator.
             * Activity glow and shimmer overlays sit on top.
             */}
            {/* Schematic face — same visual as builder combi token */}
            <SchematicFaceToken
              kind="heat_source_combi"
              label="Combi"
              x={cylX} y={cylY} width={cylW} height={cylH}
            />
            {/* Activity glow overlay — stroke-only so face shows through */}
            <rect
              x={cylX} y={cylY} width={cylW} height={cylH} rx={18}
              fill="none"
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
            {/* Burner status — positioned below the face to avoid overlap */}
            <text x={P.boilerX + 30} y={cylY + cylH + 13} textAnchor="middle" fontSize={10}
              fill={burnerActive ? '#c2410c' : '#64748b'}>
              {burnerActive ? 'burner firing · heat transfer active' : ''}
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
             * SchematicFaceToken renders the same face as the builder heat pump token.
             * Activity glow sits on top as an overlay.
             */}
            {/* Schematic face — same visual as builder heat pump token */}
            <SchematicFaceToken
              kind="heat_source_heat_pump"
              label="Heat Pump"
              x={cylX} y={cylY} width={cylW} height={cylH}
            />
            {/* Activity glow overlay */}
            <rect
              x={cylX} y={cylY} width={cylW} height={cylH} rx={18}
              fill="none"
              stroke={burnerActive ? '#0891b2' : 'transparent'}
              strokeWidth={burnerActive ? 2.5 : 1}
              filter={burnerActive ? 'url(#primary-glow)' : boilerGlow}
            />
            {/* Compressor status */}
            <text x={P.boilerX + 30} y={cylY + cylH + 13} textAnchor="middle" fontSize={10}
              fill={burnerActive ? '#0891b2' : '#64748b'}>
              {burnerActive ? 'compressor running · heat transfer active' : ''}
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
             * PR16: Stored / heat-pump system — heat source and cylinder are SEPARATE nodes.
             *
             * Layout (left to right):
             *   [Heat Source box]  primary coil  [Cylinder (DHW store)]  DHW hot →  [splitter]
             *        ↓ CH supply
             *   [Emitters / radiators]
             *
             * The heat source (boiler or heat pump) is rendered as its own appliance
             * block to the LEFT of the cylinder store.  The two blocks are connected
             * by the primary coil circuit (not the domestic hot-water path).
             *
             * This explicitly shows:
             *   • CH flow / CH return ports on the heat source (simplified to 2 ports).
             *   • Primary coil as the indirect heat-transfer link to the store.
             *   • DHW draw as a completely separate path from the cylinder hot-out.
             *   • Heating emitters as a CH branch below the heat source.
             */}

            {/* ── Heat source box (separate from cylinder — PR16) ────────────── */}
            {/* SchematicFaceToken renders the same face as the builder boiler/HP token.
                Activity glow overlay and port/status labels sit on top.             */}
            {/* Schematic face — same visual as builder boiler or heat pump token */}
            <SchematicFaceToken
              kind={isCompressor ? 'heat_source_heat_pump' : 'heat_source_system_boiler'}
              label={isCompressor ? 'Heat Pump' : 'Boiler'}
              x={heatSrcBoxX} y={heatSrcBoxY} width={heatSrcBoxW} height={heatSrcBoxH}
            />
            {/* Activity glow overlay */}
            <rect
              x={heatSrcBoxX} y={heatSrcBoxY} width={heatSrcBoxW} height={heatSrcBoxH} rx={12}
              fill="none"
              stroke={
                showHeatSourceIndicator
                  ? (isCompressor ? '#0891b2' : isDhwFiring ? '#ea580c' : '#f97316')
                  : 'transparent'
              }
              strokeWidth={showHeatSourceIndicator ? 2.5 : 1.5}
              filter={
                showHeatSourceIndicator
                  ? (isDhwFiring ? 'url(#dhw-glow)' : isCompressor ? 'url(#primary-glow)' : HEAT_GLOW)
                  : boilerGlow
              }
            />
            {/* CH port indicators — simplified to 2 ports (flow out + return in) */}
            <text
              x={heatSrcBoxX + heatSrcBoxW - 6} y={heatSrcBoxY + 32}
              textAnchor="end" fontSize={8}
              fill={showHeatSourceIndicator ? '#f97316' : '#94a3b8'}
              fontWeight={showHeatSourceIndicator ? 700 : 400}
            >
              Flow →
            </text>
            <text
              x={heatSrcBoxX + 6} y={heatSrcBoxY + 32}
              textAnchor="start" fontSize={8}
              fill={showHeatSourceIndicator ? '#f97316' : '#94a3b8'}
              fontWeight={showHeatSourceIndicator ? 700 : 400}
            >
              ← Return
            </text>
            {/* Operating mode status */}
            <text
              x={heatSrcBoxX + heatSrcBoxW / 2} y={heatSrcBoxY + 48}
              textAnchor="middle" fontSize={10}
              fill={showHeatSourceIndicator ? (isCompressor ? '#0891b2' : '#c2410c') : '#64748b'}
            >
              {showHeatSourceIndicator
                ? (isCompressor ? 'compressor running' : 'firing')
                : 'standby'}
            </text>
            {/* Flame / compressor indicator — always visible, fades when idle (PR5).
                Never inside the cylinder box — the heat source is a SEPARATE appliance. */}
            <g opacity={showHeatSourceIndicator ? 1 : 0.3}>
              <circle
                cx={heatSrcBoxX + 20} cy={heatSrcBoxY + heatSrcBoxH / 2 + 12}
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
                x={heatSrcBoxX + 20} y={heatSrcBoxY + heatSrcBoxH / 2 + 17}
                textAnchor="middle" fontSize={11}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {isCompressor ? '⚡' : '🔥'}
              </text>
            </g>

            {/* ── Primary coil bridge — heat source → cylinder coil ───────────── */}
            {/* Connects the right side of the heat source box to the cylinder coil.
                Two short parallel pipes in the 20px gap represent:
                  upper: primary coil flow  (heat source → cylinder coil entry)
                  lower: primary coil return (cylinder coil exit → heat source)
                Both are coloured purple (primary domain) and fade when the coil is idle. */}
            {(() => {
              const gapLeft  = heatSrcBoxX + heatSrcBoxW   // = right edge of heat source
              const gapRight = cylX                          // = left edge of cylinder
              const flowY    = heatSrcBoxY + 30             // upper pipe (coil flow)
              const retY     = heatSrcBoxY + heatSrcBoxH - 30  // lower pipe (coil return)
              const coilOpacity = (coilActive || isHwActive) ? 1 : 0.25
              return (
                <g opacity={coilOpacity}>
                  {/* Coil flow pipe */}
                  <line
                    x1={gapLeft} y1={flowY} x2={gapRight} y2={flowY}
                    stroke="#7c3aed" strokeWidth={3} strokeLinecap="round"
                  />
                  <polygon
                    points={`${gapRight - 6},${flowY - 4} ${gapRight},${flowY} ${gapRight - 6},${flowY + 4}`}
                    fill="#7c3aed"
                  />
                  {/* Coil return pipe */}
                  <line
                    x1={gapRight} y1={retY} x2={gapLeft} y2={retY}
                    stroke="#7c3aed" strokeWidth={3} strokeLinecap="round"
                  />
                  <polygon
                    points={`${gapLeft + 6},${retY - 4} ${gapLeft},${retY} ${gapLeft + 6},${retY + 4}`}
                    fill="#7c3aed"
                  />
                  {/* Primary domain label in the gap */}
                  <text
                    x={(gapLeft + gapRight) / 2} y={heatSrcBoxY + heatSrcBoxH / 2 + 4}
                    textAnchor="middle" fontSize={7} fill="#7c3aed"
                  >
                    {(coilActive || isHwActive) ? 'primary ▶' : 'primary coil'}
                  </text>
                </g>
              )
            })()}

            {/* ── Cylinder (DHW store only) — PR16: no flame inside ───────────── */}
            {/* The cylinder is purely the thermal store.  The heat source has been
                separated into its own box above.
                SchematicFaceToken renders the same face as the builder cylinder token,
                showing the cylinder body, coil indicator, and type label.
                Thermal fill and glow overlays sit on top.                            */}
            {/* Schematic face — same visual as builder cylinder token */}
            <SchematicFaceToken
              kind={cylinderFaceKind}
              label={cylinderLabel(scene.metadata.sceneLayoutKind, controls.systemType, scene.metadata.isMixergy)}
              x={cylX} y={cylY} width={cylW} height={cylH}
            />
            {/* Thermal fill — clips to rounded rect.
                Standard cylinder: fills from the bottom up (conventional warm-water level).
                Mixergy cylinder:  fills from the TOP DOWN (active top-down stratification),
                using a distinct purple tint to signal the different thermal physics.  */}
            {scene.metadata.isMixergy ? (
              <rect
                x={cylX} y={cylY} width={cylW} height={fillH}
                fill="#7c3aed" opacity={MIXERGY_FILL_OPACITY} clipPath="url(#cyl-clip)"
              />
            ) : (
              <rect
                x={cylX} y={fillY} width={cylW} height={fillH}
                fill={fillColor} opacity={0.75} clipPath="url(#cyl-clip)"
              />
            )}
            {/* Activity glow overlay — domain-aware border and filter */}
            <rect
              x={cylX} y={cylY} width={cylW} height={cylH} rx={18}
              fill="none"
              stroke={(coilActive || isHwActive) ? '#7c3aed' : '#94a3b8'}
              strokeWidth={(coilActive || isHwActive) ? 2.5 : 1.5}
              filter={(coilActive || isHwActive) ? 'url(#primary-glow)' : undefined}
            />
            {/* Store mode / status text */}
            <text x={cylX + cylW / 2 - 15} y={cylY + 38} textAnchor="middle" fontSize={10}
              fill={(coilActive || isHwActive) ? '#c2410c' : '#64748b'}>
              {(coilActive || isHwActive)
                ? (systemMode === 'heating_and_reheat' ? 'coil reheat (S-plan)' : 'coil reheating store')
                : 'stored hot water'}
            </text>
            {storeTempC !== null && (
              <text x={cylX + cylW / 2 - 15} y={cylY + 52} textAnchor="middle" fontSize={11} fill="#b45309">
                {roundTempC(storeTempC)} °C
              </text>
            )}
            {/* Mixergy: top-down heat label */}
            {scene.metadata.isMixergy && (
              <>
                <text x={cylX + 8} y={cylY + 13} textAnchor="start" fontSize={8} fill="#7c3aed">
                  ↓ hot
                </text>
                <text x={cylX + cylW / 2 - 15} y={cylY + 66} textAnchor="middle" fontSize={8} fill="#7c3aed">
                  top-down stratification · reduced cycling
                </text>
              </>
            )}
            {/* ── Cylinder domestic port labels (cold in bottom, hot out top) ─────
                Reinforces the vertical domestic path story:
                  cold enters at the bottom cold_in port
                  stored water heats via the coil (shown on left face by SchematicFaceToken)
                  hot leaves from the top hot_out port                                    */}
            {!scene.metadata.isMixergy && (
              <>
                {/* "↓ cold in" — bottom-left of cylinder */}
                <text
                  x={cylX + 8} y={cylY + cylH - 6}
                  textAnchor="start" fontSize={8}
                  fill="#0369a1" fontWeight={600}
                >
                  ↓ cold in
                </text>
                {/* "↑ hot out" — top area */}
                <text
                  x={cylX + 8} y={cylY + 11}
                  textAnchor="start" fontSize={8}
                  fill="#b45309" fontWeight={600}
                >
                  ↑ hot out
                </text>
              </>
            )}

            {/* ── Hot output tap — cylinder top → DHW trunk (stored/HP only) ─────
                Shows that hot water exits from NEAR THE TOP of the cylinder and
                routes down to the main DHW trunk, not from the centre of the box.
                The short vertical segment at the cylinder right edge (X = cylX+cylW)
                bridges cylHotOutY (top area) down to P.boilerY (trunk level), meeting
                the existing "pipe to splitter" at exactly (cylX+cylW, P.boilerY).    */}
            <path
              d={`M ${cylX + cylW} ${cylHotOutY} L ${cylX + cylW} ${P.boilerY}`}
              stroke={postHexThermalColor ?? '#cfd8e3'} strokeWidth={12} strokeLinecap="round"
              opacity={postHexThermalColor ? THERMAL_COLOR_OPACITY : 0.5}
            />
            <path
              d={`M ${cylX + cylW} ${cylHotOutY} L ${cylX + cylW} ${P.boilerY}`}
              stroke="#8aa1b6" strokeWidth={2} strokeLinecap="round"
            />

            {/* ── Control valve — sits on the source flow path below the heat source ─
                Scene grammar: Source → Control → Load(s) → Common return.
                The valve is the routing decision point.  It sits directly below the
                heat source box so source flow visibly passes through it before
                branching to CH (heating load) or HW (cylinder coil / hot-water load).
                Position: centred below the heat source box at storedValveY.          */}
            {(() => {
              const topologyKind = scene.metadata.controlTopologyKind ?? 'none'
              // Anchor valve directly below the heat source box on the source flow path.
              const cx = heatSrcCenterX
              const cy = storedValveY
              // Right edge of heat source box — needed to draw the HW branch to the coil.
              const srcRightX = heatSrcBoxX + heatSrcBoxW
              // Primary coil flow Y — where the HW branch meets the coil bridge.
              const coilFlowY = heatSrcBoxY + 30

              // Source flow line: from heat source flow port (bottom-centre) down to
              // the valve.  This makes the source-to-valve path visible.
              const srcFlowLineEndY = topologyKind === 'y_plan'
                ? cy - VALVE_DIAMOND_HALF_H - 2
                : cy - ZONE_VALVE_RADIUS - 2
              const srcFlowLine = (
                <line
                  x1={cx} y1={heatSrcBoxY + heatSrcBoxH}
                  x2={cx} y2={srcFlowLineEndY}
                  stroke="#f97316" strokeWidth={2.5} strokeLinecap="round"
                  opacity={showHeatSourceIndicator ? 0.85 : 0.3}
                />
              )

              // Source tee line shared by s_plan / hp_diverter: a short horizontal bar
              // at the valve level connects the two zone valve circles, showing that
              // source flow arrives at the tee before splitting to CH and HW.
              const srcTeeLine = (
                <line
                  x1={cx - 30 + ZONE_VALVE_RADIUS} y1={cy}
                  x2={cx + 30 - ZONE_VALVE_RADIUS} y2={cy}
                  stroke="#94a3b8" strokeWidth={1.5} strokeLinecap="round" opacity={0.5}
                />
              )

              if (topologyKind === 'y_plan') {
                const routingToCh = isChActive
                const routingToHw = isHwActive && !isChActive
                const valveActive = isChActive || isHwActive
                // Compact token dimensions for the Y-plan 3-port valve face
                const valveTW = 110
                const valveTH = 46
                return (
                  <g>
                    {srcFlowLine}
                    <text x={cx} y={cy - valveTH / 2 - 5} textAnchor="middle" fontSize={8} fill="#94a3b8">
                      {controlTopologyLabel(topologyKind, false)}
                    </text>
                    {/* Schematic face — same visual as builder three_port_valve token */}
                    <SchematicFaceToken
                      kind="three_port_valve"
                      label="Y-plan"
                      x={cx - valveTW / 2} y={cy - valveTH / 2}
                      width={valveTW} height={valveTH}
                    />
                    {/* Activity state overlay border */}
                    <rect
                      x={cx - valveTW / 2} y={cy - valveTH / 2} width={valveTW} height={valveTH} rx={4}
                      fill="none"
                      stroke={valveActive ? '#d97706' : 'transparent'}
                      strokeWidth={valveActive ? 2 : 1}
                    />
                    {/* State label (routing direction) */}
                    <text x={cx} y={cy + valveTH / 2 + 10} textAnchor="middle" fontSize={8}
                      fill={valveActive ? '#92400e' : '#94a3b8'}>
                      {isChActive ? '→CH' : isHwActive ? '→HW' : ''}
                    </text>
                    {/* CH branch: valve left → heating load */}
                    <line x1={cx - valveTW / 2} y1={cy} x2={cx - valveTW / 2 - 20} y2={cy}
                      stroke="#f97316" strokeWidth={2.5} strokeLinecap="round" opacity={routingToCh ? 1 : 0.2} />
                    <polygon
                      points={`${cx - valveTW / 2 - 24},${cy - 4} ${cx - valveTW / 2 - 16},${cy} ${cx - valveTW / 2 - 24},${cy + 4}`}
                      fill="#f97316" opacity={routingToCh ? 1 : 0.2} />
                    <text x={cx - valveTW / 2 - 28} y={cy + 4} textAnchor="end" fontSize={9}
                      fill={routingToCh ? '#f97316' : '#94a3b8'} fontWeight={routingToCh ? 700 : 400}>CH</text>
                    {/* HW branch: valve right → right to source edge → up to primary coil */}
                    <path
                      d={`M ${cx + valveTW / 2} ${cy} L ${srcRightX} ${cy} L ${srcRightX} ${coilFlowY}`}
                      stroke="#7c3aed" strokeWidth={2} strokeDasharray="5 3" fill="none"
                      strokeLinecap="round" opacity={routingToHw ? 0.9 : 0.2}
                    />
                    <line x1={cx + valveTW / 2} y1={cy} x2={cx + valveTW / 2 + 20} y2={cy}
                      stroke="#7c3aed" strokeWidth={2.5} strokeLinecap="round" opacity={routingToHw ? 1 : 0.2} />
                    <polygon
                      points={`${cx + valveTW / 2 + 16},${cy - 4} ${cx + valveTW / 2 + 24},${cy} ${cx + valveTW / 2 + 16},${cy + 4}`}
                      fill="#7c3aed" opacity={routingToHw ? 1 : 0.2} />
                    <text x={cx + valveTW / 2 + 28} y={cy + 4} textAnchor="start" fontSize={9}
                      fill={routingToHw ? '#7c3aed' : '#94a3b8'} fontWeight={routingToHw ? 700 : 400}>HW</text>
                  </g>
                )
              }

              if (topologyKind === 's_plan' || topologyKind === 's_plan_multi_zone') {
                const chX = cx - 30
                const hwX = cx + 30
                // Compact token dimensions for S-plan zone valves
                const zvW = 56
                const zvH = 40
                return (
                  <g>
                    {srcFlowLine}
                    <text x={cx} y={cy - zvH / 2 - 14} textAnchor="middle" fontSize={8} fill="#94a3b8">
                      {controlTopologyLabel(topologyKind, false)}
                    </text>
                    {/* Source tee: flow line arrives and branches left (CH) and right (HW) */}
                    {srcTeeLine}
                    {/* CH zone valve schematic face — same visual as builder zone_valve token */}
                    <SchematicFaceToken
                      kind="zone_valve"
                      label="CH"
                      x={chX - zvW / 2} y={cy - zvH / 2}
                      width={zvW} height={zvH}
                    />
                    {/* CH state overlay */}
                    <rect
                      x={chX - zvW / 2} y={cy - zvH / 2} width={zvW} height={zvH} rx={4}
                      fill="none"
                      stroke={isChActive ? '#f97316' : 'transparent'}
                      strokeWidth={isChActive ? 2 : 1}
                    />
                    <text x={chX} y={cy + zvH / 2 + 10} textAnchor="middle" fontSize={7}
                      fill={isChActive ? '#f97316' : '#94a3b8'} fontWeight={isChActive ? 700 : 400}>CH</text>
                    <text x={chX} y={cy - zvH / 2 - 4} textAnchor="middle" fontSize={8}
                      fill={isChActive ? '#16a34a' : '#94a3b8'}>{isChActive ? '▲' : '▽'}</text>
                    {/* HW zone valve schematic face — same visual as builder zone_valve token */}
                    <SchematicFaceToken
                      kind="zone_valve"
                      label="HW"
                      x={hwX - zvW / 2} y={cy - zvH / 2}
                      width={zvW} height={zvH}
                    />
                    {/* HW state overlay */}
                    <rect
                      x={hwX - zvW / 2} y={cy - zvH / 2} width={zvW} height={zvH} rx={4}
                      fill="none"
                      stroke={isHwActive ? '#0284c7' : 'transparent'}
                      strokeWidth={isHwActive ? 2 : 1}
                    />
                    <text x={hwX} y={cy + zvH / 2 + 10} textAnchor="middle" fontSize={7}
                      fill={isHwActive ? '#0284c7' : '#94a3b8'} fontWeight={isHwActive ? 700 : 400}>HW</text>
                    <text x={hwX} y={cy - zvH / 2 - 4} textAnchor="middle" fontSize={8}
                      fill={isHwActive ? '#16a34a' : '#94a3b8'}>{isHwActive ? '▲' : '▽'}</text>
                    {isChActive && isHwActive && (
                      <text x={cx} y={cy + zvH / 2 + 20} textAnchor="middle" fontSize={7} fill="#16a34a">
                        simultaneous ✓
                      </text>
                    )}
                  </g>
                )
              }

              if (topologyKind === 'hp_diverter') {
                const chX = cx - 30
                const hwX = cx + 30
                // Compact token dimensions for HP diverter zone valves
                const zvW = 56
                const zvH = 40
                return (
                  <g>
                    {srcFlowLine}
                    <text x={cx} y={cy - zvH / 2 - 14} textAnchor="middle" fontSize={8} fill="#94a3b8">
                      {controlTopologyLabel(topologyKind, false)}
                    </text>
                    {/* Source tee: flow line arrives and branches left (CH) and right (HW) */}
                    {srcTeeLine}
                    {/* CH zone valve schematic face */}
                    <SchematicFaceToken
                      kind="zone_valve"
                      label="CH"
                      x={chX - zvW / 2} y={cy - zvH / 2}
                      width={zvW} height={zvH}
                    />
                    <rect
                      x={chX - zvW / 2} y={cy - zvH / 2} width={zvW} height={zvH} rx={4}
                      fill="none"
                      stroke={isChActive ? '#0891b2' : 'transparent'}
                      strokeWidth={isChActive ? 2 : 1}
                    />
                    <text x={chX} y={cy + zvH / 2 + 10} textAnchor="middle" fontSize={7}
                      fill={isChActive ? '#0891b2' : '#94a3b8'} fontWeight={isChActive ? 700 : 400}>CH</text>
                    {/* HW zone valve schematic face */}
                    <SchematicFaceToken
                      kind="zone_valve"
                      label="HW"
                      x={hwX - zvW / 2} y={cy - zvH / 2}
                      width={zvW} height={zvH}
                    />
                    <rect
                      x={hwX - zvW / 2} y={cy - zvH / 2} width={zvW} height={zvH} rx={4}
                      fill="none"
                      stroke={isHwActive ? '#0891b2' : 'transparent'}
                      strokeWidth={isHwActive ? 2 : 1}
                    />
                    <text x={hwX} y={cy + zvH / 2 + 10} textAnchor="middle" fontSize={7}
                      fill={isHwActive ? '#0891b2' : '#94a3b8'} fontWeight={isHwActive ? 700 : 400}>HW</text>
                  </g>
                )
              }

              // No topology — show flow label and simple CH/HW indicators
              return (
                <g>
                  {srcFlowLine}
                  <text x={cx} y={cy - 3} textAnchor="middle" fontSize={8} fill="#94a3b8">
                    {controlTopologyLabel(topologyKind, isSPlanTopology)}
                  </text>
                  <text x={cx - 30} y={cy + 14} textAnchor="middle" fontSize={9}
                    fill={isChActive ? '#f97316' : '#94a3b8'} fontWeight={isChActive ? 700 : 400}>CH</text>
                  <circle cx={cx} cy={cy + 10} r={4} fill={systemMode === 'idle' ? '#94a3b8' : '#475569'} />
                  <text x={cx + 30} y={cy + 14} textAnchor="middle" fontSize={9}
                    fill={isHwActive ? '#0284c7' : '#94a3b8'} fontWeight={isHwActive ? 700 : 400}>HW</text>
                  <line x1={cx - 4} y1={cy + 10} x2={cx - 22} y2={cy + 10}
                    stroke="#f97316" strokeWidth={2} strokeLinecap="round" opacity={isChActive ? 1 : 0.2} />
                  <line x1={cx + 4} y1={cy + 10} x2={cx + 22} y2={cy + 10}
                    stroke="#0284c7" strokeWidth={2} strokeLinecap="round" opacity={isHwActive ? 1 : 0.2} />
                </g>
              )
            })()}
          </g>
        )}

        {/* ── Pipe to splitter ───────────────────────────────────────────── */}
        {/* Combi: uses the warm-up gradient (blue at HEX exit → warm → hot red at
            splitter) to show that the DHW output ramps from cold mains to hot,
            rather than appearing instantly fully hot.
            Stored/HP: uses plain orange→red gradient (water is already hot in store). */}
        <path
          d={`M ${P.boilerX + 120} ${P.boilerY} L ${P.splitX} ${P.splitY}`}
          stroke={postHexThermalColor
            ? (scene.metadata.sceneLayoutKind === 'combi' ? 'url(#grad-combi-warmup)' : 'url(#grad-dhw-hot)')
            : '#cfd8e3'}
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
        {/* Outlet count from built graph — labels the junction node with the
            actual number of outlets wired in the builder, so the Play schematic
            reflects the custom topology even when not all A/B/C slots are used. */}
        {scene.metadata.outletCount !== undefined && scene.metadata.outletCount > 0 && (
          <text
            x={P.splitX} y={P.splitY - 18}
            textAnchor="middle" fontSize={9} fill="#64748b"
          >
            {scene.metadata.outletCount} outlet{scene.metadata.outletCount !== 1 ? 's' : ''} (built)
          </text>
        )}

        {/* ── Outlet branches ────────────────────────────────────────────── */}
        {/* PR15: when the built graph's outlet count is known, only render outlet
            branches that correspond to real graph outlets.  Extra A/B/C slots that
            are not backed by a graph node are omitted entirely (not just faded),
            so the schematic shows the actual plumbing, not a preset maximum.
            When graphFacts are absent (legacy controls), fall back to all outlets. */}
        {/* ── Outlet branches (hot-fed only) ──────────────────────────────── */}
        {/* PR15: when the built graph's outlet count is known, only render outlet
            branches that correspond to real graph outlets.  Extra A/B/C slots that
            are not backed by a graph node are omitted entirely (not just faded),
            so the schematic shows the actual plumbing, not a preset maximum.
            PR16: cold-only outlets (cold taps) are excluded from this hot branch
            and rendered separately below as cold-service outlets.
            When graphFacts are absent (legacy controls), fall back to all outlets. */}
        {(() => {
          const graphOutletCount = scene.metadata.outletCount
          const visibleOutlets = graphOutletCount !== undefined
            ? controls.outlets.slice(0, Math.max(1, graphOutletCount))
            : controls.outlets

          // Separate hot-fed outlets from cold-only outlets (PR16).
          const hotOutlets    = visibleOutlets.filter(o => !isColdOnlyOutlet(o, controls))
          const coldOnlyOuts  = visibleOutlets.filter(o => isColdOnlyOutlet(o, controls))

          return (
            <>
              {/* ── Hot-service branches ─────────────────────────────────── */}
              {hotOutlets.map(outlet => {
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

                // Colour for this branch: other outlets use postHexThermalColor.
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
                      {outletLabel(outlet.id)} · {OUTLET_KIND_LABELS[outlet.kind]}
                    </text>

                    {/* Cold source kind indicator — shows which cold rail this mixed outlet uses.
                        Particularly important for open-vented systems where CWS cold is used
                        to pressure-match the gravity-fed hot side.                            */}
                    {outlet.coldSourceKind && (
                      <text
                        x={ox + 6} y={oy - 22}
                        textAnchor="start" fontSize={8}
                        fill={coldSourceKindColor(outlet.coldSourceKind)}
                      >
                        cold: {coldSourceKindLabel(outlet.coldSourceKind)}
                      </text>
                    )}

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

              {/* ── Cold-only service endpoints (PR16) ────────────────────── */}
              {/* Cold taps draw from cold supply only — they must NOT appear on the
                  hot branch from the splitter.  Rendered on the cold rail so the
                  viewer can immediately see they are cold-service only.
                  No temperature readout (always at cold-inlet temp).
                  coldSourceKind badge distinguishes mains-fed from CWS-fed cold taps.
                  For vented systems: if any cold tap is mains-fed, a short mains
                  supply indicator is shown so the viewer knows mains cold enters here
                  separately from the CWS gravity rail.                              */}
              {coldOnlyOuts.length > 0 && (() => {
                // For vented systems that have mains-fed cold taps, show a small
                // "Mains supply" indicator since the generic mains cold rail is hidden.
                const hasMainsFedColdTap = coldOnlyOuts.some(o => o.coldSourceKind === 'mains')
                const showVentedMainsIndicator = scene.metadata.showCwsRefill && hasMainsFedColdTap
                return (
                  <g>
                    {/* Mains cold supply indicator for vented systems — only when a mains-fed
                        cold tap is present.  Shown as a short capped pipe with "Mains" label to
                        distinguish it from the CWS gravity drop, since showGenericColdFeed is
                        false for vented systems.                                              */}
                    {showVentedMainsIndicator && (
                      <g>
                        <line
                          x1={P.mainsX} y1={coldRailY}
                          x2={P.mainsX + 30} y2={coldRailY}
                          stroke={coldSupplyColor} strokeWidth={8} strokeLinecap="round"
                          opacity={0.75}
                        />
                        <line
                          x1={P.mainsX} y1={coldRailY}
                          x2={P.mainsX + 30} y2={coldRailY}
                          stroke="#0ea5e9" strokeWidth={2} strokeLinecap="round"
                        />
                        {/* Cap the stub end to indicate a separate supply entry point */}
                        <line
                          x1={P.mainsX} y1={coldRailY - 6}
                          x2={P.mainsX} y2={coldRailY + 6}
                          stroke="#0284c7" strokeWidth={3} strokeLinecap="round"
                        />
                        <text x={P.mainsX - 4} y={coldRailY - 8} fontSize={8} fill="#0369a1" textAnchor="start">
                          Mains cold rail
                        </text>
                      </g>
                    )}
                    {coldOnlyOuts.map((outlet, i) => {
                    // Start cold-tap branches to the right of the emitter box (emitterRightX = 220)
                    // so they never visually land on top of the radiator group.
                    // Spacing: 80 px per tap; first tap at X = 240.
                    const coldBranchX = emitterRightX + 20 + i * 80
                    const coldBranchY = coldRailY + 30            // below the cold rail
                    const isEnabled = outlet.enabled
                    const delivered = summary.outletDeliveredLpm[outlet.id]
                    return (
                      <g key={outlet.id}>
                        {/* Cold supply branch — drop from cold rail to tap terminal */}
                        <line
                          x1={coldBranchX} y1={coldRailY}
                          x2={coldBranchX} y2={coldBranchY}
                          stroke={coldSupplyColor}
                          strokeWidth={10} strokeLinecap="round"
                          opacity={isEnabled ? THERMAL_COLOR_OPACITY : 0.4}
                        />
                        <line
                          x1={coldBranchX} y1={coldRailY}
                          x2={coldBranchX} y2={coldBranchY}
                          stroke={isEnabled ? '#0ea5e9' : '#cbd5e1'}
                          strokeWidth={2} strokeLinecap="round"
                          opacity={isEnabled ? 1 : 0.4}
                        />
                        {/* Cold tap terminal circle */}
                        {isEnabled && (
                          <circle
                            cx={coldBranchX} cy={coldBranchY}
                            r={14}
                            fill={coldSupplyColor}
                            opacity={0.2}
                            style={{ animation: 'outlet-glow 1.6s ease-in-out infinite' }}
                          />
                        )}
                        <circle
                          cx={coldBranchX} cy={coldBranchY}
                          r={9}
                          fill={isEnabled ? '#e0f2fe' : '#f8fafc'}
                          stroke={isEnabled ? '#0284c7' : '#94a3b8'}
                          strokeWidth={isEnabled ? 2 : 1.5}
                        />
                        {/* Cold-only label */}
                        <text
                          x={coldBranchX} y={coldBranchY + 20}
                          textAnchor="middle" fontSize={10}
                          fill={isEnabled ? '#0369a1' : '#94a3b8'} fontWeight={600}
                        >
                          {outletLabel(outlet.id)}
                        </text>
                        <text
                          x={coldBranchX} y={coldBranchY + 32}
                          textAnchor="middle" fontSize={9}
                          fill={isEnabled ? '#0369a1' : '#94a3b8'}
                        >
                          Cold tap
                        </text>
                        {/* Cold source kind badge — shows whether this tap draws from the
                            mains cold rail or the CWS gravity rail.  Displayed on every
                            cold-only outlet so the viewer can immediately see which
                            cold supply rail each tap is connected to.                   */}
                        {outlet.coldSourceKind && (
                          <text
                            x={coldBranchX} y={coldBranchY + 44}
                            textAnchor="middle" fontSize={8}
                            fill={coldSourceKindColor(outlet.coldSourceKind)}
                            fontWeight={600}
                          >
                            {coldSourceKindLabel(outlet.coldSourceKind)}
                          </text>
                        )}
                        {isEnabled && delivered > 0 && (
                          <text
                            x={coldBranchX} y={coldBranchY + 56}
                            textAnchor="middle" fontSize={9} fill="#0284c7"
                          >
                            {delivered.toFixed(1)} L/min
                          </text>
                        )}
                        {!isEnabled && (
                          <text
                            x={coldBranchX} y={coldBranchY + 56}
                            textAnchor="middle" fontSize={9} fill="#94a3b8"
                          >off</text>
                        )}
                      </g>
                    )
                  })}
                  {/* Cold service branch domain label */}
                  <text
                    x={emitterRightX + 20}
                    y={P.mainsY + 48}
                    textAnchor="start" fontSize={8} fill="#0369a1"
                  >
                    Cold service branch
                  </text>
                </g>
              )
            })()}
            </>
          )
        })()}

        {/* ── Emitter / radiator heat-emission indicator ─────────────────── */}
        {/* Rendered whenever the graph contains a heating circuit (PR5: always
            show full topology).  Opacity drops to 0.35 when CH is inactive so the
            structure remains visible but clearly faint while DHW-only or idle.
            When combi service switching is active (CH interrupted by a DHW draw),
            the opacity drops further to 0.15 and a "CH paused for DHW" badge is
            shown so the user can see WHY heating stopped.
            For stored systems (PR16): CH supply path originates from the HEAT SOURCE
            box, not from the cylinder.  This makes the CH circuit clearly separate
            from the DHW domain.
            For combi systems: supply path originates from the combined boiler/HEX box.
            scene.metadata.showHeatingPath gates this whole section.               */}
        {showHeatingPathAndEmitters && (
          <g opacity={serviceSwitchingActive ? 0.15 : isChActive ? 1 : 0.35}>
            {/* CH primary supply pipe.
                Stored systems: from valve bottom → down → left to emitter.
                  Origin: (heatSrcCenterX, storedValveBottomY)
                  Goes: vertical to emitterCenterY, then horizontal left to emitterRightX.
                  The valve is the routing device; CH supply originates from the valve output.
                Combi systems: from combined boiler/HEX box bottom → same routing.
                  Origin: (cylX+20, cylY+cylH)
                The heat source is unambiguously the boiler, not the cylinder/store.
                Colour driven by chBalance.flowTempC when numerical model is active. */}
            {isStoredLayout ? (
              <path
                d={`M ${heatSrcCenterX} ${storedValveBottomY} L ${heatSrcCenterX} ${emitterCenterY} L ${emitterRightX} ${emitterCenterY}`}
                stroke={chFlowColor} strokeWidth={3} fill="none" strokeLinecap="round"
                opacity={0.8}
              />
            ) : (
              <path
                d={`M ${cylX + 20} ${cylY + cylH} L ${cylX + 20} ${emitterCenterY} L ${emitterRightX} ${emitterCenterY}`}
                stroke={chFlowColor} strokeWidth={3} fill="none" strokeLinecap="round"
                opacity={0.8}
              />
            )}
            {/* Arrowhead pointing left into the emitter box — tip at emitterRightX */}
            <polygon
              points={`${emitterRightX + 2},${emitterCenterY - 4} ${emitterRightX + 10},${emitterCenterY} ${emitterRightX + 2},${emitterCenterY + 4}`}
              fill={chFlowColor} opacity={0.8}
            />
            {/* CH supply label — centred on the horizontal run.
                Shows flow temperature and delivered kW when the numerical model is active. */}
            <text
              x={Math.round(((isStoredLayout ? heatSrcCenterX : cylX + 20) + emitterRightX) / 2)}
              y={emitterCenterY - 8}
              textAnchor="middle" fontSize={9} fill="#ea580c"
            >
              {chFlowLabel}
            </text>
            {/* Radiator / emitter box — the CH circuit load.
                SchematicFaceToken renders the same fin-panel face as the builder
                radiator_loop token.  Activity glow and heat-wave overlays sit on top. */}
            {/* Schematic face — same visual as builder radiator_loop token */}
            <SchematicFaceToken
              kind="radiator_loop"
              label="Radiators"
              x={emitterX} y={emitterY} width={emitterW} height={emitterH}
            />
            {/* Activity glow overlay */}
            <rect x={emitterX} y={emitterY} width={emitterW} height={emitterH} rx={5}
              fill="none"
              stroke={isChActive ? '#f97316' : 'transparent'}
              strokeWidth={1.5}
            />
            {/* Status text */}
            <text x={emitterX + emitterW / 2} y={emitterY + emitterH + 11} textAnchor="middle" fontSize={9} fill={isChActive ? '#c2410c' : '#94a3b8'}>
              {isChActive ? 'heating active' : ''}
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

        {/* ── Common return bus — stored systems only ─────────────────────── */}
        {/* Scene grammar: all loads (CH emitters + primary coil) return to a
            common return path back to the heat source.  A faint dashed line
            below the emitter box represents this shared return bus, showing
            the user that all heating returns merge before going back to source.
            Colour driven by chBalance.returnTempC when numerical model is active.
            Keeps the return side visually simple — not pipe-for-pipe.          */}
        {isStoredLayout && showHeatingPathAndEmitters && (
          <g opacity={isChActive || coilActive ? 0.55 : 0.2}>
            {(() => {
              const retY   = emitterY + emitterH + 10
              const retMidX = emitterX + Math.round((heatSrcCenterX - emitterX) / 2)
              return (
                <>
                  <line
                    x1={emitterX} y1={retY}
                    x2={heatSrcCenterX} y2={retY}
                    stroke={chReturnColor} strokeWidth={2} strokeDasharray="5 3" strokeLinecap="round"
                  />
                  <polygon
                    points={`${heatSrcCenterX - 5},${retY - 4} ${heatSrcCenterX + 2},${retY} ${heatSrcCenterX - 5},${retY + 4}`}
                    fill={chReturnColor}
                  />
                  <text
                    x={retMidX} y={retY - 2}
                    textAnchor="middle" fontSize={7} fill={chReturnColor}
                  >
                    {chReturnLabel}
                  </text>
                </>
              )
            })()}
          </g>
        )}

        {/* ── Flow Particles ──────────────────────────────────────────────── */}
        <TokensLayer
          particles={frame.particles}
          coldInletC={effectiveColdInletC}
          polyMain={polyMain}
          polyA={branchA}
          polyB={branchB}
          polyC={branchC}
          polyColdA={coldBypassA}
          extraPolylines={extraBranches}
          hydraulicFlowLpm={summary.hydraulicFlowLpm}
          demandTotalLpm={summary.demandTotalLpm}
          postHexThermalColor={postHexThermalColor}
          hexEnd={isCylinder && isStoredLayout ? STORED_HEX_END : undefined}
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

        {/* ── Source origins legend — PR3 ───────────────────────────────── */}
        {/* Shows which named supply-origin nodes are present for this system type
            so it is clear where cold, hot, and primary water actually come from.
            Driven exclusively by scene.metadata.supplyOrigins — the renderer must
            never infer origin identity from colour or visual position.            */}
        {scene.metadata.supplyOrigins && (() => {
          const origins = scene.metadata.supplyOrigins
          const entries: { color: string; label: string }[] = []
          if (origins.mainsColdIn)        entries.push({ color: '#0284c7', label: 'Mains cold' })
          if (origins.cwsTankCold)        entries.push({ color: '#0891b2', label: 'Tank-fed cold' })
          if (origins.onDemandHot)        entries.push({ color: '#ea580c', label: 'On-demand hot' })
          if (origins.dhwHotStore)        entries.push({ color: '#dc2626', label: 'Stored hot' })
          if (origins.primaryHeatingLoop) entries.push({ color: '#7c3aed', label: 'Primary loop' })
          if (origins.outsideHeatSource)  entries.push({ color: '#0891b2', label: 'Outside (HP)' })
          if (entries.length === 0) return null
          return (
            <g transform="translate(840, 215)">
              <text x={0} y={0} fontSize={8} fill="#64748b" fontWeight={600}>Source origins</text>
              {entries.map(({ color, label }, i) => (
                <g key={label} transform={`translate(0, ${11 + i * 13})`}>
                  <circle cx={9} cy={-3} r={5} fill={color} opacity={0.8} />
                  <text x={18} y={0} fontSize={7.5} fill="#475569">{label}</text>
                </g>
              ))}
            </g>
          )
        })()}
      </svg>

      {/* ── Combi service switching banner ────────────────────────────── */}
      {/* Shown when the combi boiler has diverted its output to the DHW plate
          HEX, temporarily suspending the space-heating call.  The emitter
          group above already fades to near-invisible; this badge provides
          the explicit label so the user knows why heating stopped.         */}
      {serviceSwitchingActive && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'absolute', top: 8, right: 8,
            background: '#fff7ed',
            border: '1px solid #fb923c',
            borderRadius: 8,
            padding: '5px 10px',
            fontSize: 12,
            fontWeight: 700,
            color: '#c2410c',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          CH paused for DHW
        </div>
      )}

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
          coldInletC={effectiveColdInletC}
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
            Cold in: {effectiveColdInletC} °C
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

      {/* ── Draw-off panel — explicit per-outlet state ──────────────────── */}
      {/* Derived via deriveOutletDisplayStates — never inferred ad hoc.
          Shows each outlet's open/closed state, hot/cold/mixed service,
          current flow (L/min), delivered temperature, and concurrency notes. */}
      <DrawOffPanel
        outletStates={deriveOutletDisplayStates(controls, frame)}
        systemMode={frame.systemMode}
        isCylinder={isCylinder}
        serviceSwitchingActive={serviceSwitchingActive}
        combiAtCapacity={combiIsFailing}
      />

      {/* ── Lab controls bar — PR6 ────────────────────────────────────────── */}
      {/* Water supply controls and current-condition switch.
          Compact panels that affect playback directly.
          Kept in a flex row so both panels sit side-by-side on wide screens
          and wrap naturally on narrow viewports.                              */}
      <div className="lab-controls-bar">
        <WaterSupplyPanel
          flowLpm={effectiveControls.mainsDynamicFlowLpm}
          pressureBar={manualPressureBar ?? controls.playbackInputs?.dynamicMainsPressureBar}
          coldInletC={effectiveColdInletC}
          surveyFlowLpm={controls.playbackInputs?.dynamicFlowLpm}
          surveyPressureBar={controls.playbackInputs?.dynamicMainsPressureBar}
          baseFlowLpm={controls.mainsDynamicFlowLpm}
          baseColdInletC={controls.coldInletC}
          manualFlowLpm={manualFlowLpm}
          manualPressureBar={manualPressureBar}
          manualColdInletC={manualColdInletC}
          onFlowChange={lpm => setManualFlowLpm(lpm)}
          onPressureChange={bar => setManualPressureBar(bar)}
          onColdInletChange={c => setManualColdInletC(c)}
          onReset={() => {
            setManualFlowLpm(undefined)
            setManualPressureBar(undefined)
            setManualColdInletC(undefined)
          }}
        />
        <ConditionPanel
          condition={conditionState}
          onChange={setConditionState}
        />
      </div>

      {/* ── Simulation time controls ─────────────────────────────────────── */}
      {/* Speed up, pause, step, and display simulated time / standing loss.
          Physics always stays in real units — only the integration timestep is
          scaled, so all kW and kWh values remain auditable.                  */}
      <div className="sim-time-bar">
        {/* Pause / play toggle */}
        <button
          className={`sim-time-bar__btn${simTimeState.isPaused ? ' sim-time-bar__btn--pause' : ''}`}
          onClick={() => setSimTimeState(s => ({ ...s, isPaused: !s.isPaused }))}
          title={simTimeState.isPaused ? 'Resume simulation' : 'Pause simulation'}
        >
          {simTimeState.isPaused ? '▶ Play' : '⏸ Pause'}
        </button>

        {/* Time-scale selector */}
        <span className="sim-time-bar__label">Speed:</span>
        {TIME_SCALE_OPTIONS.map(scale => (
          <button
            key={scale}
            className={`sim-time-bar__btn${simTimeState.timeScale === scale && !simTimeState.isPaused ? ' sim-time-bar__btn--active' : ''}`}
            onClick={() => setSimTimeState(s => ({ ...s, timeScale: scale, isPaused: false }))}
            title={scale === 1 ? 'Real time' : `1 real second = ${scale} simulated seconds`}
          >
            {scale >= 3600
              ? `${scale / 3600}h/s`
              : scale >= 60
                ? `${scale / 60}m/s`
                : `${scale}×`}
          </button>
        ))}

        {/* Step controls */}
        <span className="sim-time-bar__divider" />
        <button
          className="sim-time-bar__btn"
          onClick={() => handleStep(60)}
          title="Advance simulation by 1 simulated minute"
        >
          +1 min
        </button>
        <button
          className="sim-time-bar__btn"
          onClick={() => handleStep(900)}
          title="Advance simulation by 15 simulated minutes"
        >
          +15 min
        </button>

        {/* Status badges */}
        <span className="sim-time-bar__divider" />
        <span className="sim-time-bar__badge" title="Elapsed simulated time">
          ⏱ {formatSimTime(frame.simTimeSeconds ?? 0)}
        </span>
        <span className="sim-time-bar__badge" title="Current time scale">
          {simTimeState.timeScale}×
        </span>
        {isCylinder && frame.standingLossKwhTotal !== undefined && (
          <span
            className="sim-time-bar__badge sim-time-bar__badge--loss"
            title="Cumulative standing heat loss since simulation start"
          >
            Loss: {frame.standingLossKwhTotal.toFixed(3)} kWh
          </span>
        )}
        {/* System-type badge — tells the user which system is loaded */}
        <span
          className="sim-time-bar__badge sim-time-bar__badge--system"
          title="Current system type"
        >
          {systemTypeLabel(controls.systemType, controls.systemKind)}
        </span>
        {/* Active-service badge — shows current service mode (CH / DHW / Reheat) */}
        <span
          className={`sim-time-bar__badge sim-time-bar__badge--service sim-time-bar__badge--service-${systemMode}`}
          title="Active service mode"
        >
          {serviceModeSummary(systemMode)}
        </span>
        {/* Playback mode badge — tells the user whether they are seeing demo
            defaults or real survey-backed playback. Low-clutter. */}
        <span
          className={`sim-time-bar__badge sim-time-bar__badge--mode${playbackMode === 'survey_backed' ? ' sim-time-bar__badge--mode-survey' : ''}`}
          title={
            playbackMode === 'survey_backed'
              ? `Using survey data${controls.playbackInputs?.currentHeatSourceType ? ` · current: ${controls.playbackInputs.currentHeatSourceType}` : ''}`
              : 'Demo defaults — no survey data loaded'
          }
        >
          {playbackMode === 'survey_backed' ? '📋 Survey data' : '🔵 Demo defaults'}
        </span>
        {/* Water-supply override badge — shown when any supply value is manually set */}
        {hasWaterOverride && (
          <span
            className="sim-time-bar__badge sim-time-bar__badge--override"
            title={[
              manualFlowLpm !== undefined ? `Flow: ${manualFlowLpm} L/min` : null,
              manualPressureBar !== undefined ? `Pressure: ${manualPressureBar} bar` : null,
              manualColdInletC !== undefined ? `Cold inlet: ${manualColdInletC} °C` : null,
            ].filter(Boolean).join(' · ')}
          >
            ✏ Supply override
          </span>
        )}
        {/* Condition badge — shown when circuit condition is not clean */}
        {hasConditionChange && (
          <span
            className="sim-time-bar__badge sim-time-bar__badge--condition"
            title={[
              conditionState.heatingCircuit !== 'clean' ? `CH: ${conditionState.heatingCircuit.replace('_', ' ')}` : null,
              conditionState.hotWaterSide !== 'clean' ? `DHW: ${conditionState.hotWaterSide.replace('_', ' ')}` : null,
            ].filter(Boolean).join(' · ')}
          >
            ⚠ Condition set
          </span>
        )}
        {/* Condensing-state badge (PR7) — shown for boiler-based systems when
            return-temperature data is available from the CH heat balance.
            Green = condensing, amber = borderline, red = not condensing.
            Only visible when emitterLoads are configured (truthful display). */}
        {condensingState !== undefined && (
          <span
            className={`sim-time-bar__badge sim-time-bar__badge--condensing-${
              condensingState === 'condensing' ? 'active'
              : condensingState === 'borderline' ? 'borderline'
              : 'not'
            }`}
            title={condensingStateDescription(condensingState)}
          >
            {condensingStateBadgeText(condensingState)}
          </span>
        )}
      </div>
    </div>
  )
}
