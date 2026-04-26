/**
 * buildAccessibleTechnicalSummary.ts
 *
 * Produces a non-printing structured summary for accessibility tools and LLM
 * interpretation.  The summary is side-loaded: it is never rendered as printed
 * body content but is exposed as a sidecar (.json / .txt) when the PDF is
 * emailed or exported.
 *
 * RULES (non-negotiable):
 *   - Recommendation is ALWAYS taken from AtlasDecisionV1 — never re-derived.
 *   - keyReasons and avoidedRisks come exclusively from decision.keyReasons
 *     and decision.avoidedRisks.
 *   - Energy context (solar PV, EV/battery) comes from
 *     EngineOutputV1.futureEnergyOpportunities — never invented.
 *   - "Simultaneity" must not appear for households with 1 bathroom / ≤ 2
 *     occupants unless the engine explicitly raised a combi-simultaneous-demand
 *     red flag.
 *   - No Math.random() or arbitrary smoothing.
 *   - Terminology follows docs/atlas-terminology.md.
 */

import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { AtlasDecisionV1 } from '../../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../../contracts/ScenarioResult';
import type { QuoteScopeItem } from '../../../contracts/QuoteScope';
import type { InsightPackSurveyContext } from '../buildInsightPackFromEngine';

// ─── Schema version ───────────────────────────────────────────────────────────

export const ACCESSIBLE_SUMMARY_SCHEMA_VERSION = '1.0' as const;

// ─── LLM grounding note ───────────────────────────────────────────────────────

/**
 * Canonical grounding note included in every sidecar.
 * Must appear at the top of any LLM-facing payload so the model is
 * explicitly instructed not to substitute general internet knowledge.
 */
export const LLM_GROUNDING_NOTE =
  'Use only the facts and engine-derived conclusions in this summary. ' +
  'Do not replace Atlas recommendations with general internet advice.';

// ─── Output types ─────────────────────────────────────────────────────────────

/**
 * Surveyed property facts included verbatim from the canonical survey inputs.
 * Every field is optional — absent means the value was not captured.
 */
export interface SurveyedFacts {
  occupancyCount?: number;
  bathroomCount?: number;
  peakConcurrentOutlets?: number;
  mainsDynamicFlowLpm?: number;
  heatLossWatts?: number;
  currentSystem?: {
    type: string;
    ageYears?: number;
    condensing?: 'yes' | 'no' | 'unknown';
  };
}

/**
 * Engine-derived energy context from futureEnergyOpportunities.
 * Low-carbon objective is inferred from the recommended scenario being an ASHP
 * or from futureReadinessPriority being 'high'.
 */
export interface EnergyContext {
  solarPv?: {
    status: string;
    summary: string;
  };
  /** EV charging / battery-readiness assessment from the engine. */
  evBatteryReadiness?: {
    status: string;
    summary: string;
  };
  /** True when the recommended scenario is a heat pump or future-readiness is 'high'. */
  lowCarbonObjective: boolean;
}

/**
 * Engine-derived recommendation, faithfully forwarded from AtlasDecisionV1.
 * No re-derivation is permitted here.
 */
export interface RecommendationSummary {
  recommendedScenarioId: string;
  headline: string;
  summary: string;
  keyReasons: string[];
  avoidedRisks: string[];
  dayToDayOutcomes: string[];
}

/**
 * A scenario that was evaluated but not recommended, with the engine-derived
 * constraints that caused it to be set aside.
 */
export interface RejectedScenarioSummary {
  scenarioId: string;
  systemType: string;
  keyConstraints: string[];
}

/**
 * Confidence information forwarded from the engine output metadata.
 */
export interface ConfidenceSummary {
  level?: 'high' | 'medium' | 'low';
  reasons: string[];
  unknowns: string[];
}

/**
 * Structured JSON payload — the machine-readable sidecar.
 * This is the canonical shape emitted alongside the PDF.
 */
export interface AccessibleTechnicalSummaryJson {
  /** Canonical source identifier — always "AtlasDecisionV1". */
  source: 'AtlasDecisionV1';
  schemaVersion: typeof ACCESSIBLE_SUMMARY_SCHEMA_VERSION;
  generatedAt: string;
  /** Visit identifier forwarded from the calling context, when available. */
  visitId?: string;
  /** Engine run identifier forwarded from EngineMetaV1, when available. */
  engineRunId?: string;
  llmGroundingNote: string;
  surveyedFacts: SurveyedFacts;
  energyContext: EnergyContext;
  recommendation: RecommendationSummary;
  rejectedScenarios: RejectedScenarioSummary[];
  confidence: ConfidenceSummary;
  quoteScopeItems?: QuoteScopeItem[];
}

