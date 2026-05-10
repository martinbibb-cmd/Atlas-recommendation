# Welcome Pack Archetypes

Welcome-pack archetypes turn the educational library into a small recommendation-specific pack.

## Core rule

Archetypes shape explanation packs only. They do not affect Atlas recommendations, scenario ranking, or engine calculations.

## Principles

- The pack should be small enough to read.
- Every included concept needs a reason.
- QR is for depth, not as a substitute for the core print pack.
- The print pack is not a full manual.
- The technical appendix is optional or targeted.

## Relationship to golden journey demonstrators

Golden journey demonstrators are authored demonstrations of tone, pacing, and educational sequencing. They show *how* to communicate a particular scenario.

Archetypes are composer rules. They control *what* gets included in a welcome pack and how it is structured.

**Demonstrators do not select recommendations.** They are preview and template-language artefacts only.

**Archetypes still explain the chosen Atlas truth only.** They never introduce new recommendations or contradict the Atlas decision.

The optional `goldenJourneyId` field on an archetype links it to an authored demonstrator for preview and navigation purposes. It has no influence on `recommendedScenarioId` or any scoring behaviour.

## Archetypes

### Foundation archetypes

- `combi_replacement`
- `combi_to_stored_hot_water`
- `regular_or_system_boiler_upgrade`
- `heat_pump_install`
- `heat_pump_ready_boiler_install`
- `cylinder_upgrade`
- `controls_upgrade`
- `water_supply_constraint`
- `low_temperature_radiator_upgrade`
- `smart_cylinder_tariff_ready`

### Golden journey archetypes

These archetypes are promoted from authored golden-journey demonstrators and are detected at higher priority than their generic counterparts.

- `open_vented_to_sealed_unvented` — beats `cylinder_upgrade` when open-vented/sealed conversion tags are present
- `regular_to_regular_unvented` — beats `regular_or_system_boiler_upgrade` when preserved-system tags are present
- `heat_pump_reality` — beats `heat_pump_install` when expectation/trust tags are present
- `water_constraint_reality` — beats `combi_replacement` and `water_supply_constraint` when mains-boundary tags are present

## Detection priority summary

1. `heat_pump_reality` (ashp + expectation/trust tags)
2. `water_constraint_reality` (mains-boundary tags + pressure/flow constraints or combi scenario)
3. `water_supply_constraint` (pressure/flow/hydraulic constraints or physics flags)
4. `smart_cylinder_tariff_ready` (tariff/storage tags + system/regular/ashp)
5. `controls_upgrade` (controls/weather_compensation/zoning tags)
6. `heat_pump_install` / `low_temperature_radiator_upgrade` (radiator/emitter/flow_temperature tags or high-temp physics)
7. `heat_pump_install` (ashp system type without expectation tags)
8. `combi_to_stored_hot_water` (cylinder/stored/hot_water tags, non-combi)
9. `heat_pump_ready_boiler_install` (future_ready/heat_pump_ready tags)
10. `open_vented_to_sealed_unvented` (open_vented/sealed_system_conversion tags + system/regular)
11. `regular_to_regular_unvented` (preserved_system_strength/premium_hot_water_performance tags + system/regular)
12. `cylinder_upgrade` (cylinder_sizing/standing_losses/legionella tags)
13. Exact scenario type match
14. System type match
15. Fallback

## What an archetype controls

- which concepts are required, recommended, optional, or excluded by default
- which sections are preferred by default
- page and cognitive-load limits
- whether the pack should be compact, balanced, reference-led, or digital-first
- how aggressively deep-dive items should move to QR
- calm framing, trust-recovery, and living-with-system emphasis
