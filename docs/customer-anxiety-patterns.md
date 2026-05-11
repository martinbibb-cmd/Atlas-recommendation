# Customer Anxiety Patterns

This document defines the customer anxiety routing layer used by the welcome-pack sequencing flow.

## Goal

Model realistic customer anxieties so reassurance pacing can adapt without changing recommendations or scoring.

## Contract

`CustomerAnxietyPatternV1` includes:

- `anxietyId`
- `category`: `disruption | comfort | financial | trust | safety | competence | regret`
- `triggers`
- `reassuranceStrategies`
- `preferredCardTypes`
- `avoidConcepts`
- `sequencingBias`
- `qrDepthPreference`
- `printPreferenceWeight`

## Initial Patterns

The initial registry includes:

- `worried_about_disruption`
- `worried_about_running_costs`
- `worried_about_heat_pumps`
- `worried_about_complex_controls`
- `worried_about_pressure_changes`
- `worried_about_safety`
- `skeptical_of_sales`
- `worried_about_noise`
- `worried_about_hot_water`

## Resolver

`resolveCustomerAnxietyPatterns(...)` accepts:

- concern tags
- accessibility profiles
- archetype
- survey notes (optional)
- manual overrides

The resolver returns active anxiety patterns and a merged sequencing policy.

## Sequencing Integration

The sequencing layer uses resolved anxiety policy to:

- raise reassurance priority
- reduce simultaneous concept density
- prefer `WhatToExpectCard`
- suppress technical-heavy placement
- increase “what stays familiar” emphasis

## Diagnostics and Storyboard

Diagnostics mode in the dev preview shows:

- active reassurance pattern IDs
- reassurance pacing visual indicator

This is diagnostics-only and is not customer-facing output.

## Non-goals

- no manipulation profiling
- no production route changes
- no recommendation or scoring changes
- no invasive personal inference