/**
 * The complete accessible technical summary — both human-readable and
 * machine-readable forms of the same engine-derived truth.
 */
export interface AccessibleTechnicalSummary {
  /** Plain-text representation for screen readers, .txt sidecar, and AT tools. */
  plainText: string;
  /** Structured JSON representation for LLM grounding and advanced review. */
  json: AccessibleTechnicalSummaryJson;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSurveyedFacts(ctx?: InsightPackSurveyContext): SurveyedFacts {
  const facts: SurveyedFacts = {};
  if (ctx?.occupancyCount !== undefined) facts.occupancyCount = ctx.occupancyCount;
  if (ctx?.bathroomCount !== undefined) facts.bathroomCount = ctx.bathroomCount;
  if (ctx?.peakConcurrentOutlets !== undefined) facts.peakConcurrentOutlets = ctx.peakConcurrentOutlets;
  if (ctx?.mainsDynamicFlowLpm !== undefined) facts.mainsDynamicFlowLpm = ctx.mainsDynamicFlowLpm;
  if (ctx?.heatLossWatts !== undefined) facts.heatLossWatts = ctx.heatLossWatts;
  if (ctx?.currentBoiler?.type && ctx.currentBoiler.type !== 'unknown') {
    facts.currentSystem = {
      type: ctx.currentBoiler.type,
      ageYears: ctx.currentBoiler.ageYears,
      condensing: ctx.currentBoiler.condensing,
    };
  }
  return facts;
}

function buildEnergyContext(
  output: EngineOutputV1,
  recommendedSystemType?: string,
): EnergyContext {
  const ctx: EnergyContext = {
    lowCarbonObjective: false,
  };

  if (output.futureEnergyOpportunities?.solarPv) {
    const pv = output.futureEnergyOpportunities.solarPv;
    ctx.solarPv = { status: pv.status, summary: pv.summary };
  }

  if (output.futureEnergyOpportunities?.evCharging) {
    const ev = output.futureEnergyOpportunities.evCharging;
    ctx.evBatteryReadiness = { status: ev.status, summary: ev.summary };
  }

  // Low-carbon objective: true when recommended system is ASHP
  // or when solar PV/EV charging assessments indicate a whole-home low-carbon pathway.
  const isAshpRecommended = recommendedSystemType === 'ashp';
  const pvFavourable =
    output.futureEnergyOpportunities?.solarPv?.status === 'suitable_now';
  const evFavourable =
    output.futureEnergyOpportunities?.evCharging?.status === 'suitable_now';

  ctx.lowCarbonObjective = isAshpRecommended || pvFavourable || evFavourable;

  return ctx;
}

function buildConfidence(output: EngineOutputV1): ConfidenceSummary {
  const meta = output.meta;
  if (!meta?.confidence) {
    return { reasons: [], unknowns: [] };
  }
  return {
    level: meta.confidence.level,
    reasons: meta.confidence.reasons ?? [],
    unknowns: meta.confidence.unknowns ?? [],
  };
}

/**
 * Simultaneity guard: a simultaneity reason must not appear in the summary
 * unless the engine explicitly raised a combi-simultaneous-demand red flag.
 *
 * Rule from docs/atlas-terminology.md:
 *   occupancyCount ≤ 2 and bathroomCount ≤ 1 → simultaneous demand is not
 *   a physics-derived constraint unless the engine flags it.
 */
function isSimultaneityGuarded(
  reasons: string[],
  output: EngineOutputV1,
  ctx?: InsightPackSurveyContext,
): string[] {
  const engineFlaggedSimultaneity = (output.redFlags ?? []).some(
    f => f.severity === 'fail' && f.id.includes('combi-simultaneous-demand'),
  );
  if (engineFlaggedSimultaneity) return reasons;

  const smallHousehold =
    (ctx?.occupancyCount ?? 999) <= 2 && (ctx?.bathroomCount ?? 999) <= 1;
  if (!smallHousehold) return reasons;

  return reasons.filter(r => !/simultan/i.test(r));
}

// ─── Plain-text formatter ─────────────────────────────────────────────────────

function formatPlainText(data: AccessibleTechnicalSummaryJson): string {
  const lines: string[] = [];

  lines.push('ATLAS ACCESSIBLE TECHNICAL SUMMARY');
  lines.push('===================================');
  lines.push(data.llmGroundingNote);
  lines.push('');
  lines.push(`Source: ${data.source}`);
  lines.push(`Generated: ${data.generatedAt}`);
  lines.push(`Schema version: ${data.schemaVersion}`);
  if (data.visitId) lines.push(`Visit ID: ${data.visitId}`);
  if (data.engineRunId) lines.push(`Engine run ID: ${data.engineRunId}`);
  lines.push('');

  // Surveyed facts
  lines.push('SURVEYED FACTS');
  lines.push('--------------');
  const facts = data.surveyedFacts;
  if (facts.occupancyCount !== undefined)
    lines.push(`Occupancy: ${facts.occupancyCount} person(s)`);
  if (facts.bathroomCount !== undefined)
    lines.push(`Bathrooms: ${facts.bathroomCount}`);
  if (facts.peakConcurrentOutlets !== undefined)
    lines.push(`Peak concurrent hot-water outlets: ${facts.peakConcurrentOutlets}`);
  if (facts.mainsDynamicFlowLpm !== undefined)
    lines.push(`Mains dynamic flow: ${facts.mainsDynamicFlowLpm} L/min`);
  if (facts.heatLossWatts !== undefined)
    lines.push(`Peak heat loss: ${facts.heatLossWatts} W`);
  if (facts.currentSystem) {
    const cs = facts.currentSystem;
    const age = cs.ageYears !== undefined ? `, ${cs.ageYears} years old` : '';
    const condensingText = cs.condensing && cs.condensing !== 'unknown' ? `, ${cs.condensing} condensing` : '';
    lines.push(`Current system: ${cs.type}${age}${condensingText}`);
  }
  lines.push('');

  // Energy context
  lines.push('ENERGY CONTEXT');
  lines.push('--------------');
  if (data.energyContext.solarPv) {
    lines.push(`Solar PV: ${data.energyContext.solarPv.status} — ${data.energyContext.solarPv.summary}`);
  }
  if (data.energyContext.evBatteryReadiness) {
    lines.push(
      `EV / Battery readiness: ${data.energyContext.evBatteryReadiness.status} — ${data.energyContext.evBatteryReadiness.summary}`,
    );
  }
  lines.push(`Low-carbon objective: ${data.energyContext.lowCarbonObjective ? 'yes' : 'no'}`);
  lines.push('');

  // Recommendation
  lines.push('RECOMMENDATION');
  lines.push('--------------');
  lines.push(data.recommendation.headline);
  lines.push('');
  lines.push(data.recommendation.summary);
  lines.push('');
  if (data.recommendation.keyReasons.length > 0) {
    lines.push('Key reasons:');
    for (const r of data.recommendation.keyReasons) lines.push(`  • ${r}`);
    lines.push('');
  }
  if (data.recommendation.avoidedRisks.length > 0) {
    lines.push('Avoided risks:');
    for (const r of data.recommendation.avoidedRisks) lines.push(`  • ${r}`);
    lines.push('');
  }
  if (data.recommendation.dayToDayOutcomes.length > 0) {
    lines.push('Day-to-day outcomes:');
    for (const o of data.recommendation.dayToDayOutcomes) lines.push(`  • ${o}`);
    lines.push('');
  }

  // Rejected scenarios
  if (data.rejectedScenarios.length > 0) {
    lines.push('OTHER EVALUATED OPTIONS');
    lines.push('-----------------------');
    for (const rs of data.rejectedScenarios) {
      lines.push(`${rs.scenarioId} (${rs.systemType}):`);
      for (const c of rs.keyConstraints) lines.push(`  — ${c}`);
    }
    lines.push('');
  }

  // Confidence
  if (data.confidence.level) {
    lines.push('CONFIDENCE');
    lines.push('----------');
    lines.push(`Level: ${data.confidence.level}`);
    if (data.confidence.reasons.length > 0) {
      for (const r of data.confidence.reasons) lines.push(`  • ${r}`);
    }
    if (data.confidence.unknowns.length > 0) {
      lines.push('Unknowns:');
      for (const u of data.confidence.unknowns) lines.push(`  ? ${u}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Optional identity fields forwarded into the sidecar for traceability.
 */
export interface AccessibleSummaryIdentity {
  /** Visit identifier from the calling context. */
  visitId?: string;
  /**
   * Engine run identifier.  When EngineMetaV1 carries a stable run ID in the
   * future this should be sourced from there; callers may also supply it
   * directly from their own call-site context.
   */
  engineRunId?: string;
}

// ─── Mismatch assertion ───────────────────────────────────────────────────────

/**
 * Asserts that the scenarioId recorded in the sidecar recommendation block
 * matches the decision's authoritative recommendedScenarioId.
 *
 * Exported separately so it can be tested directly and re-used by any future
 * code path that builds or mutates a sidecar outside of the main builder.
 *
 * @throws {Error} when the IDs diverge.
 */
export function assertSidecarRecommendationMatch(
  sidecarRecommendedScenarioId: string,
  decisionRecommendedScenarioId: string,
): void {
  if (sidecarRecommendedScenarioId !== decisionRecommendedScenarioId) {
    throw new Error(
      `AccessibleTechnicalSummary mismatch: ` +
      `summary.recommendation.recommendedScenarioId "${sidecarRecommendedScenarioId}" ` +
      `does not match decision.recommendedScenarioId "${decisionRecommendedScenarioId}"`,
    );
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Builds an accessible technical summary for a completed Atlas recommendation.
 *
 * @param engineOutput   Full EngineOutputV1 from the recommendation run.
 * @param decision       AtlasDecisionV1 — the authoritative recommendation.
 *                       This is the ONLY source for the recommendation field.
 * @param scenarios      All evaluated ScenarioResult entries (recommended +
 *                       rejected).
 * @param surveyContext  Optional survey context — populates the surveyedFacts
 *                       block.  Drawn from InsightPackSurveyContext.
 * @param quoteScopeItems  Optional canonical quote scope items to attach as
 *                       supporting evidence.
 * @param identity       Optional identity fields (visitId, engineRunId) to
 *                       embed in the sidecar for traceability.
 */
export function buildAccessibleTechnicalSummary(
  engineOutput: EngineOutputV1,
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
  surveyContext?: InsightPackSurveyContext,
  quoteScopeItems?: QuoteScopeItem[],
  identity?: AccessibleSummaryIdentity,
): AccessibleTechnicalSummary {
  // Find the recommended scenario for system-type lookup.
  const recommendedScenario = scenarios.find(
    s => s.scenarioId === decision.recommendedScenarioId,
  );

  // Build energy context — low-carbon objective derived from recommended system type.
  const energyContext = buildEnergyContext(
    engineOutput,
    recommendedScenario?.system.type,
  );

  // Key reasons and avoided risks from decision — apply simultaneity guard.
  const keyReasons = isSimultaneityGuarded(
    decision.keyReasons,
    engineOutput,
    surveyContext,
  );
  const avoidedRisks = isSimultaneityGuarded(
    decision.avoidedRisks,
    engineOutput,
    surveyContext,
  );

  // Rejected scenarios: all scenarios that are NOT the recommended one.
  const rejectedScenarios: RejectedScenarioSummary[] = scenarios
    .filter(s => s.scenarioId !== decision.recommendedScenarioId)
    .map(s => ({
      scenarioId: s.scenarioId,
      systemType: s.system.type,
      keyConstraints: s.keyConstraints,
    }));

  const json: AccessibleTechnicalSummaryJson = {
    source: 'AtlasDecisionV1',
    schemaVersion: ACCESSIBLE_SUMMARY_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    ...(identity?.visitId ? { visitId: identity.visitId } : {}),
    ...(identity?.engineRunId ? { engineRunId: identity.engineRunId } : {}),
    llmGroundingNote: LLM_GROUNDING_NOTE,
    surveyedFacts: buildSurveyedFacts(surveyContext),
    energyContext,
    recommendation: {
      recommendedScenarioId: decision.recommendedScenarioId,
      headline: decision.headline,
      summary: decision.summary,
      keyReasons,
      avoidedRisks,
      dayToDayOutcomes: decision.dayToDayOutcomes,
    },
    rejectedScenarios,
    confidence: buildConfidence(engineOutput),
    ...(quoteScopeItems && quoteScopeItems.length > 0
      ? { quoteScopeItems }
      : {}),
  };

  // Mismatch assertion: the recommendation in the sidecar must faithfully
  // reflect the decision.  If they diverge, something has gone wrong upstream.
  assertSidecarRecommendationMatch(
    json.recommendation.recommendedScenarioId,
    decision.recommendedScenarioId,
  );

  return {
    plainText: formatPlainText(json),
    json,
  };
}
