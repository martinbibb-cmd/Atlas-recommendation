import { useMemo, useState, useCallback } from 'react'
import type { BuildGraph, PartKind, PortDef, PortRef } from './types'
import type { LabControls } from '../animation/types'
import PresetPanel from './PresetPanel'
import PalettePanel from './PalettePanel'
import WorkbenchCanvas from './WorkbenchCanvas'
import WarningPanel from './WarningPanel'
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
  PLAY_SCENARIOS,
  PRESETS_FOR_KIND,
  applyPresetToOutlet,
  applyScenario,
  playStateToOutletControls,
} from '../state/playState'
import { createDefaultPlayState } from '../state/createDefaultPlayState'
import './builder.css'

/** The two phases of the lab experience. */
type LabMode = 'build' | 'play'

/** Minimum flow rate (L/min) applied when a previously-off outlet is toggled on
 *  without an active preset, to avoid immediately jumping to 0 L/min. */
const DEFAULT_TOGGLE_FLOW_LPM = 5

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
  const [paletteOpen, setPaletteOpen] = useState(true)
  /**
   * Interactive play-state — outlet demands controlled by the user.
   * Null before the first time Play mode is entered.
   * Simulation input = savedGraph + playState (not a hard-coded demo scenario).
   */
  const [playState, setPlayState] = useState<PlayState | null>(null)
  /** Live cylinder store temperature (°C) tracked from LabCanvas onFrame. */
  const [playStoreTempC, setPlayStoreTempC] = useState<number | undefined>(undefined)

  // ── Graph edit state ───────────────────────────────────────────────────────
  const [graph, setGraph] = useState<BuildGraph>(initial ?? EMPTY_GRAPH)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingPort, setPendingPort] = useState<PortRef | null>(null)
  const [showWarnings, setShowWarnings] = useState(false)
  const [highlightNodeId, setHighlightNodeId] = useState<string | null>(null)
  const [highlightEdgeId, setHighlightEdgeId] = useState<string | null>(null)

  const selected = useMemo(
    () => graph.nodes.find(node => node.id === selectedId) ?? null,
    [graph.nodes, selectedId],
  )

  const normalizedGraph = useMemo(() => normalizeGraph(graph), [graph])
  const warnings = useMemo(() => validateGraph(normalizedGraph), [normalizedGraph])
  const facts = useMemo(() => deriveFacts(graph), [graph])

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
   */
  const enterPlay = useCallback(() => {
    const snapshot = cloneGraph(normalizedGraph)
    setSavedGraph(snapshot)
    setPlayState(createDefaultPlayState(snapshot))
    setPlayStoreTempC(undefined)
    setMode('play')
  }, [normalizedGraph])

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

  // ── Play-mode derived values ───────────────────────────────────────────────

  const playControls = useMemo(() => {
    if (!savedGraph) return null
    const outletControls = playState
      ? playStateToOutletControls(playState.demands)
      : undefined
    const coldInletRaw = playState?.inletTempC ?? 10
    const coldInletC: 5 | 10 | 15 =
      coldInletRaw <= 7 ? 5 : coldInletRaw <= 12 ? 10 : 15
    return graphToLabControls(savedGraph, {
      ...savedControlsPatch,
      ...(outletControls ? { outlets: outletControls } : {}),
      coldInletC,
      dhwSetpointC: playState?.hotSupplyTargetC ?? 50,
    })
  }, [savedGraph, savedControlsPatch, playState])

  const playSummary = useMemo(
    () => (playControls ? computeCapacitySummary(playControls) : null),
    [playControls],
  )

  /** Callback from LabCanvas to track live cylinder store temperature. */
  const handleFrame = useCallback((frame: LabFrame) => {
    if (frame.cylinderStore && playControls) {
      setPlayStoreTempC(cylinderTempC({ store: frame.cylinderStore, coldInletC: playControls.coldInletC }))
    }
  }, [playControls])

  // ── Play mode render ───────────────────────────────────────────────────────

  if (mode === 'play') {
    return (
      <div className="builder-wrap builder-wrap--play">
        <div className="play-topbar">
          <button className="builder-btn" onClick={() => setMode('build')}>← Edit</button>
          <span className="play-mode-label">▶ Play mode</span>
          <span className="play-mode-hint">
            {playControls
              ? `Simulating saved graph — ${playControls.systemType.replace(/_/g, ' ')}`
              : 'No saved graph — go back to Build and save first'}
          </span>
        </div>

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
    <div className={`builder-wrap${paletteOpen ? '' : ' palette-collapsed'}`}>
      {paletteOpen && (
        <div className="builder-left">
          <PresetPanel onLoad={loadPreset} onLoadConcept={loadConceptPreset} />
          <PalettePanel onPick={pickFromPalette} />
        </div>
      )}

      <div className="builder-right">
        {/* ── Mode bar ──────────────────────────────────────────────────── */}
        <div className="builder-mode-bar">
          <button
            className="palette-toggle-btn"
            onClick={() => setPaletteOpen(v => !v)}
            title={paletteOpen ? 'Hide palette' : 'Show palette'}
            aria-label={paletteOpen ? 'Hide palette' : 'Show palette'}
          >
            {paletteOpen ? '✕' : '☰'}
          </button>
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
        </div>

        <div className="builder-canvas-area">
          <div className="builder-toolbar">
          <div className="builder-title">
            Build your system
            {warnings.length ? (
              <button className="warn-pill" onClick={() => setShowWarnings(current => !current)}>
                {warnings.length} warnings
              </button>
            ) : null}
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
        </div>
        {showWarnings ? (
          <WarningPanel
            warnings={warnings}
            onSelectWarning={onSelectWarning}
            onClose={() => setShowWarnings(false)}
          />
        ) : null}
      </div>
    </div>
  )
}
