/**
 * buildShowerCompatibilityNotes.ts — Derives a structured shower compatibility
 * note from surveyed shower data.
 *
 * PR26 — Projection only.  No recommendation scoring.  No new survey fields.
 *
 * Output surfaces:
 *   - AtlasDecisionV1.compatibilityWarnings (customer summary string)
 *   - AtlasDecisionV1.showerCompatibilityNote (structured note for all surfaces)
 *   - VisualBlock warning block (via buildVisualBlocks)
 *   - Portal proof card (via buildPortalViewModel)
 *   - Engineer install note (via buildEngineerHandoff)
 */

import type { ShowerCompatibilityNote } from '../../contracts/ShowerCompatibilityNote';

// Re-export so callers only need one import
export type { ShowerCompatibilityNote };

/** Minimal shower survey inputs required to derive compatibility. */
export interface ShowerCompatibilityInput {
  /** Primary shower type captured during the survey. */
  currentShowerType?: string | null;
  /** Whether an electric shower is present (may coexist with other types). */
  electricShowerPresent?: boolean | null;
  /** Whether a pumped or power shower is present. */
  pumpedShowerPresent?: boolean | null;
}

/**
 * buildShowerCompatibilityNotes
 *
 * Returns a ShowerCompatibilityNote when the surveyed shower type carries
 * a compatibility consideration worth surfacing, or null when no note is
 * needed (unknown / none / multiple without a specific flag).
 *
 * Priority:
 *   1. Electric shower — always flag so the customer knows it is unaffected.
 *   2. Pumped / power shower — flag incompatibility with unvented systems.
 *   3. Mixer / thermostatic — flag balanced-supply requirement.
 */
export function buildShowerCompatibilityNotes(
  input: ShowerCompatibilityInput,
): ShowerCompatibilityNote | null {
  const { currentShowerType, electricShowerPresent, pumpedShowerPresent } = input;

  // Electric shower — independent of the boiler hot-water circuit
  if (currentShowerType === 'electric' || electricShowerPresent === true) {
    return {
      warningKey:      'electric_unaffected',
      customerSummary: 'Your electric shower is separate from the boiler hot-water system.',
      engineerNote:    'Electric shower is independent of the DHW system — no action required on the shower circuit.',
      severity:        'info',
    };
  }

  // Pumped / power shower — incompatible with mains-pressure unvented cylinders
  if (
    currentShowerType === 'pumped_mixer' ||
    currentShowerType === 'power_shower' ||
    pumpedShowerPresent === true
  ) {
    return {
      warningKey:      'pumped_gravity_unvented',
      customerSummary: 'This shower setup will need changing before an unvented cylinder can be fitted.',
      engineerNote:    'Pumped or power shower detected — remove or bypass the shower pump before commissioning the unvented cylinder; shower head or valve may also need replacing.',
      severity:        'important',
    };
  }

  // Mixer / thermostatic shower — balanced supply required
  if (currentShowerType === 'mixer' || currentShowerType === 'thermostatic') {
    return {
      warningKey:      'mixer_balanced_supply',
      customerSummary: 'The shower needs balanced hot and cold supplies.',
      engineerNote:    'Mixer or thermostatic shower fitted — verify balanced hot and cold supply pressures after commissioning; adjust or replace thermostatic cartridge if the pressure balance changes significantly.',
      severity:        'advisory',
    };
  }

  return null;
}
