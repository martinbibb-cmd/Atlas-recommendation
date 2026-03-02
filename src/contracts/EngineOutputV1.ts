import type { ENGINE_VERSION, CONTRACT_VERSION } from './versions';
import type { AssumptionId } from './assumptions.ids';
import type { PenaltyId } from './scoring.penaltyIds';

export interface AssumptionV1 {
  id: AssumptionId;
  title: string;
  detail: string;
  affects: Array<'timeline_24h' | 'options' | 'recommendation' | 'context'>;
  severity: 'info' | 'warn';
  improveBy?: string;
  /** Grouping for collapsible chip display in the verdict panel. */
  group?: 'missing-data' | 'defaults' | 'derived';
}

export interface ConfidenceV1 {
  level: 'high' | 'medium' | 'low';
  reasons: string[];
  /** Inputs that are unknown and reduce confidence in this output. */
  unknowns?: string[];
  /** Actions that would resolve unknowns and increase confidence. */
  unlockBy?: string[];
}

export interface EngineMetaV1 {
  engineVersion: typeof ENGINE_VERSION;
  contractVersion: typeof CONTRACT_VERSION;
  confidence?: ConfidenceV1;
  assumptions?: AssumptionV1[];
}

export interface EligibilityItem {
  id: 'on_demand' | 'stored_vented' | 'stored_unvented' | 'ashp';
  label: string;
  status: 'viable' | 'rejected' | 'caution';
  reason?: string;
}

export interface EvidenceItemV1 {
  /** Stable identifier unique within an output. */
  id: string;
  /** JSON-path-style field reference, e.g. "services.mainsDynamicPressureBar". */
  fieldPath: string;
  /** Human-readable label for display. */
  label: string;
  /** Formatted value string including units, e.g. "2.5 bar". */
  value: string;
  /** How this value was obtained. */
  source: 'manual' | 'assumed' | 'placeholder' | 'derived';
  /** Confidence in the value and its influence on the output. */
  confidence: 'high' | 'medium' | 'low';
  /** Which option IDs this evidence item primarily affects. */
  affectsOptionIds: Array<'combi' | 'stored_vented' | 'stored_unvented' | 'ashp' | 'regular_vented' | 'system_unvented'>;
}

export interface RedFlagItem {
  id: string;
  severity: 'info' | 'warn' | 'fail';
  title: string;
  detail: string;
  action?: string;
}

export interface ExplainerItem {
  id: string;
  title: string;
  body: string;
}

export interface TraceItem {
  id: string;
  steps: string[];
}

export interface OptionPlane {
  status: 'ok' | 'caution' | 'na';
  headline: string;
  bullets: string[];
  evidenceIds?: string[];
}

export interface OptionRequirements {
  mustHave: string[];
  likelyUpgrades: string[];
  niceToHave: string[];
}

export interface SensitivityItem {
  /** The input lever that would change this outcome, e.g. "Primary pipe size". */
  lever: string;
  /** Direction of change: upgrade = more viable, downgrade = less viable. */
  effect: 'upgrade' | 'downgrade';
  /** Human-readable explanation of the boundary condition. */
  note: string;
}

export interface ScoreBreakdownItem {
  id: PenaltyId;
  label: string;
  penalty: number;
}

export interface OptionScoreV1 {
  /** Clamped 0–100. */
  total: number;
  breakdown: ScoreBreakdownItem[];
  confidencePenalty?: number;
  /** Engine-provided score band — prevents UI from inventing thresholds. */
  band?: 'excellent' | 'good' | 'mixed' | 'poor' | 'not_viable';
}

