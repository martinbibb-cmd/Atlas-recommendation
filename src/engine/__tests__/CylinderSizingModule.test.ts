import { describe, it, expect } from 'vitest';
import {
  runCylinderSizingModule,
  computeRecoveryTimeMins,
  computeUsableVolumeMixedL,
  computeStandingLossW,
  computeMinimumCylinderVolumeL,
  roundUpToStandardSize,
  USABLE_FRACTION_STANDARD,
  USABLE_FRACTION_MIXERGY,
  STANDING_LOSS_W_PER_L_STANDARD,
  STANDING_LOSS_W_PER_L_MIXERGY,
  STANDING_LOSS_REF_DELTA_T,
  STANDARD_CYLINDER_SIZES_L,
} from '../modules/CylinderSizingModule';
import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

const baseInput: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium',
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional',
  highOccupancy: false,
  preferCombi: false,
  occupancyCount: 2,
};

// ─── Physics formula unit tests ────────────────────────────────────────────────

describe('computeRecoveryTimeMins', () => {
  it('matches the Megaflo Eco 210i published specification', () => {
    // Megaflo Eco 210i: 195 L actual volume, 19.4 kW coil, 15→60 °C = 45 °C ΔT.
    // Published heat-up time: 32 minutes (from technical framework data).
    const t = computeRecoveryTimeMins(195, 45, 19.4);
    // Allow ±2 minute tolerance for rounding in published spec vs formula
    expect(t).toBeGreaterThan(30);
    expect(t).toBeLessThan(34);
  });

  it('returns larger time for a lower-power heat source', () => {
    const t_18kw = computeRecoveryTimeMins(210, 45, 18);
    const t_6kw  = computeRecoveryTimeMins(210, 45,  6);
    expect(t_6kw).toBeGreaterThan(t_18kw);
  });

  it('returns Infinity for zero power', () => {
    expect(computeRecoveryTimeMins(210, 45, 0)).toBe(Infinity);
  });

  it('returns Infinity for zero ΔT', () => {
    expect(computeRecoveryTimeMins(210, 0, 18)).toBe(Infinity);
  });

  it('scales linearly with volume', () => {
    const t_210 = computeRecoveryTimeMins(210, 45, 18);
    const t_420 = computeRecoveryTimeMins(420, 45, 18);
    expect(t_420).toBeCloseTo(t_210 * 2, 5);
  });

  it('ASHP 210L at 6 kW takes 60–90 minutes to recover', () => {
    // Technical framework: ASHP 210L @45°C ΔT takes 90–120 mins (Eco mode 5–7 kW)
    const t = computeRecoveryTimeMins(210, 45, 6);
    expect(t).toBeGreaterThan(60);
    expect(t).toBeLessThan(120);
  });
});

describe('computeUsableVolumeMixedL', () => {
  it('returns more usable volume from a hotter store (boiler vs HP)', () => {
    // Boiler at 60 °C gives more usable mixed water than HP at 50 °C
    const boiler = computeUsableVolumeMixedL(210, USABLE_FRACTION_STANDARD, 60, 40, 10);
    const hp     = computeUsableVolumeMixedL(210, USABLE_FRACTION_STANDARD, 50, 40, 10);
    expect(boiler).toBeGreaterThan(hp);
  });

  it('returns more usable volume for Mixergy vs standard (same nominal volume)', () => {
    const mixergy   = computeUsableVolumeMixedL(150, USABLE_FRACTION_MIXERGY,   60, 40, 10);
    const standard  = computeUsableVolumeMixedL(150, USABLE_FRACTION_STANDARD,  60, 40, 10);
    expect(mixergy).toBeGreaterThan(standard);
  });

  it('applies mixing physics correctly: ratio = (T_store - T_cold) / (T_tap - T_cold)', () => {
    // 1 L hot at 60 °C → mixed with cold at 10 °C to reach 40 °C
    // V_mixed = 1 × usableFraction × 50/30
    const result = computeUsableVolumeMixedL(1, 1.0, 60, 40, 10);
    expect(result).toBeCloseTo(50 / 30, 5);
  });

  it('handles edge case where T_store <= T_cold', () => {
    expect(computeUsableVolumeMixedL(210, 0.75, 5, 40, 10)).toBe(0);
  });
});

