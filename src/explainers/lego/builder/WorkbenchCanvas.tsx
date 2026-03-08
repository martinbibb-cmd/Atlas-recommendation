import { useMemo, useRef, useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BuildGraph, BuildNode, PartKind, PortDef, PortRef } from './types';
import { PALETTE } from './palette';
import { portsForKind, TOKEN_H, TOKEN_W } from './ports';
import { SCHEMATIC_REGISTRY, schematicPortToDxDy } from './schematicBlocks';
import { SchematicFace } from './SchematicFace';
import { findSnapCandidate, portAbs as snapPortAbs } from './snapConnect';
import { routePipe } from './router';
import './builder.css';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_SENSITIVITY = 0.001;

/**
 * Maximum pan offset in any direction (px).
 * Prevents nodes from being panned so far off-screen that the canvas
 * becomes a dead zone with no visible content or interactive area.
 * Exported for unit testing.
 */
export const PAN_CLAMP_PX = 3000

/**
 * Clamp a pan offset so neither axis exceeds PAN_CLAMP_PX.
 * Exported for unit testing.
 */
export function clampPan(pan: { x: number; y: number }): { x: number; y: number } {
  return {
    x: Math.max(-PAN_CLAMP_PX, Math.min(PAN_CLAMP_PX, pan.x)),
    y: Math.max(-PAN_CLAMP_PX, Math.min(PAN_CLAMP_PX, pan.y)),
  }
}

/**
 * Number of pixels reserved at the bottom of the workbench canvas for the
 * Build / Save / Play footer button strip.  A draggable palette tray must
 * stay above this line so controls remain accessible.
 * Exported for unit testing.
 */
export const TRAY_FOOTER_RESERVE_PX = 48

/**
 * Viewport width (px) below which the builder switches from the pinned desktop
 * side-panel to the floating draggable palette tray.
 * Matches the CSS breakpoint and the `isNarrow` useState initialiser.
 * Exported for unit testing.
 */
export const NARROW_LAYOUT_BREAKPOINT_PX = 1200

/**
 * Returns true when the given viewport width is in the narrow (tablet/mobile)
 * range where the floating draggable palette tray is shown instead of the
 * pinned desktop side-panel.
 *
 * Extracted as a pure helper so it can be unit-tested without a DOM.
 * Exported for unit testing.
 */
export function isNarrowLayout(windowWidth: number): boolean {
  return windowWidth < NARROW_LAYOUT_BREAKPOINT_PX
}

/**
 * Clamp a floating palette-tray position so it stays within the visible
 * workbench bounds and never slides over the footer button strip.
 *
 * Rules (PR7 — palette tray dead-zone fix):
 *  - X clamped to [0, workbenchWidth − trayWidth − 8]
 *  - Y clamped to [0, workbenchHeight − trayHeight − TRAY_FOOTER_RESERVE_PX]
 *
 * @param pos           Requested top-left position (px, relative to workbench).
 * @param workbenchSize Width and height of the workbench canvas element.
 * @param traySize      Width and height of the palette tray element.
 * @returns             Clamped position that fits within the workbench.
 *
 * Exported for unit testing.
 */
export function clampTrayPosition(
  pos: { x: number; y: number },
  workbenchSize: { width: number; height: number },
  traySize: { width: number; height: number },
): { x: number; y: number } {
  const maxX = Math.max(0, workbenchSize.width - traySize.width - 8)
  const maxY = Math.max(0, workbenchSize.height - traySize.height - TRAY_FOOTER_RESERVE_PX)
  return {
    x: Math.max(0, Math.min(pos.x, maxX)),
    y: Math.max(0, Math.min(pos.y, maxY)),
  }
}

// Directional arrow symbols used in port labels
const ARROW_OUT = '→';
const ARROW_IN  = '←';

function kindLabel(kind: PartKind) {
  return PALETTE.find(p => p.kind === kind)?.label ?? kind;
}

