import { describe, it, expect } from 'vitest';
import {
  runLifestyleSimulationModule,
  buildDynamicRoomTrace,
  DESIGN_OUTDOOR_TEMP_C,
} from '../modules/LifestyleSimulationModule';

const baseInput = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium' as const,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional' as const,
  highOccupancy: false,
  preferCombi: true,
};

describe('LifestyleSimulationModule', () => {
  it('returns 24 hours of data', () => {
    const result = runLifestyleSimulationModule(baseInput);
    expect(result.hourlyData).toHaveLength(24);
  });

  it('recommends boiler for professional signature', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'professional' });
    expect(result.recommendedSystem).toBe('boiler');
  });

  it('recommends ASHP for steady home signature', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'steady_home' });
    expect(result.recommendedSystem).toBe('ashp');
  });

  it('recommends stored water for shift worker signature', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'shift_worker' });
    expect(result.recommendedSystem).toBe('stored_water');
  });

  it('has higher demand during peak hours for professional', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'professional' });
    const morningPeak = result.hourlyData[7].demandKw;  // 7am
    const awayTime = result.hourlyData[12].demandKw;    // 12pm (away)
    expect(morningPeak).toBeGreaterThan(awayTime);
  });

  // ── V3 additions ─────────────────────────────────────────────────────────────

  it('07:00 and 18:00 are the highest-demand hours for professional (double-peak spec)', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'professional' });
    const peak07 = result.hourlyData[7].demandKw;
    const peak18 = result.hourlyData[18].demandKw;
    // Both canonical peaks should exceed adjacent shoulder hours
    const shoulder06 = result.hourlyData[6].demandKw;
    const shoulder08 = result.hourlyData[8].demandKw;
    const shoulder17 = result.hourlyData[17].demandKw;
    const shoulder19 = result.hourlyData[19].demandKw;
    expect(peak07).toBeGreaterThan(shoulder06);
    expect(peak07).toBeGreaterThan(shoulder08);
    expect(peak18).toBeGreaterThan(shoulder17);
    expect(peak18).toBeGreaterThan(shoulder19);
  });

  it('V3 "steady" alias recommends ASHP (same as steady_home)', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'steady' });
    expect(result.recommendedSystem).toBe('ashp');
  });

  it('V3 "shift" alias recommends stored water (same as shift_worker)', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'shift' });
    expect(result.recommendedSystem).toBe('stored_water');
  });

  it('V3 "steady" returns 24 hours of data', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'steady' });
    expect(result.hourlyData).toHaveLength(24);
  });
});

// ─── Dynamic thermal coupling ─────────────────────────────────────────────────

describe('LifestyleSimulationModule – dynamic room temperature coupling', () => {
  it('each hourlyData entry includes boilerRoomTempC and ashpRoomTempC', () => {
    const result = runLifestyleSimulationModule(baseInput);
    result.hourlyData.forEach(h => {
      expect(typeof h.boilerRoomTempC).toBe('number');
      expect(typeof h.ashpRoomTempC).toBe('number');
    });
  });

  it('room temperatures are within physically plausible range [10, 26]', () => {
    const result = runLifestyleSimulationModule(baseInput);
    result.hourlyData.forEach(h => {
      expect(h.boilerRoomTempC).toBeGreaterThanOrEqual(10);
      expect(h.boilerRoomTempC).toBeLessThanOrEqual(26);
      expect(h.ashpRoomTempC).toBeGreaterThanOrEqual(10);
      expect(h.ashpRoomTempC).toBeLessThanOrEqual(26);
    });
  });

  it('ASHP trace has lower variance than boiler trace for professional profile (flat horizon)', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'professional' });
    const ashpTemps  = result.hourlyData.map(h => h.ashpRoomTempC);
    const boilerTemps = result.hourlyData.map(h => h.boilerRoomTempC);
    const variance = (arr: number[]) => {
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
    };
    // ASHP modulates → lower variance; boiler steps → higher variance
    expect(variance(ashpTemps)).toBeLessThan(variance(boilerTemps));
  });

  it('heavy building mass produces lower temperature range than light mass (more thermal inertia)', () => {
    const heavy = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'professional', buildingMass: 'heavy' });
    const light  = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'professional', buildingMass: 'light' });
    const range = (arr: number[]) => Math.max(...arr) - Math.min(...arr);
    // Heavier building damps boiler oscillations more
    expect(range(heavy.hourlyData.map(h => h.boilerRoomTempC)))
      .toBeLessThan(range(light.hourlyData.map(h => h.boilerRoomTempC)));
  });
});

