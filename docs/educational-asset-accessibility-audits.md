# Educational Asset Accessibility Audits

This document describes the accessibility audit process and the rules governing promotion of educational assets to `library_ready`.

---

## Overview

Every educational asset in the Atlas library must pass a formal accessibility audit before it can be marked `library_ready`. The audit is recorded in `src/library/audits/educationalAssetAccessibilityAudits.ts` and evaluated by the promotion helper in `src/library/audits/getLibraryReadyAssets.ts`.

---

## Key Principles

### Registered does not mean ready

An asset appearing in `educationalAssetRegistry.ts` is registered in the library. Registration does not imply the asset is ready for production delivery. Registration is a prerequisite for audit; it is not a substitute for it.

### Print equivalent does not mean accessible

An asset may declare `hasPrintEquivalent: true` and still fail the accessibility audit. The print equivalent satisfies the `printEquivalentAvailable` check, but the audit also requires that the asset itself is keyboard-safe, uses semantic structure, does not rely on colour as the sole indicator, and provides a screen-reader summary. All checks must pass independently.

### Audit is the gate to `library_ready`

An asset's lifecycle status can only advance to `library_ready` when:

1. An audit record exists in the audit registry.
2. The audit `status` is `"passed"`.
3. All ten required checks in the audit record are `true`.
4. The asset has no QA errors in `runEducationalAssetQa`.
5. Print assets (`printStatus: "print_ready"`) declare `hasPrintEquivalent: true`.
6. Motion assets (`assetType: "animation"` or non-`none` `motionIntensity`) provide a reduced-motion variant or static fallback.
7. Digital assets (not `registered_only`) have a component mapping in `educationalComponentRegistry`.

The audit **must not** change recommendations, routing, or authored educational meaning. It promotes readiness status only.

### Approval is per mode, not global

Each audit record declares `approvedFor`, which is a list of delivery modes:

| Mode | Description |
|---|---|
| `digital` | Shown on-screen in the digital welcome pack |
| `print` | Included in a printed customer document |
| `reduced_motion` | Safe to show to users with reduced-motion preferences |
| `customer_pack` | Approved for inclusion in customer-facing output |
| `technical_appendix` | Approved for the technical appendix section |

An asset may be approved for some modes and not others. For example, an animation may be approved for `digital` and `reduced_motion` but not yet for `customer_pack` if the content-grounding check has not passed.

### No asset should appear in a production customer pack unless approved for `customer_pack`

The `getAssetsApprovedFor("customer_pack")` helper returns the authoritative list. Any rendering path that produces customer-facing output must consult this list before including an asset.

---

## Audit Checks

| Check | Description |
|---|---|
| `semanticStructure` | Asset uses semantic heading structure and ARIA landmark roles |
| `keyboardSafe` | All interactive elements are keyboard-operable |
| `reducedMotionSafe` | Asset respects `prefers-reduced-motion` or provides a static equivalent |
| `staticFallbackAvailable` | A non-animated static fallback is available |
| `printEquivalentAvailable` | A print-optimised equivalent is available |
| `colourNotSoleIndicator` | Colour is not used as the sole indicator of meaning |
| `screenReaderSummaryAvailable` | A screen-reader summary or `aria-label` is present |
| `cognitiveLoadAcceptable` | Cognitive load has been assessed as acceptable for the target audience |
| `noDecorativeMotion` | No decorative motion is present that cannot be suppressed |
| `noUnsupportedClaims` | All factual claims are grounded in engine output or authored content |

---

## Audit Statuses

| Status | Meaning |
|---|---|
| `draft` | Audit is in progress; asset cannot be promoted |
| `needs_changes` | Audit has identified required changes; asset cannot be promoted |
| `failed` | Audit has failed; asset cannot be promoted |
| `passed` | All checks satisfied; asset is eligible for promotion if QA is also clean |

---

## Helpers

| Helper | Location | Purpose |
|---|---|---|
| `getAuditForAsset(assetId)` | `auditLookup.ts` | Returns the audit record for an asset, or `undefined` |
| `getPassedAudits()` | `auditLookup.ts` | Returns all audits with status `"passed"` |
| `getAssetsApprovedFor(mode)` | `auditLookup.ts` | Returns audits approved for a given delivery mode |
| `getAssetsNeedingChanges()` | `auditLookup.ts` | Returns audits with status `"needs_changes"` |
| `getAssetsWithoutAudit(assets)` | `auditLookup.ts` | Returns assets from a list that have no audit record |
| `getLibraryReadyAssets(assets, qaFindings, componentRegistry)` | `getLibraryReadyAssets.ts` | Evaluates all assets against the promotion gate; returns `readyAssets` and `blockedAssets` with reasons |

---

## Dev Preview

The Welcome Pack dev preview at `/dev/welcome-pack` displays an **Asset accessibility audit** panel for the selected fixture. For each asset in scope, it shows:

- Audit status (`passed`, `needs_changes`, `failed`, `draft`, or `no_audit`)
- Approved delivery modes
- Blocked readiness reasons (if any)

This panel is diagnostic only and does not affect routing or output.

---

## Automatic Status Mutation

The audit registry is a static authored file. No code path should automatically write `status: "passed"` or mutate `approvedFor` at runtime. Status changes must be made deliberately by a human reviewer after completing the audit checklist.
