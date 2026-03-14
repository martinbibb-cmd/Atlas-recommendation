/**
 * printSections.model.test.ts
 *
 * Validates that:
 *   - buildOutputHubSections() returns a section for every hub tile
 *   - Each section has the correct id, title, customerSafe, and visible flags
 *   - Status derivation matches the sectionStatus logic in LiveHubPage
 *   - Withheld recommendation surfaces in recommendation section
 *   - Usage model marks missing fields correctly
 *   - filterSections() correctly filters and orders sections by preset
 *   - PRINT_PRESETS contains the expected section ids
 */

import { describe, it, expect } from 'vitest';
import {
  buildOutputHubSections,
  filterSections,
  PRINT_PRESETS,
  type OutputHubSection,
} from '../printSections.model';
import type { FullEngineResult } from '../../engine/schema/EngineInputV2_3';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';

// ─── Stubs ────────────────────────────────────────────────────────────────────

function makeResult(overrides?: Partial<{
  recommendation: string;
  combiRisk: string;
  storedRisk: string;
  decayPct: number;
  hasLimiters: boolean;
  hasEvidence: boolean;
  hasOptions: boolean;
}>): FullEngineResult {
  const opts = {
    recommendation: 'Gas Combi is recommended',
    combiRisk: 'pass',
    storedRisk: 'pass',
    decayPct: 5,
    hasLimiters: false,
    hasEvidence: false,
    hasOptions: false,
    ...overrides,
  };

  return {
    combiDhwV1:  { verdict: { combiRisk: opts.combiRisk } },
    storedDhwV1: { verdict: { storedRisk: opts.storedRisk } },
    normalizer:  { tenYearEfficiencyDecayPct: opts.decayPct },
    engineOutput: {
      eligibility:    [],
      redFlags:       [],
      recommendation: { primary: opts.recommendation },
      explainers:     [],
      limiters:       opts.hasLimiters
        ? {
            limiters: [{
              id: 'l1',
              title: 'Low pressure',
              severity: 'fail',
              impact: { summary: 'DHW flow reduced' },
              observed: { value: 0.8, unit: 'bar' },
              limit:    { value: 1.0, unit: 'bar' },
              suggestedFixes: [{ label: 'Boost pump' }],
            }],
          }
        : { limiters: [] },
      evidence: opts.hasEvidence
        ? [{ label: 'Mains pressure', source: 'manual', confidence: 'high' }]
        : [],
      options: opts.hasOptions
        ? [{
            id: 'ashp',
            label: 'ASHP',
            status: 'viable',
            why: ['Eco fit'],
            requirements: [],
            heat:        { status: 'ok', headline: 'Good', bullets: [] },
            dhw:         { status: 'ok', headline: 'Good', bullets: [] },
            engineering: { status: 'ok', headline: 'Minor', bullets: [] },
            typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
          }]
        : [],
      meta: { assumptions: [], confidence: { level: 'medium', unknowns: [], unlockBy: [] } },
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FullEngineResult;
}

function makeInput(overrides?: Partial<{
  occupancyCount: number | null;
  bathroomCount: number | null;
  boilerType: string;
}>): FullSurveyModelV1 {
  const opts = {
    occupancyCount: 3,
    bathroomCount: 1,
    boilerType: 'combi',
    ...overrides,
  };
  return {
    occupancyCount:        opts.occupancyCount ?? undefined,
    bathroomCount:         opts.bathroomCount  ?? undefined,
    currentHeatSourceType: opts.boilerType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as FullSurveyModelV1;
}

// ─── buildOutputHubSections ───────────────────────────────────────────────────

describe('buildOutputHubSections — section coverage', () => {
  it('returns 17 sections (one per hub tile + derived)', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput());
    expect(sections.length).toBe(17);
  });

  it('returns a section for every expected id', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput());
    const ids = sections.map(s => s.id);
    const expected = [
      'recommendation', 'currentSystem', 'waterPower', 'usageModel',
      'evidence', 'constraints', 'chemistry', 'glassBox',
      'controlRoom', 'simulatorSummary', 'comparison', 'technicalAppendix',
      'heatMap', 'hotWaterDemand', 'systemArchitecture', 'suitabilitySummary', 'upgradePathway',
    ];
    for (const id of expected) {
      expect(ids).toContain(id);
    }
  });

  it('every section has id, title, status, visible and customerSafe', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput());
    for (const s of sections) {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(['ok', 'watch', 'missing']).toContain(s.status);
      expect(typeof s.visible).toBe('boolean');
      expect(typeof s.customerSafe).toBe('boolean');
    }
  });
});

