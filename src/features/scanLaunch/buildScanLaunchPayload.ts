import type { CanonicalVisitPackageV1 } from '../visitPackage/CanonicalVisitPackageV1';
import {
  SCAN_LAUNCH_PAYLOAD_SCHEMA,
  SCAN_LAUNCH_PAYLOAD_VERSION,
  type ScanLaunchPayloadV1,
} from './ScanLaunchPayloadV1';

export function buildScanLaunchPayload(pkg: CanonicalVisitPackageV1): ScanLaunchPayloadV1 {
  return {
    schema: SCAN_LAUNCH_PAYLOAD_SCHEMA,
    version: SCAN_LAUNCH_PAYLOAD_VERSION,
    visitIdentity: {
      visitId: pkg.visitIdentity.visitId,
      visitReference: pkg.visitIdentity.visitReference,
      createdAt: pkg.visitIdentity.createdAt,
      updatedAt: pkg.visitIdentity.updatedAt,
    },
    workspaceBrandReference: pkg.workspaceBrandReference,
    customerPropertyDetails: pkg.customerPropertyDetails,
    surveyDraft: pkg.surveyDraft,
    scanEvidenceRefs: pkg.scanEvidenceRefs,
    importExportMetadata: pkg.importExportMetadata,
    builtAt: new Date().toISOString(),
  };
}
