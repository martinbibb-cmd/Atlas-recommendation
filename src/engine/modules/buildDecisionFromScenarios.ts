/**
 * buildDecisionFromScenarios.ts — Selects the recommended scenario and
 * assembles an AtlasDecisionV1 with a lifecycle assessment.
 *
 * Architecture:
 *   ScenarioResult[] + survey context → [this function] → AtlasDecisionV1
 *
 * Decision logic:
 *  1. Select the ScenarioResult with the best overall performance score
 *     (sum of ranked PerformanceBand values).
 *  2. Build the LifecycleAssessment from current-system survey data.
 *  3. If condition is 'at_risk' or 'worn', inject a lifecycle urgency reason
 *     into keyReasons.
 *  4. Populate supportingFacts from survey inputs and lifecycle output.
 *
 * This builder produces the minimum viable AtlasDecisionV1 that is needed
 * for PR1.  Headline, summary, and other copy fields are assembled from
 * the recommended scenario's own fields plus lifecycle context.
 */

import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { AtlasDecisionV1, DecisionSupportingFact } from '../../contracts/AtlasDecisionV1';
import type { LifecycleAssessment } from '../../contracts/LifecycleAssessment';
import type { BuildLifecycleAssessmentInput } from './buildLifecycleAssessment';
import { buildLifecycleAssessment } from './buildLifecycleAssessment';
import type { PerformanceBand } from '../../contracts/ScenarioResult';
import type { MaintenanceLevel, WaterQualityBand } from '../../contracts/LifecycleAssessment';
import { buildQuoteScope } from './buildQuoteScope';
import {
  buildShowerCompatibilityNotes,
  type ShowerCompatibilityInput,
} from './buildShowerCompatibilityNotes';

// ─── Performance band scoring ─────────────────────────────────────────────────

const PERFORMANCE_BAND_SCORE: Record<PerformanceBand, number> = {
  excellent:   5,
  very_good:   4,
  good:        3,
  needs_setup: 2,
  poor:        1,
};

function scoreScenario(s: ScenarioResult): number {
  const p = s.performance;
  return (
    PERFORMANCE_BAND_SCORE[p.hotWater] +
    PERFORMANCE_BAND_SCORE[p.heating] +
    PERFORMANCE_BAND_SCORE[p.efficiency] +
    PERFORMANCE_BAND_SCORE[p.reliability]
  );
}

// ─── Headline builder ─────────────────────────────────────────────────────────

function buildHeadline(scenario: ScenarioResult): string {
  const typeLabel: Record<ScenarioResult['system']['type'], string> = {
    combi:   'combi boiler',
    system:  'system boiler',
    regular: 'regular (heat-only) boiler',
    ashp:    'air source heat pump',
  };
  return `A ${typeLabel[scenario.system.type]} is the right fit for this home.`;
}

// ─── Summary builder ─────────────────────────────────────────────────────────

function buildSummary(
  scenario: ScenarioResult,
  lifecycle: LifecycleAssessment,
): string {
  const systemSummary = scenario.system.summary;
  const lifecyclePart =
    lifecycle.currentSystem.condition === 'unknown'
      ? ''
      : ` The existing system is in ${lifecycle.currentSystem.condition.replace('_', ' ')} condition — ${lifecycle.summary.toLowerCase()}.`;
  return `${systemSummary}.${lifecyclePart}`;
}

// ─── Key reasons builder ──────────────────────────────────────────────────────

function buildKeyReasons(
  scenario: ScenarioResult,
  lifecycle: LifecycleAssessment,
): string[] {
  const reasons: string[] = [...scenario.keyBenefits];

  // Hook lifecycle urgency into decision reasons
  if (lifecycle.currentSystem.condition === 'at_risk') {
    reasons.push('Current system is beyond typical lifespan — elevated risk of failure');
  } else if (lifecycle.currentSystem.condition === 'worn') {
    reasons.push('Current system is approaching end of typical lifespan — reliability may decline');
  }

  return reasons;
}

// ─── Supporting facts builder ─────────────────────────────────────────────────

function buildSupportingFacts(
  lifecycle: LifecycleAssessment,
  input: BuildDecisionInput,
): DecisionSupportingFact[] {
  const facts: DecisionSupportingFact[] = [];

  if (lifecycle.currentSystem.ageYears > 0) {
    facts.push({
      label: 'System age',
      value: `${lifecycle.currentSystem.ageYears} years`,
      source: 'survey',
    });
  }

  facts.push({
    label: 'Boiler type',
    value: lifecycle.currentSystem.type,
    source: 'survey',
  });

  if (lifecycle.influencingFactors.waterQuality !== 'unknown') {
    facts.push({
      label: 'Water quality',
      value: lifecycle.influencingFactors.waterQuality.replaceAll('_', ' '),
      source: 'engine',
    });
  }

  facts.push({
    label: 'Scale risk',
    value: lifecycle.influencingFactors.scaleRisk,
    source: 'engine',
  });

  facts.push({
    label: 'Usage intensity',
    value: lifecycle.influencingFactors.usageIntensity,
    source: 'engine',
  });

  if (input.occupancyCount !== undefined) {
    facts.push({
      label: 'Occupants',
      value: input.occupancyCount,
      source: 'survey',
    });
  }

  if (input.bathroomCount !== undefined) {
    facts.push({
      label: 'Bathrooms',
      value: input.bathroomCount,
      source: 'survey',
    });
  }

  facts.push({
    label: 'Condition band',
    value: lifecycle.currentSystem.condition,
    source: 'engine',
  });

  return facts;
}

