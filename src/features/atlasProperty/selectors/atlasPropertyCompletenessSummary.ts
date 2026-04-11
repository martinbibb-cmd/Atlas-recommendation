/**
 * atlasPropertyCompletenessSummary.ts
 *
 * Derives a completeness report from a partial AtlasPropertyV1, telling the
 * caller which sections have enough data for the engine to run and which need
 * further input.
 *
 * This is a read-only selector — it never mutates the property.
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { AtlasPropertyCompletenessSummary } from '../types/atlasPropertyAdapter.types';

// ─── Field unwrap helper ──────────────────────────────────────────────────────

function hasValue(fv: { value: unknown } | undefined): boolean {
  return fv != null && fv.value != null;
}

// ─── Main selector ────────────────────────────────────────────────────────────

/**
 * Produces a completeness summary for a (potentially partial) AtlasPropertyV1.
 *
 * The `readyForSimulation` flag is true when all of the following hold:
 *  - `property.postcode` is set
 *  - `household.composition.adultCount` is set
 *  - `currentSystem.family` is set
 *  - either `derived.heatLoss.peakWatts` is set (preferred), or
 *    the building model has at least one room (fallback)
 *  - at least one hydraulic measurement is present
 *
 * @param property  The canonical property record to assess.
 * @returns         AtlasPropertyCompletenessSummary.
 */
export function atlasPropertyCompletenessSummary(
  property: Partial<AtlasPropertyV1>,
): AtlasPropertyCompletenessSummary {
  const missing: string[] = [];
  const highConf: string[] = [];

  // ── Property identity ──────────────────────────────────────────────────────

  const hasPostcode = Boolean(property.property?.postcode);
  if (!hasPostcode) {
    missing.push('property.postcode');
  } else {
    highConf.push('property.postcode');
  }

  // ── Household ─────────────────────────────────────────────────────────────

  const adultCountFv  = property.household?.composition?.adultCount;
  const hasHousehold  = hasValue(adultCountFv);
  if (!hasHousehold) {
    missing.push('household.composition.adultCount');
  } else {
    if (adultCountFv?.confidence === 'high') highConf.push('household.composition');
  }

  // ── Current system ────────────────────────────────────────────────────────

  const familyFv       = property.currentSystem?.family;
  const hasSystem      = hasValue(familyFv) && familyFv?.value !== 'unknown';
  if (!hasSystem) {
    missing.push('currentSystem.family');
  } else {
    if (familyFv?.confidence === 'high') highConf.push('currentSystem.family');
  }

  // ── Building ──────────────────────────────────────────────────────────────

  const hasBuilding = (property.building?.rooms?.length ?? 0) > 0;
  if (!hasBuilding) {
    missing.push('building.rooms');
  } else {
    highConf.push(`building.rooms (${property.building!.rooms!.length})`);
  }

  // ── Derived heat loss ─────────────────────────────────────────────────────

  const peakWattsFv  = property.derived?.heatLoss?.peakWatts;
  const hasHeatLoss  = hasValue(peakWattsFv);
  if (!hasHeatLoss) {
    missing.push('derived.heatLoss.peakWatts');
  } else {
    if (peakWattsFv?.confidence === 'high') highConf.push('derived.heatLoss.peakWatts');
  }

  // ── Derived hydraulics ────────────────────────────────────────────────────

  const dynPressureFv = property.derived?.hydraulics?.dynamicPressureBar;
  const flowFv        = property.derived?.hydraulics?.mainsFlowLpm;
  const hasHydraulics = hasValue(dynPressureFv) || hasValue(flowFv);
  if (!hasHydraulics) {
    missing.push('derived.hydraulics.dynamicPressureBar');
  } else {
    if (dynPressureFv?.confidence === 'high') highConf.push('derived.hydraulics.dynamicPressureBar');
    if (flowFv?.confidence === 'high')        highConf.push('derived.hydraulics.mainsFlowLpm');
  }

  // ── Overall readiness ─────────────────────────────────────────────────────

  // Engine can run with heat loss figure OR with building geometry present
  const hasHeatLossOrBuilding = hasHeatLoss || hasBuilding;

  const readyForSimulation =
    hasPostcode &&
    hasHousehold &&
    hasSystem &&
    hasHeatLossOrBuilding &&
    hasHydraulics;

  return {
    readyForSimulation,
    sections: {
      property:   hasPostcode,
      household:  hasHousehold,
      currentSystem: hasSystem,
      building:   hasBuilding,
      heatLoss:   hasHeatLoss,
      hydraulics: hasHydraulics,
    },
    missingFields:        missing,
    highConfidenceFields: highConf,
  };
}
