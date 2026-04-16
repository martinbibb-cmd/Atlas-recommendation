import { describe, it, expect } from 'vitest';
import { buildScenarioRecommendationSummary } from '../buildScenarioRecommendationSummary';
import type { EngineOutputV1 } from '../../../../contracts/EngineOutputV1';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeMinimalOutput(overrides: Partial<EngineOutputV1> = {}): EngineOutputV1 {
  return {
    eligibility: [],
    redFlags: { rejectCombi: false, rejectAshp: false, reasons: [] } as unknown as EngineOutputV1['redFlags'],
    recommendation: { primary: 'On Demand (Combi)' },
    explainers: [],
    ...overrides,
  };
}

function makeOutputWithVerdict(
  verdictStatus: 'good' | 'caution' | 'fail',
  title = 'Test Verdict',
  primaryReason = 'Test primary reason',
): EngineOutputV1 {
  return makeMinimalOutput({
    verdict: {
      title,
      status: verdictStatus,
      reasons: ['Reason one', 'Reason two'],
      primaryReason,
      confidence: { level: 'high', reasons: [] },
      assumptionsUsed: [],
    },
  });
}

function makeOutputWithOptions(): EngineOutputV1 {
  return makeMinimalOutput({
    eligibility: [{ id: 'on_demand', label: 'On Demand (Combi)', status: 'viable' }],
    options: [
      {
        id: 'combi',
        label: 'On Demand (Combi)',
        status: 'viable',
        headline: 'Combi is a strong fit',
        why: ['Low disruption', 'Compact', 'Mains pressure adequate', 'No cylinder needed'],
        requirements: [],
        heat: { status: 'ok', headline: 'Good heat delivery', bullets: [] },
        dhw: { status: 'ok', headline: 'Adequate DHW', bullets: [] },
        engineering: { status: 'ok', headline: 'Simple install', bullets: [] },
        typedRequirements: {
          mustHave: ['Flue extension'],
          likelyUpgrades: ['TRVs on all radiators'],
          niceToHave: [],
          complianceRequired: ['Building regs notification'],
        },
        score: { total: 82, breakdown: [] },
      },
    ],
    limiters: {
      limiters: [
        {
          id: 'cycling-loss-penalty',
          title: 'Cycling loss',
          severity: 'warn',
          observed: { label: 'Cycles', value: 12, unit: 'kW' },
          limit: { label: 'Max', value: 8, unit: 'kW' },
          impact: { summary: 'Excess cycling reduces efficiency' },
          confidence: 'medium',
          sources: [],
          suggestedFixes: [],
        },
      ],
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildScenarioRecommendationSummary', () => {
  it('uses verdict title as headline when present', () => {
    const output = makeOutputWithVerdict('good', 'Combi is best');
    const summary = buildScenarioRecommendationSummary('sc-1', output);
    expect(summary.headline).toBe('Combi is best');
  });

  it('falls back to recommendation.primary when no verdict', () => {
    const output = makeMinimalOutput({ recommendation: { primary: 'Stored (Unvented)' } });
    const summary = buildScenarioRecommendationSummary('sc-1', output);
    expect(summary.headline).toBe('Stored (Unvented)');
  });

  it('uses verdict.primaryReason as primaryReason when present', () => {
    const output = makeOutputWithVerdict('good', 'Title', 'Physics-backed reason');
    const summary = buildScenarioRecommendationSummary('sc-1', output);
    expect(summary.primaryReason).toBe('Physics-backed reason');
  });

  it('falls back to verdict.reasons[0] when primaryReason is absent', () => {
    const output = makeMinimalOutput({
      verdict: {
        title: 'T',
        status: 'good',
        reasons: ['First reason'],
        confidence: { level: 'high', reasons: [] },
        assumptionsUsed: [],
      },
    });
    const summary = buildScenarioRecommendationSummary('sc-1', output);
    expect(summary.primaryReason).toBe('First reason');
  });

  it('falls back to empty primaryReason when nothing is available', () => {
    const output = makeMinimalOutput();
    const summary = buildScenarioRecommendationSummary('sc-1', output);
    expect(summary.primaryReason).toBe('');
  });

  it('sets suitability to recommended when verdict.status is good', () => {
    const output = makeOutputWithVerdict('good');
    expect(buildScenarioRecommendationSummary('sc-1', output).suitability).toBe('recommended');
  });

  it('sets suitability to possible_with_caveats when verdict.status is caution', () => {
    const output = makeOutputWithVerdict('caution');
    expect(buildScenarioRecommendationSummary('sc-1', output).suitability).toBe('possible_with_caveats');
  });

  it('sets suitability to less_suited when verdict.status is fail', () => {
    const output = makeOutputWithVerdict('fail');
    expect(buildScenarioRecommendationSummary('sc-1', output).suitability).toBe('less_suited');
  });

  it('derives suitability from option.status when no verdict', () => {
    const output = makeMinimalOutput({
      eligibility: [{ id: 'on_demand', label: 'On Demand (Combi)', status: 'viable' }],
      options: [
        {
          id: 'combi',
          label: 'On Demand (Combi)',
          status: 'viable',
          headline: '',
          why: [],
          requirements: [],
          heat: { status: 'ok', headline: '', bullets: [] },
          dhw: { status: 'ok', headline: '', bullets: [] },
          engineering: { status: 'ok', headline: '', bullets: [] },
          typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
        },
      ],
    });
    expect(buildScenarioRecommendationSummary('sc-1', output).suitability).toBe('recommended');
  });

  it('extracts strengths from primary option why[] (max 4)', () => {
    const output = makeOutputWithOptions();
    const summary = buildScenarioRecommendationSummary('sc-1', output);
    expect(summary.strengths).toEqual(['Low disruption', 'Compact', 'Mains pressure adequate', 'No cylinder needed']);
  });

  it('extracts tradeoffs from warn/fail limiters (max 3)', () => {
    const output = makeOutputWithOptions();
    const summary = buildScenarioRecommendationSummary('sc-1', output);
    expect(summary.tradeoffs).toEqual(['Excess cycling reduces efficiency']);
  });

  it('extracts requiredWork from typedRequirements.mustHave', () => {
    const output = makeOutputWithOptions();
    expect(buildScenarioRecommendationSummary('sc-1', output).requiredWork).toEqual(['Flue extension']);
  });

  it('extracts requiredSafetyAndCompliance from typedRequirements.complianceRequired', () => {
    const output = makeOutputWithOptions();
    expect(buildScenarioRecommendationSummary('sc-1', output).requiredSafetyAndCompliance).toEqual([
      'Building regs notification',
    ]);
  });

  it('extracts upgrades from typedRequirements.likelyUpgrades', () => {
    const output = makeOutputWithOptions();
    expect(buildScenarioRecommendationSummary('sc-1', output).upgrades).toEqual(['TRVs on all radiators']);
  });

  it('returns empty arrays when options and limiters are absent', () => {
    const output = makeMinimalOutput();
    const summary = buildScenarioRecommendationSummary('sc-1', output);
    expect(summary.strengths).toEqual([]);
    expect(summary.tradeoffs).toEqual([]);
    expect(summary.requiredWork).toEqual([]);
    expect(summary.requiredSafetyAndCompliance).toEqual([]);
    expect(summary.upgrades).toEqual([]);
  });

  it('always sets the scenarioId field', () => {
    const output = makeMinimalOutput();
    expect(buildScenarioRecommendationSummary('sc-test', output).scenarioId).toBe('sc-test');
  });

  it('uses eligibility fallback for suitability when no verdict and no options', () => {
    const output = makeMinimalOutput({
      eligibility: [{ id: 'on_demand', label: 'On Demand (Combi)', status: 'caution' }],
    });
    expect(buildScenarioRecommendationSummary('sc-1', output).suitability).toBe('possible_with_caveats');
  });

  it('returns less_suited when all eligibility items are rejected and no verdict', () => {
    const output = makeMinimalOutput({
      eligibility: [{ id: 'on_demand', label: 'On Demand (Combi)', status: 'rejected' }],
    });
    expect(buildScenarioRecommendationSummary('sc-1', output).suitability).toBe('less_suited');
  });
});
