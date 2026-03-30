# Atlas Schema & Contract Reference

> **⚠ ALL AI CODERS: Read this document before writing any engine, contract, or logic code.**
>
> This document is the single source of truth for input/output schema definitions, field naming
> conventions, version differences, and the boundaries between architectural layers.
> Violating the rules below introduces silent runtime errors and recommendation failures.

---

## Table of Contents

1. [Architectural Layers](#1-architectural-layers)
2. [Engine Input Schema — EngineInputV2_3](#2-engine-input-schema--engineinputv2_3)
3. [Engine Input Schema — EngineInputV3 (narrowed)](#3-engine-input-schema--engineinputv3-narrowed)
4. [Engine Output Contract — EngineOutputV1](#4-engine-output-contract--engineoutputv1)
5. [Critical Field Name & Unit Reference](#5-critical-field-name--unit-reference)
6. [Occupancy Signature Reference](#6-occupancy-signature-reference)
7. [Version Differences V2_3 → V3](#7-version-differences-v2_3--v3)
8. [Logic Layer Types (OutcomeSystemSpec)](#8-logic-layer-types-outcomesystemspec)
9. [Combi DHW Rules](#9-combi-dhw-rules)
10. [Efficiency Contract Rules](#10-efficiency-contract-rules)
11. [Wall-Type and Thermal-Mass Rules](#11-wall-type-and-thermal-mass-rules)
12. [Resolved Breaches Log](#12-resolved-breaches-log)

---

## 1. Architectural Layers

The codebase is split into four distinct layers. **Never mix field names or structures between layers.**

```
┌──────────────────────────────────────────────────────────────────────┐
│  CONTRACT LAYER                                                       │
│  src/contracts/EngineInputV2_3.ts   — EngineInputV2_3Contract        │
│  src/contracts/EngineOutputV1.ts    — EngineOutputV1 (output type)   │
│  Audience: external callers and documentation consumers.             │
│  Rule: field names MUST match the Engine Schema 1-to-1 (flat).       │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  same flat field names
┌──────────────────────────▼───────────────────────────────────────────┐
│  ENGINE SCHEMA LAYER                                                  │
│  src/engine/schema/EngineInputV2_3.ts  — EngineInputV2_3             │
│  src/engine/schema/EngineInputV3.ts    — EngineInputV3 (extends V2_3)│
│  Audience: engine modules, builders, normalizer.                     │
│  Rule: this is the ground truth; contract must mirror it.            │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  normalizer reads engine schema fields
┌──────────────────────────▼───────────────────────────────────────────┐
│  ENGINE PHYSICS LAYER                                                 │
│  src/engine/ (modules, runners, builders)                            │
│  Audience: internal only.                                            │
│  Rule: read only from EngineInputV2_3 / EngineInputV3.               │
└──────────────────────────┬───────────────────────────────────────────┘
                           │  separate, independent type system
┌──────────────────────────▼───────────────────────────────────────────┐
│  LOGIC LAYER                                                          │
│  src/logic/ (outcomes, upgrades, resimulation, fit-map)              │
│  Types: OutcomeSystemSpec, FitInputs, UpgradeInputs                  │
│  Rule: uses `primaryPipeSizeMm` — DIFFERENT from engine `primaryPipeDiameter`. │
│  Rule: heat loss NOT expressed in this layer (post-engine only).     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Engine Input Schema — EngineInputV2_3

**File:** `src/engine/schema/EngineInputV2_3.ts`
**Interface:** `EngineInputV2_3`

This is the **ground truth** for all engine callers. The contract layer mirrors this.

### Core required fields

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `postcode` | `string` | — | UK postcode; drives hardness-zone lookup |
| `dynamicMainsPressure` | `number` | bar | Legacy required field; prefer `mains.dynamicPressureBar` |
| `buildingMass` | `'light' \| 'medium' \| 'heavy'` | — | Thermal inertia class |
| `primaryPipeDiameter` | `15 \| 22 \| 28 \| 35` | mm | **Type-narrowed since the breach fix.** See §5. |
| `heatLossWatts` | `number` | **W** | Peak fabric heat loss in **watts**. See §5. |
| `radiatorCount` | `number` | count | Used for system-volume estimate |
| `hasLoftConversion` | `boolean` | — | Affects pipework adequacy |
| `returnWaterTemp` | `number` | °C | Design return temperature |
| `bathroomCount` | `number` | count | Simultaneous-demand gating |
| `occupancySignature` | `OccupancySignature` | — | See §6 |
| `highOccupancy` | `boolean` | — | Stored DHW sizing flag |
| `preferCombi` | `boolean` | — | User preference |

### Key optional fields

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `peakConcurrentOutlets` | `number \| undefined` | count | **Optional** — engine uses occupancy/bathroom heuristics when absent |
| `occupancyCount` | `number \| undefined` | count | Exact headcount for stored DHW sizing |
| `staticMainsPressureBar` | `number \| undefined` | bar | — |
| `dynamicMainsPressureBar` | `number \| undefined` | bar | Preferred over `dynamicMainsPressure` |
| `mainsDynamicFlowLpm` | `number \| undefined` | L/min | — |
| `mains` | `{ staticPressureBar?, dynamicPressureBar?, flowRateLpm? }` | — | Preferred nested object for new integrations |
| `coldWaterSource` | `'unknown' \| 'mains_true' \| 'mains_shared' \| 'loft_tank'` | — | Default: `'unknown'` |
| `dhwDeliveryMode` | see type | — | Standardised + legacy aliases accepted |
| `currentHeatSourceType` | `'combi' \| 'system' \| 'regular' \| 'ashp' \| 'other'` | — | Flat alias |
| `currentBoilerAgeYears` | `number \| undefined` | years | — |
| `currentBoilerSedbukPct` | `number \| undefined` | % | Valid range 50–99; fallback: `DEFAULT_NOMINAL_EFFICIENCY_PCT` (92) |
| `expertAssumptions` | `ExpertAssumptionsV1 \| undefined` | — | Ranking only; does not affect physics |
| `dayProfile` | `DayProfileV1 \| undefined` | — | Hive-style day painter input |
| `lifestyleProfileV1` | see type | — | Drives DHW event generation |
| `drawFrequency` | `'low' \| 'high'` | — | Optional in V2_3; **required in V3** |
| `pipingTopology` | `'two_pipe' \| 'one_pipe' \| 'microbore'` | — | Optional in V2_3; **required in V3** |
| `building.fabric.wallType` | `FabricWallType` | — | See §11 for wall-type rules |
| `building.thermalMass` | `FabricThermalMass` | — | Independent of heat loss — see §11 |

---

## 3. Engine Input Schema — EngineInputV3 (narrowed)

**File:** `src/engine/schema/EngineInputV3.ts`
**Interface:** `EngineInputV3 extends Omit<EngineInputV2_3, 'primaryPipeDiameter' | 'occupancySignature' | 'preferredMetallurgy'>`

V3 is a strict subset that narrows several fields and adds new required ones.

### Differences from V2_3

| Field | V2_3 | V3 | Notes |
|-------|------|----|-------|
| `primaryPipeDiameter` | `15 \| 22 \| 28 \| 35` | `15 \| 22 \| 28` | 35 mm **dropped** in V3 |
| `occupancySignature` | V2 + V3 aliases | `'professional' \| 'steady' \| 'shift'` | V3 simplified only |
| `pipingTopology` | optional | **required** | Must be explicit in V3 |
| `drawFrequency` | optional | **required** | `'low' \| 'high'` |
| `heatExchangerMaterial` | optional `'Al-Si' \| 'stainless_steel'` | **required** | Replaces `preferredMetallurgy` |

---

## 4. Engine Output Contract — EngineOutputV1

**File:** `src/contracts/EngineOutputV1.ts`

The output returned by the engine after a full run.

### Top-level shape

```typescript
EngineOutputV1 {
  meta: EngineMetaV1;             // Version, confidence, assumptions
  eligibility: EligibilityItem[]; // Per-system viable/rejected/caution
  options: OptionCardV1[];        // Full option cards with scores
  recommendation: RecommendationResultV1;
  evidence: EvidenceItemV1[];     // Provenance per key input
  timeline24h?: Timeline24hV1;    // 24-hour dual-system timeline
  redFlags: RedFlagItem[];
  // ... (see full type)
}
```

### OptionCardV1 IDs

Valid `id` values: `'combi' | 'stored_vented' | 'stored_unvented' | 'ashp' | 'regular_vented' | 'system_unvented'`

### EngineMetaV1 versions

Source: `src/contracts/versions.ts`

| Constant | Value |
|----------|-------|
| `ENGINE_VERSION` | `'0.2.0'` |
| `CONTRACT_VERSION` | `'2.3'` |
| `ENGINE_INPUT_CONTRACT_VERSION` | `'2.3'` |

---

## 5. Critical Field Name & Unit Reference

> **This is the most common source of contract breaches.** Memorise this table.

| Concept | Engine Schema field | Unit | Previous incorrect name | Notes |
|---------|---------------------|------|-------------------------|-------|
| Primary pipe bore | `primaryPipeDiameter` | mm, literal `15\|22\|28\|35` | `infrastructure.primaryPipeSizeMm` or `pipeSize` | Logic layer uses `primaryPipeSizeMm` — different layer, different type |
| Peak heat loss | `heatLossWatts` | **Watts** | `property.peakHeatLossKw` or `heatLossKw` | 8 kW = 8 000 — never divide or multiply inline; pass watts to engine |
| Occupancy pattern | `occupancySignature` | enum | `occupancy.signature` | See §6 for full value set |
| Peak outlets | `peakConcurrentOutlets` | count | — | **Optional** in engine; was incorrectly shown as required in old contract |
| Dynamic pressure | `dynamicMainsPressure` | bar | — | Legacy required; also available as `mains.dynamicPressureBar` |
| Nominal efficiency | `currentBoilerSedbukPct` | % (50–99) | never hardcode `92` | Import `DEFAULT_NOMINAL_EFFICIENCY_PCT` from `src/engine/utils/efficiency.ts` |

### Unit rule

`heatLossWatts` is always in **Watts**. The engine never reads kW for this field.
When displaying to the user divide by 1 000: `(heatLossWatts / 1000).toFixed(1) + ' kW'`.
Never pass a kW value into `heatLossWatts`.

### Type-narrowing rule

`primaryPipeDiameter` is `15 | 22 | 28 | 35` in V2_3. TypeScript will reject any `number` at the call site. Cast-free assignment requires using one of those four literals.

---

## 6. Occupancy Signature Reference

**Engine schema type:** `OccupancySignature` (in `src/engine/schema/EngineInputV2_3.ts`)

| Value | Meaning | V2 name | V3 name | Notes |
|-------|---------|---------|---------|-------|
| `'professional'` | Double-peak (07:00 & 18:00) | ✓ | ✓ | Favours combi |
| `'steady_home'` | Continuous low-level demand (WFH/retired) | ✓ V2 full | — | Favours ASHP |
| `'steady'` | Same as steady_home | — | ✓ V3 alias | Maps to `steady_home` behaviour |
| `'shift_worker'` | Irregular/offset demand | ✓ V2 full | — | Favours stored water |
| `'shift'` | Same as shift_worker | — | ✓ V3 alias | Maps to `shift_worker` behaviour |

**Rule:** Always use the V3 simplified names (`'professional'`, `'steady'`, `'shift'`) for new code.
The V2 full names (`'steady_home'`, `'shift_worker'`) are retained for backward compatibility only.

---

## 7. Version Differences V2_3 → V3

```
V2_3 (current production)          V3 (strict new integrations)
────────────────────────────────   ───────────────────────────────────
primaryPipeDiameter: number         primaryPipeDiameter: 15|22|28   ← 35mm dropped
occupancySignature: V2+V3 aliases   occupancySignature: V3 only
pipingTopology: optional            pipingTopology: required
drawFrequency: optional             drawFrequency: required
heatExchangerMaterial: optional     heatExchangerMaterial: required
preferredMetallurgy: present        preferredMetallurgy: OMITTED (Omit<>)
```

V3 is a strict subset — any valid V3 input is also valid V2_3 input.
When the engine receives V2_3 input, it normalises V3 aliases automatically.

---

## 8. Logic Layer Types (OutcomeSystemSpec)

**File:** `src/logic/outcomes/types.ts`
**Interface:** `OutcomeSystemSpec`

The logic layer is **completely separate** from the engine input schema.
It has its own field names for the same physical concepts:

| Logic field | Engine field | Type |
|-------------|-------------|------|
| `primaryPipeSizeMm` | `primaryPipeDiameter` | `15 \| 22 \| 28 \| 35` (same values) |
| `mainsDynamicPressureBar` | `dynamicMainsPressureBar` | `number` |
| `heatOutputKw` | (derived from engine output) | `number` |

**Never import `OutcomeSystemSpec` fields into engine code, and never import engine schema
types into logic-layer code.**

The fit map (`src/logic/fit-map/computeFitPosition.ts`) uses `FitInputs` with
`primaryPipeSizeMm` — this is a separate, logic-only type.

---

## 9. Combi DHW Rules

These rules are physics-derived and engine-enforced. They must not be overridden in UI copy.

| Condition | Result | Rationale |
|-----------|--------|-----------|
| `occupancyCount === 3` | `warn` | Borderline simultaneous demand |
| `occupancyCount <= 2` | `pass` | Single household; no concurrent risk from occupancy alone |
| `bathroomCount >= 2` | `fail` | Hard simultaneous-demand gate |
| `peakConcurrentOutlets >= 2` | `fail` | Hard simultaneous-demand gate |

**Rule:** Never display "instantaneous hot water" for combi boilers.
Use: "on-demand hot water" or "reaches temperature within seconds".
See `docs/atlas-terminology.md §8c` for the full combi ramp behaviour reference.

---

## 10. Efficiency Contract Rules

**File:** `src/engine/utils/efficiency.ts`

All efficiency values are in **percentage points** (e.g. 84, not 0.84).

| Function | Purpose | Rule |
|----------|---------|------|
| `resolveNominalEfficiencyPct(inputSedbuk?)` | SEDBUK baseline with fallback | Always use this; never write `?? 92` inline |
| `computeCurrentEfficiencyPct(nominal, decay)` | Post-decay clamp to [50, 99] | Always use this; never write `Math.max(50, ...)` inline |
| `clampPct(n, min?, max?)` | General clamp | Default bounds: 50–99 |
| `DEFAULT_NOMINAL_EFFICIENCY_PCT` | = 92 | **Never hardcode `92`** — import this constant |

**Breach rule:** Writing `?? 92` or `Math.max(50, ...)` inline is a contract breach.
The `computeCurrentEfficiencyPct` helper enforces the ceiling (99) as well as the floor (50),
which matters when decay is negative (efficiency uplift scenarios).

---

## 11. Wall-Type and Thermal-Mass Rules

These are two **independent physics dimensions** and must not be conflated.

### Heat-loss band (fabric heat loss)

Determined by: `building.fabric.wallType`, `insulationLevel`, `glazing`, `roofInsulation`, `airTightness`.

| Wall type | Heat-loss band |
|-----------|---------------|
| `cavity_insulated` | Low heat loss |
| `cavity_uninsulated` | **High heat loss** — same band as `solid_masonry` |
| `solid_masonry` | High heat loss |
| `timber_frame_insulated` | Low heat loss |

**Rule:** `cavity_uninsulated` must always be treated as high heat loss (same score as `solid_masonry`).
Never treat an uninsulated cavity wall as a low-loss wall.

### Thermal mass (inertia τ)

Determined by: `building.thermalMass` (`'light' | 'medium' | 'heavy'`).

A solid masonry building can have **heavy** thermal mass (high τ, slow temperature swing)
while also having **high heat loss**. These are separate axes. Never infer thermal mass
from wall type or heat-loss band.

---

## 12. Resolved Breaches Log

This section records schema/contract breaches that have been identified and fixed.
Any future PR that re-introduces a listed breach pattern must be rejected.

### BREACH-001 — `primaryPipeDiameter` was untyped `number`

| | Before | After |
|-|--------|-------|
| Field | `primaryPipeDiameter: number` | `primaryPipeDiameter: 15 \| 22 \| 28 \| 35` |
| File | `src/engine/schema/EngineInputV2_3.ts` | same |
| Risk | Engine could silently accept invalid pipe diameters (e.g. 20, 32) | TypeScript error at call site |
| Fixed | 2026-03-30 | — |

### BREACH-002 — `EngineInputV2_3Contract` used wrong field names and nested structure

| | Before | After |
|-|--------|-------|
| Field | `infrastructure.primaryPipeSizeMm` | `primaryPipeDiameter: 15 \| 22 \| 28 \| 35` |
| Field | `property.peakHeatLossKw` (kW) | `heatLossWatts` (W) |
| Field | `occupancy.signature` | `occupancySignature` |
| Field | `peakConcurrentOutlets: number` (required) | `peakConcurrentOutlets?: number` (optional) |
| File | `src/contracts/EngineInputV2_3.ts` | same |
| Risk | External callers following contract docs would use wrong field names and wrong units | Contract now mirrors engine schema exactly |
| Fixed | 2026-03-30 | — |

### BREACH-003 — V3 `PrimaryPipeDiameter` excluded 35 mm silently

| | Detail |
|-|--------|
| Context | `EngineInputV3.primaryPipeDiameter: 15 \| 22 \| 28` intentionally excludes 35 mm |
| V2_3 contract (old) | Included 35 mm (`15 \| 22 \| 28 \| 35`) but engine field was untyped `number` |
| Status | By design: V3 dropped 35 mm; V2_3 retains it. Now both are correctly type-narrowed. |
| Reference | `src/engine/schema/EngineInputV3.ts:16`, `src/contracts/EngineInputV2_3.ts` |

---

## Governance

This document must be updated whenever:
- A new engine input field is added or renamed
- A field type is narrowed or widened
- A new schema version is introduced
- A contract breach is identified and resolved

**Pull requests that introduce field names, types, or structures that contradict this document
must update this document first and justify the change.**

See also:
- `docs/atlas-terminology.md` — controlled vocabulary for all user-facing copy
- `docs/audits/efficiency-and-decay.md` — efficiency computation audit trail
- `src/config/surveyStepRegistry.ts` — canonical survey step registry
