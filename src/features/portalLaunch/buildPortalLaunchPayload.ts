/**
 * buildPortalLaunchPayload.ts
 *
 * Constructs a PortalLaunchPayloadV1 from a CanonicalVisitPackageV1.
 *
 * The builder reads the packaged CustomerJourneyPackV1 from the canonical
 * package's generated output registry. When the pack is present the payload
 * is launch-ready. When it is absent rebuildRequired is set to true and
 * rebuildWarning describes what the portal must do before presenting the
 * customer journey.
 */

import {
  PORTAL_LAUNCH_PAYLOAD_SCHEMA,
  PORTAL_LAUNCH_PAYLOAD_VERSION,
  type PortalLaunchPayloadV1,
} from './PortalLaunchPayloadV1';
import type { CanonicalVisitPackageV1 } from '../visitPackage/CanonicalVisitPackageV1';
import { readCustomerJourneyPackFromGeneratedOutputs } from '../../library/portal/pdf/buildPortalJourneyPrintModel';
import { isArtifactStaleForActiveSnapshot } from '../../lib/storage/visitReviewLifecycle';

const REBUILD_WARNING_OLDER_PACKAGE =
  'This package was exported before the customer journey pack was generated. ' +
  'The portal will rebuild journey content from the recommendation data.';

export function buildPortalLaunchPayload(pkg: CanonicalVisitPackageV1): PortalLaunchPayloadV1 {
  const generatedOutputs = pkg.generatedOutputStatus?.generatedOutputs;
  const activeSnapshotId =
    pkg.recommendationAuthority?.snapshotId
    ?? pkg.importExportMetadata.recommendationSnapshot?.snapshotId;
  const customerJourneyPackArtifact = generatedOutputs?.customerJourneyPack;
  const customerJourneyPack = readCustomerJourneyPackFromGeneratedOutputs(generatedOutputs);
  const staleSnapshotBlocked = isArtifactStaleForActiveSnapshot(customerJourneyPackArtifact, activeSnapshotId);
  const hasCustomerJourneyPack = customerJourneyPack != null && !staleSnapshotBlocked;

  return {
    schema: PORTAL_LAUNCH_PAYLOAD_SCHEMA,
    version: PORTAL_LAUNCH_PAYLOAD_VERSION,
    visitIdentity: {
      visitId: pkg.visitIdentity.visitId,
      visitReference: pkg.visitIdentity.visitReference,
    },
    customerJourneyPack,
    hasCustomerJourneyPack,
    rebuildRequired: !hasCustomerJourneyPack,
    rebuildWarning: !hasCustomerJourneyPack
      ? staleSnapshotBlocked
        ? 'Packaged customer journey is stale for the active recommendation snapshot. Regenerate recommendation outputs.'
        : REBUILD_WARNING_OLDER_PACKAGE
      : undefined,
    selectedScenarioId: pkg.proposalTruth?.selectedScenarioId,
    portalVisitContext: pkg.customerPropertyDetails.portalVisitContext,
    generatedOutputMetadata: {
      hasPortalUrl: false,
      portalUrl: undefined,
      hasSupportingPdf: generatedOutputs?.pdf?.generated === true,
      lifecycleState: pkg.generatedOutputStatus?.lifecycleState,
      activeRecommendationSnapshotId: activeSnapshotId,
      customerJourneyPackSnapshotId: customerJourneyPackArtifact?.snapshotId,
      staleSnapshotBlocked,
    },
    builtAt: new Date().toISOString(),
    sourcePackageExportedAt: pkg.importExportMetadata.exportedAt,
  };
}
