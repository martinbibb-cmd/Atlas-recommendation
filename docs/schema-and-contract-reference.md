# Atlas Schema and Contract Reference

**Version:** `v2.3`  
**Engine version:** `0.2.0`  
**Status:** Authoritative technical reference — supplements `docs/atlas-canonical-contract.md`.

All AI coders must read `docs/atlas-canonical-contract.md` before writing engine, contract, or presentation code. This document provides the detailed schema for engine input and output types.

---

## 1. Version Constants

```typescript
// src/contracts/versions.ts
ENGINE_VERSION             = '0.2.0'
CONTRACT_VERSION           = '2.3'
ENGINE_INPUT_CONTRACT_VERSION = '2.3'
ASSUMPTION_VERSION         = '2026.02'
```

---

## 2. Engine Input Schema (`EngineInputV2_3`)

**Source file:** `src/engine/schema/EngineInputV2_3.ts`  
**Contract type:** `src/contracts/EngineInputV2_3.ts` (`EngineInputV2_3Contract`)

All fields below are on `FullSurveyModelV1`, which is used directly as the engine input. Fields marked **required** have no default and must always be present.

### 2.1 Required fields (no defaults)

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `postcode` | `string` | — | Used for water hardness and gas zone lookup |
| `dynamicMainsPressure` | `number` | bar | Legacy field — always required for backward compatibility |
| `buildingMass` | `'light' \| 'medium' \| 'heavy'` | — | Thermal mass of the building fabric |
| `primaryPipeDiameter` | `number` | mm | Type-narrowed to `15 \| 22 \| 28 \| 35`; EngineInputV3 drops 35 |
| `heatLossWatts` | `number` | **W** (Watts, not kW) ⚠️ | Peak heat loss. `fullSurvey.heatLoss.estimatedPeakHeatLossW` always wins over the root field when present; otherwise the root value is used as-is. Derived/bridged by sanitiser. |
| `radiatorCount` | `number` | — | Total emitter count |
| `hasLoftConversion` | `boolean` | — | Affects loft heat loss and headroom |
| `returnWaterTemp` | `number` | °C | Mean water temperature return |
| `bathroomCount` | `number` | — | Total wet rooms (bathrooms + en-suites) |
| `occupancySignature` | `OccupancySignature` | — | Derived from `demandPreset`; see §2.3 |
| `highOccupancy` | `boolean` | — | Flag for high simultaneous demand scenarios |
| `preferCombi` | `boolean` | — | Surveyor judgement override |

### 2.2 Optional building / solar fields

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `houseFrontFacing` | `'north' \| 'east' \| 'south' \| 'west'` | — | Front facade direction |
| `roofType` | `'pitched' \| 'flat' \| 'mixed' \| 'unknown'` | — | **Derived** from `fullSurvey.heatLoss.roofType` |
| `roofOrientation` | `'north' \| 'east' \| 'south' \| 'west' \| 'south_east' \| 'south_west' \| 'mixed' \| 'unknown'` | — | **Derived** from `fullSurvey.heatLoss.roofOrientation` |
| `solarShading` | `'low' \| 'medium' \| 'high' \| 'unknown'` | — | **Derived** from `fullSurvey.heatLoss.shadingLevel` |
| `pvStatus` | `'none' \| 'existing' \| 'planned'` | — | **Derived** from `fullSurvey.heatLoss.pvStatus` |
| `batteryStatus` | `'none' \| 'existing' \| 'planned'` | — | **Derived** from `fullSurvey.heatLoss.batteryStatus` |
| `building.fabric.wallType` | `FabricWallType` | — | Used by FabricModelModule |
| `building.fabric.insulationLevel` | `FabricInsulationLevel` | — | Used by FabricModelModule |
| `building.fabric.glazing` | `FabricGlazing` | — | Used by FabricModelModule |
| `building.fabric.roofInsulation` | `FabricRoofInsulation` | — | Used by FabricModelModule |
| `building.fabric.airTightness` | `FabricAirTightness` | — | Used by FabricModelModule |
| `building.thermalMass` | `FabricThermalMass` | — | Independent from wallType heat-loss band |

### 2.3 Occupancy / demand fields

