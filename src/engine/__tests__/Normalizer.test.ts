import { describe, it, expect } from 'vitest';
import { normalizeInput } from '../normalizer/Normalizer';

const baseInput = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium' as const,
  primaryPipeDiameter: 22,
  heatLossWatts: 10000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional' as const,
  highOccupancy: false,
  preferCombi: true,
};

describe('Normalizer', () => {
  it('classifies SW postcode as hard water', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'SW1A 1AA' });
    expect(['hard', 'very_hard']).toContain(result.waterHardnessCategory);
  });

  it('calculates system volume from radiator count', () => {
    const result = normalizeInput({ ...baseInput, radiatorCount: 12 });
    expect(result.systemVolumeL).toBe(120);
  });

  it('blocks vented system for loft conversion', () => {
    const result = normalizeInput({ ...baseInput, hasLoftConversion: true });
    expect(result.canUseVentedSystem).toBe(false);
  });

  it('allows vented system without loft conversion', () => {
    const result = normalizeInput({ ...baseInput, hasLoftConversion: false });
    expect(result.canUseVentedSystem).toBe(true);
  });

  it('returns higher scale Rf for hard water', () => {
    const hardResult = normalizeInput({ ...baseInput, postcode: 'SW1A 1AA' });
    const softResult = normalizeInput({ ...baseInput, postcode: 'G1 1AA' });
    expect(hardResult.scaleRf).toBeGreaterThan(softResult.scaleRf);
  });

  // ── V3 additions ────────────────────────────────────────────────────────────

  it('sets scalingScaffoldCoefficient to 10.0 for a London (E) postcode', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'E1 6RF' });
    expect(result.scalingScaffoldCoefficient).toBe(10.0);
  });

  it('sets scalingScaffoldCoefficient to 10.0 for an Essex (SS) postcode', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'SS1 1AA' });
    expect(result.scalingScaffoldCoefficient).toBe(10.0);
  });

  it('sets scalingScaffoldCoefficient to 10.0 for an inner London (EC) postcode', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'EC1A 1BB' });
    expect(result.scalingScaffoldCoefficient).toBe(10.0);
  });

  it('sets scalingScaffoldCoefficient to 1.0 for a non-high-silica postcode', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'G1 1AA' });
    expect(result.scalingScaffoldCoefficient).toBe(1.0);
  });

  it('uses 6 L/kW proxy for system volume when radiatorCount is 0', () => {
    // 10 kW boiler → 6 × 10 = 60 L
    const result = normalizeInput({ ...baseInput, radiatorCount: 0, heatLossWatts: 10000 });
    expect(result.systemVolumeL).toBeCloseTo(60, 0);
  });

  it('uses radiator count when it is greater than zero', () => {
    const result = normalizeInput({ ...baseInput, radiatorCount: 8 });
    expect(result.systemVolumeL).toBe(80);
  });

  // ── Postcode expansion – Very Hard (300+ ppm) ────────────────────────────────

  it('classifies Kent (ME) postcode as very_hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'ME1 1AA' });
    expect(result.waterHardnessCategory).toBe('very_hard');
    expect(result.cacO3Level).toBe(300);
  });

  it('classifies Kent (CT) postcode as very_hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'CT1 1AA' });
    expect(result.waterHardnessCategory).toBe('very_hard');
  });

  it('classifies Kent (TN) postcode as very_hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'TN1 1AA' });
    expect(result.waterHardnessCategory).toBe('very_hard');
  });

  it('classifies Kent (DA) postcode as very_hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'DA1 1AA' });
    expect(result.waterHardnessCategory).toBe('very_hard');
  });

  it('classifies Hertfordshire (AL) postcode as very_hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'AL1 1AA' });
    expect(result.waterHardnessCategory).toBe('very_hard');
  });

  it('classifies Hertfordshire (LU) postcode as very_hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'LU1 1AA' });
    expect(result.waterHardnessCategory).toBe('very_hard');
  });

  it('classifies East Anglia (NR) postcode as very_hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'NR1 1AA' });
    expect(result.waterHardnessCategory).toBe('very_hard');
  });

  it('classifies East Anglia (IP) postcode as very_hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'IP1 1AA' });
    expect(result.waterHardnessCategory).toBe('very_hard');
  });

  it('classifies East Anglia (CB) postcode as very_hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'CB1 1AA' });
    expect(result.waterHardnessCategory).toBe('very_hard');
  });

  // ── Postcode expansion – Hard (180–300 ppm) ──────────────────────────────────

  it('classifies Yorkshire (LS – Leeds) postcode as hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'LS1 1AA' });
    expect(result.waterHardnessCategory).toBe('hard');
  });

  it('classifies Yorkshire (BD – Bradford) postcode as hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'BD1 1AA' });
    expect(result.waterHardnessCategory).toBe('hard');
  });

  it('classifies Yorkshire (HG – Harrogate) postcode as hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'HG1 1AA' });
    expect(result.waterHardnessCategory).toBe('hard');
  });

  it('classifies Lincolnshire (LN) postcode as hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'LN1 1AA' });
    expect(result.waterHardnessCategory).toBe('hard');
  });

  it('classifies Midlands (B – Birmingham) postcode as hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'B1 1AA' });
    expect(result.waterHardnessCategory).toBe('hard');
  });

  it('classifies Midlands (WV – Wolverhampton) postcode as hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'WV1 1AA' });
    expect(result.waterHardnessCategory).toBe('hard');
  });

  it('classifies Midlands (CV – Coventry) postcode as hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'CV1 1AA' });
    expect(result.waterHardnessCategory).toBe('hard');
  });

  it('classifies Midlands (DY – Dudley) postcode as hard', () => {
    const result = normalizeInput({ ...baseInput, postcode: 'DY1 1AA' });
    expect(result.waterHardnessCategory).toBe('hard');
  });

  // ── Two-water physics: sludgePotential ──────────────────────────────────────

  it('sludgePotential is 0 for a new system (systemAgeYears = 0)', () => {
    const result = normalizeInput({ ...baseInput, systemAgeYears: 0 });
    expect(result.sludgePotential).toBe(0);
  });

  it('sludgePotential increases with system age', () => {
    const young = normalizeInput({ ...baseInput, systemAgeYears: 5 });
    const old = normalizeInput({ ...baseInput, systemAgeYears: 15 });
    expect(old.sludgePotential).toBeGreaterThan(young.sludgePotential);
  });

  it('sludgePotential is higher for one_pipe topology vs two_pipe at same age', () => {
    const onePipe = normalizeInput({ ...baseInput, systemAgeYears: 10, pipingTopology: 'one_pipe' });
    const twoPipe = normalizeInput({ ...baseInput, systemAgeYears: 10, pipingTopology: 'two_pipe' });
    expect(onePipe.sludgePotential).toBeGreaterThan(twoPipe.sludgePotential);
  });

  it('sludgePotential is capped at 1.0', () => {
    const result = normalizeInput({ ...baseInput, systemAgeYears: 100, pipingTopology: 'one_pipe' });
    expect(result.sludgePotential).toBe(1);
  });

  // ── Two-water physics: scalingPotential ─────────────────────────────────────

  it('scalingPotential is higher for very_hard than hard water areas', () => {
    const veryHard = normalizeInput({ ...baseInput, postcode: 'ME1 1AA' }); // very_hard
    const hard = normalizeInput({ ...baseInput, postcode: 'LS1 1AA' });    // hard
    expect(veryHard.scalingPotential).toBeGreaterThan(hard.scalingPotential);
  });

  it('scalingPotential is higher for hard than soft water areas', () => {
    const hard = normalizeInput({ ...baseInput, postcode: 'LS1 1AA' });   // hard
    const soft = normalizeInput({ ...baseInput, postcode: 'G1 1AA' });    // soft
    expect(hard.scalingPotential).toBeGreaterThan(soft.scalingPotential);
  });

  it('scalingPotential is boosted for high-silica (London) postcodes', () => {
    const londonHard = normalizeInput({ ...baseInput, postcode: 'SW1A 1AA' }); // hard + high silica
    const nonSilicaHard = normalizeInput({ ...baseInput, postcode: 'LS1 1AA' }); // hard, no silica
    expect(londonHard.scalingPotential).toBeGreaterThan(nonSilicaHard.scalingPotential);
  });

  it('scalingPotential is 1.0 for very_hard water with high silica scaffold', () => {
    // DA postcode is both very_hard (Kent 300+ ppm) AND in HIGH_SILICA_PREFIXES →
    // scalingPotential = min(1, 300/300 * 1.5) = 1.0
    const result = normalizeInput({ ...baseInput, postcode: 'DA1 1AA' });
    expect(result.scalingPotential).toBe(1);
  });

  it('scalingPotential is between 0 and 1 for all hardness categories', () => {
    ['ME1 1AA', 'SW1A 1AA', 'LS1 1AA', 'G1 1AA'].forEach(postcode => {
      const result = normalizeInput({ ...baseInput, postcode });
      expect(result.scalingPotential).toBeGreaterThanOrEqual(0);
      expect(result.scalingPotential).toBeLessThanOrEqual(1);
    });
  });
});
