# Calm Welcome Pack Renderer

## Scope

- Renders `CalmWelcomePackViewModelV1` as a customer-safe, print/web-friendly component.
- Uses deterministic view-model content only.
- Excludes developer diagnostics and internal omission telemetry from customer output.

## Customer safety rules

- If `readiness.safeForCustomer` is `false`, renderer outputs a blocking panel only.
- `internalOmissionLog` is never rendered.
- Avoids QA/audit/eligibility wording in customer-rendered content.
- Avoids `Content pending` placeholder text.
- Does not depend on animation or interactive-only components.

## Rendered sections

- Header/title
- Calm summary
- Why this fits
- Living with your system
- Relevant explainers
- Safety and compliance (only when present in the view model)
- QR and deeper detail labels
- Next steps
- Optional technical appendix only when present in `customerFacingSections`

## Accessibility and print intent

- Semantic heading structure (`h1`, `h2`, `h3`)
- Left-aligned, low-density sections with readable sizing
- Print-friendly class names and light visual treatment
- No heavy backgrounds
