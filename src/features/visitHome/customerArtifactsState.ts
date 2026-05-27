import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import {
  buildPortalLaunchPayload,
  type PortalLaunchPayloadV1,
} from '../portalLaunch';
import type { CanonicalVisitPackageV1 } from '../visitPackage';
import { isArtifactStaleForActiveSnapshot } from '../../lib/storage/visitReviewLifecycle';

export interface VisitHomeCustomerArtifactsStateInput {
  readonly canExportVisitPackage: boolean;
  readonly sourcePackage?: CanonicalVisitPackageV1;
  readonly unavailableReasons?: readonly string[];
}

export interface VisitHomeCustomerArtifactsState {
  readonly customerPdfReady: boolean;
  readonly customerPdfBlockReasons: readonly string[];
  readonly customerOutputReadiness: {
    readonly customerJourneyPackStatus: 'ready' | 'needs-review' | 'blocked';
    readonly customerPdfStatus: 'ready' | 'needs-review' | 'blocked';
  };
  readonly canOpenPortalFromPackage: boolean;
  readonly portalLaunchPayload?: PortalLaunchPayloadV1;
}

export function buildVisitHomeCustomerArtifactsState(
  input: VisitHomeCustomerArtifactsStateInput,
): VisitHomeCustomerArtifactsState {
  const portalLaunchPayload = input.sourcePackage != null
    ? buildPortalLaunchPayload(input.sourcePackage)
    : undefined;
  const activeSnapshotId = input.sourcePackage?.recommendationAuthority?.snapshotId
    ?? input.sourcePackage?.importExportMetadata.recommendationSnapshot?.snapshotId;
  const pdfStale = isArtifactStaleForActiveSnapshot(
    input.sourcePackage?.generatedOutputStatus?.generatedOutputs?.pdf,
    activeSnapshotId,
  );
  const customerPdfBlockReasons = input.canExportVisitPackage
    ? []
    : [...(input.unavailableReasons ?? [])];
  const customerJourneyPackGenerated =
    input.sourcePackage?.generatedOutputStatus?.generatedOutputs?.customerJourneyPack?.generated === true;
  const customerJourneyPackPayload = input.sourcePackage?.generatedOutputStatus?.generatedOutputs?.customerJourneyPack?.payload;
  const customerJourneyPackBlocked =
    customerJourneyPackPayload?.staticPdf?.recommendationViabilityState === 'blocked'
    || customerJourneyPackPayload?.staticPdf?.contentSource?.fallbackOnly === true;
  const customerJourneyPackStatus = customerJourneyPackGenerated
    ? (customerJourneyPackBlocked ? 'blocked' : 'ready')
    : input.canExportVisitPackage
    ? 'needs-review'
    : 'blocked';
  if (customerJourneyPackBlocked) {
    customerPdfBlockReasons.push(
      'Customer journey pack is generated but blocked by journey validation checks.',
    );
  }
  const packagedHpBlocked =
    input.sourcePackage?.generatedOutputStatus?.generatedOutputs?.customerJourneyPack?.payload?.staticPdf?.recommendationViabilityState === 'blocked';
  if (packagedHpBlocked) {
    customerPdfBlockReasons.push(
      'Customer heat-pump educational pack is blocked because HP viability is blocked for this visit.',
    );
  }
  if (pdfStale) {
    customerPdfBlockReasons.push(
      'Customer PDF artifact is stale for the active recommendation snapshot. Regeneration required.',
    );
  }
  if (customerJourneyPackStatus !== 'ready' && input.canExportVisitPackage) {
    customerPdfBlockReasons.push(
      'Customer journey pack is not ready; customer PDF cannot be marked ready yet.',
    );
  }
  const customerPdfReady = input.canExportVisitPackage
    && customerJourneyPackStatus === 'ready'
    && !pdfStale
    && !packagedHpBlocked;
  const customerPdfStatus = customerPdfReady
    ? 'ready'
    : input.canExportVisitPackage
    ? 'needs-review'
    : 'blocked';

  return {
    customerPdfReady,
    customerPdfBlockReasons,
    customerOutputReadiness: {
      customerJourneyPackStatus,
      customerPdfStatus,
    },
    canOpenPortalFromPackage: portalLaunchPayload?.hasCustomerJourneyPack === true,
    portalLaunchPayload,
  };
}

export function resolvePackagedPortalEngineInput(input: {
  readonly liveEngineInput?: EngineInputV2_3;
  readonly sourcePackage?: CanonicalVisitPackageV1;
}): EngineInputV2_3 | undefined {
  return input.liveEngineInput ?? input.sourcePackage?.engineInputSnapshot;
}
