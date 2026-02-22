import type {
  EngineInputV2_3,
  LegacyInfrastructureResult,
  RadiatorTemperatureProfile,
} from '../schema/EngineInputV2_3';

// ─── Constants ────────────────────────────────────────────────────────────────

const SPECIFIC_HEAT_WATER = 4.19;         // kJ/(kg·°C)
const WATER_DENSITY_KG_PER_L = 1.0;      // kg/L
const DEFAULT_SUPPLY_TEMP_C = 70;         // °C standard boiler flow temperature
const CONDENSING_RETURN_THRESHOLD_C = 55; // °C return temp above which condensing is lost
const COOL_RADIATOR_EFFECT_THRESHOLD_C = 10; // °C: if last rad inlet ≤ supply − threshold

// Microbore pipe geometry
const PIPE_8MM_INNER_RADIUS_M = 0.004;   // 8mm bore → 4mm inner radius
const PIPE_10MM_INNER_RADIUS_M = 0.005;  // 10mm bore → 5mm inner radius
const PIPE_8MM_AREA_M2 = Math.PI * PIPE_8MM_INNER_RADIUS_M ** 2;
const PIPE_10MM_AREA_M2 = Math.PI * PIPE_10MM_INNER_RADIUS_M ** 2;

// Velocity thresholds for microbore
const MICROBORE_NOISE_VELOCITY_M_S = 0.75;   // m/s – audible flow noise risk
const MICROBORE_EROSION_VELOCITY_M_S = 1.0;  // m/s – erosion / accelerated corrosion

// Fluid properties for Darcy-Weisbach (water at ~60 °C)
const WATER_DENSITY_KG_M3 = 980;   // kg/m³ at ~60°C
const WATER_VISCOSITY_PA_S = 4.7e-4; // dynamic viscosity at ~60°C

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calculate velocity (m/s) in a circular pipe from volumetric flow rate.
 * @param flowRateLs - flow rate in L/s
 * @param pipeAreaM2 - pipe internal cross-sectional area in m²
 */
export function calcMicroboreVelocity(flowRateLs: number, pipeAreaM2: number): number {
  return (flowRateLs / 1000) / pipeAreaM2;
}

/**
 * Calculate friction pressure loss per metre of pipe using Darcy-Weisbach.
 * Uses Blasius approximation for turbulent flow (Re > 4000), Hagen-Poiseuille for laminar.
 * @param velocityMs - water velocity in m/s
 * @param internalDiameterMm - pipe internal diameter in mm
 * @returns pressure drop in Pa/m
 */
export function calcFrictionLossPerMetre(velocityMs: number, internalDiameterMm: number): number {
  if (velocityMs <= 0) return 0;
  const D = internalDiameterMm / 1000; // convert to m
  const Re = (WATER_DENSITY_KG_M3 * velocityMs * D) / WATER_VISCOSITY_PA_S;
  const frictionFactor = Re > 4000
    ? 0.316 * Math.pow(Re, -0.25)   // Blasius (turbulent)
    : 64 / Re;                       // Hagen-Poiseuille (laminar)
  return frictionFactor * WATER_DENSITY_KG_M3 * (velocityMs ** 2) / (2 * D);
}

// ─── One-Pipe Module ──────────────────────────────────────────────────────────

/**
 * Simulate a single-pipe (one-pipe) heating loop.
 *
 * In a one-pipe system radiators are tapped off a single ring main.
 * Cooled return water rejoins the main loop between each radiator,
 * progressively lowering the supply temperature to downstream radiators.
 *
 * Model: equal heat extraction per radiator, equal bypass blending ignored
 * for worst-case analysis (all flow through each radiator).
 */
function simulateOnePipe(
  supplyTempC: number,
  heatLossKw: number,
  radiatorCount: number,
  flowRateLs: number
): RadiatorTemperatureProfile[] {
  const profiles: RadiatorTemperatureProfile[] = [];
  const heatPerRadiatorKw = heatLossKw / radiatorCount;
  // ΔT per radiator = P / (ṁ × Cp)  where ṁ = flow × density
  const deltaTPerRad =
    heatPerRadiatorKw / (flowRateLs * WATER_DENSITY_KG_PER_L * SPECIFIC_HEAT_WATER);

  let currentInletTemp = supplyTempC;
  for (let i = 1; i <= radiatorCount; i++) {
    const outletTemp = currentInletTemp - deltaTPerRad;
    const meanWaterTemp = (currentInletTemp + outletTemp) / 2;
    profiles.push({
      position: i,
      inletTempC: parseFloat(currentInletTemp.toFixed(2)),
      outletTempC: parseFloat(outletTemp.toFixed(2)),
      meanWaterTempC: parseFloat(meanWaterTemp.toFixed(2)),
      isCondensingCompatible: outletTemp < CONDENSING_RETURN_THRESHOLD_C,
    });
    currentInletTemp = outletTemp;
  }
  return profiles;
}

// ─── Main Module ──────────────────────────────────────────────────────────────

