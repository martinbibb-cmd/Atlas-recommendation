/**
 * reportSections.model.ts
 *
 * Presentation-only mapping layer for the unified print report.
 *
 * Responsibilities:
 *   - Section ordering and conditional inclusion
 *   - Display string generation from resolved engine output
 *   - Completeness checks (essential vs optional data)
 *
 * This module must NOT re-derive engine physics.
 * All values come from EngineOutputV1 or normalized survey state already in use.
 *
 * Report structure — five-page decision document
 * ──────────────────────────────────────────────────────────────────────────────
 *  Page 1 — decision_page     : The decision (constraint → system → why)
 *  Page 2 — daily_experience  : What daily use looks like with the new system
 *  Page 3 — what_changes      : Required installation changes only
 *  Page 4 — alternatives_page : One controlled alternative with trade-offs
 *  Page 5 — engineer_summary  : Engineer job-reference snapshot
 */

import type {
  EngineOutputV1,
  VerdictV1,
  OptionCardV1,
} from '../../contracts/EngineOutputV1';
import type { ResimulationFromSurveyResult } from '../../lib/simulator/buildResimulationFromSurvey';

// ─── Section types ────────────────────────────────────────────────────────────

export type ReportSectionId =
  // ── Five-page decision document (primary report) ──────────────────────────
  | 'decision_page'
  | 'daily_experience'
  | 'what_changes'
  | 'alternatives_page'
  | 'engineer_summary'
  // ── Simulator-derived sections (new product journey) ──────────────────────
  | 'simulator_outcomes'
  | 'upgrade_path'
  | 'best_fit_install'
  | 'handover_notes';

// ─── Five-page decision document section interfaces ───────────────────────────

/**
 * Page 1 — The decision.
 *
 * One constraint → one consequence → one required system.
 * Every item must be traceable to a measured or engine-derived fact.
 */
export interface DecisionPageSection {
  id: 'decision_page';
  /** Primary headline — the key physical finding for this home. */
  headline: string;
  /**
   * Measured facts: observed values from the constraint that drives the decision.
   * e.g. [{label: 'Mains flow', value: '12 L/min'}, {label: 'Required', value: '13+ L/min'}]
   */
  measuredFacts: Array<{ label: string; value: string }>;
  /** What the constraint means in plain language. */
  consequence: string;
  /** The recommended system label (from recommendation.primary). */
  recommendedSystem: string;
  /** Why this system is required — direct link to the constraint (max 3 bullets). */
  whyRequired: string[];
  /** Verdict status for banner styling. */
  verdictStatus: VerdictV1['status'];
}

/**
 * Page 2 — Daily experience.
 *
 * What typical household use looks like with the recommended system.
 * Scenarios show real situations; outcome is ok / limited / slow.
 */
export interface DailyExperienceSection {
  id: 'daily_experience';
  scenarios: Array<{
    /** Short description, e.g. "Morning shower". */
    scenario: string;
    /** Outcome classification. */
    outcome: 'ok' | 'limited' | 'slow';
    /** Optional note clarifying the outcome. */
    note?: string;
  }>;
}

/**
 * Page 3 — What changes.
 *
 * Required installation changes only — no generic benefits, no repeated explanations.
 * Max 5 items.
 */
export interface WhatChangesSection {
  id: 'what_changes';
  /** Label of the recommended system. */
  systemLabel: string;
  /** Required installation changes (max 5). */
  changes: string[];
}

/**
 * Page 4 — Alternatives.
 *
 * Maximum one alternative shown, with trade-offs against the recommendation only.
 * Nothing else is listed — everything else is sent to the interactive simulator.
 */
export interface AlternativesPageSection {
  id: 'alternatives_page';
  /** Label of the recommended system — used as context for the trade-off. */
  recommendedLabel: string;
  /** The single alternative to show (null if none comparable available). */
  alternative: {
    /** Alternative system label. */
    label: string;
    /** Trade-offs versus the recommendation (why it is not primary). */
    tradeOffs: string[];
    /** Engineering headline requirement for the alternative. */
    requirement?: string;
  } | null;
}

/**
 * Page 5 — Engineer snapshot.
 *
 * Job-reference card for the installation team.
 * One page, scannable in under two minutes.
 */
