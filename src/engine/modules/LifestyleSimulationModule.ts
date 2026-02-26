import type {
  EngineInputV2_3,
  LifestyleResult,
  OccupancyHour,
  OccupancySignature,
  BuildingMass,
} from '../schema/EngineInputV2_3';

type HourlyProfile = { demand: number; label: string }[];

// ── Professional profile demand constants ─────────────────────────────────────
/** Demand fraction at the exact 07:00 and 18:00 double-peak hours. */
const PROFESSIONAL_PEAK_DEMAND = 0.95;
/** Demand fraction for the morning shoulder (06:00–08:00, excluding 07:00). */
const PROFESSIONAL_MORNING_SHOULDER_DEMAND = 0.75;
/** Demand fraction for the evening shoulder (17:00–22:00, excluding 18:00). */
const PROFESSIONAL_EVENING_SHOULDER_DEMAND = 0.70;

// ── Dynamic thermal model constants ──────────────────────────────────────────

/** UK design outdoor temperature (°C) — SAP 2012 design point. */
export const DESIGN_OUTDOOR_TEMP_C = -3;

/** UK design indoor temperature (°C). */
const DESIGN_INDOOR_TEMP_C = 21;

/** Design ΔT (K) used to derive UA coefficient from heat-loss data. */
const DESIGN_DELTA_T_K = DESIGN_INDOOR_TEMP_C - DESIGN_OUTDOOR_TEMP_C; // 24 K

/** Seconds per hour — used to scale kJ/K thermal capacity to kW power step. */
const SECONDS_PER_HOUR = 3600;

/**
 * Effective thermal capacity of the building fabric (kJ/K), keyed by BuildingMass.
 *
 * Represents the lumped-capacitance C_building in the first-order model:
 *   T_room[t+1] = T_room[t] + (Q_plant[t] − Q_loss[t]) × dt / C_building
 *
 * The τ values quoted are approximate time constants (τ = C / UA) at a typical
 * UA of 0.33 kW/K (8 kW heat loss at 24 K design ΔT).
 *
 * References: CIBSE Guide A Table 5.13 effective thermal admittance; BRE IP14/88.
 */
const C_BUILDING_KJ_PER_K: Record<BuildingMass, number> = {
  light:  20_000, // timber frame / cavity block  (C ≈ 20 MJ/K, τ ≈ 17 h at typical UA)
  medium: 50_000, // 1970s cavity wall semi        (C ≈ 50 MJ/K, τ ≈ 42 h at typical UA)
  heavy: 100_000, // 1930s solid brick             (C ≈ 100 MJ/K, τ ≈ 83 h at typical UA)
};

/**
 * Boiler sprint power (kW) — rapid reheat from cold.
 * When demand fraction exceeds the sprint threshold, the boiler fires at full
 * output; otherwise it is off (stepped curve, not modulating).
 */
const BOILER_SPRINT_KW = 30;

/** Demand fraction threshold above which the boiler fires at BOILER_SPRINT_KW. */
const BOILER_FIRE_THRESHOLD = 0.3;

/**
 * Professional: double-peak demand at 07:00 and 18:00 (V3 spec).
 * Boiler wins: high reheat power (30kW) for stepped Hive/Nest profiles.
 * The 07:00 and 18:00 hours receive the highest demand to model the
 * precise double-peak that proves boiler superiority for this lifestyle.
 */
function professionalProfile(): HourlyProfile {
  return Array.from({ length: 24 }, (_, h) => {
    if (h === 7) return { demand: PROFESSIONAL_PEAK_DEMAND, label: 'morning_peak' };   // 07:00 peak
    if (h === 18) return { demand: PROFESSIONAL_PEAK_DEMAND, label: 'evening_peak' };  // 18:00 peak
    if (h >= 6 && h <= 8) return { demand: PROFESSIONAL_MORNING_SHOULDER_DEMAND, label: 'morning_peak' };
    if (h >= 17 && h <= 22) return { demand: PROFESSIONAL_EVENING_SHOULDER_DEMAND, label: 'evening_peak' };
    if (h >= 9 && h <= 16) return { demand: 0.05, label: 'away' };
    return { demand: 0.1, label: 'night' };
  });
}

/**
 * Steady Home: continuous occupancy (retired/family)
 * ASHP wins: "low and slow" 24/7 equilibrium, exploits building thermal mass
 */
function steadyHomeProfile(): HourlyProfile {
  return Array.from({ length: 24 }, (_, h) => {
    if (h >= 23 || h <= 5) return { demand: 0.4, label: 'sleep_setback' };
    return { demand: 0.65, label: 'occupied' };
  });
}

/**
 * Shift Worker: irregular demand / offset sleep cycles
 * Stored water wins: prevents DHW/space heating competition latency
 */
function shiftWorkerProfile(): HourlyProfile {
  return Array.from({ length: 24 }, (_, h) => {
    // Offset peak by 4 hours compared to professional
    if (h >= 10 && h <= 12) return { demand: 0.9, label: 'offset_morning' };
    if (h >= 21 && h <= 23) return { demand: 0.8, label: 'offset_evening' };
    if (h >= 0 && h <= 2) return { demand: 0.7, label: 'late_night_active' };
    return { demand: 0.2, label: 'variable_idle' };
  });
}

function getProfile(signature: OccupancySignature): HourlyProfile {
  switch (signature) {
    case 'professional': return professionalProfile();
    case 'steady_home':
    case 'steady':       return steadyHomeProfile();
    case 'shift_worker':
    case 'shift':        return shiftWorkerProfile();
  }
}

