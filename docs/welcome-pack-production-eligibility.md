# Welcome Pack Production Eligibility Gate

## Overview

The production eligibility gate is a per-asset, per-delivery-mode filter that determines whether a
selected welcome-pack asset is ready for customer-facing delivery. It is a **post-routing** gate: it
reads the assets chosen by the routing and budget layers and evaluates their readiness without
altering recommendations, scenario ranking, or engine truth.

## Core rule

> Eligibility gates output delivery readiness only. They must not alter recommendations, scenario
> ranking, or engine truth.

Routing selects **relevance** — which assets are relevant to this customer's context.
Eligibility selects **readiness** — which of those relevant assets are cleared for a given delivery channel.

---

## Delivery modes

Each eligibility check is scoped to a **delivery mode**:

| Mode | Description |
|---|---|
| `customer_pack` | Customer-facing digital welcome pack (default) |
| `digital` | Digital-only delivery (interactive or embedded) |
| `print` | Printed or PDF output |
| `reduced_motion` | Delivery to users who prefer reduced motion |
| `technical_appendix` | Optional technical appendix (more permissive) |

The delivery mode is resolved automatically from the customer's accessibility preferences:
- `prefersPrint` → `print`
- `prefersReducedMotion` → `reduced_motion`
- `includeTechnicalAppendix` → `technical_appendix`
- Default → `customer_pack`

---

## Eligibility rules by delivery mode

### `customer_pack`
An asset is eligible if:
- Its audit record exists.
- `audit.approvedFor` includes `customer_pack`.
- `audit.status` is **not** `needs_changes` or `failed`.
- The asset has no QA errors.

### `print`
An asset is eligible if:
- Its audit record exists.
- A print equivalent is registered in `printEquivalentRegistry`, **or** the asset has a
  `printComponentPath`, **or** the asset type is `print_sheet`.
- The asset has no QA errors.

### `reduced_motion`
An asset is eligible if:
- Its audit record exists.
- `asset.supportsReducedMotion` is `true`, **or** `asset.hasStaticFallback` is `true`, **or**
  `asset.motionIntensity` is `none`.
- The asset has no QA errors.

### `technical_appendix`
An asset is eligible if:
- Its audit record exists.
- `audit.approvedFor` includes `technical_appendix` **or** `customer_pack`.
- The asset has no QA errors.

### `digital`
An asset is eligible if:
- Its audit record exists.
- `audit.status` is `passed`.
- `audit.approvedFor` includes `digital` **or** `customer_pack`.
- The asset has no QA errors.

### Cross-mode rules
- **Missing audit** → ineligible for all production modes (severity: `error`).
- **Asset QA errors** → ineligible for all production modes (severity: `error`).

---

## Eligibility modes

The gate is controlled by the `eligibilityMode` input to `buildWelcomePackPlan`:

| Mode | Behaviour |
|---|---|
| `off` (default) | Gate is disabled. All routing-selected assets are included. No `eligibilityFindings` emitted. |
| `warn` | Gate runs. `eligibilityFindings` are populated. Selected assets are **preserved** — no removal. Findings surface in dev preview and plan output. |
| `filter` | Gate runs. Ineligible assets are **removed** from `selectedAssetIds`. Removal reasons are appended to `omittedAssetIdsWithReason`. |

**Default is `off`** so that existing tests and dev preview are unaffected unless `eligibilityMode`
is explicitly provided.

---

## Dev preview behaviour

The dev preview (`/dev/welcome-pack`) includes a **Production eligibility** radio group with three
options:

- **off** — dev preview mode; shows all routing-selected assets without production checks.
- **warn** — shows eligible / blocked status per asset, with blocked reasons, without removing any
  asset from the preview.
- **filter** — removes ineligible assets from the plan and displays what would be removed from a
  production customer pack.

The dev preview is intentionally allowed to show unapproved assets so that authors can review
in-progress content before it is production-cleared.

---

## Ineligible asset handling

When an asset is ineligible, the gate provides a `replacementHint` suggesting:
- Use a QR deep-dive placeholder if the concept should still be surfaced.
- Defer the asset until audit approval is completed.
- Use a static print equivalent if available.

Ineligible assets should become QR/deferred/placeholder **only if safe** — i.e., the replacement
does not introduce content that itself requires production approval.

---

## Non-goals

- No production route wiring: this gate is diagnostic only until wired into a production delivery path.
- No PDF generation: eligibility is evaluated independently of rendering.
- No asset approval changes: the gate reads audit records; it does not update them.
- No visual redesign: dev preview styling matches existing diagnostic sections.
