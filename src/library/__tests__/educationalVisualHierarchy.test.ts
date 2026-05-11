import { describe, expect, it } from 'vitest';
import {
  runVisualNoiseAudit,
  makeSectionSummary,
  MAX_PRIMARY_PER_SECTION,
  MAX_SUPPORTING_ADJACENT,
  MAX_DIAGRAMS_PER_SECTION,
  MAX_DIAGRAMS_TOTAL,
  MAX_CALLOUTS_PER_SECTION,
  PRIORITY_RENDERING_DESCRIPTORS,
  priorityFromSequenceStage,
  cardPriorityClass,
  cardPriorityAriaLabel,
  CARD_PRIORITY_GROUPED,
  CARD_EMPHASIS_DESCRIPTIONS,
  typographyRhythmRules,
} from '../ui/hierarchy';
import type { VisualNoiseAuditInputV1 } from '../ui/hierarchy';

// ─── Contract ────────────────────────────────────────────────────────────────

describe('EducationalVisualPriorityV1 — constants', () => {
  it('MAX_PRIMARY_PER_SECTION is 1', () => {
    expect(MAX_PRIMARY_PER_SECTION).toBe(1);
  });

  it('MAX_SUPPORTING_ADJACENT is 2', () => {
    expect(MAX_SUPPORTING_ADJACENT).toBe(2);
  });

  it('MAX_DIAGRAMS_PER_SECTION is 2', () => {
    expect(MAX_DIAGRAMS_PER_SECTION).toBe(2);
  });

  it('MAX_DIAGRAMS_TOTAL is 4', () => {
    expect(MAX_DIAGRAMS_TOTAL).toBe(4);
  });

  it('MAX_CALLOUTS_PER_SECTION is 3', () => {
    expect(MAX_CALLOUTS_PER_SECTION).toBe(3);
  });
});

// ─── priorityFromSequenceStage ────────────────────────────────────────────────

describe('priorityFromSequenceStage', () => {
  it('maps reassurance → primary', () => {
    expect(priorityFromSequenceStage('reassurance')).toBe('primary');
  });

  it('maps expectation → primary', () => {
    expect(priorityFromSequenceStage('expectation')).toBe('primary');
  });

  it('maps lived_experience → supporting', () => {
    expect(priorityFromSequenceStage('lived_experience')).toBe('supporting');
  });

  it('maps misconception → supporting', () => {
    expect(priorityFromSequenceStage('misconception')).toBe('supporting');
  });

  it('maps deeper_understanding → optional', () => {
    expect(priorityFromSequenceStage('deeper_understanding')).toBe('optional');
  });

  it('maps technical_detail → deferred', () => {
    expect(priorityFromSequenceStage('technical_detail')).toBe('deferred');
  });

  it('maps appendix_only → deferred', () => {
    expect(priorityFromSequenceStage('appendix_only')).toBe('deferred');
  });

  it('maps unknown stage → supporting as safe default', () => {
    expect(priorityFromSequenceStage('unknown_stage')).toBe('supporting');
  });
});

// ─── PRIORITY_RENDERING_DESCRIPTORS ──────────────────────────────────────────

describe('PRIORITY_RENDERING_DESCRIPTORS', () => {
  it('primary is full width with strong visual weight', () => {
    expect(PRIORITY_RENDERING_DESCRIPTORS.primary.fullWidth).toBe(true);
    expect(PRIORITY_RENDERING_DESCRIPTORS.primary.visualWeight).toBe('strong');
    expect(PRIORITY_RENDERING_DESCRIPTORS.primary.collapsedByDefault).toBe(false);
  });

  it('supporting is not full width and not collapsed by default', () => {
    expect(PRIORITY_RENDERING_DESCRIPTORS.supporting.fullWidth).toBe(false);
    expect(PRIORITY_RENDERING_DESCRIPTORS.supporting.visualWeight).toBe('normal');
    expect(PRIORITY_RENDERING_DESCRIPTORS.supporting.collapsedByDefault).toBe(false);
  });

  it('optional is visually subdued and collapsed by default', () => {
    expect(PRIORITY_RENDERING_DESCRIPTORS.optional.visualWeight).toBe('subdued');
    expect(PRIORITY_RENDERING_DESCRIPTORS.optional.collapsedByDefault).toBe(true);
  });

  it('deferred is hidden and collapsed by default', () => {
    expect(PRIORITY_RENDERING_DESCRIPTORS.deferred.visualWeight).toBe('hidden');
    expect(PRIORITY_RENDERING_DESCRIPTORS.deferred.collapsedByDefault).toBe(true);
  });
});

