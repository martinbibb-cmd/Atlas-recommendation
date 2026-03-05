import { useMemo, useRef } from 'react';
import type { BuildGraph, BuildNode, PartKind } from './types';
import { PALETTE } from './palette';
import './builder.css';

function kindLabel(kind: PartKind) {
  return PALETTE.find(p => p.kind === kind)?.label ?? kind;
}

function kindEmoji(kind: PartKind) {
  return PALETTE.find(p => p.kind === kind)?.emoji ?? '🧩';
}

export default function WorkbenchCanvas({
  graph,
  selectedId,
  onSelect,
  onMove,
}: {
  graph: BuildGraph;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const nodesById = useMemo(() => {
    const m = new Map<string, BuildNode>();
    graph.nodes.forEach(n => m.set(n.id, n));
    return m;
  }, [graph.nodes]);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    const node = nodesById.get(id);
    if (!node) return;

    onSelect(id);

    const startX = e.clientX;
    const startY = e.clientY;
    const originX = node.x;
    const originY = node.y;

    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    const onMoveEvt = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      onMove(id, originX + dx, originY + dy);
    };

    const onUpEvt = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', onMoveEvt);
      window.removeEventListener('pointerup', onUpEvt);
    };

    window.addEventListener('pointermove', onMoveEvt);
    window.addEventListener('pointerup', onUpEvt);
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    // Only deselect when clicking the canvas background directly
    if (e.target === e.currentTarget || e.target === wrapRef.current) {
      onSelect(null);
    }
  };

  return (
    <div className="workbench" ref={wrapRef} onPointerDown={handleCanvasPointerDown}>
      <div className="workbench-hint">
        • Tap a Palette item to place&nbsp;&nbsp;• Drag to move&nbsp;&nbsp;• Tap empty space to deselect
      </div>

      {graph.nodes.map(n => (
        <div
          key={n.id}
          className={`token${n.id === selectedId ? ' selected' : ''}`}
          style={{
            transform: `translate(${n.x}px, ${n.y}px) rotate(${n.r}deg)`,
          }}
          onPointerDown={(e) => handlePointerDown(e, n.id)}
          role="button"
          aria-label={kindLabel(n.kind)}
          title={kindLabel(n.kind)}
        >
          <div className="token-emoji">{kindEmoji(n.kind)}</div>
          <div className="token-text">{kindLabel(n.kind)}</div>
        </div>
      ))}
    </div>
  );
}
