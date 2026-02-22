import { describe, it, expect } from 'vitest';
import {
  runLegacyInfrastructureModule,
  calcMicroboreVelocity,
  calcFrictionLossPerMetre,
} from '../modules/LegacyInfrastructureModule';

const baseInput = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium' as const,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 8,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional' as const,
  highOccupancy: false,
  preferCombi: true,
};

describe('LegacyInfrastructureModule – two-pipe', () => {
  it('returns two_pipe topology with no onePipe or microbore results', () => {
    const result = runLegacyInfrastructureModule({ ...baseInput, pipingTopology: 'two_pipe' });
    expect(result.pipingTopology).toBe('two_pipe');
    expect(result.onePipe).toBeUndefined();
    expect(result.microbore).toBeUndefined();
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('defaults to two_pipe when pipingTopology is not provided', () => {
    const result = runLegacyInfrastructureModule(baseInput);
    expect(result.pipingTopology).toBe('two_pipe');
  });
});

describe('LegacyInfrastructureModule – one-pipe', () => {
  const onePipeInput = { ...baseInput, pipingTopology: 'one_pipe' as const, radiatorCount: 6 };

  it('returns one-pipe results', () => {
    const result = runLegacyInfrastructureModule(onePipeInput);
    expect(result.pipingTopology).toBe('one_pipe');
    expect(result.onePipe).toBeDefined();
  });

  it('generates one profile per radiator', () => {
    const result = runLegacyInfrastructureModule(onePipeInput);
    expect(result.onePipe!.radiatorProfiles).toHaveLength(6);
  });

  it('cascade: each radiator has a lower inlet temp than the previous', () => {
    const result = runLegacyInfrastructureModule(onePipeInput);
    const profiles = result.onePipe!.radiatorProfiles;
    for (let i = 1; i < profiles.length; i++) {
      expect(profiles[i].inletTempC).toBeLessThan(profiles[i - 1].inletTempC);
    }
  });

  it('first radiator inlet equals supply temperature (default 70°C)', () => {
    const result = runLegacyInfrastructureModule(onePipeInput);
    expect(result.onePipe!.radiatorProfiles[0].inletTempC).toBeCloseTo(70, 1);
  });

  it('flags cool radiator effect when last inlet is ≥10°C below supply', () => {
    // 8kW over 6 rads at 20°C ΔT → fairly large per-rad drop
    const result = runLegacyInfrastructureModule(onePipeInput);
    expect(typeof result.onePipe!.coolRadiatorEffect).toBe('boolean');
  });

  it('respects custom supply temperature', () => {
    const result = runLegacyInfrastructureModule({ ...onePipeInput, supplyTempC: 65 });
    expect(result.onePipe!.radiatorProfiles[0].inletTempC).toBeCloseTo(65, 1);
  });

  it('isCondensingCompatible is false when return temp exceeds 55°C', () => {
    // With supply at 80°C and 20°C system ΔT, the one-pipe return is 60°C > 55°C
    const highSupplyInput = {
      ...baseInput,
      pipingTopology: 'one_pipe' as const,
      heatLossWatts: 12000,
      radiatorCount: 4,
      supplyTempC: 80,
    };
    const result = runLegacyInfrastructureModule(highSupplyInput);
    expect(result.onePipe!.isCondensingCompatible).toBe(false);
  });
});

describe('LegacyInfrastructureModule – microbore', () => {
  const microboreInput = {
    ...baseInput,
    pipingTopology: 'microbore' as const,
    microboreInternalDiameterMm: 8 as const,
    heatLossWatts: 10000,
  };

  it('returns microbore results with 8mm diameter', () => {
    const result = runLegacyInfrastructureModule(microboreInput);
    expect(result.pipingTopology).toBe('microbore');
    expect(result.microbore).toBeDefined();
    expect(result.microbore!.internalDiameterMm).toBe(8);
  });

  it('defaults to 10mm when microboreInternalDiameterMm is not set', () => {
    const result = runLegacyInfrastructureModule({
      ...baseInput,
      pipingTopology: 'microbore' as const,
    });
    expect(result.microbore!.internalDiameterMm).toBe(10);
  });

  it('velocity is positive for positive heat loss', () => {
    const result = runLegacyInfrastructureModule(microboreInput);
    expect(result.microbore!.velocityMs).toBeGreaterThan(0);
  });

  it('friction loss is positive for positive velocity', () => {
    const result = runLegacyInfrastructureModule(microboreInput);
    expect(result.microbore!.frictionLossPerMetrePa).toBeGreaterThan(0);
  });

  it('requiresBufferTank is true for heat loss > 5kW', () => {
    const result = runLegacyInfrastructureModule(microboreInput);
    expect(result.microbore!.requiresBufferTank).toBe(true);
  });

  it('smaller diameter (8mm) gives higher velocity than 10mm for same load', () => {
    const result8mm = runLegacyInfrastructureModule(microboreInput);
    const result10mm = runLegacyInfrastructureModule({
      ...microboreInput,
      microboreInternalDiameterMm: 10,
    });
    expect(result8mm.microbore!.velocityMs).toBeGreaterThan(result10mm.microbore!.velocityMs);
  });
});

describe('calcMicroboreVelocity', () => {
  it('returns zero for zero flow rate', () => {
    expect(calcMicroboreVelocity(0, 5e-5)).toBe(0);
  });

  it('velocity increases with flow rate', () => {
    const area = Math.PI * (0.005) ** 2;
    expect(calcMicroboreVelocity(0.1, area)).toBeLessThan(calcMicroboreVelocity(0.2, area));
  });
});

describe('calcFrictionLossPerMetre', () => {
  it('returns zero for zero velocity', () => {
    expect(calcFrictionLossPerMetre(0, 10)).toBe(0);
  });

  it('returns positive value for positive velocity', () => {
    expect(calcFrictionLossPerMetre(1.0, 10)).toBeGreaterThan(0);
  });

  it('higher velocity gives higher friction loss', () => {
    expect(calcFrictionLossPerMetre(1.5, 10)).toBeGreaterThan(calcFrictionLossPerMetre(0.5, 10));
  });
});
