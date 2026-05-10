# Welcome Pack Validation

## Purpose

The welcome-pack validation layer stress-tests the calm welcome-pack pipeline using realistic Atlas customer journeys. It identifies content gaps, routing gaps, accessibility risks, and trust risks **without changing any recommendation logic**.

This is the proving ground for answering:

- Did the customer actually understand?
- Did the pack stay calm?
- Did the explanation feel trustworthy?
- Was the QR depth sensible?
- Was the print pack too large?
- What concepts are repeatedly missing?
- What misconceptions are still unhandled?

---

## Files

| File | Purpose |
|---|---|
| `src/library/dev/validationFixtures/WelcomePackValidationFixtureV1.ts` | Fixture contract type |
| `src/library/dev/validationFixtures/welcomePackValidationFixtures.ts` | 12 realistic customer journey fixtures |
| `src/library/dev/runWelcomePackValidation.ts` | Validation runner and gap-detection helpers |
| `src/library/dev/WelcomePackValidationReportV1.ts` | Report output type |

---

## Validation Fixtures

Twelve realistic customer journeys, each with:

- Realistic customer concerns
- Emotional and trust concerns
- Accessibility notes
- Property constraints
- Customer language samples
- Known misconceptions

### Fixture IDs

| ID | Scenario |
|---|---|
| `oversized_combi_replacement` | Customer with oversized combi — kW-as-quality myth |
| `low_pressure_family_home` | Family with low mains pressure needing stored hot water |
| `elderly_gravity_replacement` | Elderly homeowner replacing a 30-year gravity/open-vent system |
| `skeptical_heat_pump_customer` | Sceptical customer who has read negative heat pump articles |
| `disruption_worried_customer` | Customer who cannot tolerate more than one day of disruption |
| `landlord_basic_compliance` | Landlord wanting minimum viable compliant replacement |
| `tech_enthusiast_smart_tariff` | Customer with PV, battery, and smart tariff wanting integration |
| `dyslexia_adhd_accessibility` | Customer with dyslexia and ADHD — cognitive-load constraints |
| `visually_impaired_print_first` | Visually impaired customer — print-first, large format |
| `hot_radiators_misconception` | Customer expecting hot radiators from a heat pump |
| `more_powerful_boiler_customer` | Customer insisting on a larger kW boiler |
| `multiple_quotes_comparison` | Customer with conflicting installer quotes — trust via physics |

---

## Validation Runner

```ts
import { runWelcomePackValidation, detectRepeatedOmissionPatterns, collectTopMissingConcepts } from 'src/library/dev/runWelcomePackValidation';

// Run all 12 fixtures
const reports = runWelcomePackValidation('warn');

// Surface repeated omissions
const repeated = detectRepeatedOmissionPatterns(reports, 3);

// Surface top missing concepts
const missing = collectTopMissingConcepts(reports);
```

### Per-fixture

```ts
import { runFixtureValidation, getValidationFixture } from 'src/library/dev/runWelcomePackValidation';

const fixture = getValidationFixture('skeptical_heat_pump_customer');
const report = runFixtureValidation(fixture, 'warn');
```

---

## Validation Report (`WelcomePackValidationReportV1`)

Each report includes:

| Field | Description |
|---|---|
| `fixtureId` | Fixture identifier |
| `archetypeId` | Archetype resolved from the plan |
| `readiness` | `ready` / `partial` / `blocked` |
| `selectedAssetIds` | Assets selected by the plan |
| `selectedConceptIds` | Concepts covered |
| `omittedAssets` | Assets not selected with reasons |
| `blockedAssets` | Assets blocked by the eligibility gate |
| `qrDeferredConceptIds` | Concepts deferred to QR or appendix |
| `pageCount` / `printPageBudget` | Pages used vs budget |
| `missingContent` | Concepts selected but lacking registered content |
| `missingPrintEquivalents` | Assets with no registered print equivalent |
| `missingAnalogies` | Customer misconceptions not covered by analogy content |
| `readabilityConcerns` | Accessibility mismatches (e.g. dyslexia profile but high-load assets) |
| `trustRisks` | Emotional/trust concerns not covered by content |
| `accessibilityRisks` | Accessibility notes not satisfied by the plan |
| `printRisks` | Print-first fixture with assets lacking print equivalents |
| `cognitiveOverloadWarnings` | High-load assets selected for low-budget audiences |
| `likelyCustomerConfusionPoints` | Derived likely confusion points |
| `recommendedNextContentAdditions` | Recommended content to add |

---

## Dev Preview

The welcome-pack dev preview at `/dev/welcome-pack` includes a **"Run validation audit"** toggle that:

1. Runs all 12 fixtures through the pipeline
2. Shows a fixture comparison table
3. Shows a missing-content dashboard
4. Highlights top missing concepts
5. Highlights repeated omission patterns
6. Shows per-fixture gap details in expandable sections

---

## Rules

- Validation fixtures **must not change recommendation logic**.
- The runner is **read-only diagnostic** — it never mutates any registry, routing rule, or plan.
- Fixtures are for **dev and test contexts only** — never shipped in production routes.
- Fixtures may include realistic emotional, trust, and accessibility concerns to pressure-test content coverage.

---

## Non-goals

- No new architecture framework.
- No production routes.
- No PDF generation.
- No score ranking or weighted comparison — gaps are binary (present or absent).

---

## Adding New Fixtures

1. Add a new ID to `WelcomePackValidationFixtureId` in `WelcomePackValidationFixtureV1.ts`.
2. Create the fixture object in `welcomePackValidationFixtures.ts` following the existing pattern.
3. Add it to the `welcomePackValidationFixtures` record and `welcomePackValidationFixtureList`.
4. Update tests in `runWelcomePackValidation.test.ts`.
