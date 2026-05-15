# Atlas Simulator Surface Map

> **Canonical reference for all AI/code agents and contributors.**
>
> Before making changes to any simulator-related file, read this document in full.
> Target only the files listed under **ACTIVE_LIVE_SIMULATOR** or **ACTIVE_SHARED_COMPONENT**.
> Do **not** target **DEAD_PROTOTYPE** files unless explicitly asked.

---

## ⚠️ Important for Future AI / Code Agents

When asked to modify **the simulator**, target **only** the `ACTIVE_LIVE_SIMULATOR` files listed in
this document.

- **Do NOT** target `Day Painter`, `LifestyleInteractive`, `LifestyleInteractiveCompare`, or any
  file under `src/engine/daypainter/` or `src/components/daypainter/` for live simulator work.
- **Do NOT** target archived prototypes, unused demo routes, or dead experimental surfaces unless
  the request explicitly names them.
- The canonical simulator entry is **`ExplainersHubPage`** (`src/explainers/ExplainersHubPage.tsx`),
  which mounts **`SimulatorDashboard`** (`src/explainers/lego/simulator/SimulatorDashboard.tsx`).

---

## 1. Live Simulator Route

| Property | Value |
|---|---|
| **Journey key** | `'simulator'` (in `App.tsx` `Journey` union type) |
| **Route kind** | Internal journey state — no URL change |
| **Access path** | Post-survey → "Open Simulator" CTA; or `/?lab=1` query flag |
| **Entry component** | `ExplainersHubPage` (`src/explainers/ExplainersHubPage.tsx`) |
| **Mounted in `App.tsx`** | `journey === 'simulator'` block (line ~2110) |
| **Canonical name** | **Atlas Simulator** / **Live System Simulator** |

The `simulator` journey is reached from several places:

- `VisitPage.onOpenSimulator` → sets `journey = 'simulator'`
- `FullSurveyStepper` remote-survey path → sets `journey = 'simulator'`
- `VisitHomeDashboard` "Simulator" card → sets `journey = 'simulator'`
- `LiveHubPage` "Launch Simulator" CTA → sets `journey = 'simulator'` (via parent)

---

## 2. Live Simulator Entry Component Tree

```
App.tsx  (journey === 'simulator')
└── GlobalMenuShell
    └── ExplainersHubPage                      ← ACTIVE_LIVE_SIMULATOR (entry)
        └── SimulatorDashboard                 ← ACTIVE_LIVE_SIMULATOR (dashboard)
            ├── SimulatorPanel                 ← ACTIVE_SHARED_COMPONENT
            ├── ExpandedPanelModal             ← ACTIVE_SHARED_COMPONENT
            ├── CompareHalfPanel               ← ACTIVE_SHARED_COMPONENT
            ├── panels/
            │   ├── SystemDiagramPanel         ← ACTIVE_SHARED_COMPONENT
            │   ├── HouseStatusPanel           ← ACTIVE_SHARED_COMPONENT
            │   ├── DrawOffStatusPanel         ← ACTIVE_SHARED_COMPONENT
            │   ├── EfficiencyPanel            ← ACTIVE_SHARED_COMPONENT
            │   ├── LimitersPanel              ← ACTIVE_SHARED_COMPONENT
            │   ├── SystemInputsPanel          ← ACTIVE_SHARED_COMPONENT
            │   ├── ComparisonSummaryStrip     ← ACTIVE_SHARED_COMPONENT
            │   ├── DayTimelinePanel           ← ACTIVE_SHARED_COMPONENT
            │   ├── DailyEfficiencySummaryPanel ← ACTIVE_SHARED_COMPONENT
            │   └── StoredHotWaterReservePanel  ← ACTIVE_SHARED_COMPONENT
            └── BehaviourGraph                 ← ACTIVE_SHARED_COMPONENT
```

Additional simulator hooks (all `ACTIVE_SHARED_COMPONENT`):

```
src/explainers/lego/simulator/
  useBehaviourTimeline.ts
  useDailyEfficiencySummary.ts
  useDayTimeline.ts
  useDrawOffPlayback.ts
  useEfficiencyPlayback.ts
  useEmitterPrimaryModel.ts
  useHousePlayback.ts
  useLimiterPlayback.ts
  useStoredHotWaterPlayback.ts
  useSystemDiagramPlayback.ts
  SimulatorStepper.tsx
  adaptFullSurveyToSimulatorInputs.ts
  scenarioTypes.ts
  systemInputsTypes.ts
```

