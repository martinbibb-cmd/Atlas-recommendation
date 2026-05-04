/**
 * locationActions.ts
 *
 * Pure action helpers for managing `QuotePlanLocationV1` entries.
 *
 * Design rules:
 *   - All functions are pure and side-effect-free.
 *   - Scan-imported provenance is never silently modified — only explicit
 *     engineer actions change provenance/confidence.
 *   - `confirmLocation` promotes scan_inferred → scan_confirmed and clears
 *     needs_verification confidence only via an explicit engineer action.
 *   - `rejectLocation` is a soft-delete: rejected locations are retained as
 *     audit evidence with `rejected: true`.
 *   - No React dependencies — usable in reducers, tests, and non-React contexts.
 */

import type { QuotePlanLocationV1, QuotePlanLocationKind } from './QuoteInstallationPlanV1';
import type { QuoteJobType } from '../calculators/quotePlannerTypes';

// ─── Confidence badge display ─────────────────────────────────────────────────

/**
 * UI badge label for a location.
 *
 * Maps provenance + confidence to one of the five display labels:
 *   confirmed          — engineer has explicitly confirmed this location.
 *   measured           — scan-inferred with high confidence.
 *   estimated          — scan-inferred with medium or low confidence.
 *   needs verification — confidence is 'needs_verification' (any provenance).
 *   assumed            — manually added or unknown provenance.
 */
export type LocationBadgeLabel =
  | 'confirmed'
  | 'measured'
  | 'estimated'
  | 'needs verification'
  | 'assumed';

/**
 * Derives the display badge label for a location.
 *
 * Priority:
 *   1. `needs_verification` confidence → always "needs verification".
 *   2. `scan_confirmed` provenance     → "confirmed".
 *   3. `scan_inferred` high confidence → "measured".
 *   4. `scan_inferred` other           → "estimated".
 *   5. manual / unknown provenance     → "assumed".
 */
export function getLocationBadgeLabel(loc: QuotePlanLocationV1): LocationBadgeLabel {
  if (loc.confidence === 'needs_verification') return 'needs verification';
  if (loc.provenance === 'scan_confirmed')     return 'confirmed';
  if (loc.provenance === 'scan_inferred') {
    return loc.confidence === 'high' ? 'measured' : 'estimated';
  }
  return 'assumed';
}

// ─── Location kind labels ─────────────────────────────────────────────────────

/** Human-readable display labels for each location kind. */
export const LOCATION_KIND_LABELS: Record<QuotePlanLocationKind, string> = {
  proposed_boiler:  'Proposed boiler',
  existing_boiler:  'Existing boiler',
  gas_meter:        'Gas meter',
  flue_terminal:    'Flue terminal',
  cylinder:         'Cylinder / store',
  internal_waste:   'Internal waste',
  soil_stack:       'Soil stack',
  gully:            'Gully',
  soakaway:         'Soakaway',
  other:            'Other',
};

// ─── Required location groups ─────────────────────────────────────────────────

/**
 * A single required location slot in the job checklist.
 *
 * `kinds` accepts more than one kind when any of them satisfies the slot
 * (e.g. a condensate discharge point can be any of the drain kinds).
 */
export interface RequiredLocationSlot {
  /** Machine-readable key for this slot. */
  slotKey: string;
  /** Human-readable label for this slot in the checklist. */
  label: string;
  /** Location kind(s) that satisfy this slot. */
  kinds: QuotePlanLocationKind[];
}

/** Condensate / discharge option — any one of these drain kinds satisfies the slot. */
const CONDENSATE_SLOT: RequiredLocationSlot = {
  slotKey:  'condensate',
  label:    'Condensate / discharge point',
  kinds:    ['internal_waste', 'soil_stack', 'gully', 'soakaway'],
};

/**
 * Returns the ordered list of required location slots for the given job type.
 *
 * Mirrors the minimum-data rules from the problem statement:
 *   like_for_like         — existing boiler, proposed boiler, flue terminal, condensate option.
 *   relocation            — existing boiler, proposed boiler, gas meter, flue terminal, condensate.
 *   stored_hot_water_upgrade — proposed boiler, cylinder, gas meter, condensate.
 *   conversion / low_carbon_conversion / needs_review — proposed boiler, gas meter.
 */
