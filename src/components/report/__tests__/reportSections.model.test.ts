/**
 * reportSections.model.test.ts
 *
 * Unit tests for the reportSections.model mapping layer.
 *
 * Validates:
 *   - checkCompleteness correctly identifies essential vs optional data
 *   - buildReportSections returns sections in canonical five-page order
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

/** Full output with all optional data present, including a flow-rate limiter. */
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

/** Output with a full option card so pages 2–4 are populated. */
const OUTPUT_WITH_OPTIONS: EngineOutputV1 = {
  ...FULL_OUTPUT,
  options: [
    {
      id: 'system_unvented',
      label: 'System boiler with unvented cylinder',
      status: 'viable',
      headline: 'Stored hot water system',
      why: ['Stored volume removes flow dependency'],
      requirements: [],
      heat: { status: 'ok', headline: 'Good at mid flow temp', bullets: ['60°C flow comfortable'] },
      dhw: { status: 'ok', headline: 'Adequate stored volume', bullets: ['150L cylinder needed', 'Meets peak demand'] },
      engineering: { status: 'caution', headline: 'Minor installation works', bullets: ['Add cylinder and pipework', 'Discharge valve required'] },
      typedRequirements: {
        mustHave: ['Cylinder space required'],
        likelyUpgrades: ['Primary pipework upsize'],
        niceToHave: ['Smart controls'],
      },
      sensitivities: [
        { lever: 'Cylinder size', effect: 'upgrade', note: 'Larger cylinder reduces re-heat frequency.' },
        { lever: 'Loft headroom', effect: 'downgrade', note: 'Low loft restricts cylinder siting.' },
      ],
    },
    {
      id: 'ashp',
      label: 'Heat pump',
      status: 'caution',
      headline: 'Heat pump system',
      why: ['Low carbon alternative'],
      requirements: [],
      heat: { status: 'ok', headline: 'Efficient at low flow temp', bullets: ['45°C flow comfortable'] },
      dhw: { status: 'caution', headline: 'Stored with immersion backup', bullets: ['210L cylinder needed'] },
      engineering: { status: 'caution', headline: 'Significant installation works', bullets: ['External unit space needed', 'Larger radiators likely required'] },
      typedRequirements: {
        mustHave: ['External wall space for heat pump unit', 'Larger emitters or underfloor heating'],
        likelyUpgrades: ['Radiator upgrades'],
        niceToHave: [],
      },
      sensitivities: [],
    },
  ],
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

// ─── buildReportSections — minimal output (no options, no limiters) ───────────

describe('buildReportSections — minimal output', () => {
  it('always includes decision_page as the first section', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    expect(sections[0].id).toBe('decision_page');
  });

  it('always includes engineer_summary as the last section', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    expect(sections[sections.length - 1].id).toBe('engineer_summary');
  });

  it('produces exactly 2 sections (decision_page + engineer_summary) with no option data', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    expect(sections).toHaveLength(2);
  });

  it('decision_page carries the recommendation text from engine output', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    const s = sections.find(sec => sec.id === 'decision_page');
    if (s?.id === 'decision_page') {
      expect(s.recommendedSystem).toBe('Gas combi boiler');
    }
  });

  it('decision_page has empty measuredFacts when no limiters are present', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    const s = sections.find(sec => sec.id === 'decision_page');
    if (s?.id === 'decision_page') {
      expect(s.measuredFacts).toHaveLength(0);
    }
  });

  it('decision_page headline falls back to verdict.title when no limiters', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    const s = sections.find(sec => sec.id === 'decision_page');
    if (s?.id === 'decision_page') {
      expect(s.headline).toBe('Combi recommended');
    }
  });

  it('decision_page.verdictStatus matches verdict.status', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    const s = sections.find(sec => sec.id === 'decision_page');
    if (s?.id === 'decision_page') {
      expect(s.verdictStatus).toBe('good');
    }
  });

  it('engineer_summary carries verdict confidence level', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    const s = sections.find(sec => sec.id === 'engineer_summary');
    if (s?.id === 'engineer_summary') {
      expect(s.confidenceLevel).toBe('medium');
    }
  });

  it('engineer_summary has empty beforeYouStart when no options/unknowns', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    const s = sections.find(sec => sec.id === 'engineer_summary');
    if (s?.id === 'engineer_summary') {
      expect(s.beforeYouStart).toHaveLength(0);
    }
  });

  it('omits daily_experience when no option data is available', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    expect(sections.some(s => s.id === 'daily_experience')).toBe(false);
  });

  it('omits what_changes when no option data is available', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    expect(sections.some(s => s.id === 'what_changes')).toBe(false);
  });

  it('omits alternatives_page when no option data is available', () => {
    const sections = buildReportSections(MINIMAL_OUTPUT);
    expect(sections.some(s => s.id === 'alternatives_page')).toBe(false);
  });
});

// ─── buildReportSections — full output (limiters, no options) ─────────────────

