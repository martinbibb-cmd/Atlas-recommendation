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

// ─── Outlet service classification ────────────────────────────────────────────

/**
 * Classifies an outlet by which water service it draws from.
 *
 * cold_only — outlet draws cold supply only; must NOT appear on the hot branch,
 *             must NOT contribute to DHW demand, and must NOT deplete a cylinder store.
 * mixed     — outlet draws both hot and cold (e.g. basin, bath, shower with TMV).
 * hot_only  — outlet draws hot water only (rarely needed; present for completeness).
 *
 * The renderer and simulation use this to gate hot-service logic so that cold taps
 * are never treated as hot-service outlets (PR16 fix).
 */
export type OutletServiceClass = 'cold_only' | 'mixed' | 'hot_only'

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
   * sceneLayoutKind      — which visual scene skeleton to render.
   *                        'combi'     — combi boiler with plate HEX (on-demand DHW, no cylinder).
   *                        'stored'    — boiler with separate cylinder / thermal store.
   *                        'heat_pump' — heat pump source; may or may not have a cylinder.
   *                        The renderer branches on this field — NOT on systemType or isCylinder —
   *                        ensuring heat pump systems are never rendered as the combi HEX layout.
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
    sceneLayoutKind: 'combi' | 'stored' | 'heat_pump'
    showGenericColdFeed: boolean
    showCwsRefill: boolean
    showHeatSource: boolean
    showHeatingPath: boolean
    showCylinderAsStore: boolean
    /**
     * True when the built graph uses a Mixergy thermal store.
     * Drives both the cylinder label ("Mixergy cylinder") and the
     * visual cylinder representation: Mixergy uses a top-down hot-band fill
     * (active stratification) instead of the standard bottom-up fill.
     */
    isMixergy?: boolean
    /**
     * Control topology derived from the built graph.
     * Used to select the structural valve rendering in the Play schematic —
     * NOT just a label.
     * 'none'             → no zone valves or 3-port valve; no valve node rendered
     * 'y_plan'           → 3-port motorised valve (single diamond node, routes CH or HW)
     * 's_plan'           → two independent zone valves (two circle nodes, may open together)
     * 's_plan_multi_zone'→ three or more zone valves (multiple circle nodes)
     * 'hp_diverter'      → heat pump with buffer/low-loss header
     */
    controlTopologyKind?: 'none' | 'y_plan' | 's_plan' | 's_plan_multi_zone' | 'hp_diverter'
    /**
     * Total number of outlet branch nodes (hot-fed + cold-only) present in the
     * build graph.  The renderer uses this to limit displayed outlet branches to
     * the actual graph-derived count rather than always showing all three A/B/C
     * slots.  Undefined when graphFacts are absent (legacy controls).
     */
    outletCount?: number
    /**
     * Number of cold-only outlets (e.g. cold taps) in the build graph.
     * These outlets draw from cold supply only and must never be shown on the
     * hot-water branch or contribute to DHW demand.
     * Undefined when graphFacts are absent (legacy controls).
     */
    coldOnlyOutletCount?: number
    /**
     * True when combi service switching is active: a DHW draw has diverted the
     * boiler output to the plate HEX, temporarily suspending the CH call.
     *
     * The renderer must:
     *   - suppress or dim the CH visual path
     *   - stop or fade radiator tokens
     *   - display "CH paused for DHW" to explain the interruption
     *
     * This flag is the authoritative source for that condition — the renderer
     * must NOT re-derive it from systemMode or frame state independently.
     *
     * Only set for combi systems.  Always false/absent for stored-cylinder or
     * heat-pump systems where CH and DHW can run simultaneously.
     */
    serviceSwitchingActive?: boolean
  }
}
