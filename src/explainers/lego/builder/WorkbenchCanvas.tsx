import { useMemo, useRef, useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BuildEdge, BuildGraph, BuildNode, PartKind, PortRef } from './types';
import { PALETTE } from './palette';
import { getPortDefs } from './portDefs';
import { SchematicFace } from './SchematicFace';
import { findSnapCandidate, portAbs as snapPortAbs } from './snapConnect';
import {
  routePipe,
  findCrossings,
  buildPathWithBumps,
  offsetParallelPipes,
} from './router';
import { getSchematicDimensions } from './schematicBlocks';
import { allZoneBands, ZONE_BAND_WIDTH, ZONE_BAND_X } from './zoneBands';
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

/**
 * Return a CSS colour-modifier class for a pipe based on the port roles of its
 * connected endpoints.
 *
 *   hot / DHW           → pipe-line--dhw    (red)
 *   cold / CW           → pipe-line--cold   (blue)
 *   heating/primary flow → pipe-line--flow  (purple)
 *   heating/primary return → pipe-line--return (green)
 */
function pipeDomainClass(edge: BuildEdge, graph: BuildGraph): string {
  const fromNode = graph.nodes.find(n => n.id === edge.from.nodeId);
  const toNode = graph.nodes.find(n => n.id === edge.to.nodeId);
  const fromPort = fromNode ? getPortDefs(fromNode.kind).find(p => p.id === edge.from.portId) : null;
  const toPort = toNode ? getPortDefs(toNode.kind).find(p => p.id === edge.to.portId) : null;
  const rf = edge.meta?.roleFrom ?? fromPort?.role;
  const rt = edge.meta?.roleTo ?? toPort?.role;
  if (rf === 'hot'    || rt === 'hot')    return 'pipe-line--dhw';
  if (rf === 'cold'   || rt === 'cold')   return 'pipe-line--cold';
  if (rf === 'flow'   || rt === 'flow')   return 'pipe-line--flow';
  if (rf === 'return' || rt === 'return') return 'pipe-line--return';
  return '';
}

/**
 * Return a numeric priority for crossing-bump resolution.
 * Higher value = higher priority = this pipe goes straight (no bump).
 */
