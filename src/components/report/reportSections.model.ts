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
 * Report structure
 * ──────────────────────────────────────────────────────────────────────────────
 *  Customer summary (decision-first, concise):
 *    system_summary   – best-fit system + why it suits
 *    key_trade_off    – key trade-off for the recommended system
 *    key_limiters     – hard/soft physical constraints
 *    future_path      – next step and upgrade sensitivities
 *
 *  Technical summary (engineer-facing):
 *    verdict          – full verdict with confidence level
 *    operating_point  – peak DHW operating conditions
 *    behaviour_summary – 24-hour timeline summary
 *    system_architecture – installation topology and requirements
 *    stored_hot_water – stored DHW logic (when applicable)
 *    risks_enablers   – risks (downgrade sensitivities) + enablers (upgrade)
 *    assumptions      – modelling assumptions and red flags
 *
 *  Appendix (optional deep detail):
 *    physics_trace    – full 24-hour physics trace
 *    engineering_notes – must-have installation requirements
 */

import type {
  EngineOutputV1,
  LimiterV1,
  VerdictV1,
  OptionCardV1,
  SensitivityItem,
  OpportunityStatus,
} from '../../contracts/EngineOutputV1';
import type { ResimulationFromSurveyResult } from '../../lib/simulator/buildResimulationFromSurvey';

// ─── Section types ────────────────────────────────────────────────────────────

export type ReportSectionId =
  | 'system_summary'
  | 'decision_rationale'
  | 'key_trade_off'
  | 'operating_point'
  | 'behaviour_summary'
  | 'key_limiters'
  | 'future_path'
  | 'verdict'
  | 'system_architecture'
  | 'stored_hot_water'
  | 'risks_enablers'
  | 'assumptions'
  | 'physics_trace'
  | 'engineering_notes'
  | 'future_energy_opportunities'
  // ── Simulator-derived sections (new product journey) ──────────────────────
  | 'simulator_outcomes'
  | 'upgrade_path'
  | 'best_fit_install'
  | 'handover_notes';

export interface SystemSummarySection {
  id: 'system_summary';
  primary: string;
  secondary?: string;
  verdictTitle?: string;
  verdictStatus?: VerdictV1['status'];
}

/**
 * Decision rationale — the "engineer trust" block.
 *
 * Answers: why this system, for this house, now?
 *
 * Structured as four named sub-sections derived from engine output:
 *   - whyThisWins              — reasons the primary system is recommended
 *   - alternativeLabel         — label for the nearest alternative (if any)
 *   - whatLimitsAlternative    — reasons the alternative falls short
 *   - keyPhysicalConstraints   — hard constraints from limiters / red flags
 *   - recommendedNextAction    — most important first step from plans
 */
export interface DecisionRationaleSection {
  id: 'decision_rationale';
  /** Primary system being justified. */
  primaryLabel: string;
  /** One or more reasons this system wins for this property. */
  whyThisWins: string[];
  /** Label of the nearest alternative, if any. */
  alternativeLabel: string | undefined;
  /** Reasons the nearest alternative is not the top recommendation. */
  whatLimitsAlternative: string[];
  /** Hard physical constraints that shape or block the choice. */
  keyPhysicalConstraints: string[];
  /** Single highest-priority recommended next action. */
  recommendedNextAction: string | undefined;
}

export interface OperatingPointSection {
  id: 'operating_point';
  peakDhwKw: number | null;
  peakDhwTime: string;
  estimatedFlowLpm: number | null;
  pressureBar: number | null;
  dhwEventSteps: number;
  assumptionCount: number;
}

export interface BehaviourSummarySection {
  id: 'behaviour_summary';
  resolutionMins: number;
  applianceName: string;
  totalPoints: number;
  peakDhwKw: number | null;
  assumptionsUsed: string[];
}

export interface KeyLimitersSection {
  id: 'key_limiters';
  limiters: Array<{
    id: string;
    title: string;
    detail: string;
    severity: LimiterV1['severity'];
    observed?: string;
    limit?: string;
    suggestedFix?: string;
  }>;
}

