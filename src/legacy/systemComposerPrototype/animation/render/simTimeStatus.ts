/**
 * simTimeStatus — helpers for the sim-time-bar status badges.
 *
 * Extracted as pure functions so they can be unit-tested independently of
 * the LabCanvas render loop.
 */

/**
 * Return a short human-readable label for the current system type.
 * Used by the sim-time-bar to orient the user to the loaded system.
 */
export function systemTypeLabel(
  systemType: string,
  systemKind: string | undefined,
): string {
  if (systemKind === 'heat_pump') return 'Heat pump'
  if (systemType === 'vented_cylinder') return 'Vented cylinder'
  if (systemType === 'unvented_cylinder') return 'Unvented cylinder'
  return 'Combi boiler'
}

/**
 * Return a compact active-service label for the sim-time-bar status row.
 * Tells the user which service the boiler/system is currently delivering.
 *
 * Valid mode values: 'idle' | 'heating' | 'dhw_draw' | 'dhw_reheat' | 'heating_and_reheat'
 * Any unrecognised mode (including undefined coerced to string) returns 'Idle'.
 */
export function serviceModeSummary(mode: string): string {
  switch (mode) {
    case 'heating':             return 'CH'
    case 'dhw_draw':            return 'DHW'
    case 'dhw_reheat':          return 'Reheat'
    case 'heating_and_reheat':  return 'CH + Reheat'
    default:                    return 'Idle'
  }
}
