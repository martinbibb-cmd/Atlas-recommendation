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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BuilderShell from '../../explainers/lego/builder/BuilderShell';
import { PALETTE_SECTIONS } from '../../explainers/lego/builder/palette';
import { getPortDefs } from '../../explainers/lego/builder/portDefs';
import { portAbs } from '../../explainers/lego/builder/snapConnect';
import { isTopologyAllowed } from '../../explainers/lego/builder/snapConnect';
import type { BuildEdge, BuildGraph, BuildNode, PartKind, PortRef } from '../../explainers/lego/builder/types';
import {
  PROPERTY_LAYOUTS,
  type FloorLevel,
  type PropertyLayoutId,
} from '../../explainers/lego/builder/propertyLayouts';
import type {
  DisruptionAnnotation,
  DisruptionKind,
  EditorTool,
  FloorPlan,
  PlacementNode,
  PropertyMetadata,
  PropertyPlan,
  Room,
  RoomType,
  SelectionTarget,
  ViewMode,
  Wall,
  WallKind,
} from './propertyPlan.types';
import {
  DISRUPTION_KIND_EMOJI,
  DISRUPTION_KIND_LABELS,
  ROOM_TYPE_LABELS,
} from './propertyPlan.types';
import { autoRouteHeatingPipes, canPlaceInProfessionalPlan, computeDisruptionAnnotations, createManualRoom, deriveFloorplanOutputs } from './floorplanDerivations';
import type { AutoRoute, DerivedFloorplanOutput } from './floorplanDerivations';
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

// ─── Template loading ─────────────────────────────────────────────────────────

/** Derive a RoomType from the room label string. */
function roomTypeFromLabel(label: string): RoomType {
  const l = label.toLowerCase();
  if (/bedroom|bed\s*\d/.test(l))   return 'bedroom';
  if (/bathroom|en.?suite/.test(l)) return 'bathroom';
  if (/kitchen/.test(l))            return 'kitchen';
  if (/living|lounge/.test(l))      return 'living';
  if (/dining/.test(l))             return 'dining';
  if (/landing/.test(l))            return 'landing';
  if (/hall/.test(l))               return 'hallway';
  if (/study|office/.test(l))       return 'study';
  if (/garage/.test(l))             return 'garage';
  if (/utility/.test(l))            return 'utility';
  if (/cupboard|airing/.test(l))    return 'cupboard';
  if (/conserv/.test(l))            return 'conservatory';
  if (/outside|garden|balcony/.test(l)) return 'outside';
  return 'other';
}

/** Derive a PartKind for a PlantAnchor based on its kind. */
function partKindForAnchor(kind: import('../../explainers/lego/builder/propertyLayouts').PlantAnchorKind): PartKind {
  switch (kind) {
    case 'boiler_option_1':
    case 'boiler_option_2':   return 'heat_source_combi';
    case 'cylinder_option_1':
    case 'cylinder_option_2': return 'dhw_unvented_cylinder';
    case 'heat_pump_outside': return 'heat_source_heat_pump';
    case 'airing_cupboard':   return 'dhw_unvented_cylinder';
    default:                  return 'heat_source_combi';
  }
}

/**
 * Build a PropertyPlan from a PROPERTY_LAYOUTS entry.
 * Converts the 800×560 SVG viewport coordinates into the canvas coordinate
 * system used by FloorPlanBuilder (which also uses an ~1080×620 canvas).
 */
function planFromLayout(
  layout: import('../../explainers/lego/builder/propertyLayouts').PropertyLayout,
  metadata: PropertyMetadata = {},
): PropertyPlan {
  // Scale from the 800×560 layout viewport to the 1080×620 builder canvas
  const scaleX = CANVAS_W / 800;
  const scaleY = CANVAS_H / 560;

  // Collect unique floor levels and create FloorPlan objects
  const floorLevels = [...new Set(layout.rooms.map(r => r.floor))]
    .filter(f => f !== 'outside' && f !== 'roof')
    .sort((a, b) => {
      const order = { single: 0, ground: 0, first: 1 };
      return (order[a as keyof typeof order] ?? 0) - (order[b as keyof typeof order] ?? 0);
    });

  const floors: FloorPlan[] = floorLevels.map((level, idx) => ({
    id: uid('floor'),
    name: level === 'single' ? 'Ground' : level === 'ground' ? 'Ground' : 'First',
    levelIndex: idx,
    rooms: [],
    walls: [],
    openings: [],
    zones: [],
  }));

  const floorByLevel = new Map<FloorLevel, FloorPlan>(floorLevels.map((level, idx) => [level, floors[idx]]));

  // Build room id → floorId map
  const roomFloorMap = new Map<string, string>();

  // Assign rooms to floors
  const roomsByFloor = new Map<string, Room[]>();
  floors.forEach(f => roomsByFloor.set(f.id, []));

  for (const rd of layout.rooms) {
    const floor = floorByLevel.get(rd.floor) ?? floors[0];
    const room: Room = {
      id: rd.id,
      name: rd.label,
      roomType: roomTypeFromLabel(rd.label),
      floorId: floor.id,
      x: Math.round(rd.x * scaleX),
      y: Math.round(rd.y * scaleY),
      width: Math.round(rd.w * scaleX),
      height: Math.round(rd.h * scaleY),
      areaM2: Math.round((rd.w * rd.h) / 10000 * scaleX * scaleY * 100) / 100,
    };
    roomsByFloor.get(floor.id)?.push(room);
    roomFloorMap.set(rd.id, floor.id);
  }

  // Apply rooms to their floors
  const floorsWithRooms: FloorPlan[] = floors.map(f => ({
    ...f,
    rooms: roomsByFloor.get(f.id) ?? [],
  }));

  // Create placement nodes for radiator anchors
  const radiatorNodes: PlacementNode[] = layout.radiatorAnchors.map(ra => ({
    id: ra.id,
    type: 'radiator_loop' as PartKind,
    floorId: roomFloorMap.get(ra.roomId) ?? floorsWithRooms[0]?.id ?? '',
    roomId: ra.roomId,
    anchor: {
      x: Math.round(ra.x * scaleX),
      y: Math.round(ra.y * scaleY),
    },
    orientationDeg: 0,
    metadata: {},
  }));

  // Create placement nodes for plant anchors (heat source, cylinder, heat pump)
  const plantNodes: PlacementNode[] = layout.plantAnchors.map(pa => {
    const floorId = pa.roomId
      ? (roomFloorMap.get(pa.roomId) ?? floorsWithRooms[0]?.id ?? '')
      : floorsWithRooms[0]?.id ?? '';
    return {
      id: pa.id,
      type: partKindForAnchor(pa.kind),
      floorId,
      roomId: pa.roomId ?? undefined,
      anchor: {
        x: Math.round(pa.x * scaleX),
        y: Math.round(pa.y * scaleY),
      },
      orientationDeg: 0,
      metadata: { anchorKind: pa.kind, anchorLabel: pa.label },
    };
  });

  return {
    version: '1.0',
    propertyId: uid('prop'),
    floors: floorsWithRooms,
    placementNodes: [...radiatorNodes, ...plantNodes],
    connections: [],
    metadata: { ...metadata, templateId: layout.id },
  };
}

