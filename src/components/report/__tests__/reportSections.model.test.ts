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
});