export interface OptionCardV1 {
  id: 'combi' | 'stored_vented' | 'stored_unvented' | 'ashp' | 'regular_vented' | 'system_unvented';
  label: string;
  status: 'viable' | 'caution' | 'rejected';
  headline: string;
  /**
   * Confidence badge shown at the top of the option card — not buried in an evidence table.
   * Engine-owned: prevents UI from inventing its own confidence thresholds.
   */
  confidenceBadge?: {
    level: 'high' | 'medium' | 'low';
    /** One-line label for display, e.g. "High confidence (measured)". */
    label: string;
  };
  why: string[];
  /** @deprecated Use requirements.mustHave / likelyUpgrades / niceToHave instead. */
  requirements: string[];
  evidenceIds?: string[];
  /** Wet-side hydraulics, flow temperatures, emitter suitability, cycling risk. */
  heat: OptionPlane;
  /** DHW pressure, simultaneity, recovery profile. */
  dhw: OptionPlane;
  /** Space, loft head, discharge route, buffer/header constraints. */
  engineering: OptionPlane;
  /** Typed requirements replacing the flat requirements[] array. */
  typedRequirements: OptionRequirements;
  /** "What would change this outcome?" — boundary condition explanations. */
  sensitivities?: SensitivityItem[];
  /** Deterministic 0–100 score with penalty breakdown. */
  score?: OptionScoreV1;
}

/** DHW event block within a 24-hour timeline. */
export interface Timeline24hEvent {
  startMin: number;
  endMin: number;
  kind: 'sink' | 'bath' | 'charge' | 'cold_only' | 'dishwasher' | 'washing_machine';
  intensity: 'low' | 'med' | 'high';
}

/** A single active DHW draw entry within a per-timestep events list. */
export interface DhwEventEntry {
  kind: 'sink' | 'bath' | 'charge';
  drawKw: number;
}

/**
 * Canonical per-timestep timeline point (fixed-step series).
 * Used by both Day Painter (user-edited inputs) and Results 24h (survey engine inputs).
 * Timestep: 15 min (288 points per day).
 */
export interface TimelinePointV1 {
  /** Minutes elapsed since midnight (0–1435). */
  minuteOfDay: number;
  /** Space-heat demand required to track setpoint (kW). */
  shDemandKw: number;
  /** Indoor (room) temperature (°C) — from RC 1-node building model. */
  indoorTempC?: number;
  /** Outdoor temperature used in this step (°C). */
  outdoorTempC?: number;
  /** Heat source output (kW) — combi/boiler/ASHP delivered to system. */
  sourceOutKw: number;
  /** Maximum instantaneous capacity of the heat source (kW), when known. */
  sourceMaxKw?: number;
  /** Flow temperature at heat source outlet (°C). */
  flowTempC?: number;
  /** Return temperature at heat source inlet (°C). */
  returnTempC?: number;
  /**
   * Performance metric value.
   * η (0–1) for boilers; COP (> 1) for ASHP.
   * May be negative when standing/cycling losses exceed useful output (not a bug).
   */
  performanceValue: number;
  /** Indicates whether performanceValue is an efficiency fraction (η) or COP. */
  performanceKind: 'eta' | 'cop';
  /** Total hot-water draw from the system at this timestep (kW). */
  dhwTotalKw: number;
  /**
   * Individual DHW events active at this timestep (usually 0–1 items; rarely 2 for overlap).
   * Absent when no events are active.
   */
  dhwEventsActive?: DhwEventEntry[];
}

/**
 * Band annotations spanning the full vertical extent of the chart.
 * Rendered as background fills across all rows simultaneously.
 * kind is open-ended: 'sh_on' | 'dhw_on' | 'defrost' | 'anti_cycle' | string
 */
export interface TimelineBandsV1 {
  bands: Array<{ kind: string; startMin: number; endMin: number }>;
}

/** One system's data series within a 24-hour timeline. */
export interface Timeline24hSeries {
  id: string;
  label: string;
  heatDeliveredKw: number[];
  efficiency: number[];
  comfortTempC?: number[];
  dhwOutletTempC?: number[];
  dhwFlowLpm?: number[];
  /** Room temperature (°C) at each 15-min step — from RC 1-node building model. */
  roomTempC?: number[];
  /** Fuel or electrical input power (kW) at each 15-min step. */
  inputPowerKw?: number[];
  /**
   * DHW store state (0–100) at each 15-min step.
   * Stored/ASHP: socPct (% of cylinder capacity).
   * Combi: 100 when event is served, < 100 when capacity-limited.
   */
  dhwState?: number[];
  /**
   * Space-heat demand required to track setpoint (kW) — from RC building model.
   * Shared baseline across both systems; stored per-series for alignment.
   */
  heatDemandKw?: number[];
  /**
   * Whether performanceValue (= efficiency) is an η fraction or a COP.
   * 'eta' for boilers; 'cop' for ASHP.
   */
  performanceKind?: 'eta' | 'cop';
  /**
   * Total hot-water draw (kW) per timestep.
   * Drives the DHW events bar track in the renderer.
   */
  dhwTotalKw?: number[];
  /**
   * Active DHW events per timestep (parallel to timeMinutes).
   * Each element is the list of concurrent hot-water draws at that step.
   */
  dhwEventsActive?: DhwEventEntry[][];
}

