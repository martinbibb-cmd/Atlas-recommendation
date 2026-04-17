/**
 * FinalPresentationPayload.ts — Canonical output contract v1.
 *
 * Single authoritative shape for every customer-facing and engineer-facing
 * surface derived from an Atlas visit.  All four output surfaces (customer
 * portal, print summary, engineer prep, internal trace) must be derived from
 * this payload — never from independent sources or parallel heuristics.
 *
 * Design rules (see docs/atlas-canonical-contract.md §2):
 *   - One payload per selected system family.
 *   - UI must never render primary content from more than one family at once.
 *   - Comparison / shortlist content lives in `shortlist[]`, not in the primary fields.
 *   - If `selectedFamily` is an unvented stored arrangement, the primary fields
 *     must NOT contain combi on-demand DHW values.
 *
 * Consuming surfaces:
 *   - Customer portal    → `selectedFamily`, `reasons`, `evidence`, `requiredWork`
 *   - Print summary      → all fields
 *   - Engineer prep      → `evidence`, `confidence`, `requiredWork`, `shortlist`
 *   - Internal trace     → `internalTrace` (optional)
 */

import type { ApplianceFamily } from '../engine/topology/SystemTopology';

// ─── Sub-types ────────────────────────────────────────────────────────────────

/** The system family chosen as the primary recommendation. */
export type RecommendedFamily = ApplianceFamily;

/** Heat source within the recommended family. */
export type HeatSourceType =
  | 'gas_combi'
  | 'gas_system'
  | 'gas_regular'
  | 'oil_combi'
  | 'oil_system'
  | 'ashp'
  | 'gshp'
  | 'electric_boiler'
  | 'unknown';

/** Hot water arrangement for the recommended system. */
export type HotWaterArrangement =
  | 'on_demand'          // On-demand hot water
  | 'stored_unvented'    // Mains-pressure sealed cylinder
  | 'stored_vented'      // Open-vented / tank-fed cylinder
  | 'thermal_store'      // Thermal store (primary-side)
  | 'mixergy'            // Mixergy stratified cylinder
  | 'unknown';

/** Controls tier recommended with the primary system. */
export type ControlsTier =
  | 'basic_room_thermostat'
  | 'weather_compensation'
  | 'smart_trvs'
  | 'full_zone_control'
  | 'load_compensation';

/** Emitter suitability for the recommended system. */
export interface EmitterSuitability {
  /** True when existing radiators can be retained without upsizing. */
  existingRadiatorsCompatible: boolean;
  /** Required flow temperature (°C) for the recommended system at design conditions. */
  requiredFlowTempC: number;
  /** Human-readable emitter note, e.g. "Radiators sized for 70 °C — suitable for system boiler at 65 °C". */
  note: string;
}

/** Infrastructure implication for the recommended system. */
export interface InfrastructureImplication {
  id: string;
  /** Severity: 'info' | 'warn' | 'fail' */
  severity: 'info' | 'warn' | 'fail';
  /** Human-readable label, e.g. "22 mm primaries limit ASHP flow-rate". */
  label: string;
  /** Optional detail note. */
  detail?: string;
}

/** A single causal reason why this system was recommended. */
export interface RecommendationReason {
  id: string;
  /** Human-readable reason, e.g. "2 bathrooms require stored hot water for simultaneous outlets". */
  text: string;
  /** Physics module that produced this reason, e.g. "CombiDhwModule". */
  sourceModule?: string;
}

/** An evidence item backing this recommendation. */
export interface EvidenceItem {
  id: string;
  /** JSON-path-style field reference, e.g. "bathroomCount". */
  fieldPath: string;
  /** Human-readable label. */
  label: string;
  /** Formatted value string with units, e.g. "2 bathrooms". */
  value: string;
  /** How the value was obtained. */
  source: 'manual' | 'assumed' | 'placeholder' | 'derived';
  /** Confidence in this evidence item. */
  confidence: 'high' | 'medium' | 'low';
}

/** Confidence summary for the full recommendation. */
export interface RecommendationConfidence {
  level: 'high' | 'medium' | 'low';
  /** Human-readable explanation of the confidence level. */
  explanation: string;
  /** Fields that are assumed / defaulted and reduce confidence. */
  uncertainFields: string[];
  /** Actions that would resolve uncertainty and increase confidence. */
  unlockBy: string[];
}

/** A single required work item. */
export interface RequiredWorkItem {
  id: string;
  category: 'must_do' | 'optional_improvement' | 'future_ready';
  /** Human-readable label. */
  label: string;
  /** Optional detail note. */
  detail?: string;
  /** Whether this item is a regulatory / compliance requirement. */
  complianceRequired?: boolean;
}

/** A shortlisted alternative option (for compare drawer / alternatives tab). */
export interface ShortlistAlternative {
  /** Option id, e.g. "stored_unvented". */
  optionId: string;
  /** Display title. */
  title: string;
  /** One-line summary of this option. */
  summary: string;
  /** Why this was not the primary recommendation. */
  whyNotPrimary: string;
  /** Penalty summary — key physics reasons it scored lower. */
  penaltySummary: string[];
}

// ─── Root contract ────────────────────────────────────────────────────────────

