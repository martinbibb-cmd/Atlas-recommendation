import { useMemo, useState, useCallback, useEffect } from 'react'
import type { BuildGraph, PartKind, PortDef, PortRef } from './types'
import type { LabControls } from '../animation/types'
import PresetPanel from './PresetPanel'
import PalettePanel from './PalettePanel'
import WorkbenchCanvas from './WorkbenchCanvas'
import { LabCanvas } from '../animation/render/LabCanvas'
import { InstrumentStrip } from '../animation/render/InstrumentStrip'
import { computeCapacitySummary } from '../animation/capacitySummary'
import type { LabFrame } from '../animation/types'
import { cylinderTempC } from '../animation/storage'
import { portsForKind } from './ports'
import { validateGraph, type GraphWarning } from './graphValidate'
import { deriveFacts } from './graphDerive'
import { normalizeGraph } from './normalizeGraph'
import { PRESETS, CONCEPT_PRESETS, resolveConceptPreset } from './presets'
import { smartAdd } from './smartAttach'
import { portAbs } from './snapConnect'
import { insertTee } from './tee'
import { graphToLabControls } from './graphToControls'
import {
  type PlayState,
  type OutletDemandState,
  type OutletDemandPreset,
  type HeatingDemandState,
  type SupplyConditions,
  type CwsHeadPreset,
  type OperatingMode,
  CWS_HEAD_METERS,
  PLAY_SCENARIOS,
  PRESETS_FOR_KIND,
  applyPresetToOutlet,
  applyScenario,
  playStateToOutletControls,
  determineOperatingMode,
} from '../state/playState'
import { createDefaultPlayState } from '../state/createDefaultPlayState'
import { resolveSystemTopology, dhwSourceDescription } from '../sim/resolveSystemTopology'
import { buildGraphToLabGraph, compareGraphShape } from '../types/graph'
import './builder.css'

/** The two phases of the lab experience. */
type LabMode = 'build' | 'play'

/** Minimum flow rate (L/min) applied when a previously-off outlet is toggled on
 *  without an active preset, to avoid immediately jumping to 0 L/min. */
const DEFAULT_TOGGLE_FLOW_LPM = 5

/** Default CH flow temperature (°C) shown in Play mode when no explicit value is set. */
const DEFAULT_CH_FLOW_TEMP_C = 70

/** Demand-level values for CH control buttons (off / low / normal / high). */
const CH_DEMAND_LEVEL: Record<'off' | 'low' | 'normal' | 'high', number> = {
  off:    0,
  low:    0.4,
  normal: 0.7,
  high:   1.0,
}