export interface EngineerSummarySection {
  id: 'engineer_summary';
  /** Current installed system, if known from engine context. */
  currentSystem: string | undefined;
  /** Recommended replacement system. */
  recommendedSystem: string;
  /** Primary constraint driving the recommendation. */
  keyConstraint: string;
  /** Confidence level from the engine verdict. */
  confidenceLevel: string;
  /** Non-blocking pre-install confirmation items. */
  beforeYouStart: string[];
}

// ─── Simulator-derived section interfaces ─────────────────────────────────────

/**
 * Simulator outcomes — typical day hot-water and heating results from the
 * simple-install system spec.
 */
export interface SimulatorOutcomesSection {
  id: 'simulator_outcomes';
  /** Label of the system being evaluated (e.g. "On-demand hot water"). */
  systemLabel: string;
  /** Fuel source for this system — 'gas' or 'electric'. */
  fuelSource: 'gas' | 'electric';
  hotWater: {
    totalDraws: number;
    successful: number;
    reduced: number;
    conflict: number;
    simultaneousEventCount: number;
    averageBathFillTimeMinutes: number | null;
  };
  heating: {
    totalHeatingEvents: number;
    successful: number;
    reduced: number;
    conflict: number;
    outsideTargetEventCount: number;
  };
}

/** A single recommended upgrade item. */
export interface UpgradeItem {
  kind: string;
  label: string;
  reason: string;
  priority: string;
}

/**
 * Upgrade path — list of recommended upgrades from the simple-install spec.
 */
export interface UpgradePathSection {
  id: 'upgrade_path';
  systemLabel: string;
  upgrades: UpgradeItem[];
}

/**
 * Best-fit install — outcomes after applying all upgrade recommendations.
 */
export interface BestFitInstallSection {
  id: 'best_fit_install';
  systemLabel: string;
  hotWater: {
    totalDraws: number;
    successful: number;
    reduced: number;
    conflict: number;
    averageBathFillTimeMinutes: number | null;
  };
  heating: {
    totalHeatingEvents: number;
    successful: number;
    reduced: number;
    conflict: number;
  };
  headlineImprovements: string[];
}

/**
 * Handover notes — assumptions and red flags for installation handover.
 */
export interface HandoverNotesSection {
  id: 'handover_notes';
  assumptions: Array<{
    id: string;
    title: string;
    detail: string;
    severity: 'info' | 'warn' | 'fail';
  }>;
  redFlags: Array<{
    id: string;
    title: string;
    detail: string;
    severity: 'info' | 'warn' | 'fail';
  }>;
}

export type ReportSection =
  | DecisionPageSection
  | DailyExperienceSection
  | WhatChangesSection
  | AlternativesPageSection
  | EngineerSummarySection
  | SimulatorOutcomesSection
  | UpgradePathSection
  | BestFitInstallSection
  | HandoverNotesSection;

// ─── Completeness ─────────────────────────────────────────────────────────────

export interface ReportCompletenessStatus {
  /** False means essential data is missing; report must be blocked. */
  isReportable: boolean;
  /** True means optional data is absent; show completeness banner but allow print. */
  isPartial: boolean;
  /** Human-readable list of missing optional items for the banner. */
  missingOptional: string[];
  /** Human-readable list of missing essential items (blocks report). */
  missingEssential: string[];
}

/**
 * Determine whether a report can be generated and whether it is partial.
 *
 * Essential: recommendation text + verdict object (base output from engine).
 * Optional:  behaviour timeline, limiters, influence summary, assumptions.
 */
export function checkCompleteness(output: EngineOutputV1): ReportCompletenessStatus {
  const missingEssential: string[] = [];
  const missingOptional: string[] = [];

  // Essential checks
  if (!output.recommendation?.primary) {
    missingEssential.push('System recommendation');
  }
  if (!output.verdict) {
    missingEssential.push('Verdict / confidence assessment');
  }

  // Optional checks
  if (!output.behaviourTimeline) {
    missingOptional.push('24-hour behaviour timeline');
  }
  if (!output.limiters || output.limiters.limiters.length === 0) {
    missingOptional.push('Physical limiters / constraints');
  }
  if (!output.influenceSummary) {
    missingOptional.push('Domain influence breakdown');
  }
  if (!output.meta?.assumptions || output.meta.assumptions.length === 0) {
    missingOptional.push('Modelling assumptions detail');
  }

  return {
    isReportable: missingEssential.length === 0,
    isPartial: missingOptional.length > 0,
    missingOptional,
    missingEssential,
  };
}