/**
 * Canonical single-family presentation payload.
 *
 * Produced by `buildFinalPresentationPayload()` from a completed FullEngineResult.
 * Consumed by all four output surfaces without recomputation.
 *
 * Validation invariants:
 *   - `selectedFamily` must be set and non-null.
 *   - If `hotWaterArrangement` is 'stored_unvented' or 'stored_vented', the
 *     presentation must not render combi / on-demand DHW fields as primary content.
 *   - `shortlist` entries must have a different `optionId` from the primary
 *     `selectedFamily` → `heatSource` combination.
 */
export interface FinalPresentationPayload {
  /** Contract version stamp — must match CONTRACT_VERSION in src/contracts/versions.ts. */
  contractVersion: string;

  /** The single chosen system family for this visit. */
  selectedFamily: RecommendedFamily;

  /** Heat source within the chosen family. */
  heatSource: HeatSourceType;

  /** Hot water arrangement for the chosen system. */
  hotWaterArrangement: HotWaterArrangement;

  /** Controls tier recommended alongside the primary system. */
  controls: ControlsTier;

  /** Emitter suitability assessment for the primary system. */
  emitters: EmitterSuitability;

  /** Infrastructure implications that must be communicated to the customer. */
  infrastructure: InfrastructureImplication[];

  /** Causal reasons why this system was recommended (physics-derived). */
  reasons: RecommendationReason[];

  /** Evidence items backing this recommendation. */
  evidence: EvidenceItem[];

  /** Overall recommendation confidence. */
  confidence: RecommendationConfidence;

  /** Required work items, sorted by category (must_do first). */
  requiredWork: RequiredWorkItem[];

  /** Worthwhile upgrades — items that improve the system but are not mandatory. */
  worthwhileUpgrades: RequiredWorkItem[];

  /** Future-ready options — items for future compatibility (EV, ASHP, PV, etc.). */
  futureReady: RequiredWorkItem[];

  /**
   * Shortlisted alternatives considered during ranking.
   * Shown only in the compare drawer / alternatives tab — never as primary content.
   */
  shortlist: ShortlistAlternative[];

  /**
   * Optional internal trace for engineer prep and QA surfaces.
   * Not rendered in customer-facing views unless the "Proof" layer is explicitly opened.
   */
  internalTrace?: {
    engineRunMeta?: Record<string, unknown>;
    penaltyBreakdown?: Array<{ optionId: string; penalties: Array<{ id: string; value: number }> }>;
    unresolved?: string[];
  };
}

// ─── Validation guard ─────────────────────────────────────────────────────────

/**
 * validateFamilyConsistency — ensures a FinalPresentationPayload is internally
 * consistent with respect to family / DHW type boundaries.
 *
 * Returns an array of violation strings.  An empty array means the payload is
 * valid.  Call this in DEV builds and in unit tests; never in hot render paths.
 *
 * Enforced rules:
 *   1. A stored (unvented / vented) hot water arrangement must not coexist with
 *      a combi heat source, since combis provide on-demand DHW — not stored.
 *   2. The `shortlist` must not contain the same family/source as the primary.
 *   3. `reasons` and `evidence` must both be non-empty for the payload to be
 *      considered "physics-ready".
 */
export function validateFamilyConsistency(payload: FinalPresentationPayload): string[] {
  const violations: string[] = [];

  // Rule 1: stored DHW arrangement must not use a combi heat source.
  const storedArrangements: HotWaterArrangement[] = [
    'stored_unvented',
    'stored_vented',
    'thermal_store',
    'mixergy',
  ];
  const combiSources: HeatSourceType[] = ['gas_combi', 'oil_combi'];

  if (
    storedArrangements.includes(payload.hotWaterArrangement) &&
    combiSources.includes(payload.heatSource)
  ) {
    violations.push(
      `FinalPresentationPayload: hotWaterArrangement="${payload.hotWaterArrangement}" is a stored arrangement but heatSource="${payload.heatSource}" is a combi (on-demand) source. These are incompatible families.`,
    );
  }

  // Rule 2: shortlist must not duplicate the primary recommendation.
  for (const alt of payload.shortlist) {
    if (alt.optionId === payload.selectedFamily) {
      violations.push(
        `FinalPresentationPayload: shortlist entry "${alt.optionId}" duplicates the primary selectedFamily. Move it out of the shortlist.`,
      );
    }
  }

  // Rule 3: physics-ready check — must have at least one reason and one evidence item.
  if (payload.reasons.length === 0) {
    violations.push(
      'FinalPresentationPayload: reasons[] is empty. A physics-ready recommendation must have at least one causal reason.',
    );
  }
  if (payload.evidence.length === 0) {
    violations.push(
      'FinalPresentationPayload: evidence[] is empty. A physics-ready recommendation must have at least one evidence item.',
    );
  }

  return violations;
}

/**
 * assertFamilyConsistency — throws in DEV builds when the payload violates
 * family consistency rules.  Safe no-op in production.
 */
export function assertFamilyConsistency(payload: FinalPresentationPayload): void {
  if (import.meta.env.DEV) {
    const violations = validateFamilyConsistency(payload);
    if (violations.length > 0) {
      console.error(
        '[Atlas] FinalPresentationPayload family consistency violations:',
        violations,
      );
    }
  }
}