/** Maps a PartKind to a CSS modifier class for role-specific token styling. */
function kindClass(kind: PartKind): string {
  if (kind === 'heat_source_combi') return 'token--combi';
  if (
    kind === 'heat_source_system_boiler' ||
    kind === 'heat_source_regular_boiler' ||
    kind === 'heat_source_heat_pump'
  ) return 'token--source';
  if (
    kind === 'dhw_unvented_cylinder' ||
    kind === 'dhw_mixergy' ||
    kind === 'dhw_vented_cylinder'
  ) return 'token--cylinder';
  if (kind === 'radiator_loop' || kind === 'ufh_loop') return 'token--emitter';
  if (kind === 'three_port_valve' || kind === 'zone_valve') return 'token--control';
  if (
    kind === 'tap_outlet' ||
    kind === 'bath_outlet' ||
    kind === 'shower_outlet' ||
    kind === 'cold_tap_outlet'
  ) return 'token--outlet';
  if (
    kind === 'buffer' ||
    kind === 'low_loss_header' ||
    kind === 'pump' ||
    kind === 'sealed_system_kit' ||
    kind === 'open_vent' ||
    kind === 'feed_and_expansion' ||
    kind === 'cws_cistern'
  ) return 'token--support';
  return '';
}

/**
 * Derive port definitions from the schematic registry when available,
 * falling back to the legacy portsForKind() for components not yet in
 * the registry (tees, manifolds, outlets).
 */
function getPortDefs(kind: PartKind): PortDef[] {
  const reg = SCHEMATIC_REGISTRY[kind];
  if (reg) {
    return reg.ports.map(p => {
      const { dx, dy } = schematicPortToDxDy(p, reg.width, reg.height);
      return {
        id: p.id,
        dx,
        dy,
        role: (p.semanticRole as PortDef['role']) ?? 'unknown',
        label: p.label,
        direction: p.direction,
      };
    });
  }
  return portsForKind(kind);
}