/** kW output per L/min flow at a 35°C temperature rise (standard domestic DHW). */
const _KW_PER_LPM_AT_35C_RISE = 2.4;
// Suppress unused-variable warning — retained for future flow derivation.
void _KW_PER_LPM_AT_35C_RISE;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the primary recommended option (first viable, else first caution, else first).
 * Mirrors the selection logic used in LiveHubPage / RecommendationCard.
 */
function pickRecommendedOption(options: OptionCardV1[]): OptionCardV1 | null {
  if (options.length === 0) return null;
  return (
    options.find(o => o.status === 'viable') ??
    options.find(o => o.status === 'caution') ??
    options[0]
  );
}

/**
 * Returns the secondary option — the nearest alternative to the primary recommendation.
 * Skips the primary option and returns the first viable/caution/any other.
 */
function pickSecondaryOption(
  options: OptionCardV1[],
  primary: OptionCardV1,
): OptionCardV1 | null {
  const rest = options.filter(o => o.id !== primary.id);
  return (
    rest.find(o => o.status === 'viable') ??
    rest.find(o => o.status === 'caution') ??
    rest[0] ??
    null
  );
}

/** IDs considered "stored" systems — have meaningful DHW plane info. */
const STORED_OPTION_IDS = new Set([
  'stored_vented',
  'stored_unvented',
  'ashp',
  'system_unvented',
  'regular_vented',
]);

// ─── Five-page decision-document builders ─────────────────────────────────────

/**
 * Page 1 — The decision.
 *
 * Derives the headline from the primary hard/warn limiter.
 * Falls back to the verdict title when no limiters are present.
 */
function buildDecisionPageSection(output: EngineOutputV1): DecisionPageSection {
  const allLimiters = output.limiters?.limiters ?? [];
  const hardLimiters = allLimiters.filter(l => l.severity === 'fail');
  const warnLimiters = allLimiters.filter(l => l.severity === 'warn');
  const primaryLimiter = hardLimiters[0] ?? warnLimiters[0] ?? null;

  // headline: strongest available signal
  const headline = hardLimiters.length > 0
    ? 'Current setup cannot meet demand'
    : warnLimiters.length > 0
      ? 'System constraint identified'
      : (output.verdict?.title ?? 'System assessment complete');

  // measuredFacts: observed + minimum required from primary limiter
  const measuredFacts: Array<{ label: string; value: string }> = [];
  if (primaryLimiter) {
    measuredFacts.push({
      label: primaryLimiter.observed.label,
      value: `${primaryLimiter.observed.value} ${primaryLimiter.observed.unit}`,
    });
    measuredFacts.push({
      label: `Minimum required`,
      value: `${primaryLimiter.limit.value} ${primaryLimiter.limit.unit}`,
    });
  }

  // consequence: limiter impact summary or verdict title
  const consequence = primaryLimiter?.impact?.summary ?? output.verdict?.title ?? '';

  // whyRequired: primaryReason first, then verdict.reasons, deduped, max 3
  const whyRequired: string[] = [];
  if (output.verdict?.primaryReason) {
    whyRequired.push(output.verdict.primaryReason);
  }
  for (const r of output.verdict?.reasons ?? []) {
    if (!whyRequired.includes(r) && whyRequired.length < 3) {
      whyRequired.push(r);
    }
  }

  return {
    id: 'decision_page',
    headline,
    measuredFacts,
    consequence,
    recommendedSystem: output.recommendation.primary,
    whyRequired,
    verdictStatus: output.verdict?.status ?? 'good',
  };
}

/**
 * Page 2 — Daily experience.
 *
 * Scenarios are derived from the recommended option's characteristics and
 * the presence of flow/pressure limiters.
 * Returns null when no option data is available (deferred to simulator).
 */
