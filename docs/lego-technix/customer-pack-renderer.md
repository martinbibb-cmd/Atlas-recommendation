# Customer Pack Renderer

**Location:** `src/features/customerPack/`

## Renderer non-authority rule

`CustomerPackRendererV1` is a read-only customer surface for `CustomerEvidencePackV1`.

It must never:
- recalculate system behaviour
- re-rank recommendations
- substitute its own confidence wording
- expose internal warning codes or hydraulic diagnostics
- mutate evidence before rendering

The recommendation engine remains responsible for the chosen system. LegoTechnix remains responsible for simulation, explainability, confidence, and the evidence payload. The renderer only formats that payload into stable customer-safe output.

## Print-first philosophy

The renderer is intentionally calm, low-ink, and A4-safe.

Current layout priorities:
- deterministic section order
- shared visual tokens for spacing, typography, borders, and low-ink colour
- clean section/card hierarchy with consistent spacing rhythm
- long-text wrapping without overflow
- break-inside avoidance for cards and timeline blocks
- print-safe confidence badges, warning chips, and simple metric tiles
- responsive layout hooks compatible with both print and portal/mobile surfaces
- no heavy graphics, motion, or decorative marketing elements

This remains a restrained foundation layer, not final visual language or diagram work.

## Evidence-only rendering

The renderer input is `CustomerEvidencePackV1` only.

It renders:
- the locked recommendation label and summary verbatim
- all 10 canonical sections in pack order
- section summaries, warnings, and timelines
- evidence cards with optional metrics, confidence wording, warning chips, and timeline entries
- customer-safe confidence strings from the evidence payload

This keeps customer output aligned with runtime evidence and prevents the print surface from silently changing truth.

## Preview and export workflow

**Route:** `/dev/customer-pack-preview` (also `?customer-pack-preview=1`)

The preview route allows Atlas to produce and inspect the full evidence-driven customer pack end-to-end without any production portal infrastructure.

### Preview pipeline

`buildCustomerPackPreviewPipelineV1` (`src/dev/customerPackPreview/`) runs the full canonical chain:

```
canonical template (LegoTechnixCanonicalSystemTemplateV1)
  → runLegoTechnixScenarioV1        (ScenarioResultV1)
  → buildDhwRecoveryMetricsV1       (DhwRecoveryMetricsV1)
  → buildHydraulicConfidenceReportV1 (HydraulicConfidenceReportV1)
  → buildLegoTechnixExplainabilityReportV1 (LegoTechnixExplainabilityReportV1)
  → buildCustomerEvidencePackV1     (CustomerEvidencePackV1)
  → CustomerPackRendererV1
```

The preview **builds** the pack; `CustomerPackRendererV1` does **not** — it only renders what it receives.

### Template selection

The preview page exposes a selector for all six canonical templates:

| Template | System type |
|---|---|
| Regular boiler + vented cylinder + Y-plan | `regular_boiler_vented_cylinder_y_plan` |
| System boiler + unvented cylinder + S-plan | `system_boiler_unvented_cylinder_s_plan` |
| Combi boiler + radiators | `combi_boiler_radiators` |
| Heat pump + unvented cylinder + weather compensation | `heat_pump_unvented_weather_comp` |
| Mixergy / stratified cylinder | `mixergy_stratified_cylinder` |
| Thermal store | `thermal_store` |

### Debug summary

The preview toolbar shows five debug fields (hidden on print):

- **Template id** — canonical template identifier
- **Scenario duration** — simulated duration in seconds
- **Schema version** — `CustomerEvidencePackV1.schemaVersion` (currently `1.0`)
- **Confidence level** — overall hydraulic confidence from the report
- **Warnings** — count of engineering warnings from the confidence report

### PDF export

The print / PDF export button calls `window.print()`. The debug toolbar carries the CSS class `no-print` and is suppressed in print output via a `@media print` rule:

```css
@media print { .no-print { display: none !important; } }
```

### Print wrapper payload metadata

`CustomerPackPrintExportWrapper` (`src/dev/customerPackPreview/`) wraps the rendered pack in a container with embedded data attributes. These are readable by any downstream PDF pipeline or automated export harness:

| Attribute | Value |
|---|---|
| `data-payload-schema-version` | Pack schema version string |
| `data-payload-template-id` | Canonical template id |
| `data-payload-confidence-level` | Overall hydraulic confidence level |
| `data-payload-warnings-count` | Integer count of engineering warnings |
| `data-payload-scenario-duration-seconds` | Scenario duration in seconds |

### Legacy placeholder

The old placeholder PDF output can be marked legacy. The canonical replacement is this evidence-driven pack pipeline routed through `/dev/customer-pack-preview`.

## Future visual roadmap

Near-term visual work can improve:
- typography scale and spacing polish
- iconography for warnings and timelines
- branded skinning on top of the same evidence contract
- richer pagination control for longer packs

Those changes must remain presentational only. They must not alter section order, recommendation wording, confidence wording, or evidence content.

## Future portal integration path

The same `CustomerEvidencePackV1` payload should feed both PDF and portal surfaces.

Expected path:
1. recommendation engine locks the chosen system summary
2. LegoTechnix builds `CustomerEvidencePackV1`
3. PDF and portal surfaces both render from that pack
4. any richer portal interactions remain derived from the same evidence payload, not fresh recommendation logic in the UI

This keeps the customer pack, future portal, and any later simulator-facing customer surface aligned to one canonical evidence grammar.
