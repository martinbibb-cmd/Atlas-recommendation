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

Current fixtures (10 total — one per archetype):

| Fixture ID | Archetype | Summary |
|---|---|---|
| `heat_pump_install` | `heat_pump_install` | ASHP with stored hot water; emitter checks |
| `combi_replacement` | `combi_replacement` | Like-for-like combi; cycling focus |
| `water_supply_constraint` | `water_supply_constraint` | Hydraulic/pressure constraint |
| `combi_to_stored_hot_water` | `combi_to_stored_hot_water` | Simultaneous-use conflict; system switch |
| `regular_or_system_boiler_upgrade` | `regular_or_system_boiler_upgrade` | Condensing boiler upgrade |
| `heat_pump_ready_boiler_install` | `heat_pump_ready_boiler_install` | Combi to HP-ready specification |
| `cylinder_upgrade` | `cylinder_upgrade` | Storage vessel replacement |
| `controls_upgrade` | `controls_upgrade` | Weather compensation and zoning |
| `low_temperature_radiator_upgrade` | `low_temperature_radiator_upgrade` | Emitter upgrade for lower flow temperature |
| `smart_cylinder_tariff_ready` | `smart_cylinder_tariff_ready` | Tariff-aware thermal storage |

> **Fixture coverage is not production capability.** The library routing and composer can handle
> any valid input. Fixtures are pre-built examples that make specific archetypes easy to inspect.

Each fixture includes:

- `CustomerSummaryV1`
- `AtlasDecisionV1`
- `ScenarioResult[]`
- `userConcernTags`
- `propertyConstraintTags`
- `accessibilityPreferences`

### How to add a new archetype fixture

1. Add the fixture ID to the `WelcomePackDemoFixtureId` union type.
2. Write a `CustomerSummaryV1` with realistic scenario narrative.
3. Build an `AtlasDecisionV1` using `buildAtlasDecision` with lifecycle overrides.
4. Define `ScenarioResult[]` with the system type, performance, and physics flags.
5. Choose `userConcernTags` that trigger the intended archetype. Refer to the archetype
   detection logic in `src/library/packComposer/archetypes/welcomePackArchetypes.ts`:
   - `pressure` / `flow` / `hydraulic` → `water_supply_constraint`
   - `smart_tariff` / `tariff` → `smart_cylinder_tariff_ready`
   - `weather_compensation` / `zoning` / `controls` → `controls_upgrade`
   - `flow_temperature` / `radiator` / `emitters` (non-ASHP) → `low_temperature_radiator_upgrade`
   - `heat_pump_ready` / `future_ready` → `heat_pump_ready_boiler_install`
   - `cylinder_sizing` / `standing_losses` / `legionella` → `cylinder_upgrade`
6. Add the fixture to the `welcomePackDemoFixtures` record.
7. Update `EXPECTED_ARCHETYPE_COVERAGE` in `welcomePackDemoFixtures.coverage.test.ts`.
8. Run the coverage test to confirm the fixture builds, resolves the right archetype, and
   produces non-empty `selectedConceptIds`.

## Inspecting selected, deferred, and omitted content

Use the metadata panel in the preview to inspect:

- `archetypeId`
- `pageBudgetUsed`
- `selectedConceptIds`
- `deferredConceptIds`
- QR destinations
- omitted assets with reasons

The printable skeleton below the metadata panel shows the composed structure and placeholder content for the same run.

## Production eligibility

The preview includes a **Production eligibility** radio group with three modes:

| Mode | Behaviour |
|---|---|
| `off` (default) | All routing-selected assets shown. No delivery-readiness checks. |
| `warn` | Eligibility checked per asset. Findings displayed without removing assets. |
| `filter` | Ineligible assets removed. Blocked reasons shown. |

Dev preview can show unapproved assets (mode `off`). Production customer pack should use `filter`
mode. See `docs/welcome-pack-production-eligibility.md` for the full eligibility contract.

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