function pipePriority(edge: BuildEdge, graph: BuildGraph): number {
  const fromNode = graph.nodes.find(n => n.id === edge.from.nodeId);
  const toNode = graph.nodes.find(n => n.id === edge.to.nodeId);
  const fromPort = fromNode ? getPortDefs(fromNode.kind).find(p => p.id === edge.from.portId) : null;
  const toPort = toNode ? getPortDefs(toNode.kind).find(p => p.id === edge.to.portId) : null;
  const rf = edge.meta?.roleFrom ?? fromPort?.role;
  const rt = edge.meta?.roleTo ?? toPort?.role;
  if (rf === 'flow'   || rt === 'flow')   return 4;
  if (rf === 'return' || rt === 'return') return 3;
  if (rf === 'hot'    || rt === 'hot')    return 2;
  if (rf === 'cold'   || rt === 'cold')   return 1;
  return 2;
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
  if (kind === 'buffer' || kind === 'low_loss_header') return 'token--support';
  // Routing devices — compact inline symbols (pump, zone valve, 3-port valve)
  if (
    kind === 'pump' ||
    kind === 'three_port_valve' ||
    kind === 'zone_valve'
  ) return 'token--routing';
  // Small support accessories (sealed kit, open vent, F&E tank)
  if (
    kind === 'sealed_system_kit' ||
    kind === 'open_vent' ||
    kind === 'feed_and_expansion'
  ) return 'token--support-small';
  // Tee / junction symbols — tiny branch-point nodes, not major components
  if (
    kind === 'tee_cold' ||
    kind === 'tee_hot' ||
    kind === 'tee_ch_flow' ||
    kind === 'tee_ch_return'
  ) return 'token--support-small';
  if (
    kind === 'tap_outlet' ||
    kind === 'bath_outlet' ||
    kind === 'shower_outlet' ||
    kind === 'cold_tap_outlet'
  ) return 'token--outlet';
  if (kind === 'cws_cistern') return 'token--support';
  return '';
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
  outletBindings?: Record<string, string>;
}) {
  const nodesById = useMemo(() => {
    const mapped = new Map<string, BuildNode>();
    graph.nodes.forEach(node => mapped.set(node.id, node));
    return mapped;
  }, [graph.nodes]);

  /**
   * Two-pass pipe render computation:
   *   Pass 1 — compute base routes via routePipe, then apply parallel offsets.
   *   Pass 2 — detect crossing points between all edge pairs; assign bumps to
   *             the lower-priority pipe at each crossing.
   *   Result — per-edge SVG `d` path strings and domain CSS classes.
   */
  const pipeRenderData = useMemo(() => {
    // Pass 1a: compute base routes
    const validEntries: Array<{ edge: BuildEdge; points: string }> = [];
    for (const edge of graph.edges) {
      const fromNode = nodesById.get(edge.from.nodeId);
      const toNode   = nodesById.get(edge.to.nodeId);
      if (!fromNode || !toNode) continue;
      const from = portAbs(fromNode, edge.from.portId);
      const to   = portAbs(toNode,   edge.to.portId);
      validEntries.push({ edge, points: routePipe(from, to) });
    }

    // Pass 1b: offset parallel overlapping middle segments
    const offsetPoints = offsetParallelPipes(validEntries.map(e => e.points));

    // Pass 2: detect crossings between all pairs; lower-priority edge gets bump
    const crossingsPerEdge = new Map<string, Array<{ x: number; y: number }>>();
    for (let i = 0; i < validEntries.length; i++) {
      for (let j = i + 1; j < validEntries.length; j++) {
        const xings = findCrossings(offsetPoints[i], offsetPoints[j]);
        if (xings.length === 0) continue;
        const pi = pipePriority(validEntries[i].edge, graph);
        const pj = pipePriority(validEntries[j].edge, graph);
        // Higher-priority pipe goes straight; lower-priority gets the bump.
        // Equal priorities: the later-drawn edge (j, higher index) gets the bump.
        const bumpId =
          pi > pj ? validEntries[j].edge.id   // i strictly higher → j bumps
          : pi < pj ? validEntries[i].edge.id  // j strictly higher → i bumps
          : validEntries[j].edge.id;            // tie → later edge (j) bumps
        crossingsPerEdge.set(bumpId, [
          ...(crossingsPerEdge.get(bumpId) ?? []),
          ...xings,
        ]);
      }
    }

    // Build final render descriptors
    return validEntries.map(({ edge }, idx) => {
      const points  = offsetPoints[idx];
      const bumps   = crossingsPerEdge.get(edge.id) ?? [];
      const domCls  = pipeDomainClass(edge, graph);
      const pathD   = buildPathWithBumps(points, bumps);
      return { edge, pathD, domainClass: domCls };
    });
  }, [graph.edges, nodesById]);

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
        {/* ── Structural zone bands — rendered behind all schematic content ── */}
        <svg className="zone-bands" aria-hidden="true">
          {allZoneBands().map(band => (
            <g key={band.zone}>
              <rect
                x={ZONE_BAND_X}
                y={band.y}
                width={ZONE_BAND_WIDTH}
                height={band.height}
                fill={band.fill}
              />
              <text
                x={ZONE_BAND_X + 20}
                y={band.y + 22}
                className="zone-band-label"
              >
                {band.label}
              </text>
            </g>
          ))}
        </svg>

        <svg className="pipes">
          {pipeRenderData.map(({ edge, pathD, domainClass }) => {
            const isSoftWarn =
              edge.meta?.roleFrom === 'unknown' || edge.meta?.roleTo === 'unknown';
            const highlighted = edge.id === highlightEdgeId;

            const cls = [
              'pipe-line',
              domainClass,
              isSoftWarn ? 'softwarn' : '',
              highlighted ? 'highlighted' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <path
                key={edge.id}
                d={pathD}
                className={cls}
              />
            );
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
          const slot = Object.entries(outletBindings ?? {}).find(([, id]) => id === node.id)?.[0];
          const dims = getSchematicDimensions(node.kind);

          return (
            <div
              key={node.id}
              className={['token', kindClass(node.kind), node.id === selectedId ? 'selected' : '', node.id === highlightNodeId ? 'highlighted' : ''].filter(Boolean).join(' ')}
              style={{
                width: dims.width,
                height: dims.height,
                transform: `translate(${node.x}px, ${node.y}px) rotate(${node.r}deg)`,
              }}
              onPointerDown={e => handlePointerDown(e, node.id)}
              role="button"
              aria-label={kindLabel(node.kind)}
              title={kindLabel(node.kind)}
            >
              <SchematicFace
                kind={node.kind}
                label={kindLabel(node.kind)}
                slot={slot}
                width={dims.width}
                height={dims.height}
              />

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
                const labelAbove = port.dy > dims.height * 0.5;

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