export function getRequiredLocationSlots(
  jobType: QuoteJobType,
): RequiredLocationSlot[] {
  switch (jobType) {
    case 'like_for_like':
      return [
        { slotKey: 'existing_boiler',  label: 'Existing boiler',  kinds: ['existing_boiler'] },
        { slotKey: 'proposed_boiler',  label: 'Proposed boiler',  kinds: ['proposed_boiler'] },
        { slotKey: 'flue_terminal',    label: 'Flue terminal',    kinds: ['flue_terminal'] },
        CONDENSATE_SLOT,
      ];

    case 'relocation':
      return [
        { slotKey: 'existing_boiler',  label: 'Existing boiler',  kinds: ['existing_boiler'] },
        { slotKey: 'proposed_boiler',  label: 'Proposed boiler',  kinds: ['proposed_boiler'] },
        { slotKey: 'gas_meter',        label: 'Gas meter',        kinds: ['gas_meter'] },
        { slotKey: 'flue_terminal',    label: 'Flue terminal',    kinds: ['flue_terminal'] },
        CONDENSATE_SLOT,
      ];

    case 'stored_hot_water_upgrade':
      return [
        { slotKey: 'proposed_boiler',  label: 'Proposed boiler',  kinds: ['proposed_boiler'] },
        { slotKey: 'cylinder',         label: 'Cylinder / store', kinds: ['cylinder'] },
        { slotKey: 'gas_meter',        label: 'Gas meter',        kinds: ['gas_meter'] },
        CONDENSATE_SLOT,
      ];

    default:
      return [
        { slotKey: 'proposed_boiler',  label: 'Proposed boiler',  kinds: ['proposed_boiler'] },
        { slotKey: 'gas_meter',        label: 'Gas meter',        kinds: ['gas_meter'] },
      ];
  }
}

/**
 * Returns `true` when at least one active (non-rejected) location in the plan
 * satisfies the given slot.
 */
export function isSlotSatisfied(
  slot: RequiredLocationSlot,
  locations: QuotePlanLocationV1[],
): boolean {
  return locations.some(
    (loc) => !loc.rejected && (slot.kinds as string[]).includes(loc.kind),
  );
}

// ─── Location mutation helpers ────────────────────────────────────────────────

/**
 * Confirms a scan-imported location as reviewed and correct.
 *
 * Rules:
 *   - Provenance is set to 'scan_confirmed'.
 *   - Confidence is set to 'high' ONLY when it was 'needs_verification';
 *     existing non-needs_verification confidence is preserved verbatim.
 *   - Already-confirmed locations are returned as-is (idempotent).
 */
export function confirmLocation(loc: QuotePlanLocationV1): QuotePlanLocationV1 {
  const newConfidence =
    loc.confidence === 'needs_verification' ? 'high' : loc.confidence;
  return {
    ...loc,
    provenance:  'scan_confirmed',
    confidence:  newConfidence,
    rejected:    false,
  };
}

/**
 * Records that the engineer has manually moved a pin to a new position.
 *
 * Rules:
 *   - Provenance is set to 'manual' (engineer has overridden the scan position).
 *   - Confidence is preserved — movement does not change the data confidence.
 *   - `planCoord` is updated to the new position.
 *   - An optional note can be appended to the existing notes.
 */
export function moveLocation(
  loc: QuotePlanLocationV1,
  planCoord: { x: number; y: number },
  note?: string,
): QuotePlanLocationV1 {
  const updatedNotes =
    note != null
      ? [loc.notes, note].filter(Boolean).join(' | ')
      : loc.notes;
  return {
    ...loc,
    provenance: 'manual',
    planCoord,
    notes: updatedNotes,
  };
}

// Monotonic counter guarantees unique IDs even within the same millisecond.
let _locationIdCounter = 0;

/**
 * Creates a brand-new manually-placed location.
 *
 * Rules:
 *   - Provenance is 'manual'.
 *   - Confidence defaults to 'medium' (engineer-placed but not scan-measured).
 *   - A new locationId is generated from the kind + timestamp + counter.
 */
export function addManualLocation(
  kind: QuotePlanLocationKind,
  planCoord?: { x: number; y: number },
  note?: string,
): QuotePlanLocationV1 {
  const locationId = `loc-manual-${kind}-${Date.now()}-${++_locationIdCounter}`;
  return {
    locationId,
    kind,
    provenance:  'manual',
    confidence:  'medium',
    planCoord,
    notes:       note,
  };
}

/**
 * Marks a location as needing manual verification before it can be used.
 *
 * Rules:
 *   - Confidence is set to 'needs_verification'.
 *   - Provenance is NOT changed — the audit trail is preserved.
 *   - Already-marked locations are returned as-is (idempotent).
 */
export function markNeedsVerification(
  loc: QuotePlanLocationV1,
): QuotePlanLocationV1 {
  return { ...loc, confidence: 'needs_verification' };
}

/**
 * Soft-deletes a location by setting `rejected: true`.
 *
 * The location is retained in the array as audit evidence but excluded from
 * active plan logic.  Never physically removes the entry.
 */
export function rejectLocation(loc: QuotePlanLocationV1): QuotePlanLocationV1 {
  return { ...loc, rejected: true };
}

/**
 * Applies a mutation helper to the matching location in an array.
 *
 * Returns a new array — the original is not mutated.
 * Locations that do not match `locationId` are returned unchanged.
 */
export function applyToLocation(
  locations: QuotePlanLocationV1[],
  locationId: string,
  mutate: (loc: QuotePlanLocationV1) => QuotePlanLocationV1,
): QuotePlanLocationV1[] {
  return locations.map((loc) =>
    loc.locationId === locationId ? mutate(loc) : loc,
  );
}