function buildDailyExperienceSection(
  output: EngineOutputV1,
): DailyExperienceSection | null {
  const options = output.options ?? [];
  const rec = pickRecommendedOption(options);
  if (!rec) return null;

  const isStored = STORED_OPTION_IDS.has(rec.id);
  const isAshp   = rec.id === 'ashp';

  const scenarios: DailyExperienceSection['scenarios'] = [];

  if (isStored) {
    scenarios.push({
      scenario: 'Morning shower',
      outcome: 'ok',
      note: 'Stored volume delivers consistent temperature',
    });
    scenarios.push({
      scenario: 'Shower and tap running together',
      outcome: 'ok',
      note: 'Stored supply handles concurrent draws',
    });
    scenarios.push({
      scenario: 'Second shower back to back',
      outcome: 'limited',
      note: 'Cylinder needs partial recovery between uses',
    });
    scenarios.push({
      scenario: 'Filling a bath',
      outcome: 'slow',
      note: 'Larger draw; allow extra time during morning peak',
    });
  } else {
    // Combi / on-demand
    const hasFlowLimiter = (output.limiters?.limiters ?? []).some(
      l => l.id.toLowerCase().includes('flow') || l.title.toLowerCase().includes('flow'),
    );
    scenarios.push({ scenario: 'Single shower', outcome: 'ok' });
    if (hasFlowLimiter) {
      scenarios.push({
        scenario: 'Two simultaneous outlets',
        outcome: 'limited',
        note: 'Flow splits under simultaneous demand',
      });
      scenarios.push({
        scenario: 'Bath filling',
        outcome: 'slow',
        note: 'High continuous draw reduces delivered temperature',
      });
    } else {
      scenarios.push({
        scenario: 'Two simultaneous outlets',
        outcome: 'limited',
        note: 'Some reduction under simultaneous demand',
      });
      scenarios.push({
        scenario: 'Bath filling',
        outcome: 'ok',
        note: 'Continuous draw handled at rated output',
      });
    }
  }

  if (isAshp) {
    scenarios.push({
      scenario: 'Space heating',
      outcome: 'ok',
      note: 'Low flow temperature — efficient at low demand',
    });
  }

  return { id: 'daily_experience', scenarios };
}

/**
 * Page 3 — What changes.
 *
 * Required installation changes only, drawn from mustHave and engineering
 * bullets of the recommended option. Capped at 5 items.
 */
function buildWhatChangesSection(output: EngineOutputV1): WhatChangesSection | null {
  const options = output.options ?? [];
  const rec = pickRecommendedOption(options);
  if (!rec) return null;

  const combined = [
    ...(rec.typedRequirements?.mustHave ?? []),
    ...(rec.engineering?.bullets ?? []),
  ];

  const seen = new Set<string>();
  const changes: string[] = [];
  for (const item of combined) {
    if (!seen.has(item) && changes.length < 5) {
      seen.add(item);
      changes.push(item);
    }
  }

  if (changes.length === 0) return null;

  return { id: 'what_changes', systemLabel: rec.label, changes };
}

/**
 * Page 4 — Alternatives.
 *
 * Shows a maximum of one alternative with trade-offs against the
 * recommendation only.  Nothing else is listed.
 */
function buildAlternativesPageSection(
  output: EngineOutputV1,
): AlternativesPageSection | null {
  const options = output.options ?? [];
  const rec = pickRecommendedOption(options);
  if (!rec) return null;

  const secondary = pickSecondaryOption(options, rec);

  let alternative: AlternativesPageSection['alternative'] = null;
  if (secondary) {
    const tradeOffs: string[] = [];
    const mustHave = secondary.typedRequirements?.mustHave ?? [];
    for (const req of mustHave.slice(0, 3)) {
      tradeOffs.push(req);
    }
    if (tradeOffs.length === 0) {
      for (const b of (secondary.engineering?.bullets ?? []).slice(0, 2)) {
        tradeOffs.push(b);
      }
    }
    if (tradeOffs.length === 0) {
      for (const w of (secondary.why ?? []).slice(0, 2)) {
        tradeOffs.push(w);
      }
    }

    alternative = {
      label: secondary.label,
      tradeOffs,
      requirement: secondary.engineering?.headline ?? undefined,
    };
  }

  return {
    id: 'alternatives_page',
    recommendedLabel: rec.label,
    alternative,
  };
}

/**
 * Page 5 — Engineer snapshot.
 *
 * Job-reference card: current → recommended, key constraint, confidence,
 * and non-blocking pre-install confirmations.
 */