function portAbs(node: BuildNode, portId: string) {
  const ports = getPortDefs(node.kind);
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
  onAutoConnect,
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
  onAutoConnect?: (from: PortRef, to: PortRef) => void;
  outletBindings?: Partial<Record<'A' | 'B' | 'C', string>>;
}) {
  const nodesById = useMemo(() => {
    const mapped = new Map<string, BuildNode>();
    graph.nodes.forEach(node => mapped.set(node.id, node));
    return mapped;
  }, [graph.nodes]);

  // Keep a ref so pointer-up closures always read the latest graph state.
  const graphRef = useRef(graph);
  useEffect(() => {
    graphRef.current = graph;
  });

  // ── Pan / zoom ─────────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Mutable refs so closure-captured handlers always read the latest values.
  const panRef = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const panningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panOriginRef = useRef({ x: 0, y: 0 });

  // Auto-center the canvas when the very first node is placed.
  const prevNodeCountRef = useRef(graph.nodes.length);
  useEffect(() => {
    const prev = prevNodeCountRef.current;
    prevNodeCountRef.current = graph.nodes.length;
    if (prev === 0 && graph.nodes.length === 1) {
      const node = graph.nodes[0];
      const container = containerRef.current;
      if (!container) return;
      const { width, height } = container.getBoundingClientRect();
      setPan({ x: width / 2 - node.x, y: height / 2 - node.y });
    }
  }, [graph.nodes]);

  // Non-passive wheel listener so preventDefault() actually prevents page scroll.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z - e.deltaY * ZOOM_SENSITIVITY)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // ── Node drag ──────────────────────────────────────────────────────────────
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
      // Divide by zoom so a screen-pixel maps to one world-pixel at 1× zoom.
      const dx = (ev.clientX - startX) / zoomRef.current;
      const dy = (ev.clientY - startY) / zoomRef.current;
      onMove(id, originX + dx, originY + dy);
    };

    const onUpEvt = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      window.removeEventListener('pointermove', onMoveEvt);
      window.removeEventListener('pointerup', onUpEvt);

      // Snap-to-port detection uses the latest graph state via the ref.
      if (onAutoConnect) {
        const cand = findSnapCandidate({
          graph: graphRef.current,
          movingNodeId: id,
          maxDistPx: 36,
        });
        if (cand) {
          onAutoConnect(cand.from, cand.to);
        }
      }
    };

    window.addEventListener('pointermove', onMoveEvt);
    window.addEventListener('pointerup', onUpEvt);
  };

  // Compute snap ghost: closest candidate port while a node is selected.
  const snapGhost = useMemo(() => {
    if (!selectedId || !onAutoConnect) return null;
    const cand = findSnapCandidate({ graph, movingNodeId: selectedId, maxDistPx: 36 });
    if (!cand) return null;
    const toNode = graph.nodes.find(n => n.id === cand.to.nodeId);
    if (!toNode) return null;
    return snapPortAbs(toNode, cand.to.portId);
  }, [graph, selectedId, onAutoConnect]);

  // ── Background pan handlers ────────────────────────────────────────────────
  const handleWrapPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    onSelect(null);
    onCancelPending();
    panningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY };
    panOriginRef.current = { ...panRef.current };
    (e.currentTarget).setPointerCapture(e.pointerId);
  };

  const handleWrapPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!panningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan(clampPan({ x: panOriginRef.current.x + dx, y: panOriginRef.current.y + dy }));
  };

  const handleWrapPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panningRef.current) {
      panningRef.current = false;
      (e.currentTarget).releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      ref={containerRef}
      className="canvas-wrap"
      onPointerDown={handleWrapPointerDown}
      onPointerMove={handleWrapPointerMove}
      onPointerUp={handleWrapPointerUp}
    >
      <div className="workbench-hint">
        • Tap a Palette item to place • Drag to move • Drag near a port to snap-connect •
        Tap port → port to connect • Scroll to zoom • Drag background to pan
      </div>

      <div
        className="canvas-world"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <svg className="pipes">
          {graph.edges.map(edge => {
            const fromNode = nodesById.get(edge.from.nodeId);
            const toNode = nodesById.get(edge.to.nodeId);
            if (!fromNode || !toNode) {
              return null;
            }

            const from = portAbs(fromNode, edge.from.portId);
            const to = portAbs(toNode, edge.to.portId);
            const points = routePipe(from, to);

            const edgeClass =
              edge.meta?.roleFrom === 'unknown' || edge.meta?.roleTo === 'unknown'
                ? 'pipe-line softwarn'
                : 'pipe-line';

            const highlighted = edge.id === highlightEdgeId;
            const finalClass = highlighted ? `${edgeClass} highlighted` : edgeClass;

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

          {snapGhost ? (
            <circle
              cx={snapGhost.x}
              cy={snapGhost.y}
              r={10}
              className="snap-ghost"
            />
          ) : null}
        </svg>

        {graph.nodes.map(node => {
          const ports = getPortDefs(node.kind);
          const slot = (['A', 'B', 'C'] as const).find(key => outletBindings?.[key] === node.id);

          return (
            <div
              key={node.id}
              className={['token', kindClass(node.kind), node.id === selectedId ? 'selected' : '', node.id === highlightNodeId ? 'highlighted' : ''].filter(Boolean).join(' ')}
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
              <SchematicFace kind={node.kind} label={kindLabel(node.kind)} slot={slot} />

              {ports.map(port => {
                const isPending =
                  pendingPort && pendingPort.nodeId === node.id && pendingPort.portId === port.id;

                const showLabel = node.id === selectedId || pendingPort !== null;

                // Directional arrow: → for out, ← for in
                const arrow =
                  port.direction === 'out' ? ARROW_OUT :
                  port.direction === 'in'  ? ARROW_IN  :
                  null;

                const displayLabel = port.label ?? port.id;

                // Flip label above the port button when the port is in the bottom half
                // of the token so the label doesn't clip outside the canvas area.
                const labelAbove = port.dy > TOKEN_H * 0.5;

                return (
                  <button
                    key={port.id}
                    className={`port port--${port.role ?? 'unknown'} ${isPending ? 'pending' : ''}`}
                    style={{ left: port.dx - 6, top: port.dy - 6 }}
                    title={`${displayLabel}${arrow ? ` ${arrow}` : ''}`}
                    onPointerDown={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      onPortTap({ nodeId: node.id, portId: port.id });
                    }}
                  >
                    {showLabel && (
                      <span className={`port-label${labelAbove ? ' port-label--above' : ''}`}>
                        {arrow ? <span className="port-arrow">{arrow}</span> : null}
                        {displayLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