function getRecommendedSystem(signature: OccupancySignature): LifestyleResult['recommendedSystem'] {
  switch (signature) {
    case 'professional': return 'boiler';
    case 'steady_home':
    case 'steady':       return 'ashp';
    case 'shift_worker':
    case 'shift':        return 'stored_water';
  }
}

/**
 * Build the 24-hour dynamic room-temperature trace using the first-order model:
 *
 *   T_room[t+1] = T_room[t] + (Q_plant[t] − Q_loss[t]) × dt / C_building
 *
 * where:
 *   Q_loss[t] = UA × (T_room[t] − T_outdoor)   [kW]
 *   UA = heatLossKw / DESIGN_DELTA_T_K           [kW/K]
 *   dt = 3600 s
 *   C_building in kJ/K
 *
 * Assumption: T_outdoor is fixed at DESIGN_OUTDOOR_TEMP_C (−3 °C, SAP 2012
 * design point).  This is appropriate for sizing/comparison purposes but will
 * underestimate temperatures when actual outdoor temps are milder.
 *
 * @param profile   Hourly demand fraction array (length 24).
 * @param plantKwFn Maps (hour, demandFraction) → plant output kW for this system.
 * @param heatLossKw Design heat loss at standard conditions (kW).
 * @param cBuilding  Effective thermal capacity of the building fabric (kJ/K).
 * @param outdoorTempC Optional outdoor temperature override (°C).
 *                     Defaults to DESIGN_OUTDOOR_TEMP_C (−3 °C, SAP 2012 design point).
 *                     Provide a different value to model milder conditions or run tests
 *                     with arbitrary boundary conditions without refactoring call sites.
 * @returns Array of 24 room temperatures (°C, 1 d.p.).
 */
export function buildDynamicRoomTrace(
  profile: HourlyProfile,
  plantKwFn: (h: number, demand: number) => number,
  heatLossKw: number,
  cBuilding: number,
  outdoorTempC: number = DESIGN_OUTDOOR_TEMP_C,
): number[] {
  const UA = heatLossKw / DESIGN_DELTA_T_K; // kW/K
  let roomTemp = DESIGN_INDOOR_TEMP_C;
  return profile.map((hour, h) => {
    const qPlant = plantKwFn(h, hour.demand);
    const qLoss  = UA * (roomTemp - outdoorTempC);
    roomTemp += (qPlant - qLoss) * SECONDS_PER_HOUR / cBuilding;
    // Soft-clamp to physically plausible indoor range
    roomTemp = Math.min(26, Math.max(10, roomTemp));
    return parseFloat(roomTemp.toFixed(1));
  });
}

export function runLifestyleSimulationModule(input: EngineInputV2_3): LifestyleResult {
  const profile = getProfile(input.occupancySignature);
  const heatLossKw = input.heatLossWatts / 1000;
  const cBuilding = C_BUILDING_KJ_PER_K[input.buildingMass];

  // ── Dynamic room traces ──────────────────────────────────────────────────
  // Boiler: steps at BOILER_SPRINT_KW when demand ≥ threshold, else off.
  const boilerRoomTrace = buildDynamicRoomTrace(
    profile,
    (_h, demand) => demand >= BOILER_FIRE_THRESHOLD ? BOILER_SPRINT_KW : 0,
    heatLossKw,
    cBuilding,
  );

  // ASHP: modulates proportionally — "low and slow", flat horizon.
  const ashpRoomTrace = buildDynamicRoomTrace(
    profile,
    (_h, demand) => demand * heatLossKw,
    heatLossKw,
    cBuilding,
  );

  const hourlyData: OccupancyHour[] = profile.map((hour, h) => {
    const demandKw = hour.demand * heatLossKw;

    // Legacy proxy fields retained for backward compatibility with existing UI renderers.
    // Boiler: rapid response but sharp temperature swings (affine proxy)
    const boilerTempC = 18 + hour.demand * 4;

    // ASHP: flat "horizon" line, slow response, exploits building mass
    const heatPumpTempC = 19.5 + Math.sin((h / 24) * Math.PI) * 0.5;

    // Stored water: stable but peaks delayed
    const storedWaterTempC = 19 + (hour.demand > 0.6 ? 1.5 : 0);

    return {
      hour: h,
      demandKw,
      boilerTempC,
      heatPumpTempC,
      storedWaterTempC,
      boilerRoomTempC: boilerRoomTrace[h],
      ashpRoomTempC: ashpRoomTrace[h],
    };
  });

  const recommendedSystem = getRecommendedSystem(input.occupancySignature);

  const systemDescriptions: Record<typeof recommendedSystem, string> = {
    boiler:
      '🔥 Boiler Recommended: High reheat power (30kW) raises temperature 3°C in 30 mins, ' +
      'matching Hive/Nest stepped profiles for double-peak professional lifestyle.',
    ashp:
      '🌿 ASHP Recommended: "Low and slow" 24/7 equilibrium line exploits building ' +
      'thermal mass (τ) as a thermal battery for continuous occupancy.',
    stored_water:
      '🚿 Stored Water Recommended: Prevents combi "Service Switching" latency where ' +
      'DHW and space heating compete during irregular demand patterns.',
  };

  return {
    signature: input.occupancySignature,
    recommendedSystem,
    hourlyData,
    notes: [systemDescriptions[recommendedSystem]],
  };
}
