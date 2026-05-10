# Branded Calm Welcome Pack Integration Boundary

## Scope

- Adds a safe branding decoration boundary for `CalmWelcomePackViewModelV1`.
- Keeps recommendation, eligibility, and safety logic unchanged.
- Stays development-only; no production route, token, or PDF wiring is added.

## View-model metadata

`CalmWelcomePackViewModelV1` now supports optional branding and handoff metadata:

- `brandName`
- `brandLogoUrl`
- `brandContactLabel`
- `brandTone`
- `generatedAt`
- `visitReference`

These fields are decoration-only and do not influence ranking, scenario selection, eligibility, or readiness gates.

## Builder boundary

`buildBrandedCalmWelcomePackViewModel` decorates an existing calm view model using:

- a provided `BrandProfileV1`, or
- a brand ID resolved via the brand resolver, or
- safe fallback to Atlas default when brand input is missing.

The builder preserves existing customer content and recommendation identifiers.

## Renderer behavior

`CalmWelcomePack.tsx` now:

- renders a lightweight brand header when brand name/logo metadata exists
- renders a lightweight footer when contact/reference/generated metadata exists
- keeps low-ink styling (no heavy brand color backgrounds)
- keeps customer safety blocking: when `safeForCustomer` is false, branded customer content is not rendered

Logo rendering is optional and non-blocking; missing or broken logo URLs do not block pack rendering.

## Dev preview controls

`/dev/welcome-pack` includes a brand profile selector that uses available development brand profiles and feeds branded calm preview output.
