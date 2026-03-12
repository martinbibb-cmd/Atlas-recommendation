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
 */

import type { EngineOutputV1, LimiterV1, VerdictV1 } from '../../contracts/EngineOutputV1';

// ─── Section types ────────────────────────────────────────────────────────────

export type ReportSectionId =
  | 'system_summary'
  | 'operating_point'
  | 'behaviour_summary'
  | 'key_limiters'
  | 'verdict'
  | 'assumptions';

export interface SystemSummarySection {
  id: 'system_summary';
  primary: string;
  secondary?: string;
  verdictTitle?: string;
  verdictStatus?: VerdictV1['status'];
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

export type ReportSection =
  | SystemSummarySection
  | OperatingPointSection
  | BehaviourSummarySection
  | KeyLimitersSection
  | VerdictSection
  | AssumptionsSection;

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

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build an ordered list of printable report sections from engine output.
 *
 * Sections are included conditionally based on available data.
 * Section ordering follows the canonical report structure:
 *   system summary → operating point → behaviour summary →
 *   key limiters → verdict → assumptions
 */
export function buildReportSections(output: EngineOutputV1): ReportSection[] {
  const sections: ReportSection[] = [];

  sections.push(buildSystemSummarySection(output));

  const opSection = buildOperatingPointSection(output);
  if (opSection) sections.push(opSection);

  const bhvSection = buildBehaviourSummarySection(output);
  if (bhvSection) sections.push(bhvSection);

  const limitersSection = buildKeyLimitersSection(output);
  if (limitersSection) sections.push(limitersSection);

  const verdictSection = buildVerdictSection(output);
  if (verdictSection) sections.push(verdictSection);

  const assumptionsSection = buildAssumptionsSection(output);
  if (assumptionsSection) sections.push(assumptionsSection);

  return sections;
}
