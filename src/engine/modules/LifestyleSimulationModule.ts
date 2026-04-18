import type {
  EngineInputV2_3,
  LifestyleResult,
  OccupancyHour,
  OccupancySignature,
  BuildingMass,
} from '../schema/EngineInputV2_3';
import { resolveTimingOverrides } from '../schema/OccupancyPreset';

type HourlyProfile = { demand: number; label: string }[];

// ── Professional profile demand constants ─────────────────────────────────────
/** Demand fraction at the exact 07:00 and 18:00 double-peak hours. */
const PROFESSIONAL_PEAK_DEMAND = 0.95;
/** Demand fraction for the morning shoulder (06:00–08:00, excluding 07:00). */
const PROFESSIONAL_MORNING_SHOULDER_DEMAND = 0.75;
/** Demand fraction for the evening shoulder (17:00–22:00, excluding 18:00). */
const PROFESSIONAL_EVENING_SHOULDER_DEMAND = 0.70;

// ── DHW demand constants ──────────────────────────────────────────────────────

/**
 * Hourly-average equivalent DHW draw per person during a 1-hour peak window (kW).
 *
 * Derivation (10-min shower basis):
 *   Instantaneous power = (Cp/60) × 8 L/min × ~27 °C rise (15 °C cold → 40 °C mixed)
 *                       ≈ 0.0697 × 8 × 27 ≈ 15 kW (instantaneous while shower runs)
 *   Energy per shower   = 15 kW × (10/60 h) ≈ 2.5 kWh
 *   Hourly average      = 2.5 kWh / 1 h     = 2.5 kW
 *
 * This is therefore the time-weighted average over the 1-hour peak slot, NOT the
 * instantaneous boiler/heat-pump output during the draw.  Consistent with
 * BehaviourTimelineBuilder DHW profile and SAP daily hot-water demand figures.
 *
 * Note: at 2 occupants this gives dhwKw = 5 kW for the morning peak hour — an
 * appropriate order-of-magnitude for a standard 2-person household shower peak.
 */
export const DHW_KW_PER_PERSON = 2.5;

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
 * Boiler wins: high reheat power (30kW) for stepped thermostat profiles.
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

// ── Stored cylinder simulation constants ─────────────────────────────────────

/** Nominal cylinder volume (L) for the stored-water chart. */
export const CYLINDER_VOLUME_L = 110;

/** Maximum charge temperature (°C) — boiler store setpoint. */
const CYLINDER_MAX_TEMP_C = 60;

/** Minimum usable temperature (°C) at the tap (40 °C mixed-outlet target). */
const CYLINDER_MIN_USABLE_TEMP_C = 40;

/**
 * Simulate a 110 L stored-cylinder temperature and usable volume through 24 hours.
 *
 * Charge / draw rules (driven by occupancy demand fraction — no UI input required):
 *   demand ≥ 0.6  → peak DHW draw (−18 % SoC per hour)
 *   demand ≥ 0.25 → background home draw (−4 % SoC per hour)
 *   demand < 0.1  → off-peak recharge (+8 % SoC per hour, simulates timer charge)
 *
 * SoC maps linearly to temperature:
 *   100 % → CYLINDER_MAX_TEMP_C (60 °C)
 *     0 % → CYLINDER_MIN_USABLE_TEMP_C (40 °C)
 * Usable volume = SoC × CYLINDER_VOLUME_L / 100
 *
 * @param profile Hourly demand fraction array (length 24).
 * @returns Arrays of cylinder temperature (°C) and usable volume (L).
 */
function buildCylinderTrace(profile: HourlyProfile): { cylinderTempByHour: number[]; cylinderVolByHour: number[] } {
  let soc = 100; // start fully charged
  const cylinderTempByHour: number[] = [];
  const cylinderVolByHour: number[] = [];

  for (let h = 0; h < 24; h++) {
    const demand = profile[h].demand;
    if (demand >= 0.6) {
      soc = Math.max(0, soc - 18);
    } else if (demand >= 0.25) {
      soc = Math.max(0, soc - 4);
    } else if (demand < 0.1) {
      soc = Math.min(100, soc + 8);
    }
    const tempC = parseFloat(
      (CYLINDER_MIN_USABLE_TEMP_C + (soc / 100) * (CYLINDER_MAX_TEMP_C - CYLINDER_MIN_USABLE_TEMP_C)).toFixed(1),
    );
    const volumeL = parseFloat(((soc / 100) * CYLINDER_VOLUME_L).toFixed(1));
    cylinderTempByHour.push(tempC);
    cylinderVolByHour.push(volumeL);
  }

  return { cylinderTempByHour, cylinderVolByHour };
}

