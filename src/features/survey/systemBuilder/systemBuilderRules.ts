/**
 * systemBuilderRules.ts
 *
 * Enforced pairing rules for the System Architecture step.
 *
 * Allowed combinations:
 *   regular       → open_vented | unvented | thermal_store
 *   system        → open_vented | unvented
 *   combi         → plate_hex
 *   storage_combi → small_store
 */

import type { HeatSource, DhwType, ControlFamily, SystemBuilderState } from './systemBuilderTypes';

// ─── Allowed pairings ─────────────────────────────────────────────────────────

export const ALLOWED_DHW_BY_HEAT_SOURCE: Record<HeatSource, DhwType[]> = {
  regular:       ['open_vented', 'unvented', 'thermal_store'],
  system:        ['open_vented', 'unvented'],
  combi:         ['plate_hex'],
  storage_combi: ['small_store'],
};

/**
 * Return the DHW options that are valid for the given heat source, or an empty
 * array when heatSource is null.
 */
export function getAllowedDhwTypes(heatSource: HeatSource | null): DhwType[] {
  if (heatSource === null) return [];
  return ALLOWED_DHW_BY_HEAT_SOURCE[heatSource];
}

/**
 * Return true when the (heatSource, dhwType) pair is a permitted combination.
 */
export function isDhwCompatible(
  heatSource: HeatSource | null,
  dhwType: DhwType | null,
): boolean {
  if (heatSource === null || dhwType === null) return false;
  return ALLOWED_DHW_BY_HEAT_SOURCE[heatSource].includes(dhwType);
}

/**
 * After changing the heat source, clear the existing DHW selection if it is no
 * longer valid.  Returns the (potentially cleared) DHW value.
 */
export function coerceDhwAfterHeatSourceChange(
  newHeatSource: HeatSource,
  currentDhw: DhwType | null,
): DhwType | null {
  if (currentDhw === null) return null;
  return ALLOWED_DHW_BY_HEAT_SOURCE[newHeatSource].includes(currentDhw) ? currentDhw : null;
}

// ─── Control family default ────────────────────────────────────────────────────

/**
 * When the heat source is combi, the integral timer/programmer is the natural
 * default control family.  For other types this is unknown until the surveyor
 * selects it.
 */
export function deriveDefaultControlFamily(heatSource: HeatSource | null): ControlFamily | null {
  if (heatSource === 'combi') return 'combi_integral';
  return null;
}

// ─── Completeness / submission gate ───────────────────────────────────────────

/**
 * Return true when enough of the System Builder has been filled in to allow the
 * step to be submitted.
 *
 * Mandatory: heatSource + dhwType + emitters.
 * Pipework / controls / asset-health fields are optional (can remain unknown).
 */
export function isSystemBuilderComplete(state: SystemBuilderState): boolean {
  return (
    state.heatSource !== null &&
    state.dhwType !== null &&
    isDhwCompatible(state.heatSource, state.dhwType) &&
    state.emitters !== null
  );
}