function buildEngineerSummarySection(output: EngineOutputV1): EngineerSummarySection {
  const allLimiters = output.limiters?.limiters ?? [];
  const hardLimiters = allLimiters.filter(l => l.severity === 'fail');
  const primaryLimiter = hardLimiters[0] ?? allLimiters[0] ?? null;

  let keyConstraint: string;
  if (primaryLimiter) {
    keyConstraint = `${primaryLimiter.title}: ${primaryLimiter.observed.value} ${primaryLimiter.observed.unit}`;
  } else if (output.verdict?.primaryReason) {
    keyConstraint = output.verdict.primaryReason;
  } else {
    keyConstraint = output.verdict?.title ?? 'Assessment complete';
  }

  const options = output.options ?? [];
  const rec = pickRecommendedOption(options);
  const mustHave = rec?.typedRequirements?.mustHave ?? [];
  const unknowns = output.verdict?.confidence?.unknowns ?? [];

  // Combine mustHave items and confidence unknowns, dedup, cap at 4
  const combined = [...mustHave.slice(0, 3), ...unknowns.slice(0, 2)];
  const seen = new Set<string>();
  const beforeYouStart: string[] = [];
  for (const item of combined) {
    if (!seen.has(item) && beforeYouStart.length < 4) {
      seen.add(item);
      beforeYouStart.push(item);
    }
  }

  return {
    id: 'engineer_summary',
    currentSystem: undefined,
    recommendedSystem: output.recommendation.primary,
    keyConstraint,
    confidenceLevel: output.verdict?.confidence?.level ?? 'medium',
    beforeYouStart,
  };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build an ordered list of printable report sections from engine output.
 *
 * Produces a five-page decision document:
 *   Page 1 — decision_page     : constraint → consequence → system → why
 *   Page 2 — daily_experience  : typical-day scenarios (omitted when no option data)
 *   Page 3 — what_changes      : required install changes (omitted when no option data)
 *   Page 4 — alternatives_page : one alternative with trade-offs (omitted when no options)
 *   Page 5 — engineer_summary  : job-reference snapshot
 */
export function buildReportSections(output: EngineOutputV1): ReportSection[] {
  const sections: ReportSection[] = [];

  // Page 1 — always present
  sections.push(buildDecisionPageSection(output));

  // Page 2 — only when option data is available for meaningful scenarios
  const dailySection = buildDailyExperienceSection(output);
  if (dailySection) sections.push(dailySection);

  // Page 3 — only when option data provides install requirements
  const changesSection = buildWhatChangesSection(output);
  if (changesSection) sections.push(changesSection);

  // Page 4 — only when options are available to show alternatives
  const altSection = buildAlternativesPageSection(output);
  if (altSection) sections.push(altSection);

  // Page 5 — always present
  sections.push(buildEngineerSummarySection(output));

  return sections;
}

// ─── Simulator-derived section builders ──────────────────────────────────────

/**
 * Map a system family identifier to the correct fuel source.
 * This prevents heat-pump paths from inheriting gas labels.
 */
function resolveFuelSource(systemType: string): 'gas' | 'electric' {
  return systemType === 'heat_pump' ? 'electric' : 'gas';
}

/**
 * Build the SimulatorOutcomesSection from a ResimulationFromSurveyResult.
 *
 * Surfaces the simple-install outcomes so the report shows what the household
 * would experience on a typical day without upgrades applied.
 */
function buildSimulatorOutcomesSection(
  result: ResimulationFromSurveyResult,
): SimulatorOutcomesSection {
  const { simpleInstall, systemType } = result.resimulation;
  return {
    id: 'simulator_outcomes',
    systemLabel: result.recommendedSystemLabel,
    fuelSource: resolveFuelSource(systemType),
    hotWater: {
      totalDraws:                 simpleInstall.hotWater.totalDraws,
      successful:                 simpleInstall.hotWater.successful,
      reduced:                    simpleInstall.hotWater.reduced,
      conflict:                   simpleInstall.hotWater.conflict,
      simultaneousEventCount:     simpleInstall.hotWater.simultaneousEventCount,
      averageBathFillTimeMinutes: simpleInstall.hotWater.averageBathFillTimeMinutes,
    },
    heating: {
      totalHeatingEvents:      simpleInstall.heating.totalHeatingEvents,
      successful:              simpleInstall.heating.successful,
      reduced:                 simpleInstall.heating.reduced,
      conflict:                simpleInstall.heating.conflict,
      outsideTargetEventCount: simpleInstall.heating.outsideTargetEventCount,
    },
  };
}

/**
 * Build the UpgradePathSection from a ResimulationFromSurveyResult.
 *
 * Lists all recommended upgrades in priority order.
 */
function buildUpgradePathSection(
  result: ResimulationFromSurveyResult,
): UpgradePathSection | null {
  const { upgrades } = result.upgradePackage;
  if (upgrades.length === 0) return null;

  return {
    id: 'upgrade_path',
    systemLabel: result.recommendedSystemLabel,
    upgrades: upgrades.map((u) => ({
      kind:     u.kind,
      label:    u.label,
      reason:   u.reason,
      priority: u.priority,
    })),
  };
}

/**
 * Build the BestFitInstallSection from a ResimulationFromSurveyResult.
 *
 * Shows outcomes after the upgrade package is applied, with a direct comparison
 * to the simple-install outcomes via headlineImprovements.
 */
function buildBestFitInstallSection(
  result: ResimulationFromSurveyResult,
): BestFitInstallSection {
  const { bestFitInstall, comparison } = result.resimulation;
  return {
    id: 'best_fit_install',
    systemLabel: result.recommendedSystemLabel,
    hotWater: {
      totalDraws:                 bestFitInstall.hotWater.totalDraws,
      successful:                 bestFitInstall.hotWater.successful,
      reduced:                    bestFitInstall.hotWater.reduced,
      conflict:                   bestFitInstall.hotWater.conflict,
      averageBathFillTimeMinutes: bestFitInstall.hotWater.averageBathFillTimeMinutes,
    },
    heating: {
      totalHeatingEvents: bestFitInstall.heating.totalHeatingEvents,
      successful:         bestFitInstall.heating.successful,
      reduced:            bestFitInstall.heating.reduced,
      conflict:           bestFitInstall.heating.conflict,
    },
    headlineImprovements: comparison.headlineImprovements,
  };
}

/**
 * Build the HandoverNotesSection from an EngineOutputV1.
 *
 * Combines verdict-level and meta-level assumptions with red flags so that
 * the engineer has a complete record at the point of handing over.
 */
function buildHandoverNotesSection(output: EngineOutputV1): HandoverNotesSection | null {
  const verdictAssumptions = output.verdict?.assumptionsUsed ?? [];
  const metaAssumptions    = output.meta?.assumptions ?? [];
  const redFlags           = output.redFlags ?? [];

  const seenIds = new Set(verdictAssumptions.map((a) => a.id));
  const combined = [
    ...verdictAssumptions,
    ...metaAssumptions.filter((a) => !seenIds.has(a.id)),
  ];

  if (combined.length === 0 && redFlags.length === 0) return null;

  return {
    id: 'handover_notes',
    assumptions: combined.map((a) => ({
      id:       a.id,
      title:    a.title,
      detail:   a.detail,
      severity: a.severity,
    })),
    redFlags: redFlags.map((f) => ({
      id:       f.id,
      title:    f.title,
      detail:   f.detail,
      severity: f.severity,
    })),
  };
}

// ─── Simulator report builder ─────────────────────────────────────────────────

/**
 * Build the simulator-derived report sections from a ResimulationFromSurveyResult.
 *
 * These sections reflect the new product story:
 *   simulator_outcomes  — what the household experiences on a typical day
 *   upgrade_path        — recommended improvements (if any)
 *   best_fit_install    — outcomes after upgrades, with comparison deltas
 *   handover_notes      — assumptions and red flags for installation handover
 *
 * Intended to be combined with the engine-derived sections from
 * `buildReportSections` when producing a complete report.
 *
 * Section ordering follows the product journey:
 *   Chosen system → Simulator outcomes → Simple install → Upgrades →
 *   Best-fit install → Handover notes
 */
export function buildSimulatorReportSections(
  result: ResimulationFromSurveyResult,
  engineOutput: EngineOutputV1,
): ReportSection[] {
  const sections: ReportSection[] = [];

  sections.push(buildSimulatorOutcomesSection(result));

  const upgradeSection = buildUpgradePathSection(result);
  if (upgradeSection) sections.push(upgradeSection);

  sections.push(buildBestFitInstallSection(result));

  const handoverSection = buildHandoverNotesSection(engineOutput);
  if (handoverSection) sections.push(handoverSection);

  return sections;
}