| Field | Type | Derived? | Notes |
|-------|------|----------|-------|
| `occupancyCount` | `number?` | **Yes** | Derived from `householdComposition` |
| `demandPreset` | `DemandPresetId?` | **Yes** | Derived from `householdComposition`; unless `demandPresetIsManualOverride` |
| `demandPresetIsManualOverride` | `boolean?` | No | When `true`, prevents automatic preset override |
| `occupancySignature` | `OccupancySignature` | **Yes** | Derived via `presetToEngineSignature(demandPreset)` |
| `peakConcurrentOutlets` | `number?` | **Yes** | Inferred from `demandPreset.simultaneousUseSeverity` |
| `householdComposition` | `HouseholdComposition?` | No | Source of truth for occupancy derivation |
| `demandTimingOverrides` | `DemandTimingOverrides?` | No | Manual timing overrides (e.g. bath frequency) |
| `highOccupancy` | `boolean` | No | Survey-captured |
| `bedrooms` | `number?` | No | Optional bedroom count |

`OccupancySignature` values: `'professional' | 'steady_home' | 'shift_worker' | 'steady' | 'shift'`

### 2.4 Mains / services fields

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| `staticMainsPressureBar` | `number?` | bar | Clamped to ≤10 bar by sanitiser |
| `dynamicMainsPressureBar` | `number?` | bar | Corrected if > static |
| `mainsDynamicFlowLpm` | `number?` | L/min | Clamped to ≤60 L/min |
| `mains.staticPressureBar` | `number?` | bar | Preferred nested form; propagated to flat fields |
| `mains.dynamicPressureBar` | `number?` | bar | Preferred nested form |
| `mains.flowRateLpm` | `number?` | L/min | Preferred nested form |
| `coldWaterSource` | `'unknown' \| 'mains_true' \| 'mains_shared' \| 'loft_tank'` | — | CWS supply type |
| `dhwDeliveryMode` | see schema | — | Delivery mode for DHW |

### 2.5 DHW / cylinder fields

| Field | Type | Derived? | Notes |
|-------|------|----------|-------|
| `dhwStorageType` | `'none' \| 'vented' \| 'unvented' \| 'mixergy' \| 'thermal_store' \| 'heat_pump_cylinder'` | No | Storage architecture |
| `currentCylinderPresent` | `boolean?` | **Yes** | Bridged from `fullSurvey.dhwCondition` |
| `cylinderVolumeLitres` | `number?` | **Yes** | Bridged from `fullSurvey.dhwCondition.currentCylinderVolumeLitres` |
| `cwsHeadMetres` | `number?` | **Yes** | Bridged from `fullSurvey.dhwCondition.currentCwsHeadMetres` |
| `plateHexFoulingFactor` | `number?` | **Yes** | `inferPlateHexCondition` — combi path only |
| `plateHexConditionBand` | string? | **Yes** | Alongside `plateHexFoulingFactor` |
| `cylinderInsulationFactor` | `number?` | **Yes** | `inferCylinderCondition` — stored path only |
| `cylinderCoilTransferFactor` | `number?` | **Yes** | Alongside `cylinderInsulationFactor` |
| `cylinderConditionBand` | string? | **Yes** | Alongside `cylinderInsulationFactor` |
| `hasSoftener` | `boolean?` | **Yes** | Bridged from `fullSurvey.dhwCondition.softenerPresent` |

### 2.6 Current system fields

| Field | Type | Derived? | Notes |
|-------|------|----------|-------|
| `currentHeatSourceType` | `'combi' \| 'system' \| 'regular' \| 'ashp' \| 'other'` | No | Survey-captured |
| `currentBoilerAgeYears` | `number?` | No | Clamped to ≤50 years by sanitiser |
| `currentBoilerOutputKw` | `number?` | No | kW nameplate rating |
| `makeModelText` | `string?` | No | Free-text boiler make/model |
| `currentBoilerSedbukPct` | `number?` | No | SEDBUK override (if known) |
| `currentSystem.boiler.*` | nested object | **Yes** | Bridged from flat fields by sanitiser |
| `boilerConditionBand` | string? | **Yes** | `inferBoilerCondition(age, condensing, symptoms)` |

### 2.7 Expert assumptions / preferences

| Field | Type | Notes |
|-------|------|-------|
| `expertAssumptions` | `ExpertAssumptionsV1?` | Ranking only — does NOT affect physics |
| `preferences` | `UserPreferencesV1?` | Homeowner preferences — ranking only |
| `productConstraints` | `ProductConstraints?` | What the installer can offer |

### 2.8 Day profile (Day Painter)

| Field | Type | Notes |
|-------|------|-------|
| `dayProfile` | `DayProfileV1?` | Hive-style 24 h schedule — overrides legacy arrays |
| `dayProfile.heatingBands` | `HeatingBandV1[]` | Thermostat setpoints |
| `dayProfile.dhwHeatBands` | `DhwHeatBandV1[]` | Cylinder charge schedule |
| `dayProfile.dhwEvents` | `DhwEventV1[]` | Draw events (taps) |

---

## 3. Engine Output Schema (`EngineOutputV1`)

