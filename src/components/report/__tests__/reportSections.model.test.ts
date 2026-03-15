/**
 * reportSections.model.test.ts
 *
 * Unit tests for the reportSections.model mapping layer.
 *
 * Validates:
 *   - checkCompleteness correctly identifies essential vs optional data
 *   - buildReportSections returns sections in canonical order
 *   - Section builders derive correct display values from engine output
 *   - Partial output (no behaviourTimeline) produces correct completeness status
 *   - Missing essential data blocks the report
 */

import { describe, it, expect } from 'vitest';
import {
  checkCompleteness,
  buildReportSections,
} from '../reportSections.model';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';

// ─── Minimal stubs ────────────────────────────────────────────────────────────

/** A minimal engine output that passes all essential checks. */
const MINIMAL_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'Gas combi boiler' },
  explainers: [],
  verdict: {
    title: 'Combi recommended',
    status: 'good',
    reasons: ['Adequate flow rate', 'Low occupancy'],
    confidence: { level: 'medium', reasons: [] },
    assumptionsUsed: [],
  },
};

/** Full output with all optional data present. */
const FULL_OUTPUT: EngineOutputV1 = {
  ...MINIMAL_OUTPUT,
  behaviourTimeline: {
    resolutionMins: 30,
    labels: {
      applianceName: 'Gas combi boiler',
      isCombi: true,
    },
    points: [
      { t: '06:00', spaceHeatDemandKw: 5, dhwDemandKw: 0, dhwApplianceOutKw: 0, applianceOutKw: 5, efficiencyPct: 88, deliveredHeatKw: 5, deliveredDhwKw: 0, mode: 'heating', unmetHeatKw: 0 },
      { t: '07:00', spaceHeatDemandKw: 0, dhwDemandKw: 8, dhwApplianceOutKw: 8, applianceOutKw: 8, efficiencyPct: 80, deliveredHeatKw: 0, deliveredDhwKw: 8, mode: 'dhw', unmetHeatKw: 0 },
    ],
    assumptionsUsed: [{ id: 'occ_pattern', label: 'Occupancy pattern derived from 3-person household', severity: 'info' as const }],
  },
  limiters: {
    limiters: [
      {
        id: 'flow_rate',
        title: 'Flow rate marginal',
        severity: 'warn' as const,
        observed: { label: 'Flow rate', value: 12, unit: 'L/min' as const },
        limit: { label: 'Min flow', value: 15, unit: 'L/min' as const },
        impact: { summary: 'Observed flow is below recommended minimum.' },
        confidence: 'medium' as const,
        sources: [],
        suggestedFixes: [{ id: 'fix1', label: 'Check mains connection.' }],
      },
    ],
  },
  influenceSummary: {
    heat: { influencePct: 40, drivers: [] },
    dhw: { influencePct: 35, drivers: [] },
    hydraulics: { influencePct: 25, drivers: [] },
  },
  meta: {
    engineVersion: '1' as never,
    contractVersion: '1' as never,
    assumptions: [
      { id: 'occ_sig', title: 'Occupancy derived', detail: 'From 3-person professional household.', affects: ['timeline_24h'], severity: 'info' },
    ],
  },
};

// ─── checkCompleteness ────────────────────────────────────────────────────────

describe('checkCompleteness', () => {
  it('returns isReportable=true when essential data is present', () => {
    const result = checkCompleteness(MINIMAL_OUTPUT);
    expect(result.isReportable).toBe(true);
  });

  it('returns isReportable=false when recommendation is missing', () => {
    const output: EngineOutputV1 = {
      ...MINIMAL_OUTPUT,
      recommendation: { primary: '' },
    };
    const result = checkCompleteness(output);
    expect(result.isReportable).toBe(false);
    expect(result.missingEssential).toContain('System recommendation');
  });

  it('returns isReportable=false when verdict is absent', () => {
    const { verdict: _, ...output } = MINIMAL_OUTPUT;
    const result = checkCompleteness(output as EngineOutputV1);
    expect(result.isReportable).toBe(false);
    expect(result.missingEssential).toContain('Verdict / confidence assessment');
  });

  it('returns isPartial=true when behaviour timeline is absent', () => {
    const result = checkCompleteness(MINIMAL_OUTPUT);
    expect(result.isPartial).toBe(true);
    expect(result.missingOptional).toContain('24-hour behaviour timeline');
  });

  it('returns isPartial=false when all optional data is present', () => {
    const result = checkCompleteness(FULL_OUTPUT);
    expect(result.isPartial).toBe(false);
    expect(result.missingOptional).toHaveLength(0);
  });

  it('lists physical limiters in missingOptional when absent', () => {
    const result = checkCompleteness(MINIMAL_OUTPUT);
    expect(result.missingOptional).toContain('Physical limiters / constraints');
  });
});