export interface VerdictSection {
  id: 'verdict';
  title: string;
  status: VerdictV1['status'];
  reasons: string[];
  confidenceLevel: string;
  primaryReason?: string;
  comparedTechnologies?: string[];
}

export interface AssumptionsSection {
  id: 'assumptions';
  assumptions: Array<{ id: string; title: string; detail: string; severity: string }>;
  redFlags: Array<{ id: string; title: string; detail: string; severity: string }>;
}

// ── New sections ──────────────────────────────────────────────────────────────

/** Customer summary — key trade-off for the recommended system. */
export interface KeyTradeOffSection {
  id: 'key_trade_off';
  /** System being described (label from OptionCardV1). */
  systemLabel: string;
  /** Likely upgrades the installation would require. */
  likelyUpgrades: string[];
  /** Engineering concerns from the option's engineering plane. */
  engineeringBullets: string[];
}

/** Customer summary — next step and upgrade sensitivity path. */
export interface FuturePathSection {
  id: 'future_path';
  /** Sensitivities where upgrading inputs would improve the outcome. */
  enablers: Array<{ lever: string; note: string }>;
  /** Sensitivities where worsening inputs would reduce the outcome. */
  risks: Array<{ lever: string; note: string }>;
  /** Pathway titles if plan data is available. */
  pathways: Array<{ title: string; rationale: string }>;
}

/** Technical summary — installation architecture for the recommended system. */
export interface SystemArchitectureSection {
  id: 'system_architecture';
  systemLabel: string;
  /** Engineering headline (e.g. "Minor works required"). */
  headline: string;
  /** Installation requirement bullets. */
  bullets: string[];
  /** Must-have installation items. */
  mustHave: string[];
}

/** Technical summary — stored DHW logic (only when a stored option is recommended). */
export interface StoredHotWaterSection {
  id: 'stored_hot_water';
  systemLabel: string;
  /** DHW plane headline (e.g. "Adequate stored volume"). */
  headline: string;
  /** DHW-specific bullets from the option. */
  bullets: string[];
}

/** Technical summary — risks and enablers from option sensitivities. */
export interface RisksEnablersSection {
  id: 'risks_enablers';
  /** Downgrade sensitivities — things that could reduce suitability. */
  risks: Array<SensitivityItem>;
  /** Upgrade sensitivities — things that could improve suitability. */
  enablers: Array<SensitivityItem>;
}

/** Appendix — full 24-hour physics trace (concise tabular summary). */
export interface PhysicsTraceSection {
  id: 'physics_trace';
  resolutionMins: number;
  applianceName: string;
  /** Trimmed trace: only timesteps where the appliance is active (out > 0). */
  activePoints: Array<{
    t: string;
    heatDemandKw: number;
    dhwDemandKw: number;
    applianceOutKw: number;
    /** Efficiency fraction (0–1) or COP; null if not provided. */
    performance: number | null;
    performanceKind: 'eta' | 'cop' | null;
    mode: string | null;
  }>;
  /** Total active timesteps (across full day, not just trimmed). */
  totalActiveSteps: number;
}

/** Appendix — must-have and nice-to-have installation requirements. */
export interface EngineeringNotesSection {
  id: 'engineering_notes';
  systemLabel: string;
  mustHave: string[];
  niceToHave: string[];
}

/**
 * Future energy opportunities — solar PV and EV charging suitability assessments.
 *
 * Surfaces whole-home pathway opportunities alongside the heating recommendation.
 * These are opportunity assessments, not installation approvals or full designs.
 */
export interface FutureEnergyOpportunitiesSection {
  id: 'future_energy_opportunities';
  solarPv: {
    status: OpportunityStatus;
    summary: string;
    reasons: string[];
    checksRequired: string[];
  };
  evCharging: {
    status: OpportunityStatus;
    summary: string;
    reasons: string[];
    checksRequired: string[];
  };
}

// ─── Simulator-derived section interfaces ─────────────────────────────────────

