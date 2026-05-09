# Educational Concept Taxonomy

## Purpose

The educational concept taxonomy is the canonical map of what Atlas can explain in welcome packs, print packs, and digital explainers.

This taxonomy defines educational meaning only.
It must not change recommendation scoring, scenario ranking, or engine truth.

## Core flow

1. **Concept IDs are canonical**
   - Every educational concept is identified by a stable `conceptId`.
2. **Assets attach to concepts**
   - Educational assets declare one or more `conceptIds`.
3. **Routing selects assets**
   - Routing rules choose assets for context and accessibility.
4. **Composer assembles packs**
   - The pack composer arranges selected assets into a delivery plan.

## Confidence levels

Every concept includes a `confidenceLevel` so downstream systems can explain how strong the claim type is:

- `physical_law`
- `standards_based`
- `manufacturer_guidance`
- `best_practice`
- `operational_preference`

## Guardrail

Taxonomy metadata is educational structure only.
It does not decide recommendations.
