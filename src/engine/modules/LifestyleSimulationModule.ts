import type {
  EngineInputV2_3,
  LifestyleResult,
  OccupancyHour,
  OccupancySignature,
} from '../schema/EngineInputV2_3';

type HourlyProfile = { demand: number; label: string }[];

/**
 * Professional: double-peak demand (morning + evening)
 * Boiler wins: high reheat power (30kW) for stepped Hive/Nest profiles
 */
function professionalProfile(): HourlyProfile {
  return Array.from({ length: 24 }, (_, h) => {
    if (h >= 6 && h <= 8) return { demand: 0.9, label: 'morning_peak' };
    if (h >= 17 && h <= 22) return { demand: 0.85, label: 'evening_peak' };
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
    case 'steady_home': return steadyHomeProfile();
    case 'shift_worker': return shiftWorkerProfile();
  }
}

function getRecommendedSystem(signature: OccupancySignature): LifestyleResult['recommendedSystem'] {
  switch (signature) {
    case 'professional': return 'boiler';
    case 'steady_home': return 'ashp';
    case 'shift_worker': return 'stored_water';
  }
}

export function runLifestyleSimulationModule(input: EngineInputV2_3): LifestyleResult {
  const profile = getProfile(input.occupancySignature);
  const heatLossKw = input.heatLossWatts / 1000;

  const hourlyData: OccupancyHour[] = profile.map((hour, h) => {
    const demandKw = hour.demand * heatLossKw;

    // Boiler: rapid response but sharp temperature swings
    const boilerTempC = 18 + hour.demand * 4;

    // ASHP: flat "horizon" line, slow response, exploits building mass
    const heatPumpTempC = 19.5 + Math.sin((h / 24) * Math.PI) * 0.5;

    // Stored water: stable but peaks delayed
    const storedWaterTempC = 19 + (hour.demand > 0.6 ? 1.5 : 0);

    return { hour: h, demandKw, boilerTempC, heatPumpTempC, storedWaterTempC };
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