// ─── Thermal coupling invariants (buildDynamicRoomTrace) ─────────────────────

describe('buildDynamicRoomTrace – thermal coupling invariants', () => {
  // Constant profile used by multiple tests
  const constantProfile = Array.from({ length: 24 }, () => ({ demand: 1.0, label: 'test' }));

  it('energy sanity: T is stable when Q_plant equals Q_loss at design conditions', () => {
    // At T_room=21°C, outdoor=-3°C, design ΔT=24K:
    //   UA = heatLossKw / 24,  Q_loss = UA × 24 = heatLossKw
    //   ASHP plant at demand=1.0 → heatLossKw
    //   Net = 0 → T should stay at 21°C
    const heatLossKw = 8;
    const cBuilding  = 50_000; // medium mass (kJ/K)
    const trace = buildDynamicRoomTrace(
      constantProfile,
      (_, demand) => demand * heatLossKw,
      heatLossKw,
      cBuilding,
    );
    // All temperatures should remain at the initial 21°C (within floating-point rounding)
    trace.forEach(t => {
      expect(t).toBeCloseTo(21, 0);
    });
  });

  it('decay: T decreases toward outdoor temp when Q_plant = 0', () => {
    const heatLossKw = 8;
    const cBuilding  = 50_000;
    const zeroProfile = Array.from({ length: 24 }, () => ({ demand: 0, label: 'off' }));
    const trace = buildDynamicRoomTrace(
      zeroProfile,
      () => 0,
      heatLossKw,
      cBuilding,
    );
    // Temperature must be monotonically non-increasing (starts at 21, decays toward -3,
    // soft-clamped to 10)
    for (let i = 1; i < trace.length; i++) {
      expect(trace[i]).toBeLessThanOrEqual(trace[i - 1] + 0.01); // allow floating-point rounding
    }
    // Final temperature must be below the initial 21°C
    expect(trace[trace.length - 1]).toBeLessThan(21);
    // Must be at the soft-clamp floor (decay over 24 hours from 21°C reaches the clamp)
    expect(trace[trace.length - 1]).toBeGreaterThanOrEqual(DESIGN_OUTDOOR_TEMP_C);
  });

  it('extreme C_building values (20 MJ/K light vs 100 MJ/K heavy) do not produce out-of-range temperatures', () => {
    const heatLossKw  = 8;
    const cLight  = 20_000;   // light mass (kJ/K)
    const cHeavy  = 100_000;  // heavy mass (kJ/K)
    const boilerPlant = (_h: number, demand: number) => demand >= 0.3 ? 30 : 0;

    [cLight, cHeavy].forEach(cBuilding => {
      const trace = buildDynamicRoomTrace(
        constantProfile,
        boilerPlant,
        heatLossKw,
        cBuilding,
      );
      trace.forEach(t => {
        expect(t).toBeGreaterThanOrEqual(10);
        expect(t).toBeLessThanOrEqual(26);
        expect(Number.isFinite(t)).toBe(true);
      });
    });
  });

  it('outdoorTempC override: warmer outdoor temp produces higher equilibrium than design (-3°C)', () => {
    const heatLossKw = 8;
    const cBuilding  = 50_000;
    const zeroPlant  = () => 0;
    const warmProfile = Array.from({ length: 24 }, () => ({ demand: 0, label: 'off' }));

    // With plant off, temperature decays toward outdoor.
    // Warmer outdoor → higher final temperature.
    const traceDefault = buildDynamicRoomTrace(warmProfile, zeroPlant, heatLossKw, cBuilding);
    const traceWarm    = buildDynamicRoomTrace(warmProfile, zeroPlant, heatLossKw, cBuilding, 10);

    expect(traceWarm[23]).toBeGreaterThan(traceDefault[23]);
  });
});

