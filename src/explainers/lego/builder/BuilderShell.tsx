import { useMemo, useState } from 'react';
import type { BuildGraph, BuildNode, PartKind } from './types';
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
      edges: current.edges.filter(edge => edge.fromNodeId !== selectedId && edge.toNodeId !== selectedId),
    }));
    setSelectedId(null);
  };

  return (
    <div className="builder-wrap">
      <div className="builder-left">
        <PalettePanel onPick={addNode} />
      </div>

      <div className="builder-right">
        <div className="builder-toolbar">
          <div className="builder-title">🧱 Build your system</div>

          <div className="builder-actions">
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
          onSelect={setSelectedId}
          onMove={moveNode}
        />
      </div>
    </div>
  );
}