---

## 3. Per-File Classification

### Classification Key

| Code | Meaning |
|---|---|
| **ACTIVE_LIVE_SIMULATOR** | Real working simulator currently used in Atlas |
| **ACTIVE_SHARED_COMPONENT** | Shared UI / helper used by the live simulator |
| **ACTIVE_ENGINE_OR_MODEL** | Working engine / physics / recommendation logic |
| **DEAD_PROTOTYPE** | Old Day Painter / abandoned route not used by the live simulator |
| **UNCLEAR** | Needs human review |

---

### 3.1 Live Simulator Core

| Classification | File | Notes |
|---|---|---|
| ACTIVE_LIVE_SIMULATOR | `src/explainers/ExplainersHubPage.tsx` | Canonical simulator entry — mounts SimulatorDashboard. Only this + SimulatorDashboard may use the "Simulator" label. |
| ACTIVE_LIVE_SIMULATOR | `src/explainers/lego/simulator/SimulatorDashboard.tsx` | Dashboard: House View, System Diagram, Draw-Off Behaviour, Efficiency — single and compare mode. |
| ACTIVE_LIVE_SIMULATOR | `src/components/simulator/UnifiedSimulatorView.tsx` | Portal-embedded simulator wrapper; mounts SimulatorDashboard with EngineOutputV1 + FullSurveyModelV1. |
| ACTIVE_LIVE_SIMULATOR | `src/components/simulator/DailyUseSimulatorPanel.tsx` | Daily-use simulator panel within the UnifiedSimulatorView composite. |
| ACTIVE_LIVE_SIMULATOR | `src/components/simulator/SystemUpgradeComparisonPanel.tsx` | Current vs proposed system comparison strip inside the live simulator. |
| ACTIVE_LIVE_SIMULATOR | `src/components/simulator/OutcomeSummaryCard.tsx` | Summary card rendered inside the live simulator view. |
| ACTIVE_LIVE_SIMULATOR | `src/components/simulator/TopStatePanel.tsx` | Top-of-page state strip in the unified simulator. |
| ACTIVE_LIVE_SIMULATOR | `src/components/simulator/EventButtonsRow.tsx` | Event action row within the live simulator. |
| ACTIVE_LIVE_SIMULATOR | `src/components/simulator/UpgradeListPanel.tsx` | Upgrade list panel in the live simulator. |
| ACTIVE_LIVE_SIMULATOR | `src/components/simulator/ReactionCards.tsx` | Reaction / insight cards shown in the live simulator. |

### 3.2 Live Simulator Panels & Hooks

