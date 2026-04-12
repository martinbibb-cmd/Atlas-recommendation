/**
 * portalJourney.types.ts
 *
 * PR10 — Customer-facing journey model for the closing portal flow.
 *
 * PortalJourneyModel is derived from PortalDisplayModel (PR9) by
 * buildPortalJourneyModel() and shapes raw engine/property data into
 * human-readable, home-specific customer journey content.
 *
 * Components render from this model only — never from raw display or
 * engine data directly.
 */

// ─── Sub-shapes ───────────────────────────────────────────────────────────────

export interface JourneyFindings {
  /** Human-readable label for the current heating system, e.g. "Combi boiler". */
  currentSystem?: string;
  /** One-line household summary, e.g. "2-person household, regular occupancy". */
  householdSummary?: string;
  /** One-line property summary, e.g. "Semi-detached, 1970s build". */
  propertySummary?: string;
  /** Customer-facing priorities captured in the survey. */
  priorities: string[];
  /** Customer-facing constraints captured in the survey. */
  constraints: string[];
  /** Evidence-backed observation snippets, e.g. "Mains pressure measured at 2.8 bar". */
  evidenceSummary: string[];
}

export interface JourneyRecommendation {
  /** Option id of the top recommendation, e.g. "combi". */
  recommendedOptionId?: string;
  /** Display title, e.g. "Combi boiler". */
  title: string;
  /** One-line reason for the recommendation. */
  summary: string;
  /** Up to 3 customer-facing key benefits. */
  keyBenefits: string[];
  /** Optional confidence tone label, e.g. "High confidence (measured)". */
  confidenceLabel?: string;
}

export interface JourneyWhyFitsItem {
  /** Short heading, e.g. "Better for your hot water use". */
  title: string;
  /** Human-readable explanation of the fit reason. */
  explanation: string;
  /** 'positive' = good fit; 'caveat' = something to be aware of. */
  status: 'positive' | 'caveat';
}

export interface JourneyAlternative {
  /** Option id, e.g. "stored_unvented". */
  optionId: string;
  /** Display title, e.g. "Unvented cylinder system". */
  title: string;
  /** One-line description. */
  summary: string;
  /** Why this was not the top recommendation. */
  whyNotTopChoice?: string;
}

export interface JourneyScenario {
  /** Stable scenario id for CTA wiring. */
  id: string;
  /** Short headline, e.g. "What if you add a bathroom?". */
  title: string;
  /** One-line prompt to set expectations. */
  description: string;
}

// ─── Root model ───────────────────────────────────────────────────────────────

/**
 * Customer-facing portal journey model.
 *
 * Built by buildPortalJourneyModel(displayModel).
 * Consumed by the six journey section components.
 */
export interface PortalJourneyModel {
  /** Page-level title, e.g. "Your recommendation for 5 Example Road". */
  title: string;

  /** Section A — what we found in the home. */
  findings: JourneyFindings;

  /** Section B — clear recommendation block. */
  recommendation: JourneyRecommendation;

  /** Section C — home-specific fit reasons. */
  whyFits: JourneyWhyFitsItem[];

  /** Section D — trade-offs and lived experience. */
  whatToExpect: string[];

  /** Section E — secondary options that were considered. */
  alternatives: JourneyAlternative[];

  /** Section F — safe what-if scenario prompts for simulator entry. */
  scenarios: JourneyScenario[];
}