**Source file:** `src/contracts/EngineOutputV1.ts`

Key top-level types:

| Type | Description |
|------|-------------|
| `EngineMetaV1` | Engine + contract version, confidence, assumptions |
| `EligibilityItem` | Viability of each system option |
| `EvidenceItemV1` | Individual evidence items with field path and confidence |
| `RedFlagItem` | Safety / mandatory action flags (info / warn / fail) |
| `OptionCardV1` | Per-option recommendation card with planes, requirements, score |
| `AssumptionV1` | Applied assumptions with severity and improve-by suggestions |
| `ConfidenceV1` | Output confidence level with unknowns and unlock actions |

### 3.1 `EngineMetaV1`

```typescript
interface EngineMetaV1 {
  engineVersion: typeof ENGINE_VERSION;  // '0.2.0'
  contractVersion: typeof CONTRACT_VERSION;  // '2.3'
  confidence?: ConfidenceV1;
  assumptions?: AssumptionV1[];
}
```

### 3.2 `EvidenceItemV1` source values

| Value | Meaning |
|-------|---------|
| `'manual'` | Directly measured/entered by surveyor |
| `'assumed'` | Default assumption applied |
| `'placeholder'` | Awaiting real data |
| `'derived'` | Computed from other evidence |

---

## 4. Presentation Model

**Source file:** `src/components/presentation/buildCanonicalPresentation.ts`

`buildCanonicalPresentation(result, input, dhwContext?, prioritiesState?)` returns `CanonicalPresentationModel`.

Key signal types in the presentation model:

| Signal | Source fields | Description |
|--------|---------------|-------------|
| `HouseSignal` | `heatLossWatts`, `primaryPipeDiameter`, `roofOrientation`, `wallType`, `pvStatus` | Fabric, infrastructure, PV potential |
| `HomeSignal` | `occupancyCount`, `bathroomCount`, `demandPreset`, `peakConcurrentOutlets` | Demand profile, demographics |
| `EnergySignal` | `pvStatus`, `batteryStatus`, `solarShading` | PV / battery / solar alignment |
| `CurrentSystemSignal` | `currentHeatSourceType`, `currentBoilerAgeYears`, `boilerConditionBand` | Current boiler context |
| `ObjectivesSignal` | `expertAssumptions`, `preferences`, `prioritiesState` | Ranked objectives |

### 4.1 `wallTypeKey` normalisation

`HouseSignal.wallTypeKey` is normalised to `'solid_masonry' | 'cavity_insulated'`:
- `cavity_uninsulated` → `solid_masonry` (same high heat-loss band; no insulation benefit)
- All other uninsulated/solid walls → `solid_masonry`
- Insulated cavity → `cavity_insulated`

This is a **presentation normalisation only** — the engine receives the raw `wallType` enum.

---

## 5. Units Reference

| Quantity | Unit | Field examples |
|----------|------|----------------|
| Heat loss | **W** (Watts) | `heatLossWatts` |
| Heat output / power | **kW** | `currentBoilerOutputKw`, engine kW outputs |
| Pressure (static) | **bar** | `staticMainsPressureBar` |
| Pressure (dynamic) | **bar** | `dynamicMainsPressureBar` |
| Flow rate | **L/min** | `mainsDynamicFlowLpm` |
| Temperature | **°C** | `returnWaterTemp`, `coldWaterTempC` |
| Pipe diameter | **mm** | `primaryPipeDiameter` |
| CWS head | **m** | `cwsHeadMetres` |
| Cylinder volume | **litres** | `cylinderVolumeLitres` |
| Boiler age | **years** | `currentBoilerAgeYears` |
| Efficiency | **%** | `currentBoilerSedbukPct`, `computeCurrentEfficiencyPct` |

**Critical:** `heatLossWatts` is always in **Watts**, never kW. Do not multiply or divide by 1000 unless explicitly converting for display. This is the most common unit-confusion bug in this codebase — treat every use of this field with care.

---

## 6. Related Documents

- `docs/atlas-canonical-contract.md` — canonical pipeline rules, field ownership map, AI coder rules
- `docs/atlas-terminology.md` — controlled vocabulary for all user-facing text
- `src/contracts/EngineInputV2_3.ts` — contract interface (`EngineInputV2_3Contract`)
- `src/contracts/EngineOutputV1.ts` — output contract types
- `src/engine/schema/EngineInputV2_3.ts` — full engine input type (`EngineInputV2_3`)
- `src/ui/fullSurvey/sanitiseModelForEngine.ts` — the single derivation authority
- `src/dev/validateCanonicalContract.ts` — DEV-only runtime contract guard