/**
 * Simulator outcomes — typical day hot-water and heating results from the
 * simple-install system spec.
 *
 * Structured around the two classification axes (hot water / heating) so the
 * report can surface what the household would actually experience on a typical
 * day without the upgrade package applied.
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
 *
 * Covers Priority 5 (Suggested upgrades) in the product story.
 */
export interface UpgradePathSection {
  id: 'upgrade_path';
  /** Label of the system the upgrades apply to. */
  systemLabel: string;
  /** Ordered list of recommended upgrades (highest priority first). */
  upgrades: UpgradeItem[];
}

/**
 * Best-fit install — outcomes of the system after applying all upgrade
 * recommendations.  Compared directly to the simple-install outcomes to
 * demonstrate the value of the upgrade package.
 *
 * Covers Priority 6 (Best-fit install) in the product story.
 */
export interface BestFitInstallSection {
  id: 'best_fit_install';
  /** Label of the upgraded system. */
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
  /** Headline improvements versus the simple install. */
  headlineImprovements: string[];
}

/**
 * Handover notes — key assumptions and engineer-facing notes that should be
 * recorded at the point of handing over the recommendation to the customer or
 * installation team.
 *
 * Covers Priority 7 (Handover / assumptions / notes) in the product story.
 */
export interface HandoverNotesSection {
  id: 'handover_notes';
  /** Assumptions that were applied during the simulation. */
  assumptions: Array<{
    id: string;
    title: string;
    detail: string;
    severity: 'info' | 'warn' | 'fail';
  }>;
  /** Any red flags that should be actioned before or during installation. */
  redFlags: Array<{
    id: string;
    title: string;
    detail: string;
    severity: 'info' | 'warn' | 'fail';
  }>;
}

export type ReportSection =
  | SystemSummarySection
  | DecisionRationaleSection
  | KeyTradeOffSection
  | OperatingPointSection
  | BehaviourSummarySection
  | KeyLimitersSection
  | FuturePathSection
  | VerdictSection
  | SystemArchitectureSection
  | StoredHotWaterSection
  | RisksEnablersSection
  | AssumptionsSection
  | PhysicsTraceSection
  | EngineeringNotesSection
  | FutureEnergyOpportunitiesSection
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
const KW_PER_LPM_AT_35C_RISE = 2.4;

/** Conservative fallback dynamic pressure (bar) when the timeline does not provide one. */
const DEFAULT_DYNAMIC_PRESSURE_BAR = 1.1;

/** Maximum number of limiters shown in the report to prevent cluttered output. */
const MAX_REPORT_LIMITERS = 8;

// ─── Section builders ─────────────────────────────────────────────────────────

function buildSystemSummarySection(output: EngineOutputV1): SystemSummarySection {
  return {
    id: 'system_summary',
    primary: output.recommendation.primary,
    secondary: output.recommendation.secondary,
    verdictTitle: output.verdict?.title,
    verdictStatus: output.verdict?.status,
  };
}

function buildOperatingPointSection(output: EngineOutputV1): OperatingPointSection | null {
  if (!output.behaviourTimeline) return null;

  const pts = output.behaviourTimeline.points;
  const peakDhwKw = pts.reduce(
    (max, p) => Math.max(max, p.dhwApplianceOutKw ?? p.dhwDemandKw),
    0,
  );
  const peakIdx = pts.findIndex(
    p => (p.dhwApplianceOutKw ?? p.dhwDemandKw) === peakDhwKw,
  );
  const peakDhwTime = pts[peakIdx]?.t ?? '—';
  const dhwEventSteps = pts.filter(p => (p.dhwApplianceOutKw ?? 0) > 0).length;

  const estimatedFlowLpm =
    peakDhwKw > 0
      ? Math.round((peakDhwKw / KW_PER_LPM_AT_35C_RISE) * 10) / 10
      : null;

  const pressureBar =
    (output.behaviourTimeline as { labels: { dynamicPressureBar?: number } })
      .labels?.dynamicPressureBar ?? DEFAULT_DYNAMIC_PRESSURE_BAR;

  return {
    id: 'operating_point',
    peakDhwKw: peakDhwKw > 0 ? peakDhwKw : null,
    peakDhwTime,
    estimatedFlowLpm,
    pressureBar,
    dhwEventSteps,
    assumptionCount: output.behaviourTimeline.assumptionsUsed.length,
  };
}