// ─── cardPriorityClass ────────────────────────────────────────────────────────

describe('cardPriorityClass', () => {
  it('returns BEM modifier class for each level', () => {
    expect(cardPriorityClass('primary')).toBe('atlas-edu-card--priority-primary');
    expect(cardPriorityClass('supporting')).toBe('atlas-edu-card--priority-supporting');
    expect(cardPriorityClass('optional')).toBe('atlas-edu-card--priority-optional');
    expect(cardPriorityClass('deferred')).toBe('atlas-edu-card--priority-deferred');
  });
});

// ─── cardPriorityAriaLabel ────────────────────────────────────────────────────

describe('cardPriorityAriaLabel', () => {
  it('primary returns plain title without suffix', () => {
    expect(cardPriorityAriaLabel('My card', 'primary')).toBe('My card');
  });

  it('optional cards are visually downgraded — ARIA label reflects that', () => {
    const label = cardPriorityAriaLabel('My card', 'optional');
    expect(label).toContain('optional detail');
  });

  it('deferred cards are QR-only — ARIA label communicates that', () => {
    const label = cardPriorityAriaLabel('My card', 'deferred');
    expect(label).toContain('QR deep dive');
  });
});

// ─── CARD_PRIORITY_GROUPED ────────────────────────────────────────────────────

describe('CARD_PRIORITY_GROUPED', () => {
  it('only supporting cards are grouped', () => {
    expect(CARD_PRIORITY_GROUPED.primary).toBe(false);
    expect(CARD_PRIORITY_GROUPED.supporting).toBe(true);
    expect(CARD_PRIORITY_GROUPED.optional).toBe(false);
    expect(CARD_PRIORITY_GROUPED.deferred).toBe(false);
  });
});

// ─── CARD_EMPHASIS_DESCRIPTIONS ──────────────────────────────────────────────

describe('CARD_EMPHASIS_DESCRIPTIONS', () => {
  it('all four priority levels have non-empty descriptions', () => {
    for (const level of ['primary', 'supporting', 'optional', 'deferred'] as const) {
      expect(CARD_EMPHASIS_DESCRIPTIONS[level].length).toBeGreaterThan(10);
    }
  });

  it('deferred description mentions QR', () => {
    expect(CARD_EMPHASIS_DESCRIPTIONS.deferred.toLowerCase()).toContain('qr');
  });
});

// ─── typographyRhythmRules ────────────────────────────────────────────────────

describe('typographyRhythmRules', () => {
  it('enforces section intro character limit', () => {
    expect(typographyRhythmRules.maxSectionIntroCharacters).toBeGreaterThan(0);
  });

  it('hard sentence limit is greater than soft limit', () => {
    expect(typographyRhythmRules.sentenceLengthHardLimitCharacters).toBeGreaterThan(
      typographyRhythmRules.sentenceLengthSoftLimitCharacters,
    );
  });

  it('emphasis word fraction is between 0 and 1', () => {
    expect(typographyRhythmRules.maxEmphasisWordFraction).toBeGreaterThan(0);
    expect(typographyRhythmRules.maxEmphasisWordFraction).toBeLessThan(1);
  });
});

// ─── VisualNoiseAudit — pass ──────────────────────────────────────────────────

