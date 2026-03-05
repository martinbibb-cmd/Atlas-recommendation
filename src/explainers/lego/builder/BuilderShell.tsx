import { useMemo, useState } from 'react';
import type { BuildGraph, BuildNode, PartKind, PortRef } from './types';
import PalettePanel from './PalettePanel';
import WorkbenchCanvas from './WorkbenchCanvas';
import './builder.css';

function uid(prefix = 'n') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

const EMPTY_GRAPH: BuildGraph = { nodes: [], edges: [] };

export default function BuilderShell({ initial }: { initial?: BuildGraph }) {
  const [graph, setGraph] = useState<BuildGraph>(initial ?? EMPTY_GRAPH);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingPort, setPendingPort] = useState<PortRef | null>(null);

  const selected = useMemo(
    () => graph.nodes.find(node => node.id === selectedId) ?? null,
    [graph.nodes, selectedId],
  );

  const addNode = (kind: PartKind, at?: { x: number; y: number }) => {
    const node: BuildNode = {
      id: uid('node'),
      kind,
      x: at?.x ?? 520,
      y: at?.y ?? 260,
      r: 0,
    };

    setGraph(current => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedId(node.id);
  };

  const moveNode = (id: string, x: number, y: number) => {
    setGraph(current => ({
      ...current,
      nodes: current.nodes.map(node => (node.id === id ? { ...node, x, y } : node)),
    }));
  };

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
    );
    if (exists) {
      return;
    }

    setGraph(current => ({
      ...current,
      edges: [...current.edges, { id: uid('edge'), from, to }],
    }));
  };

  const onPortTap = (ref: PortRef) => {
    if (!pendingPort) {
      setPendingPort(ref);
      return;
    }

    const a = pendingPort;
    const b = ref;

    if (a.nodeId === b.nodeId && a.portId === b.portId) {
      setPendingPort(null);
      return;
    }

    addEdge(a, b);
    setPendingPort(null);
  };

  const cancelPending = () => setPendingPort(null);

  const rotateSelected = (deltaDeg: number) => {
    if (!selectedId) {
      return;
    }

    setGraph(current => ({
      ...current,
      nodes: current.nodes.map(node =>
        node.id === selectedId ? { ...node, r: (node.r + deltaDeg) % 360 } : node,
      ),
    }));
  };

  const deleteSelected = () => {
    if (!selectedId) {
      return;
    }

    setGraph(current => ({
      ...current,
      nodes: current.nodes.filter(node => node.id !== selectedId),
      edges: current.edges.filter(
        edge => edge.from.nodeId !== selectedId && edge.to.nodeId !== selectedId,
      ),
    }));
    setPendingPort(current => (current?.nodeId === selectedId ? null : current));
    setSelectedId(null);
  };

  return (
    <div className="builder-wrap">
      <div className="builder-left">
        <PalettePanel onPick={addNode} />
      </div>

      <div className="builder-right">
        <div className="builder-toolbar">
          <div className="builder-title">
            🧱 Build your system
            {pendingPort ? <span className="connect-pill">Connecting… tap another port</span> : null}
          </div>

          <div className="builder-actions">
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
        </div>

        <WorkbenchCanvas
          graph={graph}
          selectedId={selectedId}
          pendingPort={pendingPort}
          onSelect={setSelectedId}
          onMove={moveNode}
          onPortTap={onPortTap}
          onCancelPending={cancelPending}
        />
      </div>
    </div>
  );
}