// ─── buildReportSections ──────────────────────────────────────────────────────

describe('buildReportSections — minimal output', () => {
  it('always includes system_summary as the first section', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    expect(sections[0].id).toBe('system_summary');
  });

  it('includes verdict section from minimal output', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    expect(sections.some(s => s.id === 'verdict')).toBe(true);
  });

  it('omits operating_point when behaviourTimeline is absent', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    expect(sections.some(s => s.id === 'operating_point')).toBe(false);
  });

  it('omits behaviour_summary when behaviourTimeline is absent', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    expect(sections.some(s => s.id === 'behaviour_summary')).toBe(false);
  });

  it('omits key_limiters when no limiters are present', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    expect(sections.some(s => s.id === 'key_limiters')).toBe(false);
  });
});

describe('buildReportSections — full output', () => {
  it('includes all 6 sections for a full output', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const ids = sections.map(s => s.id);
    expect(ids).toContain('system_summary');
    expect(ids).toContain('operating_point');
    expect(ids).toContain('behaviour_summary');
    expect(ids).toContain('key_limiters');
    expect(ids).toContain('verdict');
    expect(ids).toContain('assumptions');
  });

  it('sections follow canonical order', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const ids = sections.map(s => s.id);
    expect(ids.indexOf('system_summary')).toBeLessThan(ids.indexOf('operating_point'));
    expect(ids.indexOf('operating_point')).toBeLessThan(ids.indexOf('behaviour_summary'));
    expect(ids.indexOf('behaviour_summary')).toBeLessThan(ids.indexOf('key_limiters'));
    expect(ids.indexOf('key_limiters')).toBeLessThan(ids.indexOf('verdict'));
    expect(ids.indexOf('verdict')).toBeLessThan(ids.indexOf('assumptions'));
  });

  it('system_summary carries the correct recommendation text', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const s = sections.find(sec => sec.id === 'system_summary');
    expect(s).toBeTruthy();
    if (s?.id === 'system_summary') {
      expect(s.primary).toBe('Gas combi boiler');
      expect(s.verdictStatus).toBe('good');
    }
  });

  it('operating_point derives peak DHW kW from timeline', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const s = sections.find(sec => sec.id === 'operating_point');
    expect(s).toBeTruthy();
    if (s?.id === 'operating_point') {
      expect(s.peakDhwKw).toBe(8);
      expect(s.peakDhwTime).toBe('07:00');
    }
  });

  it('operating_point estimates flow from peak DHW kW (~2.4 kW per L/min)', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const s = sections.find(sec => sec.id === 'operating_point');
    if (s?.id === 'operating_point') {
      // 8 kW / 2.4 = 3.3... → rounded to 3.3
      expect(s.estimatedFlowLpm).toBe(3.3);
    }
  });

  it('key_limiters section carries limiter data', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const s = sections.find(sec => sec.id === 'key_limiters');
    if (s?.id === 'key_limiters') {
      expect(s.limiters).toHaveLength(1);
      expect(s.limiters[0].id).toBe('flow_rate');
      expect(s.limiters[0].severity).toBe('warn');
    }
  });

  it('key_limiters section caps output at 8 items when more are present', () => {
    // Build an output with 10 limiters
    const makeLimiter = (n: number) => ({
      id: `limiter_${n}`,
      title: `Limiter ${n}`,
      severity: 'info' as const,
      observed: { label: 'Value', value: n, unit: 'bar' as const },
      limit: { label: 'Max', value: 10, unit: 'bar' as const },
      impact: { summary: `Impact of limiter ${n}.` },
      confidence: 'medium' as const,
      sources: [] as never[],
      suggestedFixes: [] as never[],
    });
    const outputWithManyLimiters: EngineOutputV1 = {
      ...FULL_OUTPUT,
      limiters: {
        limiters: Array.from({ length: 10 }, (_, i) => makeLimiter(i + 1)),
      },
    };
    const sections = buildReportSections(outputWithManyLimiters);
    const s = sections.find(sec => sec.id === 'key_limiters');
    if (s?.id === 'key_limiters') {
      expect(s.limiters).toHaveLength(8);
      expect(s.limiters[0].id).toBe('limiter_1');
      expect(s.limiters[7].id).toBe('limiter_8');
    }
  });

  it('verdict section carries status and reasons', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const s = sections.find(sec => sec.id === 'verdict');
    if (s?.id === 'verdict') {
      expect(s.status).toBe('good');
      expect(s.confidenceLevel).toBe('medium');
      expect(s.reasons).toContain('Adequate flow rate');
    }
  });

  it('assumptions section includes engine assumption', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const s = sections.find(sec => sec.id === 'assumptions');
    if (s?.id === 'assumptions') {
      expect(s.assumptions.length).toBeGreaterThan(0);
      expect(s.assumptions[0].title).toBe('Occupancy derived');
    }
  });

  it('includes physics_trace section when behaviourTimeline is present', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    expect(sections.some(s => s.id === 'physics_trace')).toBe(true);
  });

  it('physics_trace appends after assumptions in canonical order', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const assumptionsIdx = sections.findIndex(s => s.id === 'assumptions');
    const traceIdx = sections.findIndex(s => s.id === 'physics_trace');
    expect(assumptionsIdx).toBeGreaterThanOrEqual(0);
    expect(traceIdx).toBeGreaterThan(assumptionsIdx);
  });

  it('physics_trace carries appliance name and resolution', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const s = sections.find(sec => sec.id === 'physics_trace');
    if (s?.id === 'physics_trace') {
      expect(s.applianceName).toBe('Gas combi boiler');
      expect(s.resolutionMins).toBe(30);
    }
  });
});

