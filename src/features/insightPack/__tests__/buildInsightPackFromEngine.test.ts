/**
 * buildInsightPackFromEngine.test.ts
 *
 * Tests for the Atlas Insight Pack builder.
 *
 * Verifies:
 *   - All five rating dimensions are always populated.
 *   - RatingBand values are valid — no numeric scores.
 *   - Limitations map from engine red flags (not invented).
 *   - Best advice recommendation aligns with engine output.
 *   - No Math.random() usage (static output for same input).
 *   - DEFAULT_NOMINAL_EFFICIENCY_PCT used in efficiency physics strings.
 */

import { describe, it, expect } from 'vitest';
import { buildInsightPackFromEngine } from '../buildInsightPackFromEngine';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { QuoteInput, RatingBand } from '../insightPack.types';
import { DEFAULT_NOMINAL_EFFICIENCY_PCT } from '../../../engine/utils/efficiency';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const VALID_BANDS: RatingBand[] = [
  'Excellent',
  'Very Good',
  'Good',
  'Needs Right Setup',
  'Less Suited',
];

function makeMinimalEngineOutput(overrides: Partial<EngineOutputV1> = {}): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: [],
    recommendation: { primary: 'System boiler with stored cylinder' },
    explainers: [],
    options: [],
    ...overrides,
  };
}

const COMBI_QUOTE: QuoteInput = {
  id: 'quote_a',
  label: 'Quote A — Combi',
  systemType: 'combi',
  heatSourceKw: 30,
  includedUpgrades: [],
};

const SYSTEM_QUOTE: QuoteInput = {
  id: 'quote_b',
  label: 'Quote B — System + Cylinder',
  systemType: 'system',
  heatSourceKw: 25,
  cylinder: { type: 'standard', volumeL: 180 },
  includedUpgrades: ['filter', 'powerflush'],
};

const MIXERGY_QUOTE: QuoteInput = {
  id: 'quote_c',
  label: 'Quote C — System + Mixergy',
  systemType: 'system',
  heatSourceKw: 25,
  cylinder: { type: 'mixergy', volumeL: 180 },
  includedUpgrades: ['filter'],
};

const ASHP_QUOTE: QuoteInput = {
  id: 'quote_d',
  label: 'Quote D — ASHP',
  systemType: 'ashp',
  heatSourceKw: 10,
  cylinder: { type: 'standard', volumeL: 200 },
  includedUpgrades: [],
};

// ─── Core shape guarantees ────────────────────────────────────────────────────

describe('buildInsightPackFromEngine — shape', () => {
  it('returns one QuoteInsight per submitted quote', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [
      COMBI_QUOTE,
      SYSTEM_QUOTE,
    ]);
    expect(pack.quotes).toHaveLength(2);
    expect(pack.quotes[0].quote.id).toBe('quote_a');
    expect(pack.quotes[1].quote.id).toBe('quote_b');
  });

  it('always returns bestAdvice and savingsPlan', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [COMBI_QUOTE]);
    expect(pack.bestAdvice).toBeDefined();
    expect(pack.bestAdvice.recommendation).toBeDefined();
    expect(pack.bestAdvice.because).toBeInstanceOf(Array);
    expect(pack.bestAdvice.avoids).toBeInstanceOf(Array);
    expect(pack.savingsPlan).toBeDefined();
  });

  it('savings plan always contains all three sections', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [COMBI_QUOTE]);
    expect(pack.savingsPlan.behaviour.length).toBeGreaterThan(0);
    expect(pack.savingsPlan.settings.length).toBeGreaterThan(0);
    expect(pack.savingsPlan.futureUpgrades.length).toBeGreaterThan(0);
  });
});

// ─── Rating validity ──────────────────────────────────────────────────────────

describe('buildInsightPackFromEngine — ratings', () => {
  it('all five rating dimensions are present for each quote', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [COMBI_QUOTE]);
    const { rating } = pack.quotes[0];
    expect(rating.hotWaterPerformance).toBeDefined();
    expect(rating.heatingPerformance).toBeDefined();
    expect(rating.efficiency).toBeDefined();
    expect(rating.reliability).toBeDefined();
    expect(rating.suitability).toBeDefined();
  });

  it('all rating bands are valid RatingBand values', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [
      COMBI_QUOTE, SYSTEM_QUOTE, MIXERGY_QUOTE, ASHP_QUOTE,
    ]);
    for (const qi of pack.quotes) {
      for (const dim of Object.values(qi.rating)) {
        expect(VALID_BANDS).toContain(dim.rating);
      }
    }
  });

  it('each rating explanation contains non-empty reason and physics strings', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [COMBI_QUOTE]);
    const { rating } = pack.quotes[0];
    for (const dim of Object.values(rating)) {
      expect(dim.reason.length).toBeGreaterThan(0);
      expect(dim.physics.length).toBeGreaterThan(0);
    }
  });

  it('does not use numeric scores (no "/ 100" or "out of 100" in any rating string)', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [
      COMBI_QUOTE, SYSTEM_QUOTE,
    ]);
    const strings = pack.quotes.flatMap(qi =>
      Object.values(qi.rating).flatMap(r => [r.rating, r.reason, r.physics]),
    );
    for (const s of strings) {
      expect(s).not.toMatch(/\d+\s*\/\s*100/);
      expect(s).not.toMatch(/out of 100/i);
    }
  });
});

