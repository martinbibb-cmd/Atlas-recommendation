/**
 * sceneGraph.types.ts
 *
 * 3D is a derived projection of semantic truth. It is never the canonical model.
 *
 * All scene nodes carry a canonical entityId so hit-testing can bridge back to
 * the Spatial Twin store without the renderer owning any engineering state.
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ─── Scene graph metadata ─────────────────────────────────────────────────────

export type SceneMode = 'current' | 'proposed' | 'compare';

export interface SpatialTwinSceneGraphMetadata {
  mode: SceneMode;
  generatedAt: string;
  sourceModelId: string;
  sourceRevision: number;
}

// ─── Node geometry variants ───────────────────────────────────────────────────

export type SceneNodeGeometry =
  | {
      type: 'extrudedPolygon';
      points: Array<{ x: number; y: number }>;
      height: number;
    }
  | {
      type: 'box';
      width: number;
      depth: number;
      height: number;
      position: Vec3;
      rotationY?: number;
    }
  | {
      type: 'polyline3d';
      points: Vec3[];
    }
  | {
      type: 'billboard';
      position: Vec3;
      icon: string;
    }
  | {
      type: 'marker';
      position: Vec3;
      markerKind: string;
    };

// ─── Appearance ───────────────────────────────────────────────────────────────

/**
 * Visual tone drives the colour palette applied by the renderer.
 *
 * neutral  — existing/unchanged state
 * current  — emphasis for the current branch
 * proposed — emphasis for the proposed branch
 * removed  — ghost colouring for items being removed
 * warning  — overlay-driven alerts
 * ghost    — semi-transparent; used for compare delta baseline
 */
export type SceneNodeTone =
  | 'neutral'
  | 'current'
  | 'proposed'
  | 'removed'
  | 'warning'
  | 'ghost';

export interface SceneNodeAppearance {
  tone: SceneNodeTone;
  dashed?: boolean;
  selectable: boolean;
  visible: boolean;
}

// ─── Debug metadata ───────────────────────────────────────────────────────────

export interface SceneNodeDebug {
  certainty?: string;
  status?: string;
  semanticRole?: string;
}

// ─── Scene node ───────────────────────────────────────────────────────────────

/**
 * Semantic branch a node belongs to within a compare-mode graph.
 *
 * current  — only shown in current view
 * proposed — only shown in proposed view
 * shared   — present in both branches (rooms, unchanged objects)
 */
export type SceneNodeBranch = 'current' | 'proposed' | 'shared';

export type SceneEntityKind =
  | 'room'
  | 'emitter'
  | 'heatSource'
  | 'store'
  | 'pipeRun'
  | 'evidence'
  | 'opening'
  | 'boundary';

export interface SpatialTwinSceneNode {
  /** Stable ID for this scene node (not a canonical entity ID). */
  sceneNodeId: string;
  /** Canonical entity ID in the Spatial Twin model — preserved for hit-testing. */
  entityId: string;
  /** Category of the underlying entity. */
  entityKind: SceneEntityKind;
  /** Which branch this node belongs to in compare mode. */
  branch: SceneNodeBranch;
  /** Human-readable label for UI / legend. */
  label?: string;

  geometry: SceneNodeGeometry;
  appearance: SceneNodeAppearance;
  debug?: SceneNodeDebug;
}

// ─── Scene edge ───────────────────────────────────────────────────────────────

export interface SpatialTwinSceneEdge {
  sceneEdgeId: string;
  fromNodeId: string;
  toNodeId: string;
  kind: 'pipe_connection' | 'zone_link';
}

// ─── Scene graph ──────────────────────────────────────────────────────────────

export interface SpatialTwinSceneGraph {
  nodes: SpatialTwinSceneNode[];
  edges?: SpatialTwinSceneEdge[];
  metadata: SpatialTwinSceneGraphMetadata;
}

// ─── Builder options ──────────────────────────────────────────────────────────

export interface SpatialTwinSceneBuildOptions {
  /** Override the default room extrusion height (canvas units). */
  roomHeightUnits?: number;
  /** Override the default elevation above floor for pipes (canvas units). */
  pipeElevationUnits?: number;
  /** Skip evidence markers in the output. */
  omitEvidence?: boolean;
  /** Skip pipe run nodes in the output. */
  omitPipes?: boolean;
}

// ─── Export hook ──────────────────────────────────────────────────────────────

export interface SceneExportPayload {
  graph: SpatialTwinSceneGraph;
  formatHint?: 'usdz' | 'glb' | 'internal';
}