function buildBehaviourSummarySection(output: EngineOutputV1): BehaviourSummarySection | null {
  if (!output.behaviourTimeline) return null;

  const pts = output.behaviourTimeline.points;
  const peakDhwKw = pts.reduce(
    (max, p) => Math.max(max, p.dhwApplianceOutKw ?? p.dhwDemandKw),
    0,
  );

  return {
    id: 'behaviour_summary',
    resolutionMins: output.behaviourTimeline.resolutionMins,
    applianceName: output.behaviourTimeline.labels.applianceName,
    totalPoints: pts.length,
    peakDhwKw: peakDhwKw > 0 ? peakDhwKw : null,
    assumptionsUsed: output.behaviourTimeline.assumptionsUsed.map(a => a.label),
  };
}

function buildKeyLimitersSection(output: EngineOutputV1): KeyLimitersSection | null {
  if (!output.limiters || output.limiters.limiters.length === 0) return null;

  return {
    id: 'key_limiters',
    limiters: output.limiters.limiters.slice(0, MAX_REPORT_LIMITERS).map(l => ({
      id: l.id,
      title: l.title,
      detail: l.impact.summary,
      severity: l.severity,
      observed: `${l.observed.value} ${l.observed.unit}`,
      limit: `${l.limit.value} ${l.limit.unit}`,
      suggestedFix: l.suggestedFixes.length > 0 ? l.suggestedFixes[0].label : undefined,
    })),
  };
}

function buildVerdictSection(output: EngineOutputV1): VerdictSection | null {
  if (!output.verdict) return null;

  return {
    id: 'verdict',
    title: output.verdict.title,
    status: output.verdict.status,
    reasons: output.verdict.reasons,
    confidenceLevel: output.verdict.confidence.level,
    primaryReason: output.verdict.primaryReason,
    comparedTechnologies: output.verdict.comparedTechnologies,
  };
}

function buildAssumptionsSection(output: EngineOutputV1): AssumptionsSection | null {
  const verdictAssumptions = output.verdict?.assumptionsUsed ?? [];
  const metaAssumptions = output.meta?.assumptions ?? [];
  // Merge: verdict-level assumptions first; meta assumptions fill any not already listed.
  const seenIds = new Set(verdictAssumptions.map(a => a.id));
  const combined = [
    ...verdictAssumptions,
    ...metaAssumptions.filter(a => !seenIds.has(a.id)),
  ];
  const redFlags = output.redFlags ?? [];

  if (combined.length === 0 && redFlags.length === 0) return null;

  return {
    id: 'assumptions',
    assumptions: combined.map(a => ({
      id: a.id,
      title: a.title,
      detail: a.detail,
      severity: a.severity,
    })),
    redFlags: redFlags.map(f => ({
      id: f.id,
      title: f.title,
      detail: f.detail,
      severity: f.severity,
    })),
  };
}

// ─── New section builders ─────────────────────────────────────────────────────

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

/**
 * Build the decision rationale section — the "engineer trust" block.
 *
 * Sources:
 *   whyThisWins            → verdict.primaryReason + verdict.reasons (top 3)
 *   whatLimitsAlternative  → secondary option's requirements / why + option score context
 *   keyPhysicalConstraints → hard limiters (severity='error'/'fail') + high-severity red flags
 *   recommendedNextAction  → first pathway title from plans, or first future-path enabler
 */
