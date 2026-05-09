# Atlas Accessibility Library Infrastructure (Foundation PR)

## Scope

This foundation introduces the educational-library infrastructure only:

- Typed educational contracts in `src/library/contracts/`
- A manual registry of already-existing explainers and visuals
- Audit helpers for accessibility and print-readiness checks
- A welcome-pack composer plan contract and first deterministic planner

No UI redesign is included. No educational content rewrite is included. No PDF generation is included.

## Core Rule

The library may explain Atlas engine truth, but it must never choose, alter, rank, or override recommendations.

## Foundation Modules

- `src/library/contracts/*` — shared contract layer
- `src/library/registry/educationalAssetRegistry.ts` — initial asset inventory
- `src/library/audit/listEducationalAssets.ts` — audit/query helper functions
- `src/library/packComposer/WelcomePackComposerV1.ts` — welcome-pack plan contracts
- `src/library/packComposer/buildWelcomePackPlan.ts` — first plan builder

## Design Guardrails

- The recommendation anchor remains `AtlasDecisionV1.recommendedScenarioId`.
- Composer output is a pack plan object, not a rendered document.
- Print-first and reduced-motion preferences are represented in planning logic.
- High cognitive-load assets are excluded unless a technical appendix is explicitly requested.
- Default customer page budget is capped at 4 pages.
