/**
 * InstallationSpecificationPage.tsx
 *
 * Page wrapper for the Atlas Installation Specification stepper.
 *
 * Acts as the route entry point.  Accepts an optional `seedProposedSystem`
 * prop so callers can pre-populate the proposed system from an Atlas
 * recommendation result, and an optional `canonicalCurrentSystem` prop so the
 * stepper can display the current installation from the canonical survey without
 * re-collecting it.
 *
 * This page does NOT alter any recommendation decision or customer/safety flow.
 */

import { InstallationSpecificationStepper } from './InstallationSpecificationStepper';
import type { UiProposedHeatSourceLabel, CanonicalCurrentSystemSummary } from './installationSpecificationUiTypes';
import type { ObjectPinV2 } from '../../scanImport/contracts/sessionCaptureV2';

export interface InstallationSpecificationPageProps {
  /**
   * Called when the surveyor exits the specification (Back on the first step).
   */
  onBack: () => void;
  /**
   * Called when the surveyor taps "Correct canonical survey".
   * Should navigate back to the survey flow — must not silently edit spec data.
   */
  onCorrectSurvey?: () => void;
  /**
   * Current system data from the canonical survey.
   * When provided, the first step shows a read-only summary of the existing
   * installation rather than asking the surveyor to re-enter it.
   */
  canonicalCurrentSystem?: CanonicalCurrentSystemSummary | null;
  /**
   * Optional proposed heat-source value seeded from the Atlas recommendation.
   * When provided, ProposedSystemStep pre-selects this tile and shows the
   * "Atlas selected" badge.
   */
  seedProposedSystem?: UiProposedHeatSourceLabel | null;
  /**
   * Optional floor-plan image URI from the scan session.
   * When provided, the Place Locations step shows the floor plan with an
   * interactive overlay.
   */
  floorPlanUri?: string;
  /**
   * Object pins captured during the scan session.
   * When provided, pins with recognised types are surfaced as suggestions
   * in the Place Locations step.
   */
  scanObjectPins?: ObjectPinV2[];
}

export function InstallationSpecificationPage({
  onBack,
  onCorrectSurvey,
  canonicalCurrentSystem,
  seedProposedSystem,
  floorPlanUri,
  scanObjectPins,
}: InstallationSpecificationPageProps) {
  return (
    <InstallationSpecificationStepper
      onBack={onBack}
      onCorrectSurvey={onCorrectSurvey}
      canonicalCurrentSystem={canonicalCurrentSystem}
      seedProposedSystem={seedProposedSystem}
      floorPlanUri={floorPlanUri}
      scanObjectPins={scanObjectPins}
    />
  );
}