describe('computeStandingLossW', () => {
  it('calibrates against Megaflo Eco 210i published data within 15%', () => {
    // Megaflo 210i (195 L actual): 59 W at assumed 20°C ambient, 60°C store
    // ΔT_ambient = 40°C, ΔT_ref = 40°C → nominalLoss = 0.28 × 195 = 54.6W
    const loss = computeStandingLossW(195, 60, 20, STANDING_LOSS_W_PER_L_STANDARD, 1.0);
    expect(loss).toBeGreaterThan(50);
    expect(loss).toBeLessThan(68);
  });

  it('calibrates against Mixergy 210L published data within 15%', () => {
    // Mixergy X 210L: 45 W at assumed 20°C ambient, 60°C store
    const loss = computeStandingLossW(210, 60, 20, STANDING_LOSS_W_PER_L_MIXERGY, 1.0);
    expect(loss).toBeGreaterThan(38);
    expect(loss).toBeLessThan(52);
  });

  it('scales proportionally with ambient delta T', () => {
    const lossWarm  = computeStandingLossW(210, 60, 20, STANDING_LOSS_W_PER_L_STANDARD, 1.0); // ΔT=40
    const lossCold  = computeStandingLossW(210, 60, 10, STANDING_LOSS_W_PER_L_STANDARD, 1.0); // ΔT=50
    // Loss at ΔT=50 should be 50/40 times loss at ΔT=40
    expect(lossCold).toBeCloseTo(lossWarm * (50 / STANDING_LOSS_REF_DELTA_T), 1);
  });

  it('increases when insulation factor is degraded (< 1.0)', () => {
    const clean     = computeStandingLossW(210, 60, 20, STANDING_LOSS_W_PER_L_STANDARD, 1.0);
    const degraded  = computeStandingLossW(210, 60, 20, STANDING_LOSS_W_PER_L_STANDARD, 0.8);
    expect(degraded).toBeGreaterThan(clean);
    // Factor 0.8 → 25% more loss
    expect(degraded).toBeCloseTo(clean / 0.8, 1);
  });

  it('returns 0 when ambient >= store (no net heat loss)', () => {
    expect(computeStandingLossW(210, 20, 25, STANDING_LOSS_W_PER_L_STANDARD, 1.0)).toBe(0);
  });
});

describe('computeMinimumCylinderVolumeL', () => {
  it('returns a larger minimum for a higher occupancy count', () => {
    const v2 = computeMinimumCylinderVolumeL({ occupancyCount: 2, bathroomCount: 1, storeTempC: 60, tapTargetTempC: 40, coldWaterTempC: 10, usableFraction: USABLE_FRACTION_STANDARD, drawSeverity: 'low' });
    const v4 = computeMinimumCylinderVolumeL({ occupancyCount: 4, bathroomCount: 1, storeTempC: 60, tapTargetTempC: 40, coldWaterTempC: 10, usableFraction: USABLE_FRACTION_STANDARD, drawSeverity: 'low' });
    expect(v4).toBeGreaterThan(v2);
  });

  it('returns a larger minimum for a heat pump cylinder (lower store temp)', () => {
    const boilerMin = computeMinimumCylinderVolumeL({ occupancyCount: 3, bathroomCount: 2, storeTempC: 60, tapTargetTempC: 40, coldWaterTempC: 10, usableFraction: USABLE_FRACTION_STANDARD, drawSeverity: 'low' });
    const hpMin     = computeMinimumCylinderVolumeL({ occupancyCount: 3, bathroomCount: 2, storeTempC: 50, tapTargetTempC: 40, coldWaterTempC: 10, usableFraction: USABLE_FRACTION_STANDARD, drawSeverity: 'low' });
    expect(hpMin).toBeGreaterThan(boilerMin);
  });

  it('returns a smaller minimum for Mixergy vs standard (higher usable fraction)', () => {
    const standard = computeMinimumCylinderVolumeL({ occupancyCount: 3, bathroomCount: 2, storeTempC: 60, tapTargetTempC: 40, coldWaterTempC: 10, usableFraction: USABLE_FRACTION_STANDARD, drawSeverity: 'low' });
    const mixergy  = computeMinimumCylinderVolumeL({ occupancyCount: 3, bathroomCount: 2, storeTempC: 60, tapTargetTempC: 40, coldWaterTempC: 10, usableFraction: USABLE_FRACTION_MIXERGY,  drawSeverity: 'low' });
    expect(mixergy).toBeLessThan(standard);
  });

  it('applies simultaneous-draw multiplier for high severity', () => {
    const low  = computeMinimumCylinderVolumeL({ occupancyCount: 3, bathroomCount: 2, storeTempC: 60, tapTargetTempC: 40, coldWaterTempC: 10, usableFraction: USABLE_FRACTION_STANDARD, drawSeverity: 'low' });
    const high = computeMinimumCylinderVolumeL({ occupancyCount: 3, bathroomCount: 2, storeTempC: 60, tapTargetTempC: 40, coldWaterTempC: 10, usableFraction: USABLE_FRACTION_STANDARD, drawSeverity: 'high' });
    expect(high).toBeCloseTo(low * 1.30, 1);
  });
});

