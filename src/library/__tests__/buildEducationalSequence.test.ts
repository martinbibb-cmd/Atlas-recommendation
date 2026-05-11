import { describe, expect, it } from 'vitest';
import { buildEducationalSequence } from '../sequencing/buildEducationalSequence';
import { educationalSequenceRules } from '../sequencing/educationalSequenceRules';
import type { EducationalSequenceRuleV1 } from '../sequencing/EducationalSequenceRuleV1';
import { resolveCustomerAnxietyPatterns } from '../emotionalRouting';

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildInput(
  selectedConceptIds: string[],
  overrides: Partial<Parameters<typeof buildEducationalSequence>[0]> = {},
) {
  return buildEducationalSequence({
    selectedConceptIds,
    sequenceRules: educationalSequenceRules,
    archetypeId: 'test_archetype',
    ...overrides,
  });
}

// ─── Basic determinism ───────────────────────────────────────────────────────

describe('buildEducationalSequence — determinism', () => {
  it('produces identical output for the same input on repeated calls', () => {
    const concepts = ['system_fit_explanation', 'operating_behaviour', 'emitter_sizing'];
    const a = buildInput(concepts);
    const b = buildInput(concepts);

    expect(a.orderedSequence.map((c) => c.conceptId)).toEqual(
      b.orderedSequence.map((c) => c.conceptId),
    );
    expect(a.deferredConcepts.length).toBe(b.deferredConcepts.length);
  });

  it('output position values are monotonically increasing from 0', () => {
    const { orderedSequence } = buildInput([
      'system_fit_explanation',
      'emitter_sizing',
      'operating_behaviour',
    ]);

    orderedSequence.forEach((item, idx) => {
      expect(item.position).toBe(idx);
    });
  });
});

// ─── Stage ordering ──────────────────────────────────────────────────────────

describe('buildEducationalSequence — stage ordering', () => {
  it('places reassurance concepts before expectation concepts', () => {
    const { orderedSequence } = buildInput([
      'emitter_sizing',           // expectation
      'system_fit_explanation',   // reassurance
    ]);

    const positions = orderedSequence.reduce<Record<string, number>>(
      (acc, c) => ({ ...acc, [c.conceptId]: c.position }),
      {},
    );

    expect(positions['system_fit_explanation']).toBeLessThan(positions['emitter_sizing']!);
  });

  it('places reassurance before lived_experience', () => {
    const { orderedSequence } = buildInput([
      'operating_behaviour',      // lived_experience (prereq: system_fit_explanation)
      'system_fit_explanation',   // reassurance
    ]);

    const reassuranceItem = orderedSequence.find((c) => c.conceptId === 'system_fit_explanation');
    const livedItem = orderedSequence.find((c) => c.conceptId === 'operating_behaviour');

    expect(reassuranceItem).toBeDefined();
    expect(livedItem).toBeDefined();
    expect(reassuranceItem!.position).toBeLessThan(livedItem!.position);
  });

  it('places technical_detail after lived_experience', () => {
    const { orderedSequence } = buildInput([
      'SIZ-01',                   // technical_detail (prereqs: system_fit_explanation, emitter_sizing)
      'emitter_sizing',           // expectation
      'system_fit_explanation',   // reassurance
    ]);

    const technical = orderedSequence.find((c) => c.sequenceStage === 'technical_detail');
    const lived = orderedSequence.find((c) => c.sequenceStage === 'expectation');

    if (technical && lived) {
      expect(technical.position).toBeGreaterThan(lived.position);
    }
  });
});

// ─── Reassurance before cautionary ───────────────────────────────────────────

describe('buildEducationalSequence — reassurance before cautionary', () => {
  it('reassurance appears before cautionary concepts', () => {
    const { orderedSequence } = buildInput([
      'boiler_cycling',          // misconception + cautionary (prereqs: system_fit_explanation, operating_behaviour)
      'system_fit_explanation',  // reassurance
      'operating_behaviour',     // lived_experience (prereq: system_fit_explanation)
    ]);

    const reassurancePos = orderedSequence.find(
      (c) => c.sequenceStage === 'reassurance',
    )?.position;

    const cautionaryPos = orderedSequence.find(
      (c) => c.emotionalWeight === 'cautionary',
    )?.position;

    if (reassurancePos !== undefined && cautionaryPos !== undefined) {
      expect(reassurancePos).toBeLessThan(cautionaryPos);
    }
  });
});

// ─── Technical detail deferred ───────────────────────────────────────────────

