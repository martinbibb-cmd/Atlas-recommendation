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
import ScanPackageImportFlow from '../../features/scanImport/ui/ScanPackageImportFlow';
import type { CanonicalFloorPlanDraft } from '../../features/scanImport/importer/scanMapper';
import { PALETTE_SECTIONS } from '../../explainers/lego/builder/palette';
import { getPortDefs } from '../../explainers/lego/builder/portDefs';
import { useAutosave } from '../../lib/hooks/useAutosave';
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
  FloorObject,
  FloorObjectType,
  FloorPlan,
  FloorRoute,
  FloorRouteType,
  FloorRouteStatus,
  Opening,
  OpeningType,
  PlacementNode,
  Point,
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
  FLOOR_OBJECT_TYPE_EMOJI,
  FLOOR_OBJECT_TYPE_LABELS,
  FLOOR_ROUTE_TYPE_COLORS,
  FLOOR_ROUTE_TYPE_LABELS,
  FLOOR_ROUTE_STATUS_LABELS,
  ROOM_TYPE_LABELS,
} from './propertyPlan.types';
import { autoRouteHeatingPipes, canPlaceInProfessionalPlan, computeDisruptionAnnotations, createManualRoom, deriveFloorplanOutputs, findWallHit, getOpeningGeometry, wallSegmentsWithGaps } from './floorplanDerivations';
import type { AutoRoute, DerivedFloorplanOutput, OpeningGeometry } from './floorplanDerivations';
import { badgeForObject, validatePropertyPlan } from './propertyValidation';
import type { ValidationResult } from './propertyValidation';
// PR9 feature modules — pure spatial logic kept out of component
import { updateWallMeasurement } from '../../features/floorplan/updateWallMeasurement';
import { addOpeningToWall } from '../../features/floorplan/addOpeningToWall';
import { addObjectToPlan, updateFloorObject, removeFloorObject } from '../../features/floorplan/addObjectToPlan';
// PR19 object templates — default labels and dimensions
import { getDefaultLabel } from '../../features/floorplan/objectTemplates';
// PR16 selection helpers — priority hit-testing
import { selectWall, selectOpening, selectFloorRoute } from '../../features/floorplan/selection';
// PR18 snap / alignment helpers
import {
  computeObjectSnap,
  computeAlignmentGuides,
  routeLabelPosition,
  validateWallLength,
} from '../../features/floorplan/snapHelpers';
import type { SnapKind, AlignGuide } from '../../features/floorplan/snapHelpers';
// PR10 feature modules — route authoring
import { addRouteToPlan, updateRoute, removeRoute } from '../../features/floorplan/addRouteToPlan';
// PR9 panel / editor components
import RoomInspectorPanel from './panels/RoomInspectorPanel';
import WallInspectorPanel from './panels/WallInspectorPanel';
import ObjectInspectorPanel from './panels/ObjectInspectorPanel';
import ObjectLibraryPanel from './panels/ObjectLibraryPanel';
// PR10 panel / editor components
import RouteInspectorPanel from './panels/RouteInspectorPanel';
import WallEditorSheet from './editors/WallEditorSheet';
import WallDimensionLabels from './overlays/WallDimensionLabels';
// PR23 handoff preview banner
import HandoffPreviewBanner from './panels/HandoffPreviewBanner';
import { validatePlanReadiness } from '../../features/floorplan/planReadinessValidator';
// PR24 guided survey checklist
import GuidedSurveyChecklist from './panels/GuidedSurveyChecklist';
import { deriveGuidedSteps } from '../../features/floorplan/guidedSurveySteps';
import type { GuidedStepAction } from '../../features/floorplan/guidedSurveySteps';
import './floorplan.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID = 24;
const CANVAS_W = 1080;
const CANVAS_H = 620;
const SNAP_DIST = 14;
const DEFAULT_ROOM_W = 192; // 8 grid units ≈ 4.8 m
const DEFAULT_ROOM_H = 144; // 6 grid units ≈ 3.6 m
/** Minimum pointer movement (px) required before a drag is registered.
 *  Prevents sub-pixel jitter or shaky touch input from creating undo entries. */
const DRAG_THRESHOLD_PX = 4;

/** Ghost preview pill dimensions for FloorObject placement (PR16). */
const GHOST_OBJECT_W = 72;
const GHOST_OBJECT_H = 40;

/**
 * PR22: Zoom threshold below which route labels and non-selected object labels
 * are suppressed to reduce canvas clutter at low zoom levels.
 */
const LABEL_HIDE_ZOOM_THRESHOLD = 0.6;

/** True when the page is running inside an iOS app that exposes a native LiDAR bridge. */
function hasNativeLidarSupport(): boolean {
  return typeof window !== 'undefined' &&
    !!(window as Window & { webkit?: { messageHandlers?: { lidarScan?: unknown } } })
      .webkit?.messageHandlers?.lidarScan;
}

/** Trigger the native iOS LiDAR scan for the given floor. */
function triggerNativeLidarScan(floorId: string): void {
  (window as unknown as {
    webkit: { messageHandlers: { lidarScan: { postMessage: (msg: Record<string, unknown>) => void } } };
  }).webkit.messageHandlers.lidarScan.postMessage({ action: 'startScan', floorId });
}

/** localStorage key for persisting the floor plan draft between sessions. */
const FLOOR_PLAN_STORAGE_KEY = 'atlas.floorplan.draft.v1';

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
  const next = { ...candidate };
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
  { id: 'addFloorRoute', label: 'Add Route',    icon: '🔴', hint: 'Click points on the plan to draw a pipe/service route; press Finish or Escape' },
];

// ─── FloorPlanBuilder ─────────────────────────────────────────────────────────

