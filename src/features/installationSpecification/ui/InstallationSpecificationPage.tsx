/**
 * InstallationSpecificationPage.tsx
 *
 * Page wrapper for the Atlas Installation Specification stepper.
 *
 * Acts as the route entry point.  Accepts an optional `seedProposedSystem`
 * prop so callers can pre-populate the proposed system from an Atlas
 * recommendation result.
 *
 * This page does NOT alter any recommendation decision or customer/safety flow.
 */

import { InstallationSpecificationStepper } from './InstallationSpecificationStepper';
import type { UiProposedSystemLabel } from './installationSpecificationUiTypes';

export interface InstallationSpecificationPageProps {
  /**
   * Called when the engineer exits the specification (Back on the first step).
   */
  onBack: () => void;
  /**
   * Optional proposed-system value seeded from the Atlas recommendation.
   * When provided, ProposedSystemStep pre-selects this tile and shows the
   * "Atlas Pick" badge.
   */
  seedProposedSystem?: UiProposedSystemLabel | null;
  /**
   * Optional floor-plan image URI from the scan session.
   * When provided, the Place Locations step shows the floor plan with an
   * interactive overlay.
   */
  floorPlanUri?: string;
}

export function InstallationSpecificationPage({ onBack, seedProposedSystem, floorPlanUri }: InstallationSpecificationPageProps) {
  return (
    <InstallationSpecificationStepper
      onBack={onBack}
      seedProposedSystem={seedProposedSystem}
      floorPlanUri={floorPlanUri}
    />
  );
}
