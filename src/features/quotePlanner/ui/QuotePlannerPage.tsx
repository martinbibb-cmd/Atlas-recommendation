/**
 * QuotePlannerPage.tsx
 *
 * Page wrapper for the Atlas Quote Planner stepper.
 *
 * Acts as the route entry point.  Accepts an optional `seedProposedSystem`
 * prop so callers can pre-populate the proposed system from an Atlas
 * recommendation result.
 *
 * This page does NOT alter any recommendation decision or customer/safety flow.
 */

import { QuotePlannerStepper } from './QuotePlannerStepper';
import type { UiProposedSystemLabel } from './quotePlannerUiTypes';

export interface QuotePlannerPageProps {
  /**
   * Called when the engineer exits the planner (Back on the first step).
   */
  onBack: () => void;
  /**
   * Optional proposed-system value seeded from the Atlas recommendation.
   * When provided, ProposedSystemStep pre-selects this tile and shows the
   * "Atlas Pick" badge.
   */
  seedProposedSystem?: UiProposedSystemLabel | null;
}

export function QuotePlannerPage({ onBack, seedProposedSystem }: QuotePlannerPageProps) {
  return (
    <QuotePlannerStepper
      onBack={onBack}
      seedProposedSystem={seedProposedSystem}
    />
  );
}
