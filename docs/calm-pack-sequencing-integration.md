# Calm Pack Sequencing Integration

## Purpose

The educational sequencing engine is now wired directly into the calm welcome pack builder
(`buildCalmWelcomePackViewModel`). Customer-facing sections follow the educational rhythm

> **reassurance → expectation → lived experience → misconception → deeper understanding**

instead of the raw `selectedConceptIds` order produced by the routing layer.

---

## What changed

### 1. `buildCalmWelcomePackViewModel`

After the eligibility/content-filtering step, the builder now calls
`buildEducationalSequence(...)` from `src/library/sequencing/`.

**Inputs forwarded to the sequencing engine:**

| Input field | Source |
|---|---|
| `selectedConceptIds` | `plan.selectedConceptIds` |
| `archetypeId` | new input field (falls back to `plan.archetypeId`) |
| `accessibilityPreferences` | new input field — converted via `toRoutingAccessibility()` |
| `contextTags` | new input field — optional emotional/trust tags |
| `sequenceRules` | `educationalSequenceRules` (canonical rules) |

**How the output is used:**

- **Card ordering** — cards within each section are sorted by their concept's position in
  `orderedSequence`, ensuring the educational stage order is respected even when multiple
  concepts land in the same section.
- **Sequencing-deferred concepts** — any concept the engine defers (missing prerequisites,
  already explained, etc.) is excluded from the customer-facing sections and recorded in
  `internalOmissionLog` with the reason from the sequencing rule.
- **Concept density cap** — when an accessibility profile is active (e.g. ADHD, which sets
  `appliedMaxSimultaneous = 1`), sections are capped at that many concept cards. Overflow
  cards are moved to `internalOmissionLog` with a density-cap reason. Safety and
  `calm_summary` sections are exempt from this cap.

### 2. `BuildCalmWelcomePackViewModelInputV1` (extended)

Three new optional fields:

```typescript
archetypeId?: string;
accessibilityPreferences?: WelcomePackAccessibilityPreferencesV1;
contextTags?: SequencingContextTagsV1;
```

### 3. `CalmWelcomePackViewModelV1` (extended)

Three new **internal-only** fields (never rendered to the customer):

```typescript
sequencingMetadata?: CalmWelcomePackSequencingMetadataV1;
deferredBySequencing?: CalmWelcomePackDeferredBySequencingV1[];
pacingWarnings?: string[];
```

These fields are stripped by `stripCustomerDiagnostics` in
`buildCalmWelcomePackFromAtlasDecision` before the view model is returned to callers.

### 4. `buildCalmWelcomePackFromAtlasDecision`

Now passes through to the VM builder:

- `archetypeId: plan.archetypeId` — from the composed plan
- `accessibilityPreferences` — from the outer input
- `contextTags` — derived from `input.userConcernTags` (mapped to `emotionalTags`)

The `stripCustomerDiagnostics` function was extended to also clear `sequencingMetadata`,
`deferredBySequencing`, and `pacingWarnings`.

### 5. `CalmWelcomePack.tsx`

The renderer no longer re-sorts sections by a hard-coded `SECTION_ORDER` constant. It
iterates `viewModel.customerFacingSections` directly in the order the VM builder provides,
trusting that the builder has already applied sequencing-aware ordering. The renderer never
accesses or renders any of the internal sequencing fields.

---

## Accessibility profile → concept-density cap

| Profile | `appliedMaxSimultaneous` |
|---|---|
| `adhd` | 1 |
| `dyslexia` | 2 |
| `low_technical_literacy` | 2 |
| `print_first` | 3 |
| `reduced_motion` | 3 |
| `technical_appendix_requested` | 4 |
| _(default)_ | 4 |

When `prefersReducedMotion`, `prefersPrint`, or `includeTechnicalAppendix` boolean flags
are set on `WelcomePackAccessibilityPreferencesV1`, the `toRoutingAccessibility()` helper
expands them into the corresponding profile entries before forwarding to the sequencing
engine.

---

## Section exemptions from density cap

| Section | Exempted? |
|---|---|
| `calm_summary` | ✓ (contains headline / narrative cards, not concept cards) |
| `safety_and_compliance` | ✓ (safety content must never be capped) |
| All other sections | capped at `appliedMaxSimultaneous` |

---

## Non-goals

- No recommendation changes — `recommendedScenarioId` is never touched.
- No new educational content.
- No production route or PDF generation.
- No change to routing rules or archetype detection.

---

## Tests

New test file: `src/library/__tests__/buildCalmWelcomePackViewModel.sequencing.test.tsx`

| Test suite | Covers |
|---|---|
| Sequencing stage order | Cards within a section respect reassurance → lived\_experience ordering |
| ADHD concept density | ADHD profile reduces cards per section; overflow recorded in omission log |
| Deferred concepts not silently lost | Sequencing-deferred concepts appear in log and/or `deferredBySequencing` |
| Pacing warnings stay internal | `pacingWarnings` not present in customer-facing JSON |
| Renderer no sequencing diagnostics | `CalmWelcomePack` never renders `pacingWarnings`, `deferredBySequencing`, or `sequencingMetadata` text |
| `recommendedScenarioId` unchanged | Sequencing integration does not alter the recommendation |
