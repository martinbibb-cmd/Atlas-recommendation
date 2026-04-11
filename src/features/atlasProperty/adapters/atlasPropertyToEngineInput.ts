/**
 * atlasPropertyToEngineInput.ts
 *
 * Bridges the canonical AtlasPropertyV1 into the existing EngineInputV2_3
 * contract consumed by the Atlas recommendation engine.
 *
 * Architecture note
 * ─────────────────
 * This is a derived translation — EngineInputV2_3 remains downstream and
 * derived from AtlasPropertyV1, not the other way around.  The engine still
 * receives what it needs, but the canonical truth stays in AtlasPropertyV1.
 *
 * Fields are read from:
 *   property            → postcode
 *   household           → householdComposition, occupancySignature, bathroomCount
 *   currentSystem       → boiler type, pipe size, DHW architecture
 *   building.services   → mains pressure / flow
 *   derived.heatLoss    → peakHeatLossKw
 *   derived.hydraulics  → dynamicPressure, flowRate
 *
 * Fallback strategy: missing or null FieldValue.value is treated as absent —
 * the engine's own default-fallback logic is preferred over guessing.
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { EngineInputV2_3, HouseholdComposition } from '../../../engine/schema/EngineInputV2_3';

// ─── Field-value unwrap helper ────────────────────────────────────────────────

function unwrap<T>(fv: { value: T | null } | undefined): T | undefined {
  if (fv == null) return undefined;
  return fv.value ?? undefined;
}

// ─── DHW storage type mapping ─────────────────────────────────────────────────

function mapDhwTypeToStorageType(
  dhwType: string | null | undefined,
): EngineInputV2_3['dhwStorageType'] {
  switch (dhwType) {
    case 'combi':              return 'none';
    case 'mixergy':            return 'mixergy';
    case 'vented_cylinder':    return 'vented';
    case 'unvented_cylinder':  return 'unvented';
    case 'thermal_store':      return 'thermal_store';
    default:                   return undefined;
  }
}

// ─── System boiler type mapping ───────────────────────────────────────────────

type EngineBoilerType = 'combi' | 'system' | 'regular' | 'back_boiler' | 'unknown';

function mapSystemFamilyToBoilerType(family: string | null | undefined): EngineBoilerType {
  switch (family) {
    case 'combi':   return 'combi';
    case 'system':  return 'system';
    case 'regular': return 'regular';
    default:        return 'unknown';
  }
}

// ─── Family to currentHeatSourceType mapping ──────────────────────────────────

function mapFamilyToHeatSourceType(
  family: string | null | undefined,
): EngineInputV2_3['currentHeatSourceType'] {
  switch (family) {
    case 'combi':     return 'combi';
    case 'system':    return 'system';
    case 'regular':   return 'regular';
    case 'heat_pump': return 'ashp';
    case 'hybrid':    return 'other';
    default:          return undefined;
  }
}

// ─── Occupancy signature derivation ──────────────────────────────────────────

function mapOccupancyPattern(
  pattern: string | null | undefined,
): EngineInputV2_3['occupancySignature'] {
  switch (pattern) {
    case 'usually_out':  return 'professional';
    case 'steady_home':  return 'steady_home';
    case 'mixed':        return 'shift_worker';
    default:             return 'steady_home';
  }
}

// ─── Main adapter ─────────────────────────────────────────────────────────────

/**
 * Derives a partial EngineInputV2_3 from a canonical AtlasPropertyV1.
 *
 * The returned object is a partial — engine fields are set only when the
 * canonical property has the necessary data.
 *
 * The caller is responsible for merging this result with any remaining engine
 * input fields before running the engine.
 *
 * @param property  The canonical AtlasPropertyV1.
 * @returns         A partial EngineInputV2_3 derived from canonical truth.
 */
