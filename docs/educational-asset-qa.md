# Educational Asset QA

## Purpose

Educational Asset QA is a diagnostic readiness checker for registered educational assets.

- It validates that animations, diagrams, print sheets, and other visual assets meet accessibility and governance standards before being migrated or expanded.
- It does **not** move components, rewrite visuals, affect routing, or change recommendation logic.
- QA outputs findings only (`info`, `warning`, `error`) and never mutates asset records.

## Scope boundary

Asset QA is a read-only diagnostic. It reports readiness — it does not block production rendering.

- Findings are available in the dev preview at `/dev/welcome-pack`.
- QA does not gate any production route.
- QA does not alter asset metadata, taxonomy, or component registrations.

## Motion asset safety rules

Animation assets require reduced-motion and static fallback safety declarations:

- `supportsReducedMotion: true` — the asset must have a reduced-motion mode or static equivalent that activates when the user prefers reduced motion.
- `hasStaticFallback: true` — a non-animated rendering must exist for contexts where animation is unavailable (print, screen reader, no-JS environments).

Failure to declare both fields for an animation asset produces an **error** finding.

## Print-first asset rules

Assets intended for print must declare print readiness explicitly:

- Assets with `printStatus: 'print_ready'` must also set `hasPrintEquivalent: true`.
- Assets that lack a print equivalent receive a **warning** finding regardless of print status.

Print equivalence ensures assets can be included in printable welcome packs without degrading the customer experience.

## library_ready definition

`lifecycleStatus: 'library_ready'` means the asset is accessible enough for wider digital or print use. Reaching this status requires:

1. `accessibilityAuditStatus: 'passed'` — the asset has been reviewed and cleared by the accessibility audit process.
2. `printStatus` must not be `'needs_static_equivalent'` — all required print equivalents must be in place.

Assets that claim `library_ready` without meeting both conditions produce **error** findings.

## registered_only status

`migrationStatus: 'registered_only'` means the asset is known to the registry and component bridge, but has not yet been wrapped with `EducationalAssetRenderer` or moved to `src/library/components/`.

- `registered_only` does **not** mean production-ready.
- Assets at this stage may have partial accessibility audits, missing print equivalents, or unresolved QA findings.
- Use the Asset QA panel to understand the readiness gap before promoting an asset.

## QA rules reference

| ruleId | severity | condition |
|---|---|---|
| `missing_concept_ids` | error | `conceptIds` is empty |
| `unknown_concept_id` | error | a `conceptId` is not in the taxonomy |
| `missing_asset_type` | error | `assetType` is not set |
| `missing_audience` | error | `audience` is not set |
| `missing_cognitive_load` | error | `cognitiveLoad` is not set |
| `missing_text_density` | error | `textDensity` is not set |
| `missing_motion_intensity` | error | `motionIntensity` is not set |
| `animation_missing_reduced_motion_support` | error | animation asset does not declare `supportsReducedMotion: true` |
| `animation_missing_static_fallback` | error | animation asset does not declare `hasStaticFallback: true` |
| `print_ready_missing_print_equivalent` | error | `printStatus: 'print_ready'` but `hasPrintEquivalent: false` |
| `library_ready_audit_not_passed` | error | `lifecycleStatus: 'library_ready'` but `accessibilityAuditStatus` is not `'passed'` |
| `library_ready_needs_static_equivalent` | error | `lifecycleStatus: 'library_ready'` and `printStatus: 'needs_static_equivalent'` |
| `wrapped_missing_component_path` | warning | wrapped/moved asset has no `currentComponentPath` |
| `missing_component_mapping` | warning | asset has no entry in `educationalComponentRegistry` |
| `missing_print_equivalent` | warning | `hasPrintEquivalent: false` and not yet print_ready |
