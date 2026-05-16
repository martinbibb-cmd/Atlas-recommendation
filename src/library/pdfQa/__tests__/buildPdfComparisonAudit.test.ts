import { describe, expect, it } from 'vitest';
import { buildPdfComparisonAudit } from '../buildPdfComparisonAudit';
import type { PdfComparisonScenarioV1, PdfSectionSnapshotV1 } from '../PdfComparisonScenarioV1';

// ─── Fixture helpers ──────────────────────────────────────────────────────────

function makeSection(
  sectionId: string,
  heading: string,
  bodyText: string,
): PdfSectionSnapshotV1 {
  return { sectionId, heading, bodyText };
}

/** A minimal clean canonical scenario — should pass all checks. */
function makeCleanCanonicalScenario(
  overrides?: Partial<PdfComparisonScenarioV1>,
): PdfComparisonScenarioV1 {
  return {
    scenarioLabel: 'Clean canonical — 3-bed semi',
    mode: 'canonical_library_pdf',
    recommendationSummary: 'A sealed system with an unvented cylinder is the best fit for this home.',
    sections: [
      makeSection('cover', 'Your new heating system', 'Your installer has recommended an unvented cylinder setup.'),
      makeSection('what_changes', 'What changes in your home', 'What changes: a sealed heating circuit replaces the open-vented system. What you may notice: a pressure gauge near the boiler.'),
      makeSection('what_stays_familiar', 'What stays familiar', 'What stays familiar: the radiators remain in place and work the same way.'),
      makeSection('system_protection', 'Protecting the existing heating system', 'Standard protection and commissioning checks are carried out as part of every installation.'),
      makeSection('living_with', 'Living with your new system', 'What you may notice: the system is quieter than before.'),
    ],
    surveyCondition: 'present',
    ...overrides,
  };
}

/** A scenario with forbidden terms injected. */
function makeForbiddenTermScenario(): PdfComparisonScenarioV1 {
  return {
    scenarioLabel: 'Forbidden terms scenario',
    mode: 'canonical_library_pdf',
    recommendationSummary: 'Sealed system recommended.',
    sections: [
      makeSection('cover', 'Your new heating system', 'BS7593 compliance is required before commissioning.'),
      makeSection('water_treatment', 'Water treatment', 'Inhibitor dosing and magnetite levels must be checked. Dose to 200 ppm.'),
      makeSection('flush', 'System preparation', 'A chemical flush will be required before the new boiler is installed.'),
    ],
    surveyCondition: 'present',
  };
}

/** A scenario with a guessed capacity range. */
function makeGuessedCapacityScenario(): PdfComparisonScenarioV1 {
  return {
    scenarioLabel: 'Guessed capacity scenario',
    mode: 'canonical_library_pdf',
    recommendationSummary: 'Unvented cylinder recommended.',
    sections: [
      makeSection('cover', 'Your new heating system', 'An unvented cylinder of approximately 100–150 L is recommended for your home.'),
      makeSection('detail', 'Storage detail', 'Tank sizes typically range from 110–140 litres for a home this size.'),
    ],
    surveyCondition: null,
  };
}

/** A scenario with a legacy report heading. */
function makeLegacyHeadingScenario(): PdfComparisonScenarioV1 {
  return {
    scenarioLabel: 'Legacy heading scenario',
    mode: 'legacy_framework_print',
    recommendationSummary: 'Sealed system recommended.',
    sections: [
      makeSection('main', 'Heating System Recommendation', 'We recommend a sealed system.'),
      makeSection('pack', 'Insight Pack', 'See your insight pack for full details.'),
      makeSection('spec', 'Technical Specification', 'Ref: ATLAS-2024-001.'),
    ],
    surveyCondition: null,
  };
}

/** A scenario with "system unchanged" without context. */
function makeMisleadingPhraseScenario(): PdfComparisonScenarioV1 {
  return {
    scenarioLabel: 'Misleading phrase scenario',
    mode: 'legacy_framework_print',
    recommendationSummary: 'Boiler swap recommended.',
    sections: [
      makeSection('cover', 'Your new boiler', 'The existing system untouched. The system unchanged during the upgrade.'),
    ],
    surveyCondition: null,
  };
}

/** A scenario with "system unchanged" WITH protection context — should not warn. */
function makeMisleadingPhraseWithContextScenario(): PdfComparisonScenarioV1 {
  return {
    scenarioLabel: 'Misleading phrase with context scenario',
    mode: 'canonical_library_pdf',
    recommendationSummary: 'Boiler swap recommended.',
    sections: [
      makeSection(
        'cover',
        'Your new boiler',
        'The existing system unchanged in most respects. Your installer will confirm the preparation and protection method before work begins.',
      ),
    ],
    surveyCondition: null,
  };
}