// ─── Hot water performance rules ──────────────────────────────────────────────

describe('hot water performance rules', () => {
  it('stored cylinder with no fail flags → Excellent', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [SYSTEM_QUOTE]);
    expect(pack.quotes[0].rating.hotWaterPerformance.rating).toBe('Excellent');
  });

  it('Mixergy cylinder → Excellent with Mixergy-specific physics note', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [MIXERGY_QUOTE]);
    const hw = pack.quotes[0].rating.hotWaterPerformance;
    expect(hw.rating).toBe('Excellent');
    expect(hw.physics.toLowerCase()).toContain('mixergy');
  });

  it('combi with simultaneous-demand fail flag → Less Suited', () => {
    const output = makeMinimalEngineOutput({
      redFlags: [
        {
          id: 'combi-simultaneous-demand',
          severity: 'fail',
          title: 'On-demand combi cannot sustain simultaneous demand',
          detail: 'Two bathrooms detected.',
        },
      ],
    });
    const pack = buildInsightPackFromEngine(output, [COMBI_QUOTE]);
    expect(pack.quotes[0].rating.hotWaterPerformance.rating).toBe('Less Suited');
  });

  it('combi with no DHW flags and single bathroom → Very Good', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [COMBI_QUOTE]);
    expect(pack.quotes[0].rating.hotWaterPerformance.rating).toBe('Very Good');
  });
});

// ─── Efficiency rules ─────────────────────────────────────────────────────────

describe('efficiency rating rules', () => {
  it('combi with short-draw flag → Needs Right Setup', () => {
    const output = makeMinimalEngineOutput({
      redFlags: [
        {
          id: 'combi-short-draw-collapse',
          severity: 'warn',
          title: 'Short draws collapse efficiency',
          detail: 'Short draws end before steady-state condensing mode.',
        },
      ],
    });
    const pack = buildInsightPackFromEngine(output, [COMBI_QUOTE]);
    expect(pack.quotes[0].rating.efficiency.rating).toBe('Needs Right Setup');
  });

  it('efficiency physics string references DEFAULT_NOMINAL_EFFICIENCY_PCT', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [COMBI_QUOTE]);
    const effPhysics = pack.quotes[0].rating.efficiency.physics;
    expect(effPhysics).toContain(String(DEFAULT_NOMINAL_EFFICIENCY_PCT));
  });

  it('system boiler + no cycling flag → Excellent efficiency', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [SYSTEM_QUOTE]);
    expect(pack.quotes[0].rating.efficiency.rating).toBe('Excellent');
  });

  it('ASHP → Very Good efficiency', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [ASHP_QUOTE]);
    expect(pack.quotes[0].rating.efficiency.rating).toBe('Very Good');
  });
});

// ─── Reliability rules ────────────────────────────────────────────────────────

