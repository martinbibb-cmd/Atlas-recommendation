/**
 * FloorPlanBuilder — three-layer property editor.
 *
 * Layer 1: Geometry   — floors, rooms, walls
 * Layer 2: Placement  — heating/system components anchored to floors & rooms
 * Layer 3: Connection — pipe/wiring routes between placed nodes
 *
 * The bottom "Simulate" panel feeds the current floor's BuildGraph into the
 * full lego BuilderShell when there are enough nodes to model.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import BuilderShell from '../../explainers/lego/builder/BuilderShell';
import { PALETTE_SECTIONS } from '../../explainers/lego/builder/palette';
import { getPortDefs } from '../../explainers/lego/builder/portDefs';
import { portAbs } from '../../explainers/lego/builder/snapConnect';
import { isTopologyAllowed } from '../../explainers/lego/builder/snapConnect';
import type { BuildEdge, BuildGraph, BuildNode, PartKind, PortRef } from '../../explainers/lego/builder/types';
import type {
  ConnectionPath,
  ConnectionType,
  EditorTool,
  FloorPlan,
  Opening,
  PlacementNode,
  PropertyMetadata,
  PropertyPlan,
  Room,
  RoomType,
  SelectionTarget,
  Wall,
  WallKind,
} from './propertyPlan.types';
import { ROOM_TYPE_LABELS } from './propertyPlan.types';
import { badgeForObject, validatePropertyPlan } from './propertyValidation';
import type { ValidationResult } from './propertyValidation';
import './floorplan.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID = 24;
const CANVAS_W = 1080;
const CANVAS_H = 620;
const SNAP_DIST = 14;
const DEFAULT_ROOM_W = 192; // 8 grid units ≈ 4.8 m
const DEFAULT_ROOM_H = 144; // 6 grid units ≈ 3.6 m

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _seq = 0;
function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(16)}_${(++_seq).toString(16)}`;
}

function snapToGrid(v: number) {
  return Math.round(v / GRID) * GRID;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function toMeters(px: number) {
  return (px / GRID).toFixed(1);
}

/** Snap a room so it aligns to adjacent room edges (edge-snapping). */
function snapRoomToSiblings(candidate: Room, siblings: Room[]): Room {
  let next = { ...candidate };
  siblings.forEach((other) => {
    const yOverlap = next.y < other.y + other.height && next.y + next.height > other.y;
    const xOverlap = next.x < other.x + other.width && next.x + next.width > other.x;

    if (yOverlap && Math.abs(next.x + next.width - other.x) <= SNAP_DIST) next.x = other.x - next.width;
    if (yOverlap && Math.abs(next.x - (other.x + other.width)) <= SNAP_DIST) next.x = other.x + other.width;
    if (xOverlap && Math.abs(next.y + next.height - other.y) <= SNAP_DIST) next.y = other.y - next.height;
    if (xOverlap && Math.abs(next.y - (other.y + other.height)) <= SNAP_DIST) next.y = other.y + other.height;
  });
  return next;
}

function makeEmptyFloor(index: number): FloorPlan {
  const names = ['Ground', 'First', 'Second', 'Third', 'Loft'];
  return {
    id: uid('floor'),
    name: names[index] ?? `Floor ${index}`,
    levelIndex: index,
    rooms: [],
    walls: [],
    openings: [],
    zones: [],
  };
}

/** Convert placed nodes + edges into a BuildGraph for the simulation shell. */
function buildGraphFromNodes(
  nodes: PlacementNode[],
  edges: BuildEdge[],
): BuildGraph {
  const buildNodes: BuildNode[] = nodes.map((n) => ({
    id: n.id,
    kind: n.type,
    x: n.anchor.x,
    y: n.anchor.y,
    r: 0,
  }));
  return { nodes: buildNodes, edges };
}

// ─── Snap-validation: which room types a PartKind prefers ────────────────────

const PREFERRED_ROOM_TYPES: Partial<Record<PartKind, RoomType[]>> = {
  heat_source_combi:          ['kitchen', 'utility', 'garage', 'cupboard', 'plant_room'],
  heat_source_system_boiler:  ['kitchen', 'utility', 'garage', 'cupboard', 'plant_room'],
  heat_source_regular_boiler: ['kitchen', 'utility', 'garage', 'cupboard', 'plant_room'],
  heat_source_heat_pump:      ['outside'],
  dhw_unvented_cylinder:      ['cupboard', 'plant_room', 'utility', 'garage'],
  dhw_mixergy:                ['cupboard', 'plant_room', 'utility', 'garage'],
  dhw_vented_cylinder:        ['cupboard', 'plant_room', 'utility', 'loft'],
  cws_cistern:                ['loft', 'cupboard'],
};

function isValidPlacementRoom(kind: PartKind, room: Room): boolean {
  const preferred = PREFERRED_ROOM_TYPES[kind];
  if (!preferred) return true; // radiators, outlets etc. go anywhere
  return preferred.includes(room.roomType);
}

// ─── Initial state ────────────────────────────────────────────────────────────

function makeInitialPlan(metadata: PropertyMetadata = {}): PropertyPlan {
  return {
    version: '1.0',
    propertyId: uid('prop'),
    floors: [makeEmptyFloor(0)],
    placementNodes: [],
    connections: [],
    metadata,
  };
}

