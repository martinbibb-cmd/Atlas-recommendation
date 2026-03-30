# Atlas Canonical Contract

**Version:** `v2.3`  
**Contract version constant:** `CONTRACT_VERSION` in `src/contracts/versions.ts`  
**Status:** Authoritative — all AI coders must read this document before writing engine, contract, or presentation code.

---

## ⚠️ Mandatory reading for AI coders

Before writing ANY code that touches data flow between survey, engine, or presentation:

1. Read this document in full.
2. Do **not** introduce new data paths.
3. Do **not** derive fields in UI components.
4. Do **not** read raw draft outside the survey UI.
5. All new fields must be added to:
   - `sanitiseModelForEngine` (derivation)
   - This contract document (ownership map + derived fields list)
   - Provenance mapping (`canonicalSource.fields` in deck slides)

---

## 1. Source of Truth Rule

### The single canonical input pipeline

```
SurveyDraftInput (raw draft)
  → sanitiseModelForEngine()
  → FullSurveyModelV1 (sanitised)
  → engine (FullEngineResult)
  → buildCanonicalPresentation()
  → CanonicalPresentationModel
  → PresentationDeck / CanonicalPresentationPage
```

### Hard constraints

| Rule | Detail |
|------|--------|
| **Raw draft MUST NOT be consumed outside the survey UI** | `SurveyDraftInput` and `ProvenanceField<T>` wrapping is a survey-layer concern only. |
| **Sanitised model is the ONLY canonical engine input** | `sanitiseModelForEngine` is the single handoff point. |
| **Derived fields MUST NOT be recomputed outside the sanitiser** | `occupancyCount`, `demandPreset`, `boilerConditionBand`, etc. belong to `sanitiseModelForEngine`. |
| **Presentation reads only `CanonicalPresentationModel`** | Never read `FullSurveyModelV1` or raw draft inside a deck page or presentation component. |
| **No `Math.random()` in presentation or engine** | All outputs must be deterministic. |

---

## 2. Layer Boundaries

### Survey layer (`src/ui/fullSurvey/`)

- **Input:** User interaction via `SurveyDraftInput` (uses `ProvenanceField<T>` with `source: 'user' | 'inferred' | 'defaulted'`).
- **Output:** `FullSurveyModelV1` passed through `sanitiseModelForEngine`.
- **Permitted consumers:** Survey step components, stepper, `sanitiseModelForEngine`.
- **Forbidden:** Passing `SurveyDraftInput` or raw `fullSurvey.*` sub-objects into the engine or presentation.

### Sanitiser (`src/ui/fullSurvey/sanitiseModelForEngine.ts`)

- **Single authority for ALL field derivation and mapping.**
- Must be **pure** (no side effects) and **deterministic**.
- Must **not mutate** the input model — always spreads into a new object.
- If a field is needed by the engine or presentation → it belongs here.
- Physics-sensitive fields must be `undefined` in `INITIAL_SURVEY_DRAFT` (no phantom defaults).

### Engine layer (`src/engine/`)

- **Input:** Sanitised `FullSurveyModelV1` (treated as `EngineInputV2_3`).
- **Output:** `FullEngineResult` containing `EngineOutputV1` plus module-specific results.
- **Forbidden:** Re-deriving fields from raw survey data; reading `fullSurvey.*` sub-objects not explicitly bridged by sanitiser.

### Presentation layer (`src/components/presentation/`)

- **Input:** `CanonicalPresentationModel` from `buildCanonicalPresentation()`.
- **Output:** React components (deck slides, presentation pages).
- **Forbidden:** Reading raw draft, calling engine directly, re-deriving any physics field.
- Every deck page must declare `canonicalSource: { component, fields }` (see §5).

---

## 3. Field Ownership Map

Legend:
- **source**: where the value originates
- **transform**: processing applied before use
- **consumers**: which layers use the field

### 3.1 Infrastructure / Building fields

