import type {
  CanonicalVisitCustomerPropertyDetailsV1,
  CanonicalVisitImportExportMetadataV1,
  CanonicalVisitWorkspaceBrandReferenceV1,
} from '../visitPackage/CanonicalVisitPackageV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';

export const SCAN_LAUNCH_PAYLOAD_SCHEMA = 'atlas.scan-launch-payload' as const;
export const SCAN_LAUNCH_PAYLOAD_VERSION = '1.0' as const;

export interface ScanLaunchVisitIdentityV1 {
  readonly visitId?: string;
  readonly visitReference?: string;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface ScanLaunchPayloadV1 {
  readonly schema: typeof SCAN_LAUNCH_PAYLOAD_SCHEMA;
  readonly version: typeof SCAN_LAUNCH_PAYLOAD_VERSION;
  /** Visit identity preserved from the canonical package. */
  readonly visitIdentity: ScanLaunchVisitIdentityV1;
  /** Workspace/brand context preserved for launch continuity. */
  readonly workspaceBrandReference: CanonicalVisitWorkspaceBrandReferenceV1;
  /** Customer/property context needed for scan capture continuity. */
  readonly customerPropertyDetails: CanonicalVisitCustomerPropertyDetailsV1;
  /** Existing survey draft that Scan may enrich with fresh evidence capture. */
  readonly surveyDraft: FullSurveyModelV1;
  /** Existing scan evidence references from the package, if present. */
  readonly scanEvidenceRefs?: unknown;
  /** Import/export metadata preserved from the source package. */
  readonly importExportMetadata: CanonicalVisitImportExportMetadataV1;
  /** ISO timestamp when payload was built. */
  readonly builtAt: string;
}
