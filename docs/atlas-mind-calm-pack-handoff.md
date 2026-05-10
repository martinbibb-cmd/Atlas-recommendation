# Atlas Mind Calm Welcome Pack Handoff Builder

## Scope

- Adds a safe handoff builder for turning Atlas decision truth into calm welcome-pack view models.
- Keeps this boundary non-production-routed.
- Adds no portal token wiring, no PDF generation, and no new educational content.

## Entry point

- `src/library/packRenderer/buildCalmWelcomePackFromAtlasDecision.ts`
- Function: `buildCalmWelcomePackFromAtlasDecision`

## Inputs

- `customerSummary: CustomerSummaryV1`
- `atlasDecision: AtlasDecisionV1`
- `scenarios: ScenarioResult[]`
- Optional:
  - `brandProfile`
  - `visitReference`
  - `accessibilityPreferences`
  - `userConcernTags`
  - `propertyConstraintTags`
  - `includeTechnicalAppendix`

## Pipeline

The builder runs this fixed sequence:

1. `buildWelcomePackPlan` with `eligibilityMode: 'filter'`
2. `getContentForConcepts(plan.selectedConceptIds)`
3. `buildCalmWelcomePackViewModel`
4. `buildBrandedCalmWelcomePackViewModel`

## Output contract

Returns:

- `plan`
- `calmViewModel`
- `brandedViewModel`
- `readiness`

## Safety and invariants

- Customer-pack eligibility filtering is always on.
- `recommendedScenarioId` is preserved end-to-end.
- Plan is retained for audit/debug.
- Customer-facing calm/branded outputs strip internal diagnostics.
- If readiness is unsafe, branded output remains blocked by readiness.