| Field | Source | Transform | Consumers |
|-------|--------|-----------|-----------|
| `postcode` | survey | none | engine (water hardness, gas zone) |
| `primaryPipeDiameter` | survey | clamped to `15\|22\|28\|35` mm | engine, presentation |
| `heatLossWatts` | **derived** | `fullSurvey.heatLoss.estimatedPeakHeatLossW` wins over root field | engine, presentation |
| `buildingMass` | survey | none | engine |
| `radiatorCount` | survey | none | engine |
| `hasLoftConversion` | survey | none | engine |
| `returnWaterTemp` | survey | none | engine |
| `roofOrientation` | **derived** | compass → engine enum (`sanitiseModelForEngine` roof/solar bridge) | engine, presentation |
| `roofType` | **derived** | survey `heatLoss.roofType` → engine enum | engine, presentation |
| `solarShading` | **derived** | `heatLoss.shadingLevel` → engine enum | engine, presentation |
| `building.fabric.*` | survey | direct pass-through | engine (FabricModelModule) |

### 3.2 Mains / Services fields

| Field | Source | Transform | Consumers |
|-------|--------|-----------|-----------|
| `staticMainsPressureBar` | survey | clamped to ≤10 bar | engine |
| `dynamicMainsPressureBar` | survey | corrected if > static | engine |
| `mainsDynamicFlowLpm` | survey | clamped to ≤60 L/min | engine |
| `coldWaterSource` | survey | none | engine |
| `dhwDeliveryMode` | survey | none | engine |
| `mains.*` | survey | propagated into flat fields by sanitiser | engine |

### 3.3 Occupancy / Demand fields

| Field | Source | Transform | Consumers |
|-------|--------|-----------|-----------|
| `occupancyCount` | **derived** | `householdComposition` → `deriveProfileFromHouseholdComposition`; overrides direct survey value | engine, presentation |
| `demandPreset` | **derived** | `householdComposition` → `DemandPresetId`; unless `demandPresetIsManualOverride` | engine |
| `occupancySignature` | **derived** | `presetToEngineSignature(demandPreset)` | engine |
| `peakConcurrentOutlets` | **derived** | inferred from `demandPreset.simultaneousUseSeverity` when not explicitly set | engine, presentation |
| `bathroomCount` | survey | none | engine, presentation |
| `highOccupancy` | survey | none | engine |
| `demandTimingOverrides` | survey | none | engine |
| `demandPresetIsManualOverride` | survey | none | sanitiser (guard) |
| `householdComposition` | survey | none | sanitiser (derivation source) |

### 3.4 PV / Battery fields

| Field | Source | Transform | Consumers |
|-------|--------|-----------|-----------|
| `pvStatus` | **derived** | `fullSurvey.heatLoss.pvStatus` → root field (explicit root wins) | engine, presentation |
| `batteryStatus` | **derived** | `fullSurvey.heatLoss.batteryStatus` → root field (explicit root wins) | engine, presentation |

### 3.5 Current system fields

| Field | Source | Transform | Consumers |
|-------|--------|-----------|-----------|
| `currentHeatSourceType` | survey | none | sanitiser, engine |
| `currentBoilerAgeYears` | survey | clamped to ≤50 years | sanitiser bridge |
| `currentBoilerOutputKw` | survey | none | sanitiser bridge |
| `currentSystem.boiler.*` | **derived** | bridged from flat survey fields by sanitiser; explicit nested values win | engine (BoilerEfficiencyModelV1) |
| `boilerConditionBand` | **derived** | `inferBoilerCondition(age, condensing, symptoms)` | engine, presentation |

### 3.6 DHW condition fields

