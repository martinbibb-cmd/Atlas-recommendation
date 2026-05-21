export interface VisitHomeExportAvailabilityInput {
  readonly hasResolvedVisitId: boolean;
  readonly hasExportableSurvey: boolean;
  readonly hasActiveCanonicalPackage: boolean;
  readonly hasActiveVisitId: boolean;
  readonly hasCanonicalSnapshot: boolean;
  readonly hasRegeneratedDeliveryOutputs: boolean;
}

export function canShowVisitHomeExportPackageAction(
  input: VisitHomeExportAvailabilityInput,
): boolean {
  if (!input.hasResolvedVisitId || !input.hasExportableSurvey) {
    return false;
  }

  return input.hasActiveCanonicalPackage
    || input.hasActiveVisitId
    || input.hasCanonicalSnapshot
    || input.hasRegeneratedDeliveryOutputs;
}