describe('runVisualNoiseAudit — passing pack', () => {
  it('returns passed=true for a clean pack with no violations', () => {
    const input: VisualNoiseAuditInputV1 = {
      sections: [
        makeSectionSummary('calm_summary', { primaryCount: 1, supportingCount: 1, diagramCount: 1, calloutCount: 1 }),
        makeSectionSummary('why_this_fits', { primaryCount: 1, supportingCount: 2, diagramCount: 0, calloutCount: 0 }),
      ],
    };
    const report = runVisualNoiseAudit(input);
    expect(report.passed).toBe(true);
    expect(report.flags.filter((f) => f.severity === 'error')).toHaveLength(0);
  });

  it('returns summary containing "passed" when no flags', () => {
    const report = runVisualNoiseAudit({ sections: [] });
    expect(report.summary.toLowerCase()).toContain('passed');
  });
});

// ─── VisualNoiseAudit — only one primary card per section ─────────────────────

describe('runVisualNoiseAudit — primary card constraint', () => {
  it('raises an error when a section has more than one primary card', () => {
    const input: VisualNoiseAuditInputV1 = {
      sections: [
        makeSectionSummary('calm_summary', { primaryCount: 2, supportingCount: 0 }),
      ],
    };
    const report = runVisualNoiseAudit(input);
    expect(report.passed).toBe(false);
    const flag = report.flags.find((f) => f.kind === 'too_many_primary');
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('error');
    expect(flag?.sectionId).toBe('calm_summary');
  });

  it('does not flag sections with exactly one primary card', () => {
    const input: VisualNoiseAuditInputV1 = {
      sections: [
        makeSectionSummary('calm_summary', { primaryCount: 1 }),
      ],
    };
    const report = runVisualNoiseAudit(input);
    const flag = report.flags.find((f) => f.kind === 'too_many_primary');
    expect(flag).toBeUndefined();
  });
});

// ─── VisualNoiseAudit — optional cards visually downgraded ───────────────────

describe('runVisualNoiseAudit — optional card softening', () => {
  it('raises a warning when optional cards are not visually softened', () => {
    const input: VisualNoiseAuditInputV1 = {
      sections: [makeSectionSummary('why_this_fits', { primaryCount: 1 })],
      hasUnsoftenedOptionalCards: true,
    };
    const report = runVisualNoiseAudit(input);
    const flag = report.flags.find((f) => f.kind === 'optional_card_not_softened');
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('warning');
  });

  it('does not flag when optional cards are properly softened', () => {
    const input: VisualNoiseAuditInputV1 = {
      sections: [makeSectionSummary('why_this_fits', { primaryCount: 1 })],
      hasUnsoftenedOptionalCards: false,
    };
    const report = runVisualNoiseAudit(input);
    const flag = report.flags.find((f) => f.kind === 'optional_card_not_softened');
    expect(flag).toBeUndefined();
  });
});

// ─── VisualNoiseAudit — diagram density ──────────────────────────────────────

describe('runVisualNoiseAudit — diagram density', () => {
  it('raises a warning when a section has more diagrams than allowed', () => {
    const input: VisualNoiseAuditInputV1 = {
      sections: [
        makeSectionSummary('relevant_explainers', {
          primaryCount: 1,
          diagramCount: MAX_DIAGRAMS_PER_SECTION + 1,
        }),
      ],
    };
    const report = runVisualNoiseAudit(input);
    const flag = report.flags.find((f) => f.kind === 'too_many_diagrams_in_section');
    expect(flag).toBeDefined();
    expect(flag?.severity).toBe('warning');
  });

  it('raises a warning when the pack total exceeds MAX_DIAGRAMS_TOTAL', () => {
    const sections = Array.from({ length: MAX_DIAGRAMS_TOTAL + 1 }, (_, i) =>
      makeSectionSummary(`section_${i}`, { primaryCount: 1, diagramCount: 1 }),
    );
    const report = runVisualNoiseAudit({ sections });
    const flag = report.flags.find((f) => f.kind === 'too_many_diagrams_total');
    expect(flag).toBeDefined();
  });

  it('does not flag when diagrams are within limits', () => {
    const input: VisualNoiseAuditInputV1 = {
      sections: [
        makeSectionSummary('relevant_explainers', { primaryCount: 1, diagramCount: 1 }),
      ],
    };
    const report = runVisualNoiseAudit(input);
    const flag = report.flags.find((f) => f.kind === 'too_many_diagrams_in_section');
    expect(flag).toBeUndefined();
  });
});

