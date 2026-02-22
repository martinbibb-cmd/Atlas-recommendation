import type {
  MCSReportInput,
  MCSReport,
  MCSComplianceCheck,
  RoomHeatLoss,
} from '../schema/EngineInputV2_3';

// MCS 003 velocity limits (m/s) for primary pipework
const MAX_VELOCITY_22MM_MS = 1.5;
const MAX_VELOCITY_28MM_MS = 1.5;

// MCS design temperature limits for ASHP
const ASHP_MAX_FLOW_TEMP_C = 55;
const BOILER_MAX_FLOW_TEMP_C = 80;

// MCS 003 / heat pump best practice: ASHP ΔT must not exceed 7°C
const ASHP_MAX_DELTA_T_C = 7;

// Noise analysis threshold for ASHP primary circuit
const NOISE_VELOCITY_THRESHOLD_MS = 1.0;

// Expansion vessel sizing: UK rule-of-thumb (BS EN 13831) = 15% of primary circuit volume
const EXPANSION_VESSEL_PRIMARY_FRACTION = 0.15;

function generateReferenceNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 90000) + 10000;
  return `MCS-${datePart}-${rand}`;
}

function checkVelocityCompliance(
  velocityMs: number,
  pipeDiameter: number
): MCSComplianceCheck {
  const limit = pipeDiameter >= 28 ? MAX_VELOCITY_28MM_MS : MAX_VELOCITY_22MM_MS;
  const passed = velocityMs <= limit;
  return {
    check: 'Primary Pipework Velocity',
    passed,
    detail: passed
      ? `✅ Velocity ${velocityMs.toFixed(3)} m/s ≤ ${limit} m/s limit for ${pipeDiameter}mm pipe.`
      : `❌ Velocity ${velocityMs.toFixed(3)} m/s exceeds ${limit} m/s limit for ${pipeDiameter}mm pipe. ` +
        `Upgrade to 28mm primary or reduce system design load.`,
  };
}

function checkFlowTemperature(
  designFlowTempC: number,
  systemType: MCSReportInput['systemType']
): MCSComplianceCheck {
  const limit = systemType === 'boiler' ? BOILER_MAX_FLOW_TEMP_C : ASHP_MAX_FLOW_TEMP_C;
  const passed = designFlowTempC <= limit;
  return {
    check: 'Design Flow Temperature',
    passed,
    detail: passed
      ? `✅ Flow temperature ${designFlowTempC}°C within ${limit}°C limit for ${systemType.toUpperCase()}.`
      : `❌ Flow temperature ${designFlowTempC}°C exceeds ${limit}°C maximum for ${systemType.toUpperCase()}. ` +
        `Review radiator sizing to permit lower flow temperatures.`,
  };
}

function checkDeltaT(
  designFlowTempC: number,
  designReturnTempC: number
): MCSComplianceCheck {
  const deltaT = designFlowTempC - designReturnTempC;
  const passed = deltaT >= 5 && deltaT <= 20;
  return {
    check: 'Flow/Return ΔT',
    passed,
    detail: passed
      ? `✅ ΔT = ${deltaT}°C is within the 5–20°C acceptable range.`
      : `❌ ΔT = ${deltaT}°C is outside the 5–20°C acceptable range. ` +
        `Adjust flow/return design temperatures.`,
  };
}

function checkHeatLossCalculation(rooms: RoomHeatLoss[]): MCSComplianceCheck {
  const allRoomsHaveHeatLoss = rooms.every(r => r.heatLossW > 0 && r.floorAreaM2 > 0);
  return {
    check: 'Room-by-Room Heat Loss',
    passed: allRoomsHaveHeatLoss && rooms.length > 0,
    detail: allRoomsHaveHeatLoss && rooms.length > 0
      ? `✅ ${rooms.length} rooms with heat loss calculations provided.`
      : `❌ Room-by-room heat loss data is incomplete. ` +
        `MCS 003 requires a BS EN 12831 calculation for every heated room.`,
  };
}

function checkAshpDeltaT(
  designFlowTempC: number,
  designReturnTempC: number,
  systemType: MCSReportInput['systemType'],
): MCSComplianceCheck {
  if (systemType === 'boiler') {
    return {
      check: 'ASHP ΔT Compliance',
      passed: true,
      detail: `✅ ASHP ΔT check not applicable for boiler systems.`,
    };
  }
  const deltaT = designFlowTempC - designReturnTempC;
  const passed = deltaT <= ASHP_MAX_DELTA_T_C;
  return {
    check: 'ASHP ΔT Compliance',
    passed,
    detail: passed
      ? `✅ ASHP ΔT = ${deltaT}°C ≤ ${ASHP_MAX_DELTA_T_C}°C limit. High-flow low-ΔT design confirmed.`
      : `❌ ASHP ΔT = ${deltaT}°C exceeds ${ASHP_MAX_DELTA_T_C}°C maximum for heat pumps. ` +
        `Increase flow rate or resize emitters to reduce ΔT. High ΔT forces the compressor ` +
        `to work harder and suppresses COP significantly.`,
  };
}