describe('buildReportSections — full output with limiters', () => {
  it('decision_page headline signals constraint when warn limiter is present', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const s = sections.find(sec => sec.id === 'decision_page');
    if (s?.id === 'decision_page') {
      expect(s.headline).toBe('System constraint identified');
    }
  });

  it('decision_page includes measuredFacts from the primary limiter', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const s = sections.find(sec => sec.id === 'decision_page');
    if (s?.id === 'decision_page') {
      expect(s.measuredFacts).toHaveLength(2);
      expect(s.measuredFacts[0].value).toMatch(/12/);
      expect(s.measuredFacts[1].value).toMatch(/15/);
    }
  });

  it('decision_page consequence comes from limiter impact.summary', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const s = sections.find(sec => sec.id === 'decision_page');
    if (s?.id === 'decision_page') {
      expect(s.consequence).toBe('Observed flow is below recommended minimum.');
    }
  });

  it('engineer_summary keyConstraint includes limiter title and observed value', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const s = sections.find(sec => sec.id === 'engineer_summary');
    if (s?.id === 'engineer_summary') {
      expect(s.keyConstraint).toMatch(/Flow rate marginal/);
      expect(s.keyConstraint).toMatch(/12/);
    }
  });

  it('sections follow canonical order: decision_page before engineer_summary', () => {
    const sections = buildReportSections(FULL_OUTPUT);
    const ids = sections.map(s => s.id);
    expect(ids.indexOf('decision_page')).toBeLessThan(ids.indexOf('engineer_summary'));
  });
});

// ─── buildReportSections — output with options ────────────────────────────────

describe('buildReportSections — output with option data', () => {
  it('includes all five page sections when option data is present', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const ids = sections.map(s => s.id);
    expect(ids).toContain('decision_page');
    expect(ids).toContain('daily_experience');
    expect(ids).toContain('what_changes');
    expect(ids).toContain('alternatives_page');
    expect(ids).toContain('engineer_summary');
  });

  it('sections follow canonical page order', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const ids = sections.map(s => s.id);
    expect(ids.indexOf('decision_page')).toBeLessThan(ids.indexOf('daily_experience'));
    expect(ids.indexOf('daily_experience')).toBeLessThan(ids.indexOf('what_changes'));
    expect(ids.indexOf('what_changes')).toBeLessThan(ids.indexOf('alternatives_page'));
    expect(ids.indexOf('alternatives_page')).toBeLessThan(ids.indexOf('engineer_summary'));
  });

  it('daily_experience scenarios are non-empty for a stored option', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'daily_experience');
    if (s?.id === 'daily_experience') {
      expect(s.scenarios.length).toBeGreaterThan(0);
      expect(s.scenarios.some(sc => sc.outcome === 'ok')).toBe(true);
      expect(s.scenarios.some(sc => sc.outcome === 'limited' || sc.outcome === 'slow')).toBe(true);
    }
  });

  it('what_changes contains mustHave items from the recommended option', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'what_changes');
    if (s?.id === 'what_changes') {
      expect(s.changes).toContain('Cylinder space required');
      expect(s.changes.length).toBeLessThanOrEqual(5);
    }
  });

  it('what_changes.systemLabel matches recommended option label', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'what_changes');
    if (s?.id === 'what_changes') {
      expect(s.systemLabel).toBe('System boiler with unvented cylinder');
    }
  });

  it('alternatives_page shows the secondary option', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'alternatives_page');
    if (s?.id === 'alternatives_page') {
      expect(s.recommendedLabel).toBe('System boiler with unvented cylinder');
      expect(s.alternative).not.toBeNull();
      expect(s.alternative?.label).toBe('Heat pump');
    }
  });

  it('alternatives_page tradeOffs contain mustHave requirements of the alternative', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'alternatives_page');
    if (s?.id === 'alternatives_page') {
      expect(s.alternative?.tradeOffs).toContain('External wall space for heat pump unit');
    }
  });

  it('engineer_summary.beforeYouStart contains mustHave from recommended option', () => {
    const sections = buildReportSections(OUTPUT_WITH_OPTIONS);
    const s = sections.find(sec => sec.id === 'engineer_summary');
    if (s?.id === 'engineer_summary') {
      expect(s.beforeYouStart).toContain('Cylinder space required');
    }
  });
});

// ─── Hard fail limiter headline ───────────────────────────────────────────────

describe('buildReportSections — hard fail limiter headline', () => {
  it('decision_page shows "cannot meet demand" headline when fail limiter is present', () => {
    const outputWithFailLimiter: EngineOutputV1 = {
      ...FULL_OUTPUT,
      limiters: {
        limiters: [
          {
            id: 'flow_insufficient',
            title: 'Mains flow insufficient',
            severity: 'fail' as const,
            observed: { label: 'Flow rate', value: 10, unit: 'L/min' as const },
            limit: { label: 'Min flow', value: 13, unit: 'L/min' as const },
            impact: { summary: 'Flow rate too low for combi operation.' },
            confidence: 'high' as const,
            sources: [],
            suggestedFixes: [],
          },
        ],
      },
    };
    const sections = buildReportSections(outputWithFailLimiter);
    const s = sections.find(sec => sec.id === 'decision_page');
    if (s?.id === 'decision_page') {
      expect(s.headline).toBe('Current setup cannot meet demand');
    }
  });
});