describe('reliability rating rules', () => {
  it('system boiler with flush + filter → Excellent reliability', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [SYSTEM_QUOTE]);
    expect(pack.quotes[0].rating.reliability.rating).toBe('Excellent');
  });

  it('combi with flush + filter → Very Good (not Excellent — combi capped)', () => {
    const combiWithFlushFilter: QuoteInput = {
      ...COMBI_QUOTE,
      includedUpgrades: ['powerflush', 'filter'],
    };
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [combiWithFlushFilter]);
    expect(pack.quotes[0].rating.reliability.rating).toBe('Very Good');
  });

  it('combi reliability is never Excellent regardless of upgrades', () => {
    const combiAllUpgrades: QuoteInput = {
      ...COMBI_QUOTE,
      includedUpgrades: ['powerflush', 'filter', 'controls', 'trvs'],
    };
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [combiAllUpgrades]);
    expect(pack.quotes[0].rating.reliability.rating).not.toBe('Excellent');
  });

  it('fail-severity red flag → Needs Right Setup reliability', () => {
    const output = makeMinimalEngineOutput({
      redFlags: [
        {
          id: 'combi-pressure-constraint',
          severity: 'fail',
          title: 'Mains pressure too low',
          detail: 'Below 0.3 bar minimum.',
        },
      ],
    });
    const pack = buildInsightPackFromEngine(output, [COMBI_QUOTE]);
    expect(pack.quotes[0].rating.reliability.rating).toBe('Needs Right Setup');
  });

  it('ASHP-specific red flags do not appear as limitations for combi quotes', () => {
    const output = makeMinimalEngineOutput({
      redFlags: [
        {
          id: 'ashp-radiator-undersized',
          severity: 'fail',
          title: 'Radiators undersized for heat pump flow temperature',
          detail: 'Requires upsizing.',
        },
      ],
    });
    const pack = buildInsightPackFromEngine(output, [COMBI_QUOTE]);
    const ashpLimitations = pack.quotes[0].limitations.filter(l =>
      l.message.toLowerCase().includes('radiator') || l.message.toLowerCase().includes('heat pump'),
    );
    expect(ashpLimitations).toHaveLength(0);
  });

  it('ASHP-specific red flags appear for ASHP quotes', () => {
    const output = makeMinimalEngineOutput({
      redFlags: [
        {
          id: 'ashp-radiator-undersized',
          severity: 'fail',
          title: 'Radiators undersized for heat pump flow temperature',
          detail: 'Requires upsizing.',
        },
      ],
    });
    const pack = buildInsightPackFromEngine(output, [ASHP_QUOTE]);
    expect(pack.quotes[0].limitations.length).toBeGreaterThan(0);
  });

  it('hydraulic flags do not appear as limitations for stored system quotes', () => {
    const output = makeMinimalEngineOutput({
      redFlags: [
        {
          id: 'hydraulic-high-flow-velocity',
          severity: 'warn',
          title: 'High flow velocity detected in primary pipework',
          detail: 'Velocity exceeds 1.5 m/s.',
        },
      ],
    });
    const pack = buildInsightPackFromEngine(output, [SYSTEM_QUOTE]);
    expect(pack.quotes[0].limitations).toHaveLength(0);
  });

  it('hydraulic flags appear for combi quotes', () => {
    const output = makeMinimalEngineOutput({
      redFlags: [
        {
          id: 'hydraulic-high-flow-velocity',
          severity: 'warn',
          title: 'High flow velocity detected in primary pipework',
          detail: 'Velocity exceeds 1.5 m/s.',
        },
      ],
    });
    const pack = buildInsightPackFromEngine(output, [COMBI_QUOTE]);
    expect(pack.quotes[0].limitations.length).toBeGreaterThan(0);
  });
});

// ─── Suitability synthesis ────────────────────────────────────────────────────

describe('suitability synthesis', () => {
  it('worst dimension governs suitability band', () => {
    const output = makeMinimalEngineOutput({
      redFlags: [
        {
          id: 'combi-simultaneous-demand',
          severity: 'fail',
          title: 'Simultaneous demand fail',
          detail: 'Hard fail for combi.',
        },
      ],
    });
    const pack = buildInsightPackFromEngine(output, [COMBI_QUOTE]);
    const suitability = pack.quotes[0].rating.suitability.rating;
    // hotWaterPerformance is Less Suited due to fail flag → suitability must be <= Very Good
    expect(['Less Suited', 'Needs Right Setup']).toContain(suitability);
  });

  it('system boiler with no flags and aligned recommendation → Excellent suitability', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [SYSTEM_QUOTE]);
    expect(pack.quotes[0].rating.suitability.rating).toBe('Excellent');
  });
});

// ─── Limitations mapping ──────────────────────────────────────────────────────

describe('limitations mapping', () => {
  it('combi-specific red flags are not mapped onto system boiler quotes', () => {
    const output = makeMinimalEngineOutput({
      redFlags: [
        {
          id: 'combi-pressure-constraint',
          severity: 'fail',
          title: 'Combi pressure constraint',
          detail: 'Low pressure.',
        },
      ],
    });
    const pack = buildInsightPackFromEngine(output, [SYSTEM_QUOTE]);
    // The combi-specific flag should be filtered out for a system boiler quote
    expect(pack.quotes[0].limitations).toHaveLength(0);
  });

  it('fail-severity red flags produce high-severity limitations for matching system type', () => {
    const output = makeMinimalEngineOutput({
      redFlags: [
        {
          id: 'combi-simultaneous-demand',
          severity: 'fail',
          title: 'Simultaneous demand',
          detail: 'Hard fail.',
        },
      ],
    });
    const pack = buildInsightPackFromEngine(output, [COMBI_QUOTE]);
    const highLimitations = pack.quotes[0].limitations.filter(l => l.severity === 'high');
    expect(highLimitations).toHaveLength(1);
    expect(highLimitations[0].message).toBe('Simultaneous demand');
  });

  it('no red flags → empty limitations array', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [SYSTEM_QUOTE]);
    expect(pack.quotes[0].limitations).toHaveLength(0);
  });
});