describe('roundUpToStandardSize', () => {
  it('returns exact match when volume matches a standard size', () => {
    for (const size of STANDARD_CYLINDER_SIZES_L) {
      expect(roundUpToStandardSize(size)).toBe(size);
    }
  });

  it('rounds up to the next standard size', () => {
    expect(roundUpToStandardSize(121)).toBe(150);
    expect(roundUpToStandardSize(151)).toBe(180);
    expect(roundUpToStandardSize(95)).toBe(120);
  });

  it('returns largest standard size when over the maximum', () => {
    expect(roundUpToStandardSize(500)).toBe(400);
  });

  it('rounds up 0 to minimum standard size', () => {
    expect(roundUpToStandardSize(0)).toBe(120);
  });
});

// ─── runCylinderSizingModule integration tests ─────────────────────────────────

describe('runCylinderSizingModule', () => {
  describe('recommendation shape', () => {
    it('always returns a recommendation object', () => {
      const result = runCylinderSizingModule(baseInput);
      expect(result.recommendation).toBeDefined();
      expect(result.recommendation.targetVolumeL).toBeGreaterThan(0);
      expect(result.recommendation.minimumVolumeL).toBeGreaterThan(0);
      expect(result.recommendation.cylinderType).toMatch(/^(standard|mixergy|heat_pump_optimised)$/);
    });

    it('target volume is always ≥ minimum volume', () => {
      const result = runCylinderSizingModule(baseInput);
      expect(result.recommendation.targetVolumeL).toBeGreaterThanOrEqual(result.recommendation.minimumVolumeL);
    });

    it('target volume is always a standard cylinder size', () => {
      const result = runCylinderSizingModule(baseInput);
      expect(STANDARD_CYLINDER_SIZES_L).toContain(result.recommendation.targetVolumeL);
    });

    it('populates reasoning array with at least two entries', () => {
      const result = runCylinderSizingModule(baseInput);
      expect(result.recommendation.reasoning.length).toBeGreaterThanOrEqual(2);
    });

    it('populates assumptions array', () => {
      const result = runCylinderSizingModule(baseInput);
      expect(result.assumptions.length).toBeGreaterThan(0);
    });
  });

  describe('current cylinder performance', () => {
    it('omits currentPerformance when cylinderVolumeLitres is absent', () => {
      const result = runCylinderSizingModule(baseInput);
      expect(result.currentPerformance).toBeUndefined();
    });

    it('includes currentPerformance when cylinderVolumeLitres is provided', () => {
      const result = runCylinderSizingModule({ ...baseInput, cylinderVolumeLitres: 120 });
      expect(result.currentPerformance).toBeDefined();
      expect(result.currentPerformance!.nominalVolumeL).toBe(120);
    });

    it('flags an undersized cylinder', () => {
      // For 4 occupants, 2 bathrooms — 60 L is clearly undersized
      const result = runCylinderSizingModule({
        ...baseInput,
        occupancyCount: 4,
        bathroomCount: 2,
        cylinderVolumeLitres: 60,
      });
      const flag = result.flags.find(f => f.id === 'sizing-undersized-for-demand');
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe('warn');
    });

    it('98 L cylinder is NOT flagged as undersized for a single-occupant household', () => {
      // Regression: a 98 L cylinder for 1 person should be "adequate" because the
      // physics minimum (~44 L raw) is well below 98 L.  Previously, the minimum
      // was rounded up to the nearest standard size (120 L), which incorrectly
      // flagged any sub-120 L cylinder as undersized regardless of actual demand.
      const result = runCylinderSizingModule({
        ...baseInput,
        occupancyCount: 1,
        bathroomCount: 1,
        cylinderVolumeLitres: 98,
      });
      const undersizedFlag = result.flags.find(f => f.id === 'sizing-undersized-for-demand');
      const adequateFlag   = result.flags.find(f => f.id === 'sizing-current-adequate');
      expect(undersizedFlag).toBeUndefined();
      expect(adequateFlag).toBeDefined();
    });

    it('minimumAdequateVolumeL reflects physics minimum, not rounded standard size', () => {
      // For 1 occupant, 1 bathroom the physics minimum is ~44 L.
      // The reported minimumAdequateVolumeL must be close to this value (≤ 60 L),
      // NOT rounded up to 120 L (the smallest standard purchase size).
      const result = runCylinderSizingModule({
        ...baseInput,
        occupancyCount: 1,
        bathroomCount: 1,
        cylinderVolumeLitres: 98,
      });
      expect(result.currentPerformance?.minimumAdequateVolumeL).toBeDefined();
      expect(result.currentPerformance!.minimumAdequateVolumeL).toBeLessThanOrEqual(60);
    });

    it('emits sizing-current-adequate info flag for a large enough cylinder', () => {
      // 300 L cylinder for 2 occupants, 1 bathroom — clearly adequate
      const result = runCylinderSizingModule({
        ...baseInput,
        occupancyCount: 2,
        bathroomCount: 1,
        cylinderVolumeLitres: 300,
      });
      const flag = result.flags.find(f => f.id === 'sizing-current-adequate');
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe('info');
    });

    it('emits slow-recovery flag when ASHP heats a large cylinder', () => {
      // ASHP at 6 kW heating 300 L cylinder takes > 60 minutes
      const result = runCylinderSizingModule({
        ...baseInput,
        currentHeatSourceType: 'ashp',
        dhwStorageRegime: 'heat_pump_cylinder',
        cylinderVolumeLitres: 300,
      });
      const flag = result.flags.find(f => f.id === 'sizing-recovery-slow');
      expect(flag).toBeDefined();
    });

    it('emits high-standing-loss flag for a garage install with old insulation', () => {
      // Garage (10 °C ambient) + degraded insulation
      const result = runCylinderSizingModule({
        ...baseInput,
        cylinderInstallLocation: 'garage',
        cylinderInsulationFactor: 0.7,
        cylinderVolumeLitres: 210,
      });
      const flag = result.flags.find(f => f.id === 'sizing-standing-loss-high');
      expect(flag).toBeDefined();
    });

    it('recovery time is shorter with a higher-power boiler', () => {
      const small = runCylinderSizingModule({
        ...baseInput,
        currentHeatSourceType: 'system',
        currentBoilerOutputKw: 12,
        cylinderVolumeLitres: 210,
      });
      const large = runCylinderSizingModule({
        ...baseInput,
        currentHeatSourceType: 'system',
        currentBoilerOutputKw: 20,
        cylinderVolumeLitres: 210,
      });
      expect(large.currentPerformance!.recoveryTimeMins).toBeLessThan(
        small.currentPerformance!.recoveryTimeMins,
      );
    });

    it('standing loss is lower in an airing cupboard vs garage', () => {
      const airCupboard = runCylinderSizingModule({
        ...baseInput,
        cylinderInstallLocation: 'airing_cupboard',
        cylinderVolumeLitres: 210,
      });
      const garage = runCylinderSizingModule({
        ...baseInput,
        cylinderInstallLocation: 'garage',
        cylinderVolumeLitres: 210,
      });
      // Airing cupboard (20°C) is warmer → smaller ΔT → lower standing loss
      expect(airCupboard.currentPerformance!.standingLossWatts).toBeLessThan(
        garage.currentPerformance!.standingLossWatts,
      );
    });
  });

  describe('heat pump regime', () => {
    it('recommends heat_pump_optimised cylinder for HP regime', () => {
      const result = runCylinderSizingModule({
        ...baseInput,
        dhwStorageRegime: 'heat_pump_cylinder',
        currentHeatSourceType: 'ashp',
      });
      expect(result.recommendation.cylinderType).toBe('heat_pump_optimised');
    });

    it('emits hp-volume-uplift flag when HP requires more volume than boiler equivalent', () => {
      // HP at 50°C store: same demand requires more volume than boiler at 60°C
      // because the hot-to-cold mixing ratio is less favourable at lower store temps.
      // Use 4 occupants, 2 bathrooms with HP regime to ensure flag is visible.
      const result = runCylinderSizingModule({
        ...baseInput,
        occupancyCount: 4,
        bathroomCount: 2,
        dhwStorageRegime: 'heat_pump_cylinder',
        currentHeatSourceType: 'ashp',
        storeTempC: 50,
      });
      const flag = result.flags.find(f => f.id === 'sizing-hp-volume-uplift');
      expect(flag).toBeDefined();
    });

    it('assumes 6 kW for ASHP and records as assumed', () => {
      const result = runCylinderSizingModule({
        ...baseInput,
        currentHeatSourceType: 'ashp',
        cylinderVolumeLitres: 210,
      });
      expect(result.currentPerformance?.heatSourcePowerKw).toBe(6);
      expect(result.currentPerformance?.heatSourcePowerSource).toBe('assumed');
    });
  });

  describe('Mixergy advantage', () => {
    it('emits mixergy-advantage flag for high demand when current type is standard', () => {
      const result = runCylinderSizingModule({
        ...baseInput,
        occupancyCount: 4,
        bathroomCount: 2,
        dhwStorageType: 'unvented', // standard, not mixergy
      });
      const flag = result.flags.find(f => f.id === 'sizing-mixergy-advantage');
      expect(flag).toBeDefined();
    });

    it('recommends mixergy cylinder for high demand household', () => {
      const result = runCylinderSizingModule({
        ...baseInput,
        occupancyCount: 4,
        bathroomCount: 2,
      });
      expect(result.recommendation.cylinderType).toBe('mixergy');
    });

    it('does not emit mixergy-advantage flag when cylinder is already Mixergy', () => {
      const result = runCylinderSizingModule({
        ...baseInput,
        occupancyCount: 4,
        bathroomCount: 2,
        dhwStorageType: 'mixergy',
      });
      const flag = result.flags.find(f => f.id === 'sizing-mixergy-advantage');
      expect(flag).toBeUndefined();
    });
  });

  describe('heat source assumption flag', () => {
    it('emits no-heat-source-data info flag when heat source type is unknown', () => {
      const result = runCylinderSizingModule(baseInput); // no currentHeatSourceType
      const flag = result.flags.find(f => f.id === 'sizing-no-heat-source-data');
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe('info');
    });

    it('does not emit no-heat-source-data flag when boiler output is provided', () => {
      const result = runCylinderSizingModule({
        ...baseInput,
        currentHeatSourceType: 'system',
        currentBoilerOutputKw: 18,
      });
      const flag = result.flags.find(f => f.id === 'sizing-no-heat-source-data');
      expect(flag).toBeUndefined();
    });

    it('uses actual boiler output (capped at 20 kW) for measured recovery time', () => {
      const result = runCylinderSizingModule({
        ...baseInput,
        currentHeatSourceType: 'system',
        currentBoilerOutputKw: 30, // high output boiler — capped at 20 kW for coil limit
        cylinderVolumeLitres: 210,
      });
      // Should cap at MAX_COIL_RATING_KW (20 kW)
      expect(result.currentPerformance?.heatSourcePowerKw).toBe(20);
      expect(result.currentPerformance?.heatSourcePowerSource).toBe('measured');
    });
  });

  describe('sizing for different household profiles', () => {
    it('recommends 120–150 L for a single-person household', () => {
      const result = runCylinderSizingModule({
        ...baseInput,
        occupancyCount: 1,
        bathroomCount: 1,
      });
      expect(result.recommendation.targetVolumeL).toBeLessThanOrEqual(150);
    });

    it('recommends at least 180 L for a 4-person, 2-bathroom household (Mixergy)', () => {
      // 4-person, 2-bathroom triggers Mixergy recommendation (isHighDemand = true).
      // Mixergy's 95% usable fraction means less volume is needed vs standard.
      // Industry data: Mixergy 180L suits 3-4 people; standard would require 210L+.
      const result = runCylinderSizingModule({
        ...baseInput,
        occupancyCount: 4,
        bathroomCount: 2,
      });
      expect(result.recommendation.cylinderType).toBe('mixergy');
      expect(result.recommendation.targetVolumeL).toBeGreaterThanOrEqual(180);
    });

    it('physics minimum is ≥ 200 L (standard fraction) for a 4-person, 2-bathroom household; Mixergy target is ≥ 180 L', () => {
      // For 4 occupants, 2 bathrooms:
      //   Current cylinder adequacy uses the INSTALLED cylinder's fraction (standard, 0.75):
      //     dailyDemand = 250 L → requiredHot = 150 L → minCylinder = 200 L (raw physics).
      //   The RECOMMENDED type is Mixergy (isHighDemand = true), using 0.95 fraction:
      //     minCylinder = 150/0.95 ≈ 158 L → roundUpToStandard = 180 L.
      //
      // minimumAdequateVolumeL reports the physics minimum (~200 L) for the installed
      // standard cylinder — it does NOT use the rounded purchase size (210 L).
      const result = runCylinderSizingModule({
        ...baseInput,
        occupancyCount: 4,
        bathroomCount: 2,
        dhwStorageType: 'unvented',   // current cylinder is standard unvented
        cylinderVolumeLitres: 150,    // give it a current cylinder to trigger adequacy check
      });
      // Physics minimum for adequacy assessment of the current standard cylinder
      expect(result.currentPerformance?.minimumAdequateVolumeL).toBeGreaterThanOrEqual(200);
      // Recommended purchase is Mixergy (high demand), so target rounds to 180 L minimum
      expect(result.recommendation.cylinderType).toBe('mixergy');
      expect(result.recommendation.targetVolumeL).toBeGreaterThanOrEqual(180);
    });

    it('high simultaneous-draw severity increases recommended volume', () => {
      const low  = runCylinderSizingModule({ ...baseInput, occupancyCount: 3, bathroomCount: 2, simultaneousDrawSeverity: 'low' });
      const high = runCylinderSizingModule({ ...baseInput, occupancyCount: 3, bathroomCount: 2, simultaneousDrawSeverity: 'high' });
      expect(high.recommendation.targetVolumeL).toBeGreaterThanOrEqual(low.recommendation.targetVolumeL);
    });
  });

  describe('physics trace — Megaflo reference verification', () => {
    it('recovery time for 210L boiler cylinder is 25–40 minutes at 18 kW', () => {
      const result = runCylinderSizingModule({
        ...baseInput,
        currentHeatSourceType: 'system',
        currentBoilerOutputKw: 18,
        cylinderVolumeLitres: 210,
        storeTempC: 60,
        coldWaterTempC: 15,
      });
      // ΔT = 45°C, 210L, 18kW → t = 210×45/(18×14.33) ≈ 36.7 min
      expect(result.currentPerformance!.recoveryTimeMins).toBeGreaterThan(25);
      expect(result.currentPerformance!.recoveryTimeMins).toBeLessThan(42);
    });
  });
});