function buildDecisionRationaleSection(
  output: EngineOutputV1,
): DecisionRationaleSection | null {
  const primaryLabel = output.recommendation?.primary;
  if (!primaryLabel) return null;

  // ── Why this wins ────────────────────────────────────────────────────────
  const whyThisWins: string[] = [];
  if (output.verdict?.primaryReason) {
    whyThisWins.push(output.verdict.primaryReason);
  }
  // Add up to 3 additional verdict reasons (skip duplicates)
  for (const r of output.verdict?.reasons ?? []) {
    if (!whyThisWins.includes(r) && whyThisWins.length < 4) {
      whyThisWins.push(r);
    }
  }
  // Supplement from primary option's "why" text if still sparse
  const options = output.options ?? [];
  const primaryOption = pickRecommendedOption(options);
  if (primaryOption?.why && whyThisWins.length === 0) {
    whyThisWins.push(...primaryOption.why);
  }

  // ── What limits the alternative ─────────────────────────────────────────
  const alternativeLabel: string | undefined = output.recommendation?.secondary;
  const whatLimitsAlternative: string[] = [];

  const secondaryOption = primaryOption
    ? pickSecondaryOption(options, primaryOption)
    : null;

  if (secondaryOption) {
    // Requirements that block or limit the secondary option
    const reqs = secondaryOption.typedRequirements?.mustHave ?? [];
    for (const r of reqs.slice(0, 3)) {
      whatLimitsAlternative.push(r);
    }
    // Option-level "why" text can state why it's not primary
    if (secondaryOption.why && whatLimitsAlternative.length === 0) {
      whatLimitsAlternative.push(...secondaryOption.why);
    }
  }

  // ── Key physical constraints ─────────────────────────────────────────────
  const keyPhysicalConstraints: string[] = [];

  // Hard limiters first
  for (const l of output.limiters?.limiters ?? []) {
    if (l.severity === 'fail') {
      keyPhysicalConstraints.push(l.title + (l.impact?.summary ? ` — ${l.impact.summary}` : ''));
    }
  }
  // High-severity red flags
  for (const f of output.redFlags ?? []) {
    if (f.severity === 'fail' && keyPhysicalConstraints.length < 5) {
      keyPhysicalConstraints.push(f.title);
    }
  }
  // Warn-level limiters if nothing harder found
  if (keyPhysicalConstraints.length === 0) {
    for (const l of (output.limiters?.limiters ?? []).slice(0, 3)) {
      keyPhysicalConstraints.push(l.title + (l.impact?.summary ? ` — ${l.impact.summary}` : ''));
    }
  }

  // ── Recommended next action ──────────────────────────────────────────────
  const firstPathway = output.plans?.pathways?.[0];
  const recommendedNextAction: string | undefined = firstPathway
    ? firstPathway.title + (firstPathway.rationale ? `: ${firstPathway.rationale}` : '')
    : (primaryOption?.sensitivities?.find(s => s.effect === 'upgrade')?.note ?? undefined);

  // Only include the section if there is at least some rationale content.
  if (
    whyThisWins.length === 0 &&
    whatLimitsAlternative.length === 0 &&
    keyPhysicalConstraints.length === 0 &&
    !recommendedNextAction
  ) {
    return null;
  }

  return {
    id: 'decision_rationale',
    primaryLabel,
    whyThisWins,
    alternativeLabel,
    whatLimitsAlternative,
    keyPhysicalConstraints,
    recommendedNextAction,
  };
}

function buildKeyTradeOffSection(output: EngineOutputV1): KeyTradeOffSection | null {
  const options = output.options ?? [];
  const rec = pickRecommendedOption(options);
  if (!rec) return null;

  const likelyUpgrades = rec.typedRequirements?.likelyUpgrades ?? [];
  const engineeringBullets = rec.engineering?.bullets ?? [];

  if (likelyUpgrades.length === 0 && engineeringBullets.length === 0) return null;

  return {
    id: 'key_trade_off',
    systemLabel: rec.label,
    likelyUpgrades,
    engineeringBullets,
  };
}