// ─── New section builders (options-dependent) ─────────────────────────────────

/**
 * Minimal "combi" option used in tests that need an option without trade-off
 * data (no likelyUpgrades, no sensitivities, not a stored system type).
 */
const MINIMAL_COMBI_OPTION = {
  id: 'combi' as const,
  label: 'Gas combi',
  status: 'viable' as const,
  headline: 'Combi boiler',
  why: ['Low occupancy'],
  requirements: [] as string[],
  heat: { status: 'ok' as const, headline: 'Good', bullets: [] as string[] },
  dhw: { status: 'ok' as const, headline: 'Adequate', bullets: [] as string[] },
  engineering: { status: 'ok' as const, headline: 'Minimal works', bullets: [] as string[] },
  typedRequirements: { mustHave: [] as string[], likelyUpgrades: [] as string[], niceToHave: [] as string[] },
};

/** Output with full option card data, sensitivities, and plans. */
const OUTPUT_WITH_OPTIONS: EngineOutputV1 = {
  ...FULL_OUTPUT,
  options: [
    {
      id: 'ashp',
      label: 'ASHP with unvented cylinder',
      status: 'viable',
      headline: 'Low-carbon heat pump system',
      why: ['Low carbon heat source', 'Silent operation outdoors'],
      requirements: [],
      heat: { status: 'ok', headline: 'Good at low flow temperature', bullets: ['Operates well at 45°C flow'] },
      dhw: { status: 'ok', headline: 'Adequate stored volume', bullets: ['210L cylinder recommended', 'Legionella immersion required'] },
      engineering: { status: 'caution', headline: 'Moderate works required', bullets: ['External unit siting required', 'Primary pipework may need upsizing'] },
      typedRequirements: {
        mustHave: ['External wall space for outdoor unit', 'Adequate loft space for cylinder'],
        likelyUpgrades: ['Primary pipework 22→28mm', 'Additional radiators in 2 rooms'],
        niceToHave: ['Thermal store pre-plumbing', 'Smart controls'],
      },
      sensitivities: [
        { lever: 'Primary pipe diameter', effect: 'upgrade', note: 'Upgrading to 28mm removes hydraulic limiter.' },
        { lever: 'Loft space', effect: 'downgrade', note: 'Insufficient loft space would prevent cylinder siting.' },
      ],
    },
    {
      id: 'stored_unvented',
      label: 'System boiler + unvented cylinder',
      status: 'viable',
      headline: 'Stored hot water system',
      why: ['Simultaneous DHW from stored volume'],
      requirements: [],
      heat: { status: 'ok', headline: 'Compatible with existing radiators', bullets: ['Operates at 70°C flow'] },
      dhw: { status: 'ok', headline: 'Unvented cylinder with stored supply', bullets: ['210L capacity sufficient', 'G3 compliance required'] },
      engineering: { status: 'ok', headline: 'Minor works', bullets: ['Cylinder space required', 'Expansion vessel needed'] },
      typedRequirements: {
        mustHave: ['Cylinder cupboard or loft space', 'G3 qualified installer'],
        likelyUpgrades: [],
        niceToHave: ['Smart thermostat'],
      },
      sensitivities: [
        { lever: 'Water softener', effect: 'upgrade', note: 'Softened water extends cylinder life.' },
      ],
    },
  ],
  plans: {
    pathways: [
      {
        id: 'path_1',
        title: 'ASHP now',
        rationale: 'Best long-term carbon reduction under current assumptions.',
        outcomeToday: 'Low-carbon heat and hot water',
        prerequisites: [],
        confidence: { level: 'medium', reasons: [] },
        rank: 1,
      },
      {
        id: 'path_2',
        title: 'System boiler now, ASHP later',
        rationale: 'Lower upfront cost; ASHP when primary pipework upgraded.',
        outcomeToday: 'Reliable stored hot water from gas',
        outcomeAfterTrigger: 'ASHP ready once pipework upgraded',
        prerequisites: [{ description: 'Upgrade primary pipework to 28mm' }],
        confidence: { level: 'low', reasons: [] },
        rank: 2,
      },
    ],
    sharedConstraints: ['Primary pipework currently 22mm'],
  },
};

