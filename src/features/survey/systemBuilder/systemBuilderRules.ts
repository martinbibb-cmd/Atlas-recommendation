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

// ─── Shower compatibility warnings ────────────────────────────────────────────

/**
 * Shower compatibility warning keys.
 *
 * Derived from the surveyed shower type to flag potential incompatibilities
 * that should be explained to the customer when the hot-water system changes.
 *
 *  'electric_unaffected'     — Electric shower is independent of the boiler hot-water
 *                              supply; a new boiler will not affect it.
 *  'pumped_gravity_unvented' — A pumped or gravity-fed shower relies on a cold-water
 *                              storage tank.  Moving to a mains-pressure (unvented)
 *                              system removes the tank, making the pump redundant or
 *                              damaging it.  The pump should be removed or bypassed.
 *  'mixer_balanced_supply'   — Mixer and thermostatic showers need balanced hot/cold
 *                              supply pressures.  Mains-fed systems work well, but
 *                              a thermostatic cartridge may need replacing if the
 *                              pressure balance changes significantly.
 */
export type ShowerCompatibilityWarningKey =
  | 'electric_unaffected'
  | 'pumped_gravity_unvented'
  | 'mixer_balanced_supply'
  | null;

/** Human-readable copy for each shower compatibility warning. */
export const SHOWER_COMPATIBILITY_COPY: Record<
  Exclude<ShowerCompatibilityWarningKey, null>,
  { title: string; body: string }
> = {
  electric_unaffected: {
    title: 'Electric shower unaffected',
    body:  'An electric shower has its own in-line heating element and does not use the boiler hot-water supply.  Replacing or upgrading the boiler will not affect it.',
  },
  pumped_gravity_unvented: {
    title: 'Pumped/gravity shower — check before fitting mains-pressure system',
    body:  'A pumped or power shower relies on a cold-water storage tank in the loft.  Switching to a mains-pressure (unvented) cylinder removes that tank, making the pump redundant.  The pump must be removed or bypassed, and the shower head/valve may need replacing.',
  },
  mixer_balanced_supply: {
    title: 'Mixer shower needs balanced supply',
    body:  'A mixer or thermostatic shower requires hot and cold supplies at similar pressures.  Mains-fed systems work well here, but the thermostatic cartridge may need adjustment if the pressure balance changes significantly.',
  },
};

/**
 * Derive a shower compatibility warning from the surveyed shower type and
 * the selected current DHW type.
 *
 * Returns null when the shower type is unknown or there is no notable
 * compatibility consideration to communicate.
 */
export function deriveShowerCompatibilityWarning(
  state: SystemBuilderState,
): ShowerCompatibilityWarningKey {
  const { currentShowerType, electricShowerPresent, pumpedShowerPresent } = state;

  // Electric shower — always flag so the customer knows it is unaffected.
  if (currentShowerType === 'electric' || electricShowerPresent === true) {
    return 'electric_unaffected';
  }

  // Pumped/gravity showers — flag risk of incompatibility with unvented systems.
  if (
    currentShowerType === 'pumped_mixer' ||
    currentShowerType === 'power_shower' ||
    pumpedShowerPresent === true
  ) {
    return 'pumped_gravity_unvented';
  }

  // Mixer / thermostatic showers — flag balanced-supply requirement.
  if (currentShowerType === 'mixer' || currentShowerType === 'thermostatic') {
    return 'mixer_balanced_supply';
  }

  return null;
}
