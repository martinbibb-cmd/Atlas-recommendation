/**
 * EvidenceTiers.ts
 *
 * Claim-governance layer for the Atlas recommendation engine.
 *
 * Every recommendation statement Atlas emits must carry an evidence tier.
 * Higher tiers (tier_1, tier_2) are closest to measured reality; lower tiers
 * (tier_4, tier_5) are heuristics or vendor claims and must be caveated or
 * withheld from customer-facing copy.
 *
 * Governance rules (enforced by code and tests):
 *   1. tier_1_measured and tier_2_model_specific may be stated as facts.
 *   2. tier_3_standard_rule may be stated as fact with the source cited.
 *   3. tier_4_engineering_heuristic must be phrased as "may", "can", "depends",
 *      or "needs checking" — never as a hard assertion.
 *   4. tier_5_vendor_claim must never be shown as a fact; always label as
 *      "per [manufacturer] guidance" when surfaced.
 *   5. Heuristics must never flip recommendation state on their own; they may
 *      only create "check needed" or "possible with caveats".
 */

// ─── Evidence tiers ───────────────────────────────────────────────────────────

/**
 * The five evidence tiers Atlas uses to classify recommendation statements.
 *
 *  tier_1_measured       User/site measurements and directly entered survey
 *                        facts (flow rate, dynamic pressure, heat loss, etc.).
 *
 *  tier_2_model_specific Manufacturer data for the selected appliance or
 *                        cylinder (e.g. Vaillant ecoFIT sustain 30 kW DHW
 *                        performance table at Δ35 K).
 *
 *  tier_3_standard_rule  HSE / MCS / WRAS / Building Regulations rule that
 *                        applies regardless of manufacturer or model.
 *
 *  tier_4_engineering_heuristic
 *                        Internal Atlas fallback: an engineering rule of thumb
 *                        with no cited standard or model data. Always caveated.
 *
 *  tier_5_vendor_claim   A statement from manufacturer marketing or sales
 *                        material. Never shown as fact; always labelled as
 *                        vendor guidance when surfaced.
 */
export type EvidenceTier =
  | 'tier_1_measured'
  | 'tier_2_model_specific'
  | 'tier_3_standard_rule'
  | 'tier_4_engineering_heuristic'
  | 'tier_5_vendor_claim';

// ─── Confidence modes ─────────────────────────────────────────────────────────

/**
 * How confident Atlas is in a particular claim.
 *
 *  measured   Derived directly from user-entered site measurements.
 *  modelled   Computed from a physical model applied to survey inputs.
 *  assumed    No site data — Atlas is using a default assumption.
 */
export type ClaimConfidenceMode = 'measured' | 'modelled' | 'assumed';

// ─── Evidence-tagged claim ────────────────────────────────────────────────────

/**
 * A recommendation statement with full evidence provenance.
 *
 * All recommendation strings emitted by the engine should ideally carry this
 * metadata so that the presentation layer can apply appropriate caveats.
 */
export interface EvidenceTaggedClaim {
  /** The human-readable statement. */
  readonly statement: string;
  /** Evidence tier classifying how the statement was derived. */
  readonly evidenceTier: EvidenceTier;
  /** The original source (standard reference, manufacturer document, etc.). */
  readonly sourceRef?: string;
  /** How the claim was produced. */
  readonly confidenceMode: ClaimConfidenceMode;
}

// ─── Hard rules (tier_1 / tier_2 / tier_3 only) ──────────────────────────────

/**
 * Hard rules may only be applied when supported by one of the three highest
 * evidence tiers.  They may not be derived from heuristics or vendor claims.
 *
 * Examples of valid hard rules:
 *  - Sealed CH operating pressure guidance (tier_3_standard_rule — Worcester / Vaillant).
 *  - Combi DHW flow from selected model tables (tier_2_model_specific).
 *  - Heat pump flow-temperature / DHW capability (tier_3_standard_rule — MCS).
 *  - HSE Legionella hot-water storage/distribution temperature (tier_3_standard_rule).
 *  - Selected-cylinder inlet pressure minima per manufacturer (tier_2_model_specific).
 */
export type HardRuleEvidenceTier =
  | 'tier_1_measured'
  | 'tier_2_model_specific'
  | 'tier_3_standard_rule';

/**
 * Returns true when the given tier qualifies for a hard rule assertion.
 * Heuristics and vendor claims must use soft-rule phrasing instead.
 */
export function isHardRuleTier(tier: EvidenceTier): tier is HardRuleEvidenceTier {
  return (
    tier === 'tier_1_measured' ||
    tier === 'tier_2_model_specific' ||
    tier === 'tier_3_standard_rule'
  );
}

// ─── Forbidden-claim identifiers ─────────────────────────────────────────────

/**
 * Identifiers for blanket claims that Atlas must never emit.
 *
 * These represent engineering heuristics or vendor talking points that have
 * been misrepresented as hard physics facts in earlier Atlas versions.
 * Adding a claim ID here is the first step — the engine module that produced
 * the claim must also be updated to emit caveated language instead.
 */
export type ForbiddenClaimId =
  | 'combi_cuts_out_below_1bar'
  | 'system_boiler_for_unvented_only'
  | 'mains_systems_bad_for_baths'
  | 'ashp_requires_28mm_from_8kw'
  | 'radiators_need_2_5x_bigger'
  | 'weekly_antilegionella_immersion_required'
  | 'worcester_uniquely_supports_softened_water'
  | 'theta_wetting_angle_domestic_decision_rule';

// ─── Wording templates ────────────────────────────────────────────────────────

/**
 * Correct and incorrect wording examples for common claim patterns.
 *
 * These are authoritative Atlas copy templates.  Engine modules and
 * presentation components should use or adapt these, not invent new phrasing.
 */
export const CLAIM_WORDING_TEMPLATES = {
  combi_pressure: {
    bad:  "This combi will fail below 1 bar.",
    good: "This combi's hot-water performance depends on inlet flow and pressure. " +
          "The selected appliance lists 1 bar as the minimum pressure for " +
          "maximum rated flow; below this, outlet flow and delivered temperature may both fall.",
  },
  system_boiler_storage: {
    bad:  "System boilers are used with unvented cylinders.",
    good: "System boilers are commonly used with stored hot water and may be paired " +
          "with vented or unvented cylinders depending on the system design.",
  },
  heat_pump_emitters: {
    bad:  "Heat pumps need bigger radiators.",
    good: "Low-temperature systems often need more emitter output. The exact change " +
          "depends on room-by-room heat loss and target flow temperature.",
  },
  ashp_pipework: {
    bad:  "ASHPs require 28mm primary pipework from 8 kW.",
    good: "Heat pump primary pipework requirements depend on system design flow " +
          "rates and the selected model. A hydraulic calculation is needed to " +
          "confirm whether pipework upgrades are required.",
  },
  legionella_control: {
    bad:  "Every heat-pump setup needs a weekly immersion cycle.",
    good: "Where stored hot water is used with a heat pump, a Legionella control " +
          "strategy is needed. HSE guidance requires hot water stored at 60°C " +
          "and distributed at 50°C at outlets within 1 minute. " +
          "The specific control approach depends on system design.",
  },
  softened_water: {
    bad:  "Worcester uniquely supports softened water.",
    good: "Worcester Bosch 8000+ explicitly allows a water softener on the DHW " +
          "circuit per manufacturer guidance, with the heating circuit filled " +
          "with hard water and inhibitor. Always confirm softened-water " +
          "compatibility with the selected appliance datasheet.",
  },
} as const;