describe('buildOutputHubSections — recommendation section', () => {
  it('has status ok when recommendation is not withheld', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput());
    const rec = sections.find(s => s.id === 'recommendation')!;
    expect(rec.status).toBe('ok');
  });

  it('has status watch when recommendation is withheld', () => {
    const sections = buildOutputHubSections(
      makeResult({ recommendation: 'Recommendation withheld — insufficient data' }),
      makeInput(),
    );
    const rec = sections.find(s => s.id === 'recommendation')!;
    expect(rec.status).toBe('watch');
    expect((rec.content as Record<string, unknown>).isWithheld).toBe(true);
  });

  it('always visible and customerSafe', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput());
    const rec = sections.find(s => s.id === 'recommendation')!;
    expect(rec.visible).toBe(true);
    expect(rec.customerSafe).toBe(true);
  });
});

describe('buildOutputHubSections — waterPower section', () => {
  it('has status ok when combiRisk is pass', () => {
    const sections = buildOutputHubSections(makeResult({ combiRisk: 'pass' }), makeInput());
    const wp = sections.find(s => s.id === 'waterPower')!;
    expect(wp.status).toBe('ok');
  });

  it('has status watch when combiRisk is fail', () => {
    const sections = buildOutputHubSections(makeResult({ combiRisk: 'fail' }), makeInput());
    const wp = sections.find(s => s.id === 'waterPower')!;
    expect(wp.status).toBe('watch');
  });

  it('has status watch when combiRisk is warn', () => {
    const sections = buildOutputHubSections(makeResult({ combiRisk: 'warn' }), makeInput());
    const wp = sections.find(s => s.id === 'waterPower')!;
    expect(wp.status).toBe('watch');
  });
});

describe('buildOutputHubSections — usageModel section', () => {
  it('has status missing when occupancyCount is absent', () => {
    const sections = buildOutputHubSections(
      makeResult(),
      makeInput({ occupancyCount: null }),
    );
    const usage = sections.find(s => s.id === 'usageModel')!;
    expect(usage.status).toBe('missing');
    expect((usage.content as Record<string, string[]>).missingFields).toContain('Occupancy count');
  });

  it('has status missing when bathroomCount is absent', () => {
    const sections = buildOutputHubSections(
      makeResult(),
      makeInput({ bathroomCount: null }),
    );
    const usage = sections.find(s => s.id === 'usageModel')!;
    expect(usage.status).toBe('missing');
    expect((usage.content as Record<string, string[]>).missingFields).toContain('Bathroom count');
  });

  it('has status ok when both occupancy and bathroom are present and storedRisk is pass', () => {
    const sections = buildOutputHubSections(makeResult({ storedRisk: 'pass' }), makeInput());
    const usage = sections.find(s => s.id === 'usageModel')!;
    expect(usage.status).toBe('ok');
  });

  it('has status watch when storedRisk is warn', () => {
    const sections = buildOutputHubSections(makeResult({ storedRisk: 'warn' }), makeInput());
    const usage = sections.find(s => s.id === 'usageModel')!;
    expect(usage.status).toBe('watch');
  });
});

describe('buildOutputHubSections — chemistry section', () => {
  it('has status ok when decay is low', () => {
    const sections = buildOutputHubSections(makeResult({ decayPct: 5 }), makeInput());
    const chem = sections.find(s => s.id === 'chemistry')!;
    expect(chem.status).toBe('ok');
  });

  it('has status watch when decay exceeds 8%', () => {
    const sections = buildOutputHubSections(makeResult({ decayPct: 10 }), makeInput());
    const chem = sections.find(s => s.id === 'chemistry')!;
    expect(chem.status).toBe('watch');
  });
});

describe('buildOutputHubSections — constraints section', () => {
  it('has status ok when no limiters', () => {
    const sections = buildOutputHubSections(makeResult({ hasLimiters: false }), makeInput());
    const constraints = sections.find(s => s.id === 'constraints')!;
    expect(constraints.status).toBe('ok');
  });

  it('has status watch when a fail-severity limiter exists', () => {
    const sections = buildOutputHubSections(makeResult({ hasLimiters: true }), makeInput());
    const constraints = sections.find(s => s.id === 'constraints')!;
    expect(constraints.status).toBe('watch');
  });
});

describe('buildOutputHubSections — customerSafe flags', () => {
  it('marks evidence, glassBox, controlRoom, technicalAppendix as NOT customerSafe', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput());
    const notSafe = ['evidence', 'glassBox', 'controlRoom', 'technicalAppendix'];
    for (const id of notSafe) {
      const s = sections.find(sec => sec.id === id)!;
      expect(s.customerSafe).toBe(false);
    }
  });

  it('marks recommendation, currentSystem, waterPower, usageModel, constraints, chemistry as customerSafe', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput());
    const safe = ['recommendation', 'currentSystem', 'waterPower', 'usageModel', 'constraints', 'chemistry'];
    for (const id of safe) {
      const s = sections.find(sec => sec.id === id)!;
      expect(s.customerSafe).toBe(true);
    }
  });
});

