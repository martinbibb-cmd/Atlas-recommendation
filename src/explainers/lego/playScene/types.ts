// src/explainers/lego/playScene/types.ts
//
// PlaySceneModel — presentation layer between simulation output and rendering.
//
// The renderer should not infer what to show.
// It receives an explicit scene description built by buildPlaySceneModel().
//
// Pipeline:
//   saved graph (BuildGraph / LabControls)
//   → resolved topology
//   → simulation result (LabFrame)
//   → PlaySceneModel        ← this file
//   → renderer (LabCanvas)

// ─── Node roles ───────────────────────────────────────────────────────────────

export type PlaySceneNodeRole =
  | 'heat_source'
  | 'cylinder'
  | 'cws'
  | 'outlet_manifold'
  | 'radiators'
  | 'valve'
  | 'hex'
  | 'label'

// ─── Activity state (PR 15 — demand-linked glow) ──────────────────────────────

/**
 * What kind of activity a component is currently performing.
 *
 * idle        — component is not active; no glow or animation.
 * ch_firing   — heat source firing for space heating (CH); soft amber glow.
 * dhw_firing  — heat source firing hard for DHW demand; stronger orange-red glow.
 * reheat      — cylinder coil reheating stored water; amber pulse near coil.
 * emitting    — emitters releasing heat into the room; faint heat shimmer.
 */
export type ActivityKind = 'idle' | 'ch_firing' | 'dhw_firing' | 'reheat' | 'emitting'

export type PlaySceneActivity = {
  /** What the component is currently doing. */
  kind: ActivityKind
  /**
   * Normalised intensity 0–1.
   *   0   = idle
   *   0.5 = moderate
   *   1.0 = high (maximum demand)
   */
  intensity: number
}

// ─── PlaySceneNode ────────────────────────────────────────────────────────────

export type PlaySceneNode = {
  id: string
  role: PlaySceneNodeRole
  visible: boolean
  active?: boolean
  x: number
  y: number
  data?: Record<string, unknown>
  /** Activity/demand-linked visual cue for this node (PR 15). */
  activity?: PlaySceneActivity
}

// ─── PlaySceneEdge ────────────────────────────────────────────────────────────

export type PlaySceneEdgeKind =
  | 'ch_flow'
  | 'ch_return'
  | 'dhw_hot'
  | 'dhw_cold'
  | 'tank_refill'
  | 'coil_flow'
  | 'coil_return'
  | 'hidden'

export type PlaySceneEdge = {
  id: string
  from: string
  to: string
  kind: PlaySceneEdgeKind
  /**
   * Circuit domain for domain-aware rendering (PR5).
   *
   * heating  — space-heating circuit (boiler → radiators/UFH → boiler)
   * primary  — primary circuit in stored systems (boiler → cylinder coil → boiler)
   * dhw      — domestic hot-water path (heat source / cylinder → outlets)
   * cold     — cold-water supply (mains or gravity from CWS)
   */
  domain?: 'heating' | 'primary' | 'dhw' | 'cold'
  visible: boolean
  active?: boolean
  direction?: 'forward' | 'reverse'
}

// ─── PlaySceneModel ───────────────────────────────────────────────────────────

/**
 * Explicit scene description for Play mode rendering.
 *
 * Built by buildPlaySceneModel() from LabControls + LabFrame.
 * Consumed by LabCanvas as the single source of truth for:
 *   - which nodes are visible
 *   - which edges are visible
 *   - which paths are CH / DHW
 *   - which source is active
 *   - which storage vessel is active
 *   - topology-specific display rules
 *
 * The renderer should use these flags and node activity states — not
 * independently infer topology visibility from raw controls.
 */
export type PlaySceneModel = {
  nodes: PlaySceneNode[]
  edges: PlaySceneEdge[]
  /** Builder graph edge IDs that must be hidden in this scene. */
  hiddenGraphEdgeIds?: string[]
  /**
   * Explicit topology display flags.
   *
   * showGenericColdFeed  — show the mains cold-supply pipe (combi / unvented).
   *                        Set false for vented cylinders to prevent the
   *                        duplicate-side-cold-feed bug.
   * showCwsRefill        — show the CWS cistern and gravity-drop cold feed
   *                        (vented cylinder systems only).
   * showHeatSource       — heat source box must be visible when the system
   *                        is actively firing for CH or DHW.
   * showHeatingPath      — render the CH supply path to emitters.
   * showCylinderAsStore  — render the DHW vessel as a thermal store
   *                        (not as a simple pass-through pipe).
   */
  metadata: {
    showGenericColdFeed: boolean
    showCwsRefill: boolean
    showHeatSource: boolean
    showHeatingPath: boolean
    showCylinderAsStore: boolean
  }
}
