import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { CustomerSummaryV1 } from '../../contracts/CustomerSummaryV1';
import type { PortalVisitContextV1 } from '../../contracts/PortalVisitContextV1';
import type { VisitEnvelopeV1 } from '../../contracts/VisitEnvelopeV1';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { AtlasVisitOwnershipV1 } from '../../auth/profile/AtlasVisitOwnershipV1';
import type { WorkflowStorageTarget } from '../../storage/workflow/WorkflowStorageAdapterV1';
import type { WorkflowExportBrandContextV1 } from '../../storage/workflow/exportPackage/WorkflowExportPackageV1';
import type { GeneratedOutputsV1, VisitReviewLifecycleState } from '../../lib/storage/visitReviewLifecycle';

export const CANONICAL_VISIT_PACKAGE_SCHEMA = 'atlas.canonical-visit-package' as const;
export const CANONICAL_VISIT_PACKAGE_VERSION = '1.0' as const;
export const CANONICAL_VISIT_PACKAGE_INTEGRITY_ALGORITHM = 'fnv1a64-stable-json-v1' as const;

export interface CanonicalVisitIdentityV1 {
  readonly visitId?: string;
  readonly visitReference?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface CanonicalVisitWorkspaceBrandReferenceV1 {
  readonly ownership?: AtlasVisitOwnershipV1;
  readonly workspaceId?: string;
  readonly workspaceName?: string;
  readonly brandId?: string;
  readonly brandContext?: WorkflowExportBrandContextV1;
}

export interface CanonicalVisitCustomerPropertyDetailsV1 {
  readonly portalVisitContext?: PortalVisitContextV1;
  readonly customerSummary?: CustomerSummaryV1;
  readonly propertyFacts?: readonly string[];
  readonly usageFacts?: readonly string[];
}

export interface CanonicalVisitProposalTruthV1 {
  readonly visitEnvelope?: VisitEnvelopeV1;
  readonly decision?: AtlasDecisionV1;
  readonly selectedScenarioId?: string;
  readonly customerSummary?: CustomerSummaryV1;
}

export interface CanonicalVisitGeneratedOutputStatusV1 {
  readonly lifecycleState?: VisitReviewLifecycleState;
  readonly generatedOutputs?: GeneratedOutputsV1;
}

export interface CanonicalVisitImportExportMetadataV1 {
  readonly exportedAt: string;
  readonly source: {
    readonly target: WorkflowStorageTarget | 'unknown';
    readonly surface: string;
  };
  readonly recommendationSnapshot?: {
    readonly snapshotId: string;
    readonly checksum: string;
  };
  readonly importedAt?: string;
  readonly importSource?: string;
}

export interface CanonicalVisitPackageIntegrityV1 {
  readonly algorithm: typeof CANONICAL_VISIT_PACKAGE_INTEGRITY_ALGORITHM;
  readonly hash: string;
}

export interface CanonicalVisitPackageV1 {
  readonly schema: typeof CANONICAL_VISIT_PACKAGE_SCHEMA;
  readonly version: typeof CANONICAL_VISIT_PACKAGE_VERSION;
  readonly packageIntegrity?: CanonicalVisitPackageIntegrityV1;
  readonly visitIdentity: CanonicalVisitIdentityV1;
  readonly workspaceBrandReference: CanonicalVisitWorkspaceBrandReferenceV1;
  readonly customerPropertyDetails: CanonicalVisitCustomerPropertyDetailsV1;
  readonly surveyDraft: FullSurveyModelV1;
  readonly scanEvidenceRefs?: unknown;
  readonly engineInputSnapshot?: EngineInputV2_3;
  readonly proposalTruth?: CanonicalVisitProposalTruthV1;
  readonly generatedOutputStatus?: CanonicalVisitGeneratedOutputStatusV1;
  readonly importExportMetadata: CanonicalVisitImportExportMetadataV1;
}