| Classification | File | Notes |
|---|---|---|
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/SimulatorPanel.tsx` | Generic collapsible panel shell used by the dashboard. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/ExpandedPanelModal.tsx` | Full-screen expand modal for dashboard panels. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/BehaviourGraph.tsx` | 24-hour behaviour graph rendered inside the dashboard. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/SimulatorStepper.tsx` | Setup stepper shown before the dashboard when no survey input is available. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/adaptFullSurveyToSimulatorInputs.ts` | Adapter: full survey → simulator system inputs. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/scenarioTypes.ts` | Scenario presets used by the simulator. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/systemInputsTypes.ts` | Type definitions for simulator system inputs. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/useBehaviourTimeline.ts` | Hook: 24-hour behaviour timeline playback. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/useDailyEfficiencySummary.ts` | Hook: daily efficiency summary. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/useDayTimeline.ts` | Hook: per-hour day timeline data. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/useDrawOffPlayback.ts` | Hook: draw-off event playback. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/useEfficiencyPlayback.ts` | Hook: efficiency playback from engine output. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/useEmitterPrimaryModel.ts` | Hook: emitter adequacy / flow-temp model. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/useHousePlayback.ts` | Hook: house-state (room temperature) playback. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/useLimiterPlayback.ts` | Hook: system limiter events playback. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/useStoredHotWaterPlayback.ts` | Hook: stored hot-water reserve playback. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/useSystemDiagramPlayback.ts` | Hook: system diagram state playback. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/panels/SystemDiagramPanel.tsx` | Live system diagram panel. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/panels/HouseStatusPanel.tsx` | House status (room temp, comfort) panel. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/panels/DrawOffStatusPanel.tsx` | Hot-water draw-off status panel. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/panels/EfficiencyPanel.tsx` | Boiler / heat-pump efficiency panel. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/panels/LimitersPanel.tsx` | System limiter events panel. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/panels/SystemInputsPanel.tsx` | System inputs control panel. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/panels/ComparisonSummaryStrip.tsx` | Before/after physics comparison strip (compare mode). |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/panels/DayTimelinePanel.tsx` | 24-hour timeline panel. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/panels/DailyEfficiencySummaryPanel.tsx` | Daily efficiency summary panel. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/simulator/panels/StoredHotWaterReservePanel.tsx` | Stored hot-water reserve panel. |

### 3.3 Active Engine / Model Files Consumed by the Simulator

| Classification | File | Notes |
|---|---|---|
| ACTIVE_ENGINE_OR_MODEL | `src/engine/Engine.ts` | Top-level engine runner. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/LifestyleSimulationModule.ts` | Hourly demand simulation — primary data source for all simulator graphs. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/LifestyleInteractiveHelpers.ts` | Physics helpers shared by LifestyleInteractive (Day Painter visualiser) and the simulation module. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/StoredDhwModule.ts` | Stored DHW physics model — draw-off, flow rates, cylinder depletion. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/StoredDhwPhaseModel.ts` | Phase-level stored DHW model. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/CombiDhwModule.ts` | Combi DHW physics model. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/CombiDhwPhaseModel.ts` | Phase-level combi DHW model. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/HydraulicModule.ts` | Hydraulic flow and pressure model. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/SludgeVsScaleModule.ts` | Sludge / scale condition physics (Condition Explorer). |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/SpecEdgeModule.ts` | Specification edge-case module. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/ThermalInertiaModule.ts` | Thermal inertia / τ (tau) calculation. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/MixergyStratificationModule.ts` | Mixergy-specific stratification model. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/RealWorldBehaviourModule.ts` | Real-world behaviour (occupancy, usage patterns). |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/CondensingRuntimeModule.ts` | Condensing-mode runtime fraction model. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/modules/DemographicsAssessmentModule.ts` | Demographics / occupancy assessment. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/timeline/buildCombiStateTimeline.ts` | Combi state timeline builder. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/timeline/buildHydronicStateTimeline.ts` | Hydronic state timeline builder. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/timeline/SystemStateTimeline.ts` | System state timeline types. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/timeline/DerivedSystemEvent.ts` | Derived system event types. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/runners/runCombiSystemModel.ts` | Combi system runner. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/runners/runSystemStoredSystemModel.ts` | Stored system runner. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/runners/runRegularStoredSystemModel.ts` | Regular stored system runner. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/runners/runHeatPumpStoredSystemModel.ts` | Heat pump stored system runner. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/runners/types.ts` | Runner types. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/runners/dhwOwnership.ts` | DHW ownership classification. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/limiter/buildLimiterLedger.ts` | Limiter ledger builder. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/topology/SystemTopology.ts` | System topology definitions. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/schema/EngineInputV2_3.ts` | Canonical engine input schema. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/schema/EngineInputV3.ts` | Next-generation engine input schema. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/presets/DhwFlowPresets.ts` | DHW flow / temperature presets. |
| ACTIVE_ENGINE_OR_MODEL | `src/engine/utils/efficiency.ts` | `computeCurrentEfficiencyPct` + `DEFAULT_NOMINAL_EFFICIENCY_PCT`. |
| ACTIVE_ENGINE_OR_MODEL | `src/lib/simulator/buildCompareSeedFromSurvey.ts` | Builds current/proposed system seeds for compare mode. |
| ACTIVE_ENGINE_OR_MODEL | `src/lib/simulator/buildResimulationFromSurvey.ts` | Builds resimulation overrides from survey data. |
| ACTIVE_ENGINE_OR_MODEL | `src/lib/simulator/mainsSupply.ts` | Mains supply pressure/flow helpers. |
| ACTIVE_ENGINE_OR_MODEL | `src/lib/dhw/buildStoredHotWaterContextFromSurvey.ts` | Stored hot-water context builder. |
| ACTIVE_ENGINE_OR_MODEL | `src/lib/dhw/buildThermalStoreContextFromSurvey.ts` | Thermal store context builder. |
| ACTIVE_ENGINE_OR_MODEL | `src/lib/occupancy/buildOccupancyBehaviourFromSurvey.ts` | Occupancy behaviour builder. |
| ACTIVE_ENGINE_OR_MODEL | `src/lib/heating/buildHeatingOperatingState.ts` | Heating operating state builder. |
| ACTIVE_ENGINE_OR_MODEL | `src/lib/advice/buildAdviceFromCompare.ts` | Advice builder from compare output. |
| ACTIVE_ENGINE_OR_MODEL | `src/lib/confidence/buildUnifiedConfidence.ts` | Confidence scoring. |
| ACTIVE_ENGINE_OR_MODEL | `src/lib/system/systemRegistry.ts` | System registry mapping system types to comparison IDs. |
| ACTIVE_ENGINE_OR_MODEL | `src/contracts/EngineOutputV1.ts` | Engine output contract — primary data source for all simulator graphs. |
| ACTIVE_ENGINE_OR_MODEL | `src/contracts/EngineInputV2_3.ts` | Engine input contract. |