describe('buildEducationalSequence — technical detail deferred when prerequisite missing', () => {
  it('defers SIZ-02 if SIZ-01 is not in selected concepts', () => {
    const { deferredConcepts } = buildInput([
      'system_fit_explanation',
      'operating_behaviour',
      'SIZ-02',  // prereqs: SIZ-01, operating_behaviour — SIZ-01 missing
    ]);

    const deferred = deferredConcepts.find((d) => d.conceptId === 'SIZ-02');
    expect(deferred).toBeDefined();
    expect(deferred!.reason).toContain('SIZ-01');
  });

  it('does not defer SIZ-02 when all prerequisites are present', () => {
    const { deferredConcepts, orderedSequence } = buildInput([
      'system_fit_explanation',
      'emitter_sizing',
      'operating_behaviour',
      'SIZ-01',
      'SIZ-02',
    ]);

    const deferred = deferredConcepts.find((d) => d.conceptId === 'SIZ-02');
    expect(deferred).toBeUndefined();

    const placed = orderedSequence.find((c) => c.conceptId === 'SIZ-02');
    expect(placed).toBeDefined();
  });
});

// ─── Repeated concept suppression ────────────────────────────────────────────

describe('buildEducationalSequence — suppression of already-explained concepts', () => {
  it('suppresses a concept that is marked suppressIfAlreadyExplained and was already explained', () => {
    const { deferredConcepts } = buildInput(
      ['system_fit_explanation', 'operating_behaviour'],
      { alreadyExplainedConceptIds: ['operating_behaviour'] },
    );

    const suppressed = deferredConcepts.find((d) => d.conceptId === 'operating_behaviour');
    expect(suppressed).toBeDefined();
    expect(suppressed!.reason).toContain('Already explained');
  });

  it('does not suppress a concept that is not in alreadyExplainedConceptIds', () => {
    const { deferredConcepts, orderedSequence } = buildInput(
      ['system_fit_explanation', 'operating_behaviour'],
      { alreadyExplainedConceptIds: [] },
    );

    const suppressed = deferredConcepts.find((d) => d.conceptId === 'operating_behaviour');
    expect(suppressed).toBeUndefined();

    const placed = orderedSequence.find((c) => c.conceptId === 'operating_behaviour');
    expect(placed).toBeDefined();
  });
});

// ─── Accessibility profiles reduce simultaneous concept count ─────────────────

describe('buildEducationalSequence — accessibility profiles', () => {
  it('ADHD profile reduces applied max simultaneous concepts to 1', () => {
    const { appliedMaxSimultaneous } = buildInput(
      ['system_fit_explanation', 'emitter_sizing'],
      { accessibilityPreferences: { profiles: ['adhd'] } },
    );

    expect(appliedMaxSimultaneous).toBe(1);
  });

  it('dyslexia profile reduces applied max simultaneous concepts to 2', () => {
    const { appliedMaxSimultaneous } = buildInput(
      ['system_fit_explanation', 'emitter_sizing'],
      { accessibilityPreferences: { profiles: ['dyslexia'] } },
    );

    expect(appliedMaxSimultaneous).toBe(2);
  });

  it('most restrictive profile wins when multiple are supplied', () => {
    const { appliedMaxSimultaneous } = buildInput(
      ['system_fit_explanation'],
      { accessibilityPreferences: { profiles: ['dyslexia', 'adhd'] } },
    );

    expect(appliedMaxSimultaneous).toBe(1);
  });

  it('emits an overload warning when a stage exceeds the ADHD cap', () => {
    // reassurance stage gets two concepts but ADHD cap is 1
    const { overloadWarnings } = buildInput(
      ['system_fit_explanation', 'HYD-02'],
      { accessibilityPreferences: { profiles: ['adhd'] } },
    );

    const stageWarning = overloadWarnings.find((w) => w.includes('reassurance'));
    expect(stageWarning).toBeDefined();
  });

  it('default profile uses cap of 4', () => {
    const { appliedMaxSimultaneous } = buildInput(['system_fit_explanation'], {
      accessibilityPreferences: {},
    });

    expect(appliedMaxSimultaneous).toBe(4);
  });
});

