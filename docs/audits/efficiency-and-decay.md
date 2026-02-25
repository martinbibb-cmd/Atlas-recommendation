# Efficiency & Decay Audit

**Status:** completed 2026-02-25
**Scope:** all "efficiency / eta / decay" computations in the engine + UI layers.

## Background

Efficiency baseline and post-decay clamp logic was duplicated inline in two places
(`TimelineBuilder.ts` and `FullSurveyStepper.tsx`), with two independent `?? 92`
fallback points and a `Math.max(50, ...)` that could exceed 99 under future uplift
modelling (negative decay).  All values are in percentage points (e.g. 84, not 0.84).

`clampPct(nominal - decay)` replaces `Math.max(50, nominal - decay)` everywhere,
enforcing both floor (50) and ceiling (99) even when decay is negative (uplift).

---

## 1. Efficiency computation table

| Location | Function / variable | Inputs used | Output meaning | Engine-derived? | Action |
|---|---|---|---|---|---|
| `src/engine/utils/efficiency.ts` | `clampPct` | `n`, `min`, `max` | Clamps a percentage to [50, 99] by default | ✅ pure helper | **keep** |
| `src/engine/utils/efficiency.ts` | `resolveNominalEfficiencyPct` | `inputSedbuk?: number` | Nominal SEDBUK % with 92 fallback + clamp | ✅ single source of truth | **keep** |
| `src/engine/utils/efficiency.ts` | `computeCurrentEfficiencyPct` | `nominalPct`, `decayPct` | Post-decay efficiency % clamped to [50, 99] | ✅ pure helper | **keep** |
| `src/engine/normalizer/Normalizer.ts` | `tenYearEfficiencyDecayPct` | `postcode` (CaCO₃ / silica), `systemAgeYears`, `pipingTopology` | Expected 10-year efficiency loss % from scale accumulation | ✅ engine contract inputs only | **keep** |
| `src/engine/TimelineBuilder.ts` | `nominalEfficiencyPct` | `input.currentBoilerSedbukPct` → `resolveNominalEfficiencyPct` | Nominal SEDBUK % used for combi eta baseline | ✅ engine-derived via helper | **keep** |
| `src/engine/TimelineBuilder.ts` | `combiEtaPct` | `nominalEfficiencyPct`, `core.normalizer.tenYearEfficiencyDecayPct` → `computeCurrentEfficiencyPct` | Post-decay combi efficiency % | ✅ engine-derived via helper | **keep** |
| `src/components/stepper/FullSurveyStepper.tsx` | `nominalEfficiencyPct` | `input.currentBoilerSedbukPct` → `resolveNominalEfficiencyPct` | Nominal SEDBUK % forwarded to `InteractiveTwin` | ✅ passes engine value through | **keep** |
| `src/components/stepper/FullSurveyStepper.tsx` | `currentEfficiencyPct` | `nominalEfficiencyPct`, `normalizer.tenYearEfficiencyDecayPct` → `computeCurrentEfficiencyPct` | Post-decay efficiency % forwarded to `InteractiveTwin` | ✅ passes engine value through | **keep** |
| `src/components/visualizers/SystemFlushSlider.tsx` | `nominalEfficiencyPct` (prop) | Passed in by caller | Upper bound for flush recovery calculation | ✅ required prop (no internal default) | **keep** |
| `src/components/visualizers/EfficiencyCurve.tsx` | — | Various props | Visual rendering only | N/A (display) | review separately |
| `src/components/InteractiveTwin.tsx` | `nominalEfficiencyPct` (prop) | Passed down from `FullSurveyStepper` | Forwarded to `SystemFlushSlider` | ✅ required prop | **keep** |

---

## 2. `tenYearEfficiencyDecayPct` — contract purity verification

`tenYearEfficiencyDecayPct` is computed exclusively in
`src/engine/normalizer/Normalizer.ts` from the following **EngineInputV2_3 contract fields**:

| Field | Role |
|---|---|
| `postcode` | Resolves CaCO₃ hardness level and high-silica flag from regional table |
| `radiatorCount` | System volume proxy (10 L per radiator) |
| `heatLossWatts` | Fallback system volume proxy when radiatorCount is 0 |
| `systemAgeYears` | Sludge potential scaling |
| `pipingTopology` | Legacy topology flag (one_pipe / microbore reach full sludge potential sooner) |

**No UI-only fields influence `tenYearEfficiencyDecayPct`.**
All inputs are versioned `EngineInputV2_3` contract fields. ✅

---

## 3. Timeline event contract purity

DHW events that drive the 24-hour timeline originate from two paths:

| Path | Inputs | Contract-bound? |
|---|---|---|
| Default events (`DEFAULT_EVENTS`) | Hardcoded typical-UK pattern (no inputs) | ✅ deterministic |
| `generateDhwEventsFromProfile` | `lifestyleProfileV1` (morning/evening peaks, bath, dishwasher, washing machine) | ✅ `lifestyleProfileV1` is an `EngineInputV2_3` field |

Space-heating demand is derived from `core.lifestyle.hourlyData` (LifestyleSimulationModule output),
which is itself driven by `EngineInputV2_3` contract inputs (occupancy, heat loss, building mass).

**No UI-only fields drive timeline events or demand.** ✅

### Minimum contract fields for physics-led graphs (already present)

| Input | Field |
|---|---|
| Hot water draw pattern | `lifestyleProfileV1.morningPeakEnabled`, `eveningPeakEnabled`, `hasBath` |
| Cold-fill appliances | `lifestyleProfileV1.hasDishwasher`, `hasWashingMachine` |
| Heating usage | `heatLossWatts`, `occupancySignature`, `buildingMass` |
| Cylinder vs combi | `currentHeatSourceType`, `dhwTankType` |
| Boiler modulation | SEDBUK tail-off series from `BoilerEfficiencyModelV1` (engine-internal) |

---

## 4. Cosmetic knobs identified and resolved

| Location | Issue | Resolution |
|---|---|---|
| `TimelineBuilder.ts` (old) | Inline `Math.min(99, Math.max(50, ?? 92))` — two fallback points | Replaced with `resolveNominalEfficiencyPct` |
| `FullSurveyStepper.tsx` (old) | Inline `Math.min(99, Math.max(50, ?? 92))` — duplicate fallback | Replaced with `resolveNominalEfficiencyPct` |
| `TimelineBuilder.ts` (old) | `Math.max(50, nominal - decay)` — did not clamp ceiling for uplift | Replaced with `computeCurrentEfficiencyPct` (uses `clampPct`) |
| `FullSurveyStepper.tsx` (old) | `Math.max(50, nominal - decay)` — same issue | Replaced with `computeCurrentEfficiencyPct` |

No arbitrary smoothing or scaling factors found in chart builder code that bypass engine values.

---

## 5. Physics integrity test requirement

A test asserting **relative behaviour** (not just exact values) should be added to verify
combi vs. stored system efficiency separation under spiky DHW conditions.

Example assertion (to be implemented in `TimelineBuilder.test.ts`):
> Given the same efficiency baseline and decay,
> during a high-intensity bath event, the combi series efficiency at that timestep
> is lower than the stored system series efficiency at the same timestep
> — because combi systems suffer a DHW cycling/simultaneous-draw penalty that
> stored systems do not.

This is partially covered by the existing `combi series efficiency values represent η (≤ 1)` tests,
but a dedicated cross-series comparison test would complete the contract.