function buildFuturePathSection(output: EngineOutputV1): FuturePathSection | null {
  const options = output.options ?? [];
  const rec = pickRecommendedOption(options);
  const sensitivities: SensitivityItem[] = rec?.sensitivities ?? [];

  const enablers = sensitivities
    .filter(s => s.effect === 'upgrade')
    .map(s => ({ lever: s.lever, note: s.note }));
  const risks = sensitivities
    .filter(s => s.effect === 'downgrade')
    .map(s => ({ lever: s.lever, note: s.note }));

  const pathways = (output.plans?.pathways ?? []).map(p => ({
    title: p.title,
    rationale: p.rationale,
  }));

  if (enablers.length === 0 && risks.length === 0 && pathways.length === 0) return null;

  return { id: 'future_path', enablers, risks, pathways };
}

function buildSystemArchitectureSection(
  output: EngineOutputV1,
): SystemArchitectureSection | null {
  const options = output.options ?? [];
  const rec = pickRecommendedOption(options);
  if (!rec) return null;

  const bullets = rec.engineering?.bullets ?? [];
  const mustHave = rec.typedRequirements?.mustHave ?? [];
  const headline = rec.engineering?.headline ?? '';

  if (bullets.length === 0 && mustHave.length === 0 && !headline) return null;

  return {
    id: 'system_architecture',
    systemLabel: rec.label,
    headline,
    bullets,
    mustHave,
  };
}

/** IDs considered "stored" systems — these have meaningful DHW plane info. */
const STORED_OPTION_IDS = new Set([
  'stored_vented',
  'stored_unvented',
  'ashp',
  'system_unvented',
  'regular_vented',
]);

function buildStoredHotWaterSection(output: EngineOutputV1): StoredHotWaterSection | null {
  const options = output.options ?? [];
  const rec = pickRecommendedOption(options);
  if (!rec || !STORED_OPTION_IDS.has(rec.id)) return null;

  const bullets = rec.dhw?.bullets ?? [];
  const headline = rec.dhw?.headline ?? '';

  if (!headline && bullets.length === 0) return null;

  return {
    id: 'stored_hot_water',
    systemLabel: rec.label,
    headline,
    bullets,
  };
}

function buildRisksEnablersSection(output: EngineOutputV1): RisksEnablersSection | null {
  const options = output.options ?? [];
  // Collect sensitivities from all options, not just the recommended one.
  const allSensitivities: SensitivityItem[] = options.flatMap(o => o.sensitivities ?? []);

  const risks    = allSensitivities.filter(s => s.effect === 'downgrade');
  const enablers = allSensitivities.filter(s => s.effect === 'upgrade');

  if (risks.length === 0 && enablers.length === 0) return null;

  return { id: 'risks_enablers', risks, enablers };
}

/** Maximum active trace points to include in the appendix. */
const MAX_TRACE_POINTS = 48;

/**
 * Determine the performance kind for a timeline point.
 * Returns 'eta' when boiler efficiency is recorded, 'cop' for heat pumps, or
 * null when neither is present.
 */
function resolvePerformanceKind(
  p: { efficiency?: number; cop?: number },
): 'eta' | 'cop' | null {
  if (p.efficiency != null) return 'eta';
  if (p.cop != null) return 'cop';
  return null;
}

function buildPhysicsTraceSection(output: EngineOutputV1): PhysicsTraceSection | null {
  if (!output.behaviourTimeline) return null;

  const { points, resolutionMins, labels } = output.behaviourTimeline;
  const activePoints = points
    .filter(p => (p.applianceOutKw ?? 0) > 0)
    .slice(0, MAX_TRACE_POINTS)
    .map(p => ({
      t: p.t,
      heatDemandKw: p.heatDemandKw ?? 0,
      dhwDemandKw: p.dhwDemandKw ?? 0,
      applianceOutKw: p.applianceOutKw ?? 0,
      performance: p.efficiency ?? p.cop ?? null,
      performanceKind: resolvePerformanceKind(p),
      mode: p.mode ?? null,
    }));

  const totalActiveSteps = points.filter(p => (p.applianceOutKw ?? 0) > 0).length;

  return {
    id: 'physics_trace',
    resolutionMins,
    applianceName: labels.applianceName,
    activePoints,
    totalActiveSteps,
  };
}