function uid(prefix = 'n') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`
}

const EMPTY_GRAPH: BuildGraph = { nodes: [], edges: [] }


const cloneGraph = (graph: BuildGraph): BuildGraph => ({
  nodes: graph.nodes.map(node => ({ ...node })),
  edges: graph.edges.map(edge => ({
    ...edge,
    from: { ...edge.from },
    to: { ...edge.to },
    meta: edge.meta ? { ...edge.meta } : undefined,
  })),
  outletBindings: graph.outletBindings ? { ...graph.outletBindings } : undefined,
})

const isOutletKind = (kind: PartKind) =>
  kind === 'tap_outlet' || kind === 'bath_outlet' || kind === 'shower_outlet' || kind === 'cold_tap_outlet'


export default function BuilderShell({
  initial,
  onControlsPatch,
}: {
  initial?: BuildGraph
  onControlsPatch?: (patch: Record<string, unknown>) => void
}) {
  // ── Mode state ─────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<LabMode>('build')
  /** Saved snapshot — immutable input for the simulation. Null until first save. */
  const [savedGraph, setSavedGraph] = useState<BuildGraph | null>(null)
  /** Controls patch stored when a preset is loaded; merged into LabControls on play. */
  const [savedControlsPatch, setSavedControlsPatch] = useState<Partial<LabControls>>({})
  /** Whether the left palette panel is visible in build mode. */
  const [paletteOpen, setPaletteOpen] = useState(() => window.innerWidth >= 1200)
  /** Whether the screen is narrow (tablet / mobile) — drives drawer vs pinned behaviour. */
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < 1200)
  /**
   * Interactive play-state — outlet demands controlled by the user.
   * Null before the first time Play mode is entered.
   * Simulation input = savedGraph + playState (not a hard-coded demo scenario).
   */
  const [playState, setPlayState] = useState<PlayState | null>(null)
  /** Live cylinder store temperature (°C) tracked from LabCanvas onFrame. */
  const [playStoreTempC, setPlayStoreTempC] = useState<number | undefined>(undefined)
  /** Live system mode tracked from LabCanvas onFrame. */
  const [playSystemMode, setPlaySystemMode] = useState<LabFrame['systemMode']>(undefined)

  // ── Graph edit state ───────────────────────────────────────────────────────
  const [graph, setGraph] = useState<BuildGraph>(initial ?? EMPTY_GRAPH)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingPort, setPendingPort] = useState<PortRef | null>(null)
  const [warnStripExpanded, setWarnStripExpanded] = useState(false)
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null)
  const [highlightEdgeId, setHighlightEdgeId] = useState<string | null>(null)
  /**
   * Graph warnings captured at the moment Play mode was entered.
   * Shown as a non-blocking banner in Play mode (PR3 — visible debug warning).
   */
  const [playModeGraphErrors, setPlayModeGraphErrors] = useState<import('./graphValidate').GraphWarning[]>([])

  // Track screen width to update the narrow-screen flag
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 1200)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const selected = useMemo(
    () => graph.nodes.find(node => node.id === selectedId) ?? null,
    [graph.nodes, selectedId],
  )

  const normalizedGraph = useMemo(() => normalizeGraph(graph), [graph])
  const warnings = useMemo(() => validateGraph(normalizedGraph), [normalizedGraph])
  const facts = useMemo(() => deriveFacts(graph), [graph])

  /**
   * Authoritative LabGraph for Edit mode.
   * Play mode must consume a deep clone of this — never rebuild from template.
   */
  const editorGraph = useMemo(() => buildGraphToLabGraph(normalizedGraph), [normalizedGraph])

  const getRole = (nodeId: string, portId: string): PortDef['role'] => {
    const node = graph.nodes.find(item => item.id === nodeId)
    if (!node) return 'unknown'
    return portsForKind(node.kind).find(port => port.id === portId)?.role ?? 'unknown'
  }

  const hardBlock = (aRole: PortDef['role'], bRole: PortDef['role']) =>
    (aRole === 'hot' && bRole === 'cold') || (aRole === 'cold' && bRole === 'hot')

  const pickFromPalette = (kind: PartKind) => {
    setGraph(current => {
      const { nextGraph, placedNodeId } = smartAdd(current, kind)
      setSelectedId(placedNodeId)
      return nextGraph
    })
    // Auto-close palette on tablet/mobile after placing a component
    if (isNarrow) {
      setPaletteOpen(false)
    }
  }

  const moveNode = (id: string, x: number, y: number) => {
    setGraph(current => ({
      ...current,
      nodes: current.nodes.map(node => (node.id === id ? { ...node, x, y } : node)),
    }))
  }

  const addEdge = (from: PortRef, to: PortRef) => {
    const exists = graph.edges.some(
      edge =>
        (edge.from.nodeId === from.nodeId &&
          edge.from.portId === from.portId &&
          edge.to.nodeId === to.nodeId &&
          edge.to.portId === to.portId) ||
        (edge.from.nodeId === to.nodeId &&
          edge.from.portId === to.portId &&
          edge.to.nodeId === from.nodeId &&
          edge.to.portId === from.portId),
    )
    if (exists) {
      return
    }

    const roleFrom = getRole(from.nodeId, from.portId)
    const roleTo = getRole(to.nodeId, to.portId)
    if (hardBlock(roleFrom, roleTo)) {
      return
    }

    setGraph(current => ({
      ...current,
      edges: [...current.edges, { id: uid('edge'), from, to, meta: { roleFrom, roleTo } }],
    }))
  }

  /**
   * Called by WorkbenchCanvas when a drag ends within snap distance of a
   * compatible port.  Handles three cases:
   *   1. Duplicate edge — ignored.
   *   2. Target port free — add edge directly.
   *   3. Target port occupied and not multi — insert a tee and rewire.
   *
   * After connecting, nudges the moving node so the two snapped ports align
   * precisely.
   */
  const onAutoConnect = (from: PortRef, to: PortRef) => {
    setGraph(current => {
      // Guard: don't create duplicate edges.
      const duplicate = current.edges.some(
        e =>
          (e.from.nodeId === from.nodeId && e.from.portId === from.portId &&
            e.to.nodeId === to.nodeId && e.to.portId === to.portId) ||
          (e.from.nodeId === to.nodeId && e.from.portId === to.portId &&
            e.to.nodeId === from.nodeId && e.to.portId === from.portId),
      )
      if (duplicate) return current

      const fromNode = current.nodes.find(n => n.id === from.nodeId)
      const toNode = current.nodes.find(n => n.id === to.nodeId)
      if (!fromNode || !toNode) return current

      const fromPortDef = portsForKind(fromNode.kind).find(p => p.id === from.portId)
      const toPortDef = portsForKind(toNode.kind).find(p => p.id === to.portId)
      const roleFrom = fromPortDef?.role ?? 'unknown'
      const roleTo = toPortDef?.role ?? 'unknown'

      // Hard-block hot↔cold
      if (hardBlock(roleFrom, roleTo)) return current

      // Check if target port is already occupied.
      const toOccupied = current.edges.some(
        e =>
          (e.from.nodeId === to.nodeId && e.from.portId === to.portId) ||
          (e.to.nodeId === to.nodeId && e.to.portId === to.portId),
      )
      const toIsMulti = toPortDef?.multi ?? false

      let nextGraph: BuildGraph
      if (!toOccupied || toIsMulti) {
        // Simple case: just add the edge.
        nextGraph = {
          ...current,
          edges: [
            ...current.edges,
            { id: uid('edge'), from, to, meta: { roleFrom, roleTo } },
          ],
        }
      } else {
        // Target port is already taken — insert a tee.
      // Determine the fluid role for tee selection; outlet/store fall back to flow.
      const rawRole = roleTo !== 'unknown' ? roleTo : roleFrom
      const teeRole: 'hot' | 'cold' | 'flow' | 'return' | 'unknown' =
        rawRole === 'hot' || rawRole === 'cold' || rawRole === 'flow' || rawRole === 'return'
          ? rawRole
          : 'unknown'
      nextGraph = insertTee({ graph: current, target: to, incoming: from, role: teeRole })
      }

      // Nudge the moving node so its port aligns exactly with the target port.
      const fromAbs = portAbs(fromNode, from.portId)
      const toAbs = portAbs(toNode, to.portId)
      const shiftX = toAbs.x - fromAbs.x
      const shiftY = toAbs.y - fromAbs.y

      return {
        ...nextGraph,
        nodes: nextGraph.nodes.map(n =>
          n.id === from.nodeId ? { ...n, x: n.x + shiftX, y: n.y + shiftY } : n,
        ),
      }
    })
  }

  const onPortTap = (ref: PortRef) => {
    if (!pendingPort) {
      setPendingPort(ref)
      return
    }

    const a = pendingPort
    const b = ref

    if (a.nodeId === b.nodeId && a.portId === b.portId) {
      setPendingPort(null)
      return
    }

    addEdge(a, b)
    setPendingPort(null)
  }

  const cancelPending = () => setPendingPort(null)

  const clearHighlights = () => {
    setHighlightNodeId(null)
    setHighlightEdgeId(null)
  }

  const onSelectWarning = (warning: GraphWarning) => {
    setHighlightNodeId(warning.nodeId ?? null)
    setHighlightEdgeId(warning.edgeId ?? null)
  }

  const rotateSelected = (deltaDeg: number) => {
    if (!selectedId) {
      return
    }

    setGraph(current => ({
      ...current,
      nodes: current.nodes.map(node =>
        node.id === selectedId ? { ...node, r: (node.r + deltaDeg) % 360 } : node,
      ),
    }))
  }

  const deleteSelected = () => {
    if (!selectedId) {
      return
    }

    setGraph(current => {
      const nextBindings = (Object.entries(current.outletBindings ?? {}) as Array<['A' | 'B' | 'C', string]>).reduce(
        (acc, [slot, nodeId]) => {
          if (nodeId !== selectedId) acc[slot] = nodeId
          return acc
        },
        {} as Partial<Record<'A' | 'B' | 'C', string>>,
      )

      return {
        ...current,
        nodes: current.nodes.filter(node => node.id !== selectedId),
        edges: current.edges.filter(
          edge => edge.from.nodeId !== selectedId && edge.to.nodeId !== selectedId,
        ),
        outletBindings: nextBindings,
      }
    })
    setPendingPort(current => (current?.nodeId === selectedId ? null : current))
    setSelectedId(null)
  }

  const bindings = graph.outletBindings ?? {}
  const selectedIsOutlet = selected ? isOutletKind(selected.kind) : false

  const assignSelectedTo = (slot: 'A' | 'B' | 'C') => {
    if (!selected || !selectedIsOutlet) return
    setGraph(current => ({
      ...current,
      outletBindings: { ...(current.outletBindings ?? {}), [slot]: selected.id },
    }))
  }


  const loadPreset = (presetId: string) => {
    const preset = PRESETS.find(item => item.id === presetId)
    if (!preset) return
    setGraph(cloneGraph(preset.graph))
    setSelectedId(null)
    setPendingPort(null)
    const patch = (preset.controlsPatch ?? {}) as Partial<LabControls>
    setSavedControlsPatch(patch)
    onControlsPatch?.(patch as Record<string, unknown>)
  }

  /**
   * Load a concept-driven preset.
   * Calls `generateGraphFromConcept(concept)` to produce the graph on the fly,
   * then loads it into the builder — replacing any current graph.
   * This is the PR3 topology-driven entry point.
   */
  const loadConceptPreset = (conceptPresetId: string) => {
    const conceptPreset = CONCEPT_PRESETS.find(item => item.id === conceptPresetId)
    if (!conceptPreset) return
    const resolved = resolveConceptPreset(conceptPreset)
    setGraph(cloneGraph(resolved.graph))
    setSelectedId(null)
    setPendingPort(null)
    const patch = (resolved.controlsPatch ?? {}) as Partial<LabControls>
    setSavedControlsPatch(patch)
    onControlsPatch?.(patch as Record<string, unknown>)
  }

  const clearSlot = (slot: 'A' | 'B' | 'C') => {
    setGraph(current => {
      const next = { ...(current.outletBindings ?? {}) }
      delete next[slot]
      return { ...current, outletBindings: next }
    })
  }

  // ── Save / Play actions ────────────────────────────────────────────────────

  /** Snapshot the current graph as the immutable simulation input. */
  const saveDraft = useCallback(() => {
    setSavedGraph(cloneGraph(normalizedGraph))
  }, [normalizedGraph])

  /**
   * Save the current graph and switch to Play mode.
   * Initialises play-state from the saved graph so simulation starts from
   * sensible per-outlet defaults (not hard-coded demo values).
   * Simulation always runs against the snapshot, never the live draft.
   * Any error-level graph warnings are captured and surfaced as a visible
   * banner in Play mode (PR3 — validate graph before entering play).
   *
   * PR1: Play receives a deep clone of the authoritative editorGraph.
   * No template-based graph reconstruction happens here.
   */
  const enterPlay = useCallback(() => {
    // Deep-clone the normalised editor graph — Play must never rebuild topology.
    const snapshot = structuredClone(normalizedGraph)
    const graphErrors = warnings.filter(w => w.level === 'error')
    setPlayModeGraphErrors(graphErrors)
    setSavedGraph(snapshot)
    setPlayState(createDefaultPlayState(snapshot))
    setPlayStoreTempC(undefined)
    setPlaySystemMode(undefined)
    setMode('play')

    // Dev-only parity check: confirm play graph is structurally identical to
    // the editor graph.  Any mismatch here means a second topology source has
    // crept in — fix it before PR1 merges.
    if (import.meta.env.DEV) {
      const playLab = buildGraphToLabGraph(snapshot)
      const parity = compareGraphShape(editorGraph, playLab)
      const allOk =
        parity.nodeCountEqual &&
        parity.edgeCountEqual &&
        parity.sameNodeIds &&
        parity.sameEdgeIds
      if (!allOk) {
        console.warn('[Lab] ⚠ Graph parity FAIL on play entry', parity, {
          editorNodes: editorGraph.nodes.map(n => n.id),
          playNodes: playLab.nodes.map(n => n.id),
          editorEdges: editorGraph.edges.map(e => e.id),
          playEdges: playLab.edges.map(e => e.id),
        })
      } else {
        console.debug('[Lab] ✓ Graph parity OK', {
          nodes: editorGraph.nodes.length,
          edges: editorGraph.edges.length,
        })
      }
    }
  }, [normalizedGraph, warnings, editorGraph])

  // ── Play-mode outlet control callbacks ────────────────────────────────────

  /**
   * Update a single outlet's demand state.
   * Clears `selectedPresetId` so the controls no longer reflect a preset
   * once the user makes a manual change.
   */
  const updatePlayDemand = useCallback(
    (outletId: string, patch: Partial<OutletDemandState>) => {
      setPlayState(current => {
        if (!current) return current
        return {
          ...current,
          demands: current.demands.map(d =>
            d.outletId === outletId ? { ...d, ...patch } : d,
          ),
          selectedPresetId: null,
        }
      })
    },
    [],
  )

  /** Apply a scenario preset — populates all outlet controls, remains editable afterwards. */
  const applyPlayScenario = useCallback((scenarioId: string) => {
    setPlayState(current => (current ? applyScenario(current, scenarioId) : current))
  }, [])

  /** Apply a quick preset to a single outlet. */
  const applyOutletPreset = useCallback(
    (outletId: string, preset: OutletDemandPreset) => {
      setPlayState(current => {
        if (!current) return current
        return {
          ...current,
          demands: current.demands.map(d =>
            d.outletId === outletId ? applyPresetToOutlet(d, preset) : d,
          ),
          selectedPresetId: null,
        }
      })
    },
    [],
  )

  /** Update the central-heating demand state. Clears selectedPresetId. */
  const updateHeatingDemand = useCallback((patch: Partial<HeatingDemandState>) => {
    setPlayState(current => {
      if (!current) return current
      return {
        ...current,
        heating: { ...current.heating, ...patch },
        selectedPresetId: null,
      }
    })
  }, [])

  /** Update supply conditions (mains flow, CWS head, inlet temp). Clears selectedPresetId. */
  const updateSupplyConditions = useCallback((patch: Partial<SupplyConditions>) => {
    setPlayState(current => {
      if (!current) return current
      // Also keep inletTempC in sync at the top level
      const next: PlayState = {
        ...current,
        supplyConditions: { ...current.supplyConditions, ...patch },
        selectedPresetId: null,
      }
      if (patch.inletTempC !== undefined) next.inletTempC = patch.inletTempC
      return next
    })
  }, [])

  // ── Play-mode derived values ───────────────────────────────────────────────

  const playControls = useMemo(() => {
    if (!savedGraph) return null
    const outletControls = playState
      ? playStateToOutletControls(playState.demands)
      : undefined
    const supply = playState?.supplyConditions
    const coldInletRaw = supply?.inletTempC ?? playState?.inletTempC ?? 10
    const coldInletC: 5 | 10 | 15 =
      coldInletRaw <= 7 ? 5 : coldInletRaw <= 12 ? 10 : 15

    // Resolve head meters from the CWS head preset for vented systems.
    const cwsHeadPreset = supply?.cwsHeadPreset
    const ventedOverride = cwsHeadPreset
      ? { vented: { headMeters: CWS_HEAD_METERS[cwsHeadPreset] } }
      : {}

    // For mains-fed systems, allow play-state to override the dynamic flow rate.
    const mainsDynamicFlowLpm = supply?.mainsDynamicFlowLpm
    const mainsOverride = mainsDynamicFlowLpm !== undefined
      ? { mainsDynamicFlowLpm }
      : {}

    return graphToLabControls(savedGraph, {
      ...savedControlsPatch,
      ...(outletControls ? { outlets: outletControls } : {}),
      coldInletC,
      dhwSetpointC: playState?.hotSupplyTargetC ?? 50,
      ...(playState?.heating ? { heatingDemand: playState.heating } : {}),
      ...ventedOverride,
      ...mainsOverride,
    })
  }, [savedGraph, savedControlsPatch, playState])

  const playSummary = useMemo(
    () => (playControls ? computeCapacitySummary(playControls) : null),
    [playControls],
  )

  /** Resolved topology from the saved graph — drives topology-aware UI. */
  const playTopology = useMemo(
    () => (savedGraph ? resolveSystemTopology(savedGraph) : null),
    [savedGraph],
  )

  /** Callback from LabCanvas to track live cylinder store temperature and system mode. */
  const handleFrame = useCallback((frame: LabFrame) => {
    if (frame.cylinderStore && playControls) {
      setPlayStoreTempC(cylinderTempC({ store: frame.cylinderStore, coldInletC: playControls.coldInletC }))
    }
    if (frame.systemMode !== undefined) {
      setPlaySystemMode(frame.systemMode)
    }
  }, [playControls])

  // ── Play mode render ───────────────────────────────────────────────────────

  if (mode === 'play') {
    // Resolve the correct SystemType to pass to determineOperatingMode.
    // This must reflect the actual graph topology so vented vs unvented vs combi
    // are all handled correctly.
    const playSystemType = playControls?.systemType ?? 'combi'

    return (
      <div className="builder-wrap builder-wrap--play">
        <div className="play-topbar">
          <button className="builder-btn" onClick={() => setMode('build')}>← Edit</button>
          <span className="play-mode-label">▶ Play mode</span>
          <span className="play-mode-hint">
            {playTopology
              ? dhwSourceDescription(playTopology)
              : 'No saved graph — go back to Build and save first'}
          </span>
        </div>

        {/* PR3 — visible graph-error banner in Play mode (dev feedback for bad topology) */}
        {playModeGraphErrors.length > 0 && (
          <div className="play-graph-error-banner" role="alert">
            <span className="play-graph-error-icon">⚠</span>
            <span className="play-graph-error-text">
              Graph has {playModeGraphErrors.length} error{playModeGraphErrors.length !== 1 ? 's' : ''}:{' '}
              {playModeGraphErrors.map(e => e.title).join(' · ')}
            </span>
            <button
              className="builder-btn play-graph-error-dismiss"
              onClick={() => setPlayModeGraphErrors([])}
              aria-label="Dismiss graph errors"
            >
              ✕
            </button>
          </div>
        )}

        {playControls && playSummary && playState ? (
          <div className="play-layout">
            {/* ── Canvas column ──────────────────────────────────────────── */}
            <div className="play-canvas-col">
              <div className="demo-lab-canvas">
                <LabCanvas
                  controls={playControls}
                  summary={playSummary}
                  onFrame={handleFrame}
                />
              </div>
            </div>

            {/* ── Controls column ────────────────────────────────────────── */}
            <div className="play-controls-col">

              {/* Scenario presets */}
              <div className="play-section">
                <div className="play-section-title">Quick scenarios</div>
                <div className="play-scenario-grid">
                  {PLAY_SCENARIOS.map(scenario => (
                    <button
                      key={scenario.id}
                      className={`play-scenario-btn${playState.selectedPresetId === scenario.id ? ' play-scenario-btn--active' : ''}`}
                      onClick={() => applyPlayScenario(scenario.id)}
                    >
                      {scenario.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Central-heating demand */}
              <div className="play-section">
                <div className="play-section-title">Heating demand</div>
                <div className="play-heating-controls">
                  <div className="play-heating-row">
                    {(['off', 'low', 'normal', 'high'] as const).map(level => {
                      const isOff = level === 'off'
                      const active = isOff
                        ? !playState.heating.enabled
                        : playState.heating.enabled && playState.heating.demandLevel === CH_DEMAND_LEVEL[level]
                      return (
                        <button
                          key={level}
                          className={`play-preset-btn${active ? ' play-preset-btn--active' : ''}`}
                          onClick={() => updateHeatingDemand(
                            isOff
                              ? { enabled: false }
                              : { enabled: true, demandLevel: CH_DEMAND_LEVEL[level] },
                          )}
                        >
                          {level}
                        </button>
                      )
                    })}
                  </div>
                  {playState.heating.enabled && (
                    <div className="play-outlet-flow">
                      Flow temp: {playState.heating.targetFlowTempC ?? DEFAULT_CH_FLOW_TEMP_C} °C
                    </div>
                  )}
                </div>
              </div>

              {/* Per-outlet controls */}
              <div className="play-section">
                <div className="play-section-title">Outlets</div>
                <div className="play-outlet-list">
                  {playState.demands.map(demand => {
                    const presets = PRESETS_FOR_KIND[demand.kind]
                    return (
                      <div key={demand.outletId} className={`play-outlet-card${demand.enabled ? ' play-outlet-card--active' : ''}`}>
                        <div className="play-outlet-header">
                          <span className="play-outlet-label">{demand.label}</span>
                          <button
                            className={`play-outlet-toggle${demand.enabled ? ' play-outlet-toggle--on' : ''}`}
                            onClick={() => updatePlayDemand(demand.outletId, {
                              enabled: !demand.enabled,
                              targetFlowLpm: demand.enabled ? 0 : (demand.targetFlowLpm || DEFAULT_TOGGLE_FLOW_LPM),
                              preset: demand.enabled ? 'off' : (demand.preset === 'off' ? undefined : demand.preset),
                            })}
                            aria-pressed={demand.enabled}
                          >
                            {demand.enabled ? 'On' : 'Off'}
                          </button>
                        </div>
                        <div className="play-outlet-presets">
                          {presets.map(preset => (
                            <button
                              key={preset}
                              className={`play-preset-btn${demand.preset === preset ? ' play-preset-btn--active' : ''}`}
                              onClick={() => applyOutletPreset(demand.outletId, preset)}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>
                        {demand.enabled && (
                          <div className="play-outlet-flow">
                            {demand.targetFlowLpm.toFixed(1)} L/min
                            {demand.targetTempC !== undefined ? ` @ ${demand.targetTempC}°C` : ''}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Result summary */}
              <div className="play-section">
                <div className="play-section-title">Result</div>
                <InstrumentStrip
                  summary={playSummary}
                  storeTempC={playStoreTempC}
                  combiDhwKw={playControls.systemType === 'combi' ? playControls.combiDhwKw : undefined}
                />
              </div>

              {/* Operating mode */}
              <div className="play-section">
                <div className="play-section-title">Operating mode</div>
                <OperatingModePanel
                  systemMode={playSystemMode}
                  operatingMode={determineOperatingMode(playState, playSystemType, playTopology?.controlTopology)}
                />
              </div>

              {/* Supply conditions — topology-aware controls */}
              <div className="play-section">
                <div className="play-section-title">Supply conditions</div>
                <SupplyConditionsPanel
                  supplyConditions={playState.supplyConditions}
                  systemType={playSystemType}
                  onChange={updateSupplyConditions}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="play-empty">
            <p className="play-empty__text">
              No graph saved yet. Go back to Build mode, wire up your system, then press{' '}
              <strong>Save</strong> or <strong>Play</strong>.
            </p>
            <button className="builder-btn" onClick={() => setMode('build')}>← Back to Build</button>
          </div>
        )}
      </div>
    )
  }

  // ── Build mode render ──────────────────────────────────────────────────────

  return (
    <div
      className={`builder-wrap${paletteOpen ? '' : ' palette-collapsed'}`}
      style={{
        position: 'relative',
        gridTemplateColumns: paletteOpen ? '320px 1fr' : '1fr',
      }}
    >
      {/* Backdrop — only rendered/visible on narrow screens while palette is open */}
      {paletteOpen && isNarrow && (
        <div
          className="palette-backdrop"
          onClick={() => setPaletteOpen(false)}
          aria-hidden="true"
        />
      )}

      {paletteOpen && (
        <div className="builder-left">
          <PresetPanel onLoad={loadPreset} onLoadConcept={loadConceptPreset} />
          <PalettePanel onPick={pickFromPalette} />
        </div>
      )}

      <div className="builder-right">
        {/* ── Mode bar ──────────────────────────────────────────────────── */}
        <div className="builder-mode-bar">
          <span className="builder-mode-label">🧱 Build</span>
          <div className="builder-mode-bar__spacer" />
          <button
            className="builder-btn"
            onClick={saveDraft}
            title="Save current graph as simulation snapshot"
          >
            💾 Save
          </button>
          <button
            className="builder-btn builder-btn--play"
            onClick={enterPlay}
            title="Save and switch to Play mode"
          >
            ▶ Play
          </button>
          <button
            className="toolbox-btn"
            onClick={() => setPaletteOpen(v => !v)}
            title={paletteOpen ? 'Hide toolbox' : 'Open toolbox'}
            aria-label={paletteOpen ? 'Hide toolbox' : 'Open toolbox'}
          >
            🧰 {paletteOpen ? 'Close' : 'Toolbox'}
          </button>
        </div>

        <div className="builder-canvas-area">
          <div className="builder-toolbar">
          <div className="builder-title">
            Build your system
            {pendingPort ? <span className="connect-pill">Connecting… tap another port</span> : null}
          </div>

          <div className="builder-actions">
            <span className="builder-facts">
              {facts.hasCombiDhw ? 'DHW: on-demand · ' : ''}
              HEX-fed: {facts.hotFedOutletNodeIds.length} · Cold-only: {facts.coldOnlyOutletNodeIds.length}
            </span>
            {pendingPort ? (
              <button className="builder-btn" onClick={cancelPending} title="Cancel connecting">
                ✕ Cancel
              </button>
            ) : null}
            <button
              className="builder-btn"
              disabled={!selected}
              onClick={() => rotateSelected(90)}
              title="Rotate 90°"
            >
              ↻ Rotate
            </button>
            <button
              className="builder-btn danger"
              disabled={!selected}
              onClick={deleteSelected}
              title="Delete selected"
            >
              🗑️ Delete
            </button>
            {(highlightEdgeId || highlightNodeId) && (
              <button className="builder-btn" onClick={clearHighlights}>
                Clear highlight
              </button>
            )}
          </div>

          <div className="bindings">
            <div className="bindings-title">Outlet bindings</div>
            {(['A', 'B', 'C'] as const).map(slot => (
              <div className="bind-row" key={slot}>
                <div className="bind-slot">Outlet {slot}</div>
                <div className="bind-val">{bindings[slot] ? `${bindings[slot]!.slice(0, 10)}…` : '—'}</div>

                <button
                  className="bind-btn"
                  disabled={!selectedIsOutlet}
                  onClick={() => assignSelectedTo(slot)}
                  title={selectedIsOutlet ? 'Assign selected outlet node' : 'Select an outlet node first'}
                >
                  Assign
                </button>

                <button
                  className="bind-btn danger"
                  disabled={!bindings[slot]}
                  onClick={() => clearSlot(slot)}
                  title="Clear binding"
                >
                  Clear
                </button>
              </div>
            ))}
          </div>
        </div>

        <WorkbenchCanvas
          graph={graph}
          selectedId={selectedId}
          highlightNodeId={highlightNodeId}
          highlightEdgeId={highlightEdgeId}
          pendingPort={pendingPort}
          onSelect={setSelectedId}
          onMove={moveNode}
          onPortTap={onPortTap}
          onCancelPending={cancelPending}
          onAutoConnect={onAutoConnect}
          outletBindings={bindings}
        />

        {/* ── Warning strip — non-blocking bottom bar ────────────────── */}
        {warnings.length > 0 && (
          <div className={`warn-strip${warnStripExpanded ? ' warn-strip--expanded' : ''}`}>
            <div
              className="warn-strip-bar"
              onClick={() => setWarnStripExpanded(v => !v)}
              role="button"
              aria-expanded={warnStripExpanded}
            >
              <span className="warn-strip-count">⚠ {warnings.length} warning{warnings.length !== 1 ? 's' : ''}</span>
              <span className="warn-strip-toggle">{warnStripExpanded ? '▲ collapse' : '▼ expand'}</span>
            </div>
            {warnStripExpanded && (
              <div className="warn-strip-list">
                {warnings.map((w, i) => (
                  <button
                    key={i}
                    className={`warn-strip-item${w.level === 'error' ? ' error' : ''}`}
                    onClick={() => { onSelectWarning(w); setWarnStripExpanded(false) }}
                  >
                    {w.level === 'error' ? '✖' : '⚠'} {w.title}: {w.message}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

// ─── Operating mode panel ──────────────────────────────────────────────────────

const SYSTEM_MODE_LABELS: Record<NonNullable<LabFrame['systemMode']>, string> = {
  idle:                'Idle — no demand',
  heating:             'Heating circulation active',
  dhw_draw:            'On-demand hot water active',
  dhw_reheat:          'Cylinder reheat active',
  heating_and_reheat:  'Heating + cylinder reheat (S-plan)',
}

const OPERATING_MODE_LABELS: Record<OperatingMode, string> = {
  IDLE:            'Idle',
  CH_ONLY:         'Heating only',
  DHW_ONLY:        'On-demand hot water only',
  CH_AND_DHW:      'Heating and hot water',
  CYLINDER_REHEAT: 'Cylinder reheat',
}

function OperatingModePanel({
  systemMode,
  operatingMode,
}: {
  systemMode: LabFrame['systemMode']
  operatingMode: OperatingMode
}) {
  return (
    <div className="play-operating-mode">
      <div className="play-operating-mode__expected">
        <span className="play-operating-mode__label">Expected:</span>
        <span className="play-operating-mode__value">{OPERATING_MODE_LABELS[operatingMode]}</span>
      </div>
      {systemMode !== undefined && (
        <div className="play-operating-mode__live">
          <span className="play-operating-mode__label">Live:</span>
          <span className="play-operating-mode__value">{SYSTEM_MODE_LABELS[systemMode]}</span>
        </div>
      )}
    </div>
  )
}

// ─── Supply conditions panel ───────────────────────────────────────────────────

const CWS_HEAD_PRESET_LABELS: Record<CwsHeadPreset, string> = {
  poor:    'Poor  (1.5 m)',
  typical: 'Typical (3 m)',
  good:    'Good  (5 m)',
}

function SupplyConditionsPanel({
  supplyConditions,
  systemType,
  onChange,
}: {
  supplyConditions: SupplyConditions
  systemType: string
  onChange: (patch: Partial<SupplyConditions>) => void
}) {
  const isVented = systemType === 'vented_cylinder'

  return (
    <div className="play-supply-conditions">
      {/* Cold inlet temperature — applies to all system types */}
      <div className="play-supply-row">
        <label className="play-supply-label">Cold inlet temp</label>
        <div className="play-supply-btns">
          {([5, 10, 15] as const).map(t => (
            <button
              key={t}
              className={`play-preset-btn${supplyConditions.inletTempC === t ? ' play-preset-btn--active' : ''}`}
              onClick={() => onChange({ inletTempC: t })}
            >
              {t} °C
            </button>
          ))}
        </div>
      </div>

      {/* Vented: CWS head preset */}
      {isVented && (
        <div className="play-supply-row">
          <label className="play-supply-label">Tank-fed head</label>
          <div className="play-supply-btns">
            {(['poor', 'typical', 'good'] as CwsHeadPreset[]).map(preset => (
              <button
                key={preset}
                className={`play-preset-btn${supplyConditions.cwsHeadPreset === preset ? ' play-preset-btn--active' : ''}`}
                onClick={() => onChange({ cwsHeadPreset: preset })}
              >
                {CWS_HEAD_PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
          {supplyConditions.cwsHeadPreset && (
            <div className="play-outlet-flow">
              Head: {CWS_HEAD_METERS[supplyConditions.cwsHeadPreset].toFixed(1)} m
            </div>
          )}
        </div>
      )}

      {/* Mains-fed: dynamic flow rate */}
      {!isVented && (
        <div className="play-supply-row">
          <label className="play-supply-label">Mains flow</label>
          <div className="play-supply-btns">
            {([8, 14, 20] as const).map(lpm => (
              <button
                key={lpm}
                className={`play-preset-btn${supplyConditions.mainsDynamicFlowLpm === lpm ? ' play-preset-btn--active' : ''}`}
                onClick={() => onChange({ mainsDynamicFlowLpm: lpm })}
              >
                {lpm} L/min
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
