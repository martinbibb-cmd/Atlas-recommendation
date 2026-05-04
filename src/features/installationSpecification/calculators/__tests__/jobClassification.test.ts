/**
 * jobClassification.test.ts — Unit tests for classifyQuoteJob.
 *
 * Covers the problem-statement acceptance criteria:
 *   - Combi → combi, same location → like_for_like.
 *   - Combi → system stored (stored DHW upgrade).
 *
 * Also covers:
 *   - Heat pump proposals → low_carbon_conversion.
 *   - Same family, different location → relocation.
 *   - Different family (not combi-to-stored) → conversion.
 *   - Unknown inputs → needs_review.
 *   - Location matching via room label.
 *   - isSameLocation flag override.
 */

import { describe, it, expect } from 'vitest';
import { classifyQuoteJob } from '../jobClassification';
import type { QuoteSystemDescriptorV1 } from '../quotePlannerTypes';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function combi(room?: string): QuoteSystemDescriptorV1 {
  return {
    family: 'combi',
    heatSourceLocation: room ? { room } : undefined,
  };
}

function systemStored(room?: string): QuoteSystemDescriptorV1 {
  return {
    family: 'system_stored',
    heatSourceLocation: room ? { room } : undefined,
    hasStoredHotWater: true,
  };
}

function regularStored(room?: string): QuoteSystemDescriptorV1 {
  return {
    family: 'regular_stored',
    heatSourceLocation: room ? { room } : undefined,
    hasStoredHotWater: true,
  };
}

function heatPump(room?: string): QuoteSystemDescriptorV1 {
  return {
    family: 'heat_pump',
    heatSourceLocation: room ? { room } : undefined,
  };
}

function unknown(): QuoteSystemDescriptorV1 {
  return { family: 'unknown' };
}

// ─── Acceptance criteria ──────────────────────────────────────────────────────

describe('classifyQuoteJob — acceptance criteria', () => {
  it('combi → combi in same room classifies as like_for_like', () => {
    const result = classifyQuoteJob(combi('Kitchen'), combi('Kitchen'));
    expect(result.jobType).toBe('like_for_like');
  });

  it('combi → system_stored classifies as stored_hot_water_upgrade', () => {
    const result = classifyQuoteJob(combi('Kitchen'), systemStored('Airing cupboard'));
    expect(result.jobType).toBe('stored_hot_water_upgrade');
  });

  it('combi → regular_stored classifies as stored_hot_water_upgrade', () => {
    const result = classifyQuoteJob(combi('Kitchen'), regularStored('Loft'));
    expect(result.jobType).toBe('stored_hot_water_upgrade');
  });
});

// ─── Low-carbon conversion ────────────────────────────────────────────────────

describe('classifyQuoteJob — low-carbon conversion', () => {
  it('combi → heat pump classifies as low_carbon_conversion', () => {
    const result = classifyQuoteJob(combi('Kitchen'), heatPump('Garden'));
    expect(result.jobType).toBe('low_carbon_conversion');
  });

  it('system_stored → heat pump classifies as low_carbon_conversion', () => {
    const result = classifyQuoteJob(systemStored('Utility'), heatPump('Outside'));
    expect(result.jobType).toBe('low_carbon_conversion');
  });

  it('regular_stored → heat pump classifies as low_carbon_conversion', () => {
    const result = classifyQuoteJob(regularStored('Loft'), heatPump('Garden'));
    expect(result.jobType).toBe('low_carbon_conversion');
  });
});

// ─── Relocation ───────────────────────────────────────────────────────────────

describe('classifyQuoteJob — relocation', () => {
  it('combi → combi in different room classifies as relocation', () => {
    const result = classifyQuoteJob(combi('Kitchen'), combi('Utility room'));
    expect(result.jobType).toBe('relocation');
  });

  it('system_stored → system_stored in different room classifies as relocation', () => {
    const result = classifyQuoteJob(systemStored('Airing cupboard'), systemStored('Loft'));
    expect(result.jobType).toBe('relocation');
  });
});

// ─── Generic conversion ───────────────────────────────────────────────────────

describe('classifyQuoteJob — conversion', () => {
  it('system_stored → combi classifies as conversion', () => {
    const result = classifyQuoteJob(systemStored('Airing cupboard'), combi('Kitchen'));
    expect(result.jobType).toBe('conversion');
  });

  it('regular_stored → system_stored classifies as conversion', () => {
    const result = classifyQuoteJob(regularStored('Loft'), systemStored('Utility'));
    expect(result.jobType).toBe('conversion');
  });
});

// ─── Needs review ─────────────────────────────────────────────────────────────

describe('classifyQuoteJob — needs_review', () => {
  it('unknown current system → needs_review', () => {
    const result = classifyQuoteJob(unknown(), combi('Kitchen'));
    expect(result.jobType).toBe('needs_review');
  });

  it('unknown proposed system → needs_review', () => {
    const result = classifyQuoteJob(combi('Kitchen'), unknown());
    expect(result.jobType).toBe('needs_review');
  });

  it('both unknown → needs_review', () => {
    const result = classifyQuoteJob(unknown(), unknown());
    expect(result.jobType).toBe('needs_review');
  });

  it('same family without any location data → needs_review', () => {
    // Both combi but no location info → cannot confirm same or different location
    const result = classifyQuoteJob(
      { family: 'combi' },
      { family: 'combi' },
    );
    expect(result.jobType).toBe('needs_review');
  });
});

// ─── Location matching ────────────────────────────────────────────────────────

describe('classifyQuoteJob — location matching', () => {
  it('room comparison is case-insensitive', () => {
    const result = classifyQuoteJob(combi('kitchen'), combi('Kitchen'));
    expect(result.jobType).toBe('like_for_like');
  });

  it('room comparison trims whitespace', () => {
    const result = classifyQuoteJob(combi(' Kitchen '), combi('Kitchen'));
    expect(result.jobType).toBe('like_for_like');
  });

  it('isSameLocation: true forces like_for_like regardless of room string', () => {
    const current: QuoteSystemDescriptorV1 = {
      family: 'combi',
      heatSourceLocation: { room: 'Kitchen', isSameLocation: true },
    };
    const proposed: QuoteSystemDescriptorV1 = {
      family: 'combi',
      heatSourceLocation: { room: 'Utility room' },
    };
    const result = classifyQuoteJob(current, proposed);
    expect(result.jobType).toBe('like_for_like');
  });
});

// ─── Rationale ────────────────────────────────────────────────────────────────

describe('classifyQuoteJob — rationale', () => {
  it('includes a non-empty rationale string for every classification', () => {
    const cases: Array<[QuoteSystemDescriptorV1, QuoteSystemDescriptorV1]> = [
      [combi('Kitchen'), combi('Kitchen')],
      [combi('Kitchen'), combi('Utility')],
      [combi('Kitchen'), systemStored('Airing cupboard')],
      [combi('Kitchen'), heatPump('Garden')],
      [systemStored('Utility'), combi('Kitchen')],
      [unknown(), combi('Kitchen')],
    ];

    for (const [current, proposed] of cases) {
      const result = classifyQuoteJob(current, proposed);
      expect(result.rationale.length).toBeGreaterThan(0);
    }
  });
});
