# Welcome Pack Dev Preview

## Purpose

The dev preview is a safe development-only surface for inspecting the composed Atlas welcome pack output.

It exercises the library pipeline end-to-end:

1. `buildWelcomePackPlan(...)`
2. `getContentForConcepts(plan.selectedConceptIds)`
3. `buildPrintableWelcomePackViewModel(...)`
4. `PrintableWelcomePackSkeleton`

This preview does **not** change production customer routes, recommendation logic, or production PDF generation.

## Route

- Preferred dev route: `/dev/welcome-pack`
- Component: `src/library/dev/WelcomePackDevPreview.tsx`
- Guard label rendered in UI: `Development preview — not customer content.`

## Fixtures

Fixtures are defined in:

- `src/library/dev/welcomePackDemoFixtures.ts`

Current fixtures:

- `heat_pump_install`
- `combi_replacement`
- `water_supply_constraint`

Each fixture includes:

- `CustomerSummaryV1`
- `AtlasDecisionV1`
- `ScenarioResult[]`
- `userConcernTags`
- `propertyConstraintTags`
- `accessibilityPreferences`

### Adding a fixture

1. Add a new fixture entry in `welcomePackDemoFixtures`.
2. Provide deterministic contract data for summary, decision, and scenarios.
3. Add realistic concern/constraint tags.
4. Set default accessibility preferences for the fixture.
5. Confirm it builds through `buildDemoWelcomePack`.

## Inspecting selected, deferred, and omitted content

Use the metadata panel in the preview to inspect:

- `archetypeId`
- `pageBudgetUsed`
- `selectedConceptIds`
- `deferredConceptIds`
- QR destinations
- omitted assets with reasons

The printable skeleton below the metadata panel shows the composed structure and placeholder content for the same run.

## Accessibility mode testing

The preview supports toggles for:

- print-first
- dyslexia
- ADHD
- technical appendix

Use these toggles to rerun composition and inspect how plan and skeleton output differ under each profile.

## Scope boundary

- This is a development preview only.
- It is **not** production PDF generation.
- It is **not** runtime AI copy generation.
