import { describe, it, expect } from 'vitest';
import { runRegionalHardness } from '../modules/RegionalHardness';

describe('RegionalHardness – Dorset (DT)', () => {
  it('classifies DT (Dorset) as very_hard', () => {
    const result = runRegionalHardness('DT9 3AQ');
    expect(result.hardnessCategory).toBe('very_hard');
  });

  it('returns ppm >= 300 for Dorset', () => {
    const result = runRegionalHardness('DT1 1AA');
    expect(result.ppmLevel).toBeGreaterThanOrEqual(300);
  });

  it('reports the DT prefix', () => {
    const result = runRegionalHardness('DT9 3AQ');
    expect(result.postcodePrefix).toBe('DT');
  });

  it('flags Dorset as silicate-scaffold active (Jurassic limestone / Chalk)', () => {
    const result = runRegionalHardness('DT1 1AA');
    expect(result.silicateTaxActive).toBe(true);
  });
});

describe('RegionalHardness – Bournemouth (BH)', () => {
  it('classifies BH (Bournemouth) as hard', () => {
    const result = runRegionalHardness('BH1 1AA');
    expect(result.hardnessCategory).toBe('hard');
  });

  it('returns ppm in the 250–290 range for Bournemouth', () => {
    const result = runRegionalHardness('BH1 1AA');
    expect(result.ppmLevel).toBeGreaterThanOrEqual(250);
    expect(result.ppmLevel).toBeLessThanOrEqual(290);
  });

  it('reports the BH prefix', () => {
    const result = runRegionalHardness('BH9 1AA');
    expect(result.postcodePrefix).toBe('BH');
  });

  it('flags Bournemouth as silicate-scaffold active (Jurassic limestone / Chalk)', () => {
    const result = runRegionalHardness('BH1 1AA');
    expect(result.silicateTaxActive).toBe(true);
  });

  it('description references Dorset Chalk / Jurassic limestone for BH', () => {
    const result = runRegionalHardness('BH1 1AA');
    expect(result.description).toContain('Dorset Chalk');
  });

  it('returns a non-empty notes array for BH', () => {
    const result = runRegionalHardness('BH1 1AA');
    expect(result.notes.length).toBeGreaterThan(0);
  });
});

describe('RegionalHardness – Kent hotspots', () => {
  it('classifies ME (Maidstone) as very_hard', () => {
    const result = runRegionalHardness('ME1 1AA');
    expect(result.hardnessCategory).toBe('very_hard');
    expect(result.ppmLevel).toBeGreaterThanOrEqual(300);
  });

  it('classifies CT (Canterbury) as very_hard', () => {
    const result = runRegionalHardness('CT1 1AA');
    expect(result.hardnessCategory).toBe('very_hard');
  });

  it('classifies TN (Tunbridge Wells) as very_hard', () => {
    const result = runRegionalHardness('TN1 1AA');
    expect(result.hardnessCategory).toBe('very_hard');
  });

  it('classifies DA (Dartford) as very_hard and high-silica', () => {
    const result = runRegionalHardness('DA1 1AA');
    expect(result.hardnessCategory).toBe('very_hard');
    expect(result.silicateTaxActive).toBe(true);
  });
});

describe('RegionalHardness – East Anglia hotspots', () => {
  it('classifies NR (Norwich) as very_hard', () => {
    const result = runRegionalHardness('NR1 1AA');
    expect(result.hardnessCategory).toBe('very_hard');
    expect(result.ppmLevel).toBeGreaterThanOrEqual(300);
  });

  it('classifies IP (Ipswich) as very_hard', () => {
    const result = runRegionalHardness('IP1 1AA');
    expect(result.hardnessCategory).toBe('very_hard');
  });
});

describe('RegionalHardness – London / Essex (high-silica)', () => {
  it('classifies SW (London SW) as hard or very_hard', () => {
    const result = runRegionalHardness('SW1A 1AA');
    expect(['hard', 'very_hard']).toContain(result.hardnessCategory);
  });

  it('flags SW London as high-silica', () => {
    const result = runRegionalHardness('SW1A 1AA');
    expect(result.silicateTaxActive).toBe(true);
  });

  it('classifies SS (Southend) as hard', () => {
    const result = runRegionalHardness('SS1 1AA');
    expect(['hard', 'very_hard']).toContain(result.hardnessCategory);
    expect(result.silicateTaxActive).toBe(true);
  });
});

describe('RegionalHardness – Yorkshire', () => {
  it('classifies LS (Leeds) as hard', () => {
    const result = runRegionalHardness('LS1 1AA');
    expect(result.hardnessCategory).toBe('hard');
  });

  it('classifies BD (Bradford) as hard', () => {
    const result = runRegionalHardness('BD1 1AA');
    expect(result.hardnessCategory).toBe('hard');
  });
});

describe('RegionalHardness – Soft water areas', () => {
  it('classifies G (Glasgow) as soft', () => {
    const result = runRegionalHardness('G1 1AA');
    expect(result.hardnessCategory).toBe('soft');
    expect(result.silicateTaxActive).toBe(false);
  });

  it('classifies M (Manchester) as soft', () => {
    const result = runRegionalHardness('M1 1AA');
    expect(result.hardnessCategory).toBe('soft');
  });
});

describe('RegionalHardness – output structure', () => {
  it('returns a non-empty description', () => {
    const result = runRegionalHardness('DT9 3AQ');
    expect(result.description.length).toBeGreaterThan(0);
  });

  it('includes ppm in the description', () => {
    const result = runRegionalHardness('ME1 1AA');
    expect(result.description).toContain('ppm');
  });

  it('returns notes array', () => {
    const result = runRegionalHardness('DT1 1AA');
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('silicate tax note is present when active', () => {
    const result = runRegionalHardness('SW1A 1AA');
    expect(result.notes.some(n => n.toLowerCase().includes('silicate tax'))).toBe(true);
  });
});
