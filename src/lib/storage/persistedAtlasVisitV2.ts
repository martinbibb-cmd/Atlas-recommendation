import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { PortalVisitContextV1 } from '../../contracts/PortalVisitContextV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import {
  deriveLifecycleStateFromSnapshot,
  isRecommendationReadyForLifecycle,
  normaliseVisitReviewLifecycleState,
  normaliseGeneratedOutputs,
  type CanonicalRecommendationSnapshotV1,
  type GeneratedOutputsV1,
  type VisitReviewLifecycleState,
} from './visitReviewLifecycle';

export interface CanonicalVisitPayloadV1 {
  schemaVersion: '1.0';
  visitIdentity: {
    visitId: string;
    visitReference?: string;
    updatedAt: string;
  };
  /** Stable customer/property facts captured for recommendation and handoff projections. */
  customerPropertyFacts?: unknown;
  surveyDraftInput: FullSurveyModelV1;
  /** References to captured scan/media evidence linked to this visit. */
  scanEvidenceReferences?: unknown;
  engineInputSnapshot?: EngineInputV2_3;
  recommendationResult?: {
    engineOutput?: EngineOutputV1;
    decision?: AtlasDecisionV1;
    scenarios?: ScenarioResult[];
    customerSummary?: CustomerSummaryV1;
    selectedRecommendationId?: string;
    recommendationSnapshot?: CanonicalRecommendationSnapshotV1;
  };
  presentationHandoff?: {
    lifecycleState?: VisitReviewLifecycleState;
    generatedOutputs?: GeneratedOutputsV1;
    recommendationSnapshot?: CanonicalRecommendationSnapshotV1;
    portalVisitContext?: Pick<PortalVisitContextV1, 'addressSummary' | 'personalDataMode'>;
  };
  saveExportStatus?: {
    lastSavedAt: string;
    lastExportedAt?: string;
  };
}

export interface PersistedAtlasVisitV2 {
  schemaVersion: 2;
  visitId: string;
  visitReference?: string;
  updatedAt: string;
  survey: FullSurveyModelV1;
  engineInputSnapshot?: EngineInputV2_3;
  engine?: EngineOutputV1;
  decision?: AtlasDecisionV1;
  scenarios?: ScenarioResult[];
  customerSummary?: CustomerSummaryV1;
  acceptedScenarioId?: string;
  lifecycleState?: VisitReviewLifecycleState;
  generatedOutputs?: GeneratedOutputsV1;
  recommendationSnapshot?: CanonicalRecommendationSnapshotV1;
  portalVisitContext?: Pick<PortalVisitContextV1, 'addressSummary' | 'personalDataMode'>;
  scanCapture?: unknown;
  quotePlan?: unknown;
  canonical?: CanonicalVisitPayloadV1;
}

interface PersistedAtlasVisitReadResult {
  visit: PersistedAtlasVisitV2 | null;
  restoredFromTemp: boolean;
  schemaMismatch: boolean;
}

export interface PersistedAtlasVisitV2Input {
  visitId: string;
  visitReference?: string;
  updatedAt: string;
  survey: FullSurveyModelV1;
  engineInputSnapshot?: EngineInputV2_3;
  engine?: EngineOutputV1;
  decision?: AtlasDecisionV1;
  scenarios?: ScenarioResult[];
  customerSummary?: CustomerSummaryV1;
  acceptedScenarioId?: string;
  lifecycleState?: VisitReviewLifecycleState;
  generatedOutputs?: GeneratedOutputsV1;
  recommendationSnapshot?: CanonicalRecommendationSnapshotV1;
  portalVisitContext?: Pick<PortalVisitContextV1, 'addressSummary' | 'personalDataMode'>;
  scanCapture?: unknown;
  quotePlan?: unknown;
}

function mainKey(visitId: string): string {
  return `atlas_visit_${visitId}`;
}

function tempKey(visitId: string): string {
  return `atlas_visit_${visitId}_tmp`;
}

