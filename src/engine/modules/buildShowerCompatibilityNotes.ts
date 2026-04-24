/**
 * buildShowerCompatibilityNotes.ts
 *
 * PR26 — Projects the surveyed shower type into structured compatibility notes
 * that are consumed by the decision layer, visual blocks, portal, and engineer
 * handoff surfaces.
 *
 * Rules:
 *  - No recommendation scoring — this is a projection-only helper.
 *  - Output is deterministic given the same input; no randomness.
 *  - Customer copy is short and practical (one sentence).
 *  - Engineer note is actionable (what to do on site).
 *  - Severity follows the install risk:
 *      electric   → info       (no action needed — shower is unaffected)
 *      mixer /
 *      thermostatic → advisory (balanced supplies needed; usually fine with unvented)
 *      pumped /
 *      power_shower → important (pump must be removed or bypassed)
 */

import type { CurrentShowerType } from '../../features/survey/systemBuilder/systemBuilderTypes';
import {
  deriveShowerCompatibilityWarning,
} from '../../features/survey/systemBuilder/systemBuilderRules';
import type { ShowerCompatibilityWarningKey } from '../../features/survey/systemBuilder/systemBuilderRules';

// ─── Output contract ──────────────────────────────────────────────────────────

export type ShowerCompatibilitySeverity = 'info' | 'advisory' | 'important';

/**
 * Structured shower compatibility note.
 *
 * warningKey      — machine-readable key for de-duplication.
 * customerSummary — one-sentence customer-facing copy.
 * engineerNote    — actionable install-time note for the engineer.
 * severity        — risk level used to style the visual block.
 */
export interface ShowerCompatibilityNote {
  warningKey: ShowerCompatibilityWarningKey;
  customerSummary: string;
  engineerNote: string;
  severity: ShowerCompatibilitySeverity;
}

// ─── Copy maps ────────────────────────────────────────────────────────────────

const CUSTOMER_SUMMARY: Record<Exclude<ShowerCompatibilityWarningKey, null>, string> = {
  electric_unaffected:
    'Your electric shower is separate from the boiler hot-water system.',
  pumped_gravity_unvented:
    'This shower setup will need changing before an unvented cylinder can be fitted.',
  mixer_balanced_supply:
    'The shower needs balanced hot and cold supplies.',
};

const ENGINEER_NOTE: Record<Exclude<ShowerCompatibilityWarningKey, null>, string> = {
  electric_unaffected:
    'Electric shower is independent of the DHW system — no action required for this shower during boiler or cylinder work.',
  pumped_gravity_unvented:
    'Remove or bypass the shower pump before commissioning the unvented cylinder; the cold-water storage tank the pump relies on will be removed. Shower head or valve may also need replacing.',
  mixer_balanced_supply:
    'Verify balanced hot and cold supply pressures at the shower mixing valve after commissioning. A pressure-reducing valve on the hot side may be needed if moving from gravity to mains-fed supply.',
};

const SEVERITY: Record<Exclude<ShowerCompatibilityWarningKey, null>, ShowerCompatibilitySeverity> =
  {
    electric_unaffected:     'info',
    pumped_gravity_unvented: 'important',
    mixer_balanced_supply:   'advisory',
  };

// ─── Input type ───────────────────────────────────────────────────────────────

/**
 * Minimal input required to derive shower compatibility notes.
 * Compatible with both EngineInputV2_3 extension and SystemBuilderState.
 */
export interface ShowerCompatibilityInput {
  currentShowerType?: CurrentShowerType | null;
  electricShowerPresent?: boolean | null;
  pumpedShowerPresent?: boolean | null;
}

// ─── Public helper ────────────────────────────────────────────────────────────

/**
 * buildShowerCompatibilityNotes
 *
 * Derives a structured ShowerCompatibilityNote from the surveyed shower data.
 * Returns null when there is no notable compatibility consideration (shower type
 * is unknown, none, or multiple with no dominant risk signal).
 */
export function buildShowerCompatibilityNotes(
  input: ShowerCompatibilityInput,
): ShowerCompatibilityNote | null {
  // Re-use the authoritative derivation from systemBuilderRules so that the
  // engine layer and the survey layer always agree on which warning applies.
  const warningKey = deriveShowerCompatibilityWarning({
    currentShowerType:    input.currentShowerType ?? null,
    electricShowerPresent: input.electricShowerPresent ?? null,
    pumpedShowerPresent:  input.pumpedShowerPresent ?? null,
    // The remaining SystemBuilderState fields are not needed for shower logic;
    // supply neutral defaults so the call compiles without a full state object.
    heatSource:            null,
    dhwType:               null,
    emitters:              null,
    primarySize:           null,
    layout:                null,
    controlFamily:         null,
    thermostatStyle:       null,
    programmerType:        null,
    boilerAgeYears:        null,
    sedbukBand:            null,
    serviceHistory:        null,
    heatingSystemType:     null,
    pipeworkAccess:        null,
    bleedWaterColour:      null,
    radiatorPerformance:   null,
    circulationIssues:     null,
    magneticFilter:        null,
    cleaningHistory:       null,
    cylinderAgeBand:       null,
    cylinderVolumeL:       null,
    cylinderInsulationType: null,
    cylinderCondition:     null,
    cylinderHasImmersion:  null,
  });

  if (warningKey === null) return null;

  return {
    warningKey,
    customerSummary: CUSTOMER_SUMMARY[warningKey],
    engineerNote:    ENGINEER_NOTE[warningKey],
    severity:        SEVERITY[warningKey],
  };
}