// ─── Component props ──────────────────────────────────────────────────────────

export interface FloorPlanOutput {
  plan: PropertyPlan;
  /** Build graph of the currently active floor for simulation. */
  activeFloorGraph: BuildGraph;
}

interface Props {
  surveyResults?: { systemType?: 'combi' | 'system' | 'regular' | 'heat_pump' };
  onChange?: (output: FloorPlanOutput) => void;
}

// ─── Tool config ──────────────────────────────────────────────────────────────

const TOOL_DEFS: { id: EditorTool; label: string; icon: string; hint: string }[] = [
  { id: 'select',       label: 'Select',      icon: '↖',  hint: 'Click to select; drag to move' },
  { id: 'addRoom',      label: 'Add Room',    icon: '⬛', hint: 'Click canvas to place room; drag to size' },
  { id: 'drawWall',     label: 'Draw Wall',   icon: '📏', hint: 'Click start, click end to draw wall' },
  { id: 'addOpening',   label: 'Opening',     icon: '🚪', hint: 'Click a wall to add door/window' },
  { id: 'placeNode',    label: 'Place Node',  icon: '🔧', hint: 'Select component from tray, click canvas' },
  { id: 'connectRoute', label: 'Connect',     icon: '〰', hint: 'Click source node, then target node' },
];

// ─── FloorPlanBuilder ─────────────────────────────────────────────────────────

