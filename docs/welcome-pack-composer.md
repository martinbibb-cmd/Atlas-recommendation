# Welcome Pack Composer (Plan-Only Foundation)

## Purpose

`buildWelcomePackPlan` creates a deterministic `WelcomePackPlanV1` structure for a customer welcome pack.
It does not generate PDFs and does not change recommendations.

## Inputs

- `CustomerSummaryV1`
- `AtlasDecisionV1`
- `ScenarioResult[]`
- optional accessibility preferences
- optional user concern tags
- optional property constraint tags

## Output

`WelcomePackPlanV1`:

- `packId`
- `recommendedScenarioId`
- `sections`
  - `calm_summary`
  - `why_this_fits`
  - `living_with_the_system`
  - `relevant_explainers`
  - `optional_technical_appendix` (only when requested)
  - `next_steps`
- `selectedAssetIds`
- `selectedAssetReasons`
- `omittedAssetIdsWithReason`
- `printPageBudget`
- `cognitiveLoadBudget`
- `qrDestinations`

## Planning Rules Implemented

- Always include a calm summary section.
- Never alter the recommendation anchor (`recommendedScenarioId`).
- Include explainers only when relevance evidence exists.
- Prefer print-capable assets when print-first preference is set.
- Avoid high cognitive-load assets unless technical appendix is requested.
- Enforce default 4-page customer budget cap.
- Add QR destinations for deeper digital explainers.
- Omit assets when there is no clear inclusion reason.
