import { useMemo, useState } from 'react';
import type { BuildGraph, BuildNode, PartKind } from './types';
import PalettePanel from './PalettePanel';
import WorkbenchCanvas from './WorkbenchCanvas';
import './builder.css';

let _nodeCounter = 0;
function uid(prefix = 'node') {
  _nodeCounter += 1;
  return `${prefix}_${_nodeCounter}_${Date.now().toString(16)}`;
}

const EMPTY_GRAPH: BuildGraph = { nodes: [], edges: [] };

export default function BuilderShell({ initial }: { initial?: BuildGraph }) {
  const [graph, setGraph] = useState<BuildGraph>(initial ?? EMPTY_GRAPH);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(
    () => graph.nodes.find(n => n.id === selectedId) ?? null,
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
    setGraph(g => ({ ...g, nodes: [...g.nodes, node] }));
    setSelectedId(node.id);
  };

  const moveNode = (id: string, x: number, y: number) => {
    setGraph(g => ({
      ...g,
      nodes: g.nodes.map(n => (n.id === id ? { ...n, x, y } : n)),
    }));
  };

  const rotateSelected = (deltaDeg: number) => {
    if (!selectedId) return;
    setGraph(g => ({
      ...g,
      nodes: g.nodes.map(n =>
        n.id === selectedId ? { ...n, r: ((n.r + deltaDeg) % 360 + 360) % 360 } : n,
      ),
    }));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setGraph(g => ({
      ...g,
      nodes: g.nodes.filter(n => n.id !== selectedId),
      edges: g.edges.filter(
        e => e.fromNodeId !== selectedId && e.toNodeId !== selectedId,
      ),
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