| Field | Source | Transform | Consumers |
|-------|--------|-----------|-----------|
| `plateHexFoulingFactor` | **derived** | `inferPlateHexCondition(water, usage, age)` from `fullSurvey.dhwCondition` | engine (CombiDhwModule) |
| `plateHexConditionBand` | **derived** | alongside `plateHexFoulingFactor` | engine |
| `cylinderInsulationFactor` | **derived** | `inferCylinderCondition(…)` from `fullSurvey.dhwCondition` | engine (StoredDhwModule) |
| `cylinderCoilTransferFactor` | **derived** | alongside `cylinderInsulationFactor` | engine |
| `cylinderConditionBand` | **derived** | alongside `cylinderInsulationFactor` | engine |
| `hasSoftener` | **derived** | bridged from `fullSurvey.dhwCondition.softenerPresent` | engine (MetallurgyEdgeModule) |
| `currentCylinderPresent` | **derived** | bridged from `fullSurvey.dhwCondition.currentCylinderPresent` | engine |
| `cylinderVolumeLitres` | **derived** | bridged from `fullSurvey.dhwCondition.currentCylinderVolumeLitres` | engine |
| `cwsHeadMetres` | **derived** | bridged from `fullSurvey.dhwCondition.currentCwsHeadMetres` | engine |

### 3.7 Expert assumptions / preferences

| Field | Source | Transform | Consumers |
|-------|--------|-----------|-----------|
| `expertAssumptions` | survey / expert UI | none | engine (ranking only, not physics) |
| `preferences` | survey | none | engine (ranking only) |
| `productConstraints` | engine config / survey | none | engine (intervention filter) |

---

## 4. Derived Fields — Mandatory List

The following fields are **always** derived by `sanitiseModelForEngine`. They must **never** be:
- Recomputed in UI components
- Set independently when their source field (`householdComposition`, `fullSurvey.heatLoss.*`, etc.) is present
- Passed as raw user input when the source is available

| Derived field | Source | Derivation function |
|---------------|--------|---------------------|
| `occupancyCount` | `householdComposition` | `deriveProfileFromHouseholdComposition` |
| `demandPreset` | `householdComposition` | `deriveProfileFromHouseholdComposition` |
| `occupancySignature` | `demandPreset` | `presetToEngineSignature` |
| `peakConcurrentOutlets` | `demandPreset.simultaneousUseSeverity` | `resolveTimingOverrides` |
| `heatLossWatts` | `fullSurvey.heatLoss.estimatedPeakHeatLossW` | direct assignment |
| `roofOrientation` | `fullSurvey.heatLoss.roofOrientation` | orientation map |
| `roofType` | `fullSurvey.heatLoss.roofType` | roof type map |
| `solarShading` | `fullSurvey.heatLoss.shadingLevel` | shading map |
| `pvStatus` | `fullSurvey.heatLoss.pvStatus` | direct assignment |
| `batteryStatus` | `fullSurvey.heatLoss.batteryStatus` | direct assignment |
| `currentSystem.boiler.*` | flat survey fields | bridge in sanitiser |
| `boilerConditionBand` | boiler age, condensing, symptoms | `inferBoilerCondition` |
| `plateHexFoulingFactor` | `fullSurvey.dhwCondition` + water hardness | `inferPlateHexCondition` |
| `plateHexConditionBand` | alongside `plateHexFoulingFactor` | `inferPlateHexCondition` |
| `cylinderInsulationFactor` | `fullSurvey.dhwCondition` | `inferCylinderCondition` |
| `cylinderCoilTransferFactor` | alongside `cylinderInsulationFactor` | `inferCylinderCondition` |
| `cylinderConditionBand` | alongside `cylinderInsulationFactor` | `inferCylinderCondition` |
| `hasSoftener` | `fullSurvey.dhwCondition.softenerPresent` | bridge in sanitiser |
| `currentCylinderPresent` | `fullSurvey.dhwCondition.currentCylinderPresent` | bridge in sanitiser |
| `cylinderVolumeLitres` | `fullSurvey.dhwCondition.currentCylinderVolumeLitres` | bridge in sanitiser |
| `cwsHeadMetres` | `fullSurvey.dhwCondition.currentCwsHeadMetres` | bridge in sanitiser |

---

## 5. Presentation Provenance

Every presentation page (deck slide) must declare:

