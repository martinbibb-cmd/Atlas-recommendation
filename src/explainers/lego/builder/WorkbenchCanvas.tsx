import { useMemo, useRef, useEffect, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BuildGraph, BuildNode, PartKind, PortDef, PortRef } from './types';
import { PALETTE } from './palette';
import { portsForKind, TOKEN_H, TOKEN_W } from './ports';
import { SCHEMATIC_REGISTRY, schematicPortToDxDy } from './schematicBlocks';
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

function kindEmoji(kind: PartKind) {
  return PALETTE.find(p => p.kind === kind)?.emoji ?? '🧩';
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

// ─── Schematic face SVG components ────────────────────────────────────────────

/** Renders a component-specific schematic face inside the token rectangle. */
function SchematicFace({
  kind,
  label,
  slot,
}: {
  kind: PartKind;
  label: string;
  slot?: string;
}) {
  const slotBadge = slot ? (
    <text x="85" y="69" textAnchor="middle" fontSize="7" fill="#805ad5" fontWeight="700">
      Outlet {slot}
    </text>
  ) : null;

  // ── Combi boiler: split CH / DHW zones ──────────────────────────────────
  if (kind === 'heat_source_combi') {
    return (
      <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true" className="token-face">
        {/* CH / DHW zone divider */}
        <line x1="8" y1="42" x2="162" y2="42" stroke="#93c5fd" strokeWidth="1" strokeDasharray="4 3" opacity="0.65"/>
        {/* Boiler casing outline */}
        <rect x="10" y="5" width="150" height="64" rx="8" fill="none" stroke="#c05621" strokeWidth="1.5" opacity="0.3"/>
        <text x="85" y="20" textAnchor="middle" fontSize="9" fontWeight="800" fill="#7b341e">CH</text>
        <text x="85" y="36" textAnchor="middle" fontSize="15">🔥</text>
        <text x="85" y="58" textAnchor="middle" fontSize="9" fontWeight="800" fill="#2c5282">DCW / DHW</text>
        {slotBadge}
      </svg>
    );
  }

  // ── System / regular boiler: simple 2-port heat source ──────────────────
  if (kind === 'heat_source_system_boiler' || kind === 'heat_source_regular_boiler') {
    const shortLabel = kind === 'heat_source_system_boiler' ? 'SYSTEM' : 'REGULAR';
    return (
      <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true" className="token-face">
        <rect x="10" y="5" width="150" height="64" rx="8" fill="none" stroke="#c05621" strokeWidth="1.5" opacity="0.3"/>
        <text x="85" y="30" textAnchor="middle" fontSize="18">🔥</text>
        <text x="85" y="50" textAnchor="middle" fontSize="9" fontWeight="800" fill="#7b341e">{shortLabel} BOILER</text>
        {slotBadge}
      </svg>
    );
  }

  // ── Heat pump: 2-port heat source with efficiency focus ──────────────────
  if (kind === 'heat_source_heat_pump') {
    return (
      <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true" className="token-face">
        <rect x="10" y="5" width="150" height="64" rx="8" fill="none" stroke="#276749" strokeWidth="1.5" opacity="0.3"/>
        <text x="85" y="30" textAnchor="middle" fontSize="18">♻️</text>
        <text x="85" y="50" textAnchor="middle" fontSize="9" fontWeight="800" fill="#22543d">HEAT PUMP</text>
        {slotBadge}
      </svg>
    );
  }

  // ── Cylinder: left coil, top hot, bottom cold ────────────────────────────
  if (
    kind === 'dhw_unvented_cylinder' ||
    kind === 'dhw_vented_cylinder' ||
    kind === 'dhw_mixergy'
  ) {
    const typeLabel =
      kind === 'dhw_mixergy' ? 'MIXERGY' :
      kind === 'dhw_unvented_cylinder' ? 'UNVENTED' : 'VENTED';
    return (
      <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true" className="token-face">
        {/* Cylinder body — inset left to leave room for coil path */}
        <rect x="26" y="3" width="120" height="68" rx="20" fill="none" stroke="#2b6cb0" strokeWidth="1.5" opacity="0.55"/>
        {/* Mixergy top-entry HX band */}
        {kind === 'dhw_mixergy' && (
          <rect x="26" y="3" width="120" height="16" rx="12" fill="none"
                stroke="#c05621" strokeWidth="1" strokeDasharray="3 2" opacity="0.55"/>
        )}
        {/* Coil indicator on the left face: matches coil_flow (T+18) / coil_return (B-18) ports */}
        <path d="M26,20 Q13,24 26,30 Q13,35 26,40 Q13,45 26,52"
              fill="none" stroke="#c05621" strokeWidth="2" opacity="0.65"/>
        {/* Type label */}
        <text x="86" y="30" textAnchor="middle" fontSize="8" fontWeight="800" fill="#2c5282">{typeLabel}</text>
        <text x="86" y="48" textAnchor="middle" fontSize="13">💧</text>
        {slotBadge}
      </svg>
    );
  }

  // ── Three-port valve (Y-plan): visually distinct routing device ──────────
  if (kind === 'three_port_valve') {
    return (
      <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true" className="token-face">
        {/* Valve body ellipse */}
        <ellipse cx="82" cy="37" rx="42" ry="28" fill="none" stroke="#6b46c1" strokeWidth="1.5" opacity="0.55"/>
        {/* Flow paths */}
        <line x1="0"   y1="37" x2="40"  y2="37" stroke="#6b46c1" strokeWidth="1.5" opacity="0.5"/>
        <line x1="124" y1="37" x2="170" y2="18" stroke="#6b46c1" strokeWidth="1.5" opacity="0.5"/>
        <line x1="124" y1="37" x2="170" y2="56" stroke="#6b46c1" strokeWidth="1.5" opacity="0.5"/>
        {/* Junction node */}
        <circle cx="124" cy="37" r="3" fill="#6b46c1" opacity="0.5"/>
        <text x="82" y="32" textAnchor="middle" fontSize="8"  fontWeight="800" fill="#553c9a">Y-PLAN</text>
        <text x="82" y="43" textAnchor="middle" fontSize="7"  fill="#553c9a">3-port valve</text>
        {slotBadge}
      </svg>
    );
  }

  // ── Zone valve (S-plan): simple through-flow valve with actuator ─────────
  if (kind === 'zone_valve') {
    return (
      <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true" className="token-face">
        {/* Pipe stubs */}
        <line x1="0"   y1="37" x2="57"  y2="37" stroke="#6b46c1" strokeWidth="1.5" opacity="0.5"/>
        <line x1="113" y1="37" x2="170" y2="37" stroke="#6b46c1" strokeWidth="1.5" opacity="0.5"/>
        {/* Valve disc */}
        <circle cx="85" cy="37" r="26" fill="none" stroke="#6b46c1" strokeWidth="1.5" opacity="0.55"/>
        {/* Actuator stem */}
        <line x1="85" y1="11" x2="85" y2="4"  stroke="#6b46c1" strokeWidth="2"   opacity="0.5"/>
        <rect  x="75" y="2"  width="20" height="7" rx="2" fill="none" stroke="#6b46c1" strokeWidth="1.2" opacity="0.5"/>
        <text x="85" y="33" textAnchor="middle" fontSize="8" fontWeight="800" fill="#553c9a">ZONE</text>
        <text x="85" y="44" textAnchor="middle" fontSize="7" fill="#553c9a">VALVE</text>
        {slotBadge}
      </svg>
    );
  }

  // ── Radiator loop: fin-panel emitter ────────────────────────────────────
  if (kind === 'radiator_loop') {
    return (
      <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true" className="token-face">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <rect key={i} x={22 + i * 18} y="14" width="12" height="44" rx="3"
                fill="none" stroke="#6b46c1" strokeWidth="1.2" opacity="0.5"/>
        ))}
        <text x="85" y="68" textAnchor="middle" fontSize="7" fontWeight="800" fill="#553c9a">RADIATORS</text>
        {slotBadge}
      </svg>
    );
  }

  // ── UFH loop: serpentine emitter ─────────────────────────────────────────
  if (kind === 'ufh_loop') {
    return (
      <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true" className="token-face">
        <path d="M20,20 H150 V37 H20 V54 H150"
              fill="none" stroke="#6b46c1" strokeWidth="1.5" opacity="0.5"/>
        <text x="85" y="70" textAnchor="middle" fontSize="7" fontWeight="800" fill="#553c9a">UNDERFLOOR HEATING</text>
        {slotBadge}
      </svg>
    );
  }

  // ── Generic fallback: emoji + label in SVG ───────────────────────────────
  const emoji = kindEmoji(kind);
  return (
    <svg viewBox="0 0 170 74" width="170" height="74" aria-hidden="true" className="token-face">
      <text x="85" y="30" textAnchor="middle" fontSize="20">{emoji}</text>
      <text x="85" y="50" textAnchor="middle" fontSize="9" fontWeight="800" fill="#2d3748">{label}</text>
      {slotBadge}
    </svg>
  );
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