describe('buildReportSections — key_trade_off section', () => {
  it('includes key_trade_off when options with likelyUpgrades are present', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    expect(sections.some(s => s.id === 'key_trade_off')).toBe(true);
  });

  it('key_trade_off carries the recommended system label', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'key_trade_off');
    if (s?.id === 'key_trade_off') {
      expect(s.systemLabel).toBe('ASHP with unvented cylinder');
    }
  });

  it('key_trade_off carries likelyUpgrades from recommended option', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'key_trade_off');
    if (s?.id === 'key_trade_off') {
      expect(s.likelyUpgrades).toContain('Primary pipework 22→28mm');
      expect(s.likelyUpgrades).toContain('Additional radiators in 2 rooms');
    }
  });

  it('key_trade_off carries engineering bullets from recommended option', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'key_trade_off');
    if (s?.id === 'key_trade_off') {
      expect(s.engineeringBullets).toContain('External unit siting required');
    }
  });

  it('omits key_trade_off when options is absent', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    expect(sections.some(s => s.id === 'key_trade_off')).toBe(false);
  });
});

describe('buildReportSections — future_path section', () => {
  it('includes future_path when options with sensitivities are present', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    expect(sections.some(s => s.id === 'future_path')).toBe(true);
  });

  it('future_path separates upgrade enablers from downgrade risks', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'future_path');
    if (s?.id === 'future_path') {
      expect(s.enablers.some(e => e.lever === 'Primary pipe diameter')).toBe(true);
      expect(s.risks.some(r => r.lever === 'Loft space')).toBe(true);
    }
  });

  it('future_path includes pathway titles when plans data is present', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'future_path');
    if (s?.id === 'future_path') {
      expect(s.pathways.length).toBeGreaterThan(0);
      expect(s.pathways[0].title).toBe('ASHP now');
    }
  });

  it('omits future_path when options has no sensitivities and plans is absent', () => {
    const output: EngineOutputV1 = {
      ...FULL_OUTPUT,
      options: [MINIMAL_COMBI_OPTION],
      // no plans
    };
    const sections = buildReportSections(output);
    expect(sections.some(s => s.id === 'future_path')).toBe(false);
  });
});

describe('buildReportSections — system_architecture section', () => {
  it('includes system_architecture when options are present', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    expect(sections.some(s => s.id === 'system_architecture')).toBe(true);
  });

  it('system_architecture carries headline and engineering bullets', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'system_architecture');
    if (s?.id === 'system_architecture') {
      expect(s.headline).toBe('Moderate works required');
      expect(s.bullets).toContain('External unit siting required');
    }
  });

  it('system_architecture carries mustHave conditions', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'system_architecture');
    if (s?.id === 'system_architecture') {
      expect(s.mustHave).toContain('External wall space for outdoor unit');
    }
  });

  it('omits system_architecture when options is absent', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    expect(sections.some(s => s.id === 'system_architecture')).toBe(false);
  });
});