export default function FloorPlanBuilder({ surveyResults, onChange }: Props = {}) {
  const [plan, setPlan] = useState<PropertyPlan>(() =>
    makeInitialPlan({ systemType: surveyResults?.systemType }),
  );
  const [activeFloorId, setActiveFloorId] = useState<string>(
    () => plan.floors[0]?.id ?? '',
  );
  const [tool, setTool] = useState<EditorTool>(() => {
    try {
      const saved = sessionStorage.getItem('atlas.floorplan.lastTool') as EditorTool | null;
      // Explicit guard list — keeps sessionStorage restore safe even if EditorTool grows.
      // Update this list alongside the EditorTool union in propertyPlan.types.ts.
      const safeTool: EditorTool[] = ['select', 'addRoom', 'drawWall', 'addOpening', 'placeNode', 'connectRoute', 'addDisruption', 'addFloorRoute', 'pan'];
      return saved && safeTool.includes(saved) ? saved : 'select';
    } catch {
      return 'select';
    }
  });
  const [selection, setSelection] = useState<SelectionTarget | null>(null);
  /** PR17: When true, stay in the current placement tool after placing an object/completing a route. */
  const [stayInTool, setStayInTool] = useState<boolean>(() => {
    try { return sessionStorage.getItem('atlas.floorplan.stayInTool') === 'true'; } catch { return false; }
  });

  // Persist stayInTool to sessionStorage whenever it changes.
  useEffect(() => {
    try { sessionStorage.setItem('atlas.floorplan.stayInTool', String(stayInTool)); } catch { /* ignore */ }
  }, [stayInTool]);

  // Wrapper that also persists the last-used tool to sessionStorage.
  const changeTool = useCallback((next: EditorTool) => {
    try { sessionStorage.setItem('atlas.floorplan.lastTool', next); } catch { /* ignore */ }
    setTool(next);
    // PR18: clear transient snap state when switching tools
    setSnapPreview(null);
    setAlignGuides([]);
  }, []);

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
  /** Opening type selected for the addOpening tool */
  const [pendingOpeningType, setPendingOpeningType] = useState<OpeningType>('door');
  /** FloorObject type queued for placement (PR9 object library). */
  const [pendingFloorObjectType, setPendingFloorObjectType] = useState<FloorObjectType | null>(null);
  /** Show the object library panel. */
  const [showObjectLibrary, setShowObjectLibrary] = useState(false);
  /** PR10: Route type selected for the addFloorRoute tool. */
  const [pendingRouteType, setPendingRouteType] = useState<FloorRouteType>('flow');
  /** PR10: Route status selected for the addFloorRoute tool. */
  const [pendingRouteStatus, setPendingRouteStatus] = useState<FloorRouteStatus>('proposed');
  /** PR10: Points accumulated during an in-progress route drawing session. */
  const [inProgressRoutePoints, setInProgressRoutePoints] = useState<import('./propertyPlan.types').Point[]>([]);
  /** PR18: Snap preview — position and kind of the nearest snap target under the cursor. */
  const [snapPreview, setSnapPreview] = useState<{ pos: Point; kind: SnapKind } | null>(null);
  /** PR18: Alignment guides computed while placing objects or drawing route waypoints. */
  const [alignGuides, setAlignGuides] = useState<AlignGuide[]>([]);

  // ── Undo / redo history ──────────────────────────────────────────────────

  /**
   * History ring for undo/redo.  We keep a bounded list of past plan snapshots
   * (before the mutation) and a stack of future ones (after an undo).
   * Using refs avoids spurious re-renders from history bookkeeping.
   */
  const MAX_HISTORY = 50;
  const pastRef = useRef<PropertyPlan[]>([]);
  const futureRef = useRef<PropertyPlan[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // ── Layer visibility toggles ──────────────────────────────────────────────

  /**
   * Controls which visual layers are rendered on the canvas.
   * PR22: expanded with `dimensions` (wall dimension labels) and
   * `confidenceBadges` (provenance / confidence badges on objects and routes).
   * All visible by default except `dimensions` which is off by default in
   * field mode so the plan starts calmer.
   * State is persisted to sessionStorage so toggles survive hot-reloads and
   * brief navigations without requiring a fresh load.
   */
  const [visibleLayers, setVisibleLayers] = useState<{
    geometry: boolean;
    openings: boolean;
    components: boolean;
    routes: boolean;
    disruptions: boolean;
    dimensions: boolean;
    confidenceBadges: boolean;
  }>(() => {
    const defaults = {
      geometry:        true,
      openings:        true,
      components:      true,
      routes:          true,
      disruptions:     true,
      dimensions:      false,
      confidenceBadges: false,
    };
    try {
      const raw = sessionStorage.getItem('atlas.floorplan.visibleLayers');
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        // Guard: only use parsed value if it is a plain object
        if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const p = parsed as Record<string, unknown>;
          return {
            geometry:        typeof p.geometry        === 'boolean' ? p.geometry        : defaults.geometry,
            openings:        typeof p.openings        === 'boolean' ? p.openings        : defaults.openings,
            components:      typeof p.components      === 'boolean' ? p.components      : defaults.components,
            routes:          typeof p.routes          === 'boolean' ? p.routes          : defaults.routes,
            disruptions:     typeof p.disruptions     === 'boolean' ? p.disruptions     : defaults.disruptions,
            dimensions:      typeof p.dimensions      === 'boolean' ? p.dimensions      : defaults.dimensions,
            confidenceBadges: typeof p.confidenceBadges === 'boolean' ? p.confidenceBadges : defaults.confidenceBadges,
          };
        }
      }
    } catch { /* sessionStorage unavailable or JSON malformed — fall through to defaults */ }
    return defaults;
  });

  /** "Clean view" collapses all labels/dimensions — useful for presentation screenshots. */
  const [cleanView, setCleanView] = useState(false);

  /** PR22: "Handoff preview" mode — approximates what the engineer handoff will show.
   *  Hides editor chrome to let the surveyor check readability before handoff. */
  const [previewMode, setPreviewMode] = useState(false);

  /** PR24: Show the guided survey checklist rail. */
  const [showGuidedChecklist, setShowGuidedChecklist] = useState(false);

  /**
   * PR23: When the handoff preview banner offers a "place X" quick-fix,
   * stores the FloorObjectType to highlight in the object library panel.
   * Cleared once the library opens or preview exits.
   */
  const [objectLibraryHighlight, setObjectLibraryHighlight] = useState<FloorObjectType | null>(null);

  /**
   * PR23/PR24: Plan readiness result — computed from the current plan.
   * Used by the handoff preview banner (PR23) and guided survey checklist (PR24).
   */
  const needsStoredHotWaterFlag = useMemo(
    () => plan.placementNodes.some(
      (n) => n.type === 'heat_source_system_boiler' ||
             n.type === 'heat_source_regular_boiler',
    ),
    [plan.placementNodes],
  );

  const planReadinessResult = useMemo(
    () => validatePlanReadiness(plan, { needsStoredHotWater: needsStoredHotWaterFlag }),
    [plan, needsStoredHotWaterFlag],
  );

  /**
   * PR24: Guided survey steps — derived from plan state and readiness result.
   * Recomputed whenever the plan or readiness changes.
   */
  const guidedSteps = useMemo(
    () => deriveGuidedSteps(plan, planReadinessResult, { needsStoredHotWater: needsStoredHotWaterFlag }),
    [plan, planReadinessResult, needsStoredHotWaterFlag],
  );

  /**
   * PR24: Shared tool-activation helper — calls changeTool and clears the
   * transient placement/drawing state for any tool that is being de-activated.
   * Used by both the sidebar tool buttons and the guided survey action handler
   * to keep tool-switch behaviour in one place.
   */
  const activateTool = useCallback((next: EditorTool) => {
    changeTool(next);
    if (next !== 'placeNode') { setPendingKind(null); setPendingFloorObjectType(null); setGhostPos(null); }
    if (next !== 'drawWall') setPendingWallStart(null);
    if (next !== 'connectRoute') setPendingPort(null);
    if (next !== 'addFloorRoute') setInProgressRoutePoints([]);
  // All setters are stable React dispatch functions.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeTool]);

  /**
   * PR24: Handle a guided-step primary action.
   * Activates the appropriate tool, opens the object library, or enters preview mode
   * without altering any plan data or disrupting the current canvas state.
   */
  const handleGuidedAction = useCallback((action: GuidedStepAction) => {
    switch (action.kind) {
      case 'switchTool':
        activateTool(action.tool);
        break;
      case 'openLibrary':
        setObjectLibraryHighlight(action.highlightType);
        setShowObjectLibrary(true);
        break;
      case 'enterPreview':
        setPreviewMode(true);
        break;
    }
  }, [activateTool]);

  // ── Zoom & pan state ────────────────────────────────────────────────────
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // ── PR21: Mobile layout detection & inspector sheet state ───────────────
  const [isMobileLayout, setIsMobileLayout] = useState<boolean>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
  );
  /** Bottom-sheet state for the inspector panel on mobile. */
  const [inspectorSheetState, setInspectorSheetState] = useState<'collapsed' | 'half' | 'full'>('half');
  /** Whether the mobile sidebar is visible (toggled by the tools button). */
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // ── Bottom sheet & editor state ─────────────────────────────────────────
  const [showAddRoomSheet, setShowAddRoomSheet] = useState(false);
  const [addRoomSheetMode, setAddRoomSheetMode] = useState<'menu' | 'form'>('menu');
  const [showObjectBrowser, setShowObjectBrowser] = useState(false);
  const [showWallDetailSheet, setShowWallDetailSheet] = useState(false);
  const [wallDetailWallId, setWallDetailWallId] = useState<string | null>(null);
  const [showScanImportFlow, setShowScanImportFlow] = useState(false);
  /** When true, the room form locks width === length so the user gets a square room. */
  const [squareRoomLocked, setSquareRoomLocked] = useState(false);
  const [editingDimension, setEditingDimension] = useState<{
    type: 'room-width' | 'room-height' | 'wall-length';
    currentValue: number;
    id: string;
  } | null>(null);

  const boardRef = useRef<HTMLDivElement>(null);
  /** Tracks last wall tap for double-tap detection (open wall detail sheet). */
  const wallTapRef = useRef<{ wallId: string; time: number } | null>(null);
  const dragRef = useRef<
    | { mode: 'room-move'; id: string; dx: number; dy: number }
    | { mode: 'room-resize'; id: string; startX: number; startY: number; baseW: number; baseH: number }
    | { mode: 'node-move'; id: string; dx: number; dy: number }
    | null
  >(null);
  // Captures the plan state immediately before a drag begins so we can commit
  // exactly one history entry when the drag ends (pointer-up).
  const dragStartPlanRef = useRef<PropertyPlan | null>(null);
  // True once the pointer has actually moved past DRAG_THRESHOLD_PX during a
  // drag (distinguishes a click from a real move, and guards against sub-pixel
  // jitter or shaky touch input creating spurious undo entries).
  const dragHasMovedRef = useRef(false);
  // Captures the board-space pointer position when a drag begins so we can
  // compute the movement distance for the threshold check.
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // ── Starter template loading ──────────────────────────────────────────────

  function loadTemplate(id: PropertyLayoutId) {
    const layout = PROPERTY_LAYOUTS.find(l => l.id === id);
    if (!layout) return;
    const newPlan = planFromLayout(layout, { systemType: surveyResults?.systemType });
    // Clear history when a template is loaded — new starting point.
    pastRef.current = [];
    futureRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
    setPlan(newPlan);
    setActiveFloorId(newPlan.floors[0]?.id ?? '');
    setBuildEdgesByFloor({});
    setSelection(null);
    setPendingKind(null);
    setPendingPort(null);
    setPendingWallStart(null);
    setTemplateApplied(true);
  }

  // ── Layer toggle helper ───────────────────────────────────────────────────

  function toggleLayer(layer: keyof typeof visibleLayers) {
    setVisibleLayers((prev) => {
      const next = { ...prev, [layer]: !prev[layer] };
      try { sessionStorage.setItem('atlas.floorplan.visibleLayers', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  // ── localStorage autosave ─────────────────────────────────────────────────

  const floorPlanAutosave = useAutosave<PropertyPlan>(
    async (planSnapshot) => {
      try {
        localStorage.setItem(FLOOR_PLAN_STORAGE_KEY, JSON.stringify(planSnapshot));
      } catch {
        // localStorage unavailable (private browsing, quota exceeded, etc.)
        throw new Error('localStorage write failed');
      }
    },
    { debounceMs: 600 },
  );

  // Restore from localStorage on first mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FLOOR_PLAN_STORAGE_KEY);
      if (!raw) return;
      const restored = JSON.parse(raw) as PropertyPlan;
      if (restored?.version !== '1.0') {
        // Surface a dev/QA note so schema issues are easy to spot.
        // eslint-disable-next-line no-console
        console.warn('[FloorPlanBuilder] localStorage draft discarded: schema version mismatch (found: %s)', restored?.version);
        return;
      }
      if (!restored.floors?.length) return;
      pastRef.current = [];
      futureRef.current = [];
      setCanUndo(false);
      setCanRedo(false);
      setPlan(restored);
      setActiveFloorId(restored.floors[0]?.id ?? '');
    } catch {
      // Corrupt or missing — silently ignore and start fresh.
    }
    // Run only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave whenever the plan changes.
  // floorPlanAutosave.save is stable (memoised with useCallback inside useAutosave).
  useEffect(() => {
    floorPlanAutosave.save(plan);
  }, [plan, floorPlanAutosave.save]);

  // Warn on navigation/close when a save is pending.
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (floorPlanAutosave.hasPendingSave || floorPlanAutosave.status === 'saving' || floorPlanAutosave.status === 'retrying') {
        e.preventDefault();
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [floorPlanAutosave.hasPendingSave, floorPlanAutosave.status]);

  // PR21: Track mobile breakpoint changes.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e: MediaQueryListEvent) => setIsMobileLayout(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // PR21: When a selection opens on mobile, open the inspector sheet to half.
  useEffect(() => {
    if (isMobileLayout && selection) setInspectorSheetState('half');
  }, [selection, isMobileLayout]);



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

  const selectedOpening = useMemo(() => {
    if (selection?.kind !== 'opening') return null;
    return activeFloor?.openings.find((o) => o.id === selection.id) ?? null;
  }, [selection, activeFloor]);

  const selectedFloorObject = useMemo(() => {
    if (selection?.kind !== 'floor_object') return null;
    return (activeFloor?.floorObjects ?? []).find((o) => o.id === selection.id) ?? null;
  }, [selection, activeFloor]);

  const selectedFloorRoute = useMemo(() => {
    if (selection?.kind !== 'floor_route') return null;
    return (activeFloor?.floorRoutes ?? []).find((r) => r.id === selection.id) ?? null;
  }, [selection, activeFloor]);

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

  // ── Undo / redo helpers ───────────────────────────────────────────────────
  // Defined after emit so that emit is already initialised (avoids TDZ errors).

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    setPlan((current) => {
      const previous = pastRef.current[pastRef.current.length - 1];
      futureRef.current = [current, ...futureRef.current.slice(0, MAX_HISTORY - 1)];
      pastRef.current = pastRef.current.slice(0, -1);
      setCanUndo(pastRef.current.length > 0);
      setCanRedo(true);
      emit(previous);
      return previous;
    });
  }, [emit]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    setPlan((current) => {
      const next = futureRef.current[0];
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), current];
      futureRef.current = futureRef.current.slice(1);
      setCanUndo(true);
      setCanRedo(futureRef.current.length > 0);
      emit(next);
      return next;
    });
  }, [emit]);

  // ── Keyboard shortcuts (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) ─────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (e.key === 'Escape') {
        // Cancel any active non-select tool and clear all pending placement state.
        if (tool !== 'select') changeTool('select');
        setPendingWallStart(null);
        setPendingPort(null);
        setPendingKind(null);
        setPendingFloorObjectType(null);
        setGhostPos(null);
        setInProgressRoutePoints([]);
        setRoomDraftOrigin(null);
        setRoomDraftSize(null);
        setSnapPreview(null);   // PR18
        setAlignGuides([]);     // PR18
        setSelection(null);     // PR31: Escape also clears active selection
        return;
      }
      if (!isCtrl) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, tool, inProgressRoutePoints.length]);

  // ── Floor mutations ──────────────────────────────────────────────────────

  function updatePlan(updater: (p: PropertyPlan) => PropertyPlan) {
    setPlan((prev) => {
      // Push previous state to history before mutating.
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), prev];
      futureRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
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

  /**
   * Apply a plan mutation during drag preview — emits to onChange but does NOT
   * record a history entry.  Call `updatePlan` (not this) for any user-visible
   * edit that should be undoable.
   */
  function applyPlanDirect(updater: (p: PropertyPlan) => PropertyPlan) {
    setPlan((prev) => {
      const next = updater(prev);
      emit(next);
      return next;
    });
  }

  /** Apply a mutation to the active floor without recording history (drag preview). */
  function applyActiveFloorDirect(updater: (f: FloorPlan) => FloorPlan) {
    applyPlanDirect((p) => ({
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

  /**
   * Add a wall parallel to the given wall, offset outward by offsetGridUnits
   * grid cells along the wall's perpendicular direction.
   */
  function addParallelWall(wall: Wall, offsetGridUnits: number = 4) {
    const dx = wall.x2 - wall.x1;
    const dy = wall.y2 - wall.y1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const perpX = (-dy / len) * offsetGridUnits * GRID;
    const perpY = (dx / len) * offsetGridUnits * GRID;
    commitWall(
      wall.x1 + perpX, wall.y1 + perpY,
      wall.x2 + perpX, wall.y2 + perpY,
      wall.kind,
    );
  }

  /**
   * Merge a canonical scan draft into the current plan.
   * Rooms/walls/openings from the draft replace any previously imported
   * entities (matched by ID) so re-imports are idempotent.
   */
  function applyScanDraft(draft: CanonicalFloorPlanDraft) {
    updatePlan((p) => {
      const newFloors = [...p.floors];
      for (const draftFloor of draft.floors) {
        const existingIdx = newFloors.findIndex((f) => f.levelIndex === draftFloor.levelIndex);
        if (existingIdx >= 0) {
          newFloors[existingIdx] = {
            ...newFloors[existingIdx],
            rooms: [
              ...newFloors[existingIdx].rooms.filter((r) => !draft.importedRoomIds.includes(r.id)),
              ...draftFloor.rooms,
            ],
            walls: [
              ...newFloors[existingIdx].walls.filter((w) => !draft.importedWallIds.includes(w.id)),
              ...draftFloor.walls,
            ],
            openings: [
              ...newFloors[existingIdx].openings.filter((o) => !draft.importedOpeningIds.includes(o.id)),
              ...draftFloor.openings,
            ],
          };
        } else {
          newFloors.push(draftFloor);
        }
      }
      return { ...p, floors: newFloors };
    });
    if (draft.floors[0]) setActiveFloorId(draft.floors[0].id);
    setShowScanImportFlow(false);
    setShowAddRoomSheet(false);
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

  // ── Opening mutations ────────────────────────────────────────────────────

  function createOpening(wallId: string, offsetM: number, widthM: number, type: OpeningType) {
    let createdId = '';
    updatePlan((prev) => {
      const { plan: next, openingId } = addOpeningToWall(prev, {
        floorId: activeFloorId, wallId, type, offsetM, widthM,
      });
      createdId = openingId;
      return next;
    });
    setTimeout(() => setSelection({ kind: 'opening', id: createdId }), 0);
  }

  function updateOpening(id: string, patch: Partial<Opening>) {
    updateActiveFloor((f) => ({
      ...f,
      openings: f.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));
  }

  function deleteOpening(id: string) {
    updateActiveFloor((f) => ({
      ...f,
      openings: f.openings.filter((o) => o.id !== id),
    }));
    if (selection?.kind === 'opening' && selection.id === id) setSelection(null);
  }

  // ── FloorRoute mutations (PR10) ──────────────────────────────────────────

  function commitFloorRoute(points: import('./propertyPlan.types').Point[]) {
    if (points.length < 2) return;
    let createdId = '';
    updatePlan((prev) => {
      const { plan: next, routeId } = addRouteToPlan(prev, {
        floorId: activeFloorId,
        type: pendingRouteType,
        status: pendingRouteStatus,
        points,
      });
      createdId = routeId;
      return next;
    });
    setInProgressRoutePoints([]);
    setTimeout(() => setSelection({ kind: 'floor_route', id: createdId }), 0);
  }

  function patchFloorRoute(id: string, patch: Partial<Omit<FloorRoute, 'id' | 'floorId' | 'provenance'>>) {
    const next = updateRoute(plan, { floorId: activeFloorId, routeId: id, patch });
    updatePlan(() => next);
  }

  function deleteFloorRoute(id: string) {
    const next = removeRoute(plan, activeFloorId, id);
    updatePlan(() => next);
    if (selection?.kind === 'floor_route' && selection.id === id) setSelection(null);
  }

  // ── FloorObject mutations (PR9) ───────────────────────────────────────────

  function placeFloorObject(type: FloorObjectType, x: number, y: number) {
    const roomId = activeFloor?.rooms.find(
      (r) => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height,
    )?.id;

    // PR19: auto-label via template registry — radiators always numbered ("Radiator 1"),
    // other types plain for the first instance and counted for subsequent ones.
    const existingObjects = activeFloor?.floorObjects ?? [];
    const autoLabel = getDefaultLabel(type, existingObjects);

    let createdId = '';
    updatePlan((prev) => {
      const { plan: next, objectId } = addObjectToPlan(prev, {
        floorId: activeFloorId, type, x, y, roomId, label: autoLabel,
      });
      createdId = objectId;
      return next;
    });
    // PR17: only clear pending type if "place once" (stayInTool = false)
    if (!stayInTool) {
      setPendingFloorObjectType(null);
      setGhostPos(null);
    }
    // Select after state update settles (createdId captured in closure above)
    setTimeout(() => setSelection({ kind: 'floor_object', id: createdId }), 0);
  }

  function patchFloorObject(id: string, patch: Partial<Omit<FloorObject, 'id' | 'floorId' | 'provenance'>>) {
    const next = updateFloorObject(plan, { floorId: activeFloorId, objectId: id, patch });
    updatePlan(() => next);
  }

  function deleteFloorObject(id: string) {
    const next = removeFloorObject(plan, activeFloorId, id);
    updatePlan(() => next);
    if (selection?.kind === 'floor_object' && selection.id === id) setSelection(null);
  }

  /** PR17: Duplicate a FloorObject at a small offset so both are visible. */
  const DUPLICATE_OFFSET_CELLS = 2;
  function duplicateFloorObject(obj: FloorObject) {
    let createdId = '';
    updatePlan((prev) => {
      const { plan: next, objectId } = addObjectToPlan(prev, {
        floorId: activeFloorId,
        type: obj.type,
        x: obj.x + GRID * DUPLICATE_OFFSET_CELLS,
        y: obj.y + GRID * DUPLICATE_OFFSET_CELLS,
        label: obj.label ? `${obj.label} copy` : undefined,
        widthM: obj.widthM,
        heightM: obj.heightM,
        depthM: obj.depthM,
        roomId: obj.roomId,
        wallId: obj.wallId,
      });
      createdId = objectId;
      return next;
    });
    setTimeout(() => setSelection({ kind: 'floor_object', id: createdId }), 0);
  }

  /**
   * PR17: Centre the canvas view on the given canvas-space coordinates.
   * Adjusts panOffset so the point appears in the centre of the board element.
   */
  function centerViewOn(cx: number, cy: number) {
    const boardEl = boardRef.current;
    if (!boardEl) return;
    const { width, height } = boardEl.getBoundingClientRect();
    setPanOffset({
      x: width / 2 - cx * zoom,
      y: height / 2 - cy * zoom,
    });
  }

  /** PR17: Centre the view on the currently selected item. */
  function focusSelection() {
    if (selectedRoom) {
      centerViewOn(selectedRoom.x + selectedRoom.width / 2, selectedRoom.y + selectedRoom.height / 2);
    } else if (selectedWall) {
      centerViewOn((selectedWall.x1 + selectedWall.x2) / 2, (selectedWall.y1 + selectedWall.y2) / 2);
    } else if (selectedFloorObject) {
      centerViewOn(selectedFloorObject.x, selectedFloorObject.y);
    } else if (selectedFloorRoute && selectedFloorRoute.points.length > 0) {
      const mid = selectedFloorRoute.points[Math.floor(selectedFloorRoute.points.length / 2)];
      if (mid) centerViewOn(mid.x, mid.y);
    } else if (selectedNode) {
      centerViewOn(selectedNode.anchor.x, selectedNode.anchor.y);
    }
  }

  // ── Wall length update via feature module ────────────────────────────────

  function applyWallLength(wallId: string, newLengthM: number) {
    const next = updateWallMeasurement(plan, activeFloorId, wallId, newLengthM);
    updatePlan(() => next);
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

    // PR9: place a FloorObject from the object library
    if (tool === 'placeNode' && pendingFloorObjectType) {
      // PR18: snap to wall/corner/object before placing
      const snap = activeFloor
        ? computeObjectSnap(pos, activeFloor.walls, activeFloor.floorObjects ?? [], visibleNodes, activeFloor.floorRoutes ?? [], zoom)
        : { snapped: pos, kind: 'free' as const };
      placeFloorObject(pendingFloorObjectType, snap.snapped.x, snap.snapped.y);
      setSnapPreview(null);
      setAlignGuides([]);
      // stayInTool: placeFloorObject already conditionally clears pendingFloorObjectType
      return;
    }

    if (tool === 'addDisruption') {
      placeDisruption(pendingDisruptionKind, pos.x, pos.y);
      return;
    }

    // PR10/PR18: accumulate route waypoints — snap before committing
    if (tool === 'addFloorRoute') {
      const snap = activeFloor
        ? computeObjectSnap(pos, activeFloor.walls, activeFloor.floorObjects ?? [], visibleNodes, activeFloor.floorRoutes ?? [], zoom)
        : { snapped: pos, kind: 'free' as const };
      setInProgressRoutePoints((prev) => [...prev, snap.snapped]);
      return;
    }

    if (tool === 'addOpening') {
      if (activeFloor) {
        const hit = findWallHit(pos, activeFloor.walls);
        if (hit) {
          const defaultWidthM = pendingOpeningType === 'door' ? 0.9 : 1.2;
          createOpening(hit.wall.id, hit.offsetM, defaultWidthM, pendingOpeningType);
        }
      }
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

    // Ghost preview for node or floor-object placement
    if (tool === 'placeNode' && (pendingKind || pendingFloorObjectType)) {
      if (pendingFloorObjectType && activeFloor) {
        // PR18: snap ghost to wall/corner/object and show alignment guides
        const snap = computeObjectSnap(pos, activeFloor.walls, activeFloor.floorObjects ?? [], visibleNodes, activeFloor.floorRoutes ?? [], zoom);
        setGhostPos(snap.snapped);
        setSnapPreview({ pos: snap.snapped, kind: snap.kind });
        setAlignGuides(computeAlignmentGuides(snap.snapped, activeFloor.rooms, activeFloor.walls, activeFloor.floorObjects ?? [], visibleNodes));
      } else {
        setGhostPos(pos);
        setSnapPreview(null);
        setAlignGuides([]);
      }
    }

    // PR18: snap preview cursor for route waypoint drawing
    if (tool === 'addFloorRoute' && activeFloor) {
      const snap = computeObjectSnap(pos, activeFloor.walls, activeFloor.floorObjects ?? [], visibleNodes, activeFloor.floorRoutes ?? [], zoom);
      setSnapPreview({ pos: snap.snapped, kind: snap.kind });
      setAlignGuides(computeAlignmentGuides(snap.snapped, activeFloor.rooms, activeFloor.walls, activeFloor.floorObjects ?? [], visibleNodes));
    }

    if (!dragRef.current) return;
    const state = dragRef.current;

    // Skip all per-mode processing until the pointer has travelled past the
    // jitter threshold.  This prevents sub-pixel wobble or shaky touch input
    // from creating unwanted preview updates or undo entries.
    if (
      !dragHasMovedRef.current &&
      (dragStartPosRef.current === null ||
        Math.hypot(pos.x - dragStartPosRef.current.x, pos.y - dragStartPosRef.current.y) < DRAG_THRESHOLD_PX)
    ) {
      return;
    }

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
      // Use direct update (no history) — one history entry is committed on pointer-up.
      applyActiveFloorDirect((f) => ({
        ...f,
        rooms: f.rooms.map((r) => (r.id === state.id ? snapped : r)),
      }));
      dragHasMovedRef.current = true;
    }

    if (state.mode === 'room-resize') {
      const w = Math.max(GRID * 3, snapToGrid(state.baseW + (pos.x - state.startX)));
      const h = Math.max(GRID * 3, snapToGrid(state.baseH + (pos.y - state.startY)));
      // Use direct update (no history) — one history entry is committed on pointer-up.
      applyActiveFloorDirect((f) => ({
        ...f,
        rooms: f.rooms.map((r) =>
          r.id === state.id ? { ...r, width: w, height: h } : r,
        ),
      }));
      dragHasMovedRef.current = true;
    }

    if (state.mode === 'node-move') {
      // Use direct update (no history) — one history entry is committed on pointer-up.
      applyPlanDirect((p) => ({
        ...p,
        placementNodes: p.placementNodes.map((n) =>
          n.id === state.id
            ? { ...n, anchor: { x: snapToGrid(pos.x - state.dx), y: snapToGrid(pos.y - state.dy) } }
            : n,
        ),
      }));
      dragHasMovedRef.current = true;
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
      changeTool('select');
      return;
    }

    // Commit one history entry per drag operation (room-move / room-resize / node-move).
    // We push the pre-drag snapshot so undo returns the element to where it was
    // before the drag started.  A simple click (no movement) is ignored.
    if (dragRef.current !== null && dragHasMovedRef.current && dragStartPlanRef.current !== null) {
      const preDrag = dragStartPlanRef.current;
      pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), preDrag];
      futureRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
    }
    dragStartPlanRef.current = null;
    dragHasMovedRef.current = false;
    dragStartPosRef.current = null;
    dragRef.current = null;
    emit(plan);
    // PR18: clear transient snap state on pointer-up
    setSnapPreview(null);
    setAlignGuides([]);
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
      applyWallLength(id, currentValue);
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
    <div className={[
      'fpb',
      cleanView ? 'fpb--clean-view' : '',
      previewMode ? 'fpb--handoff-preview' : '',
      selection ? 'fpb--has-selection' : '',
    ].filter(Boolean).join(' ')}>
      {/* ── PR23: Handoff preview banner with readiness validation ── */}
      {previewMode && (
        <HandoffPreviewBanner
          result={planReadinessResult}
          plan={plan}
          onExitPreview={() => setPreviewMode(false)}
          onOpenObjectLibrary={(highlightType) => {
            setObjectLibraryHighlight(highlightType);
            setShowObjectLibrary(true);
            setPreviewMode(false);
          }}
          onSelectItem={(target) => {
            // PR31: switch to the floor that contains the target before selecting it,
            // so routes and objects on floors other than the active one are reachable.
            if (target.kind === 'floor_route') {
              const targetFloor = plan.floors.find((f) =>
                (f.floorRoutes ?? []).some((r) => r.id === target.id),
              );
              if (targetFloor) setActiveFloorId(targetFloor.id);
            } else if (target.kind === 'floor_object') {
              const targetFloor = plan.floors.find((f) =>
                (f.floorObjects ?? []).some((o) => o.id === target.id),
              );
              if (targetFloor) setActiveFloorId(targetFloor.id);
            }
            setSelection(target);
          }}
        />
      )}
      {/* ── Header ── */}
      <header className="fpb__header">
        <div className="fpb__header-title">
          <h2>Property Builder</h2>
          <p>Layer 1: geometry &nbsp;·&nbsp; Layer 2: components &nbsp;·&nbsp; Layer 3: routes &nbsp;·&nbsp; Layer 4: disruptions</p>
        </div>
        <div className="fpb__header-actions">
          {/* ── Undo / redo ── */}
          <div className="fpb__undo-redo" role="group" aria-label="Undo and redo">
            <button
              className="fpb__action-btn fpb__undo-btn"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
            >
              ↩ Undo
            </button>
            <button
              className="fpb__action-btn fpb__redo-btn"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
            >
              ↪ Redo
            </button>
          </div>

          {/* ── Layer visibility toggles (PR22) ── */}
          <div className="fpb__layer-toggles" role="group" aria-label="Layer visibility">
            {(
              [
                ['geometry',         '🏠', 'Rooms'],
                ['openings',         '🚪', 'Openings'],
                ['components',       '🔧', 'Objects'],
                ['routes',           '〰',  'Routes'],
                ['dimensions',       '📏', 'Dimensions'],
                ['disruptions',      '⚠️', 'Disruptions'],
                ['confidenceBadges', '🔵', 'Confidence'],
              ] as const
            ).map(([layer, icon, label]) => (
              <button
                key={layer}
                className={`fpb__layer-btn ${visibleLayers[layer] ? 'active' : ''}`}
                onClick={() => toggleLayer(layer)}
                title={`${visibleLayers[layer] ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
                aria-pressed={visibleLayers[layer]}
                aria-label={`${visibleLayers[layer] ? 'Hide' : 'Show'} ${label}`}
              >
                <span aria-hidden="true">{icon}</span>
                <span className="fpb__layer-btn-label">{label}</span>
              </button>
            ))}
          </div>

          {/* ── Clean view toggle ── */}
          <button
            className={`fpb__action-btn fpb__clean-view-btn ${cleanView ? 'active' : ''}`}
            onClick={() => setCleanView((v) => !v)}
            title={cleanView ? 'Exit clean view' : 'Clean presentation view (hides labels)'}
            aria-pressed={cleanView}
          >
            {cleanView ? '🔍 Detail' : '🖼 Clean view'}
          </button>

          {/* ── PR22: Handoff preview toggle ── */}
          <button
            className={`fpb__action-btn fpb__preview-btn ${previewMode ? 'active' : ''}`}
            onClick={() => setPreviewMode((v) => !v)}
            title={previewMode ? 'Exit handoff preview' : 'Preview handoff — approximates what the engineer will see'}
            aria-pressed={previewMode}
          >
            {previewMode ? '✕ Exit preview' : '👁 Preview handoff'}
          </button>

          {/* ── PR24: Guided survey checklist toggle ── */}
          <button
            className={`fpb__action-btn fpb__guided-toggle-btn ${showGuidedChecklist ? 'active' : ''}`}
            onClick={() => setShowGuidedChecklist((v) => !v)}
            title={showGuidedChecklist ? 'Hide guided survey checklist' : 'Show guided survey — step-by-step capture guide'}
            aria-pressed={showGuidedChecklist}
          >
            {showGuidedChecklist ? '✕ Hide guide' : '📋 Guided survey'}
          </button>

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

          {/* ── Autosave status badge ── */}
          {floorPlanAutosave.status !== 'idle' && (
            <div
              className={`fpb__save-badge fpb__save-badge--${floorPlanAutosave.status}`}
              role="status"
              aria-live="polite"
            >
              {floorPlanAutosave.status === 'saving'   && '⏳ Saving…'}
              {floorPlanAutosave.status === 'saved'    && '✓ Saved'}
              {floorPlanAutosave.status === 'failed'   && (
                <>
                  ⚠ Save failed{' '}
                  <button className="fpb__save-retry" onClick={floorPlanAutosave.retry}>Retry</button>
                </>
              )}
              {floorPlanAutosave.status === 'retrying' && '⏳ Retrying…'}
            </div>
          )}

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
        <aside className={`fpb__sidebar${isMobileLayout && showMobileSidebar ? ' fpb__sidebar--mobile-visible' : ''}`}>
          <section className="fpb__section">
            <h3 className="fpb__section-title">Manual room layout</h3>
            <label className="fpb__field">
              <span>Default room height (m)</span>
              <input type="number" inputMode="decimal" min={2} max={4} step={0.1} value={defaultRoomHeightM} onChange={(e) => setDefaultRoomHeightM(Number(e.target.value))} />
            </label>
            <label className="fpb__field">
              <span>Room name</span>
              <input type="text" value={manualRoomName} onChange={(e) => setManualRoomName(e.target.value)} />
            </label>
            <label className="fpb__field">
              <span>Width (m)</span>
              <input type="number" inputMode="decimal" min={1.5} step={0.1} value={manualRoomWidthM} onChange={(e) => setManualRoomWidthM(Number(e.target.value))} />
            </label>
            <label className="fpb__field">
              <span>Length (m)</span>
              <input type="number" inputMode="decimal" min={1.5} step={0.1} value={manualRoomLengthM} onChange={(e) => setManualRoomLengthM(Number(e.target.value))} />
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
                onClick={() => activateTool(t.id)}
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
            {/* Opening type picker — visible when addOpening is active */}
            {tool === 'addOpening' && (
              <div className="fpb__disruption-picker">
                {(['door', 'window'] as OpeningType[]).map((t) => (
                  <button
                    key={t}
                    className={`fpb__disruption-kind-btn ${pendingOpeningType === t ? 'active' : ''}`}
                    onClick={() => setPendingOpeningType(t)}
                    title={t === 'door' ? 'Door (0.9 m default)' : 'Window (1.2 m default)'}
                  >
                    <span>{t === 'door' ? '🚪' : '🪟'}</span>
                    {t === 'door' ? 'Door' : 'Window'}
                  </button>
                ))}
                <p className="fpb__opening-hint">Click on a wall to place</p>
              </div>
            )}
            {/* PR10: Route type + status pickers — visible when addFloorRoute is active */}
            {tool === 'addFloorRoute' && (
              <div className="fpb__disruption-picker">
                <p className="fpb__opening-hint" style={{ marginTop: 0 }}>Type</p>
                {(['flow', 'return', 'hot', 'cold', 'condensate', 'discharge'] as FloorRouteType[]).map((rt) => (
                  <button
                    key={rt}
                    className={`fpb__disruption-kind-btn ${pendingRouteType === rt ? 'active' : ''}`}
                    onClick={() => setPendingRouteType(rt)}
                    title={FLOOR_ROUTE_TYPE_LABELS[rt]}
                    style={{ borderLeft: `3px solid ${FLOOR_ROUTE_TYPE_COLORS[rt]}` }}
                  >
                    {FLOOR_ROUTE_TYPE_LABELS[rt]}
                  </button>
                ))}
                <p className="fpb__opening-hint">Status</p>
                {(['existing', 'proposed', 'assumed'] as FloorRouteStatus[]).map((rs) => (
                  <button
                    key={rs}
                    className={`fpb__disruption-kind-btn ${pendingRouteStatus === rs ? 'active' : ''}`}
                    onClick={() => setPendingRouteStatus(rs)}
                    title={FLOOR_ROUTE_STATUS_LABELS[rs]}
                  >
                    {FLOOR_ROUTE_STATUS_LABELS[rs]}
                  </button>
                ))}
                <p className="fpb__opening-hint">
                  {inProgressRoutePoints.length === 0
                    ? 'Click points on the plan to draw'
                    : `${inProgressRoutePoints.length} point${inProgressRoutePoints.length !== 1 ? 's' : ''} — click Finish or Escape`}
                </p>
                {inProgressRoutePoints.length >= 2 && (
                  <button
                    className="fpb__tool-btn"
                    onClick={() => commitFloorRoute(inProgressRoutePoints)}
                    title="Finish and save route"
                  >
                    ✓ Finish route
                  </button>
                )}
                {inProgressRoutePoints.length > 0 && (
                  <button
                    className="fpb__tool-btn"
                    style={{ marginTop: 4 }}
                    onClick={() => setInProgressRoutePoints([])}
                    title="Cancel current route"
                  >
                    ✕ Cancel
                  </button>
                )}
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
                        changeTool('placeNode');
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

        {/* ── PR24: Guided survey checklist rail (desktop) ── */}
        {showGuidedChecklist && !isMobileLayout && (
          <GuidedSurveyChecklist
            steps={guidedSteps}
            onAction={handleGuidedAction}
            onClose={() => setShowGuidedChecklist(false)}
            isMobile={false}
          />
        )}

        {/* ── Canvas area ── */}
        <div className="fpb__canvas-wrap">
          {/* Tool hint bar */}
          <div className="fpb__hint-bar">
            {/* PR21: Mobile tools toggle */}
            <button
              className={`fpb__mobile-tools-btn${showMobileSidebar ? ' active' : ''}`}
              onClick={() => setShowMobileSidebar((v) => !v)}
              title="Toggle tools panel"
              aria-expanded={showMobileSidebar}
              aria-label="Toggle tools panel"
            >
              <span aria-hidden="true">☰</span>
            </button>
            {/* Active mode chip */}
            {(() => {
              const def = TOOL_DEFS.find((t) => t.id === tool);
              return (
                <span className={`fpb__mode-chip fpb__mode-chip--${tool}`} aria-label={`Current mode: ${def?.label}`}>
                  <span aria-hidden="true">{def?.icon}</span>
                  {def?.label}
                </span>
              );
            })()}
            {/* Contextual hint text */}
            <span className="fpb__hint-text">
              {TOOL_DEFS.find((t) => t.id === tool)?.hint}
              {pendingKind && ` — ${pendingKind.replace(/_/g, ' ')}`}
              {pendingFloorObjectType && ` — ${FLOOR_OBJECT_TYPE_LABELS[pendingFloorObjectType]}`}
              {pendingWallStart && ' — click endpoint to complete wall'}
              {pendingPort && ' — click target port to connect'}
              {tool === 'addFloorRoute' && inProgressRoutePoints.length > 0 && (
                <> — <strong>{inProgressRoutePoints.length} point{inProgressRoutePoints.length !== 1 ? 's' : ''}</strong> placed</>
              )}
            </span>
            <div className="fpb__hint-actions">
              {autoRoutes.length > 0 && (
                <span className="fpb__pipe-legend">
                  <span className="fpb__pipe-legend-flow">━</span> Flow
                  <span className="fpb__pipe-legend-return">━</span> Return
                </span>
              )}
              {/* PR17: Stay-in-tool toggle — visible when in a placement/drawing mode */}
              {(tool === 'placeNode' || tool === 'addFloorRoute' || tool === 'addRoom' || tool === 'drawWall') && (
                <button
                  className={`fpb__stay-toggle${stayInTool ? ' active' : ''}`}
                  onClick={() => setStayInTool((v) => !v)}
                  title={stayInTool ? 'Place once after next placement' : 'Stay in tool after placement'}
                >
                  {stayInTool ? '✓ Stay in tool' : '↺ Stay in tool'}
                </button>
              )}
              <button
                className="fpb__action-btn fpb__insert-btn"
                onClick={() => setShowObjectBrowser(true)}
                title="Insert HVAC components"
              >
                + HVAC…
              </button>
              <button
                className="fpb__action-btn fpb__insert-btn"
                onClick={() => setShowObjectLibrary(true)}
                title="Insert survey fixtures (sink, bath, shower, flue…)"
              >
                + Fixtures…
              </button>
            </div>
          </div>

          <div
            className={`fpb__board fpb__board--tool-${tool}${tool === 'select' ? ' fpb__board--select-mode' : ''}`}
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

              {/* ── Layer 1: Walls (SVG) — gated by visibleLayers.geometry ── */}
              {visibleLayers.geometry && activeFloor.walls.map((wall) => {
                const isWallSelected = selection?.kind === 'wall' && selection.id === wall.id;
                const strokeColor = isWallSelected ? '#2563eb' : wall.kind === 'external' ? '#0f172a' : '#475569';
                const strokeW = wall.kind === 'external' ? 6 : 3;
                // Punch gaps in the wall where openings sit (only when openings layer is on).
                const segments = visibleLayers.openings
                  ? wallSegmentsWithGaps(wall, activeFloor.openings)
                  : [{ x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: wall.y2 }];
                return (
                  <g
                    key={wall.id}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tool === 'select') {
                        setSelection({ kind: 'wall', id: wall.id });
                        const now = Date.now();
                        if (wallTapRef.current?.wallId === wall.id && now - wallTapRef.current.time < 450) {
                          // Double-tap: open wall detail sheet
                          setWallDetailWallId(wall.id);
                          setShowWallDetailSheet(true);
                          wallTapRef.current = null;
                        } else {
                          wallTapRef.current = { wallId: wall.id, time: now };
                        }
                      }
                    }}
                  >
                    {/* Wide transparent hit area for easier wall selection */}
                    {segments.map((seg, i) => (
                      <line
                        key={`hit-${i}`}
                        x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                        stroke="transparent"
                        strokeWidth={16}
                        strokeLinecap="round"
                      />
                    ))}
                    {segments.map((seg, i) => (
                      <line
                        key={i}
                        x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                        stroke={strokeColor}
                        strokeWidth={strokeW}
                        strokeLinecap="round"
                      />
                    ))}
                    {/* PR22: Wall kind label — improved contrast (#475569 instead of pale #94a3b8),
                         hidden when zoom is too low to read and wall is not selected */}
                    {!(zoom < LABEL_HIDE_ZOOM_THRESHOLD && !isWallSelected) && wall.kind === 'external' && (
                      <text
                        x={(wall.x1 + wall.x2) / 2}
                        y={(wall.y1 + wall.y2) / 2 - 5}
                        fontSize="9"
                        fill="#475569"
                        textAnchor="middle"
                        style={{ pointerEvents: 'none' }}
                      >
                        ext
                      </text>
                    )}
                  </g>
                );
              })}

              {/* ── Layer 1b: Openings (doors/windows in SVG) — gated by visibleLayers.openings ── */}
              {visibleLayers.openings && activeFloor.openings.map((opening) => {
                const geom: OpeningGeometry | null = getOpeningGeometry(opening, activeFloor.walls);
                if (!geom) return null;
                const { startX, startY, endX, endY, perpX, perpY, widthPx } = geom;
                const isSelected = selection?.kind === 'opening' && selection.id === opening.id;
                const accentColor = isSelected ? '#2563eb' : '#475569';
                return (
                  <g
                    key={opening.id}
                    style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tool === 'select') setSelection({ kind: 'opening', id: opening.id });
                    }}
                  >
                    {opening.type === 'door' ? (
                      <>
                        {/* Door leaf: quarter-circle arc from wall face */}
                        <path
                          d={`M ${startX},${startY} A ${widthPx},${widthPx} 0 0,1 ${startX + perpX * widthPx},${startY + perpY * widthPx}`}
                          fill="none"
                          stroke={accentColor}
                          strokeWidth={1.5}
                        />
                        {/* Door leaf straight edge */}
                        <line
                          x1={startX} y1={startY}
                          x2={startX + perpX * widthPx} y2={startY + perpY * widthPx}
                          stroke={accentColor}
                          strokeWidth={1.5}
                        />
                      </>
                    ) : (
                      <>
                        {/* Window: two short parallel lines (sill representation) */}
                        <line
                          x1={startX + perpX * 4} y1={startY + perpY * 4}
                          x2={endX + perpX * 4} y2={endY + perpY * 4}
                          stroke={accentColor}
                          strokeWidth={1.5}
                        />
                        <line
                          x1={startX - perpX * 4} y1={startY - perpY * 4}
                          x2={endX - perpX * 4} y2={endY - perpY * 4}
                          stroke={accentColor}
                          strokeWidth={1.5}
                        />
                        {/* Window end caps */}
                        <line
                          x1={startX + perpX * 4} y1={startY + perpY * 4}
                          x2={startX - perpX * 4} y2={startY - perpY * 4}
                          stroke={accentColor}
                          strokeWidth={1.5}
                        />
                        <line
                          x1={endX + perpX * 4} y1={endY + perpY * 4}
                          x2={endX - perpX * 4} y2={endY - perpY * 4}
                          stroke={accentColor}
                          strokeWidth={1.5}
                        />
                      </>
                    )}
                    {/* Opening width label (engineer view only) */}
                    {viewMode === 'engineer' && (
                      <text
                        x={(startX + endX) / 2}
                        y={(startY + endY) / 2 - 8}
                        fontSize="8"
                        fill={accentColor}
                        textAnchor="middle"
                        style={{ pointerEvents: 'none' }}
                      >
                        {opening.type === 'door' ? '🚪' : '🪟'} {opening.widthM.toFixed(1)}m
                      </text>
                    )}
                  </g>
                );
              })}

              {/* ── Layer 3a: Auto-routed heating pipes — gated by visibleLayers.routes ── */}
              {visibleLayers.routes && autoRoutes.map((route) => {
                // Mid-point for the engineer label
                const mid = route.route[Math.floor(route.route.length / 2)];
                const labelText = viewMode === 'engineer'
                  ? `${route.pipeSizeMm}mm ${route.type === 'flow' ? 'Flow' : 'Return'}`
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

              {/* ── Layer 3b: Lego edges (manual connection routes) — gated by visibleLayers.routes ── */}
              {visibleLayers.routes && activeEdges.map((edge) => {
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

              {/* ── Layer 4: Disruption annotations — gated by visibleLayers.disruptions ── */}
              {visibleLayers.disruptions && activeFloorDisruptions.map((dis) => {
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

              {/* PR10: Layer 5a: Floor routes — gated by visibleLayers.routes ── */}
              {visibleLayers.routes && (activeFloor.floorRoutes ?? []).map((fRoute) => {
                const isSelected = selection?.kind === 'floor_route' && selection.id === fRoute.id;
                const color = FLOOR_ROUTE_TYPE_COLORS[fRoute.type];
                // PR22: assumed routes use slightly heavier dashes for field-friendly visibility
                const strokeDash = fRoute.status === 'assumed'
                  ? '10 5'
                  : fRoute.status === 'proposed'
                  ? '4 2'
                  : undefined;
                // PR22: assumed routes get a slightly higher base stroke width so they read in bright rooms
                const baseStrokeWidth = fRoute.status === 'assumed' ? 3 : 2.5;
                return (
                  <g
                    key={fRoute.id}
                    style={{ cursor: tool === 'select' ? 'pointer' : 'default' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (tool === 'select') setSelection({ kind: 'floor_route', id: fRoute.id });
                    }}
                  >
                    {/* Wider transparent hit area for easier selection */}
                    <polyline
                      points={fRoute.points.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                    />
                    {/* Glow halo behind selected route */}
                    {isSelected && (
                      <polyline
                        points={fRoute.points.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke={color}
                        strokeWidth={9}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.3}
                        style={{ pointerEvents: 'none' }}
                      />
                    )}
                    {/* Visible route line */}
                    <polyline
                      points={fRoute.points.map((p) => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke={color}
                      strokeWidth={isSelected ? 4 : baseStrokeWidth}
                      strokeDasharray={strokeDash}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    {/* Start dot */}
                    <circle
                      cx={fRoute.points[0].x}
                      cy={fRoute.points[0].y}
                      r={3.5}
                      fill={color}
                    />
                    {/* End dot */}
                    <circle
                      cx={fRoute.points[fRoute.points.length - 1].x}
                      cy={fRoute.points[fRoute.points.length - 1].y}
                      r={3.5}
                      fill={color}
                    />
                    {/* PR18 / PR22: Type + status label — suppressed below zoom threshold and when unselected at low zoom */}
                    {(() => {
                      const labelPos = routeLabelPosition(fRoute.points);
                      if (!labelPos) return null;
                      // PR22: hide route labels when zoom is below threshold and route is not selected
                      if (zoom < LABEL_HIDE_ZOOM_THRESHOLD && !isSelected) return null;
                      return (
                        <text
                          x={labelPos.x + labelPos.perpOffsetX}
                          y={labelPos.y + labelPos.perpOffsetY}
                          fontSize="8"
                          fill={color}
                          textAnchor="middle"
                          className="fpb__pipe-label"
                          style={{ pointerEvents: 'none' }}
                        >
                          {FLOOR_ROUTE_TYPE_LABELS[fRoute.type]}
                          {fRoute.status !== 'existing' ? ` (${FLOOR_ROUTE_STATUS_LABELS[fRoute.status]})` : ''}
                        </text>
                      );
                    })()}
                  </g>
                );
              })}

              {/* PR10: Layer 5b: In-progress route ghost while drawing ── */}
              {tool === 'addFloorRoute' && inProgressRoutePoints.length > 0 && (
                <g style={{ pointerEvents: 'none' }}>
                  <polyline
                    points={inProgressRoutePoints.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke={FLOOR_ROUTE_TYPE_COLORS[pendingRouteType]}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    strokeLinecap="round"
                    opacity={0.65}
                  />
                  {inProgressRoutePoints.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r={3} fill={FLOOR_ROUTE_TYPE_COLORS[pendingRouteType]} opacity={0.75} />
                  ))}
                </g>
              )}

              {/* PR18: Alignment guides — axis-aligned dashed lines shown while placing objects */}
              {alignGuides.map((guide, i) =>
                guide.axis === 'x' ? (
                  <line
                    key={`guide-x-${i}`}
                    x1={guide.value} y1={0} x2={guide.value} y2={CANVAS_H}
                    stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" opacity={0.55}
                    style={{ pointerEvents: 'none' }}
                  />
                ) : (
                  <line
                    key={`guide-y-${i}`}
                    x1={0} y1={guide.value} x2={CANVAS_W} y2={guide.value}
                    stroke="#f59e0b" strokeWidth={1} strokeDasharray="4 4" opacity={0.55}
                    style={{ pointerEvents: 'none' }}
                  />
                ),
              )}

              {/* PR18: Snap target preview marker — shows what will be snapped-to before click */}
              {snapPreview && (
                <g style={{ pointerEvents: 'none' }}>
                  {snapPreview.kind === 'corner' && (
                    <circle cx={snapPreview.pos.x} cy={snapPreview.pos.y} r={7}
                      fill="none" stroke="#2563eb" strokeWidth={2.5} opacity={0.9} />
                  )}
                  {snapPreview.kind === 'wall' && (
                    <circle cx={snapPreview.pos.x} cy={snapPreview.pos.y} r={5}
                      fill="none" stroke="#7c3aed" strokeWidth={2} opacity={0.9} />
                  )}
                  {snapPreview.kind === 'object_centre' && (
                    <circle cx={snapPreview.pos.x} cy={snapPreview.pos.y} r={6}
                      fill="none" stroke="#059669" strokeWidth={2} opacity={0.9} />
                  )}
                  {snapPreview.kind === 'route_endpoint' && (
                    <circle cx={snapPreview.pos.x} cy={snapPreview.pos.y} r={5}
                      fill="#2563eb" stroke="#1d4ed8" strokeWidth={1.5} opacity={0.75} />
                  )}
                  {snapPreview.kind === 'free' && (
                    <circle cx={snapPreview.pos.x} cy={snapPreview.pos.y} r={3}
                      fill="#94a3b8" opacity={0.45} />
                  )}
                </g>
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
              {tool === 'placeNode' && ghostPos && pendingKind && (
                <g transform={`translate(${ghostPos.x - 40}, ${ghostPos.y - 18})`} opacity="0.55">
                  <rect width={80} height={36} rx={8} fill="#f0f9ff" stroke="#2563eb" strokeWidth={2} />
                  <text x={40} y={22} textAnchor="middle" fontSize={10} fill="#1e40af">
                    {pendingKind.replace(/_/g, ' ')}
                  </text>
                </g>
              )}

              {/* Ghost FloorObject being placed (PR9 / PR16: show emoji + name; PR18: snap visual cue) */}
              {tool === 'placeNode' && ghostPos && pendingFloorObjectType && (() => {
                const isSnapped = snapPreview !== null && snapPreview.kind !== 'free';
                return (
                  <g transform={`translate(${ghostPos.x - GHOST_OBJECT_W / 2}, ${ghostPos.y - GHOST_OBJECT_H / 2})`} opacity={isSnapped ? 0.85 : 0.65}>
                    <rect
                      width={GHOST_OBJECT_W}
                      height={GHOST_OBJECT_H}
                      rx={8}
                      fill={isSnapped ? '#eff6ff' : '#f0fdf4'}
                      stroke={isSnapped ? '#2563eb' : '#16a34a'}
                      strokeWidth={isSnapped ? 2.5 : 2}
                      strokeDasharray={isSnapped ? undefined : '4 2'}
                    />
                    <text x={GHOST_OBJECT_W / 2} y={16} textAnchor="middle" fontSize={14}>
                      {FLOOR_OBJECT_TYPE_EMOJI[pendingFloorObjectType]}
                    </text>
                    <text x={GHOST_OBJECT_W / 2} y={32} textAnchor="middle" fontSize={9} fill={isSnapped ? '#1e40af' : '#166534'} fontWeight="600">
                      {FLOOR_OBJECT_TYPE_LABELS[pendingFloorObjectType]}
                    </text>
                  </g>
                );
              })()}

              {/* PR9 / PR22: Wall dimension labels overlay — gated by `visibleLayers.dimensions` toggle */}
              {visibleLayers.dimensions && visibleLayers.geometry && !cleanView && (
                <WallDimensionLabels
                  walls={activeFloor.walls}
                  selectedWallId={selectedWall?.id}
                  onEditLength={(wallId, currentLengthM) =>
                    setEditingDimension({ type: 'wall-length', currentValue: currentLengthM, id: wallId })
                  }
                />
              )}
            </svg>

            {/* ── Layer 1: Rooms (DOM divs for easy interaction) — gated by visibleLayers.geometry ── */}
            {visibleLayers.geometry && activeFloor.rooms.map((room) => {
              const isSelected = selection?.kind === 'room' && selection.id === room.id;
              const badge = badgeForObject(validation, room.id);
              return (
                <div
                  key={room.id}
                  className={`fpb__room fpb__room--${room.roomType} ${isSelected ? 'selected' : ''} fpb__room--badge-${badge}`}
                  style={{ left: room.x, top: room.y, width: room.width, height: room.height }}
                  onPointerDown={(e) => {
                    if (tool !== 'select') return;
                    const pos = boardPos(e as unknown as React.PointerEvent<HTMLDivElement>);

                    // PR31: floor routes are SVG polylines that cannot stop propagation
                    // themselves — check them first (they render above rooms visually).
                    if (visibleLayers.routes) {
                      const routeHit = selectFloorRoute(pos, activeFloor.floorRoutes ?? []);
                      if (routeHit) {
                        e.stopPropagation();
                        setSelection({ kind: 'floor_route', id: routeHit.id });
                        return;
                      }
                    }

                    // PR16: enforce selection priority — wall > opening > room.
                    // Floor objects and routes handle their own stopPropagation above.
                    if (visibleLayers.geometry) {
                      const wallHit = selectWall(pos, activeFloor.walls);
                      if (wallHit) {
                        e.stopPropagation();
                        setSelection({ kind: 'wall', id: wallHit.wall.id });
                        return;
                      }
                    }
                    if (visibleLayers.openings) {
                      const openingHit = selectOpening(pos, activeFloor.openings, activeFloor.walls);
                      if (openingHit) {
                        e.stopPropagation();
                        setSelection({ kind: 'opening', id: openingHit.id });
                        return;
                      }
                    }

                    e.stopPropagation();
                    setSelection({ kind: 'room', id: room.id });
                    // Capture pre-drag snapshot for single history commit on pointer-up.
                    dragStartPlanRef.current = plan;
                    dragHasMovedRef.current = false;
                    dragStartPosRef.current = pos;
                    dragRef.current = { mode: 'room-move', id: room.id, dx: pos.x - room.x, dy: pos.y - room.y };
                  }}
                >
                  <div className="fpb__room-label">{room.name}</div>
                  <div className="fpb__room-type">{ROOM_TYPE_LABELS[room.roomType]}</div>
                  <div className="fpb__room-measure">
                    {toMeters(room.width)}m × {toMeters(room.height)}m
                  </div>
                  {/* PR22: gate confidence/validation badges on visibleLayers.confidenceBadges */}
                  {badge !== 'ok' && visibleLayers.confidenceBadges && validationBadge(room.id)}
                  {isSelected && (
                    <>
                      <div
                        className="fpb__room-resize"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          const pos = boardPos(e as unknown as React.PointerEvent<HTMLDivElement>);
                          // Capture pre-drag snapshot for single history commit on pointer-up.
                          dragStartPlanRef.current = plan;
                          dragHasMovedRef.current = false;
                          dragStartPosRef.current = pos;
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

            {/* ── Layer 2: Placement nodes (DOM divs) — gated by visibleLayers.components ── */}
            {visibleLayers.components && visibleNodes.map((node) => {
              const isSelected = selection?.kind === 'node' && selection.id === node.id;
              const badge = badgeForObject(validation, node.id);
              const palette = PALETTE_SECTIONS.flatMap((s) => s.items).find((i) => i.kind === node.type);
              const room = node.roomId ? activeFloor.rooms.find((r) => r.id === node.roomId) : null;
              const buildNode: BuildNode = { id: node.id, kind: node.type, x: node.anchor.x, y: node.anchor.y, r: 0 };
              // PR22: collapse label to emoji-only when zoom is below threshold and node is not selected
              const iconOnlyMode = zoom < LABEL_HIDE_ZOOM_THRESHOLD && !isSelected;
              return (
                <div
                  key={node.id}
                  className={`fpb__node ${isSelected ? 'selected' : ''} fpb__node--badge-${badge}${iconOnlyMode ? ' fpb__node--icon-only' : ''}`}
                  style={{ left: node.anchor.x - 52, top: node.anchor.y - 22 }}
                  onPointerDown={(e) => {
                    if (tool !== 'select' && tool !== 'connectRoute') return;
                    e.stopPropagation();
                    setSelection({ kind: 'node', id: node.id });
                    if (tool === 'select') {
                      const pos = boardPos(e as unknown as React.PointerEvent<HTMLDivElement>);
                      // Capture pre-drag snapshot for single history commit on pointer-up.
                      dragStartPlanRef.current = plan;
                      dragHasMovedRef.current = false;
                      dragStartPosRef.current = pos;
                      dragRef.current = { mode: 'node-move', id: node.id, dx: pos.x - node.anchor.x, dy: pos.y - node.anchor.y };
                    }
                  }}
                  title={room ? `In: ${room.name}` : 'Not in a room'}
                >
                  <span className="fpb__node-emoji">{palette?.emoji ?? '🔧'}</span>
                  {!iconOnlyMode && (
                    <span className="fpb__node-label">{palette?.label ?? node.type.replace(/_/g, ' ')}</span>
                  )}
                  {/* PR22: gate confidence/validation badges on visibleLayers.confidenceBadges */}
                  {badge !== 'ok' && visibleLayers.confidenceBadges && validationBadge(node.id)}

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

            {/* ── PR9: Layer 5: Floor Objects (DOM divs) ── */}
            {visibleLayers.components && (activeFloor.floorObjects ?? []).map((obj) => {
              const isSelected = selection?.kind === 'floor_object' && selection.id === obj.id;
              const iconOnlyMode = zoom < LABEL_HIDE_ZOOM_THRESHOLD && !isSelected;
              return (
                <div
                  key={obj.id}
                  className={`fpb__node${isSelected ? ' selected' : ''}${iconOnlyMode ? ' fpb__node--icon-only' : ''}`}
                  style={{ left: obj.x - 20, top: obj.y - 14 }}
                  onPointerDown={(e) => {
                    if (tool !== 'select') return;
                    e.stopPropagation();
                    setSelection({ kind: 'floor_object', id: obj.id });
                  }}
                  title={obj.label ?? FLOOR_OBJECT_TYPE_LABELS[obj.type]}
                >
                  <span className="fpb__node-emoji">{FLOOR_OBJECT_TYPE_EMOJI[obj.type]}</span>
                  {!iconOnlyMode && (
                    <span className="fpb__node-label">
                      {obj.label ?? FLOOR_OBJECT_TYPE_LABELS[obj.type]}
                    </span>
                  )}
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

            {/* ── Floating route-drawing overlay — visible while drawing a route ── */}
            {tool === 'addFloorRoute' && inProgressRoutePoints.length > 0 && (
              <div
                className="fpb__route-overlay"
                role="toolbar"
                aria-label="Route drawing controls"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <span className="fpb__route-overlay-status">
                  <span
                    aria-hidden="true"
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      background: FLOOR_ROUTE_TYPE_COLORS[pendingRouteType],
                      marginRight: 5,
                      verticalAlign: 'middle',
                    }}
                  />
                  {FLOOR_ROUTE_TYPE_LABELS[pendingRouteType]}
                  {' · '}{inProgressRoutePoints.length} point{inProgressRoutePoints.length !== 1 ? 's' : ''}
                </span>
                {inProgressRoutePoints.length >= 2 && (
                  <button
                    className="fpb__route-overlay-btn fpb__route-overlay-btn--finish"
                    onClick={() => commitFloorRoute(inProgressRoutePoints)}
                    title="Finish and save route"
                  >
                    ✓ Finish
                  </button>
                )}
                <button
                  className="fpb__route-overlay-btn fpb__route-overlay-btn--cancel"
                  onClick={() => setInProgressRoutePoints([])}
                  title="Cancel current route (Escape)"
                >
                  ✕ Cancel
                </button>
              </div>
            )}

            {/* ── Bottom action bar for selected items ── */}
            {selectedRoom && (
              <div className="fpb__bottom-actions" onPointerDown={(e) => e.stopPropagation()}>
                <button className="fpb__action-pill" onClick={() => duplicateRoom(selectedRoom)}>Duplicate</button>
                <button className="fpb__action-pill" onClick={() => setEditingDimension({ type: 'room-width', currentValue: Number(toMeters(selectedRoom.width)), id: selectedRoom.id })}>Edit Dimensions</button>
                <button className="fpb__action-pill fpb__action-pill--danger" onClick={() => deleteRoom(selectedRoom.id)}>Delete</button>
              </div>
            )}
            {selectedWall && (
              <div className="fpb__bottom-actions" onPointerDown={(e) => e.stopPropagation()}>
                <button className="fpb__action-pill" onClick={() => {
                  const wallLen = Math.sqrt((selectedWall.x2 - selectedWall.x1) ** 2 + (selectedWall.y2 - selectedWall.y1) ** 2);
                  setEditingDimension({ type: 'wall-length', currentValue: Number(toMeters(wallLen)), id: selectedWall.id });
                }}>Edit Length</button>
                <button className="fpb__action-pill" onClick={() => updateWall(selectedWall.id, { kind: selectedWall.kind === 'external' ? 'internal' : 'external' })}>Change Type</button>
                <button className="fpb__action-pill" onClick={() => addParallelWall(selectedWall)} title="Add a parallel wall offset 4 grid cells">+ Parallel Wall</button>
                <button className="fpb__action-pill" onClick={() => { setWallDetailWallId(selectedWall.id); setShowWallDetailSheet(true); }} title="Open wall detail — add doors, windows, components">Wall Detail…</button>
                <button className="fpb__action-pill fpb__action-pill--danger" onClick={() => deleteWall(selectedWall.id)}>Delete</button>
              </div>
            )}
            {selectedNode && (
              <div className="fpb__bottom-actions" onPointerDown={(e) => e.stopPropagation()}>
                <button className="fpb__action-pill" onClick={() => duplicateNode(selectedNode)}>Duplicate</button>
                <button className="fpb__action-pill" onClick={() => rotateNode(selectedNode)}>Rotate</button>
                <button className="fpb__action-pill fpb__action-pill--danger" onClick={() => deleteNode(selectedNode.id)}>Delete</button>
              </div>
            )}
            {selectedOpening && (
              <div className="fpb__bottom-actions" onPointerDown={(e) => e.stopPropagation()}>
                <button className="fpb__action-pill fpb__action-pill--danger" onClick={() => deleteOpening(selectedOpening.id)}>Delete</button>
              </div>
            )}
            {selectedFloorObject && (
              <div className="fpb__bottom-actions" onPointerDown={(e) => e.stopPropagation()}>
                <button className="fpb__action-pill" onClick={() => duplicateFloorObject(selectedFloorObject)}>⧉ Duplicate</button>
                <button className="fpb__action-pill fpb__action-pill--danger" onClick={() => deleteFloorObject(selectedFloorObject.id)}>Delete</button>
              </div>
            )}
            {selectedFloorRoute && (
              <div className="fpb__bottom-actions" onPointerDown={(e) => e.stopPropagation()}>
                <button className="fpb__action-pill fpb__action-pill--danger" onClick={() => deleteFloorRoute(selectedFloorRoute.id)}>Delete Route</button>
              </div>
            )}

            {/* ── PR21: Floating action buttons (mobile primary actions) ── */}
            {/* Finish route — visible on mobile when a route is in progress with ≥2 points */}
            {tool === 'addFloorRoute' && inProgressRoutePoints.length >= 2 && (
              <button
                className="fpb__fab"
                onClick={() => commitFloorRoute(inProgressRoutePoints)}
                onPointerDown={(e) => e.stopPropagation()}
                title="Finish and save route"
                aria-label="Finish route"
              >
                ✓ Finish
              </button>
            )}
            {/* Cancel route — visible on mobile when any route points have been placed */}
            {tool === 'addFloorRoute' && inProgressRoutePoints.length > 0 && (
              <button
                className="fpb__fab fpb__fab--cancel"
                onClick={() => setInProgressRoutePoints([])}
                onPointerDown={(e) => e.stopPropagation()}
                title="Cancel current route"
                aria-label="Cancel route"
              >
                ✕ Cancel
              </button>
            )}

            {/* ── PR24: Guided survey checklist — mobile bottom sheet ── */}
            {showGuidedChecklist && isMobileLayout && (
              <>
                <div
                  className="fpb__bottom-sheet-backdrop"
                  onClick={() => setShowGuidedChecklist(false)}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <div
                  className="fpb__bottom-sheet fpb__bottom-sheet--guided"
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <GuidedSurveyChecklist
                    steps={guidedSteps}
                    onAction={(action) => {
                      handleGuidedAction(action);
                      // Close sheet after triggering an action so the canvas is visible
                      setShowGuidedChecklist(false);
                    }}
                    onClose={() => setShowGuidedChecklist(false)}
                    isMobile={true}
                  />
                </div>
              </>
            )}

            {/* ── Add Room bottom sheet ── */}
            {showAddRoomSheet && (
              <>
                <div
                  className="fpb__bottom-sheet-backdrop"
                  onClick={() => { setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); }}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <div
                  className="fpb__bottom-sheet"
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <div className="fpb__bottom-sheet-header">
                    <span>Add Room</span>
                    <button className="fpb__delete-btn" onClick={() => { setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); }}>✕</button>
                  </div>
                  {addRoomSheetMode === 'menu' ? (
                    <div className="fpb__sheet-options">
                      <button className="fpb__sheet-option" onClick={() => { setSquareRoomLocked(false); setAddRoomSheetMode('form'); }}>
                        <span>⬛</span> Add rectangular room
                      </button>
                      <button className="fpb__sheet-option" onClick={() => { setSquareRoomLocked(true); setManualRoomLengthM(manualRoomWidthM); setAddRoomSheetMode('form'); }}>
                        <span>⬜</span> Add square room
                      </button>
                      <button className="fpb__sheet-option" onClick={() => { activateTool('addRoom'); setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); }}>
                        <span>✏️</span> Draw room
                      </button>
                      <button className="fpb__sheet-option" onClick={() => { activateTool('drawWall'); setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); }}>
                        <span>✂️</span> Split room
                      </button>
                      <button className="fpb__sheet-option" onClick={() => { activateTool('select'); setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); }}>
                        <span>🔲</span> Fill gap (select + resize)
                      </button>
                      {/* LiDAR scan — native iOS bridge (only shown when the webkit handler is present) */}
                      {hasNativeLidarSupport() && (
                        <button
                          className="fpb__sheet-option"
                          onClick={() => {
                            triggerNativeLidarScan(activeFloorId);
                            setShowAddRoomSheet(false);
                            setAddRoomSheetMode('menu');
                          }}
                        >
                          <span>📡</span> LiDAR scan (native)
                        </button>
                      )}
                      {/* LiDAR scan — wrapped package import (always available) */}
                      <button
                        className="fpb__sheet-option"
                        onClick={() => { setShowScanImportFlow(true); setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); }}
                      >
                        <span>📂</span> LiDAR scan (package import)
                      </button>
                    </div>
                  ) : (
                    <div className="fpb__sheet-form">
                      {squareRoomLocked && (
                        <div className="fpb__square-room-badge">⬜ Square room — width = length</div>
                      )}
                      <label className="fpb__field">
                        <span>Room name</span>
                        <input type="text" value={manualRoomName} onChange={(e) => setManualRoomName(e.target.value)} />
                      </label>
                      <label className="fpb__field">
                        <span>Width (m)</span>
                        <input type="number" inputMode="decimal" min={1.5} step={0.1} value={manualRoomWidthM} onChange={(e) => {
                          const v = Number(e.target.value);
                          setManualRoomWidthM(v);
                          if (squareRoomLocked) setManualRoomLengthM(v);
                        }} />
                      </label>
                      <label className="fpb__field">
                        <span>Length (m)</span>
                        <input type="number" inputMode="decimal" min={1.5} step={0.1} value={manualRoomLengthM} onChange={(e) => {
                          const v = Number(e.target.value);
                          setManualRoomLengthM(v);
                          if (squareRoomLocked) setManualRoomWidthM(v);
                        }} disabled={squareRoomLocked} aria-disabled={squareRoomLocked} />
                      </label>
                      <label className="fpb__field">
                        <span>Level</span>
                        <select value={manualRoomFloorId || activeFloorId} onChange={(e) => setManualRoomFloorId(e.target.value)}>
                          {plan.floors.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </label>
                      <button className="fpb__tool-btn" onClick={() => { createRoomFromManualForm(); setShowAddRoomSheet(false); setAddRoomSheetMode('menu'); setSquareRoomLocked(false); }}>Add room</button>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── Object browser bottom sheet (magicplan-style) ── */}
            {showObjectBrowser && (
              <>
                <div
                  className="fpb__bottom-sheet-backdrop"
                  onClick={() => setShowObjectBrowser(false)}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <div
                  className="fpb__bottom-sheet fpb__bottom-sheet--browser"
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
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
                                  // PR31: use activateTool so pendingFloorObjectType / ghostPos
                                  // from a prior object-library session are cleared first.
                                  activateTool('placeNode');
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
                <div
                  className="fpb__bottom-sheet-backdrop"
                  onClick={() => setEditingDimension(null)}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <div className="fpb__dimension-editor">
                  <div className="fpb__dimension-editor-title">
                    {editingDimension.type === 'room-width' ? 'Width (m)' : editingDimension.type === 'room-height' ? 'Height (m)' : 'Length (m)'}
                  </div>
                  {/* PR18: before/after display and inline validation for wall-length edits */}
                  {editingDimension.type === 'wall-length' && (() => {
                    const currentWall = activeFloor.walls.find((w) => w.id === editingDimension.id);
                    const beforeM = currentWall
                      ? Math.hypot(currentWall.x2 - currentWall.x1, currentWall.y2 - currentWall.y1) / GRID
                      : null;
                    const afterM = editingDimension.currentValue;
                    const wallWarning = validateWallLength(afterM);
                    return (
                      <>
                        {beforeM !== null && (
                          <div className="fpb__dimension-before">
                            {beforeM.toFixed(2)} m → {afterM > 0 ? `${afterM.toFixed(2)} m` : '—'}
                          </div>
                        )}
                        {wallWarning && (
                          <div className="fpb__dimension-warning" role="alert">
                            ⚠ {wallWarning}
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <input
                    type="number"
                    inputMode="decimal"
                    className="fpb__dimension-editor-input"
                    min={0.5}
                    step={0.1}
                    value={editingDimension.currentValue}
                    onChange={(e) => setEditingDimension({ ...editingDimension, currentValue: Number(e.target.value) })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); handleDimensionApply(); }
                      if (e.key === 'Escape') setEditingDimension(null);
                    }}
                    autoFocus
                  />
                  <div className="fpb__dimension-editor-actions">
                    <button className="fpb__action-btn" onClick={() => setEditingDimension(null)}>Cancel</button>
                    <button className="fpb__zoom-btn" onClick={handleDimensionApply}>Apply</button>
                  </div>
                </div>
              </>
            )}

            {/* ── Wall editor bottom sheet (opened via double-tap on wall) — PR9 ── */}
            {showWallDetailSheet && wallDetailWallId && activeFloor && (() => {
              const wallIdx = activeFloor.walls.findIndex((w) => w.id === wallDetailWallId);
              const detailWall = activeFloor.walls[wallIdx];
              if (!detailWall) return null;
              const wallOpenings = activeFloor.openings.filter((o) => o.wallId === wallDetailWallId);
              return (
                <WallEditorSheet
                  wall={detailWall}
                  wallIndex={wallIdx}
                  totalWalls={activeFloor.walls.length}
                  openings={wallOpenings}
                  onAddOpening={(type, offsetM, widthM) =>
                    createOpening(detailWall.id, offsetM, widthM, type)
                  }
                  onUpdateOpening={(id, patch) => updateOpening(id, patch)}
                  onDeleteOpening={(id) => deleteOpening(id)}
                  onAddComponent={(kind, x, y) => placeNode(kind, x, y)}
                  onNavigate={(delta) => {
                    const next = activeFloor.walls[(wallIdx + delta + activeFloor.walls.length) % activeFloor.walls.length];
                    if (next) { setWallDetailWallId(next.id); setSelection({ kind: 'wall', id: next.id }); }
                  }}
                  onClose={() => {
                    setShowWallDetailSheet(false);
                    // PR31: use activateTool so any stale pending state is cleared,
                    // then restore selection to the wall that was being detailed.
                    activateTool('select');
                    if (wallDetailWallId) setSelection({ kind: 'wall', id: wallDetailWallId });
                  }}
                />
              );
            })()}

            {/* ── Scan package import flow ── */}
            {showScanImportFlow && (
              <>
                <div
                  className="fpb__bottom-sheet-backdrop"
                  onClick={() => setShowScanImportFlow(false)}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <div
                  className="fpb__bottom-sheet fpb__bottom-sheet--scan"
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <div className="fpb__bottom-sheet-header">
                    <span>📂 LiDAR Scan Package Import</span>
                    <button className="fpb__delete-btn" onClick={() => setShowScanImportFlow(false)}>✕</button>
                  </div>
                  <div className="fpb__scan-import-wrap">
                    <ScanPackageImportFlow
                      existingRooms={activeFloor?.rooms ?? []}
                      onImported={applyScanDraft}
                      onCancel={() => setShowScanImportFlow(false)}
                    />
                  </div>
                </div>
              </>
            )}
            {/* ── PR9: Object library bottom sheet ── */}
            {showObjectLibrary && (
              <>
                <div
                  className="fpb__bottom-sheet-backdrop"
                  onClick={() => setShowObjectLibrary(false)}
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <div
                  className="fpb__bottom-sheet"
                  onPointerDown={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                >
                  <ObjectLibraryPanel
                    onSelect={(type) => {
                      setPendingFloorObjectType(type);
                      setPendingKind(null);
                      // PR31: use activateTool so any stale pendingKind / ghostPos is cleared.
                      activateTool('placeNode');
                      setObjectLibraryHighlight(null);
                      setShowObjectLibrary(false);
                    }}
                    onClose={() => {
                      setObjectLibraryHighlight(null);
                      setShowObjectLibrary(false);
                    }}
                    highlightType={objectLibraryHighlight ?? undefined}
                  />
                </div>
              </>
            )}
          </div>{/* end fpb__board */}
        </div>{/* end fpb__canvas-wrap */}

        {/* ── Right inspector panel / mobile bottom sheet ── */}
        {selection && (
          <aside
            className={[
              'fpb__inspector',
              isMobileLayout ? `fpb__inspector--${inspectorSheetState}` : '',
            ].filter(Boolean).join(' ')}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => { if (isMobileLayout) e.stopPropagation(); }}
          >
            {/* PR21: Drag handle — shown on mobile only via CSS */}
            <div
              className="fpb__inspector-handle"
              onClick={() => setInspectorSheetState((s) =>
                s === 'collapsed' ? 'half' : s === 'half' ? 'full' : 'collapsed',
              )}
              title="Tap to resize"
              role="button"
              aria-label="Resize inspector panel"
            >
              <div className="fpb__inspector-handle-bar" />
            </div>
            {/* Collapsed summary strip */}
            <div className="fpb__inspector-collapsed-summary">
              {selectedRoom && <><span aria-hidden="true">🏠</span> {selectedRoom.name}</>}
              {selectedWall && <><span aria-hidden="true">🧱</span> Wall</>}
              {selectedNode && <><span aria-hidden="true">🔧</span> Component</>}
              {selectedDisruption && <><span aria-hidden="true">⚠️</span> Disruption</>}
              {selectedOpening && <><span aria-hidden="true">🚪</span> Opening</>}
              {selectedFloorObject && <><span aria-hidden="true">{selectedFloorObject.type}</span> {selectedFloorObject.label ?? 'Object'}</>}
              {selectedFloorRoute && <><span aria-hidden="true">〰</span> Route</>}
              <button
                style={{ marginLeft: 'auto', fontSize: 11, padding: '2px 8px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#f8fafc', cursor: 'pointer' }}
                onClick={() => setSelection(null)}
                aria-label="Close inspector"
              >✕</button>
            </div>
            {selectedRoom && (
              <RoomInspectorPanel
                room={selectedRoom}
                floors={plan.floors}
                walls={activeFloor.walls}
                floorObjects={activeFloor.floorObjects ?? []}
                onUpdate={(patch) => updateRoom(selectedRoom.id, patch)}
                onDelete={() => deleteRoom(selectedRoom.id)}
                onDuplicate={() => duplicateRoom(selectedRoom)}
                onFocus={focusSelection}
              />
            )}
            {selectedWall && (
              <WallInspectorPanel
                wall={selectedWall}
                onUpdate={(patch) => updateWall(selectedWall.id, patch)}
                onUpdateLength={(newLengthM) => applyWallLength(selectedWall.id, newLengthM)}
                onDelete={() => deleteWall(selectedWall.id)}
                onFocus={focusSelection}
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
            {selectedOpening && (
              <InspectorOpening
                opening={selectedOpening}
                walls={activeFloor.walls}
                onUpdate={(patch) => updateOpening(selectedOpening.id, patch)}
                onDelete={() => deleteOpening(selectedOpening.id)}
              />
            )}
            {selectedFloorObject && (
              <ObjectInspectorPanel
                object={selectedFloorObject}
                rooms={activeFloor.rooms}
                walls={activeFloor.walls}
                onUpdate={(patch) => patchFloorObject(selectedFloorObject.id, patch)}
                onDelete={() => deleteFloorObject(selectedFloorObject.id)}
                onDuplicate={() => duplicateFloorObject(selectedFloorObject)}
                onFocus={focusSelection}
                engineerView={viewMode === 'engineer'}
              />
            )}
            {selectedFloorRoute && (
              <RouteInspectorPanel
                route={selectedFloorRoute}
                onUpdate={(patch) => patchFloorRoute(selectedFloorRoute.id, patch)}
                onDelete={() => deleteFloorRoute(selectedFloorRoute.id)}
                onFocus={focusSelection}
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
          {/* Customer view rounds to 0 dp — a rough figure is sufficient for disruption discussions.
              Engineer view uses 1 dp for accurate materials estimation. */}
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

      {/* ── Behaviour panel ── */}
      {visibleNodes.length > 0 && (
        <section className="fpb__simulation">
          <div className="fpb__simulation-header">
            <h3>System Behaviour</h3>
            <p>
              {visibleNodes.length} component{visibleNodes.length !== 1 ? 's' : ''} placed on {activeFloor.name}.
              {' '}The lego builder below uses this floor's components to run a live physics model.
            </p>
            <button
              className={`fpb__sim-toggle ${showSimulation ? 'active' : ''}`}
              onClick={() => setShowSimulation((v) => !v)}
            >
              {showSimulation ? 'Hide behaviour view' : 'Run behaviour view ▶'}
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
// Note: InspectorRoom and InspectorWall have been replaced by the new panel
// components (RoomInspectorPanel, WallInspectorPanel) imported at the top.

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

// ─── InspectorOpening ─────────────────────────────────────────────────────────

function InspectorOpening({
  opening,
  walls,
  onUpdate,
  onDelete,
}: {
  opening: Opening;
  walls: Wall[];
  onUpdate: (patch: Partial<Opening>) => void;
  onDelete: () => void;
}) {
  const wall = walls.find((w) => w.id === opening.wallId);
  const wallLenM = wall
    ? Number((Math.hypot(wall.x2 - wall.x1, wall.y2 - wall.y1) / GRID).toFixed(2))
    : 0;

  return (
    <div className="fpb__inspector-body">
      <div className="fpb__inspector-heading">
        <span>
          {opening.type === 'door' ? '🚪' : '🪟'}{' '}
          {opening.type === 'door' ? 'Door' : 'Window'}
        </span>
        <button className="fpb__delete-btn" onClick={onDelete} title="Delete opening">✕</button>
      </div>
      <label className="fpb__field">
        <span>Type</span>
        <select
          value={opening.type}
          onChange={(e) => onUpdate({ type: e.target.value as OpeningType })}
        >
          <option value="door">🚪 Door</option>
          <option value="window">🪟 Window</option>
        </select>
      </label>
      <label className="fpb__field">
        <span>Width (m)</span>
        <input
          type="number"
          min={0.5}
          max={5}
          step={0.1}
          value={opening.widthM}
          onChange={(e) => onUpdate({ widthM: Number(e.target.value) })}
        />
      </label>
      <label className="fpb__field">
        <span>Offset (m)</span>
        <input
          type="number"
          min={0}
          max={Math.max(0, wallLenM - opening.widthM)}
          step={0.1}
          value={opening.offsetM}
          onChange={(e) => onUpdate({ offsetM: Number(e.target.value) })}
        />
      </label>
      {wall && (
        <div className="fpb__field fpb__field--static">
          <span>Wall</span>
          <span>{wall.kind === 'external' ? 'External' : 'Internal'} · {wallLenM.toFixed(1)} m</span>
        </div>
      )}
    </div>
  );
}