function buildCanonicalVisitPayload(input: PersistedAtlasVisitV2Input): CanonicalVisitPayloadV1 {
  return {
    schemaVersion: '1.0',
    visitIdentity: {
      visitId: input.visitId,
      visitReference: input.visitReference,
      updatedAt: input.updatedAt,
    },
    surveyDraftInput: input.survey,
    scanEvidenceReferences: input.scanCapture,
    engineInputSnapshot: input.engineInputSnapshot,
    recommendationResult: {
      engineOutput: input.engine,
      decision: input.decision,
      scenarios: input.scenarios,
      customerSummary: input.customerSummary,
      selectedRecommendationId: input.acceptedScenarioId,
      ...(input.recommendationSnapshot != null ? { recommendationSnapshot: input.recommendationSnapshot } : {}),
    },
    presentationHandoff: {
      lifecycleState: input.lifecycleState,
      generatedOutputs: input.generatedOutputs,
      ...(input.recommendationSnapshot != null ? { recommendationSnapshot: input.recommendationSnapshot } : {}),
      portalVisitContext: input.portalVisitContext,
    },
    saveExportStatus: {
      lastSavedAt: input.updatedAt,
    },
  };
}

export function buildPersistedAtlasVisitV2(input: PersistedAtlasVisitV2Input): PersistedAtlasVisitV2 {
  return {
    schemaVersion: 2,
    visitId: input.visitId,
    visitReference: input.visitReference,
    updatedAt: input.updatedAt,
    survey: input.survey,
    engineInputSnapshot: input.engineInputSnapshot,
    engine: input.engine,
    decision: input.decision,
    scenarios: input.scenarios,
    customerSummary: input.customerSummary,
    acceptedScenarioId: input.acceptedScenarioId,
    lifecycleState: input.lifecycleState,
    generatedOutputs: input.generatedOutputs,
    ...(input.recommendationSnapshot != null ? { recommendationSnapshot: input.recommendationSnapshot } : {}),
    portalVisitContext: input.portalVisitContext,
    scanCapture: input.scanCapture,
    quotePlan: input.quotePlan,
    canonical: buildCanonicalVisitPayload(input),
  };
}

function readCanonicalPayload(parsed: Partial<PersistedAtlasVisitV2>): CanonicalVisitPayloadV1 | null {
  const canonical = parsed.canonical;
  if (!canonical || typeof canonical !== 'object') return null;
  if (canonical.schemaVersion !== '1.0') return null;
  if (!canonical.visitIdentity || canonical.visitIdentity.visitId !== parsed.visitId) return null;
  if (!canonical.surveyDraftInput || typeof canonical.surveyDraftInput !== 'object') return null;
  return canonical;
}

function coalesceValue<T>(primary: T | undefined, secondary: T | undefined): T | undefined {
  return primary ?? secondary;
}

function updateCanonicalExportStatus(
  canonical: CanonicalVisitPayloadV1 | undefined,
  lastExportedAt: string | undefined,
): CanonicalVisitPayloadV1 | undefined {
  if (canonical == null || lastExportedAt == null) return canonical;
  return {
    ...canonical,
    saveExportStatus: {
      lastSavedAt: canonical.saveExportStatus?.lastSavedAt ?? canonical.visitIdentity.updatedAt,
      lastExportedAt,
    },
  };
}

