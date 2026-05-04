/**
 * PlaceLocationsStep.tsx
 *
 * Step 4 of the Installation Specification: "Place the main items".
 *
 * Replaces the placeholder LocationsIntroStep.  Shows the floor-plan overlay
 * (or fallback list) with scan-imported candidate locations and a required-
 * location checklist that updates as the engineer confirms or adds points.
 *
 * Scan-driven suggestions: when `scanObjectPins` is provided, pins whose
 * `objectType` maps to a recognised QuotePlanLocationKind are surfaced as
 * "Suggested Location" cards.  The engineer taps a suggestion to confirm it —
 * this creates a new `scan_inferred` + `needs_verification` location entry
 * that is then visible in the main location list.
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
 *   - Scan suggestions are never auto-promoted — the engineer must tap to confirm.
 */

import {
  LOCATION_KIND_LABELS,
  getRequiredLocationSlots,
  isSlotSatisfied,
} from '../../model/locationActions';
import type { RequiredLocationSlot } from '../../model/locationActions';
import { QuoteLocationPicker } from '../floorPlan/QuoteLocationPicker';
import type { QuotePlanLocationV1, QuotePlanLocationKind } from '../../model/QuoteInstallationPlanV1';
import type { QuoteJobClassificationV1 } from '../../calculators/quotePlannerTypes';
import type { ObjectPinV2, ObjectPinType } from '../../../scanImport/contracts/sessionCaptureV2';

// ─── ObjectPinType → QuotePlanLocationKind mapping ───────────────────────────

/**
 * Maps a scan `ObjectPinType` to the nearest `QuotePlanLocationKind`.
 * Returns null for pin types that have no installation-location equivalent.
 */
function objectPinTypeToLocationKind(
  objectType: ObjectPinType,
): QuotePlanLocationKind | null {
  switch (objectType) {
    case 'boiler':      return 'existing_boiler';
    case 'cylinder':    return 'cylinder';
    case 'gas_meter':   return 'gas_meter';
    case 'flue':        return 'flue_terminal';
    default:            return null;
  }
}

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
  /**
   * Object pins captured during the scan session.
   * When provided, pins with relevant types are surfaced as "Suggested Location"
   * cards that the engineer can confirm with a single tap.
   */
  scanObjectPins?: ObjectPinV2[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PlaceLocationsStep({
  locations,
  onLocationsChange,
  floorPlanUri,
  jobClassification,
  scanObjectPins,
}: PlaceLocationsStepProps) {
  const requiredSlots = getRequiredLocationSlots(jobClassification.jobType);

  // Derive which scan pins can be suggested (and have not already been added).
  const existingLocationIds = new Set(locations.map((l) => l.locationId));
  const suggestions: Array<{ pin: ObjectPinV2; kind: QuotePlanLocationKind }> =
    (scanObjectPins ?? []).flatMap((pin) => {
      const kind = objectPinTypeToLocationKind(pin.objectType);
      if (kind == null) return [];
      // Avoid suggesting a pin that was already added (by its pinId-derived locationId).
      const derivedId = `loc-scan-${pin.pinId}`;
      if (existingLocationIds.has(derivedId)) return [];
      return [{ pin, kind }];
    });

  function handleConfirmSuggestion(pin: ObjectPinV2, kind: QuotePlanLocationKind) {
    const derivedId = `loc-scan-${pin.pinId}`;
    const newLocation: QuotePlanLocationV1 = {
      locationId: derivedId,
      kind,
      provenance:  'scan_inferred',
      confidence:  'needs_verification',
      roomLabel:   pin.roomId,
      notes:       pin.label ?? undefined,
    };
    onLocationsChange([...locations, newLocation]);
  }

  return (
    <>
      <h2 className="qp-step-heading">Place the main items</h2>

      <p className="qp-step-subheading">
        Atlas can use scan locations, but you stay in control.
      </p>

      <p className="qp-context-hint">
        Confirm the points that are correct, move anything that needs adjusting.
      </p>

      {/* Scan-driven suggestions panel */}
      {suggestions.length > 0 && (
        <ScanSuggestionsPanel
          suggestions={suggestions}
          onConfirm={handleConfirmSuggestion}
        />
      )}

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

// ─── Scan suggestions panel ───────────────────────────────────────────────────

import { LOCATION_KIND_LABELS } from '../../model/locationActions';
import type { RequiredLocationSlot } from '../../model/locationActions';

interface ScanSuggestionsPanelProps {
  suggestions: Array<{ pin: ObjectPinV2; kind: QuotePlanLocationKind }>;
  onConfirm: (pin: ObjectPinV2, kind: QuotePlanLocationKind) => void;
}

function ScanSuggestionsPanel({ suggestions, onConfirm }: ScanSuggestionsPanelProps) {
  return (
    <div
      className="scan-suggestions-panel"
      aria-label="Scan-detected location suggestions"
      data-testid="scan-suggestions-panel"
    >
      <p className="scan-suggestions-panel__heading">
        📍 Suggested from scan — tap to confirm
      </p>
      <ul className="scan-suggestions-panel__list">
        {suggestions.map(({ pin, kind }) => {
          const kindLabel = LOCATION_KIND_LABELS[kind] ?? kind;
          const roomHint  = pin.roomId ? ` (${pin.roomId})` : '';
          const pinLabel  = pin.label ? ` — ${pin.label}` : '';
          return (
            <li
              key={pin.pinId}
              className="scan-suggestions-panel__item"
              data-testid={`scan-suggestion-${pin.pinId}`}
            >
              <span className="scan-suggestions-panel__label">
                {kindLabel}{pinLabel}{roomHint}
              </span>
              <button
                type="button"
                className="scan-suggestions-panel__confirm-btn"
                aria-label={`Confirm suggested ${kindLabel}`}
                onClick={() => onConfirm(pin, kind)}
              >
                Confirm
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── Required-location checklist ─────────────────────────────────────────────

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
