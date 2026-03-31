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
| `pvStatus` | `'none' \| 'existing' \| 'planned'` | — | **Derived** from `fullSurvey.heatLoss.pvStatus`. Forced to `'none'` for flat dwelling types (no independent roof access). |
| `batteryStatus` | `'none' \| 'existing' \| 'planned'` | — | **Derived** from `fullSurvey.heatLoss.batteryStatus`. Forced to `'none'` for flat dwelling types. |
| `dwellingType` | `'detached' \| 'semi' \| 'end_terrace' \| 'mid_terrace' \| 'flat_ground' \| 'flat_mid' \| 'flat_penthouse'` | — | **Derived** from `fullSurvey.heatLoss.shellModel.settings.dwellingType`. Absent when the heat-loss step has not been completed. |
| `perimeterM` | `number?` | **m** | **Derived** from closed shell polygon via `sanitiseModelForEngine`. Stored in `fullSurvey.heatLoss.perimeterM`. |
| `groundFloorAreaM2` | `number?` | **m²** | **Derived** from closed shell polygon (shoelace formula). Stored in `fullSurvey.heatLoss.groundFloorAreaM2`. |
| `buildingBearingDeg` | `number?` | **degrees** | Clockwise from north (0 = N, 90 = E). Captured via compass control; stored in `fullSurvey.heatLoss.buildingBearingDeg`. Distinct from `roofOrientation`. |
| `building.fabric.wallType` | `FabricWallType` | — | Used by FabricModelModule |
| `building.fabric.insulationLevel` | `FabricInsulationLevel` | — | Used by FabricModelModule |
| `building.fabric.glazing` | `FabricGlazing` | — | Used by FabricModelModule |
| `building.fabric.roofInsulation` | `FabricRoofInsulation` | — | Used by FabricModelModule |
| `building.fabric.airTightness` | `FabricAirTightness` | — | Used by FabricModelModule |
| `building.thermalMass` | `FabricThermalMass` | — | Independent from wallType heat-loss band |

### 2.2a Shell / heat-loss calculator settings (`ShellSettings`)

`ShellSettings` is persisted in `fullSurvey.heatLoss.shellModel.settings`. These are UI-layer inputs consumed by the canvas-based `HeatLossCalculator` tool; they are not passed directly to the engine.

| Field | Type | Notes |
|-------|------|-------|
| `storeys` | `number` | Number of occupied storeys (1–5) |
| `ceilingHeight` | `number` | Floor-to-ceiling height in metres |
| `dwellingType` | see below | Building form — determines default party-wall assignment and floor/ceiling exposures |
| `wallType` | `string` | Wall construction key (maps to `U_WALL` table in `HeatLossCalculator.tsx`) |
| `loftInsulation` | `string` | Ceiling/roof insulation key — `'neighbourHeated'` for inter-flat ceilings |
| `glazingType` | `string` | Glazing U-value key |
| `glazingAmount` | `string` | Glazing fraction key (`'low' \| 'medium' \| 'high'`) |
| `floorType` | `string` | Floor construction key — `'neighbourHeated'` for inter-flat floors |
| `thermalMass` | `'light' \| 'medium' \| 'heavy'` | Used for thermal inertia τ calculation |

#### `dwellingType` values

| Value | Description | Default party walls | Default ceiling | Default floor |
|-------|-------------|---------------------|-----------------|---------------|
| `'detached'` | Detached house | 0 | Exposed roof | Exposed ground |
| `'semi'` | Semi-detached house | 1 (longest wall) | Exposed roof | Exposed ground |
| `'endTerrace'` | End-terrace house | 1 (longest wall) | Exposed roof | Exposed ground |
| `'midTerrace'` | Mid-terrace house | 2 (two longest walls) | Exposed roof | Exposed ground |
| `'flatGround'` | Flat — ground floor | 1 (longest wall) | `neighbourHeated` (flat above) | Exposed ground |
| `'flatMid'` | Flat — mid floor | 2 (two longest walls) | `neighbourHeated` (flat above) | `neighbourHeated` (flat below) |
| `'flatPenthouse'` | Flat — top floor / penthouse | 1 (longest wall) | Exposed roof | `neighbourHeated` (flat below) |

**Neighbour U-values:** `loftInsulation = 'neighbourHeated'` and `floorType = 'neighbourHeated'` both use U = 0.10 W/m²K. This value accounts for the combined effect of the interflat element's actual U-value and the much-reduced temperature difference to a heated neighbouring flat (≈ 3 °C effective ΔT rather than 20 °C design ΔT to outside).

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
| `CurrentSystemSignal` | `currentHeatSourceType`, `currentBoilerAgeYears`, `boilerConditionBand`, `currentSystem.*` | Full system architecture — type, age, emitters, controls, pipework, SEDBUK band, service history, circuit type, condition signals |
| `ObjectivesSignal` | `expertAssumptions`, `preferences`, `prioritiesState` | Ranked objectives |

