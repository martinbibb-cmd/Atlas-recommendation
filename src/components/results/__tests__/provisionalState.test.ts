/**
 * provisionalState.test.ts
 *
 * Unit tests for the PR10 presentation helpers:
 *
 *   buildProvisionalNote    — derives the provisional/caveat note for the
 *                             recommendation summary card (SystemRecommendationPanel)
 *   buildEvidenceSummaryLine — derives a one-sentence partial-evidence summary
 *                              for the Measurement Confidence panel header
 *                              (RecommendationHub)
 */
import { describe, it, expect } from 'vitest';
import { buildProvisionalNote } from '../SystemRecommendationPanel';
import { buildEvidenceSummaryLine } from '../RecommendationHub';
import type { EngineOutputV1, EvidenceItemV1 } from '../../../contracts/EngineOutputV1';

// ─── Minimal EngineOutputV1 factory ──────────────────────────────────────────

function makeOutput(
  level: 'high' | 'medium' | 'low',
  unlockBy: string[] = [],
  overrides: Partial<EngineOutputV1> = {},
): EngineOutputV1 {
  return {
    recommendation: { primary: 'On Demand (Combi)' },
    options: [],
    eligibility: [],
    redFlags: [],
    evidence: [],
    meta: {
      engineVersion: '2.3' as EngineOutputV1['meta']['engineVersion'],
      contractVersion: '1' as EngineOutputV1['meta']['contractVersion'],
      confidence: { level, reasons: [], unlockBy },
    },
    ...overrides,
  } as unknown as EngineOutputV1;
}

// ─── Minimal EvidenceItemV1 factory ──────────────────────────────────────────

function makeEvidence(
  id: string,
  source: EvidenceItemV1['source'],
): EvidenceItemV1 {
  return {
    id,
    fieldPath: `field.${id}`,
    label: `Label ${id}`,
    value: 'n/a',
    source,
    confidence: 'high',
    affectsOptionIds: [],
  };
}

// ─── buildProvisionalNote ─────────────────────────────────────────────────────

describe('buildProvisionalNote', () => {
  it('returns null when confidence is high and no unlockBy', () => {
    const output = makeOutput('high', []);
    expect(buildProvisionalNote(output)).toBeNull();
  });

  it('returns null when confidence is high even with unlockBy items', () => {
    const output = makeOutput('high', ['static pressure reading']);
    expect(buildProvisionalNote(output)).toBeNull();
  });

  it('returns null when confidence is medium and no unlockBy', () => {
    const output = makeOutput('medium', []);
    expect(buildProvisionalNote(output)).toBeNull();
  });

  it('returns null when confidence is low and no unlockBy', () => {
    const output = makeOutput('low', []);
    expect(buildProvisionalNote(output)).toBeNull();
  });

  it('returns "provisional until" note for low confidence with unlockBy', () => {
    const output = makeOutput('low', ['static pressure reading']);
    const note = buildProvisionalNote(output);
    expect(note).not.toBeNull();
    expect(note).toMatch(/provisional until/i);
    expect(note).toContain('static pressure reading');
  });

  it('returns "firmer with" note for medium confidence with unlockBy', () => {
    const output = makeOutput('medium', ['cylinder condition assessment']);
    const note = buildProvisionalNote(output);
    expect(note).not.toBeNull();
    expect(note).toMatch(/would be firmer with/i);
    expect(note).toContain('cylinder condition assessment');
  });

  it('uses the highest-priority unlock item (static pressure first)', () => {
    const output = makeOutput('low', [
      'cylinder condition assessment',
      'static pressure reading',
    ]);
    const note = buildProvisionalNote(output);
    expect(note).toContain('static pressure reading');
    expect(note).not.toContain('cylinder condition assessment');
  });

  it('uses the highest-priority unlock item (dynamic flow before cylinder)', () => {
    const output = makeOutput('medium', [
      'cylinder condition assessment',
      'dynamic flow rate test',
    ]);
    const note = buildProvisionalNote(output);
    expect(note).toContain('dynamic flow rate test');
    expect(note).not.toContain('cylinder condition assessment');
  });

  it('returns null when meta confidence is absent and no verdict confidence', () => {
    const output = {
      recommendation: { primary: 'On Demand (Combi)' },
      options: [],
      eligibility: [],
      redFlags: [],
      evidence: [],
    } as unknown as EngineOutputV1;
    expect(buildProvisionalNote(output)).toBeNull();
  });

  it('falls back to verdict.confidence when meta.confidence is absent', () => {
    const output = {
      recommendation: { primary: 'On Demand (Combi)' },
      options: [],
      eligibility: [],
      redFlags: [],
      evidence: [],
      verdict: {
        status: 'pass',
        title: '',
        reasons: [],
        confidence: {
          level: 'medium',
          reasons: [],
          unlockBy: ['cylinder sizing'],
        },
      },
    } as unknown as EngineOutputV1;
    const note = buildProvisionalNote(output);
    expect(note).not.toBeNull();
    expect(note).toMatch(/firmer with/i);
    expect(note).toContain('cylinder sizing');
  });

  it('note ends with a period', () => {
    const output = makeOutput('low', ['static pressure reading']);
    const note = buildProvisionalNote(output);
    expect(note).toMatch(/\.$/);
  });

  it('is case-insensitive in priority matching', () => {
    const output = makeOutput('low', ['STATIC PRESSURE CHECK']);
    const note = buildProvisionalNote(output);
    expect(note).toContain('STATIC PRESSURE CHECK');
  });

  it('does not mutate the input unlockBy array', () => {
    const unlockBy = ['cylinder condition', 'static pressure'];
    const original = [...unlockBy];
    const output = makeOutput('low', unlockBy);
    buildProvisionalNote(output);
    expect(unlockBy).toEqual(original);
  });
});

