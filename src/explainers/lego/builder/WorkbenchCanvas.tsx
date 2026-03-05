import { useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
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
  const nodesById = useMemo(() => {
    const mapped = new Map<string, BuildNode>();
    graph.nodes.forEach(node => mapped.set(node.id, node));
    return mapped;
  }, [graph.nodes]);

  const handlePointerDown = (e: ReactPointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    const node = nodesById.get(id);
    if (!node) {
      return;
    }

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

  return (
    <div className="workbench" onPointerDown={() => onSelect(null)}>
      <div className="workbench-hint">• Tap a Palette item to place • Drag to move • Tap empty space to deselect</div>

      {graph.nodes.map(node => (
        <div
          key={node.id}
          className={`token ${node.id === selectedId ? 'selected' : ''}`}
          style={{ transform: `translate(${node.x}px, ${node.y}px) rotate(${node.r}deg)` }}
          onPointerDown={e => handlePointerDown(e, node.id)}
          role="button"
          aria-label={kindLabel(node.kind)}
          title={kindLabel(node.kind)}
        >
          <div className="token-emoji">{kindEmoji(node.kind)}</div>
          <div className="token-text">{kindLabel(node.kind)}</div>
        </div>
      ))}
    </div>
  );
}
