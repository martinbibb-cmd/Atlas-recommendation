import { describe, it, expect } from 'vitest';
import { generateMCSReport } from '../modules/MCSReportGenerator';
import type { MCSReportInput } from '../schema/EngineInputV2_3';

const baseHydraulicResult = {
  flowRateLs: 0.095,
  velocityMs: 0.37,
  isBottleneck: false,
  isSafetyCutoffRisk: false,
  ashpRequires28mm: false,
  notes: [],
};

const baseInput: MCSReportInput = {
  propertyAddress: '10 Downing Street, London, SW1A 2AA',
  installerMcsNumber: 'MCS-12345',
  designFlowTempC: 45,
  designReturnTempC: 40,
  externalDesignTempC: -3,
  internalDesignTempC: 21,
  rooms: [
    { roomName: 'Living Room', floorAreaM2: 20, heatLossW: 1200, requiredRadiatorOutputW: 1200 },
    { roomName: 'Kitchen', floorAreaM2: 12, heatLossW: 700, requiredRadiatorOutputW: 700 },
    { roomName: 'Bedroom 1', floorAreaM2: 14, heatLossW: 600, requiredRadiatorOutputW: 600 },
  ],
  primaryPipeDiameter: 22,
  hydraulicResult: baseHydraulicResult,
  systemType: 'ashp',
};

describe('MCSReportGenerator', () => {
  it('generates a report with a reference number', () => {
    const report = generateMCSReport(baseInput);
    expect(report.referenceNumber).toMatch(/^MCS-\d{8}-\d{5}$/);
  });

  it('sums total heat loss across all rooms', () => {
    const report = generateMCSReport(baseInput);
    expect(report.totalHeatLossW).toBe(1200 + 700 + 600);
  });

  it('carries through the design flow temperature', () => {
    const report = generateMCSReport(baseInput);
    expect(report.designFlowTempC).toBe(45);
  });

  it('carries through hydraulic velocity', () => {
    const report = generateMCSReport(baseInput);
    expect(report.hydraulicVelocityMs).toBeCloseTo(0.37, 2);
  });

  it('marks velocity as compliant when isBottleneck is false', () => {
    const report = generateMCSReport(baseInput);
    expect(report.isVelocityCompliant).toBe(true);
  });

  it('marks velocity as non-compliant when isBottleneck is true', () => {
    const report = generateMCSReport({
      ...baseInput,
      hydraulicResult: { ...baseHydraulicResult, isBottleneck: true },
    });
    expect(report.isVelocityCompliant).toBe(false);
  });

  it('includes room-by-room schedule matching input rooms', () => {
    const report = generateMCSReport(baseInput);
    expect(report.roomByRoomSchedule).toHaveLength(3);
    expect(report.roomByRoomSchedule[0].roomName).toBe('Living Room');
  });

  it('produces 4 compliance checks', () => {
    const report = generateMCSReport(baseInput);
    expect(report.complianceChecks).toHaveLength(4);
  });

  it('all checks pass for a well-specified system', () => {
    const report = generateMCSReport(baseInput);
    expect(report.complianceChecks.every(c => c.passed)).toBe(true);
  });

  it('flow temperature check fails if ASHP flow exceeds 55°C', () => {
    const report = generateMCSReport({ ...baseInput, designFlowTempC: 60 });
    const flowCheck = report.complianceChecks.find(c => c.check === 'Design Flow Temperature');
    expect(flowCheck?.passed).toBe(false);
  });

  it('delta T check fails when flow and return are equal', () => {
    const report = generateMCSReport({ ...baseInput, designReturnTempC: 45 });
    const deltaTCheck = report.complianceChecks.find(c => c.check === 'Flow/Return ΔT');
    expect(deltaTCheck?.passed).toBe(false);
  });

  it('room heat loss check fails when rooms array is empty', () => {
    const report = generateMCSReport({ ...baseInput, rooms: [] });
    const roomCheck = report.complianceChecks.find(c => c.check === 'Room-by-Room Heat Loss');
    expect(roomCheck?.passed).toBe(false);
  });

  it('mcsPackSections array is non-empty', () => {
    const report = generateMCSReport(baseInput);
    expect(report.mcsPackSections.length).toBeGreaterThan(0);
  });

  it('generatedAt is an ISO date string', () => {
    const report = generateMCSReport(baseInput);
    expect(() => new Date(report.generatedAt)).not.toThrow();
    expect(report.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
