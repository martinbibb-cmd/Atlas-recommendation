# Screenshot-First Review Protocol

## Rule change

Primary review artifact is now side-by-side screenshots.
Metadata tables are secondary traceability only and cannot promote visual status by themselves.

## Required comparison set per primitive

Every review bundle must include a side-by-side panel with:

1. Current Atlas primitive screenshot.
2. Target silhouette sheet reference (from `canonical-silhouette-sheets.md`).
3. Real-world reference capture (installer brochure/photo evidence from `primitive-reference-packs.md`).

## Required reviewer questions

- Is the current primitive visibly distinguishable from the target silhouette?
- Which specific silhouette constraints are failing (proportions, spacing, visual weight, minimum details)?
- Does the real-world reference explain why the current drawing fails?
- Do anti-patterns from `installed-system-visual-language-rules.md` appear?

## Pass/fail rule

A review passes only when a reviewer can immediately explain, from the side-by-side screenshots, why the current primitive either:

- already meets the target silhouette, or
- clearly fails and needs redraw.

If this cannot be explained from screenshots alone, review fails.

## Promotion authority

- Screenshot-first review pass is required before any recognisability promotion.
- Automated checks and metadata compliance may support evidence but cannot replace screenshot review.

## Follow-on redraw PR requirements

Each redraw PR must attach:

- before/after primitive screenshots,
- target silhouette row citation,
- real-world reference citation,
- explicit anti-pattern checklist result.