export function runLegacyInfrastructureModule(
  input: EngineInputV2_3
): LegacyInfrastructureResult {
  const topology = input.pipingTopology ?? 'two_pipe';
  const notes: string[] = [];

  // ── Two-pipe: standard system, no legacy-specific issues
  if (topology === 'two_pipe') {
    notes.push(
      `✅ Two-Pipe System: Standard parallel distribution. Each radiator receives ` +
      `supply temperature directly. No one-pipe temperature cascade or microbore ` +
      `pressure concerns apply.`
    );
    return { pipingTopology: topology, notes };
  }

  // ── One-pipe system
  if (topology === 'one_pipe') {
    const heatLossKw = input.heatLossWatts / 1000;
    const supplyTempC = input.supplyTempC ?? DEFAULT_SUPPLY_TEMP_C;
    // Standard system ΔT of 20°C → derive flow rate
    const systemDeltaT = 20;
    const flowRateLs = heatLossKw / (systemDeltaT * SPECIFIC_HEAT_WATER);

    const radiatorProfiles = simulateOnePipe(
      supplyTempC,
      heatLossKw,
      input.radiatorCount,
      flowRateLs
    );

    const lastProfile = radiatorProfiles[radiatorProfiles.length - 1];
    const averageReturnTempC = lastProfile.outletTempC;
    const isCondensingCompatible = averageReturnTempC < CONDENSING_RETURN_THRESHOLD_C;
    const coolRadiatorEffect =
      lastProfile.inletTempC <= supplyTempC - COOL_RADIATOR_EFFECT_THRESHOLD_C;

    notes.push(
      `🔗 One-Pipe Loop: ${input.radiatorCount} radiators connected sequentially. ` +
      `Supply ${supplyTempC}°C cascades to ${averageReturnTempC.toFixed(1)}°C at the last ` +
      `radiator outlet.`
    );

    if (coolRadiatorEffect) {
      notes.push(
        `🥶 Cool Radiator Effect: Last radiator in the loop receives only ` +
        `${lastProfile.inletTempC.toFixed(1)}°C inlet temperature ` +
        `(${(supplyTempC - lastProfile.inletTempC).toFixed(1)}°C below supply). ` +
        `Radiators at the end of a single-pipe loop typically output ≤30% of design capacity.`
      );
    }

    if (!isCondensingCompatible) {
      notes.push(
        `⚠️ Condensing Mode Blocked: One-pipe return temperature ${averageReturnTempC.toFixed(1)}°C ` +
        `exceeds the 55°C condensing threshold. The boiler cannot recover latent heat, ` +
        `negating the efficiency benefit of a condensing appliance.`
      );
    }

    if (averageReturnTempC > 45) {
      notes.push(
        `🚫 Heat Pump Incompatible: One-pipe return of ${averageReturnTempC.toFixed(1)}°C ` +
        `is too high for ASHP low-temperature operation (target return ≤35°C). ` +
        `Conversion to two-pipe distribution is required before heat pump installation.`
      );
    }

    return {
      pipingTopology: topology,
      onePipe: {
        radiatorProfiles,
        averageReturnTempC: parseFloat(averageReturnTempC.toFixed(2)),
        isCondensingCompatible,
        lastRadiatorInletTempC: parseFloat(lastProfile.inletTempC.toFixed(2)),
        coolRadiatorEffect,
      },
      notes,
    };
  }

  // ── Microbore system (8mm or 10mm)
  const internalDiameterMm = input.microboreInternalDiameterMm ?? 10;
  const pipeAreaM2 = internalDiameterMm === 8 ? PIPE_8MM_AREA_M2 : PIPE_10MM_AREA_M2;
  const heatLossKw = input.heatLossWatts / 1000;
  const systemDeltaT = 20;
  const flowRateLs = heatLossKw / (systemDeltaT * SPECIFIC_HEAT_WATER);

  const velocityMs = calcMicroboreVelocity(flowRateLs, pipeAreaM2);
  const frictionLossPerMetrePa = calcFrictionLossPerMetre(velocityMs, internalDiameterMm);
  const isNoiseRisk = velocityMs > MICROBORE_NOISE_VELOCITY_M_S;
  const isErosionRisk = velocityMs > MICROBORE_EROSION_VELOCITY_M_S;
  // ASHP requires a buffer tank for microbore due to high-flow, low-ΔT demands
  const requiresBufferTank = input.heatLossWatts > 5000 || isErosionRisk;

  notes.push(
    `🔧 Microbore System (${internalDiameterMm}mm bore): ` +
    `Calculated velocity ${velocityMs.toFixed(3)} m/s, ` +
    `friction loss ${frictionLossPerMetrePa.toFixed(0)} Pa/m. ` +
    `Standard 22mm primary feeding ${internalDiameterMm}mm branch circuits.`
  );

  if (isNoiseRisk) {
    notes.push(
      `🔊 Flow Noise Risk: Velocity ${velocityMs.toFixed(3)} m/s exceeds the ` +
      `${MICROBORE_NOISE_VELOCITY_M_S} m/s threshold for audible flow noise in ` +
      `${internalDiameterMm}mm bore pipework. Occupant comfort may be affected.`
    );
  }

  if (isErosionRisk) {
    notes.push(
      `⚠️ Erosion Risk: Velocity ${velocityMs.toFixed(3)} m/s exceeds the ` +
      `${MICROBORE_EROSION_VELOCITY_M_S} m/s erosion threshold for microbore pipe. ` +
      `Accelerated wall thinning and copper particle contamination likely over 5–10 years.`
    );
  }

  if (requiresBufferTank) {
    notes.push(
      `🛢️ Buffer Tank Required: ASHP retrofits on ${internalDiameterMm}mm microbore systems ` +
      `need a buffer vessel to decouple primary heat pump circuit from the high-resistance ` +
      `distribution circuit. This prevents short-cycling and maintains minimum flow rate.`
    );
  }

  return {
    pipingTopology: topology,
    microbore: {
      internalDiameterMm,
      velocityMs: parseFloat(velocityMs.toFixed(4)),
      frictionLossPerMetrePa: parseFloat(frictionLossPerMetrePa.toFixed(2)),
      isNoiseRisk,
      isErosionRisk,
      requiresBufferTank,
    },
    notes,
  };
}