describe('buildEducationalSequence — customer anxiety routing', () => {
  it('heat-pump anxiety increases reassurance-stage concepts', () => {
    const selectedConceptIds = [
      'system_fit_explanation',
      'flow_temperature_living_with_it',
      'hot_radiator_expectation',
    ];

    const withoutAnxiety = buildInput(selectedConceptIds);
    const withAnxiety = buildInput(selectedConceptIds, {
      anxietyRouting: resolveCustomerAnxietyPatterns({
        concernTags: ['heat_pump'],
      }),
    });

    const reassuranceWithout = withoutAnxiety.orderedSequence.filter((item) => item.sequenceStage === 'reassurance').length;
    const reassuranceWith = withAnxiety.orderedSequence.filter((item) => item.sequenceStage === 'reassurance').length;
    expect(reassuranceWith).toBeGreaterThan(reassuranceWithout);
  });

  it('skeptical-of-sales suppresses marketing-style concept placement', () => {
    const withAnxiety = buildInput(
      ['system_fit_explanation', 'premium_hot_water_performance'],
      {
        anxietyRouting: resolveCustomerAnxietyPatterns({
          concernTags: ['sales'],
        }),
      },
    );

    expect(withAnxiety.orderedSequence.some((item) => item.conceptId === 'premium_hot_water_performance')).toBe(false);
    expect(withAnxiety.deferredConcepts.some((item) => item.conceptId === 'premium_hot_water_performance')).toBe(true);
  });

  it('disruption anxiety boosts what-stays-familiar concepts', () => {
    const selectedConceptIds = ['HYD-02', 'system_fit_explanation'];

    const withoutAnxiety = buildInput(selectedConceptIds);
    const withAnxiety = buildInput(selectedConceptIds, {
      anxietyRouting: resolveCustomerAnxietyPatterns({
        concernTags: ['disruption'],
      }),
    });

    const withoutPosition = withoutAnxiety.orderedSequence.findIndex((item) => item.conceptId === 'system_fit_explanation');
    const withPosition = withAnxiety.orderedSequence.findIndex((item) => item.conceptId === 'system_fit_explanation');
    expect(withPosition).toBeLessThan(withoutPosition);
  });

  it('ADHD + anxiety reduces concept density further', () => {
    const selectedConceptIds = [
      'system_fit_explanation',
      'emitter_sizing',
      'operating_behaviour',
      'boiler_cycling',
      'SIZ-01',
      'SIZ-02',
    ];

    const adhdOnly = buildInput(selectedConceptIds, {
      accessibilityPreferences: { profiles: ['adhd'] },
    });

    const adhdWithAnxiety = buildInput(selectedConceptIds, {
      accessibilityPreferences: { profiles: ['adhd'] },
      anxietyRouting: resolveCustomerAnxietyPatterns({
        concernTags: ['heat_pump'],
        accessibilityProfiles: ['adhd'],
      }),
    });

    expect(adhdWithAnxiety.orderedSequence.length).toBeLessThan(adhdOnly.orderedSequence.length);
  });
});

// ─── High-load concept separation ────────────────────────────────────────────

describe('buildEducationalSequence — high cognitive-load concept separation', () => {
  it('emits a consecutive-cautionary warning when two cautionary concepts are adjacent', () => {
    // Build a minimal custom rule set that puts two cautionary concepts adjacent.
    const customRules: EducationalSequenceRuleV1[] = [
      {
        ruleId: 'test_cautionary_a',
        conceptId: 'cautionary_a',
        sequenceStage: 'misconception',
        emotionalWeight: 'cautionary',
        maxSimultaneousConcepts: 2,
      },
      {
        ruleId: 'test_cautionary_b',
        conceptId: 'cautionary_b',
        sequenceStage: 'misconception',
        emotionalWeight: 'cautionary',
        maxSimultaneousConcepts: 2,
      },
    ];

    const { overloadWarnings } = buildEducationalSequence({
      selectedConceptIds: ['cautionary_a', 'cautionary_b'],
      sequenceRules: customRules,
      archetypeId: 'test',
    });

    const consecutiveWarning = overloadWarnings.find((w) => w.includes('Consecutive cautionary'));
    expect(consecutiveWarning).toBeDefined();
  });

  it('places calming concepts before cautionary ones within the same stage', () => {
    // The engine sorts within a stage: calming → neutral → cautionary.
    // This means a calming concept always precedes cautionary ones.
    // When two cautionary concepts share a stage, the engine detects the
    // adjacency and emits a warning so the renderer can insert a pause.
    const customRules: EducationalSequenceRuleV1[] = [
      {
        ruleId: 'test_cautionary_a',
        conceptId: 'cautionary_a',
        sequenceStage: 'misconception',
        emotionalWeight: 'cautionary',
        maxSimultaneousConcepts: 3,
      },
      {
        ruleId: 'test_calm_buffer',
        conceptId: 'calm_buffer',
        sequenceStage: 'misconception',
        emotionalWeight: 'calming',
        maxSimultaneousConcepts: 3,
      },
      {
        ruleId: 'test_cautionary_b',
        conceptId: 'cautionary_b',
        sequenceStage: 'misconception',
        emotionalWeight: 'cautionary',
        maxSimultaneousConcepts: 3,
      },
    ];

    const { orderedSequence } = buildEducationalSequence({
      selectedConceptIds: ['cautionary_a', 'calm_buffer', 'cautionary_b'],
      sequenceRules: customRules,
      archetypeId: 'test',
    });

    // Calming concept is placed first within its stage.
    const calmPos = orderedSequence.find((c) => c.conceptId === 'calm_buffer')?.position;
    const cautionaryAPos = orderedSequence.find((c) => c.conceptId === 'cautionary_a')?.position;
    const cautionaryBPos = orderedSequence.find((c) => c.conceptId === 'cautionary_b')?.position;

    expect(calmPos).toBeDefined();
    expect(cautionaryAPos).toBeDefined();
    expect(cautionaryBPos).toBeDefined();
    expect(calmPos!).toBeLessThan(cautionaryAPos!);
    expect(calmPos!).toBeLessThan(cautionaryBPos!);
  });
});

