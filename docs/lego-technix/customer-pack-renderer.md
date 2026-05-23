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
- clean separation between sections and cards
- long-text wrapping without overflow
- break-inside avoidance for cards and timeline blocks
- no heavy graphics, motion, or decorative marketing elements

This is the first stable rendering skeleton, not the final visual design.

## Evidence-only rendering

The renderer input is `CustomerEvidencePackV1` only.

It renders:
- the locked recommendation label and summary verbatim
- all 10 canonical sections in pack order
- section summaries, warnings, and timelines
- evidence cards with optional metrics, confidence wording, warning chips, and timeline entries
- customer-safe confidence strings from the evidence payload

This keeps customer output aligned with runtime evidence and prevents the print surface from silently changing truth.

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