function buildEngineeringNotesSection(output: EngineOutputV1): EngineeringNotesSection | null {
  const options = output.options ?? [];
  const rec = pickRecommendedOption(options);
  if (!rec) return null;

  const mustHave   = rec.typedRequirements?.mustHave ?? [];
  const niceToHave = rec.typedRequirements?.niceToHave ?? [];

  if (mustHave.length === 0 && niceToHave.length === 0) return null;

  return {
    id: 'engineering_notes',
    systemLabel: rec.label,
    mustHave,
    niceToHave,
  };
}

function buildFutureEnergyOpportunitiesSection(
  output: EngineOutputV1,
): FutureEnergyOpportunitiesSection | null {
  const opp = output.futureEnergyOpportunities;
  if (!opp) return null;

  return {
    id: 'future_energy_opportunities',
    solarPv: {
      status: opp.solarPv.status,
      summary: opp.solarPv.summary,
      reasons: opp.solarPv.reasons,
      checksRequired: opp.solarPv.checksRequired,
    },
    evCharging: {
      status: opp.evCharging.status,
      summary: opp.evCharging.summary,
      reasons: opp.evCharging.reasons,
      checksRequired: opp.evCharging.checksRequired,
    },
  };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build an ordered list of printable report sections from engine output.
 *
 * Sections are included conditionally based on available data.
 * Section ordering follows the canonical report structure:
 *
 *   Customer summary (decision-first):
 *     system_summary → decision_rationale → key_trade_off → operating_point →
 *     behaviour_summary → key_limiters → future_path → verdict →
 *     future_energy_opportunities
 *
 *   Technical summary (engineer-facing):
 *     system_architecture → stored_hot_water → risks_enablers → assumptions
 *
 *   Appendix (optional deep detail):
 *     physics_trace → engineering_notes
 */
export function buildReportSections(output: EngineOutputV1): ReportSection[] {
  const sections: ReportSection[] = [];

  // ── Customer summary ───────────────────────────────────────────────────────
  sections.push(buildSystemSummarySection(output));

  const decisionRationaleSection = buildDecisionRationaleSection(output);
  if (decisionRationaleSection) sections.push(decisionRationaleSection);

  const tradeOffSection = buildKeyTradeOffSection(output);
  if (tradeOffSection) sections.push(tradeOffSection);

  const opSection = buildOperatingPointSection(output);
  if (opSection) sections.push(opSection);

  const bhvSection = buildBehaviourSummarySection(output);
  if (bhvSection) sections.push(bhvSection);

  const limitersSection = buildKeyLimitersSection(output);
  if (limitersSection) sections.push(limitersSection);

  const futurePathSection = buildFuturePathSection(output);
  if (futurePathSection) sections.push(futurePathSection);

  const verdictSection = buildVerdictSection(output);
  if (verdictSection) sections.push(verdictSection);

  const futureOpportunitiesSection = buildFutureEnergyOpportunitiesSection(output);
  if (futureOpportunitiesSection) sections.push(futureOpportunitiesSection);

  // ── Technical summary ─────────────────────────────────────────────────────
  const archSection = buildSystemArchitectureSection(output);
  if (archSection) sections.push(archSection);

  const storedHwSection = buildStoredHotWaterSection(output);
  if (storedHwSection) sections.push(storedHwSection);

  const risksSection = buildRisksEnablersSection(output);
  if (risksSection) sections.push(risksSection);

  const assumptionsSection = buildAssumptionsSection(output);
  if (assumptionsSection) sections.push(assumptionsSection);

  // ── Appendix ──────────────────────────────────────────────────────────────
  const traceSection = buildPhysicsTraceSection(output);
  if (traceSection) sections.push(traceSection);

  const engNotesSection = buildEngineeringNotesSection(output);
  if (engNotesSection) sections.push(engNotesSection);

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