describe('buildOutputHubSections — simulatorSummary visibility', () => {
  it('is visible when occupancy and bathrooms are provided', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput());
    const sim = sections.find(s => s.id === 'simulatorSummary')!;
    expect(sim.visible).toBe(true);
  });

  it('is NOT visible when occupancy is missing', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput({ occupancyCount: null }));
    const sim = sections.find(s => s.id === 'simulatorSummary')!;
    expect(sim.visible).toBe(false);
  });
});

describe('buildOutputHubSections — comparison visibility', () => {
  it('is NOT visible when no options returned', () => {
    const sections = buildOutputHubSections(makeResult({ hasOptions: false }), makeInput());
    const comp = sections.find(s => s.id === 'comparison')!;
    expect(comp.visible).toBe(false);
  });

  it('is visible when options exist', () => {
    const sections = buildOutputHubSections(makeResult({ hasOptions: true }), makeInput());
    const comp = sections.find(s => s.id === 'comparison')!;
    expect(comp.visible).toBe(true);
  });
});

// ─── filterSections ───────────────────────────────────────────────────────────

describe('filterSections — preset filtering', () => {
  it('customer preset includes only customer-safe sections', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput());
    const filtered = filterSections(sections, 'customer');
    for (const s of filtered) {
      expect(s.customerSafe).toBe(true);
    }
  });

  it('full preset includes more sections than customer preset', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput());
    const customer = filterSections(sections, 'customer');
    const full     = filterSections(sections, 'full');
    expect(full.length).toBeGreaterThan(customer.length);
  });

  it('filtered sections maintain the preset order', () => {
    const sections = buildOutputHubSections(makeResult({ hasOptions: true }), makeInput());
    const filtered = filterSections(sections, 'comparison');
    const ids = filtered.map(s => s.id);
    // comparison preset: recommendation, comparison, constraints, waterPower, usageModel
    expect(ids[0]).toBe('recommendation');
    expect(ids).toContain('comparison');
    expect(ids).toContain('constraints');
  });

  it('omits invisible sections even when listed in preset', () => {
    // no options → comparison section not visible
    const sections = buildOutputHubSections(makeResult({ hasOptions: false }), makeInput());
    const full = filterSections(sections, 'full');
    const ids  = full.map(s => s.id);
    expect(ids).not.toContain('comparison');
  });

  it('technical preset includes evidence and glassBox', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput());
    const filtered = filterSections(sections, 'technical');
    const ids = filtered.map(s => s.id);
    expect(ids).toContain('evidence');
    expect(ids).toContain('glassBox');
  });
});

// ─── PRINT_PRESETS ────────────────────────────────────────────────────────────

describe('PRINT_PRESETS — structure', () => {
  it('has customer, technical, comparison, and full presets', () => {
    expect(PRINT_PRESETS.customer).toBeTruthy();
    expect(PRINT_PRESETS.technical).toBeTruthy();
    expect(PRINT_PRESETS.comparison).toBeTruthy();
    expect(PRINT_PRESETS.full).toBeTruthy();
  });

  it('full preset includes all 17 section ids', () => {
    expect(PRINT_PRESETS.full.length).toBe(17);
  });

  it('customer preset does not include glassBox or evidence', () => {
    expect(PRINT_PRESETS.customer).not.toContain('glassBox');
    expect(PRINT_PRESETS.customer).not.toContain('evidence');
  });

  it('customer preset includes the 3 visual trust-builder sections', () => {
    expect(PRINT_PRESETS.customer).toContain('heatMap');
    expect(PRINT_PRESETS.customer).toContain('hotWaterDemand');
    expect(PRINT_PRESETS.customer).toContain('waterPower');
  });

  it('comparison preset includes comparison section', () => {
    expect(PRINT_PRESETS.comparison).toContain('comparison');
  });

  it('all presets include recommendation as first section', () => {
    expect(PRINT_PRESETS.customer[0]).toBe('recommendation');
    expect(PRINT_PRESETS.technical[0]).toBe('recommendation');
    expect(PRINT_PRESETS.comparison[0]).toBe('recommendation');
    expect(PRINT_PRESETS.full[0]).toBe('recommendation');
  });
});

// ─── Withheld recommendation copy ─────────────────────────────────────────────

describe('buildOutputHubSections — withheld state detail', () => {
  it('withheld recommendation sets isWithheld=true in content', () => {
    const sections = buildOutputHubSections(
      makeResult({ recommendation: 'Recommendation withheld — occupancy unknown' }),
      makeInput(),
    );
    const rec = sections.find(s => s.id === 'recommendation')!;
    const content = rec.content as Record<string, unknown>;
    expect(content.isWithheld).toBe(true);
  });

  it('non-withheld recommendation sets isWithheld=false in content', () => {
    const sections = buildOutputHubSections(makeResult(), makeInput());
    const rec = sections.find(s => s.id === 'recommendation')!;
    const content = rec.content as Record<string, unknown>;
    expect(content.isWithheld).toBe(false);
  });
});
