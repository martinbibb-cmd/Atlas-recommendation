import { useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BuildGraph, BuildNode, PartKind, PortRef } from './types';
import { PALETTE } from './palette';
import { portsForKind, TOKEN_H, TOKEN_W } from './ports';
import './builder.css';

function kindLabel(kind: PartKind) {
  return PALETTE.find(p => p.kind === kind)?.label ?? kind;
}

function kindEmoji(kind: PartKind) {
  return PALETTE.find(p => p.kind === kind)?.emoji ?? '🧩';
}

function portAbs(node: BuildNode, portId: string) {
  const ports = portsForKind(node.kind);
  const port = ports.find(item => item.id === portId);
  if (!port) {
    return { x: node.x, y: node.y };
  }

  return { x: node.x + port.dx, y: node.y + port.dy };
}

export default function WorkbenchCanvas({
  graph,
  selectedId,
  highlightNodeId,
  highlightEdgeId,
  pendingPort,
  onSelect,
  onMove,
  onPortTap,
  onCancelPending,
  outletBindings,
}: {
  graph: BuildGraph;
  selectedId: string | null;
  highlightNodeId?: string | null;
  highlightEdgeId?: string | null;
  pendingPort: PortRef | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onPortTap: (ref: PortRef) => void;
  onCancelPending: () => void;
  outletBindings?: Partial<Record<'A' | 'B' | 'C', string>>;
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
    <div
      className="workbench"
      onPointerDown={() => {
        onSelect(null);
        onCancelPending();
      }}
    >
      <div className="workbench-hint">• Tap a Palette item to place • Drag to move • Tap port → port to connect</div>

      <svg className="pipes" width="100%" height="100%">
        {graph.edges.map(edge => {
          const fromNode = nodesById.get(edge.from.nodeId);
          const toNode = nodesById.get(edge.to.nodeId);
          if (!fromNode || !toNode) {
            return null;
          }

          const from = portAbs(fromNode, edge.from.portId);
          const to = portAbs(toNode, edge.to.portId);
          const midX = (from.x + to.x) / 2;
          const points = `${from.x},${from.y} ${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;

          const edgeClass =
            edge.meta?.roleFrom === 'unknown' || edge.meta?.roleTo === 'unknown'
              ? 'pipe-line softwarn'
              : 'pipe-line'

          const highlighted = edge.id === highlightEdgeId

          const finalClass = highlighted ? `${edgeClass} highlighted` : edgeClass

          return <polyline key={edge.id} points={points} className={finalClass} fill="none" />;
        })}

        {pendingPort
          ? (() => {
              const fromNode = nodesById.get(pendingPort.nodeId);
              if (!fromNode) {
                return null;
              }

              const from = portAbs(fromNode, pendingPort.portId);
              const to = { x: from.x + 80, y: from.y };
              return (
                <polyline
                  points={`${from.x},${from.y} ${to.x},${to.y}`}
                  className="pipe-line pending"
                  fill="none"
                />
              );
            })()
          : null}
      </svg>

      {graph.nodes.map(node => {
        const ports = portsForKind(node.kind);
        const slot = (['A', 'B', 'C'] as const).find(key => outletBindings?.[key] === node.id)

        return (
          <div
            key={node.id}
            className={`token ${node.id === selectedId ? 'selected' : ''} ${node.id === highlightNodeId ? 'highlighted' : ''}`}
            style={{
              width: TOKEN_W,
              height: TOKEN_H,
              transform: `translate(${node.x}px, ${node.y}px) rotate(${node.r}deg)`,
            }}
            onPointerDown={e => handlePointerDown(e, node.id)}
            role="button"
            aria-label={kindLabel(node.kind)}
            title={kindLabel(node.kind)}
          >
            <div className="token-emoji">{kindEmoji(node.kind)}</div>
            <div className="token-text">{kindLabel(node.kind)}</div>
            {slot ? <div className="token-bind">Outlet {slot}</div> : null}

            {ports.map(port => {
              const isPending =
                pendingPort && pendingPort.nodeId === node.id && pendingPort.portId === port.id;

              return (
                <button
                  key={port.id}
                  className={`port ${isPending ? 'pending' : ''}`}
                  style={{ left: port.dx - 6, top: port.dy - 6 }}
                  title={port.id}
                  onPointerDown={event => {
                    event.preventDefault();
                    event.stopPropagation();
                    onPortTap({ nodeId: node.id, portId: port.id });
                  }}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
