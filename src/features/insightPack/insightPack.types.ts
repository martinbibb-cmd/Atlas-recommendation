/**
 * insightPack.types.ts
 *
 * Atlas Insight Pack — customer-facing quote comparison and physics-derived
 * rating types.
 *
 * DESIGN RULES (non-negotiable):
 *   - Ratings are outputs of physics, never arbitrary inputs.
 *   - RatingBand replaces all numeric scores — no "97/100" style values.
 *   - Every rating must carry a reason (human) and physics (technical cause).
 *   - SystemLimitation maps directly to engine flags / module outputs.
 *   - All user-facing strings must use terminology from docs/atlas-terminology.md.
 */

// ─── Quote Input ──────────────────────────────────────────────────────────────

/**
 * A single contractor quote as entered by the surveyor.
 * The Insight Pack compares 1–N quotes against the engine-derived home profile.
 */
export interface QuoteInput {
  /** Stable identifier for this quote within the session (e.g. "quote_a"). */
  id: string;
  /** Display label shown on the comparison card (e.g. "Quote A — ABC Heating"). */
  label: string;
  /**
   * System technology type.
   * 'combi'   → on-demand hot water (combination boiler)
   * 'system'  → sealed CH + unvented cylinder
   * 'regular' → open-vented CH + vented cylinder
   * 'ashp'    → air source heat pump
   */
  systemType: 'combi' | 'system' | 'regular' | 'ashp';
  /** Nominal heat output of the heat source (kW). */
  heatSourceKw?: number;
  /** Cylinder specification, when included. */
  cylinder?: {
    type: 'standard' | 'mixergy';
    volumeL: number;
  };
  /** Upgrade items included in this quote (e.g. "powerflush", "filter", "controls"). */
  includedUpgrades: string[];
}

// ─── Rating Bands ─────────────────────────────────────────────────────────────

/**
 * Five-band qualitative rating.
 * Replaces numeric scores — ratings emerge from physics, not arithmetic.
 *
 * Excellent        → meets or exceeds all demand under normal conditions
 * Very Good        → minor limitations that most users will not notice
 * Good             → adequate for typical use; noticeable limits under peak demand
 * Needs Right Setup → works with correct configuration; risk of poor experience otherwise
 * Less Suited       → physics constraints mean this option struggles in this home
 */
export type RatingBand =
  | 'Excellent'
  | 'Very Good'
  | 'Good'
  | 'Needs Right Setup'
  | 'Less Suited';

/**
 * A rated dimension with its derivation chain.
 * Ensures every displayed band can be traced back to a physics reason.
 */
export interface RatingExplanation {
  /** The derived band for this dimension. */
  rating: RatingBand;
  /** Plain-English reason suitable for the customer card. */
  reason: string;
  /** Actual physics cause — used in the engineer detail view. */
  physics: string;
}

/**
 * Per-quote, per-dimension physics-derived ratings.
 * All five dimensions must be populated; none may be omitted.
 */
export interface SystemRating {
  hotWaterPerformance: RatingExplanation;
  heatingPerformance: RatingExplanation;
  efficiency: RatingExplanation;
  reliability: RatingExplanation;
  /** Overall fit to THIS home — synthesises all dimensions. */
  suitability: RatingExplanation;
}

// ─── System Limitations ───────────────────────────────────────────────────────

/**
 * A physics-grounded system limitation.
 * Derived from engine flags (RedFlagItem, CombiDhwFlagItem, StoredDhwFlagItem, LimiterV1).
 * Must never be invented — only maps to real module outputs.
 */
export interface SystemLimitation {
  severity: 'low' | 'medium' | 'high';
  category: 'hot_water' | 'heating' | 'pressure' | 'efficiency';
  /** Customer-facing message. Must use atlas-terminology.md terms. */
  message: string;
  /** Engineering cause that drives this limitation. */
  physicsReason: string;
}

// ─── Daily Use Translation ────────────────────────────────────────────────────

/**
 * A single "what this means in practice" statement.
 * Derived from DHW behaviour module and occupancy modelling.
 */
export interface DailyUseStatement {
  /** e.g. "1 shower at a time comfortably" */
  statement: string;
  /** Which demand scenario this covers. */
  scenario: 'simultaneous_draw' | 'pressure' | 'recovery' | 'efficiency' | 'general';
}

// ─── Improvement ──────────────────────────────────────────────────────────────

/**
 * A recommended upgrade or add-on for a specific quote.
 * Each improvement maps to a measurable physics impact.
 */