// ─── Starter template definitions ─────────────────────────────────────────────

const STARTER_TEMPLATES: Array<{ id: PropertyLayoutId; emoji: string; hint: string }> = [
  { id: '2bed_house',  emoji: '🏠', hint: '2-bed house — 2 floors, radiators pre-placed' },
  { id: '3bed_semi',   emoji: '🏡', hint: '3-bed semi — 2 floors, radiators pre-placed' },
  { id: 'bungalow',    emoji: '🏘', hint: 'Bungalow — single floor, airing cupboard' },
  { id: 'flat',        emoji: '🏢', hint: 'Flat — single floor with balcony ASHP space' },
];

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
  /** Derived room metrics and heating-planning outputs from the canvas geometry. */
  derivedOutputs: DerivedFloorplanOutput;
}

interface Props {
  surveyResults?: { systemType?: 'combi' | 'system' | 'regular' | 'heat_pump' };
  onChange?: (output: FloorPlanOutput) => void;
}

// ─── Tool config ──────────────────────────────────────────────────────────────

const TOOL_DEFS: { id: EditorTool; label: string; icon: string; hint: string }[] = [
  { id: 'select',        label: 'Select',       icon: '↖',  hint: 'Click to select; drag to move' },
  { id: 'addRoom',       label: 'Add Room',     icon: '⬛', hint: 'Click canvas to place room; drag to size' },
  { id: 'drawWall',      label: 'Draw Wall',    icon: '📏', hint: 'Click start, click end to draw wall' },
  { id: 'addOpening',    label: 'Opening',      icon: '🚪', hint: 'Click a wall to add door/window' },
  { id: 'placeNode',     label: 'Place Node',   icon: '🔧', hint: 'Select component from tray, click canvas' },
  { id: 'connectRoute',  label: 'Connect',      icon: '〰', hint: 'Click source node, then target node' },
  { id: 'addDisruption', label: 'Disruption',   icon: '⚠️', hint: 'Click canvas to place a disruption / consequence marker' },
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
  /** Whether the user has applied a starter template (suppresses template bar) */
  const [templateApplied, setTemplateApplied] = useState(true);
  const [defaultRoomHeightM, setDefaultRoomHeightM] = useState(2.4);
  const [manualRoomName, setManualRoomName] = useState('New room');
  const [manualRoomWidthM, setManualRoomWidthM] = useState(3.6);
  const [manualRoomLengthM, setManualRoomLengthM] = useState(3.6);
  const [manualRoomFloorId, setManualRoomFloorId] = useState<string>(() => plan.floors[0]?.id ?? '');

  /** Customer / engineer presentation mode */
  const [viewMode, setViewMode] = useState<ViewMode>('customer');
  /** Disruption kind selected for the addDisruption tool */
  const [pendingDisruptionKind, setPendingDisruptionKind] = useState<DisruptionKind>('boxing');

  // ── Zoom & pan state ────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── Bottom sheet & editor state ─────────────────────────────────────────
  const [showAddRoomSheet, setShowAddRoomSheet] = useState(false);
  const [addRoomSheetMode, setAddRoomSheetMode] = useState<'menu' | 'form'>('menu');
  const [showObjectBrowser, setShowObjectBrowser] = useState(false);
  const [editingDimension, setEditingDimension] = useState<{
    type: 'room-width' | 'room-height' | 'wall-length';
    currentValue: number;
    id: string;
  } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<
    | { mode: 'room-move'; id: string; dx: number; dy: number }
    | { mode: 'room-resize'; id: string; startX: number; startY: number; baseW: number; baseH: number }
    | { mode: 'node-move'; id: string; dx: number; dy: number }
    | null
  >(null);

  // ── Starter template loading ──────────────────────────────────────────────

  function loadTemplate(id: PropertyLayoutId) {
    const layout = PROPERTY_LAYOUTS.find(l => l.id === id);
    if (!layout) return;
    const newPlan = planFromLayout(layout, { systemType: surveyResults?.systemType });
    setPlan(newPlan);
    setActiveFloorId(newPlan.floors[0]?.id ?? '');
    setBuildEdgesByFloor({});
    setSelection(null);
    setPendingKind(null);
    setPendingPort(null);
    setPendingWallStart(null);
    setTemplateApplied(true);
  }

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

  const derivedOutputs = useMemo(
    () => deriveFloorplanOutputs(plan, defaultRoomHeightM),
    [plan, defaultRoomHeightM],
  );

  /** Auto-routed heating pipes for the active floor. Recomputed on node/room changes. */
  const autoRoutes = useMemo<AutoRoute[]>(() => {
    if (!activeFloor) return [];
    return autoRouteHeatingPipes(visibleNodes, activeFloor.rooms);
  }, [visibleNodes, activeFloor]);

  /** Auto-suggested disruption annotations derived from the full plan. */
  const suggestedDisruptions = useMemo<DisruptionAnnotation[]>(
    () => computeDisruptionAnnotations(plan),
    [plan],
  );

  /** All disruption annotations to render: user-placed + auto-suggested. */
  const allDisruptions = useMemo<DisruptionAnnotation[]>(() => {
    const userPlaced = plan.disruptions ?? [];
    // Only show suggestions that don't duplicate a user-placed annotation at the
    // same position and kind.
    const suggested = suggestedDisruptions.filter(
      (s) => !userPlaced.some((u) => u.kind === s.kind && Math.abs(u.x - s.x) < 12 && Math.abs(u.y - s.y) < 12),
    );
    return [...userPlaced, ...suggested];
  }, [plan.disruptions, suggestedDisruptions]);

  /** Disruptions on the currently active floor. */
  const activeFloorDisruptions = useMemo(
    () => allDisruptions.filter((d) => d.floorId === activeFloorId),
    [allDisruptions, activeFloorId],
  );

  useEffect(() => {
    if (!manualRoomFloorId && plan.floors[0]?.id) setManualRoomFloorId(plan.floors[0].id);
  }, [manualRoomFloorId, plan.floors]);

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

  const selectedDisruption = useMemo(() => {
    if (selection?.kind !== 'disruption') return null;
    return (plan.disruptions ?? []).find((d) => d.id === selection.id) ?? null;
  }, [selection, plan.disruptions]);

  // ── Emit helper ──────────────────────────────────────────────────────────

  const emit = useCallback(
    (nextPlan: PropertyPlan) => {
      onChange?.({
        plan: nextPlan,
        activeFloorGraph: buildGraphFromNodes(
          nextPlan.placementNodes.filter((n) => n.floorId === activeFloorId),
          buildEdgesByFloor[activeFloorId] ?? [],
        ),
        derivedOutputs: deriveFloorplanOutputs(nextPlan, defaultRoomHeightM),
      });
    },
    [onChange, activeFloorId, buildEdgesByFloor, defaultRoomHeightM],
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

  function createRoomFromManualForm() {
    const targetFloorId = manualRoomFloorId || activeFloorId;
    const room = createManualRoom({
      name: manualRoomName,
      widthM: manualRoomWidthM,
      lengthM: manualRoomLengthM,
      floorId: targetFloorId,
      defaultHeightM: defaultRoomHeightM,
      roomType: 'other',
      x: GRID,
      y: GRID,
    }, uid('room'));

    updatePlan((p) => ({
      ...p,
      metadata: { ...p.metadata, defaultRoomHeightM },
      floors: p.floors.map((f) => (f.id === targetFloorId ? { ...f, rooms: [...f.rooms, room] } : f)),
    }));
    setSelection({ kind: 'room', id: room.id });
    setActiveFloorId(targetFloorId);
  }

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
      heightM: defaultRoomHeightM,
      areaM2: Number((((Math.max(GRID * 3, snapToGrid(w)) / GRID) * (Math.max(GRID * 3, snapToGrid(h)) / GRID))).toFixed(2)),
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
    if (!canPlaceInProfessionalPlan(kind)) return;
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

  // ── Disruption annotation mutations ──────────────────────────────────────

  function placeDisruption(kind: DisruptionKind, x: number, y: number) {
    const ann: DisruptionAnnotation = {
      id: uid('dis'),
      kind,
      floorId: activeFloorId,
      x: snapToGrid(x),
      y: snapToGrid(y),
    };
    updatePlan((p) => ({ ...p, disruptions: [...(p.disruptions ?? []), ann] }));
    setSelection({ kind: 'disruption', id: ann.id });
  }

  function updateDisruption(id: string, patch: Partial<DisruptionAnnotation>) {
    updatePlan((p) => ({
      ...p,
      disruptions: (p.disruptions ?? []).map((d) => (d.id === id ? { ...d, ...patch } : d)),
    }));
  }

  function deleteDisruption(id: string) {
    updatePlan((p) => ({
      ...p,
      disruptions: (p.disruptions ?? []).filter((d) => d.id !== id),
    }));
    if (selection?.kind === 'disruption' && selection.id === id) setSelection(null);
  }

  // ── Pointer helpers ──────────────────────────────────────────────────────

  function boardPos(e: React.PointerEvent<HTMLDivElement>): { x: number; y: number } {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: clamp((e.clientX - rect.left - panOffset.x) / zoom, 0, CANVAS_W),
      y: clamp((e.clientY - rect.top - panOffset.y) / zoom, 0, CANVAS_H),
    };
  }

  // ── Canvas pointer handlers ──────────────────────────────────────────────

  function handleBoardDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/x-floorplan-kind');
    if (!raw) return;
    const kind = raw as PartKind;
    if (!canPlaceInProfessionalPlan(kind)) return;
    const pos = boardPos(e as unknown as React.PointerEvent<HTMLDivElement>);
    placeNode(kind, pos.x, pos.y);
    setPendingKind(null);
    setGhostPos(null);
  }

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

    if (tool === 'addDisruption') {
      placeDisruption(pendingDisruptionKind, pos.x, pos.y);
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

  // ── Zoom & pan handlers ──────────────────────────────────────────────────

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((prev) => clamp(prev + delta, 0.25, 3));
  }

  function handleZoomIn() {
    setZoom((prev) => clamp(prev + 0.25, 0.25, 3));
  }

  function handleZoomOut() {
    setZoom((prev) => clamp(prev - 0.25, 0.25, 3));
  }

  function handleFitFloor() {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }

  // ── Dimension editor ──────────────────────────────────────────────────────

  function handleDimensionApply() {
    if (!editingDimension) return;
    const { type, currentValue, id } = editingDimension;
    const canvasUnits = Math.max(GRID * 3, snapToGrid(currentValue * GRID));
    if (type === 'room-width') {
      updateRoom(id, { width: canvasUnits });
    } else if (type === 'room-height') {
      updateRoom(id, { height: canvasUnits });
    } else if (type === 'wall-length') {
      const wall = activeFloor?.walls.find((w) => w.id === id);
      if (wall) {
        const oldLen = Math.sqrt((wall.x2 - wall.x1) ** 2 + (wall.y2 - wall.y1) ** 2);
        if (oldLen > 0) {
          const scale = (currentValue * GRID) / oldLen;
          const dx = (wall.x2 - wall.x1) * scale;
          const dy = (wall.y2 - wall.y1) * scale;
          updateWall(id, { x2: snapToGrid(wall.x1 + dx), y2: snapToGrid(wall.y1 + dy) });
        }
      }
    }
    setEditingDimension(null);
  }

  // ── Bottom action bar helpers ─────────────────────────────────────────────

  function duplicateRoom(room: Room) {
    const newRoom: Room = {
      ...room,
      id: uid('room'),
      name: `${room.name} (copy)`,
      x: room.x + GRID * 2,
      y: room.y + GRID * 2,
    };
    updateActiveFloor((f) => ({ ...f, rooms: [...f.rooms, newRoom] }));
    setSelection({ kind: 'room', id: newRoom.id });
  }

  function duplicateNode(node: PlacementNode) {
    const newNode: PlacementNode = {
      ...node,
      id: uid('node'),
      anchor: { x: node.anchor.x + GRID * 2, y: node.anchor.y + GRID * 2 },
    };
    updatePlan((p) => ({ ...p, placementNodes: [...p.placementNodes, newNode] }));
    setSelection({ kind: 'node', id: newNode.id });
  }

  function rotateNode(node: PlacementNode) {
    updateNode(node.id, { orientationDeg: ((node.orientationDeg ?? 0) + 90) % 360 });
  }

  function openDimensionEditor(type: 'room-width' | 'room-height' | 'wall-length', currentValue: number, id: string) {
    return (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingDimension({ type, currentValue, id });
    };
  }

  // ─── Render helpers ───────────────────────────────────────────────────────

  /** Customer-friendly label for each disruption kind. */
  function customerDisruptionLabel(kind: DisruptionKind): string {
    switch (kind) {
      case 'floorLift':   return 'Floor work here';
      case 'boxing':      return 'Boxed pipework';
      case 'wallChase':   return 'Wall work here';
      case 'coreDrill':   return 'Drill through wall';
      case 'externalRun': return 'External pipework';
    }
  }

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
          <p>Layer 1: geometry &nbsp;·&nbsp; Layer 2: components &nbsp;·&nbsp; Layer 3: routes &nbsp;·&nbsp; Layer 4: consequences</p>
        </div>
        <div className="fpb__header-actions">
          {/* ── View mode toggle ── */}
          <div className="fpb__view-toggle" role="group" aria-label="View mode">
            <button
              className={`fpb__view-btn ${viewMode === 'customer' ? 'active' : ''}`}
              onClick={() => setViewMode('customer')}
              title="Customer view — simplified labels, disruption emphasis"
            >
              👤 Customer
            </button>
            <button
              className={`fpb__view-btn ${viewMode === 'engineer' ? 'active' : ''}`}
              onClick={() => setViewMode('engineer')}
              title="Engineer view — full dimensions, pipe sizes, route labels"
            >
              🔧 Engineer
            </button>
          </div>
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

      {/* ── Starter template bar — shown until a template is applied ── */}
      {!templateApplied && (
        <div className="fpb__template-bar" role="region" aria-label="Starter templates">
          <span className="fpb__template-label">Start from template:</span>
          {STARTER_TEMPLATES.map(tmpl => {
            const layout = PROPERTY_LAYOUTS.find(l => l.id === tmpl.id);
            return (
              <button
                key={tmpl.id}
                className="fpb__template-btn"
                title={tmpl.hint}
                onClick={() => loadTemplate(tmpl.id)}
              >
                <span aria-hidden="true">{tmpl.emoji}</span>
                {layout?.label ?? tmpl.id}
              </button>
            );
          })}
          <button
            className="fpb__template-btn fpb__template-btn--blank"
            title="Start with a blank canvas"
            onClick={() => setTemplateApplied(true)}
          >
            Blank canvas
          </button>
        </div>
      )}

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
        <button
          className="fpb__floor-add fpb__floor-add--room"
          onClick={() => { setShowAddRoomSheet(true); setAddRoomSheetMode('menu'); }}
          title="Add room to current floor"
        >
          + Room
        </button>
      </div>

      {/* ── Workspace ── */}
      <div className="fpb__workspace">
        {/* ── Left sidebar ── */}
        <aside className="fpb__sidebar">
          <section className="fpb__section">
            <h3 className="fpb__section-title">Manual room layout</h3>
            <label className="fpb__field">
              <span>Default room height (m)</span>
              <input type="number" min={2} max={4} step={0.1} value={defaultRoomHeightM} onChange={(e) => setDefaultRoomHeightM(Number(e.target.value))} />
            </label>
            <label className="fpb__field">
              <span>Room name</span>
              <input type="text" value={manualRoomName} onChange={(e) => setManualRoomName(e.target.value)} />
            </label>
            <label className="fpb__field">
              <span>Width (m)</span>
              <input type="number" min={1.5} step={0.1} value={manualRoomWidthM} onChange={(e) => setManualRoomWidthM(Number(e.target.value))} />
            </label>
            <label className="fpb__field">
              <span>Length (m)</span>
              <input type="number" min={1.5} step={0.1} value={manualRoomLengthM} onChange={(e) => setManualRoomLengthM(Number(e.target.value))} />
            </label>
            <label className="fpb__field">
              <span>Level</span>
              <select value={manualRoomFloorId || activeFloorId} onChange={(e) => setManualRoomFloorId(e.target.value)}>
                {plan.floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
            <button className="fpb__tool-btn" onClick={createRoomFromManualForm}>Add room</button>
          </section>
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
            {/* Disruption kind picker — visible when addDisruption is active */}
            {tool === 'addDisruption' && (
              <div className="fpb__disruption-picker">
                {(Object.keys(DISRUPTION_KIND_LABELS) as DisruptionKind[]).map((k) => (
                  <button
                    key={k}
                    className={`fpb__disruption-kind-btn ${pendingDisruptionKind === k ? 'active' : ''}`}
                    onClick={() => setPendingDisruptionKind(k)}
                    title={DISRUPTION_KIND_LABELS[k]}
                  >
                    <span>{DISRUPTION_KIND_EMOJI[k]}</span>
                    {DISRUPTION_KIND_LABELS[k]}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Component tray */}
          <section className="fpb__section">
            <h3 className="fpb__section-title">Components</h3>
            <div className="fpb__component-tray">
              {PALETTE_SECTIONS.map((section) => (
                <div key={section.category} className="fpb__palette-section">
                  <div className="fpb__palette-heading">{section.label}</div>
                  {section.items.filter((item) => canPlaceInProfessionalPlan(item.kind)).map((item) => (
                    <button
                      key={item.kind}
                      className={`fpb__component-btn ${pendingKind === item.kind ? 'active' : ''}`}
                      onClick={() => {
                        setTool('placeNode');
                        setPendingKind(item.kind);
                      }}
                      title={`Place ${item.label} — click canvas to position`}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('application/x-floorplan-kind', item.kind)}
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
            <div className="fpb__hint-actions">
              {autoRoutes.length > 0 && (
                <span className="fpb__pipe-legend">
                  <span className="fpb__pipe-legend-flow">━</span> Flow
                  <span className="fpb__pipe-legend-return">━</span> Return
                </span>
              )}
              <button
                className="fpb__action-btn fpb__insert-btn"
                onClick={() => setShowObjectBrowser(true)}
              >
                + Insert…
              </button>
            </div>
          </div>

          <div
            className={`fpb__board fpb__board--tool-${tool}`}
            ref={boardRef}
            onPointerDown={handleBoardPointerDown}
            onPointerMove={handleBoardPointerMove}
            onPointerUp={handleBoardPointerUp}
            onPointerCancel={handleBoardPointerUp}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleBoardDrop}
            onWheel={handleWheel}
          >
            <div
              className="fpb__canvas-transform"
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                transformOrigin: '0 0',
              }}
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

              {/* ── Layer 3a: Auto-routed heating pipes ── */}
              {autoRoutes.map((route) => {
                // Mid-point for the engineer label
                const mid = route.route[Math.floor(route.route.length / 2)];
                const labelText = viewMode === 'engineer'
                  ? `${route.pipeSizeMm}mm ${route.type === 'flow' ? 'F' : 'R'}`
                  : null;
                return (
                  <g key={route.id}>
                    <polyline
                      className={`fpb__pipe fpb__pipe--${route.type}`}
                      points={route.route.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                    />
                    {/* Engineer-view: pipe size + type label at mid-point */}
                    {labelText && (
                      <text
                        x={mid.x}
                        y={mid.y - 5}
                        fontSize="8"
                        fill={route.type === 'flow' ? '#b45309' : '#1d4ed8'}
                        textAnchor="middle"
                        className="fpb__pipe-label"
                        style={{ pointerEvents: 'none' }}
                      >
                        {labelText}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* ── Layer 3b: Lego edges (manual connection routes) ── */}
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
                    strokeWidth={2}
                    strokeDasharray="6 3"
                  />
                );
              })}

              {/* ── Layer 4: Disruption annotations ── */}
              {activeFloorDisruptions.map((dis) => {
                const isUserPlaced = (plan.disruptions ?? []).some((d) => d.id === dis.id);
                const isSelected = selection?.kind === 'disruption' && selection.id === dis.id;
                const emoji = DISRUPTION_KIND_EMOJI[dis.kind];
                const label = viewMode === 'engineer'
                  ? DISRUPTION_KIND_LABELS[dis.kind]
                  : customerDisruptionLabel(dis.kind);
                return (
                  <g
                    key={dis.id}
                    style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tool === 'select') setSelection({ kind: 'disruption', id: dis.id });
                    }}
                  >
                    <circle
                      cx={dis.x}
                      cy={dis.y}
                      r={10}
                      fill={isSelected ? '#fef3c7' : isUserPlaced ? '#fff7ed' : '#f0fdf4'}
                      stroke={isSelected ? '#d97706' : isUserPlaced ? '#f59e0b' : '#86efac'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      strokeDasharray={isUserPlaced ? 'none' : '3 2'}
                    />
                    <text
                      x={dis.x}
                      y={dis.y + 4}
                      fontSize="10"
                      textAnchor="middle"
                      style={{ pointerEvents: 'none' }}
                    >
                      {emoji}
                    </text>
                    <text
                      x={dis.x}
                      y={dis.y + 20}
                      fontSize="7"
                      fill="#78350f"
                      textAnchor="middle"
                      className="fpb__disruption-label"
                      style={{ pointerEvents: 'none' }}
                    >
                      {label}
                    </text>
                  </g>
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
                    <>
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
                      {/* Corner handles */}
                      <div className="fpb__corner-handle" style={{ left: -5, top: -5 }} />
                      <div className="fpb__corner-handle" style={{ right: -5, top: -5 }} />
                      <div className="fpb__corner-handle" style={{ left: -5, bottom: -5 }} />
                      <div className="fpb__corner-handle" style={{ right: -5, bottom: -5 }} />
                      {/* Edge measurement labels */}
                      <div
                        className="fpb__edge-label fpb__edge-label--top"
                        onClick={openDimensionEditor('room-width', Number(toMeters(room.width)), room.id)}
                      >
                        {toMeters(room.width)}m
                      </div>
                      <div
                        className="fpb__edge-label fpb__edge-label--bottom"
                        onClick={openDimensionEditor('room-width', Number(toMeters(room.width)), room.id)}
                      >
                        {toMeters(room.width)}m
                      </div>
                      <div
                        className="fpb__edge-label fpb__edge-label--left"
                        onClick={openDimensionEditor('room-height', Number(toMeters(room.height)), room.id)}
                      >
                        {toMeters(room.height)}m
                      </div>
                      <div
                        className="fpb__edge-label fpb__edge-label--right"
                        onClick={openDimensionEditor('room-height', Number(toMeters(room.height)), room.id)}
                      >
                        {toMeters(room.height)}m
                      </div>
                    </>
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
            </div>{/* end fpb__canvas-transform */}

            {/* ── Zoom controls ── */}
            <div className="fpb__zoom-controls">
              <button className="fpb__zoom-btn" onClick={handleZoomOut} title="Zoom out">−</button>
              <span className="fpb__zoom-level">{Math.round(zoom * 100)}%</span>
              <button className="fpb__zoom-btn" onClick={handleZoomIn} title="Zoom in">+</button>
              <button className="fpb__zoom-btn" onClick={handleFitFloor} title="Fit floor (reset zoom)">⌂</button>
            </div>

            {/* ── Bottom action bar for selected items ── */}
            {selectedRoom && (
              <div className="fpb__bottom-actions">
                <button className="fpb__action-pill" onClick={() => duplicateRoom(selectedRoom)}>Duplicate</button>
                <button className="fpb__action-pill" onClick={() => setEditingDimension({ type: 'room-width', currentValue: Number(toMeters(selectedRoom.width)), id: selectedRoom.id })}>Edit Dimensions</button>
                <button className="fpb__action-pill fpb__action-pill--danger" onClick={() => deleteRoom(selectedRoom.id)}>Delete</button>
              </div>
            )}
            {selectedWall && (
              <div className="fpb__bottom-actions">
                <button className="fpb__action-pill" onClick={() => {
                  const wallLen = Math.sqrt((selectedWall.x2 - selectedWall.x1) ** 2 + (selectedWall.y2 - selectedWall.y1) ** 2);
                  setEditingDimension({ type: 'wall-length', currentValue: Number(toMeters(wallLen)), id: selectedWall.id });
                }}>Edit Length</button>
                <button className="fpb__action-pill" onClick={() => updateWall(selectedWall.id, { kind: selectedWall.kind === 'external' ? 'internal' : 'external' })}>Change Type</button>
                <button className="fpb__action-pill fpb__action-pill--danger" onClick={() => deleteWall(selectedWall.id)}>Delete</button>
              </div>
            )}
            {selectedNode && (
              <div className="fpb__bottom-actions">
                <button className="fpb__action-pill" onClick={() => duplicateNode(selectedNode)}>Duplicate</button>
                <button className="fpb__action-pill" onClick={() => rotateNode(selectedNode)}>Rotate</button>
                <button className="fpb__action-pill fpb__action-pill--danger" onClick={() => deleteNode(selectedNode.id)}>Delete</button>
              </div>
            )}

            {/* ── Add Room bottom sheet ── */}
            {showAddRoomSheet && (
              <>
                <div className="fpb__bottom-sheet-backdrop" onClick={() => { setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); }} />
                <div className="fpb__bottom-sheet">
                  <div className="fpb__bottom-sheet-header">
                    <span>Add Room</span>
                    <button className="fpb__delete-btn" onClick={() => { setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); }}>✕</button>
                  </div>
                  {addRoomSheetMode === 'menu' ? (
                    <div className="fpb__sheet-options">
                      <button className="fpb__sheet-option" onClick={() => setAddRoomSheetMode('form')}>
                        <span>⬛</span> Add rectangular room
                      </button>
                      <button className="fpb__sheet-option" onClick={() => { setTool('addRoom'); setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); }}>
                        <span>✏️</span> Draw room
                      </button>
                      <button className="fpb__sheet-option" onClick={() => { setTool('drawWall'); setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); }}>
                        <span>✂️</span> Split room
                      </button>
                      <button className="fpb__sheet-option" onClick={() => { setTool('select'); setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); }}>
                        <span>🔲</span> Fill gap (select + resize)
                      </button>
                    </div>
                  ) : (
                    <div className="fpb__sheet-form">
                      <label className="fpb__field">
                        <span>Room name</span>
                        <input type="text" value={manualRoomName} onChange={(e) => setManualRoomName(e.target.value)} />
                      </label>
                      <label className="fpb__field">
                        <span>Width (m)</span>
                        <input type="number" min={1.5} step={0.1} value={manualRoomWidthM} onChange={(e) => setManualRoomWidthM(Number(e.target.value))} />
                      </label>
                      <label className="fpb__field">
                        <span>Length (m)</span>
                        <input type="number" min={1.5} step={0.1} value={manualRoomLengthM} onChange={(e) => setManualRoomLengthM(Number(e.target.value))} />
                      </label>
                      <label className="fpb__field">
                        <span>Level</span>
                        <select value={manualRoomFloorId || activeFloorId} onChange={(e) => setManualRoomFloorId(e.target.value)}>
                          {plan.floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </label>
                      <button className="fpb__tool-btn" onClick={() => { createRoomFromManualForm(); setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); }}>Add room</button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Object browser bottom sheet (magicplan-style) ── */}
            {showObjectBrowser && (
              <>
                <div className="fpb__bottom-sheet-backdrop" onClick={() => setShowObjectBrowser(false)} />
                <div className="fpb__bottom-sheet fpb__bottom-sheet--browser">
                  <div className="fpb__bottom-sheet-header">
                    <span className="fpb__browser-title">All Objects</span>
                    <button className="fpb__delete-btn" onClick={() => setShowObjectBrowser(false)}>✕</button>
                  </div>
                  <div className="fpb__browser-categories">
                    {PALETTE_SECTIONS.map((section) => {
                      const placeable = section.items.filter((item) => canPlaceInProfessionalPlan(item.kind));
                      if (placeable.length === 0) return null;
                      const categoryIcons: Record<string, string> = {
                        heat_sources: '🔥',
                        cylinders: '💧',
                        controls: '🔀',
                        emitters: '🌡️',
                        system_support: '🔧',
                        outlets: '🚰',
                        system_kits: '📦',
                      };
                      return (
                        <div key={section.category} className="fpb__browser-category">
                          <button
                            className="fpb__browser-category-row"
                            onClick={() => {
                              // Toggle expand — for now just show items inline
                            }}
                          >
                            <span className="fpb__browser-cat-icon">{categoryIcons[section.category] ?? '🔧'}</span>
                            <span className="fpb__browser-cat-label">{section.label}</span>
                            <span className="fpb__browser-cat-count">{placeable.length}</span>
                            <span className="fpb__browser-cat-chevron">›</span>
                          </button>
                          <div className="fpb__browser-items">
                            {placeable.map((item) => (
                              <button
                                key={item.kind}
                                className="fpb__browser-item"
                                onClick={() => {
                                  setTool('placeNode');
                                  setPendingKind(item.kind);
                                  setShowObjectBrowser(false);
                                }}
                              >
                                <span className="fpb__browser-item-icon">{item.emoji}</span>
                                <span className="fpb__browser-item-label">{item.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* ── Numeric dimension editor modal ── */}
            {editingDimension && (
              <>
                <div className="fpb__bottom-sheet-backdrop" onClick={() => setEditingDimension(null)} />
                <div className="fpb__dimension-editor">
                  <div className="fpb__dimension-editor-title">
                    {editingDimension.type === 'room-width' ? 'Width (m)' : editingDimension.type === 'room-height' ? 'Height (m)' : 'Length (m)'}
                  </div>
                  <input
                    type="number"
                    className="fpb__dimension-editor-input"
                    min={0.5}
                    step={0.1}
                    value={editingDimension.currentValue}
                    onChange={(e) => setEditingDimension({ ...editingDimension, currentValue: Number(e.target.value) })}
                    autoFocus
                  />
                  <div className="fpb__dimension-editor-actions">
                    <button className="fpb__action-btn" onClick={() => setEditingDimension(null)}>Cancel</button>
                    <button className="fpb__zoom-btn" onClick={handleDimensionApply}>Apply</button>
                  </div>
                </div>
              </>
            )}
          </div>{/* end fpb__board */}
        </div>{/* end fpb__canvas-wrap */}

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
            {selectedDisruption && (
              <InspectorDisruption
                disruption={selectedDisruption}
                onUpdate={(patch) => updateDisruption(selectedDisruption.id, patch)}
                onDelete={() => deleteDisruption(selectedDisruption.id)}
              />
            )}
          </aside>
        )}
      </div>

      <section className="fpb__simulation">
        <div className="fpb__simulation-header">
          <h3>Professional outputs</h3>
          <p>Fabric heat-loss estimates, emitter sizing, route lengths, and siting checks derived from the current room layout.</p>
        </div>
        <div className="fpb__issue-list">
          {/* ── Room metrics — engineer view only ── */}
          {viewMode === 'engineer' && derivedOutputs.roomMetrics.map((m) => {
            const loss   = derivedOutputs.roomHeatLossKw.find((r) => r.roomId === m.roomId);
            const emitter = derivedOutputs.emitterSizing.find((e) => e.roomId === m.roomId);
            return (
              <div key={m.roomId} className="fpb__issue fpb__issue--info">
                <strong>{m.roomName}</strong>{' '}
                {m.widthM} m × {m.lengthM} m · {m.areaM2} m² · exposed perimeter {m.exposedPerimeterM} m
                {loss && <> · heat loss <strong>{loss.heatLossKw.toFixed(2)} kW</strong></>}
                {emitter && <> · emitter target {emitter.suggestedRadiatorKw.toFixed(2)} kW</>}
              </div>
            );
          })}
          {/* ── Customer view: simplified room summary ── */}
          {viewMode === 'customer' && derivedOutputs.roomMetrics.length > 0 && (
            <div className="fpb__issue fpb__issue--info">
              {derivedOutputs.roomMetrics.length} room{derivedOutputs.roomMetrics.length !== 1 ? 's' : ''} mapped
              {derivedOutputs.totalPipeLengthM > 0 && <> · est. {derivedOutputs.totalPipeLengthM.toFixed(0)} m pipework</>}
            </div>
          )}
          {/* ── Pipe routing ── */}
          {autoRoutes.length > 0 && (
            <div className="fpb__issue fpb__issue--info">
              {viewMode === 'engineer' ? (
                <>
                  Auto-routed: {autoRoutes.filter(r => r.type === 'flow').length} flow circuits,{' '}
                  {autoRoutes.filter(r => r.type === 'return').length} return circuits
                  {derivedOutputs.totalPipeLengthM > 0 && <> — est. {derivedOutputs.totalPipeLengthM.toFixed(1)} m</>}
                  {' '}· sizes: {[...new Set(autoRoutes.map(r => r.pipeSizeMm))].sort().join(', ')} mm
                </>
              ) : (
                <>Heating circuits routed — {autoRoutes.filter(r => r.type === 'flow').length} zone{autoRoutes.filter(r => r.type === 'flow').length !== 1 ? 's' : ''}</>
              )}
            </div>
          )}
          {autoRoutes.length === 0 && derivedOutputs.totalPipeLengthM > 0 && (
            <div className="fpb__issue fpb__issue--info">
              Total estimated pipe quantity: {derivedOutputs.totalPipeLengthM.toFixed(1)} m
            </div>
          )}
          {/* ── Feasibility ── */}
          {viewMode === 'engineer' && (
            <div className="fpb__issue fpb__issue--info">
              Feasibility — heat source: {derivedOutputs.feasibilityChecks.hasHeatSource ? 'yes' : 'no'}, emitters: {derivedOutputs.feasibilityChecks.hasEmitters ? 'yes' : 'no'}, outdoor heat pump: {derivedOutputs.feasibilityChecks.hasOutdoorHeatPump ? 'yes' : 'n/a or missing'}
            </div>
          )}
          {/* ── Siting flags ── */}
          {derivedOutputs.sitingFlags.map((flag) => (
            <div
              key={flag.nodeId}
              className={`fpb__issue ${flag.status === 'ok' ? 'fpb__issue--info' : 'fpb__issue--warning'}`}
            >
              {flag.status === 'ok' ? '✓' : '⚠'} {flag.message}
            </div>
          ))}
          {/* ── Disruption / consequence summary ── */}
          {allDisruptions.length > 0 && (
            <div className="fpb__issue fpb__issue--warning">
              {viewMode === 'customer' ? (
                <>
                  <strong>Installation disruption</strong>
                  {': '}
                  {[...new Set(allDisruptions.map((d) => customerDisruptionLabel(d.kind)))].join(' · ')}
                </>
              ) : (
                <>
                  <strong>Consequence flags ({allDisruptions.length})</strong>
                  {': '}
                  {allDisruptions.map((d) => `${DISRUPTION_KIND_LABELS[d.kind]}${d.note ? ` — ${d.note}` : ''}`).join(' · ')}
                </>
              )}
            </div>
          )}
        </div>
      </section>

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

// ─── InspectorDisruption ───────────────────────────────────────────────────────

function InspectorDisruption({
  disruption,
  onUpdate,
  onDelete,
}: {
  disruption: DisruptionAnnotation;
  onUpdate: (patch: Partial<DisruptionAnnotation>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span>
          {DISRUPTION_KIND_EMOJI[disruption.kind]} {DISRUPTION_KIND_LABELS[disruption.kind]}
        </span>
        <button className="fpb__delete-btn" onClick={onDelete} title="Delete disruption marker">✕</button>
      </div>
      <label className="fpb__field">
        <span>Kind</span>
        <select
          value={disruption.kind}
          onChange={(e) => onUpdate({ kind: e.target.value as DisruptionKind })}
        >
          {(Object.keys(DISRUPTION_KIND_LABELS) as DisruptionKind[]).map((k) => (
            <option key={k} value={k}>
              {DISRUPTION_KIND_EMOJI[k]} {DISRUPTION_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="fpb__field">
        <span>Note</span>
        <textarea
          rows={3}
          value={disruption.note ?? ''}
          placeholder="e.g. Floorboards lifted in hallway"
          onChange={(e) => onUpdate({ note: e.target.value || undefined })}
        />
      </label>
      <div className="fpb__field fpb__field--static">
        <span>Position</span>
        <span>{toMeters(disruption.x)} m, {toMeters(disruption.y)} m</span>
      </div>
    </div>
  );
}