// ─── buildEvidenceSummaryLine ─────────────────────────────────────────────────

describe('buildEvidenceSummaryLine', () => {
  it('returns null for empty evidence array', () => {
    expect(buildEvidenceSummaryLine([])).toBeNull();
  });

  it('returns null when all evidence is measured (no assumed)', () => {
    const evidence = [
      makeEvidence('e1', 'manual'),
      makeEvidence('e2', 'manual'),
    ];
    expect(buildEvidenceSummaryLine(evidence)).toBeNull();
  });

  it('returns survey-only copy when no measured evidence', () => {
    const evidence = [
      makeEvidence('e1', 'assumed'),
      makeEvidence('e2', 'derived'),
    ];
    const line = buildEvidenceSummaryLine(evidence);
    expect(line).not.toBeNull();
    expect(line).toMatch(/survey details only/i);
    expect(line).toMatch(/no site measurements/i);
  });

  it('returns survey-only copy when only placeholder evidence (no measured)', () => {
    const evidence = [
      makeEvidence('e1', 'placeholder'),
    ];
    const line = buildEvidenceSummaryLine(evidence);
    // placeholder-only → measuredCount=0, assumedCount=0 → null
    expect(line).toBeNull();
  });

  it('includes measured count and assumed count in mixed scenario', () => {
    const evidence = [
      makeEvidence('e1', 'manual'),
      makeEvidence('e2', 'manual'),
      makeEvidence('e3', 'assumed'),
    ];
    const line = buildEvidenceSummaryLine(evidence);
    expect(line).not.toBeNull();
    expect(line).toContain('2');
    expect(line).toContain('1');
    expect(line).toMatch(/site measurement/i);
    expect(line).toMatch(/survey-derived/i);
  });

  it('uses singular "measurement" for count of 1', () => {
    const evidence = [
      makeEvidence('e1', 'manual'),
      makeEvidence('e2', 'assumed'),
    ];
    const line = buildEvidenceSummaryLine(evidence);
    expect(line).toMatch(/1 site measurement[^s]/);
  });

  it('uses plural "measurements" for count > 1', () => {
    const evidence = [
      makeEvidence('e1', 'manual'),
      makeEvidence('e2', 'manual'),
      makeEvidence('e3', 'assumed'),
    ];
    const line = buildEvidenceSummaryLine(evidence);
    expect(line).toMatch(/2 site measurements/);
  });

  it('uses singular "value" for assumed count of 1', () => {
    const evidence = [
      makeEvidence('e1', 'manual'),
      makeEvidence('e2', 'assumed'),
    ];
    const line = buildEvidenceSummaryLine(evidence);
    expect(line).toMatch(/1 survey-derived value[^s]/);
  });

  it('uses plural "values" for assumed count > 1', () => {
    const evidence = [
      makeEvidence('e1', 'manual'),
      makeEvidence('e2', 'assumed'),
      makeEvidence('e3', 'derived'),
    ];
    const line = buildEvidenceSummaryLine(evidence);
    expect(line).toMatch(/2 survey-derived values/);
  });

  it('counts "derived" source items as survey-derived (same bucket as assumed)', () => {
    const evidence = [
      makeEvidence('e1', 'manual'),
      makeEvidence('e2', 'derived'),
    ];
    const line = buildEvidenceSummaryLine(evidence);
    expect(line).not.toBeNull();
    expect(line).toMatch(/survey-derived/i);
  });

  it('ignores placeholder items in the count (they are shown separately)', () => {
    const evidence = [
      makeEvidence('e1', 'manual'),
      makeEvidence('e2', 'assumed'),
      makeEvidence('e3', 'placeholder'),
    ];
    const line = buildEvidenceSummaryLine(evidence);
    // placeholder items do not contribute to the measured or assumed counts
    expect(line).toContain('1 site measurement');
    expect(line).toContain('1 survey-derived value');
  });

  it('does not mutate the input evidence array', () => {
    const evidence = [
      makeEvidence('e1', 'manual'),
      makeEvidence('e2', 'assumed'),
    ];
    const originalIds = evidence.map(e => e.id);
    buildEvidenceSummaryLine(evidence);
    expect(evidence.map(e => e.id)).toEqual(originalIds);
  });
});