```typescript
canonicalSource: {
  component: string;   // component code name, e.g. 'QuadrantDashboardPage'
  fields: string[];    // canonical field paths read, e.g. ['page1.house', 'page1.objectives']
}
```

In DEV builds, `DevProvenanceBadge` renders a `🔬` overlay per slide showing:
- Which fields are used
- Whether they are derived vs raw

This is enforced by `DeckPageDescriptor.canonicalSource` in `src/components/presentation/PresentationDeck.tsx`.

---

## 6. Runtime Contract Guard (DEV only)

`validateCanonicalContract(model)` in `src/dev/validateCanonicalContract.ts`:

- Called after `sanitiseModelForEngine` in DEV builds.
- Checks all required derived fields are present.
- Checks no critical fields are `undefined`.
- Checks no raw survey-only structures are leaking into the engine layer.
- On violation: `console.error` with the field path.

**Usage pattern (DEV gate only):**

```typescript
if (import.meta.env.DEV) {
  validateCanonicalContract(sanitisedModel);
}
```

---

## 7. Combi DHW Rules

These rules are enforced by the engine and must NOT be re-implemented in UI:

| Condition | Outcome |
|-----------|---------|
| `occupancyCount === 3` | `warn` (borderline demand) |
| `occupancyCount <= 2` | `pass` (no simultaneous risk from occupancy alone) |
| `bathroomCount >= 2` OR `peakConcurrentOutlets >= 2` | `fail` (hard simultaneous-demand gate) |

---

## 8. Efficiency Rules

- `computeCurrentEfficiencyPct` must be used everywhere to clamp boiler efficiency between 50% and 99%.
- Never write the literal `92` for nominal efficiency — import `DEFAULT_NOMINAL_EFFICIENCY_PCT` from `src/engine/utils/efficiency.ts`.

---

## 9. Wall Type Rules

- `cavity_uninsulated` must always be treated as a **high heat-loss** band (same score as `solid_masonry`).
- Wall type (heat loss) and thermal mass (inertia / τ) are **independent physics dimensions** — never conflate them.

---

## 10. Contract Version Stamp

The sanitised model carries an implicit contract version via the engine constants:

```typescript
// src/contracts/versions.ts
export const CONTRACT_VERSION = '2.3';
export const ENGINE_INPUT_CONTRACT_VERSION = '2.3';
```

Presentation components should verify they are consuming the expected version by checking `engineMeta.contractVersion` in the engine output when available.

---

## 11. Forbidden Patterns

The following patterns are contract violations. PRs introducing them must be rejected:

```typescript
// ❌ Forbidden: raw draft in engine or presentation
function buildPresentation(draft: SurveyDraftInput) { ... }

// ❌ Forbidden: re-deriving occupancy in a component
const occupancyCount = composition.adultCount + composition.childCount5to10;

// ❌ Forbidden: bypassing sanitiser
const engineInput = model as unknown as EngineInputV2_3;

// ❌ Forbidden: Math.random() in engine or presentation
const jitter = Math.random() * 0.1;

// ❌ Forbidden: literal nominal efficiency
const efficiency = 92;

// ✅ Correct: go through sanitiser
const sanitised = sanitiseModelForEngine(model);
const engineInput = sanitised; // FullSurveyModelV1 IS the engine input

// ✅ Correct: import the constant
import { DEFAULT_NOMINAL_EFFICIENCY_PCT } from 'src/engine/utils/efficiency';
```

---

## 12. Adding New Fields — Checklist

When adding a new field to the data model:

- [ ] Add the field to `FullSurveyModelV1` (if survey-captured) or as a derived field.
- [ ] Add derivation/bridging logic to `sanitiseModelForEngine`.
- [ ] Add the field to §3 (Field Ownership Map) in this document.
- [ ] If derived, add it to §4 (Derived Fields list).
- [ ] Add `canonicalSource.fields` entry to the relevant deck slide.
- [ ] Add a check to `validateCanonicalContract` if it is critical for correctness.
- [ ] Update `docs/schema-and-contract-reference.md` with the new field's schema detail.