describe('buildReportSections — stored_hot_water section', () => {
  it('includes stored_hot_water when recommended option is a stored system', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    expect(sections.some(s => s.id === 'stored_hot_water')).toBe(true);
  });

  it('stored_hot_water carries dhw headline and bullets', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'stored_hot_water');
    if (s?.id === 'stored_hot_water') {
      expect(s.headline).toBe('Adequate stored volume');
      expect(s.bullets).toContain('210L cylinder recommended');
    }
  });

  it('omits stored_hot_water when recommended option is a combi (on-demand)', () => {
    const output: EngineOutputV1 = {
      ...FULL_OUTPUT,
      options: [{ ...MINIMAL_COMBI_OPTION, dhw: { status: 'ok', headline: 'On-demand hot water', bullets: ['Requires 0.4 bar min'] } }],
    };
    const sections = buildReportSections(output);
    expect(sections.some(s => s.id === 'stored_hot_water')).toBe(false);
  });
});

describe('buildReportSections — risks_enablers section', () => {
  it('includes risks_enablers when sensitivities are present across options', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    expect(sections.some(s => s.id === 'risks_enablers')).toBe(true);
  });

  it('risks_enablers separates downgrade risks from upgrade enablers', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'risks_enablers');
    if (s?.id === 'risks_enablers') {
      expect(s.risks.some(r => r.lever === 'Loft space')).toBe(true);
      expect(s.enablers.some(e => e.lever === 'Primary pipe diameter')).toBe(true);
    }
  });

  it('omits risks_enablers when no options have sensitivities', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    expect(sections.some(s => s.id === 'risks_enablers')).toBe(false);
  });
});

describe('buildReportSections — engineering_notes section', () => {
  it('includes engineering_notes when options have mustHave or niceToHave items', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    expect(sections.some(s => s.id === 'engineering_notes')).toBe(true);
  });

  it('engineering_notes carries mustHave and niceToHave items', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'engineering_notes');
    if (s?.id === 'engineering_notes') {
      expect(s.mustHave).toContain('External wall space for outdoor unit');
      expect(s.niceToHave).toContain('Thermal store pre-plumbing');
    }
  });

  it('engineering_notes appears after physics_trace (appendix last)', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const traceIdx = sections.findIndex(s => s.id === 'physics_trace');
    const notesIdx = sections.findIndex(s => s.id === 'engineering_notes');
    expect(traceIdx).toBeGreaterThanOrEqual(0);
    expect(notesIdx).toBeGreaterThan(traceIdx);
  });

  it('omits engineering_notes when recommended option has no mustHave or niceToHave', () => {
    const output: EngineOutputV1 = {
      ...FULL_OUTPUT,
      options: [MINIMAL_COMBI_OPTION],
    };
    const sections = buildReportSections(output);
    expect(sections.some(s => s.id === 'engineering_notes')).toBe(false);
  });
});

// ─── Section structure sanity tests ──────────────────────────────────────────

describe('buildReportSections — section structure sanity', () => {
  it('returns no duplicate section IDs for minimal output', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    const ids = sections.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('returns no duplicate section IDs for full output', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const ids = sections.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('returns no duplicate section IDs for output with options', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const ids = sections.map(s => s.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it('every section has a defined id', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    sections.forEach(s => {
      expect(s.id).toBeTruthy();
    });
  });

  it('system_summary always appears first', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    expect(sections[0].id).toBe('system_summary');
  });

  it('customer group (system_summary → verdict) appears before technical group', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const verdictIdx = sections.findIndex(s => s.id === 'verdict');
    const archIdx = sections.findIndex(s => s.id === 'system_architecture');
    expect(verdictIdx).toBeGreaterThanOrEqual(0);
    expect(archIdx).toBeGreaterThan(verdictIdx);
  });

  it('appendix sections appear after all technical summary sections', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const assumptionsIdx = sections.findIndex(s => s.id === 'assumptions');
    const traceIdx = sections.findIndex(s => s.id === 'physics_trace');
    expect(assumptionsIdx).toBeGreaterThanOrEqual(0);
    expect(traceIdx).toBeGreaterThan(assumptionsIdx);
  });

  it('omits physics_trace when behaviourTimeline is absent', () => {
    const output: EngineOutputV1 = {
      ...OUTPUT_WITH_OPTIONS,
      behaviourTimeline: undefined,
    };
    const sections = buildReportSections(output);
    expect(sections.some(s => s.id === 'physics_trace')).toBe(false);
  });
});