function parsePersisted(raw: string | null): PersistedAtlasVisitV2 | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedAtlasVisitV2> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.schemaVersion !== 2) return null;
    if (typeof parsed.visitId !== 'string' || parsed.visitId.trim().length === 0) return null;
    if (typeof parsed.updatedAt !== 'string' || parsed.updatedAt.trim().length === 0) return null;
    const canonical = readCanonicalPayload(parsed);
    const survey = coalesceValue(parsed.survey, canonical?.surveyDraftInput);
    if (!survey || typeof survey !== 'object') return null;
    const engineInputSnapshot = coalesceValue(parsed.engineInputSnapshot, canonical?.engineInputSnapshot);
    const engine = coalesceValue(parsed.engine, canonical?.recommendationResult?.engineOutput);
    const decision = coalesceValue(parsed.decision, canonical?.recommendationResult?.decision);
    const scenarios = coalesceValue(parsed.scenarios, canonical?.recommendationResult?.scenarios);
    const customerSummary = coalesceValue(parsed.customerSummary, canonical?.recommendationResult?.customerSummary);
    const acceptedScenarioId = coalesceValue(parsed.acceptedScenarioId, canonical?.recommendationResult?.selectedRecommendationId);
    const recommendationSnapshot =
      parsed.recommendationSnapshot
      ?? canonical?.recommendationResult?.recommendationSnapshot
      ?? canonical?.presentationHandoff?.recommendationSnapshot;
    const portalVisitContext = coalesceValue(parsed.portalVisitContext, canonical?.presentationHandoff?.portalVisitContext);
    const generatedOutputs = normaliseGeneratedOutputs(
      coalesceValue(parsed.generatedOutputs, canonical?.presentationHandoff?.generatedOutputs),
    );
    const recommendationReady = isRecommendationReadyForLifecycle({
      decision,
      customerSummary,
      acceptedScenarioId,
      engineRecommendationPrimary: engine?.recommendation?.primary,
    });
    const persistedLifecycleState = parsed.lifecycleState ?? canonical?.presentationHandoff?.lifecycleState;
    const lifecycleState = normaliseVisitReviewLifecycleState(persistedLifecycleState);
    const resolvedLifecycleState = lifecycleState != null
      ? lifecycleState
      : deriveLifecycleStateFromSnapshot({
        recommendationReady,
        generatedOutputs,
      });
    const normalised = buildPersistedAtlasVisitV2({
      visitId: parsed.visitId,
      visitReference: coalesceValue(parsed.visitReference, canonical?.visitIdentity.visitReference),
      updatedAt: parsed.updatedAt,
      survey,
      engineInputSnapshot,
      engine,
      decision,
      scenarios,
      customerSummary,
      acceptedScenarioId,
      lifecycleState: resolvedLifecycleState,
      generatedOutputs,
      recommendationSnapshot,
      portalVisitContext,
      scanCapture: coalesceValue(parsed.scanCapture, canonical?.scanEvidenceReferences),
      quotePlan: parsed.quotePlan,
    });
    normalised.canonical = updateCanonicalExportStatus(
      normalised.canonical,
      canonical?.saveExportStatus?.lastExportedAt,
    );
    return {
      // preserve unknown top-level fields for migration-safe reads
      ...(parsed as PersistedAtlasVisitV2),
      ...normalised,
      canonical: normalised.canonical,
    };
  } catch {
    return null;
  }
}

function hasSchemaMismatch(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as { schemaVersion?: number } | null;
    return typeof parsed?.schemaVersion === 'number' && parsed.schemaVersion !== 2;
  } catch {
    return false;
  }
}

export function saveVisitAtomically(visit: PersistedAtlasVisitV2): void {
  const main = mainKey(visit.visitId);
  const tmp = tempKey(visit.visitId);
  try {
    const json = JSON.stringify(visit);
    localStorage.setItem(tmp, json);
    localStorage.setItem(main, json);
    localStorage.removeItem(tmp);
  } catch {
    // best effort only
  }
}

export function readPersistedAtlasVisitV2(visitId: string): PersistedAtlasVisitReadResult {
  const main = mainKey(visitId);
  const tmp = tempKey(visitId);

  let restoredFromTemp = false;
  const tmpRaw = localStorage.getItem(tmp);
  const mainRaw = localStorage.getItem(main);
  const tmpVisit = parsePersisted(tmpRaw);

  if (tmpVisit && tmpVisit.visitId === visitId) {
    saveVisitAtomically(tmpVisit);
    restoredFromTemp = true;
    return {
      visit: tmpVisit,
      restoredFromTemp,
      schemaMismatch: false,
    };
  }

  if (tmpRaw !== null) {
    try {
      localStorage.removeItem(tmp);
    } catch {
      // best effort
    }
  }

  const mainVisit = parsePersisted(mainRaw);
  if (mainVisit && mainVisit.visitId === visitId) {
    return {
      visit: mainVisit,
      restoredFromTemp,
      schemaMismatch: false,
    };
  }

  return {
    visit: null,
    restoredFromTemp: false,
    schemaMismatch: hasSchemaMismatch(mainRaw) || hasSchemaMismatch(tmpRaw),
  };
}

export function clearPersistedAtlasVisitV2(visitId: string): void {
  try {
    localStorage.removeItem(mainKey(visitId));
    localStorage.removeItem(tempKey(visitId));
  } catch {
    // best effort
  }
}
