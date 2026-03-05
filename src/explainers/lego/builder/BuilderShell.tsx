import { useMemo, useState } from 'react'
import type { BuildGraph, PartKind, PortDef, PortRef } from './types'
import PresetPanel from './PresetPanel'
import PalettePanel from './PalettePanel'
import WorkbenchCanvas from './WorkbenchCanvas'
import WarningPanel from './WarningPanel'
import { portsForKind } from './ports'
import { validateGraph, type GraphWarning } from './graphValidate'
import { deriveFacts } from './graphDerive'
import { PRESETS } from './presets'
import { smartAdd } from './smartAttach'
import { portAbs } from './snapConnect'
import { insertTee } from './tee'
import './builder.css'

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
  onRun,
}: {
  initial?: BuildGraph
  onControlsPatch?: (patch: Record<string, unknown>) => void
  onRun?: (graph: BuildGraph) => void
}) {
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

  const warnings = useMemo(() => validateGraph(graph), [graph])
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
    onControlsPatch?.((preset.controlsPatch ?? {}) as Record<string, unknown>)
  }

  const clearSlot = (slot: 'A' | 'B' | 'C') => {
    setGraph(current => {
      const next = { ...(current.outletBindings ?? {}) }
      delete next[slot]
      return { ...current, outletBindings: next }
    })
  }

  return (
    <div className="builder-wrap">
      <div className="builder-left">
        <PresetPanel onLoad={loadPreset} />
        <PalettePanel onPick={pickFromPalette} />
      </div>

      <div className="builder-right">
        <div className="builder-toolbar">
          <div className="builder-title">
            🧱 Build your system
            {warnings.length ? (
              <button className="warn-pill" onClick={() => setShowWarnings(current => !current)}>
                {warnings.length} warnings
              </button>
            ) : null}
            {pendingPort ? <span className="connect-pill">Connecting… tap another port</span> : null}
          </div>

          <div className="builder-actions">
            <span className="builder-facts">
              HEX-fed: {facts.hotFedOutletNodeIds.length} · Cold-only: {facts.coldOnlyOutletNodeIds.length}
            </span>
            {pendingPort ? (
              <button className="builder-btn" onClick={cancelPending} title="Cancel connecting">
                ✕ Cancel
              </button>
            ) : null}
            <button className="builder-btn" onClick={() => onRun?.(cloneGraph(graph))}>
              ▶ Run system
            </button>
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
                  title={selectedIsOutlet ? 'Assign selected outlet token' : 'Select an outlet token first'}
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