/**
 * Physics debug data attached to a 24-hour timeline payload.
 * Only present when the engine can resolve the current boiler's efficiency baseline
 * AND the evaluation context has debug mode enabled (debug=true).
 * Consumed by the debug overlay (rendered when ?debug=1 is in the URL).
 */
export interface PhysicsDebugV1 {
  /** Derived ErP energy label class (A–G) based on nominal efficiency. */
  erpClass?: string;
  /** Nominal (as-installed) SEDBUK seasonal efficiency (percentage points, e.g. 92). */
  nominalEfficiencyPct: number;
  /** 10-year scale/sludge-based efficiency decay from water chemistry (percentage points). */
  tenYearEfficiencyDecayPct: number;
  /** Current (post-decay) efficiency used for the timeline (percentage points). */
  currentEfficiencyPct: number;
  /** How the SEDBUK baseline was resolved: 'gc' | 'band' | 'unknown' | 'fallback'. */
  sedbukSource: 'gc' | 'band' | 'unknown' | 'fallback';
  /** Number of timeline points — used to sanity-check hover index bounds. */
  timelinePoints?: number;
}

/** Payload for the timeline_24h visual type (96 points at 15-min intervals). */
export interface Timeline24hV1 {
  timeMinutes: number[];
  /** Thermal (space heat + DHW) demand at each 15-minute point. Cold-fill appliances are excluded. */
  demandHeatKw: number[];
  /**
   * Cold mains flow demand (L/min) at each 15-minute point.
   * Driven by cold-fill appliances (dishwasher, washing machine) — NOT a thermal load.
   * Present only when a lifestyle profile with cold-flow events is provided.
   */
  coldFlowLpm?: number[];
  series: Timeline24hSeries[];
  events: Timeline24hEvent[];
  /**
   * Background-band annotations (sh_on, dhw_on, defrost, anti_cycle, …).
   * Spans all chart rows when rendered.
   */
  bands?: TimelineBandsV1;
  legendNotes?: string[];
  /**
   * Physics debug snapshot — populated when the engine resolves a boiler baseline.
   * Rendered in the chart debug overlay when ?debug=1 is in the URL.
   */
  physicsDebug?: PhysicsDebugV1;
}

export interface VisualSpecV1 {
  /** Stable identifier for the visual (unique within an output). */
  id: string;
  /** Visual type — drives the UI renderer switch. */
  type: 'pressure_drop' | 'ashp_flow' | 'dhw_outlets' | 'space_footprint' | 'timeline_24h';
  /** Optional display title. */
  title?: string;
  /** Type-specific data payload — consumed by the matching renderer. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  /** Option IDs this visual is primarily relevant to. Undefined = relevant to all. */
  affectsOptionIds?: string[];
}

// ─── Behaviour Timeline (V1) ──────────────────────────────────────────────────

/**
 * A single point in the BehaviourTimelineV1 series.
 * The timeline renderer must not run physics — all values are pre-normalised.
 */
