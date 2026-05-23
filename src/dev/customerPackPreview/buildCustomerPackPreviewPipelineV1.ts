/**
 * buildCustomerPackPreviewPipelineV1.ts
 *
 * Preview pipeline: canonical template → CustomerEvidencePackV1.
 *
 * Authority chain (must not be broken):
 *   1. The recommendation engine owns system selection — only a locked label
 *      and summary string enter here.
 *   2. LegoTechnix owns all simulation / explainability / confidence outputs.
 *   3. This pipeline only assembles upstream outputs into a CustomerEvidencePackV1.
 *      It performs NO physics, NO recommendation derivation, and NO re-ranking.
 *
 * Used exclusively by the /dev/customer-pack-preview route.
 * Must never be imported into production recommendation logic.
 */

import type { LegoTechnixCanonicalSystemTemplateV1 } from '../../features/legoTechnix/fixtures/canonicalSystemTemplates';
import type { CustomerEvidencePackV1 } from '../../features/legoTechnix/customerEvidence/CustomerEvidencePackV1';
import type { LegoTechnixSimulationStateV1 } from '../../features/legoTechnix/simulation/LegoTechnixSimulationStateV1';
import {
  runLegoTechnixScenarioV1,
  buildDhwRecoveryMetricsV1,
  buildLegoTechnixExplainabilityReportV1,
} from '../../features/legoTechnix/simulation';
import { buildHydraulicConfidenceReportV1 } from '../../features/legoTechnix/hydraulicConfidenceReport';
import { buildCustomerEvidencePackV1 } from '../../features/legoTechnix/customerEvidence/buildCustomerEvidencePackV1';

// ─── Output ───────────────────────────────────────────────────────────────────

export interface CustomerPackPreviewPipelineOutputV1 {
  /** The assembled customer evidence pack — consumed verbatim by CustomerPackRendererV1. */
  readonly pack: CustomerEvidencePackV1;
  /** Canonical template id used to build this pack. */
  readonly templateId: string;
  /** Duration of the simulated scenario in seconds. */
  readonly scenarioDurationSeconds: number;
  /** Schema version of the assembled evidence pack. */
  readonly schemaVersion: string;
  /** Overall hydraulic confidence level from the confidence report. */
  readonly confidenceLevel: string;
  /** Total number of engineering warnings in the confidence report. */
  readonly warningsCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cloneSimulationState(
  state: LegoTechnixSimulationStateV1,
): LegoTechnixSimulationStateV1 {
  return JSON.parse(JSON.stringify(state)) as LegoTechnixSimulationStateV1;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Builds a CustomerEvidencePackV1 and associated debug metadata from a single
 * canonical LegoTechnix system template.
 *
 * Step order (must not be changed):
 *   canonical template → scenario → DHW metrics → confidence report
 *   → explainability report → CustomerEvidencePackV1
 *
 * @param template  One of the six LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1.
 * @param recommendationSummary  Locked summary string from the recommendation
 *   engine.  The preview uses a canonical default; production would supply a
 *   real engine output.
 */
export function buildCustomerPackPreviewPipelineV1(
  template: LegoTechnixCanonicalSystemTemplateV1,
  recommendationSummary: string,
): CustomerPackPreviewPipelineOutputV1 {
  // Step 1 — run scenario simulation
  const scenarioResult = runLegoTechnixScenarioV1({
    graph: template.graph,
    initialState: cloneSimulationState(template.initialState),
    ...template.scenario,
  });

  // Step 2 — DHW recovery metrics
  const dhwRecoveryMetrics = buildDhwRecoveryMetricsV1(scenarioResult);

  // Step 3 — hydraulic confidence report
  const hydraulicConfidenceReport = buildHydraulicConfidenceReportV1(
    template.graph,
    { ...scenarioResult, dhwRecoveryMetrics },
  );

  // Step 4 — explainability report
  const explainabilityReport = buildLegoTechnixExplainabilityReportV1({
    graph: template.graph,
    scenarioResult,
    dhwRecoveryMetrics,
    hydraulicConfidenceReport,
  });

  // Step 5 — assemble CustomerEvidencePackV1
  const pack = buildCustomerEvidencePackV1({
    lockedRecommendation: {
      systemLabel: template.label,
      systemType: template.systemType,
      recommendationSummary,
    },
    explainabilityReport,
    hydraulicConfidenceReport,
    dhwRecoveryMetrics,
    scenarioResult,
  });

  return {
    pack,
    templateId: template.id,
    scenarioDurationSeconds: template.scenario.durationSeconds,
    schemaVersion: pack.schemaVersion,
    confidenceLevel: hydraulicConfidenceReport.overallConfidence,
    warningsCount: hydraulicConfidenceReport.warnings.length,
  };
}
