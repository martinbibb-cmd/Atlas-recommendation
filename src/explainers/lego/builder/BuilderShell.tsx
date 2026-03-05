import { useMemo, useState } from 'react'
import type { BuildGraph, BuildNode, PartKind, PortDef, PortRef } from './types'
import PresetPanel from './PresetPanel'
import PalettePanel from './PalettePanel'
import WorkbenchCanvas from './WorkbenchCanvas'
import { portsForKind } from './ports'
import { validateGraph } from './graphValidate'
import { deriveFacts } from './graphDerive'
import { PRESETS } from './presets'
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
  kind === 'tap_outlet' || kind === 'bath_outlet' || kind === 'shower_outlet'

const nextFreeSlot = (bindings: Partial<Record<'A' | 'B' | 'C', string>> | undefined) => {
  const b = bindings ?? {}
  if (!b.A) return 'A'
  if (!b.B) return 'B'
  if (!b.C) return 'C'
  return null
}

export default function BuilderShell({
  initial,
  onControlsPatch,
}: {
  initial?: BuildGraph
  onControlsPatch?: (patch: Record<string, unknown>) => void
}) {
  const [graph, setGraph] = useState<BuildGraph>(initial ?? EMPTY_GRAPH)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pendingPort, setPendingPort] = useState<PortRef | null>(null)

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

  const addNode = (kind: PartKind, at?: { x: number; y: number }) => {
    const node: BuildNode = {
      id: uid('node'),
      kind,
      x: at?.x ?? 520,
      y: at?.y ?? 260,
      r: 0,
    }

    setGraph(current => {
      const nodes = [...current.nodes, node]
      if (!isOutletKind(kind)) {
        return { ...current, nodes }
      }

      const slot = nextFreeSlot(current.outletBindings)
      if (!slot) {
        return { ...current, nodes }
      }

      return {
        ...current,
        nodes,
        outletBindings: { ...(current.outletBindings ?? {}), [slot]: node.id },
      }
    })
    setSelectedId(node.id)
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
        <PalettePanel onPick={addNode} />
      </div>

      <div className="builder-right">
        <div className="builder-toolbar">
          <div className="builder-title">
            🧱 Build your system
            {warnings.length ? <span className="warn-pill">{warnings.length} warnings</span> : null}
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
          pendingPort={pendingPort}
          onSelect={setSelectedId}
          onMove={moveNode}
          onPortTap={onPortTap}
          onCancelPending={cancelPending}
          outletBindings={bindings}
        />
      </div>
    </div>
  )
}