export function runLifestyleSimulationModule(input: EngineInputV2_3, cyclingLossPct = 0): LifestyleResult {
  const profile = getProfile(input.occupancySignature);
  const heatLossKw = input.heatLossWatts / 1000;
  const cBuilding = C_BUILDING_KJ_PER_K[input.buildingMass];

  // ── DHW peak timing ──────────────────────────────────────────────────────
  // Resolve peak shower hours from the demand preset (if set) or fall back
  // to the signature defaults: professional=07:00/18:00, steady=07:00/17:00,
  // shift_worker=10:00/22:00.  Clamped to [0, 23].
  const timing = input.demandPreset != null
    ? resolveTimingOverrides(input.demandPreset, input.demandTimingOverrides)
    : (() => {
        switch (input.occupancySignature) {
          case 'steady_home':
          case 'steady':       return { firstShowerHour: 7,  eveningPeakHour: 17 };
          case 'shift_worker':
          case 'shift':        return { firstShowerHour: 10, eveningPeakHour: 22 };
          default:             return { firstShowerHour: 7,  eveningPeakHour: 18 };
        }
      })();
  const morningPeakH = Math.max(0, Math.min(23, timing.firstShowerHour));
  const eveningPeakH = Math.max(0, Math.min(23, timing.eveningPeakHour));
  const occupancy    = Math.max(1, input.occupancyCount ?? 2);

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

  // ── Stored cylinder simulation ───────────────────────────────────────────
  const { cylinderTempByHour, cylinderVolByHour } = buildCylinderTrace(profile);

  const hourlyData: OccupancyHour[] = profile.map((hour, h) => {
    const demandKw = hour.demand * heatLossKw;

    // ── DHW demand: derived from occupancy timing (consistent with BehaviourTimelineBuilder) ──
    // Morning peak window: firstShowerHour and the following hour.
    // Evening peak window: eveningPeakHour and the following hour at 70% load.
    // Zero outside peak windows — no phantom background DHW.
    const isMorningPeak = h === morningPeakH || h === (morningPeakH + 1) % 24;
    const isEveningPeak = h === eveningPeakH || h === (eveningPeakH + 1) % 24;
    const dhwKw = parseFloat((
      isMorningPeak ? occupancy * DHW_KW_PER_PERSON :
      isEveningPeak ? occupancy * DHW_KW_PER_PERSON * 0.7 :
      0
    ).toFixed(3));

    // Legacy proxy fields retained for backward compatibility with existing consumers.
    // All three now derive from the physics-based traces computed above (No Theatre rule).
    // boilerTempC ← boiler dynamic room trace (was: affine proxy 18 + demand × 4)
    const boilerTempC = boilerRoomTrace[h];

    // heatPumpTempC ← ASHP dynamic room trace (was: Math.sin cosmetic variation)
    const heatPumpTempC = ashpRoomTrace[h];

    // storedWaterTempC ← cylinder temperature from buildCylinderTrace (was: step proxy)
    const storedWaterTempC = cylinderTempByHour[h];

    // Cycling fuel penalty: applied when load fraction < 0.25 (low-load short-cycling).
    // A sludge-restricted circuit causes the boiler to fire/stop more frequently at
    // low demand because restricted flow overshoots the setpoint faster.
    // cyclingFuelPenaltyKw = demandKw × cyclingLossPct when loadFrac < 0.25.
    const cyclingFuelPenaltyKw = hour.demand < 0.25 && cyclingLossPct > 0
      ? parseFloat((demandKw * cyclingLossPct).toFixed(3))
      : 0;

    return {
      hour: h,
      demandKw,
      dhwKw,
      boilerTempC,
      heatPumpTempC,
      storedWaterTempC,
      boilerRoomTempC: boilerRoomTrace[h],
      ashpRoomTempC: ashpRoomTrace[h],
      cyclingFuelPenaltyKw,
      cylinderTempC: cylinderTempByHour[h],
      cylinderVolumeL: cylinderVolByHour[h],
    };
  });

  const recommendedSystem = getRecommendedSystem(input.occupancySignature);

  const systemDescriptions: Record<typeof recommendedSystem, string> = {
    boiler:
      '🔥 Boiler recommended for fast reheat under a double-peak schedule — ' +
      'control tuning recommended to reduce cycling.',
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