### 4.1 `CurrentSystemSignal` — full system architecture fields

`CurrentSystemSignal` now exposes all information collected in the System Architecture step of the canonical stepper. Every field is null/empty when the corresponding data was not captured (callers must hide labels rather than showing "not recorded" placeholders):

| Field | Source | Description |
|-------|--------|-------------|
| `systemTypeLabel` | `currentHeatSourceType` | Human-readable heat source type |
| `ageLabel` | `currentBoilerAgeYears` / `currentSystem.boiler.ageYears` | Age in years |
| `ageContext` | Derived from age + type | Lifespan context sentence |
| `makeModelText` | `makeModelText` | Make / model string |
| `outputLabel` | `currentBoilerOutputKw` | Rated output in kW |
| `emittersLabel` | `currentSystem.emittersType` or `emitterType` | Emitter type (radiators / UFH / mixed) |
| `pipeLayoutLabel` | `currentSystem.pipeLayout` or `pipingTopology` | Primary pipework layout |
| `controlFamilyLabel` | `currentSystem.controlFamily` or `systemPlanType` | Control arrangement (Y-plan, S-plan, etc.) |
| `thermostatStyleLabel` | `currentSystem.thermostatStyle` | Thermostat type |
| `programmerTypeLabel` | `currentSystem.programmerType` | Programmer / scheduling device type |
| `sedbukBandLabel` | `currentSystem.sedbukBand` | ErP/SEDBUK efficiency band (A–G) |
| `serviceHistoryLabel` | `currentSystem.serviceHistory` | Service regularity |
| `heatingSystemTypeLabel` | `currentSystem.heatingSystemType` | Circuit type — open-vented vs sealed (regular boilers) |
| `pipeworkAccessLabel` | `currentSystem.pipeworkAccess` | Pipework accessibility (regular boilers) |
| `conditionSignalPills` | `currentSystem.conditionSignals.*` | Site-observed condition signals as status pills |

### 4.2 System architecture → engine input bridge

`sanitiseModelForEngine` bridges all `fullSurvey.systemBuilder` fields into `EngineInputV2_3`. Existing explicit values on the engine input are never overwritten. The bridge maps:

- `systemBuilder.heatSource` → `currentHeatSourceType`
- `systemBuilder.boilerAgeYears` → `currentBoilerAgeYears` + `systemAgeYears` (condition inference)
- `systemBuilder.emitters` → `emitterType` (flat) + `currentSystem.emittersType` (detailed)
- `systemBuilder.layout` → `pipingTopology` (flat) + `currentSystem.pipeLayout` (detailed)
- `systemBuilder.controlFamily` → `systemPlanType` (flat, where mappable) + `currentSystem.controlFamily` (full)
- `systemBuilder.primarySize` → `primaryPipeDiameter`
- `systemBuilder.magneticFilter` → `hasMagneticFilter`
- `systemBuilder.dhwType` → `dhwStorageType`
- All other system builder fields → `currentSystem.*` (thermostatStyle, programmerType, sedbukBand, serviceHistory, heatingSystemType, pipeworkAccess, conditionSignals)

### 4.3 `wallTypeKey` normalisation

`HouseSignal.wallTypeKey` is normalised to `'solid_masonry' | 'cavity_insulated'`:
- `cavity_uninsulated` → `solid_masonry` (same high heat-loss band; no insulation benefit)
- All other uninsulated/solid walls → `solid_masonry`
- Insulated cavity → `cavity_insulated`

This is a **presentation normalisation only** — the engine receives the raw `wallType` enum.

### 4.4 System condition and system age

`inferSystemConditionFlags` (SystemConditionInferenceModule) factors system age via the `systemAgeYears` input field in:

- **Sludge risk**: age ≥20 yr → proxy score 3 (high); age ≥10 yr → proxy score 1 (moderate). Used as fallback when no direct symptoms observed.
- **Scale risk**: hard water + age ≥15 yr → elevated to `high`; moderate water + age ≥20 yr → elevated to `moderate`.
- **Plate HEX condition**: `systemAgeYears` used as proxy when no explicit `plateHexAgeYears` is recorded.

`systemAgeYears` is always wired from `currentBoilerAgeYears` in `sanitiseModelForEngine` when not explicitly set, so that real survey age data always reaches the inference layer.

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
| Perimeter | **m** | `perimeterM` |
| Floor area | **m²** | `groundFloorAreaM2` |
| Building bearing | **degrees** (clockwise from north) | `buildingBearingDeg`, `FloorPlan.compassBearingDeg` |

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