function checkExpansionVessel(primaryVolumeL: number | undefined): MCSComplianceCheck {
  if (primaryVolumeL == null || primaryVolumeL <= 0) {
    return {
      check: 'Expansion Vessel Sizing',
      passed: false,
      detail: `❌ Primary circuit volume not provided. Cannot size expansion vessel. ` +
        `Measure system volume (radiators + pipework) and re-submit.`,
    };
  }
  const minVesselL = parseFloat((primaryVolumeL * EXPANSION_VESSEL_PRIMARY_FRACTION).toFixed(1));
  return {
    check: 'Expansion Vessel Sizing',
    passed: true,
    detail: `✅ Minimum expansion vessel: ${minVesselL}L (15% of ${primaryVolumeL}L primary volume, BS EN 13831).`,
  };
}

function buildNoiseAnalysis(velocityMs: number, systemType: MCSReportInput['systemType']): string {
  if (systemType === 'boiler') {
    return `Boiler system – noise analysis not required by MCS 003.`;
  }
  if (velocityMs > NOISE_VELOCITY_THRESHOLD_MS) {
    return (
      `⚠️ ASHP primary circuit velocity ${velocityMs.toFixed(3)} m/s exceeds ` +
      `${NOISE_VELOCITY_THRESHOLD_MS} m/s noise threshold. ` +
      `Install acoustic lagging on primary pipework; consider anti-vibration mounts ` +
      `and flexible connections at the heat pump manifold.`
    );
  }
  return (
    `✅ ASHP primary circuit velocity ${velocityMs.toFixed(3)} m/s is within ` +
    `${NOISE_VELOCITY_THRESHOLD_MS} m/s noise limit. Standard pipework installation acceptable.`
  );
}

export function generateMCSReport(input: MCSReportInput): MCSReport {
  const totalHeatLossW = input.rooms.reduce((sum, r) => sum + r.heatLossW, 0);
  const velocityMs = input.hydraulicResult.velocityMs;
  const isVelocityCompliant = !input.hydraulicResult.isBottleneck;

  const expansionVesselSizingL = input.primaryVolumeL != null && input.primaryVolumeL > 0
    ? parseFloat((input.primaryVolumeL * EXPANSION_VESSEL_PRIMARY_FRACTION).toFixed(1))
    : 0;

  const complianceChecks: MCSComplianceCheck[] = [
    checkVelocityCompliance(velocityMs, input.primaryPipeDiameter),
    checkFlowTemperature(input.designFlowTempC, input.systemType),
    checkDeltaT(input.designFlowTempC, input.designReturnTempC),
    checkHeatLossCalculation(input.rooms),
    checkAshpDeltaT(input.designFlowTempC, input.designReturnTempC, input.systemType),
    checkExpansionVessel(input.primaryVolumeL),
  ];

  const noiseAnalysis = buildNoiseAnalysis(velocityMs, input.systemType);

  const mcsPackSections = [
    `Property: ${input.propertyAddress}`,
    `MCS Installer: ${input.installerMcsNumber}`,
    `System Type: ${input.systemType.toUpperCase()}`,
    `Design Flow / Return: ${input.designFlowTempC}°C / ${input.designReturnTempC}°C`,
    `External Design Temperature: ${input.externalDesignTempC}°C`,
    `Internal Design Temperature: ${input.internalDesignTempC}°C`,
    `Total Calculated Heat Loss: ${totalHeatLossW.toFixed(0)} W`,
    `Room-by-Room Schedule: ${input.rooms.length} rooms (see schedule below)`,
    `Primary Pipework: ${input.primaryPipeDiameter}mm – velocity ${velocityMs.toFixed(3)} m/s`,
    `Hydraulic Bottleneck: ${input.hydraulicResult.isBottleneck ? 'YES – remediation required' : 'No'}`,
    `Expansion Vessel (min): ${expansionVesselSizingL > 0 ? `${expansionVesselSizingL}L` : 'Not calculated – primary volume required'}`,
    `Noise Analysis: ${noiseAnalysis}`,
    `Compliance Summary: ${complianceChecks.filter(c => c.passed).length}/${complianceChecks.length} checks passed`,
  ];

  return {
    referenceNumber: generateReferenceNumber(),
    generatedAt: new Date().toISOString(),
    totalHeatLossW,
    designFlowTempC: input.designFlowTempC,
    hydraulicVelocityMs: velocityMs,
    isVelocityCompliant,
    noiseAnalysis,
    roomByRoomSchedule: input.rooms,
    complianceChecks,
    mcsPackSections,
    expansionVesselSizingL,
  };
}
