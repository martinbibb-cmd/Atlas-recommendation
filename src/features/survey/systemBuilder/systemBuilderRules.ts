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

// ─── Control family narrowing ──────────────────────────────────────────────────

/**
 * Returns the set of control families that are contextually appropriate for
 * the given heat source and DHW type, split into primary (recommended) and
 * secondary (available but not typical) groups.
 *
 * Narrowing rules:
 *   combi              → primary: combi_integral; secondary: (none)
 *   regular/system +
 *     thermal_store    → primary: thermal_store; secondary: y_plan, s_plan, s_plan_plus
 *   regular/system +
 *     other cylinder   → primary: y_plan, s_plan, s_plan_plus; secondary: (none)
 *   storage_combi      → primary: combi_integral; secondary: (none)
 *   unknown / null     → all options available; no narrowing
 */
export function getNarrowedControlFamilies(
  heatSource: HeatSource | null,
  dhwType: DhwType | null,
): { primary: ControlFamily[]; secondary: ControlFamily[] } {
  if (heatSource === 'combi' || heatSource === 'storage_combi') {
    return {
      primary: ['combi_integral'],
      secondary: [],
    };
  }
  if ((heatSource === 'regular' || heatSource === 'system') && dhwType === 'thermal_store') {
    return {
      primary: ['thermal_store'],
      secondary: ['y_plan', 's_plan', 's_plan_plus', 'unknown'],
    };
  }
  if (heatSource === 'regular' || heatSource === 'system') {
    return {
      primary: ['y_plan', 's_plan', 's_plan_plus'],
      secondary: ['unknown'],
    };
  }
  // No heat source selected — all options, no narrowing
  return {
    primary: ['combi_integral', 'y_plan', 's_plan', 's_plan_plus', 'thermal_store', 'unknown'],
    secondary: [],
  };
}

// ─── Control family default ────────────────────────────────────────────────────

/**
 * When the heat source is combi or storage_combi, the integral timer/programmer
 * is the natural default control family.  For thermal_store DHW, thermal_store
 * controls are suggested.  For other types this is unknown until the surveyor
 * selects it.
 */
export function deriveDefaultControlFamily(
  heatSource: HeatSource | null,
  dhwType?: DhwType | null,
): ControlFamily | null {
  if (heatSource === 'combi' || heatSource === 'storage_combi') return 'combi_integral';
  if ((heatSource === 'regular' || heatSource === 'system') && dhwType === 'thermal_store') {
    return 'thermal_store';
  }
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