/** A scenario with no survey condition. */
function makeNoSurveyScenario(): PdfComparisonScenarioV1 {
  return {
    scenarioLabel: 'No survey scenario',
    mode: 'canonical_library_pdf',
    recommendationSummary: 'Sealed system recommended.',
    sections: [
      makeSection('cover', 'Your new heating system', 'What you may notice: a pressure gauge near the boiler.'),
      makeSection('what_changes', 'What changes', 'What stays familiar: the radiators remain.'),
    ],
    surveyCondition: null,
  };
}

/** A twin-tank surveyed scenario with a volume reference. */
function makeTwinTankSurveyedScenario(): PdfComparisonScenarioV1 {
  return {
    scenarioLabel: 'Twin tank surveyed scenario',
    mode: 'canonical_library_pdf',
    recommendationSummary: 'Twin-tank system retained.',
    sections: [
      makeSection('cover', 'Your heating system', 'Your surveyed 100–150 L cold water tank will be retained.'),
    ],
    surveyCondition: 'present',
    isTwinTankSurveyed: true,
  };
}

// ─── Guessed capacity detection ───────────────────────────────────────────────

describe('buildPdfComparisonAudit — guessed capacity detection', () => {
  it('detects "100–150 L" as a guessed capacity finding', () => {
    const result = buildPdfComparisonAudit(makeGuessedCapacityScenario());
    expect(result.guessedCapacityFindings.length).toBeGreaterThanOrEqual(1);
    expect(result.guessedCapacityFindings[0].ruleId).toBe('guessed_capacity');
    expect(result.guessedCapacityFindings[0].severity).toBe('fail');
  });

  it('detects "110–140 litres" as a guessed capacity finding', () => {
    const result = buildPdfComparisonAudit(makeGuessedCapacityScenario());
    const excerpts = result.guessedCapacityFindings.map((f) => f.excerpt.toLowerCase());
    expect(excerpts.some((e) => e.includes('110'))).toBe(true);
  });

  it('produces no guessed capacity findings for a clean scenario', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    expect(result.guessedCapacityFindings).toHaveLength(0);
  });

  it('no_guessed_cws_volumes positive check passes for twin-tank surveyed', () => {
    const result = buildPdfComparisonAudit(makeTwinTankSurveyedScenario());
    const check = result.positiveChecks.find((c) => c.checkId === 'no_guessed_cws_volumes');
    expect(check?.passed).toBe(true);
  });

  it('no_guessed_cws_volumes positive check fails when guessed capacity and not twin-tank surveyed', () => {
    const result = buildPdfComparisonAudit(makeGuessedCapacityScenario());
    const check = result.positiveChecks.find((c) => c.checkId === 'no_guessed_cws_volumes');
    expect(check?.passed).toBe(false);
  });
});

// ─── Forbidden terminology detection ─────────────────────────────────────────

describe('buildPdfComparisonAudit — forbidden terminology detection', () => {
  it('detects BS7593 as a forbidden term', () => {
    const result = buildPdfComparisonAudit(makeForbiddenTermScenario());
    const ids = result.forbiddenTermFindings.map((f) => f.ruleId);
    expect(ids).toContain('forbidden_bs7593');
  });

  it('detects inhibitor dosing as a forbidden term', () => {
    const result = buildPdfComparisonAudit(makeForbiddenTermScenario());
    const ids = result.forbiddenTermFindings.map((f) => f.ruleId);
    expect(ids).toContain('forbidden_inhibitor_dosing');
  });

  it('detects ppm as a forbidden term', () => {
    const result = buildPdfComparisonAudit(makeForbiddenTermScenario());
    const ids = result.forbiddenTermFindings.map((f) => f.ruleId);
    expect(ids).toContain('forbidden_ppm');
  });

  it('detects magnetite as a forbidden term', () => {
    const result = buildPdfComparisonAudit(makeForbiddenTermScenario());
    const ids = result.forbiddenTermFindings.map((f) => f.ruleId);
    expect(ids).toContain('forbidden_magnetite');
  });

  it('detects chemical flush as a forbidden term', () => {
    const result = buildPdfComparisonAudit(makeForbiddenTermScenario());
    const ids = result.forbiddenTermFindings.map((f) => f.ruleId);
    expect(ids).toContain('forbidden_chemical_flush');
  });

  it('produces no forbidden term findings for a clean canonical scenario', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    expect(result.forbiddenTermFindings).toHaveLength(0);
  });

  it('customer_safe_wording positive check fails when forbidden terms present', () => {
    const result = buildPdfComparisonAudit(makeForbiddenTermScenario());
    const check = result.positiveChecks.find((c) => c.checkId === 'customer_safe_wording');
    expect(check?.passed).toBe(false);
  });

  it('customer_safe_wording positive check passes for a clean scenario', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    const check = result.positiveChecks.find((c) => c.checkId === 'customer_safe_wording');
    expect(check?.passed).toBe(true);
  });
});