// ─── DHW demand (dhwKw) ───────────────────────────────────────────────────────

describe('LifestyleSimulationModule – dhwKw field', () => {
  it('each hourlyData entry includes a numeric dhwKw field', () => {
    const result = runLifestyleSimulationModule(baseInput);
    result.hourlyData.forEach(h => {
      expect(typeof h.dhwKw).toBe('number');
      expect(h.dhwKw).toBeGreaterThanOrEqual(0);
    });
  });

  it('professional profile has dhwKw > 0 at morning and evening peaks (07:00 and 18:00)', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'professional', occupancyCount: 2 });
    // Default timing: firstShowerHour=7, eveningPeakHour=18
    expect(result.hourlyData[7].dhwKw).toBeGreaterThan(0);   // morning peak
    expect(result.hourlyData[8].dhwKw).toBeGreaterThan(0);   // morning +1 window
    expect(result.hourlyData[18].dhwKw).toBeGreaterThan(0);  // evening peak
    expect(result.hourlyData[19].dhwKw).toBeGreaterThan(0);  // evening +1 window
  });

  it('dhwKw is zero during away/overnight hours for professional profile', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'professional', occupancyCount: 2 });
    // Away hours (no peaks): 09-16
    for (let h = 9; h <= 16; h++) {
      expect(result.hourlyData[h].dhwKw).toBe(0);
    }
  });

  it('dhwKw scales with occupancyCount: 4-person household has double the demand of 2-person', () => {
    const two  = runLifestyleSimulationModule({ ...baseInput, occupancyCount: 2 });
    const four = runLifestyleSimulationModule({ ...baseInput, occupancyCount: 4 });
    expect(four.hourlyData[7].dhwKw).toBeCloseTo(two.hourlyData[7].dhwKw * 2, 1);
  });

  it('evening dhwKw is 70% of morning dhwKw (as per spec)', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancyCount: 2 });
    // Default: morningPeakH=7, eveningPeakH=18
    expect(result.hourlyData[18].dhwKw).toBeCloseTo(result.hourlyData[7].dhwKw * 0.7, 1);
  });

  it('daily total dhwKw is non-zero for all three occupancy signatures', () => {
    const signatures = ['professional', 'steady_home', 'shift_worker'] as const;
    for (const sig of signatures) {
      const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: sig, occupancyCount: 2 });
      const totalDhwKw = result.hourlyData.reduce((s, h) => s + h.dhwKw, 0);
      expect(totalDhwKw).toBeGreaterThan(0);
    }
  });

  it('shift_worker profile has dhwKw peaks offset to 10:00 and 22:00 (not 07:00/18:00)', () => {
    const result = runLifestyleSimulationModule({ ...baseInput, occupancySignature: 'shift_worker', occupancyCount: 2 });
    // Offset peaks: firstShowerHour=10, eveningPeakHour=22
    expect(result.hourlyData[10].dhwKw).toBeGreaterThan(0);
    expect(result.hourlyData[22].dhwKw).toBeGreaterThan(0);
    // Standard morning peak (07:00) should be zero for shift_worker
    expect(result.hourlyData[7].dhwKw).toBe(0);
  });

  it('demandPreset firstShowerHour overrides default morning peak hour', () => {
    const result = runLifestyleSimulationModule({
      ...baseInput,
      occupancySignature: 'professional',
      occupancyCount: 2,
      demandPreset: 'single_working_adult',
      demandTimingOverrides: { firstShowerHour: 6 },
    });
    // Override to 06:00 — peaks should be at 06 and 07
    expect(result.hourlyData[6].dhwKw).toBeGreaterThan(0);
    expect(result.hourlyData[7].dhwKw).toBeGreaterThan(0);
    // 08:00 should be zero (outside the 2-hour window)
    expect(result.hourlyData[8].dhwKw).toBe(0);
  });
});
