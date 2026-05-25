import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { PortalVisitContextV1 } from '../../contracts/PortalVisitContextV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { VisitMeta } from '../../lib/visits/visitApi';
import type { PersistedAtlasVisitV2 } from '../../lib/storage/persistedAtlasVisitV2';
import type {
  CanonicalRecommendationSnapshotV1,
  GeneratedOutputsV1,
  VisitReviewLifecycleState,
} from '../../lib/storage/visitReviewLifecycle';
import type { CanonicalVisitPackageV1 } from '../visitPackage';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import {
  resolveCanonicalVisitIdentityReference,
} from './resolveCanonicalVisitIdentity';
export { formatVisitReference } from './resolveCanonicalVisitIdentity';

type PersistedPortalVisitContext = Pick<PortalVisitContextV1, 'addressSummary' | 'personalDataMode'>;

export function resolveVisitSessionReference(
  visitMeta: Pick<VisitMeta, 'visit_reference' | 'customer_name' | 'address_line_1'> | null | undefined,
  visitId: string,
): string {
  return resolveCanonicalVisitIdentityReference({
    customerOrProjectLabel: visitMeta?.visit_reference,
    customerName: visitMeta?.customer_name,
    addressLine1: visitMeta?.address_line_1,
    visitId,
  });
}

export interface VisitRecommendationSnapshotLike {
  readonly visitId: string;
  readonly visitReference?: string;
  readonly engineOutput?: EngineOutputV1;
  readonly scenarios?: ScenarioResult[];
  readonly decision?: AtlasDecisionV1;
  readonly customerSummary?: CustomerSummaryV1;
  readonly acceptedScenarioId?: string;
  readonly lifecycleState?: VisitReviewLifecycleState;
  readonly generatedOutputs?: GeneratedOutputsV1;
  readonly recommendationSnapshot?: CanonicalRecommendationSnapshotV1;
  readonly portalVisitContext?: PersistedPortalVisitContext;
}

interface ResolveCanonicalVisitExportStateInput {
  readonly activeVisitId?: string;
  readonly activeVisitMeta?: Pick<VisitMeta, 'visit_reference' | 'customer_name' | 'address_line_1'> | null;
  readonly savedVisit?: PersistedAtlasVisitV2 | null;
  readonly activeCanonicalPackage?: CanonicalVisitPackageV1 | null;
  readonly currentSnapshot?: VisitRecommendationSnapshotLike | null;
  readonly labFullSurveyModel?: FullSurveyModelV1;
  readonly labEngineInput?: EngineInputV2_3;
  readonly labPortalVisitContext?: PersistedPortalVisitContext;
}

export interface CanonicalVisitExportState {
  readonly exportVisitId: string;
  readonly exportSurveyModel: FullSurveyModelV1;
  readonly exportEngineInput?: EngineInputV2_3;
  readonly exportCustomerSummary?: CustomerSummaryV1;
  readonly exportDecision?: AtlasDecisionV1;
  readonly selectedScenarioId?: string;
  readonly exportPortalVisitContext?: PersistedPortalVisitContext;
  readonly visitReference: string;
  readonly generatedOutputsSeed?: GeneratedOutputsV1;
  readonly recommendationSnapshot?: CanonicalRecommendationSnapshotV1;
  readonly currentSnapshot: VisitRecommendationSnapshotLike | null;
}

export function resolveCanonicalVisitExportState(
  input: ResolveCanonicalVisitExportStateInput,
): CanonicalVisitExportState | undefined {
  const exportVisitId =
    input.activeVisitId
    ?? input.savedVisit?.visitId
    ?? input.activeCanonicalPackage?.visitIdentity.visitId;
  const exportSurveyModel =
    input.savedVisit?.survey
    ?? input.activeCanonicalPackage?.surveyDraft
    ?? input.labFullSurveyModel;

  if (exportVisitId == null || exportSurveyModel == null) {
    return undefined;
  }

  const currentSnapshot =
    input.currentSnapshot?.visitId === exportVisitId
      ? input.currentSnapshot
      : input.savedVisit != null
        ? {
            visitId: input.savedVisit.visitId,
            visitReference: input.savedVisit.visitReference,
            engineOutput: input.savedVisit.engine,
            scenarios: input.savedVisit.scenarios,
            decision: input.savedVisit.decision,
            customerSummary: input.savedVisit.customerSummary,
            acceptedScenarioId: input.savedVisit.acceptedScenarioId,
            lifecycleState: input.savedVisit.lifecycleState,
            generatedOutputs: input.savedVisit.generatedOutputs,
            recommendationSnapshot: input.savedVisit.recommendationSnapshot,
            portalVisitContext: input.savedVisit.portalVisitContext,
          }
        : null;

  const recommendationSnapshot =
    input.savedVisit?.recommendationSnapshot
    ?? input.currentSnapshot?.recommendationSnapshot
    ?? input.activeCanonicalPackage?.recommendationAuthority
    ?? input.activeCanonicalPackage?.importExportMetadata.recommendationSnapshot;

  return {
    exportVisitId,
    exportSurveyModel,
    exportEngineInput:
      input.savedVisit?.engineInputSnapshot
      ?? input.activeCanonicalPackage?.engineInputSnapshot
      ?? input.labEngineInput,
    exportCustomerSummary:
      input.savedVisit?.customerSummary
      ?? input.currentSnapshot?.customerSummary
      ?? input.activeCanonicalPackage?.proposalTruth?.customerSummary
      ?? input.activeCanonicalPackage?.customerPropertyDetails.customerSummary,
    exportDecision:
      input.savedVisit?.decision
      ?? input.currentSnapshot?.decision
      ?? input.activeCanonicalPackage?.proposalTruth?.decision,
    selectedScenarioId:
      input.savedVisit?.acceptedScenarioId
      ?? input.currentSnapshot?.acceptedScenarioId
      ?? input.activeCanonicalPackage?.proposalTruth?.selectedScenarioId,
    exportPortalVisitContext:
      input.savedVisit?.portalVisitContext
      ?? input.currentSnapshot?.portalVisitContext
      ?? input.activeCanonicalPackage?.customerPropertyDetails.portalVisitContext
      ?? input.labPortalVisitContext,
    visitReference: resolveCanonicalVisitIdentityReference({
      canonicalVisitReference: input.activeCanonicalPackage?.visitIdentity.visitReference,
      customerOrProjectLabel: input.savedVisit?.visitReference ?? input.currentSnapshot?.visitReference ?? input.activeVisitMeta?.visit_reference,
      customerName: input.activeVisitMeta?.customer_name,
      addressLine1: input.activeVisitMeta?.address_line_1,
      visitId: exportVisitId,
    }),
    generatedOutputsSeed:
      input.savedVisit?.generatedOutputs
      ?? input.currentSnapshot?.generatedOutputs
      ?? input.activeCanonicalPackage?.generatedOutputStatus?.generatedOutputs,
    ...(recommendationSnapshot != null ? { recommendationSnapshot } : {}),
    currentSnapshot,
  };
}
