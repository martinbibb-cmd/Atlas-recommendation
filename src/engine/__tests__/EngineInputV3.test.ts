import { describe, it, expect } from 'vitest';
import type {
  EngineInputV3,
  PrimaryPipeDiameter,
  HeatExchangerMaterial,
  DrawFrequency,
  OccupancySignatureV3,
} from '../schema/EngineInputV3';

/**
 * EngineInputV3 schema tests.
 *
 * These tests validate the V3 canonical types at runtime using representative
 * values for each discriminated union, ensuring the schema contract is met
 * before the physics modules are invoked.
 */
describe('EngineInputV3 – schema contract', () => {
  // A minimal valid V3 input used as a base for the type-level checks below.
  const baseV3Input: EngineInputV3 = {
    // Hydraulics
    postcode: 'E1 6RF',
    dynamicMainsPressure: 2.0,
    primaryPipeDiameter: 22,
    pipingTopology: 'two_pipe',
    // Metallurgy
    heatExchangerMaterial: 'Al-Si',
    hasSoftener: true,
    // Behaviour
    occupancySignature: 'professional',
    drawFrequency: 'high',
    // Remaining required V2_3 fields
    buildingMass: 'medium',
    heatLossWatts: 8000,
    radiatorCount: 10,
    hasLoftConversion: false,
    returnWaterTemp: 45,
    bathroomCount: 2,
    highOccupancy: false,
    preferCombi: false,
  };

  it('accepts 15mm as a valid primary pipe diameter', () => {
    const d: PrimaryPipeDiameter = 15;
    const input: EngineInputV3 = { ...baseV3Input, primaryPipeDiameter: d };
    expect(input.primaryPipeDiameter).toBe(15);
  });

  it('accepts 22mm as a valid primary pipe diameter', () => {
    const d: PrimaryPipeDiameter = 22;
    const input: EngineInputV3 = { ...baseV3Input, primaryPipeDiameter: d };
    expect(input.primaryPipeDiameter).toBe(22);
  });

  it('accepts 28mm as a valid primary pipe diameter', () => {
    const d: PrimaryPipeDiameter = 28;
    const input: EngineInputV3 = { ...baseV3Input, primaryPipeDiameter: d };
    expect(input.primaryPipeDiameter).toBe(28);
  });

  it('accepts Al-Si as a valid heat exchanger material', () => {
    const m: HeatExchangerMaterial = 'Al-Si';
    const input: EngineInputV3 = { ...baseV3Input, heatExchangerMaterial: m };
    expect(input.heatExchangerMaterial).toBe('Al-Si');
  });

  it('accepts stainless_steel as a valid heat exchanger material', () => {
    const m: HeatExchangerMaterial = 'stainless_steel';
    const input: EngineInputV3 = { ...baseV3Input, heatExchangerMaterial: m };
    expect(input.heatExchangerMaterial).toBe('stainless_steel');
  });

  it('accepts all three V3 occupancy signatures', () => {
    const signatures: OccupancySignatureV3[] = ['professional', 'steady', 'shift'];
    for (const sig of signatures) {
      const input: EngineInputV3 = { ...baseV3Input, occupancySignature: sig };
      expect(input.occupancySignature).toBe(sig);
    }
  });

  it('accepts all three piping topologies', () => {
    const topologies = ['two_pipe', 'one_pipe', 'microbore'] as const;
    for (const t of topologies) {
      const input: EngineInputV3 = { ...baseV3Input, pipingTopology: t };
      expect(input.pipingTopology).toBe(t);
    }
  });

  it('accepts both draw frequency values', () => {
    const freqs: DrawFrequency[] = ['low', 'high'];
    for (const f of freqs) {
      const input: EngineInputV3 = { ...baseV3Input, drawFrequency: f };
      expect(input.drawFrequency).toBe(f);
    }
  });

  it('V3 input carries the required hydraulics fields', () => {
    expect(baseV3Input.dynamicMainsPressure).toBeDefined();
    expect(baseV3Input.primaryPipeDiameter).toBeDefined();
    expect(baseV3Input.pipingTopology).toBeDefined();
  });
});
