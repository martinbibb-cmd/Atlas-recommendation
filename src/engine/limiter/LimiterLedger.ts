/**
 * LimiterLedger.ts — PR8: Canonical limiter ledger types.
 *
 * Defines the shared machine-readable limiter contract that explains why a
 * system struggled.  This is a downstream-only, explanatory layer — it owns
 * no business logic and makes no recommendations.
 *
 * Sequencing:
 *   PR4  fixed stored-water physical phases.
 *   PR5  fixed combi physical phases.
 *   PR6  introduced the canonical internal state timeline.
 *   PR7  derived readable events and counters from that timeline.
 *   PR8  (this file) defines the limiter ledger that maps evidence to causes.
 *
 * Design rules:
 *   1. Every limiter entry must point to real evidence.
 *   2. No entry may be emitted without a trigger source.
 *   3. Family-specific limiters must respect topology ownership.
 *   4. Ordering is deterministic (severity → domain → id).
 *   5. Ledger is explanatory only; no recommendation ranking yet.
 */

import type { ApplianceFamily } from '../topology/SystemTopology';

// ─── Domain ───────────────────────────────────────────────────────────────────

/**
 * The physics or system domain that the limiter belongs to.
 *
 *   dhw           — domestic hot water delivery or storage constraint
 *   space_heating — space-heating capacity or temperature constraint
 *   hydraulic     — pipework, flow, or pressure constraint
 *   efficiency    — thermodynamic or system-efficiency penalty
 *   installability — physical installation feasibility constraint
 *   controls      — controls or programming constraint
 *   lifecycle     — age, condition, or service-history constraint
 */
export type LimiterDomain =
  | 'dhw'
  | 'space_heating'
  | 'hydraulic'
  | 'efficiency'
  | 'installability'
  | 'controls'
  | 'lifecycle';

// ─── Severity ─────────────────────────────────────────────────────────────────

/**
 * How severely the limiter affects system performance or an upgrade pathway.
 *
 *   info      — informational; no performance impact at present
 *   warning   — degraded or suboptimal condition; impacts but does not block
 *   limit     — hard physics or topology constraint reached; service impaired
 *   hard_stop — fundamental incompatibility; upgrade pathway not advised
 */
export type LimiterSeverity = 'info' | 'warning' | 'limit' | 'hard_stop';

// ─── Entry ────────────────────────────────────────────────────────────────────

/**
 * A single named constraint or limiter recorded in the ledger.
 *
 * Every entry must have real evidence: the `source` and `triggerKeys` fields
 * must point to actual module outputs, timeline fields, or event types.
 * An entry must not be emitted from UI summaries or invented without evidence.
 */
export interface LimiterLedgerEntry {
  /**
   * Machine-readable identifier for this limiter type.
   * See COMBI_ONLY_LIMITER_IDS / STORE_ONLY_LIMITER_IDS for family restrictions.
   */
  readonly id: string;

  /**
   * The appliance family that produced this entry.
   * Family-specific limiters must respect the ownership sets defined below.
   */
  readonly family: ApplianceFamily;

  /** Physics / system domain this limiter belongs to. */
  readonly domain: LimiterDomain;

  /** How severely this limiter affects the system or an upgrade pathway. */
  readonly severity: LimiterSeverity;

  /** Short human-readable title for this limiter (used in downstream UI). */
  readonly title: string;

  /**
   * Detailed description of the physical cause and observed consequence.
   * Written in past tense describing what happened during the modelled run.
   */
  readonly description: string;

  /**
   * The module or sub-system that provided the primary evidence for this entry.
   * Examples: 'timeline', 'hydraulic', 'stored_dhw_phase', 'condensing_state'.
   */
  readonly source: string;

  /**
   * Keys of the events, module flags, or output fields that triggered this entry.
   * Must be non-empty.  Used for downstream traceability and test assertions.
   */
  readonly triggerKeys: string[];

  /**
   * Whether this constraint could be resolved by an upgrade intervention.
   * False for inherent physics limits (e.g. mains flow, HP slow recovery).
   * True for constraints that are specific to the current system configuration.
   */
  readonly removableByUpgrade: boolean;

  /**
   * Candidate upgrade interventions that could address this limiter.
   * Machine-readable IDs (e.g. 'switch_to_stored_system', 'upsize_cylinder').
   * Empty when no known intervention addresses this limiter.
   */
  readonly candidateInterventions: string[];

  /**
   * How confident the engine is that this limiter is real.
   *
   *   measured — evidence comes from a directly measured field (e.g. flow test)
   *   derived  — evidence is computed from model outputs or event projections
   *   assumed  — evidence is estimated from heuristics when direct data is absent
   */
  readonly confidence: 'measured' | 'derived' | 'assumed';
}

// ─── Ledger ───────────────────────────────────────────────────────────────────

/**
 * Complete set of limiter entries for a single engine run.
 *
 * - `entries` is always present (may be empty for a clean or standby-only run).
 * - Entries are ordered deterministically: severity (hard_stop first) → domain → id.
 * - No duplicate `id` values unless the same limiter is triggered by independent
 *   evidence sources (which is currently not modelled).
 */
export interface LimiterLedger {
  readonly entries: readonly LimiterLedgerEntry[];
}

// ─── Family ownership ─────────────────────────────────────────────────────────

/**
 * Limiter IDs that are only valid for combi-family runs.
 * These IDs must not appear in hydronic (non-combi) ledgers.
 */
export const COMBI_ONLY_LIMITER_IDS: ReadonlySet<string> = new Set([
  'combi_service_switching',
]);

/**
 * Limiter IDs that are only valid for stored (hydronic) family runs.
 * These IDs must not appear in combi ledgers.
 */
export const STORE_ONLY_LIMITER_IDS: ReadonlySet<string> = new Set([
  'stored_volume_shortfall',
  'reduced_dhw_service',
  'hp_reheat_latency',
  'open_vented_head_limit',
  'space_for_cylinder_unavailable',
]);

/**
 * Limiter IDs that are only valid for heat-pump family runs.
 * These IDs must not appear in boiler-family (combi/system/regular) ledgers.
 */
export const HEAT_PUMP_ONLY_LIMITER_IDS: ReadonlySet<string> = new Set([
  'hp_reheat_latency',
  'hp_high_flow_temp_penalty',
]);