### 3.4 Active Shared Components (simulator-adjacent)

| Classification | File | Notes |
|---|---|---|
| ACTIVE_SHARED_COMPONENT | `src/components/compare/CompareSystemPicker.tsx` | A/B system picker. Used by LifestyleInteractive (Day Painter visualiser) — note: not the live simulator. See naming collisions section. |
| ACTIVE_SHARED_COMPONENT | `src/components/compare/ComparisonMatrix.tsx` | Comparison matrix for system options. |
| ACTIVE_SHARED_COMPONENT | `src/components/visualizers/GlassBoxPanel.tsx` | Glass-box physics detail panel — embedded in dev registry, not the main simulator flow. |
| ACTIVE_SHARED_COMPONENT | `src/components/visualizers/EfficiencyCurve.tsx` | Efficiency curve chart — embedded in dev registry. |
| ACTIVE_SHARED_COMPONENT | `src/components/shell/GlobalMenuShell.tsx` | Menu shell wrapping the simulator journey. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/sim/resolveSystemTopology.ts` | System topology resolver used by lego simulator. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/sim/surveyAdapter.ts` | Survey adapter for lego sim. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/sim/supplyModel.ts` | Supply pressure / flow model for lego sim. |
| ACTIVE_SHARED_COMPONENT | `src/explainers/lego/sim/events.ts` | Simulation event types. |
| ACTIVE_SHARED_COMPONENT | `src/components/behaviour/CylinderStatusCard.tsx` | Cylinder status card (used in simulator behaviour views). |
| ACTIVE_SHARED_COMPONENT | `src/components/behaviour/VerdictCard.tsx` | Verdict card (recommendation verdict). |
| ACTIVE_SHARED_COMPONENT | `src/components/behaviour/PrimaryVerdictPanel.tsx` | Primary verdict panel. |

### 3.5 Active Presentation Surface (post-simulator)

| Classification | File | Notes |
|---|---|---|
| ACTIVE_LIVE_SIMULATOR | `src/components/presentation/CanonicalPresentationPage.tsx` | Multi-page recommendation presentation, reached after survey/simulator. |
| ACTIVE_SHARED_COMPONENT | `src/components/presentation/PresentationDeck.tsx` | Slide-deck renderer for the presentation. |
| ACTIVE_SHARED_COMPONENT | `src/components/presentation/buildCanonicalPresentation.ts` | Builds presentation data model from engine output. |
| ACTIVE_SHARED_COMPONENT | `src/components/presentation/PresentationFlow.tsx` | Navigation flow controller for presentation. |
| ACTIVE_SHARED_COMPONENT | `src/components/presentation/RecommendationCard.tsx` | Individual recommendation card in presentation. |

### 3.6 Dead / Prototype Surfaces

> These files are **not** used by the live Atlas Simulator. They represent earlier prototypes or
> standalone demo surfaces. Do **not** target these for live simulator work.

| Classification | File | Notes |
|---|---|---|
| DEAD_PROTOTYPE | `src/engine/daypainter/BuildDayModel.ts` | Early Day Painter engine — event-based day model with discrete shower/bath/handwash draw types. Used only by `DayPainterResults.tsx`. Not connected to the live simulator. |
| DEAD_PROTOTYPE | `src/engine/daypainter/SimulateSystemDay.ts` | Early Day Painter physics runner — `DaySystemType` enum (`combi`, `open_vented`, `mixergy_open_vented`, `unvented`, `mixergy_unvented`, `heat_pump`). Used only by `DayPainterResults.tsx`. |
| DEAD_PROTOTYPE | `src/components/daypainter/DayPainterResults.tsx` | Early Day Painter results component. Imports from `src/engine/daypainter/` — the old physics stack. Not referenced by `App.tsx` or any production route. Contains a "Shower" dropdown selector (violates current custom instructions). |
| DEAD_PROTOTYPE | `src/components/daypainter/DaySchedulePanel.tsx` | Day schedule editor that feeds the old `DayProfileV1` contract. Not connected to live simulator. Still compiles and is test-covered (`DaySchedulePanel.test.ts`) but has no production route. |
| DEAD_PROTOTYPE | `src/components/visualizers/LifestyleInteractive.tsx` | **"Day Painter" visualiser** — 24-hour interactive painter with hour-cell UI. `DayPainterSystem` internal type. Internally named "Day Painter Sales Closer" in its file header. Not mounted in `App.tsx` directly — only in `devUiRegistry.tsx` (dev-only preview). References `LiveMetricChip` and `SystemNarrationToast` patterns internally. |
| DEAD_PROTOTYPE | `src/components/visualizers/LifestyleInteractiveCompare.tsx` | 2-System Day Painter comparison. Derived from LifestyleInteractive. Only in `devUiRegistry.tsx` (experimental, dev-only). |

### 3.7 System Tests for Dead Prototypes

| Classification | File | Notes |
|---|---|---|
| DEAD_PROTOTYPE | `src/engine/__tests__/LifestyleInteractive.test.ts` | Unit tests for the LifestyleInteractive (Day Painter) visualiser. |
| DEAD_PROTOTYPE | `src/engine/__tests__/DaySchedulePanel.test.ts` | Unit tests for DaySchedulePanel. |

### 3.8 Dev / Tooling Surfaces

| Classification | File | Notes |
|---|---|---|
| ACTIVE_SHARED_COMPONENT | `src/dev/devUiRegistry.tsx` | Central dev component browser manifest. Registers LifestyleInteractive as `status: 'active'`, `access: 'dev_only'`. |
| ACTIVE_SHARED_COMPONENT | `src/dev/devRouteRegistry.ts` | Dev route registry — maps code names to routes. Marks `LifestyleInteractive` as `access: 'dev_only'`, route `'unresolved'`. |
| ACTIVE_SHARED_COMPONENT | `src/components/dev/DevMenuPage.tsx` | Dev menu page at `/dev/devmenu`. |

---

## 4. Naming Collisions Found

The following ambiguities exist in the codebase and must be understood before making changes:

### 4.1 `DayPainterSystem` (internal type) vs "Day Painter" (surface name)

- `src/components/visualizers/LifestyleInteractive.tsx` defines `type DayPainterSystem = 'combi' | 'stored_vented' | 'stored_unvented' | 'ashp'` as an **internal implementation type**.
- The **surface** called "Day Painter" (`LifestyleInteractive`) is a DEAD_PROTOTYPE for live simulator work.
- The live simulator (`SimulatorDashboard`) uses a different type for system selection: `SimulatorSystemChoice` (from `useSystemDiagramPlayback.ts`).
- **Risk**: AI agents searching for "Day Painter" may land on `LifestyleInteractive.tsx` and assume it is the live simulator.

### 4.2 `LiveMetricChip` / `SystemNarrationToast`

- Both `LiveMetricChip` and `SystemNarrationToast` are defined **only** inside `LifestyleInteractive.tsx` (`src/components/visualizers/LifestyleInteractive.tsx`) as local concepts / inline patterns — they are not exported as separate shared components.
- They are **not** present in `SimulatorDashboard` or any `ACTIVE_LIVE_SIMULATOR` file.
- **Risk**: Searching for `LiveMetricChip` or `SystemNarrationToast` leads to the Day Painter prototype, not the live simulator.

### 4.3 `CompareSystemPicker` (used by Day Painter, not live simulator)

- `src/components/compare/CompareSystemPicker.tsx` is described in its file header as "Always-visible A/B system selector for the Day Painter" — it is used by `LifestyleInteractive.tsx` and `LifestyleInteractiveCompare.tsx`.
- The live simulator's compare mode (`SimulatorDashboard`) does **not** use `CompareSystemPicker`.
- **Risk**: "compare" searches may land on the Day Painter's comparison surface.

### 4.4 `DaySchedulePanel` vs live thermostat schedule

- `src/components/daypainter/DaySchedulePanel.tsx` is a dead-prototype schedule editor.
- There is no direct equivalent in the live simulator (schedules are driven by survey occupancy heuristics, not a painter UI).

### 4.5 "System Summary" label

- `System Summary` appears in `src/story/StoryModeContainer.tsx`, `src/features/insightPack/buildInsightPackFromEngine.ts`, and installation specification steps.
- These are **not** simulator surfaces — they are output/report surfaces.
- The live simulator uses "System Diagram" (panel) and "Comparison Summary Strip" internally.

### 4.6 Engine `daypainter/` directory vs live engine modules

- `src/engine/daypainter/` contains two files (`BuildDayModel.ts`, `SimulateSystemDay.ts`) that are part of the old prototype physics stack.
- The live simulator uses `src/engine/modules/LifestyleSimulationModule.ts` and the runner files under `src/engine/runners/`.
- **Risk**: The directory name `daypainter` in the engine causes AI agents to conflate old prototype physics with live engine physics.

---

## 5. Recommended Canonical Naming Going Forward

| Old / Ambiguous Name | Recommended Canonical Name | Context |
|---|---|---|
| "Day Painter" (for the live simulator) | **Atlas Simulator** or **Live System Simulator** | All user-facing copy, documentation, and agent prompts |
| `LifestyleInteractive` | **Day Painter Visualiser** (archived) | Use only when referring to the DEAD_PROTOTYPE surface |
| `DayPainterSystem` (type in LifestyleInteractive) | Retain as-is (internal type in dead prototype file only) | Not visible to users; no rename needed |
| `SimulatorDashboard` | **Atlas Simulator Dashboard** | Internal + documentation references |
| `ExplainersHubPage` | **Atlas Simulator Entry** | Documentation references — code name stays the same |
| "Day Painter" in `devRouteRegistry.ts` note | Already marked `access: 'dev_only'` — add ARCHIVED comment | Code comment only |
| `src/engine/daypainter/` | **Archived Day Painter engine** | Directory — do not import from here for live simulator work |
| `src/components/daypainter/` | **Archived Day Painter components** | Directory — do not import from here for live simulator work |

---

## 6. Dead / Prototype Surfaces and Why They Are Not the Target

### `LifestyleInteractive.tsx` (Day Painter Visualiser)

- **Why it is NOT the live simulator**: It is registered in `devUiRegistry.tsx` with `status: 'active'` but `access: 'dev_only'` and `routeKind: 'derived'` with `fullRouteExample: 'unresolved'`. It is not mounted in `App.tsx`'s main journey switch. It is a standalone 24-hour "painter" where users click hour cells to set state — a different interaction model from the live simulator's physics-driven compare-mode dashboard.
- **Named "Day Painter"** in its own file header: `LifestyleInteractive – "Day Painter" Sales Closer`.
- **Uses**: `LifestyleSimulationModule` (shared with live simulator) but wraps it in an independent hour-cell painter UI that is not the live simulator UX.

### `LifestyleInteractiveCompare.tsx`

- Marked `status: 'experimental'`, `access: 'dev_only'`, `routeKind: 'unknown'` in `devUiRegistry.tsx`.
- Derived from the Day Painter pattern, not from the live `SimulatorDashboard`.

### `src/engine/daypainter/BuildDayModel.ts` + `SimulateSystemDay.ts`

- Early-stage prototype physics with a discrete event list (shower, bath, handwash) and a different system type taxonomy (`open_vented`, `mixergy_open_vented`, etc.) compared to the live engine.
- Only consumed by `DayPainterResults.tsx` which has no production route.

### `src/components/daypainter/DayPainterResults.tsx` + `DaySchedulePanel.tsx`

- No import in `App.tsx`. No production route in `devRouteRegistry.ts`.
- `DayPainterResults.tsx` exposes a Shower dropdown selector — explicitly prohibited by the current custom instructions (demand must be driven by household size / bathroom count heuristics).

---

## 7. Audit Search Results Summary

The following search terms were used during this audit:

| Search Term | Key Findings |
|---|---|
| `Day Painter` / `DayPainter` | Found in: file headers of `LifestyleInteractive.tsx`, `LifestyleInteractiveCompare.tsx`, `CompareSystemPicker.tsx`; engine schema comments; `systemRegistry.ts`; docs. The live simulator (`SimulatorDashboard`, `ExplainersHubPage`) does **not** use these terms except in inherited schema comments. |
| `simulator` / `Simulator` | Found in: journey key `'simulator'` in `App.tsx`; `SimulatorDashboard`, `ExplainersHubPage`, `UnifiedSimulatorView`, `SimulatorPanel`, `SimulatorStepper`, `SimulatorDashboard`, all hooks, `devUiRegistry`. Also found in `LabShell`, `LiveHubPage` (CTA label). |
| `LiveMetricChip` | Found only inside `LifestyleInteractive.tsx` — a local inline pattern in the Day Painter prototype. Not present in the live simulator. |
| `SystemNarrationToast` | Found only inside `LifestyleInteractive.tsx` — a local inline pattern in the Day Painter prototype. Not present in the live simulator. |
| `System Summary` | Found in `StoryModeContainer.tsx`, `insightPack`, `installationSpecification` — output/report surfaces, not simulator. |
| `Presentation` | Found in `CanonicalPresentationPage`, `PresentationDeck`, `PresentationFlow` — the post-survey recommendation presentation, separate from but connected to the simulator. Also in `devUiRegistry` + `devRouteRegistry`. |
| `Compare` | Found in `CompareSystemPicker.tsx` (Day Painter), `ComparisonMatrix.tsx`, `LifestyleInteractiveCompare.tsx` (Day Painter), `SimulatorDashboard` compare mode. The live simulator's compare mode is distinct from the Day Painter compare surface. |
| `house view` / `HouseView` | Found in `SimulatorDashboard` doc-comment ("House View" panel), `SpatialTwinDollhouseView.tsx`, `labDashboard.css` class names. "House View" in the simulator context means `HouseStatusPanel`. |
| `draw-off` / `draw off` / `drawOff` | Found in: `DrawOffStatusPanel`, `DrawOffWorkbench`, `DrawOffCard`, `DrawOffFocusPanel`, `useDrawOffPlayback.ts`, `DrawOffPanel` (lego animation), engine runners, `StoredDhwModule`. |
| `DHW` | Widespread — present in live simulator hooks, engine modules, schema, advice. Not ambiguous. |
| `Heating` | Widespread — present in live simulator hooks, engine modules, schema, advice, `DaySchedulePanel`. Not ambiguous. |
| `efficiency` | Widespread — `EfficiencyPanel`, `useEfficiencyPlayback`, `computeCurrentEfficiencyPct`, `DEFAULT_NOMINAL_EFFICIENCY_PCT`. Must always use `computeCurrentEfficiencyPct` from `src/engine/utils/efficiency.ts`. |

---

## 8. Quick Reference: Do / Do Not

| ✅ Do | ❌ Do Not |
|---|---|
| Target `src/explainers/ExplainersHubPage.tsx` for simulator entry changes | Target `src/components/visualizers/LifestyleInteractive.tsx` for live simulator work |
| Target `src/explainers/lego/simulator/SimulatorDashboard.tsx` for dashboard changes | Target `src/engine/daypainter/` for live engine physics |
| Target `src/components/simulator/UnifiedSimulatorView.tsx` for portal-embedded simulator | Target `src/components/daypainter/` for live simulator components |
| Use `computeCurrentEfficiencyPct` from `src/engine/utils/efficiency.ts` | Use the literal `92` for nominal efficiency |
| Use `DEFAULT_NOMINAL_EFFICIENCY_PCT` for nominal efficiency | Use `Math.random()` in any simulator component |
| Source all graph data from `EngineOutputV1` or `LifestyleSimulationModule.hourlyData` | Source graph data from `SimulateSystemDay.ts` (old prototype) |
| Use `SimulatorSystemChoice` type for live simulator system selection | Use `DayPainterSystem` type in live simulator code |

---

*Document created: 2026-05-15. Maintained by: Atlas engineering team.*
*Regenerate after any major route change or new simulator surface addition.*