export function atlasPropertyToEngineInput(
  property: AtlasPropertyV1,
): Partial<EngineInputV2_3> {
  const result: Partial<EngineInputV2_3> = {};

  // ── Property identity ──────────────────────────────────────────────────────

  if (property.property.postcode) {
    result.postcode = property.property.postcode;
  }

  // ── Household composition ──────────────────────────────────────────────────

  const comp = property.household.composition;
  const adultCount           = unwrap(comp.adultCount)              ?? 1;
  const childCount0to4       = unwrap(comp.childCount0to4)          ?? 0;
  const childCount5to10      = unwrap(comp.childCount5to10)         ?? 0;
  const childCount11to17     = unwrap(comp.childCount11to17)        ?? 0;
  const youngAdult18to25     = unwrap(comp.youngAdultCount18to25AtHome) ?? 0;

  const householdComposition: HouseholdComposition = {
    adultCount,
    childCount0to4,
    childCount5to10,
    childCount11to17,
    youngAdultCount18to25AtHome: youngAdult18to25,
  };
  result.householdComposition = householdComposition;

  // Derive occupancy count
  const totalOccupants = adultCount + childCount0to4 + childCount5to10 +
    childCount11to17 + youngAdult18to25;
  if (totalOccupants > 0) {
    result.occupancyCount = totalOccupants;
  }

  // ── Occupancy signature ────────────────────────────────────────────────────

  const occupancyPattern = unwrap(property.household.occupancyPattern);
  result.occupancySignature = mapOccupancyPattern(occupancyPattern);
  result.highOccupancy      = totalOccupants >= 4;

  // ── Hot water (bathroom count) ─────────────────────────────────────────────

  // A proper bathroomCount should be derived from spatial room counting once
  // the building model is populated.  Until then we default to 1 — the engine
  // will apply its own concurrency logic from bathroomCount + peakConcurrentOutlets.
  result.bathroomCount = 1;

  // ── DHW storage type ───────────────────────────────────────────────────────

  const dhwType = unwrap(property.currentSystem.dhwType);
  const dhwStorageType = mapDhwTypeToStorageType(dhwType);
  if (dhwStorageType != null) {
    result.dhwStorageType = dhwStorageType;
  }

  // ── Current boiler / system ────────────────────────────────────────────────

  const heatSource = property.currentSystem.heatSource;
  const familyValue = unwrap(property.currentSystem.family);
  const heatSourceType = mapFamilyToHeatSourceType(familyValue);
  if (heatSourceType != null) {
    result.currentHeatSourceType = heatSourceType;
  }

  if (heatSource) {
    const boilerType      = mapSystemFamilyToBoilerType(familyValue);
    const installYear     = unwrap(heatSource.installYear);
    const ageYears        = installYear != null
      ? new Date().getFullYear() - installYear
      : undefined;
    const nominalOutputKw = unwrap(heatSource.ratedOutputKw);

    result.currentSystem = {
      boiler: {
        type:          boilerType,
        ageYears,
        nominalOutputKw,
      },
    };
  }

  // ── Primary pipe diameter ──────────────────────────────────────────────────

  const pipeDiameterMm = unwrap(property.currentSystem.distribution?.dominantPipeDiameterMm);
  if (pipeDiameterMm != null) {
    const validPipeSizes = new Set([15, 22, 28, 35]);
    if (validPipeSizes.has(pipeDiameterMm)) {
      result.primaryPipeDiameter = pipeDiameterMm;
    }
  }

  // ── Heat loss (derived) ────────────────────────────────────────────────────

  const peakWatts = unwrap(property.derived?.heatLoss?.peakWatts);
  if (peakWatts != null) {
    result.heatLossWatts = peakWatts;
  }

  // ── Hydraulics (derived or measured) ──────────────────────────────────────

  const dynamicBar = unwrap(property.derived?.hydraulics?.dynamicPressureBar);
  const flowLpm    = unwrap(property.derived?.hydraulics?.mainsFlowLpm);

  if (dynamicBar != null) {
    result.dynamicMainsPressure    = dynamicBar;
    result.dynamicMainsPressureBar = dynamicBar;
  }
  if (flowLpm != null) {
    result.mainsDynamicFlowLpm = flowLpm;
  }

  // ── Cold water source ──────────────────────────────────────────────────────

  const services = property.building.services;
  if (services) {
    const mainsPressure = unwrap(services.water?.mainsPressure);
    if (mainsPressure != null) {
      result.coldWaterSource = mainsPressure ? 'mains_true' : 'unknown';
    }
  }

  return result;
}