export interface TimelineSeriesPoint {
  /** ISO timestamp or "HH:MM" label for the X axis. */
  t: string;
  /** Space-heat demand (kW ≥ 0). */
  heatDemandKw: number;
  /** DHW demand (kW ≥ 0). */
  dhwDemandKw: number;
  /** Total delivered output from the appliance (kW ≥ 0). */
  applianceOutKw: number;
  /** Optional constant capacity line (kW). */
  applianceCapKw?: number;
  /** Boiler efficiency fraction (0–1). Present for boiler systems. */
  efficiency?: number;
  /** Heat pump COP (> 1). Present for ASHP systems. */
  cop?: number;
  /** Operating mode at this timestep. */
  mode?: 'space' | 'dhw' | 'mixed' | 'idle';
  /**
   * Actual heat delivered to CH circuit (kW).
   * For a combi boiler in DHW priority mode this is 0 (lockout).
   * Equal to applianceOutKw for non-lockout ticks.
   */
  deliveredHeatKw?: number;
  /**
   * Actual DHW delivered (kW).
   * For a combi in DHW priority: equals applianceOutKw.
   * For space-only ticks: 0.
   */
  deliveredDhwKw?: number;
  /**
   * Unmet space-heat demand (kW) due to DHW priority lockout.
   * Non-zero only for combi ticks where mode is 'dhw' or 'mixed'.
   */
  unmetHeatKw?: number;
}

/**
 * Complete 24-hour behaviour timeline produced by the engine.
 * The UI renderer must be "dumb" — draw only; no physics.
 */
export interface BehaviourTimelineV1 {
  timezone: 'Europe/London';
  resolutionMins: 5 | 10 | 15;
  points: TimelineSeriesPoint[];

  labels: {
    /** e.g. "Combi Boiler", "System Boiler", "ASHP" */
    applianceName: string;
    efficiencyLabel: 'Efficiency' | 'COP';
    /**
     * True when the appliance is a combi boiler with DHW priority lockout.
     * The renderer uses this to show lockout band shading on the heat demand row.
     */
    isCombi?: boolean;
  };

  /**
   * Assumptions surfaced near the timeline — shown as info/warn badges.
   */
  assumptionsUsed: Array<{
    id: string;
    label: string;
    details?: string;
    severity: 'info' | 'warn';
  }>;

  /**
   * Optional callout annotations anchored to specific timeline points.
   * Customer mode: max 2 shown; Engineer mode: all shown.
   */
  annotations?: Array<{
    /** Index into `points` array where the annotation is anchored. */
    atIndex: number;
    /** Short human-readable callout text. */
    text: string;
    /** Which chart row this annotation belongs to. */
    row: 'heat' | 'dhw' | 'out' | 'eff';
  }>;
}

// ─── Limiters (V1) ────────────────────────────────────────────────────────────

export type LimiterSeverity = 'info' | 'warn' | 'fail';

export interface LimiterMetric {
  label: string;
  value: number;
  unit: 'kW' | 'L/min' | 'm/s' | 'kPa' | '%' | 'COP';
}

export interface LimiterFix {
  id: string;
  label: string;
  deltaHint?: string;
}

export interface LimiterV1 {
  id:
    | 'mains-flow-constraint'
    | 'combi-concurrency-constraint'
    | 'primary-pipe-constraint'
    | 'cycling-loss-penalty'
    | 'flow-temp-too-high-for-ashp'
    | 'radiator-output-insufficient'
    | string;

  title: string;
  severity: LimiterSeverity;

  observed: LimiterMetric;
  limit: LimiterMetric;

  impact: {
    summary: string;
    detail?: string;
  };

  confidence: 'high' | 'medium' | 'low';

  sources: Array<{
    kind: 'measured' | 'assumed' | 'derived';
    id?: string;
    note?: string;
  }>;

  suggestedFixes: LimiterFix[];

  /** Optional index ranges within BehaviourTimelineV1.points for highlighting. */
  activeWindows?: Array<{ startIndex: number; endIndex: number }>;
}

export interface LimitersV1 {
  limiters: LimiterV1[];
}

// ─── Influence Summary (V1) ───────────────────────────────────────────────────

export interface InfluenceBlockV1 {
  /** 0–100 percentage influence this domain has on the overall verdict. */
  influencePct: number;
  /** Top 2 influencing factors (plain English). */
  topDrivers: string[];
  /** Count of assumptions in this domain. */
  assumptionsCount: number;
}

export interface InfluenceSummaryV1 {
  heat: InfluenceBlockV1;
  dhw: InfluenceBlockV1;
  hydraulics: InfluenceBlockV1;
}

// ─── Verdict (V1) ─────────────────────────────────────────────────────────────

