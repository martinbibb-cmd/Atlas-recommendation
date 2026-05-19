# Atlas Visual Reference Extraction Pass

## Goal

Stop inventing equipment shapes from prose-only descriptions.
Build a canonical visual reference library grounded in real UK heating products and installer documentation before further primitive redraw work.

## Scope for this pass

- Documentation and review-surface guidance only.
- No topology changes.
- No overlay changes.
- No recognisability promotions.
- No status promotion based on metadata-only checks.

## Deliverables in this folder

1. `primitive-reference-packs.md`
   - Visual reference board pack per primitive.
2. `canonical-silhouette-sheets.md`
   - Canonical silhouette constraints and allowed simplification map.
3. `installed-system-visual-language-rules.md`
   - Rules for making diagrams feel physically installed.
4. `primitive-redesign-targets.md`
   - Redesign briefs and blockers for each primitive.
5. `screenshot-first-review.md`
   - Review protocol that makes screenshots primary evidence.

## Review authority

All primitive visual statuses remain provisional until screenshot review passes against:

- current primitive capture,
- target silhouette sheet,
- real-world reference capture.

Metadata tables remain traceability artifacts only.

## Follow-on PR boundary

Any primitive redraw PR must:

1. Cite the relevant primitive reference pack and silhouette sheet.
2. Include side-by-side screenshot evidence.
3. Pass screenshot-first review before any recognisability status changes.

