# Golden Journey Educational Demonstrators

This module adds fully composed educational demonstrators that use the Atlas educational UI primitives, real library content, and calm pacing patterns.

## Distinction: demonstrators vs archetypes

**Golden journey demonstrators** are authored demonstrations of tone, pacing, and educational sequencing. They show *how* to communicate a particular scenario — the right words, the right order, the right framing.

**Welcome-pack archetypes** are composer rules. They control *what* gets included in a welcome pack and how it is structured.

This distinction matters:

- Demonstrators do not select recommendations.
- Demonstrators do not drive `recommendedScenarioId`.
- Archetypes still explain the chosen Atlas truth only — they never introduce new recommendations.
- The `goldenJourneyId` field on an archetype links to a demonstrator for preview/navigation purposes only; it has zero influence on recommendation or scoring logic.

## Location

- `src/library/demoJourneys/`

## Included Journeys

1. **Open-vented to sealed + unvented journey**
   - Flagship premium-comfort upgrade
   - Explains pressure-source vs stored-capacity differences
   - Covers misconception correction, trust recovery, and safety framing
   - Promoted to archetype: `open_vented_to_sealed_unvented`

2. **Regular to regular + unvented journey**
   - Flagship smart-engineering path
   - Emphasises preserving suitable architecture while upgrading outcomes
   - Covers realistic hot-water expectations and low-disruption messaging
   - Promoted to archetype: `regular_to_regular_unvented`

3. **Heat pump reality journey**
   - Flagship educational/trust path
   - Covers warm-not-hot emitters, steady running, compensation, and trust recovery
   - Promoted to archetype: `heat_pump_reality`

4. **Water constraints and hydraulic reality journey**
   - Flagship expectation-management path
   - Covers supply boundaries, realistic overlap expectations, and calm constraint communication
   - Promoted to archetype: `water_constraint_reality`

## How demonstrators become archetypes

Each golden journey is both an authored demonstrator (in `src/library/demoJourneys/`) and a promoted archetype (in `src/library/packComposer/archetypes/welcomePackArchetypes.ts`).

The demonstrator defines the *tone and pacing template*. The archetype codifies the *composer rules* that reflect that template. When the archetype is selected by the detection logic, the resulting pack will follow the same educational sequencing established in the demonstrator.

The `goldenJourneyId` field on the archetype records this link for preview and navigation metadata. It is never read by the recommendation engine, the scoring logic, or the pack composer itself.

## Composition Guarantees Per Journey

Each journey includes:

- Calm summary
- Misconception correction
- What-you-may-notice guidance
- Living-with-system guidance
- Trust-recovery section
- QR/deeper-detail examples
- Customer confusion checklist
- Journey comparison panel for:
  - print-first
  - dyslexia
  - ADHD
  - reduced motion

## Tests Added

- `src/library/__tests__/goldenJourneyDemonstrators.test.tsx`
- `src/library/__tests__/goldenArchetypes.test.ts`

Coverage includes:

- Semantic heading order
- Paragraph overload limits
- No dev diagnostics leakage
- Reduced-motion card accessibility
- Print-safe layout presence
- Golden archetype detection priority (each golden archetype beats its generic counterpart)
- `goldenJourneyId` metadata does not affect `recommendedScenarioId`
- All golden archetypes build calm packs within page budget

## Non-goals Maintained

- No production routes added
- No PDF generation changes
- No recommendation logic changes
- No scoring or ranking changes