// ─── Public input type ────────────────────────────────────────────────────────

export interface BuildDecisionInput {
  /** All evaluated scenario options. Must contain at least one entry. */
  scenarios: ScenarioResult[];

  // Current system context (forwarded to buildLifecycleAssessment)
  /** Boiler type of the existing system. */
  boilerType: BuildLifecycleAssessmentInput['boilerType'];
  /** Approximate age of the existing system in years. */
  ageYears: number;
  /** Water quality category. */
  waterQuality?: WaterQualityBand;
  /** Number of occupants. */
  occupancyCount?: number;
  /** Number of bathrooms. */
  bathroomCount?: number;
  /** Maintenance level. */
  maintenanceLevel?: MaintenanceLevel;
  /**
   * Shower compatibility signals captured during the survey.
   * When present, a structured compatibility note is injected into
   * compatibilityWarnings so that the customer and engineer both see it.
   */
  showerCompatibility?: ShowerCompatibilityInput;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * buildDecisionFromScenarios
 *
 * Selects the best-scoring ScenarioResult, builds a LifecycleAssessment for
 * the existing system, and assembles a complete AtlasDecisionV1.
 *
 * @throws {Error} when scenarios array is empty.
 */
export function buildDecisionFromScenarios(input: BuildDecisionInput): AtlasDecisionV1 {
  if (input.scenarios.length === 0) {
    throw new Error('buildDecisionFromScenarios: scenarios array must not be empty');
  }

  // Select scenario with highest total performance score
  const recommended = [...input.scenarios].sort(
    (a, b) => scoreScenario(b) - scoreScenario(a),
  )[0];

  // Build lifecycle assessment from current-system context
  const lifecycle = buildLifecycleAssessment({
    boilerType:       input.boilerType,
    ageYears:         input.ageYears,
    waterQuality:     input.waterQuality,
    occupancyCount:   input.occupancyCount,
    bathroomCount:    input.bathroomCount,
    maintenanceLevel: input.maintenanceLevel,
  });

  const keyReasons = buildKeyReasons(recommended, lifecycle);
  const supportingFacts = buildSupportingFacts(lifecycle, input);

  // Derive shower compatibility warning (if shower data was captured)
  const showerNote = input.showerCompatibility
    ? buildShowerCompatibilityNotes(input.showerCompatibility)
    : null;

  const physicsWarnings: string[] = recommended.physicsFlags
    ? buildCompatibilityWarnings(recommended)
    : [];

  // Inject shower compatibility note without duplicating if the same text is
  // already present from another source.
  const compatibilityWarnings = showerNote
    ? addIfAbsent(physicsWarnings, showerNote.customerSummary)
    : physicsWarnings;

  const quoteScope = buildQuoteScope({
    includedItems:        [],
    requiredWorks:        recommended.requiredWorks,
    compatibilityWarnings,
    futureUpgradePaths:   recommended.upgradePaths,
  });

  return {
    recommendedScenarioId:  recommended.scenarioId,
    headline:               buildHeadline(recommended),
    summary:                buildSummary(recommended, lifecycle),
    keyReasons,
    avoidedRisks:           recommended.keyConstraints,
    dayToDayOutcomes:       recommended.dayToDayOutcomes,
    requiredWorks:          recommended.requiredWorks,
    compatibilityWarnings,
    includedItems:          [],
    quoteScope,
    futureUpgradePaths:     recommended.upgradePaths,
    supportingFacts,
    lifecycle,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Append `value` to `arr` only when no existing entry already contains the
 * same text (case-insensitive, trimmed).  Prevents duplicate warning strings.
 */
function addIfAbsent(arr: string[], value: string): string[] {
  const normalised = value.trim().toLowerCase();
  if (arr.some(existing => existing.trim().toLowerCase() === normalised)) return arr;
  return [...arr, value];
}

function buildCompatibilityWarnings(scenario: ScenarioResult): string[] {
  const warnings: string[] = [];
  const flags = scenario.physicsFlags;

  if (flags.hydraulicLimit) {
    warnings.push('Existing pipework may limit achievable flow rate — hydraulic assessment required');
  }
  if (flags.combiFlowRisk) {
    warnings.push(
      'Simultaneous hot-water demand may exceed on-demand DHW capacity — consider a stored system',
    );
  }
  if (flags.highTempRequired) {
    warnings.push(
      'Existing radiators require high-temperature operation — low-temperature systems may need emitter upgrades',
    );
  }
  if (flags.pressureConstraint) {
    warnings.push('Mains pressure constraints may affect DHW performance — flow and pressure test recommended');
  }

  return warnings;
}