// ─── Missing protection section detection ────────────────────────────────────

describe('buildPdfComparisonAudit — missing protection section', () => {
  it('system_protection_present positive check fails when surveyCondition=present but no protection section', () => {
    const scenario: PdfComparisonScenarioV1 = {
      scenarioLabel: 'Missing protection section',
      mode: 'canonical_library_pdf',
      recommendationSummary: 'Sealed system recommended.',
      sections: [
        makeSection('cover', 'Your new heating system', 'Overview.'),
        makeSection('what_changes', 'What changes', 'What you may notice: the boiler is quieter.'),
      ],
      surveyCondition: 'present',
    };
    const result = buildPdfComparisonAudit(scenario);
    const check = result.positiveChecks.find((c) => c.checkId === 'system_protection_present');
    expect(check?.passed).toBe(false);
  });

  it('system_protection_present positive check passes when protection section is present', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    const check = result.positiveChecks.find((c) => c.checkId === 'system_protection_present');
    expect(check?.passed).toBe(true);
  });
});

// ─── Clean customer-safe canonical pass ──────────────────────────────────────

describe('buildPdfComparisonAudit — clean canonical pass', () => {
  it('returns overallStatus=pass for a clean canonical scenario', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    expect(result.overallStatus).toBe('pass');
  });

  it('returns failCount=0 and warnCount=0 for a clean canonical scenario', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    expect(result.failCount).toBe(0);
    expect(result.warnCount).toBe(0);
  });

  it('all positive checks pass for a clean canonical scenario', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    const failed = result.positiveChecks.filter((c) => !c.passed);
    expect(failed).toHaveLength(0);
  });

  it('lived_experience_present positive check passes when what-you-may-notice is present', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    const check = result.positiveChecks.find((c) => c.checkId === 'lived_experience_present');
    expect(check?.passed).toBe(true);
  });

  it('expectation_delta_present positive check passes when what-changes and what-stays phrases present', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    const check = result.positiveChecks.find((c) => c.checkId === 'expectation_delta_present');
    expect(check?.passed).toBe(true);
  });
});

// ─── Legacy report fail detection ────────────────────────────────────────────

describe('buildPdfComparisonAudit — legacy report fail detection', () => {
  it('detects "Heating System Recommendation" as a legacy heading', () => {
    const result = buildPdfComparisonAudit(makeLegacyHeadingScenario());
    const ids = result.legacyHeadingFindings.map((f) => f.ruleId);
    expect(ids).toContain('legacy_heading_system_recommendation');
  });

  it('detects "Insight Pack" as a legacy heading', () => {
    const result = buildPdfComparisonAudit(makeLegacyHeadingScenario());
    const ids = result.legacyHeadingFindings.map((f) => f.ruleId);
    expect(ids).toContain('legacy_heading_insight_pack');
  });

  it('detects "Technical Specification" as a legacy heading', () => {
    const result = buildPdfComparisonAudit(makeLegacyHeadingScenario());
    const ids = result.legacyHeadingFindings.map((f) => f.ruleId);
    expect(ids).toContain('legacy_heading_technical_spec');
  });

  it('overallStatus is fail when legacy headings detected', () => {
    const result = buildPdfComparisonAudit(makeLegacyHeadingScenario());
    expect(result.overallStatus).toBe('fail');
  });

  it('projection_safety_pass positive check fails when legacy headings detected', () => {
    const result = buildPdfComparisonAudit(makeLegacyHeadingScenario());
    const check = result.positiveChecks.find((c) => c.checkId === 'projection_safety_pass');
    expect(check?.passed).toBe(false);
  });

  it('produces no legacy heading findings for a clean canonical scenario', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    expect(result.legacyHeadingFindings).toHaveLength(0);
  });
});

// ─── No-survey graceful handling ─────────────────────────────────────────────

describe('buildPdfComparisonAudit — no-survey graceful handling', () => {
  it('system_protection_present passes gracefully when surveyCondition is null', () => {
    const result = buildPdfComparisonAudit(makeNoSurveyScenario());
    const check = result.positiveChecks.find((c) => c.checkId === 'system_protection_present');
    expect(check?.passed).toBe(true);
  });

  it('does not fail overall for no-survey scenario with clean wording', () => {
    const result = buildPdfComparisonAudit(makeNoSurveyScenario());
    expect(result.overallStatus).toBe('pass');
  });
});

// ─── Twin tank surveyed handling ──────────────────────────────────────────────

