import { describe, expect, it } from 'vitest';
import { canShowVisitHomeExportPackageAction } from '../visitHomeExportAvailability';

describe('canShowVisitHomeExportPackageAction', () => {
  it('shows export after package import', () => {
    expect(
      canShowVisitHomeExportPackageAction({
        hasResolvedVisitId: true,
        hasExportableSurvey: true,
        hasActiveCanonicalPackage: true,
        hasActiveVisitId: true,
        hasCanonicalSnapshot: true,
        hasRegeneratedDeliveryOutputs: false,
      }),
    ).toBe(true);
  });

  it('shows export after portal or pdf regeneration', () => {
    expect(
      canShowVisitHomeExportPackageAction({
        hasResolvedVisitId: true,
        hasExportableSurvey: true,
        hasActiveCanonicalPackage: false,
        hasActiveVisitId: true,
        hasCanonicalSnapshot: true,
        hasRegeneratedDeliveryOutputs: true,
      }),
    ).toBe(true);
  });

  it('shows export for a loaded local visit', () => {
    expect(
      canShowVisitHomeExportPackageAction({
        hasResolvedVisitId: true,
        hasExportableSurvey: true,
        hasActiveCanonicalPackage: false,
        hasActiveVisitId: true,
        hasCanonicalSnapshot: true,
        hasRegeneratedDeliveryOutputs: false,
      }),
    ).toBe(true);
  });

  it('hides export when visit identity or exportable survey is missing', () => {
    expect(
      canShowVisitHomeExportPackageAction({
        hasResolvedVisitId: false,
        hasExportableSurvey: true,
        hasActiveCanonicalPackage: true,
        hasActiveVisitId: false,
        hasCanonicalSnapshot: false,
        hasRegeneratedDeliveryOutputs: false,
      }),
    ).toBe(false);
    expect(
      canShowVisitHomeExportPackageAction({
        hasResolvedVisitId: true,
        hasExportableSurvey: false,
        hasActiveCanonicalPackage: true,
        hasActiveVisitId: true,
        hasCanonicalSnapshot: true,
        hasRegeneratedDeliveryOutputs: true,
      }),
    ).toBe(false);
  });
});