export interface VerdictV1 {
  /** Plain English title for the primary recommendation. */
  title: string;
  /** Traffic-light status. */
  status: 'good' | 'caution' | 'fail';
  /** Up to 3 human-readable reasons for this verdict. */
  reasons: string[];
  /** Confidence from the engine. */
  confidence: ConfidenceV1;
  /** Centralised list of assumptions surfaced at the verdict level. */
  assumptionsUsed: AssumptionV1[];
  /**
   * Decision context: "comparison" when multiple technologies were evaluated and
   * the verdict reflects why one was preferred over another; "single-tech" otherwise.
   */
  context?: 'comparison' | 'single-tech';
  /**
   * Technologies that were compared against the primary recommendation.
   * Only present when context is "comparison".
   * e.g. ["ASHP"] when boiler is recommended over heat pump.
   */
  comparedTechnologies?: string[];
  /**
   * Plain English sentence explaining the primary reason for this recommendation
   * over the compared alternatives.
   * e.g. "Boiler recommended over ASHP for fast reheat and current pipework constraints"
   */
  primaryReason?: string;
}

// ─── Pathway Planning (V1) ────────────────────────────────────────────────────

/**
 * A prerequisite step that must happen before this pathway is viable.
 * Linked to a limiter ID so the UI can cross-reference constraint details.
 */
export interface PathwayPrerequisiteV1 {
  /** Human-readable description, e.g. "Upgrade primary pipework to 28 mm". */
  description: string;
  /** Optional trigger event that unlocks this step, e.g. "Drive dug up for supply upgrade". */
  triggerEvent?: string;
  /** ID of the LimiterV1 this prerequisite addresses. */
  limiterRef?: string;
}

/**
 * A single pathway option produced by the engine.
 * The expert selects one; the engine documents consequences and prerequisites.
 */
export interface PathwayOptionV1 {
  /** Stable identifier for this pathway option. */
  id: string;
  /** Short human-readable title, e.g. "Boiler + Mixergy now, ASHP later". */
  title: string;
  /** One-line rationale driven by the current constraints. */
  rationale: string;
  /** What the customer experiences today under this pathway. */
  outcomeToday: string;
  /** What changes after the trigger event (if any). */
  outcomeAfterTrigger?: string;
  /** Ordered list of prerequisites this pathway depends on. */
  prerequisites: PathwayPrerequisiteV1[];
  /** Confidence and unknowns for this specific pathway. */
  confidence: ConfidenceV1;
  /**
   * Relative ranking hint: 1 = most recommended under current assumptions.
   * The expert may override by selecting any pathway.
   */
  rank: number;
}

/**
 * The full plan output: 2–3 pathway options with audit metadata.
 * The expert selects one; the selected pathway id is stored outside the engine.
 */
export interface PlanV1 {
  pathways: PathwayOptionV1[];
  /**
   * Constraints that all pathways share — facts the expert cannot change
   * without altering the underlying physics assumptions.
   */
  sharedConstraints: string[];
}

export interface EngineOutputV1 {
  eligibility: EligibilityItem[];
  redFlags: RedFlagItem[];
  recommendation: {
    primary: string;
    secondary?: string;
  };
  explainers: ExplainerItem[];
  trace?: TraceItem[];
  contextSummary?: { bullets: string[] };
  options?: OptionCardV1[];
  /** Structured list of what inputs mattered and how confident we are. */
  evidence?: EvidenceItemV1[];
  /** Engine-driven visual specs. UI renders by type switch — no business logic in UI. */
  visuals?: VisualSpecV1[];
  meta?: EngineMetaV1;
  /** Pre-normalised 24h behaviour timeline for the Behaviour Console UI. */
  behaviourTimeline?: BehaviourTimelineV1;
  /** First-class named constraints explaining the verdict. */
  limiters?: LimitersV1;
  /** Centralised verdict object — all panels must reference this, not re-derive. */
  verdict?: VerdictV1;
  /** Domain influence summary for InfluenceBlocks UI panel. */
  influenceSummary?: InfluenceSummaryV1;
  /** 2–3 pathway options for expert selection — engine provides physics truth; expert selects the plan. */
  plans?: PlanV1;
}