export default function FloorPlanBuilder({ surveyResults, onChange }: Props = {}) {
  const [plan, setPlan] = useState<PropertyPlan>(() =>
    makeInitialPlan({ systemType: surveyResults?.systemType }),
  );
  const [activeFloorId, setActiveFloorId] = useState<string>(
    () => plan.floors[0]?.id ?? '',
  );
  const [tool, setTool] = useState<EditorTool>('select');
  const [selection, setSelection] = useState<SelectionTarget | null>(null);
  const [pendingWallStart, setPendingWallStart] = useState<{ x: number; y: number } | null>(null);
  const [pendingPort, setPendingPort] = useState<PortRef | null>(null);
  /** Kind being dragged from the component tray (placeNode mode) */
  const [pendingKind, setPendingKind] = useState<PartKind | null>(null);
  /** Ghost position during placeNode mode */
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  /** Room drag-to-create state */
  const [roomDraftOrigin, setRoomDraftOrigin] = useState<{ x: number; y: number } | null>(null);
  const [roomDraftSize, setRoomDraftSize] = useState<{ w: number; h: number } | null>(null);
  /** Which node edges (lego BuildEdges) are stored per-floor */
  const [buildEdgesByFloor, setBuildEdgesByFloor] = useState<Record<string, BuildEdge[]>>({});
  /** Show the simulation shell */
  const [showSimulation, setShowSimulation] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<
    | { mode: 'room-move'; id: string; dx: number; dy: number }
    | { mode: 'room-resize'; id: string; startX: number; startY: number; baseW: number; baseH: number }
    | { mode: 'node-move'; id: string; dx: number; dy: number }
    | null
  >(null);

  // ── Derived ──────────────────────────────────────────────────────────────

  const activeFloor = useMemo(
    () => plan.floors.find((f) => f.id === activeFloorId) ?? plan.floors[0],
    [plan.floors, activeFloorId],
  );

  const visibleNodes = useMemo(
    () => plan.placementNodes.filter((n) => n.floorId === activeFloorId),
    [plan.placementNodes, activeFloorId],
  );

  const activeEdges = useMemo(
    () => buildEdgesByFloor[activeFloorId] ?? [],
    [buildEdgesByFloor, activeFloorId],
  );

  const activeFloorGraph = useMemo(
    () => buildGraphFromNodes(visibleNodes, activeEdges),
    [visibleNodes, activeEdges],
  );

  const validation: ValidationResult = useMemo(
    () => validatePropertyPlan(plan),
    [plan],
  );

  const selectedRoom = useMemo(() => {
    if (selection?.kind !== 'room') return null;
    return activeFloor?.rooms.find((r) => r.id === selection.id) ?? null;
  }, [selection, activeFloor]);

  const selectedWall = useMemo(() => {
    if (selection?.kind !== 'wall') return null;
    return activeFloor?.walls.find((w) => w.id === selection.id) ?? null;
  }, [selection, activeFloor]);

  const selectedNode = useMemo(() => {
    if (selection?.kind !== 'node') return null;
    return visibleNodes.find((n) => n.id === selection.id) ?? null;
  }, [selection, visibleNodes]);

  // ── Emit helper ──────────────────────────────────────────────────────────

  const emit = useCallback(
    (nextPlan: PropertyPlan) => {
      onChange?.({
        plan: nextPlan,
        activeFloorGraph: buildGraphFromNodes(
          nextPlan.placementNodes.filter((n) => n.floorId === activeFloorId),
          buildEdgesByFloor[activeFloorId] ?? [],
        ),
      });
    },
    [onChange, activeFloorId, buildEdgesByFloor],
  );

  // ── Floor mutations ──────────────────────────────────────────────────────

  function updatePlan(updater: (p: PropertyPlan) => PropertyPlan) {
    setPlan((prev) => {
      const next = updater(prev);
      emit(next);
      return next;
    });
  }

  function updateActiveFloor(updater: (f: FloorPlan) => FloorPlan) {
    updatePlan((p) => ({
      ...p,
      floors: p.floors.map((f) => (f.id === activeFloorId ? updater(f) : f)),
    }));
  }

  function addFloor(clonePerimeter: boolean) {
    const newFloor = makeEmptyFloor(plan.floors.length);
    let floor = newFloor;
    if (clonePerimeter && activeFloor) {
      floor = {
        ...newFloor,
        rooms: activeFloor.rooms.map((r) => ({ ...r, id: uid('room'), floorId: newFloor.id })),
        walls: activeFloor.walls.map((w) => ({ ...w, id: uid('wall'), floorId: newFloor.id })),
        openings: [],
        zones: [],
      };
    }
    updatePlan((p) => ({ ...p, floors: [...p.floors, floor] }));
    setActiveFloorId(newFloor.id);
  }

  function renameFloor(floorId: string, name: string) {
    updatePlan((p) => ({
      ...p,
      floors: p.floors.map((f) => (f.id === floorId ? { ...f, name } : f)),
    }));
  }

  // ── Room mutations ───────────────────────────────────────────────────────

  function commitRoom(x: number, y: number, w: number, h: number) {
    const room: Room = {
      id: uid('room'),
      floorId: activeFloorId,
      name: `Room ${(activeFloor?.rooms.length ?? 0) + 1}`,
      roomType: 'other',
      x: snapToGrid(x),
      y: snapToGrid(y),
      width: Math.max(GRID * 3, snapToGrid(w)),
      height: Math.max(GRID * 3, snapToGrid(h)),
    };
    updateActiveFloor((f) => ({ ...f, rooms: [...f.rooms, room] }));
    setSelection({ kind: 'room', id: room.id });
  }

  function updateRoom(id: string, patch: Partial<Room>) {
    updateActiveFloor((f) => ({
      ...f,
      rooms: f.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }));
  }

  function deleteRoom(id: string) {
    updateActiveFloor((f) => ({ ...f, rooms: f.rooms.filter((r) => r.id !== id) }));
    if (selection?.kind === 'room' && selection.id === id) setSelection(null);
  }

  // ── Wall mutations ───────────────────────────────────────────────────────

  function commitWall(x1: number, y1: number, x2: number, y2: number, kind: WallKind = 'internal') {
    const wall: Wall = {
      id: uid('wall'),
      floorId: activeFloorId,
      kind,
      x1: snapToGrid(x1),
      y1: snapToGrid(y1),
      x2: snapToGrid(x2),
      y2: snapToGrid(y2),
    };
    updateActiveFloor((f) => ({ ...f, walls: [...f.walls, wall] }));
    setSelection({ kind: 'wall', id: wall.id });
  }

  function updateWall(id: string, patch: Partial<Wall>) {
    updateActiveFloor((f) => ({
      ...f,
      walls: f.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
  }

  function deleteWall(id: string) {
    updateActiveFloor((f) => ({ ...f, walls: f.walls.filter((w) => w.id !== id) }));
    if (selection?.kind === 'wall' && selection.id === id) setSelection(null);
  }

  // ── Placement node mutations ─────────────────────────────────────────────

  function placeNode(kind: PartKind, x: number, y: number) {
    const roomId = activeFloor?.rooms.find(
      (r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height,
    )?.id;

    const node: PlacementNode = {
      id: uid('node'),
      type: kind,
      floorId: activeFloorId,
      roomId,
      anchor: { x: snapToGrid(x), y: snapToGrid(y) },
      orientationDeg: 0,
      metadata: {},
    };
    updatePlan((p) => ({ ...p, placementNodes: [...p.placementNodes, node] }));
    setSelection({ kind: 'node', id: node.id });
  }

  function updateNode(id: string, patch: Partial<PlacementNode>) {
    updatePlan((p) => ({
      ...p,
      placementNodes: p.placementNodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
  }

  function deleteNode(id: string) {
    updatePlan((p) => ({
      ...p,
      placementNodes: p.placementNodes.filter((n) => n.id !== id),
      connections: p.connections.filter((c) => c.fromNodeId !== id && c.toNodeId !== id),
    }));
    if (selection?.kind === 'node' && selection.id === id) setSelection(null);
  }

  // ── Connection mutations (lego edges) ────────────────────────────────────

  function handlePortClick(ref: PortRef) {
    if (!pendingPort) {
      setPendingPort(ref);
      return;
    }
    if (pendingPort.nodeId === ref.nodeId && pendingPort.portId === ref.portId) {
      setPendingPort(null);
      return;
    }
    if (!isTopologyAllowed(activeFloorGraph, pendingPort, ref)) {
      setPendingPort(null);
      return;
    }
    const edge: BuildEdge = { id: uid('edge'), from: pendingPort, to: ref };
    setBuildEdgesByFloor((prev) => ({
      ...prev,
      [activeFloorId]: [...(prev[activeFloorId] ?? []), edge],
    }));
    setPendingPort(null);
  }

  // ── High-level connection (PropertyPlan connections layer) ───────────────

  function addConnection(fromNodeId: string, toNodeId: string, type: ConnectionType) {
    const from = plan.placementNodes.find((n) => n.id === fromNodeId);
    const to = plan.placementNodes.find((n) => n.id === toNodeId);
    if (!from || !to) return;

    const conn: ConnectionPath = {
      id: uid('conn'),
      type,
      fromNodeId,
      toNodeId,
      route: [
        { x: from.anchor.x, y: from.anchor.y },
        { x: to.anchor.x, y: to.anchor.y },
      ],
      routeMode: 'auto',
    };
    updatePlan((p) => ({ ...p, connections: [...p.connections, conn] }));
  }

  // ── Pointer helpers ──────────────────────────────────────────────────────

  function boardPos(e: React.PointerEvent<HTMLDivElement>): { x: number; y: number } {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp(e.clientX - rect.left, 0, CANVAS_W),
      y: clamp(e.clientY - rect.top, 0, CANVAS_H),
    };
  }

  // ── Canvas pointer handlers ──────────────────────────────────────────────

  function handleBoardPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    const pos = boardPos(e);

    if (tool === 'addRoom') {
      setRoomDraftOrigin(pos);
      setRoomDraftSize({ w: 0, h: 0 });
      return;
    }

    if (tool === 'drawWall') {
      if (!pendingWallStart) {
        setPendingWallStart(pos);
      } else {
        commitWall(pendingWallStart.x, pendingWallStart.y, pos.x, pos.y);
        setPendingWallStart(null);
      }
      return;
    }

    if (tool === 'placeNode' && pendingKind) {
      placeNode(pendingKind, pos.x, pos.y);
      setPendingKind(null);
      setGhostPos(null);
      return;
    }

    // Select deselect on background click
    if (tool === 'select') {
      setSelection(null);
    }
  }

  function handleBoardPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const pos = boardPos(e);

    // Room drag-create
    if (roomDraftOrigin) {
      setRoomDraftSize({
        w: Math.abs(pos.x - roomDraftOrigin.x),
        h: Math.abs(pos.y - roomDraftOrigin.y),
      });
      return;
    }

    // Ghost node preview
    if (tool === 'placeNode' && pendingKind) {
      setGhostPos(pos);
    }

    if (!dragRef.current) return;
    const state = dragRef.current;

    if (state.mode === 'room-move' && activeFloor) {
      const gx = snapToGrid(pos.x - state.dx);
      const gy = snapToGrid(pos.y - state.dy);
      const draft: Room = {
        ...(activeFloor.rooms.find((r) => r.id === state.id) as Room),
        x: gx,
        y: gy,
      };
      const snapped = snapRoomToSiblings(
        draft,
        activeFloor.rooms.filter((r) => r.id !== state.id),
      );
      updateActiveFloor((f) => ({
        ...f,
        rooms: f.rooms.map((r) => (r.id === state.id ? snapped : r)),
      }));
    }

    if (state.mode === 'room-resize') {
      const w = Math.max(GRID * 3, snapToGrid(state.baseW + (pos.x - state.startX)));
      const h = Math.max(GRID * 3, snapToGrid(state.baseH + (pos.y - state.startY)));
      updateActiveFloor((f) => ({
        ...f,
        rooms: f.rooms.map((r) =>
          r.id === state.id ? { ...r, width: w, height: h } : r,
        ),
      }));
    }

    if (state.mode === 'node-move') {
      updatePlan((p) => ({
        ...p,
        placementNodes: p.placementNodes.map((n) =>
          n.id === state.id
            ? { ...n, anchor: { x: snapToGrid(pos.x - state.dx), y: snapToGrid(pos.y - state.dy) } }
            : n,
        ),
      }));
    }
  }

  function handleBoardPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const pos = boardPos(e);

    // Commit room draft
    if (roomDraftOrigin && roomDraftSize) {
      const w = Math.max(GRID * 3, Math.abs(pos.x - roomDraftOrigin.x));
      const h = Math.max(GRID * 3, Math.abs(pos.y - roomDraftOrigin.y));
      const x = Math.min(roomDraftOrigin.x, pos.x);
      const y = Math.min(roomDraftOrigin.y, pos.y);
      commitRoom(x, y, w, h);
      setRoomDraftOrigin(null);
      setRoomDraftSize(null);
      setTool('select');
      return;
    }

    dragRef.current = null;
    emit(plan);
  }

  // ── Save / load ──────────────────────────────────────────────────────────

  function exportJSON() {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'property-plan.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const loaded = JSON.parse(ev.target?.result as string) as PropertyPlan;
        setPlan(loaded);
        setActiveFloorId(loaded.floors[0]?.id ?? '');
        setSelection(null);
      } catch {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  }

  // ─── Render helpers ───────────────────────────────────────────────────────

  function validationBadge(objectId: string) {
    const state = badgeForObject(validation, objectId);
    if (state === 'ok') return null;
    return (
      <span
        className={`fpb__badge fpb__badge--${state}`}
        title={
          validation.issues
            .filter((i) => i.objectId === objectId)
            .map((i) => i.message)
            .join('\n')
        }
      >
        {state === 'error' ? '✕' : '!'}
      </span>
    );
  }

  // Derive ghost room rect for addRoom tool
  const ghostRoomRect = useMemo(() => {
    if (!roomDraftOrigin || !roomDraftSize) return null;
    return {
      x: roomDraftOrigin.x,
      y: roomDraftOrigin.y,
      w: roomDraftSize.w || DEFAULT_ROOM_W,
      h: roomDraftSize.h || DEFAULT_ROOM_H,
    };
  }, [roomDraftOrigin, roomDraftSize]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (!activeFloor) return <div>No floors defined.</div>;

  return (
    <div className="fpb">
      {/* ── Header ── */}
      <header className="fpb__header">
        <div className="fpb__header-title">
          <h2>Property Builder</h2>
          <p>Layer 1: geometry &nbsp;·&nbsp; Layer 2: components &nbsp;·&nbsp; Layer 3: routes</p>
        </div>
        <div className="fpb__header-actions">
          <div className={`fpb__validation-summary fpb__validation-summary--${validation.isValid ? 'ok' : validation.errorCount > 0 ? 'error' : 'warning'}`}>
            {validation.isValid
              ? '✓ Valid'
              : `${validation.errorCount > 0 ? `${validation.errorCount} error${validation.errorCount > 1 ? 's' : ''}` : ''}${validation.errorCount > 0 && validation.warningCount > 0 ? ', ' : ''}${validation.warningCount > 0 ? `${validation.warningCount} warning${validation.warningCount > 1 ? 's' : ''}` : ''}`}
          </div>
          <button className="fpb__action-btn" onClick={exportJSON}>Export JSON</button>
          <label className="fpb__action-btn">
            Import JSON
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={importJSON} />
          </label>
        </div>
      </header>

      {/* ── Floor tabs ── */}
      <div className="fpb__floors">
        {plan.floors.map((floor) => (
          <button
            key={floor.id}
            className={`fpb__floor-tab ${activeFloorId === floor.id ? 'active' : ''}`}
            onClick={() => setActiveFloorId(floor.id)}
            onDoubleClick={() => {
              const name = prompt('Rename floor:', floor.name);
              if (name) renameFloor(floor.id, name);
            }}
            title="Double-click to rename"
          >
            {floor.name}
            <span className="fpb__floor-count">{floor.rooms.length}</span>
          </button>
        ))}
        <button className="fpb__floor-add" onClick={() => addFloor(false)} title="Add blank floor">+</button>
        <button className="fpb__floor-add" onClick={() => addFloor(true)} title="Clone perimeter from current floor">⧉</button>
      </div>

      {/* ── Workspace ── */}
      <div className="fpb__workspace">
        {/* ── Left sidebar ── */}
        <aside className="fpb__sidebar">
          {/* Tools */}
          <section className="fpb__section">
            <h3 className="fpb__section-title">Tools</h3>
            {TOOL_DEFS.map((t) => (
              <button
                key={t.id}
                className={`fpb__tool-btn ${tool === t.id ? 'active' : ''}`}
                onClick={() => {
                  setTool(t.id);
                  if (t.id !== 'placeNode') setPendingKind(null);
                  if (t.id !== 'drawWall') setPendingWallStart(null);
                  if (t.id !== 'connectRoute') setPendingPort(null);
                }}
                title={t.hint}
              >
                <span className="fpb__tool-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </section>

          {/* Component tray */}
          <section className="fpb__section">
            <h3 className="fpb__section-title">Components</h3>
            <div className="fpb__component-tray">
              {PALETTE_SECTIONS.map((section) => (
                <div key={section.category} className="fpb__palette-section">
                  <div className="fpb__palette-heading">{section.label}</div>
                  {section.items.map((item) => (
                    <button
                      key={item.kind}
                      className={`fpb__component-btn ${pendingKind === item.kind ? 'active' : ''}`}
                      onClick={() => {
                        setTool('placeNode');
                        setPendingKind(item.kind);
                      }}
                      title={`Place ${item.label} — click canvas to position`}
                    >
                      <span>{item.emoji}</span>
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>

          {/* Validation issues */}
          {validation.issues.length > 0 && (
            <section className="fpb__section">
              <h3 className="fpb__section-title">Issues</h3>
              <ul className="fpb__issue-list">
                {validation.issues.slice(0, 8).map((issue) => (
                  <li key={issue.id} className={`fpb__issue fpb__issue--${issue.severity}`}>
                    {issue.message}
                  </li>
                ))}
                {validation.issues.length > 8 && (
                  <li className="fpb__issue fpb__issue--info">
                    +{validation.issues.length - 8} more…
                  </li>
                )}
              </ul>
            </section>
          )}
        </aside>

        {/* ── Canvas area ── */}
        <div className="fpb__canvas-wrap">
          {/* Tool hint bar */}
          <div className="fpb__hint-bar">
            {TOOL_DEFS.find((t) => t.id === tool)?.hint}
            {pendingKind && ` — selected: ${pendingKind.replace(/_/g, ' ')}`}
            {pendingWallStart && ' — click endpoint to complete wall'}
            {pendingPort && ' — click target port to connect'}
          </div>

          <div
            className={`fpb__board fpb__board--tool-${tool}`}
            ref={boardRef}
            onPointerDown={handleBoardPointerDown}
            onPointerMove={handleBoardPointerMove}
            onPointerUp={handleBoardPointerUp}
            onPointerCancel={handleBoardPointerUp}
          >
            {/* ── SVG: grid + walls + edges + overlays ── */}
            <svg
              className="fpb__svg"
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Grid */}
              <defs>
                <pattern id="fpb-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
                </pattern>
                <pattern id="fpb-grid-major" width={GRID * 4} height={GRID * 4} patternUnits="userSpaceOnUse">
                  <rect width={GRID * 4} height={GRID * 4} fill="url(#fpb-grid)" />
                  <path d={`M ${GRID * 4} 0 L 0 0 0 ${GRID * 4}`} fill="none" stroke="#cbd5e1" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#fpb-grid-major)" />

              {/* ── Layer 1: Walls (SVG) ── */}
              {activeFloor.walls.map((wall) => (
                <g key={wall.id}>
                  <line
                    x1={wall.x1} y1={wall.y1} x2={wall.x2} y2={wall.y2}
                    stroke={selection?.kind === 'wall' && selection.id === wall.id ? '#2563eb' : wall.kind === 'external' ? '#0f172a' : '#475569'}
                    strokeWidth={wall.kind === 'external' ? 6 : 3}
                    strokeLinecap="round"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tool === 'select') setSelection({ kind: 'wall', id: wall.id });
                    }}
                  />
                  {/* Wall kind label */}
                  <text
                    x={(wall.x1 + wall.x2) / 2}
                    y={(wall.y1 + wall.y2) / 2 - 5}
                    fontSize="9"
                    fill="#94a3b8"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                  >
                    {wall.kind === 'external' ? 'ext' : ''}
                  </text>
                </g>
              ))}

              {/* ── Layer 3: Lego edges (connection routes) ── */}
              {activeEdges.map((edge) => {
                const fromNode = visibleNodes.find((n) => n.id === edge.from.nodeId);
                const toNode = visibleNodes.find((n) => n.id === edge.to.nodeId);
                if (!fromNode || !toNode) return null;
                const fromBuild: BuildNode = { id: fromNode.id, kind: fromNode.type, x: fromNode.anchor.x, y: fromNode.anchor.y, r: 0 };
                const toBuild: BuildNode = { id: toNode.id, kind: toNode.type, x: toNode.anchor.x, y: toNode.anchor.y, r: 0 };
                const from = portAbs(fromBuild, edge.from.portId);
                const to = portAbs(toBuild, edge.to.portId);
                const mx = (from.x + to.x) / 2;
                return (
                  <polyline
                    key={edge.id}
                    points={`${from.x},${from.y} ${mx},${from.y} ${mx},${to.y} ${to.x},${to.y}`}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth={3}
                    strokeDasharray="6 3"
                  />
                );
              })}

              {/* Wall being drawn — live preview */}
              {pendingWallStart && (
                <circle cx={pendingWallStart.x} cy={pendingWallStart.y} r={5} fill="#2563eb" />
              )}

              {/* Room being drawn — ghost outline */}
              {ghostRoomRect && (
                <rect
                  x={ghostRoomRect.x}
                  y={ghostRoomRect.y}
                  width={ghostRoomRect.w}
                  height={ghostRoomRect.h}
                  fill="rgba(37,99,235,0.08)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
              )}

              {/* Ghost node being placed */}
              {ghostPos && pendingKind && (
                <g transform={`translate(${ghostPos.x - 40}, ${ghostPos.y - 18})`} opacity="0.55">
                  <rect width={80} height={36} rx={8} fill="#f0f9ff" stroke="#2563eb" strokeWidth={2} />
                  <text x={40} y={22} textAnchor="middle" fontSize={10} fill="#1e40af">
                    {pendingKind.replace(/_/g, ' ')}
                  </text>
                </g>
              )}
            </svg>

            {/* ── Layer 1: Rooms (DOM divs for easy interaction) ── */}
            {activeFloor.rooms.map((room) => {
              const isSelected = selection?.kind === 'room' && selection.id === room.id;
              const badge = badgeForObject(validation, room.id);
              return (
                <div
                  key={room.id}
                  className={`fpb__room fpb__room--${room.roomType} ${isSelected ? 'selected' : ''} fpb__room--badge-${badge}`}
                  style={{ left: room.x, top: room.y, width: room.width, height: room.height }}
                  onPointerDown={(e) => {
                    if (tool !== 'select') return;
                    e.stopPropagation();
                    setSelection({ kind: 'room', id: room.id });
                    const pos = boardPos(e as unknown as React.PointerEvent<HTMLDivElement>);
                    dragRef.current = { mode: 'room-move', id: room.id, dx: pos.x - room.x, dy: pos.y - room.y };
                  }}
                >
                  <div className="fpb__room-label">{room.name}</div>
                  <div className="fpb__room-type">{ROOM_TYPE_LABELS[room.roomType]}</div>
                  <div className="fpb__room-measure">
                    {toMeters(room.width)}m × {toMeters(room.height)}m
                  </div>
                  {badge !== 'ok' && validationBadge(room.id)}
                  {isSelected && (
                    <div
                      className="fpb__room-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const pos = boardPos(e as unknown as React.PointerEvent<HTMLDivElement>);
                        dragRef.current = {
                          mode: 'room-resize',
                          id: room.id,
                          startX: pos.x,
                          startY: pos.y,
                          baseW: room.width,
                          baseH: room.height,
                        };
                      }}
                    />
                  )}
                </div>
              );
            })}

            {/* ── Layer 2: Placement nodes (DOM divs) ── */}
            {visibleNodes.map((node) => {
              const isSelected = selection?.kind === 'node' && selection.id === node.id;
              const badge = badgeForObject(validation, node.id);
              const palette = PALETTE_SECTIONS.flatMap((s) => s.items).find((i) => i.kind === node.type);
              const room = node.roomId ? activeFloor.rooms.find((r) => r.id === node.roomId) : null;
              const buildNode: BuildNode = { id: node.id, kind: node.type, x: node.anchor.x, y: node.anchor.y, r: 0 };
              return (
                <div
                  key={node.id}
                  className={`fpb__node ${isSelected ? 'selected' : ''} fpb__node--badge-${badge}`}
                  style={{ left: node.anchor.x - 52, top: node.anchor.y - 22 }}
                  onPointerDown={(e) => {
                    if (tool !== 'select' && tool !== 'connectRoute') return;
                    e.stopPropagation();
                    setSelection({ kind: 'node', id: node.id });
                    if (tool === 'select') {
                      const pos = boardPos(e as unknown as React.PointerEvent<HTMLDivElement>);
                      dragRef.current = { mode: 'node-move', id: node.id, dx: pos.x - node.anchor.x, dy: pos.y - node.anchor.y };
                    }
                  }}
                  title={room ? `In: ${room.name}` : 'Not in a room'}
                >
                  <span className="fpb__node-emoji">{palette?.emoji ?? '🔧'}</span>
                  <span className="fpb__node-label">{palette?.label ?? node.type.replace(/_/g, ' ')}</span>
                  {badge !== 'ok' && validationBadge(node.id)}

                  {/* Ports — visible in connectRoute mode */}
                  {tool === 'connectRoute' && getPortDefs(node.type).map((port) => (
                    <button
                      key={port.id}
                      className={`fpb__port ${pendingPort?.nodeId === node.id && pendingPort.portId === port.id ? 'pending' : ''}`}
                      style={{
                        left: portAbs(buildNode, port.id).x - node.anchor.x + 52 - 6,
                        top: portAbs(buildNode, port.id).y - node.anchor.y + 22 - 6,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePortClick({ nodeId: node.id, portId: port.id });
                      }}
                      title={`${port.label ?? port.id} (${port.role ?? ''})`}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right inspector panel ── */}
        {selection && (
          <aside className="fpb__inspector">
            {selectedRoom && (
              <InspectorRoom
                room={selectedRoom}
                floors={plan.floors}
                onUpdate={(patch) => updateRoom(selectedRoom.id, patch)}
                onDelete={() => deleteRoom(selectedRoom.id)}
              />
            )}
            {selectedWall && (
              <InspectorWall
                wall={selectedWall}
                onUpdate={(patch) => updateWall(selectedWall.id, patch)}
                onDelete={() => deleteWall(selectedWall.id)}
              />
            )}
            {selectedNode && (
              <InspectorNode
                node={selectedNode}
                rooms={activeFloor.rooms}
                onUpdate={(patch) => updateNode(selectedNode.id, patch)}
                onDelete={() => deleteNode(selectedNode.id)}
              />
            )}
          </aside>
        )}
      </div>

      {/* ── Simulation panel ── */}
      {visibleNodes.length > 0 && (
        <section className="fpb__simulation">
          <div className="fpb__simulation-header">
            <h3>System Simulation</h3>
            <p>
              {visibleNodes.length} component{visibleNodes.length !== 1 ? 's' : ''} placed on {activeFloor.name}.
              {' '}The lego builder below uses this floor's components to run a live physics model.
            </p>
            <button
              className={`fpb__sim-toggle ${showSimulation ? 'active' : ''}`}
              onClick={() => setShowSimulation((v) => !v)}
            >
              {showSimulation ? 'Hide simulation' : 'Run simulation ▶'}
            </button>
          </div>
          {showSimulation && (
            <div className="fpb__simulation-shell">
              <BuilderShell initial={activeFloorGraph} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─── Inspector sub-components ─────────────────────────────────────────────────

function InspectorRoom({
  room,
  floors,
  onUpdate,
  onDelete,
}: {
  room: Room;
  floors: FloorPlan[];
  onUpdate: (patch: Partial<Room>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span>Room</span>
        <button className="fpb__delete-btn" onClick={onDelete} title="Delete room">✕</button>
      </div>
      <label className="fpb__field">
        <span>Name</span>
        <input
          type="text"
          value={room.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </label>
      <label className="fpb__field">
        <span>Type</span>
        <select
          value={room.roomType}
          onChange={(e) => onUpdate({ roomType: e.target.value as RoomType })}
        >
          {(Object.keys(ROOM_TYPE_LABELS) as RoomType[]).map((rt) => (
            <option key={rt} value={rt}>{ROOM_TYPE_LABELS[rt]}</option>
          ))}
        </select>
      </label>
      <label className="fpb__field">
        <span>Floor</span>
        <select
          value={room.floorId}
          onChange={(e) => onUpdate({ floorId: e.target.value })}
        >
          {floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      <div className="fpb__field fpb__field--static">
        <span>Dimensions</span>
        <span>{toMeters(room.width)} m × {toMeters(room.height)} m</span>
      </div>
      <div className="fpb__field fpb__field--static">
        <span>Area</span>
        <span>{((room.width / GRID) * (room.height / GRID)).toFixed(1)} m²</span>
      </div>
      <label className="fpb__field">
        <span>Notes</span>
        <textarea
          rows={3}
          value={room.notes ?? ''}
          onChange={(e) => onUpdate({ notes: e.target.value })}
        />
      </label>
    </div>
  );
}

function InspectorWall({
  wall,
  onUpdate,
  onDelete,
}: {
  wall: Wall;
  onUpdate: (patch: Partial<Wall>) => void;
  onDelete: () => void;
}) {
  const length = Math.sqrt(
    (wall.x2 - wall.x1) ** 2 + (wall.y2 - wall.y1) ** 2,
  );
  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span>Wall</span>
        <button className="fpb__delete-btn" onClick={onDelete} title="Delete wall">✕</button>
      </div>
      <label className="fpb__field">
        <span>Kind</span>
        <select
          value={wall.kind}
          onChange={(e) => onUpdate({ kind: e.target.value as WallKind })}
        >
          <option value="internal">Internal</option>
          <option value="external">External</option>
        </select>
      </label>
      <div className="fpb__field fpb__field--static">
        <span>Length</span>
        <span>{toMeters(length)} m</span>
      </div>
      <label className="fpb__field">
        <span>Thickness (mm)</span>
        <input
          type="number"
          min={50}
          max={600}
          step={10}
          value={wall.thicknessMm ?? 100}
          onChange={(e) => onUpdate({ thicknessMm: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}

const NODE_METADATA_FIELDS: Partial<Record<PartKind, { key: string; label: string; type: 'text' | 'select'; options?: string[] }[]>> = {
  heat_source_combi:          [{ key: 'model', label: 'Model', type: 'text' }, { key: 'flueDirection', label: 'Flue Direction', type: 'select', options: ['Rear', 'Left', 'Right', 'Top', 'Roof'] }],
  heat_source_system_boiler:  [{ key: 'model', label: 'Model', type: 'text' }, { key: 'flueDirection', label: 'Flue Direction', type: 'select', options: ['Rear', 'Left', 'Right', 'Top', 'Roof'] }],
  heat_source_regular_boiler: [{ key: 'model', label: 'Model', type: 'text' }],
  heat_source_heat_pump:      [{ key: 'model', label: 'Model', type: 'text' }, { key: 'location', label: 'Location', type: 'select', options: ['Side wall', 'Rear wall', 'Garden', 'Front'] }],
  dhw_unvented_cylinder:      [{ key: 'volumeL', label: 'Volume (L)', type: 'text' }, { key: 'heightMm', label: 'Height (mm)', type: 'text' }],
  dhw_mixergy:                [{ key: 'volumeL', label: 'Volume (L)', type: 'text' }],
  dhw_vented_cylinder:        [{ key: 'volumeL', label: 'Volume (L)', type: 'text' }],
};

function InspectorNode({
  node,
  rooms,
  onUpdate,
  onDelete,
}: {
  node: PlacementNode;
  rooms: Room[];
  onUpdate: (patch: Partial<PlacementNode>) => void;
  onDelete: () => void;
}) {
  const palette = PALETTE_SECTIONS.flatMap((s) => s.items).find((i) => i.kind === node.type);
  const extraFields = NODE_METADATA_FIELDS[node.type] ?? [];
  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span>{palette?.emoji} {palette?.label ?? node.type.replace(/_/g, ' ')}</span>
        <button className="fpb__delete-btn" onClick={onDelete} title="Delete node">✕</button>
      </div>
      <label className="fpb__field">
        <span>Room</span>
        <select
          value={node.roomId ?? ''}
          onChange={(e) => onUpdate({ roomId: e.target.value || undefined })}
        >
          <option value="">— no room —</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <label className="fpb__field">
        <span>Orientation (°)</span>
        <input
          type="number"
          min={0}
          max={359}
          step={90}
          value={node.orientationDeg ?? 0}
          onChange={(e) => onUpdate({ orientationDeg: Number(e.target.value) })}
        />
      </label>
      {extraFields.map((f) => (
        <label key={f.key} className="fpb__field">
          <span>{f.label}</span>
          {f.type === 'select' ? (
            <select
              value={(node.metadata[f.key] as string) ?? ''}
              onChange={(e) =>
                onUpdate({ metadata: { ...node.metadata, [f.key]: e.target.value } })
              }
            >
              <option value="">—</option>
              {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type="text"
              value={(node.metadata[f.key] as string) ?? ''}
              onChange={(e) =>
                onUpdate({ metadata: { ...node.metadata, [f.key]: e.target.value } })
              }
            />
          )}
        </label>
      ))}
      <div className="fpb__field fpb__field--static">
        <span>Position</span>
        <span>{toMeters(node.anchor.x)} m, {toMeters(node.anchor.y)} m</span>
      </div>
    </div>
  );
}

function toMeters(px: number) {
  return (px / GRID).toFixed(1);
}
