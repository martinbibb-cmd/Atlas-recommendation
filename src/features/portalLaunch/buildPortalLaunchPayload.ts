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

const REBUILD_WARNING_OLDER_PACKAGE =
  'This package was exported before the customer journey pack was generated. ' +
  'The portal will rebuild journey content from the recommendation data.';

export function buildPortalLaunchPayload(pkg: CanonicalVisitPackageV1): PortalLaunchPayloadV1 {
  const generatedOutputs = pkg.generatedOutputStatus?.generatedOutputs;
  const customerJourneyPack = readCustomerJourneyPackFromGeneratedOutputs(generatedOutputs);
  const hasCustomerJourneyPack = customerJourneyPack != null;

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
    rebuildWarning: !hasCustomerJourneyPack ? REBUILD_WARNING_OLDER_PACKAGE : undefined,
    selectedScenarioId: pkg.proposalTruth?.selectedScenarioId,
    portalVisitContext: pkg.customerPropertyDetails.portalVisitContext,
    generatedOutputMetadata: {
      hasPortalUrl: false,
      portalUrl: undefined,
      hasSupportingPdf: generatedOutputs?.pdf?.generated === true,
      lifecycleState: pkg.generatedOutputStatus?.lifecycleState,
    },
    builtAt: new Date().toISOString(),
    sourcePackageExportedAt: pkg.importExportMetadata.exportedAt,
  };
}
