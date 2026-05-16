/**
 * buildPdfComparisonAudit
 *
 * Core QA logic for the library PDF comparison harness.
 *
 * Inputs
 * ──────
 *   scenario        — the PDF text snapshot to audit
 *   canonicalScenario — optional canonical scenario used to generate a
 *                       legacy-vs-canonical diff (only relevant when
 *                       scenario.mode is a legacy mode)
 *
 * Detection checks
 * ────────────────
 *   1. Guessed tank capacity ranges ("100–150 L", "110–140 L", etc.)
 *   2. Forbidden technical terminology:
 *        BS7593 · inhibitor dosing · ppm · magnetite · chemical flush
 *   3. Legacy report headings:
 *        "Heating System Recommendation" · "Insight Pack" · "Blueprint" ·
 *        "Technical Specification"
 *   4. Misleading "system unchanged" / "existing system untouched" phrasing
 *      without protection/preparation context in the same section
 *
 * Positive verification checks
 * ────────────────────────────
 *   ✓ system_protection_present  — when surveyCondition = 'present'
 *   ✓ customer_safe_wording       — no forbidden terms anywhere
 *   ✓ lived_experience_present    — "what you may notice" phrase present
 *   ✓ expectation_delta_present   — "what changes" + "what stays" phrases present
 *   ✓ projection_safety_pass      — no legacy headings and no forbidden terms
 *   ✓ no_guessed_cws_volumes      — no guessed volume unless isTwinTankSurveyed
 */

import type { PdfComparisonScenarioV1 } from './PdfComparisonScenarioV1';
import type {
  PdfComparisonAuditV1,
  PdfAuditFindingV1,
  PdfAuditSeverityV1,
  PdfLegacyDiffSummaryV1,
  PdfPositiveCheckV1,
} from './PdfComparisonAuditV1';

// ─── Forbidden term rules ─────────────────────────────────────────────────────

interface ForbiddenTermRule {
  readonly ruleId: string;
  /** Lowercase search token. */
  readonly token: string;
  /** Human-readable label for findings. */
  readonly label: string;
}

const FORBIDDEN_TERM_RULES: readonly ForbiddenTermRule[] = [
  { ruleId: 'forbidden_bs7593',          token: 'bs7593',          label: 'BS7593'          },
  { ruleId: 'forbidden_bs_7593',         token: 'bs 7593',         label: 'BS 7593'         },
  { ruleId: 'forbidden_inhibitor_dosing',token: 'inhibitor dosing', label: 'inhibitor dosing'},
  { ruleId: 'forbidden_inhibitor',       token: 'inhibitor',       label: 'inhibitor'       },
  { ruleId: 'forbidden_ppm',             token: 'ppm',             label: 'ppm'             },
  { ruleId: 'forbidden_magnetite',       token: 'magnetite',       label: 'magnetite'       },
  { ruleId: 'forbidden_chemical_flush',  token: 'chemical flush',  label: 'chemical flush'  },
];

// ─── Legacy heading rules ─────────────────────────────────────────────────────

interface LegacyHeadingRule {
  readonly ruleId: string;
  readonly token: string;
  readonly label: string;
}

const LEGACY_HEADING_RULES: readonly LegacyHeadingRule[] = [
  { ruleId: 'legacy_heading_system_recommendation', token: 'heating system recommendation', label: 'Heating System Recommendation' },
  { ruleId: 'legacy_heading_insight_pack',          token: 'insight pack',                  label: 'Insight Pack'                },
  { ruleId: 'legacy_heading_blueprint',             token: 'blueprint',                     label: 'Blueprint'                   },
  { ruleId: 'legacy_heading_technical_spec',        token: 'technical specification',        label: 'Technical Specification'     },
];

// ─── Guessed capacity pattern ─────────────────────────────────────────────────

/**
 * Detects guessed tank capacity ranges such as "100–150 L", "110–140 L",
 * "120 to 170 litres", etc.
 * Matches:  <number> [–/-/to] <number> [L/litres/ltr] (case-insensitive)
 */
const GUESSED_CAPACITY_PATTERN = /\b(\d{2,3})\s*(?:–|-|to)\s*(\d{2,3})\s*(?:L|l|litres?|ltr)\b/gi;

// ─── Misleading phrasing ──────────────────────────────────────────────────────

const MISLEADING_PHRASING_TOKENS = [
  'system unchanged',
  'existing system untouched',
] as const;