// ─── Daily use statements ─────────────────────────────────────────────────────

describe('daily use statements', () => {
  it('always returns at least one statement per quote', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [
      COMBI_QUOTE, SYSTEM_QUOTE,
    ]);
    for (const qi of pack.quotes) {
      expect(qi.dailyUse.length).toBeGreaterThan(0);
    }
  });

  it('each statement has a non-empty statement string', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [COMBI_QUOTE]);
    for (const item of pack.quotes[0].dailyUse) {
      expect(item.statement.length).toBeGreaterThan(0);
    }
  });

  it('when combi and system are compared, system gets a ranking advantage statement', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [
      COMBI_QUOTE, SYSTEM_QUOTE,
    ]);
    const systemQuote = pack.quotes.find(qi => qi.quote.systemType === 'system')!;
    // Statement should mention the combi quote label and explain stored handling
    const rankingStatement = systemQuote.dailyUse.find(d =>
      (d.statement.includes(COMBI_QUOTE.label) || d.statement.toLowerCase().includes('stored')) &&
      (d.statement.toLowerCase().includes('better') || d.statement.toLowerCase().includes('simultaneous')),
    );
    expect(rankingStatement).toBeDefined();
  });

  it('when combi and system are compared, combi gets a lower-rank statement', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [
      COMBI_QUOTE, SYSTEM_QUOTE,
    ]);
    const combiQuote = pack.quotes.find(qi => qi.quote.systemType === 'combi')!;
    // Statement should mention the system quote label and the stored cylinder
    const rankingStatement = combiQuote.dailyUse.find(d =>
      d.statement.includes(SYSTEM_QUOTE.label) && d.statement.toLowerCase().includes('stored cylinder'),
    );
    expect(rankingStatement).toBeDefined();
  });

  it('single-quote packs do not add ranking comparison statements', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [COMBI_QUOTE]);
    const rankingStatements = pack.quotes[0].dailyUse.filter(d =>
      d.statement.toLowerCase().includes('ranked'),
    );
    expect(rankingStatements).toHaveLength(0);
  });
});

// ─── Improvements ─────────────────────────────────────────────────────────────

describe('improvements', () => {
  it('quotes without filter in includedUpgrades receive a magnetic filter improvement', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [COMBI_QUOTE]);
    const filterImp = pack.quotes[0].improvements.find(i => i.title.toLowerCase().includes('filter'));
    expect(filterImp).toBeDefined();
  });

  it('quotes with both filter and flush already included receive no duplicate improvements', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [SYSTEM_QUOTE]);
    const filterImp = pack.quotes[0].improvements.find(i => i.title.toLowerCase().includes('filter'));
    const flushImp = pack.quotes[0].improvements.find(i => i.title.toLowerCase().includes('flush'));
    // Both are included in SYSTEM_QUOTE upgrades — should not be recommended again
    expect(filterImp).toBeUndefined();
    expect(flushImp).toBeUndefined();
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('determinism (no Math.random)', () => {
  it('produces identical output on repeated calls with same inputs', () => {
    const output = makeMinimalEngineOutput();
    const pack1 = buildInsightPackFromEngine(output, [COMBI_QUOTE]);
    const pack2 = buildInsightPackFromEngine(output, [COMBI_QUOTE]);
    expect(JSON.stringify(pack1)).toBe(JSON.stringify(pack2));
  });
});

// ─── Best advice ──────────────────────────────────────────────────────────────

describe('best advice', () => {
  it('because and avoids arrays are non-empty', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [
      COMBI_QUOTE, SYSTEM_QUOTE,
    ]);
    expect(pack.bestAdvice.because.length).toBeGreaterThan(0);
    expect(pack.bestAdvice.avoids.length).toBeGreaterThan(0);
  });

  it('recommendedQuoteId is one of the submitted quote IDs', () => {
    const pack = buildInsightPackFromEngine(makeMinimalEngineOutput(), [
      COMBI_QUOTE, SYSTEM_QUOTE,
    ]);
    const ids = [COMBI_QUOTE.id, SYSTEM_QUOTE.id];
    if (pack.bestAdvice.recommendedQuoteId !== undefined) {
      expect(ids).toContain(pack.bestAdvice.recommendedQuoteId);
    }
  });
});
