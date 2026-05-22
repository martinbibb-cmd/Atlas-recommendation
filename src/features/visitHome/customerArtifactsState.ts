import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import {
  buildPortalLaunchPayload,
  type PortalLaunchPayloadV1,
} from '../portalLaunch';
import type { CanonicalVisitPackageV1 } from '../visitPackage';

export interface VisitHomeCustomerArtifactsStateInput {
  readonly canExportVisitPackage: boolean;
  readonly sourcePackage?: CanonicalVisitPackageV1;
  readonly unavailableReasons?: readonly string[];
}

export interface VisitHomeCustomerArtifactsState {
  readonly customerPdfReady: boolean;
  readonly customerPdfBlockReasons: readonly string[];
  readonly canOpenPortalFromPackage: boolean;
  readonly portalLaunchPayload?: PortalLaunchPayloadV1;
}

export function buildVisitHomeCustomerArtifactsState(
  input: VisitHomeCustomerArtifactsStateInput,
): VisitHomeCustomerArtifactsState {
  const portalLaunchPayload = input.sourcePackage != null
    ? buildPortalLaunchPayload(input.sourcePackage)
    : undefined;

  return {
    customerPdfReady: input.canExportVisitPackage,
    customerPdfBlockReasons: input.canExportVisitPackage
      ? []
      : [...(input.unavailableReasons ?? [])],
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