/** Terms that, when present in the same section body, redeem a misleading phrase. */
const PROTECTION_CONTEXT_TOKENS = [
  'protection',
  'preparation',
  'installer will',
  'installer confirm',
  'clean and protect',
  'system clean',
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sectionHaystack(section: { heading: string; bodyText: string }): string {
  return `${section.heading} ${section.bodyText}`.toLowerCase();
}

function allText(scenario: PdfComparisonScenarioV1): string {
  return scenario.sections.map(sectionHaystack).join(' ');
}

function makeFinding(
  overrides: Pick<PdfAuditFindingV1, 'ruleId' | 'description' | 'severity' | 'excerpt' | 'sectionId'>,
): PdfAuditFindingV1 {
  return overrides;
}

function makePositiveCheck(
  checkId: string,
  description: string,
  passed: boolean,
): PdfPositiveCheckV1 {
  return { checkId, description, passed };
}

// ─── Detection: guessed capacity ──────────────────────────────────────────────

function detectGuessedCapacity(
  scenario: PdfComparisonScenarioV1,
): PdfAuditFindingV1[] {
  const findings: PdfAuditFindingV1[] = [];

  for (const section of scenario.sections) {
    const haystack = sectionHaystack(section);
    let match: RegExpExecArray | null;

    // Reset lastIndex before use
    GUESSED_CAPACITY_PATTERN.lastIndex = 0;

    while ((match = GUESSED_CAPACITY_PATTERN.exec(haystack)) !== null) {
      findings.push(
        makeFinding({
          ruleId: 'guessed_capacity',
          description: `Guessed tank capacity range detected: "${match[0].trim()}"`,
          severity: 'fail',
          excerpt: match[0].trim(),
          sectionId: section.sectionId,
        }),
      );
    }
  }

  return findings;
}

// ─── Detection: forbidden terms ───────────────────────────────────────────────

function detectForbiddenTerms(
  scenario: PdfComparisonScenarioV1,
): PdfAuditFindingV1[] {
  const findings: PdfAuditFindingV1[] = [];

  for (const section of scenario.sections) {
    const haystack = sectionHaystack(section);
    for (const rule of FORBIDDEN_TERM_RULES) {
      if (haystack.includes(rule.token)) {
        findings.push(
          makeFinding({
            ruleId: rule.ruleId,
            description: `Forbidden technical term "${rule.label}" detected in section "${section.sectionId}"`,
            severity: 'fail',
            excerpt: rule.label,
            sectionId: section.sectionId,
          }),
        );
      }
    }
  }

  return findings;
}

// ─── Detection: legacy headings ───────────────────────────────────────────────

function detectLegacyHeadings(
  scenario: PdfComparisonScenarioV1,
): PdfAuditFindingV1[] {
  const findings: PdfAuditFindingV1[] = [];

  for (const section of scenario.sections) {
    const headingLower = section.heading.toLowerCase();
    for (const rule of LEGACY_HEADING_RULES) {
      if (headingLower.includes(rule.token)) {
        findings.push(
          makeFinding({
            ruleId: rule.ruleId,
            description: `Legacy report heading "${rule.label}" found in section "${section.sectionId}"`,
            severity: 'fail',
            excerpt: section.heading,
            sectionId: section.sectionId,
          }),
        );
      }
    }
  }

  return findings;
}

// ─── Detection: misleading phrasing ──────────────────────────────────────────

function detectMisleadingPhrasing(
  scenario: PdfComparisonScenarioV1,
): PdfAuditFindingV1[] {
  const findings: PdfAuditFindingV1[] = [];

  for (const section of scenario.sections) {
    const haystack = sectionHaystack(section);

    for (const phrase of MISLEADING_PHRASING_TOKENS) {
      if (!haystack.includes(phrase)) {
        continue;
      }

      // Check whether a protection/preparation qualifier is present in the same section
      const hasContext = PROTECTION_CONTEXT_TOKENS.some((ctx) => haystack.includes(ctx));

      if (!hasContext) {
        findings.push(
          makeFinding({
            ruleId: 'misleading_system_unchanged',
            description: `Misleading phrasing "${phrase}" used without protection/preparation context in section "${section.sectionId}"`,
            severity: 'warn',
            excerpt: phrase,
            sectionId: section.sectionId,
          }),
        );
      }
    }
  }

  return findings;
}

// ─── Positive checks ──────────────────────────────────────────────────────────

function buildPositiveChecks(
  scenario: PdfComparisonScenarioV1,
  forbiddenTermFindings: PdfAuditFindingV1[],
  legacyHeadingFindings: PdfAuditFindingV1[],
  guessedCapacityFindings: PdfAuditFindingV1[],
): PdfPositiveCheckV1[] {
  const full = allText(scenario);

  // ✓ system_protection_present
  const systemProtectionCheck: PdfPositiveCheckV1 = (() => {
    if (scenario.surveyCondition !== 'present') {
      return makePositiveCheck(
        'system_protection_present',
        'System protection section present (survey condition present)',
        true, // not required — graceful no-survey pass
      );
    }
    const present =
      full.includes('protecting the existing heating system') ||
      full.includes('system protection') ||
      full.includes('protection and commissioning') ||
      full.includes('circuit clean') ||
      full.includes('cleaning and protection');
    return makePositiveCheck(
      'system_protection_present',
      'System protection section present when survey condition exists',
      present,
    );
  })();

  // ✓ customer_safe_wording
  const customerSafeWordingCheck = makePositiveCheck(
    'customer_safe_wording',
    'Customer-safe wording used (no forbidden terms)',
    forbiddenTermFindings.length === 0,
  );

  // ✓ lived_experience_present
  const livedExperienceCheck = makePositiveCheck(
    'lived_experience_present',
    'Lived-experience "what you may notice" section present',
    full.includes('what you may notice'),
  );

  // ✓ expectation_delta_present
  const expectationDeltaCheck = makePositiveCheck(
    'expectation_delta_present',
    'Expectation delta content present (what changes + what stays)',
    full.includes('what changes') && (full.includes('what stays') || full.includes('stays familiar')),
  );

  // ✓ projection_safety_pass
  const projectionSafetyCheck = makePositiveCheck(
    'projection_safety_pass',
    'Projection safety passed (no legacy headings, no forbidden terms)',
    legacyHeadingFindings.length === 0 && forbiddenTermFindings.length === 0,
  );

  // ✓ no_guessed_cws_volumes
  const noGuessedCwsCheck = makePositiveCheck(
    'no_guessed_cws_volumes',
    'No guessed CWS/tank volumes (unless twin-tank surveyed)',
    scenario.isTwinTankSurveyed === true ? true : guessedCapacityFindings.length === 0,
  );

  return [
    systemProtectionCheck,
    customerSafeWordingCheck,
    livedExperienceCheck,
    expectationDeltaCheck,
    projectionSafetyCheck,
    noGuessedCwsCheck,
  ];
}

// ─── Legacy diff ──────────────────────────────────────────────────────────────

function buildLegacyDiff(
  scenario: PdfComparisonScenarioV1,
  canonicalScenario: PdfComparisonScenarioV1,
): PdfLegacyDiffSummaryV1 {
  const legacyIds = new Set(scenario.sections.map((s) => s.sectionId));
  const canonicalIds = new Set(canonicalScenario.sections.map((s) => s.sectionId));

  const sectionsOnlyInCanonical = [...canonicalIds].filter((id) => !legacyIds.has(id));
  const sectionsOnlyInLegacy = [...legacyIds].filter((id) => !canonicalIds.has(id));
  const commonSectionIds = [...canonicalIds].filter((id) => legacyIds.has(id));

  return {
    sectionsOnlyInCanonical,
    sectionsOnlyInLegacy,
    commonSectionIds,
    recommendationSummaryMatch:
      scenario.recommendationSummary.trim() === canonicalScenario.recommendationSummary.trim(),
  };
}

// ─── Overall status ───────────────────────────────────────────────────────────

function deriveOverallStatus(
  allFindings: PdfAuditFindingV1[],
): PdfAuditSeverityV1 {
  if (allFindings.some((f) => f.severity === 'fail')) return 'fail';
  if (allFindings.some((f) => f.severity === 'warn')) return 'warn';
  return 'pass';
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * buildPdfComparisonAudit
 *
 * Runs all detection and positive verification checks against the supplied
 * scenario and returns a PdfComparisonAuditV1 result.
 *
 * @param scenario         The PDF text snapshot to audit.
 * @param canonicalScenario Optional canonical snapshot for legacy diff.
 *                          Only used when scenario.mode is a legacy mode.
 */
export function buildPdfComparisonAudit(
  scenario: PdfComparisonScenarioV1,
  canonicalScenario?: PdfComparisonScenarioV1,
): PdfComparisonAuditV1 {
  // ── Detection ────────────────────────────────────────────────────────────────
  const guessedCapacityFindings = detectGuessedCapacity(scenario);
  const forbiddenTermFindings   = detectForbiddenTerms(scenario);
  const legacyHeadingFindings   = detectLegacyHeadings(scenario);
  const misleadingPhrasingFindings = detectMisleadingPhrasing(scenario);

  // ── Positive checks ───────────────────────────────────────────────────────
  const positiveChecks = buildPositiveChecks(
    scenario,
    forbiddenTermFindings,
    legacyHeadingFindings,
    guessedCapacityFindings,
  );

  // ── Legacy diff ───────────────────────────────────────────────────────────
  const legacyDiffSummary =
    canonicalScenario != null
      ? buildLegacyDiff(scenario, canonicalScenario)
      : undefined;

  // ── Roll-up counts ────────────────────────────────────────────────────────
  const allFindings: PdfAuditFindingV1[] = [
    ...guessedCapacityFindings,
    ...forbiddenTermFindings,
    ...legacyHeadingFindings,
    ...misleadingPhrasingFindings,
  ];

  const failCount = allFindings.filter((f) => f.severity === 'fail').length;
  const warnCount = allFindings.filter((f) => f.severity === 'warn').length;
  const positivePassCount = positiveChecks.filter((c) => c.passed).length;
  const positiveTotalCount = positiveChecks.length;

  return {
    schemaVersion: '1.0',
    generatedAt: new Date().toISOString(),
    scenarioLabel: scenario.scenarioLabel,
    mode: scenario.mode,
    overallStatus: deriveOverallStatus(allFindings),
    guessedCapacityFindings,
    forbiddenTermFindings,
    legacyHeadingFindings,
    misleadingPhrasingFindings,
    positiveChecks,
    legacyDiffSummary,
    failCount,
    warnCount,
    positivePassCount,
    positiveTotalCount,
  };
}
