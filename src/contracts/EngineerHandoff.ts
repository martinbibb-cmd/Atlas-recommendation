/**
 * EngineerHandoff.ts — Engineer-first handoff view model.
 *
 * PR7 — A projection of canonical AtlasDecisionV1 + ScenarioResult truth,
 * formatted for an engineer who needs operational confidence before a job.
 *
 * PR8 — Extended with optional spatial layout fields so the handoff can
 * answer "where is it and how does it route?" as well as "what is it?".
 *
 * Design rules:
 *  - No recommendation logic lives here — this is a read-only projection.
 *  - All content derives from AtlasDecisionV1, ScenarioResult[], and engine input.
 *  - Tone is factual, direct, and scan-friendly.
 *  - Never re-derives scores or ranks scenarios.
 */

import type { EngineerLayout } from './EngineerLayout';
import type { QuoteScopeItem } from './QuoteScope';

/** A single measured or surveyed fact, traceable to its source. */
export interface EngineerHandoffFact {
  /** Human-readable label, e.g. "Primary pipe diameter". */
  label: string;
  /** Formatted value, e.g. "22 mm" or 22. */
  value: string | number;
  /** Origin of this value. */
  source: 'survey' | 'engine' | 'quote';
}

/** A piece of evidence available for engineer reference. */
export interface EngineerHandoffEvidence {
  kind: 'photo' | 'note' | 'plan' | 'capture';
  title: string;
  /** Optional reference identifier (e.g. photoId, noteId). */
  ref?: string;
}

/**
 * EngineerHandoff
 *
 * Produced by buildEngineerHandoff. This is the single data contract
 * consumed by all sections of the engineer handoff surface.
 *
 * Sections map directly to the page order:
 *   1. jobSummary
 *   2. (chosen system — from jobSummary.recommendedSystemLabel)
 *   3. includedScope
 *   4. existingSystem
 *   5. measuredFacts
 *   6. compatibilityWarnings
 *   7. installNotes
 *   8. futurePath
 */
export type EngineerHandoff = {
  jobSummary: {
    /** scenarioId of the recommended ScenarioResult. */
    recommendedScenarioId: string;
    /** Human-readable system label, e.g. "System boiler with unvented cylinder". */
    recommendedSystemLabel: string;
    /** One-line operational summary — not customer copy. */
    summary: string;
  };

  /**
   * Items included in the proposed scope of work.
   *
   * PR13 — Uses the canonical QuoteScopeItem model so customer deck and
   * engineer handoff agree on exactly what is installed.
   * status='included' items only; compliance items carry an engineerNote.
   */
  includedScope: QuoteScopeItem[];

  /** Works that must be carried out before or during installation. */
  requiredWorks: string[];

  /** Physics-grounded compatibility warnings, e.g. "G3 installer required". */
  compatibilityWarnings: string[];

  /** Key reasons this scenario was chosen — install-relevant signals only. */
  keyReasons: string[];

  /** Facts about the existing installed system. */
  existingSystem: {
    boilerType?: string;
    boilerAgeYears?: number;
    nominalOutputKw?: number;
    hotWaterType?: string;
  };

  /**
   * Measured or surveyed facts that the engineer should have to hand.
   * Each fact is labelled and traced to its source.
   */
  measuredFacts: EngineerHandoffFact[];

  /** Short install-time notes, e.g. "Verify discharge route". */
  installNotes: string[];

  /**
   * Evidence available for this job — photos, notes, plans, captures.
   * Populated when evidence was recorded during the survey.
   */
  evidence: EngineerHandoffEvidence[];

  /**
   * Future upgrade paths this installation enables, e.g.
   * "Heat pump ready — low-temperature emitters already specified".
   */
  futurePath?: string[];

  /**
   * Spatial layout data for the job — rooms, objects, and routes.
   * Optional: absent when no floor-plan or spatial truth has been captured.
   * Missing layout data must not break the handoff page.
   */
  layout?: EngineerLayout;

  /**
   * Human-readable summary lines drawn from the layout.
   * Examples:
   *   "Boiler position recorded"
   *   "Cylinder cupboard dimensions captured"
   *   "Discharge route requires confirmation"
   */
  layoutSummary?: string[];
};