// ─── VisualNoiseAudit — whitespace after heavy content ───────────────────────

describe('runVisualNoiseAudit — dense section stacking', () => {
  it('flags excessive stacking of dense sections', () => {
    // Four consecutive sections each with 2+ cards (no rest break)
    const sections = [
      makeSectionSummary('s1', { primaryCount: 1, supportingCount: 2 }),
      makeSectionSummary('s2', { primaryCount: 1, supportingCount: 2 }),
      makeSectionSummary('s3', { primaryCount: 1, supportingCount: 2 }),
      makeSectionSummary('s4', { primaryCount: 1, supportingCount: 2 }),
    ];
    const report = runVisualNoiseAudit({ sections });
    const flag = report.flags.find((f) => f.kind === 'dense_section_stacking');
    expect(flag).toBeDefined();
  });

  it('does not flag stacking when a single-card rest section intervenes', () => {
    const sections = [
      makeSectionSummary('s1', { primaryCount: 1, supportingCount: 2 }),
      makeSectionSummary('s2', { primaryCount: 1, supportingCount: 2 }),
      makeSectionSummary('rest', { primaryCount: 1 }), // only 1 card → resets counter
      makeSectionSummary('s3', { primaryCount: 1, supportingCount: 2 }),
    ];
    const report = runVisualNoiseAudit({ sections });
    // No dense_section_stacking flag should appear
    const stackFlags = report.flags.filter((f) => f.kind === 'dense_section_stacking');
    expect(stackFlags).toHaveLength(0);
  });
});

// ─── VisualNoiseAudit — deferred content not dominant ────────────────────────

describe('runVisualNoiseAudit — deferred content dominance', () => {
  it('raises an error when deferred cards are rendered inline', () => {
    const input: VisualNoiseAuditInputV1 = {
      sections: [makeSectionSummary('calm_summary', { primaryCount: 1 })],
      hasDominantDeferredCards: true,
    };
    const report = runVisualNoiseAudit(input);
    expect(report.passed).toBe(false);
    const flag = report.flags.find((f) => f.kind === 'deferred_card_dominant');
    expect(flag?.severity).toBe('error');
  });
});

// ─── VisualNoiseAudit — callout density ──────────────────────────────────────

describe('runVisualNoiseAudit — callout density', () => {
  it('flags a section with too many callouts', () => {
    const input: VisualNoiseAuditInputV1 = {
      sections: [
        makeSectionSummary('why_this_fits', {
          primaryCount: 1,
          calloutCount: MAX_CALLOUTS_PER_SECTION + 1,
        }),
      ],
    };
    const report = runVisualNoiseAudit(input);
    const flag = report.flags.find((f) => f.kind === 'too_many_callouts');
    expect(flag).toBeDefined();
  });
});

// ─── VisualNoiseAudit — QR / deferred content not dominant ───────────────────

describe('runVisualNoiseAudit — flag ordering', () => {
  it('returns error-severity flags before warning-severity flags', () => {
    const input: VisualNoiseAuditInputV1 = {
      sections: [
        makeSectionSummary('s1', {
          primaryCount: 2, // error
          calloutCount: MAX_CALLOUTS_PER_SECTION + 1, // warning
        }),
      ],
    };
    const report = runVisualNoiseAudit(input);
    expect(report.flags.length).toBeGreaterThan(1);
    const firstNonError = report.flags.findIndex((f) => f.severity !== 'error');
    const lastError = report.flags.map((f) => f.severity).lastIndexOf('error');
    // All errors should come before all warnings
    expect(lastError < firstNonError || firstNonError === -1).toBe(true);
  });
});