export interface Improvement {
  title: string;
  impact: 'performance' | 'efficiency' | 'longevity';
  /** Plain-English explanation of the benefit. */
  explanation: string;
}

// ─── Best Advice ──────────────────────────────────────────────────────────────

/**
 * The Atlas recommendation summary — one clear winner with reasons.
 * Derived from engine verdict + option card analysis.
 */
export interface BestAdvice {
  /** Short recommendation statement. */
  recommendation: string;
  /** Physics-grounded reasons why this is the best fit. */
  because: string[];
  /** What the recommended option avoids compared to alternatives. */
  avoids: string[];
  /** The quote ID this advice recommends (if mapped to a specific quote). */
  recommendedQuoteId?: string;
}

// ─── Savings Plan ─────────────────────────────────────────────────────────────

/**
 * Behaviour, settings, and future-upgrade advice for maximising system value.
 */
export interface SavingsPlan {
  behaviour: string[];
  settings: string[];
  futureUpgrades: string[];
}

// ─── Quote Insight ────────────────────────────────────────────────────────────

/**
 * All derived insight for a single quote.
 * Aggregates all dimensions so each panel can render from one object.
 */
export interface QuoteInsight {
  quote: QuoteInput;
  dailyUse: DailyUseStatement[];
  limitations: SystemLimitation[];
  rating: SystemRating;
  improvements: Improvement[];
}

// ─── Home Profile ─────────────────────────────────────────────────────────────

/**
 * A single "what we looked at" tile shown in the WhatWeKnowGrid.
 * Derived from engine evidence, context summary, and survey inputs.
 * Must never be invented — must map to a real survey or engine field.
 */
export interface HomeProfileTile {
  /** Simple icon label (emoji or icon name) for the tile. */
  icon: string;
  /** Short tile title, e.g. "Hot water demand". */
  title: string;
  /** One-line finding derived from the survey or engine output. */
  finding: string;
}

// ─── Reason Chain ─────────────────────────────────────────────────────────────

/**
 * A single step in the "Why Atlas suggested this" reasoning ladder.
 * Steps must be ordered: home facts → constraints → conclusion.
 * Derived from engine verdict, contextSummary, and trace outputs.
 */
export interface ReasonChainStep {
  /** Short plain-English label for this step. */
  label: string;
  /** Optional elaboration shown on expand. */
  detail?: string;
}

// ─── Next Steps ───────────────────────────────────────────────────────────────

/**
 * Structured content for the NextStepsCard.
 * Derived from best advice, quote inclusions, and improvement items.
 */
export interface NextSteps {
  /** Label of the recommended or chosen option. */
  chosenOptionLabel: string;
  /** Items already included in the recommended quote. */
  included: string[];
  /** Optional add-ons that could improve results. */
  optional: string[];
  /** Items that would further improve results (from improvements list). */
  furtherImprovements: string[];
}

// ─── Current System ───────────────────────────────────────────────────────────

/**
 * Summary of the currently-installed (pre-replacement) system.
 * Derived from canonical survey data (EngineInputV2_3.currentSystem).
 * Absent when the current system was not recorded during the survey.
 */
export interface CurrentSystemSummary {
  /** Human-readable label, e.g. "Existing combination boiler (12 years old)". */
  label: string;
  /** Normalised system type — matches QuoteInput.systemType where applicable. */
  systemType?: 'combi' | 'system' | 'regular' | 'back_boiler' | 'unknown';
}

// ─── Insight Pack ─────────────────────────────────────────────────────────────

/**
 * The complete Atlas Insight Pack output.
 * Built by buildInsightPackFromEngine() — never constructed manually.
 */
export interface InsightPack {
  /** One insight bundle per submitted quote. */
  quotes: QuoteInsight[];
  /** The single best-advice recommendation across all quotes. */
  bestAdvice: BestAdvice;
  /** How to get the most from whichever system is installed. */
  savingsPlan: SavingsPlan;
  /** Tiles summarising what was surveyed — shown in the WhatWeKnowGrid screen. */
  homeProfile: HomeProfileTile[];
  /** Ordered reasoning steps explaining why Atlas made its recommendation. */
  reasonChain: ReasonChainStep[];
  /** Structured next-steps summary for the final screen. */
  nextSteps: NextSteps;
  /**
   * The currently-installed system as recorded in the canonical survey.
   * Used on the cover page and in performance comparisons.
   * Absent when the current system was not captured during the survey.
   */
  currentSystem?: CurrentSystemSummary;
}