describe('buildPdfComparisonAudit — twin tank surveyed handling', () => {
  it('allows guessed capacity range when isTwinTankSurveyed is true', () => {
    const result = buildPdfComparisonAudit(makeTwinTankSurveyedScenario());
    const check = result.positiveChecks.find((c) => c.checkId === 'no_guessed_cws_volumes');
    expect(check?.passed).toBe(true);
  });
});

// ─── Projection-safe pass state ───────────────────────────────────────────────

describe('buildPdfComparisonAudit — projection-safe pass state', () => {
  it('projection_safety_pass passes for a clean canonical scenario', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    const check = result.positiveChecks.find((c) => c.checkId === 'projection_safety_pass');
    expect(check?.passed).toBe(true);
  });

  it('projection_safety_pass fails when both forbidden terms and legacy headings are present', () => {
    const result = buildPdfComparisonAudit(makeForbiddenTermScenario());
    const check = result.positiveChecks.find((c) => c.checkId === 'projection_safety_pass');
    expect(check?.passed).toBe(false);
  });
});

// ─── Misleading phrasing detection ───────────────────────────────────────────

describe('buildPdfComparisonAudit — misleading phrasing detection', () => {
  it('warns when "existing system untouched" appears without protection context', () => {
    const result = buildPdfComparisonAudit(makeMisleadingPhraseScenario());
    expect(result.misleadingPhrasingFindings.length).toBeGreaterThanOrEqual(1);
    expect(result.misleadingPhrasingFindings[0].severity).toBe('warn');
  });

  it('does not warn when "system unchanged" appears with protection context', () => {
    const result = buildPdfComparisonAudit(makeMisleadingPhraseWithContextScenario());
    expect(result.misleadingPhrasingFindings).toHaveLength(0);
  });
});

// ─── Schema and metadata ──────────────────────────────────────────────────────

describe('buildPdfComparisonAudit — schema and metadata', () => {
  it('returns schemaVersion 1.0', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    expect(result.schemaVersion).toBe('1.0');
  });

  it('returns a valid ISO generatedAt timestamp', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    expect(() => new Date(result.generatedAt)).not.toThrow();
  });

  it('copies scenarioLabel and mode from the input scenario', () => {
    const scenario = makeCleanCanonicalScenario();
    const result = buildPdfComparisonAudit(scenario);
    expect(result.scenarioLabel).toBe(scenario.scenarioLabel);
    expect(result.mode).toBe(scenario.mode);
  });
});

// ─── Legacy diff ──────────────────────────────────────────────────────────────

describe('buildPdfComparisonAudit — legacy diff', () => {
  it('produces a legacyDiffSummary when a canonical scenario is supplied', () => {
    const legacyScenario = makeLegacyHeadingScenario();
    const canonicalScenario = makeCleanCanonicalScenario();
    const result = buildPdfComparisonAudit(legacyScenario, canonicalScenario);
    expect(result.legacyDiffSummary).toBeDefined();
  });

  it('recommendationSummaryMatch is false when summaries differ', () => {
    const legacyScenario: PdfComparisonScenarioV1 = {
      ...makeLegacyHeadingScenario(),
      recommendationSummary: 'Old summary.',
    };
    const canonicalScenario = makeCleanCanonicalScenario();
    const result = buildPdfComparisonAudit(legacyScenario, canonicalScenario);
    expect(result.legacyDiffSummary?.recommendationSummaryMatch).toBe(false);
  });

  it('recommendationSummaryMatch is true when summaries match', () => {
    const sharedSummary = 'Sealed system recommended.';
    const legacyScenario: PdfComparisonScenarioV1 = {
      ...makeLegacyHeadingScenario(),
      recommendationSummary: sharedSummary,
    };
    const canonicalScenario = makeCleanCanonicalScenario({
      recommendationSummary: sharedSummary,
    });
    const result = buildPdfComparisonAudit(legacyScenario, canonicalScenario);
    expect(result.legacyDiffSummary?.recommendationSummaryMatch).toBe(true);
  });

  it('sectionsOnlyInCanonical contains sections not in legacy', () => {
    const legacyScenario = makeLegacyHeadingScenario();
    const canonicalScenario = makeCleanCanonicalScenario();
    const result = buildPdfComparisonAudit(legacyScenario, canonicalScenario);
    // canonical has cover, what_changes, what_stays_familiar, system_protection, living_with
    // legacy has main, pack, spec
    expect(result.legacyDiffSummary?.sectionsOnlyInCanonical).toContain('cover');
  });

  it('legacyDiffSummary is undefined when no canonical scenario supplied', () => {
    const result = buildPdfComparisonAudit(makeCleanCanonicalScenario());
    expect(result.legacyDiffSummary).toBeUndefined();
  });
});