// ─── Pacing metadata ─────────────────────────────────────────────────────────

describe('buildEducationalSequence — pacing metadata', () => {
  it('emits pacing metadata for all seven stages', () => {
    const { pacingMetadata } = buildInput(['system_fit_explanation']);

    const stages = pacingMetadata.map((m) => m.stage);

    expect(stages).toContain('reassurance');
    expect(stages).toContain('expectation');
    expect(stages).toContain('lived_experience');
    expect(stages).toContain('misconception');
    expect(stages).toContain('deeper_understanding');
    expect(stages).toContain('technical_detail');
    expect(stages).toContain('appendix_only');
  });

  it('concept counts per stage match the placed concepts', () => {
    const { orderedSequence, pacingMetadata } = buildInput([
      'system_fit_explanation',  // reassurance
      'emitter_sizing',          // expectation
    ]);

    const reassurance = pacingMetadata.find((m) => m.stage === 'reassurance');
    const expectation = pacingMetadata.find((m) => m.stage === 'expectation');

    const reassurancePlaced = orderedSequence.filter(
      (c) => c.sequenceStage === 'reassurance',
    ).length;
    const expectationPlaced = orderedSequence.filter(
      (c) => c.sequenceStage === 'expectation',
    ).length;

    expect(reassurance?.conceptCount).toBe(reassurancePlaced);
    expect(expectation?.conceptCount).toBe(expectationPlaced);
  });
});

// ─── Unknown concept fallback ─────────────────────────────────────────────────

describe('buildEducationalSequence — fallback for unknown conceptIds', () => {
  it('places concepts with no matching rule at the end as technical_detail', () => {
    const { orderedSequence } = buildInput(['system_fit_explanation', 'completely_unknown_concept']);

    const unknown = orderedSequence.find((c) => c.conceptId === 'completely_unknown_concept');
    expect(unknown).toBeDefined();
    expect(unknown!.sequenceStage).toBe('technical_detail');
    expect(unknown!.position).toBeGreaterThan(0);
  });
});

// ─── Canonical rule set integrity ────────────────────────────────────────────

describe('educationalSequenceRules — canonical data integrity', () => {
  it('has unique ruleIds', () => {
    const ids = educationalSequenceRules.map((r) => r.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every rule has a non-empty conceptId and ruleId', () => {
    for (const rule of educationalSequenceRules) {
      expect(rule.ruleId.length).toBeGreaterThan(0);
      expect(rule.conceptId.length).toBeGreaterThan(0);
    }
  });

  it('every rule has a valid sequenceStage', () => {
    const VALID_STAGES = [
      'reassurance',
      'expectation',
      'lived_experience',
      'misconception',
      'deeper_understanding',
      'technical_detail',
      'appendix_only',
    ];

    for (const rule of educationalSequenceRules) {
      expect(VALID_STAGES).toContain(rule.sequenceStage);
    }
  });

  it('every rule has a valid emotionalWeight', () => {
    const VALID_WEIGHTS = ['calming', 'neutral', 'cautionary'];

    for (const rule of educationalSequenceRules) {
      expect(VALID_WEIGHTS).toContain(rule.emotionalWeight);
    }
  });

  it('maxSimultaneousConcepts is a positive integer on every rule', () => {
    for (const rule of educationalSequenceRules) {
      expect(rule.maxSimultaneousConcepts).toBeGreaterThan(0);
      expect(Number.isInteger(rule.maxSimultaneousConcepts)).toBe(true);
    }
  });

  it('cooldownAfter, when present, is a non-negative integer', () => {
    for (const rule of educationalSequenceRules) {
      if (rule.cooldownAfter !== undefined) {
        expect(rule.cooldownAfter).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(rule.cooldownAfter)).toBe(true);
      }
    }
  });
});
