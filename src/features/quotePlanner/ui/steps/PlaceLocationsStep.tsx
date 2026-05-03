/**
 * PlaceLocationsStep.tsx
 *
 * Step 4 of the Quote Planner: "Place the main items".
 *
 * Replaces the placeholder LocationsIntroStep.  Shows the floor-plan overlay
 * (or fallback list) with scan-imported candidate locations and a required-
 * location checklist that updates as the engineer confirms or adds points.
 *
 * UI copy (per problem statement):
 *   Heading:   "Place the main items"
 *   Subheading: "Atlas can use scan locations, but you stay in control."
 *   Hint:       "Confirm the points that are correct, move anything that
 *                needs adjusting."
 *
 * Design rules:
 *   - Does not output customer-facing copy.
 *   - Does not alter recommendation logic.
 *   - Rejected locations are kept as audit evidence and hidden from the UI.
 */

import { QuoteLocationPicker } from '../floorPlan/QuoteLocationPicker';
import {
  getRequiredLocationSlots,
  isSlotSatisfied,
} from '../../model/locationActions';
import type { QuotePlanLocationV1 } from '../../model/QuoteInstallationPlanV1';
import type { QuoteJobClassificationV1 } from '../../calculators/quotePlannerTypes';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface PlaceLocationsStepProps {
  /** Current location list from the plan draft. */
  locations: QuotePlanLocationV1[];
  /** Called whenever the engineer changes the location list. */
  onLocationsChange: (locations: QuotePlanLocationV1[]) => void;
  /** Optional floor-plan image URI (from the scan session). */
  floorPlanUri?: string;
  /** Current job classification — drives the required-location checklist. */
  jobClassification: QuoteJobClassificationV1;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlaceLocationsStep({
  locations,
  onLocationsChange,
  floorPlanUri,
  jobClassification,
}: PlaceLocationsStepProps) {
  const requiredSlots = getRequiredLocationSlots(jobClassification.jobType);

  return (
    <>
      <h2 className="qp-step-heading">Place the main items</h2>

      <p className="qp-step-subheading">
        Atlas can use scan locations, but you stay in control.
      </p>

      <p className="qp-context-hint">
        Confirm the points that are correct, move anything that needs adjusting.
      </p>

      <QuoteLocationPicker
        locations={locations}
        onLocationsChange={onLocationsChange}
        floorPlanUri={floorPlanUri}
      />

      <RequiredLocationChecklist
        slots={requiredSlots}
        locations={locations}
      />
    </>
  );
}

// ─── Required-location checklist ─────────────────────────────────────────────

import type { RequiredLocationSlot } from '../../model/locationActions';

interface RequiredLocationChecklistProps {
  slots: RequiredLocationSlot[];
  locations: QuotePlanLocationV1[];
}

function RequiredLocationChecklist({
  slots,
  locations,
}: RequiredLocationChecklistProps) {
  if (slots.length === 0) return null;

  return (
    <div className="ql-required-checklist" aria-label="Required locations checklist">
      <p className="ql-required-checklist__heading">Required for this job type</p>
      <ul className="ql-required-checklist__list">
        {slots.map((slot) => {
          const satisfied = isSlotSatisfied(slot, locations);
          return (
            <li
              key={slot.slotKey}
              className={`ql-required-item ${satisfied ? 'ql-required-item--done' : 'ql-required-item--missing'}`}
              aria-label={`${slot.label}: ${satisfied ? 'added' : 'missing'}`}
            >
              <span className="ql-required-item__icon" aria-hidden="true">
                {satisfied ? '✓' : '○'}
              </span>
              <span className="ql-required-item__label">{slot.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
