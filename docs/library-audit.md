# Atlas educational library audit

## Purpose

This audit inventories the current Atlas educational assets so they can be migrated into an accessibility-first library without changing engine truth, recommendation logic, or physics derivation.

## Existing foundations already in the codebase

- `src/explainers/educational/content.ts` and `src/explainers/educational/types.ts` already act as a lightweight concept catalogue for short explainers.
- `src/lib/explainers/explainerRegistry.ts` already adds placement and trigger metadata on top of explainer content.
- `src/components/physics-visuals/physicsVisualTypes.ts` and `src/components/physics-visuals/physicsVisualRegistry.ts` already define reusable visual metadata, display modes, and signal applicability.
- `src/components/presentation/presentationVisualMapping.ts` already maps canonical presentation sections to registered visuals and enforces some validity guards.
- `src/lib/explainers/getRelevantExplainers.ts` already shows the intended boundary: presentation chooses explainers from engine or UI signals instead of deriving new truth.

## Inventory

| Asset | File(s) | Purpose | Concepts explained | Current usage | Audience | Accessibility strengths | Accessibility weaknesses | Reusable? | Suggested library category |
|---|---|---|---|---|---|---|---|---|---|
| Educational explainer content set | `src/explainers/educational/content.ts`, `src/explainers/educational/types.ts` | Canonical short-form explainer copy and categories | On-demand hot water, simultaneous outlets, condensing operation, thermal mass, zoning, water hardness | Global explainer overlay and scenario preview links | Customer, adviser | Short point-plus-bullets format, stable terminology, clear categories | Text-only; no cognitive-load scoring; no audience variants | Yes | `concepts/`, `explainers/`, `registry/` |
| Explainer placement registry | `src/lib/explainers/explainerRegistry.ts` | Associates explainer IDs with categories, placement, and relevance triggers | Contextual learning surfaces | Used by overlay and recommendation surfaces | Customer, adviser | Clear metadata separation from rendering | Trigger vocabulary is narrow and explainer-specific | Yes | `registry/`, `triggers/` |
| Explainer relevance mapper | `src/lib/explainers/getRelevantExplainers.ts` | Maps limiting factors to explainer IDs | Mains sharing, simultaneous use, storage vs on-demand hot water | Advice/behaviour cards and scenario preview surfaces | Customer | Progressive disclosure from local cause to deeper explanation | Mapping lives near presentation, not in a canonical library resolver | Yes | `triggers/` |
| Global explainer overlay | `src/explainers/ExplainersOverlay.tsx` | Searchable overlay for contextual and library explainers | Cross-topic educational navigation | Global hamburger in shell/stepper flows | Customer, engineer | Category grouping, contextual section, modal semantics | No structured filters for audience/accessibility mode/technical depth | Partial | `explainers/` consuming `registry/` |
| Featured explainer hub | `src/explainers/educational/ExplainerPanel.tsx` | Hosts featured visual explainers | Driving style analogy, convection | Standalone explainer panel | Customer | Clear two-card layout, visual-first presentation | Hand-curated and page-specific | Partial | `explainers/` |
| Driving style explainer | `src/components/visualizers/DrivingStylePhysicsExplainer.tsx`, `src/types/explainers.ts`, `src/lib/explainers/drivingStyleExplainer.ts` | Four-system analogy with optional motion and concurrency warning | Burst vs steady running, Mixergy behaviour, simultaneous demand risk | Featured explainer panel | Customer, adviser | Play-on-demand, compact mode, warning chip, reduced-motion CSS, strong cause/effect mapping | Analogy metadata not discoverable outside component props | Yes | `analogies/`, `animations/` |
| Convection explainer | `src/components/visualizers/ConvectionExplainer.tsx` | Interactive airflow and temperature-balancing explainer | Convection loops, stack effect, room separation | Featured explainer panel, presentation deck embed | Customer, adviser | Visual before textual, one concept at a time, slider-driven progressive disclosure | No shared metadata contract, time slider feedback could be clearer | Yes | `animations/`, `diagrams/` |
| Energy literacy card shell | `src/features/explainers/energy/components/EnergyExplainerCard.tsx` | Shared container for energy explainers | Wrapper only | Energy literacy panel family | Customer | Stable hierarchy, chunked content, reusable shell | No canonical asset metadata | Yes | `topology/` or shared UI shell outside library |
| Tortoise vs bee explainer | `src/features/explainers/energy/components/TortoiseVsBeeExplainer.tsx` | Static analogy between boiler and heat pump running style | Burst firing vs steady state | Energy literacy suite | Customer | Low text density, memorable anchor, stable comparison layout | Relies on emoji motifs; not tagged as an analogy asset | Yes | `analogies/` |
| Sponge heat pump explainer | `src/features/explainers/energy/components/SpongeHeatPumpExplainer.tsx` | Toggle-based heat pump absorption analogy | COP trade-off, energy transfer | Energy literacy suite | Customer | Interactive but low-friction, visual flow stages, reduced-motion support | Toggle semantics and accessibility depth not centrally described | Yes | `analogies/`, `animations/` |
| Big emitter explainer | `src/features/explainers/energy/components/BigEmitterExplainer.tsx` | Selector-based emitter sizing explanation | Emitter area, flow temperature, COP | Energy literacy suite | Customer | One decision at a time, visual bar sizing, grouped controls | Metadata and triggers missing; depends on local component state only | Yes | `explainers/`, `diagrams/` |
| Physics visual registry and types | `src/components/physics-visuals/physicsVisualTypes.ts`, `src/components/physics-visuals/physicsVisualRegistry.ts` | Canonical metadata for reusable visuals | Heat, water, energy, controls, system behaviour visuals | Visual gallery and presentation mapping | Customer, adviser, engineer | Strong metadata start: IDs, categories, display modes, signal types, reduced-motion flags | Missing audience, explanation style, technical depth, cognitive-load budget | Yes | `registry/` |
| Physics visual gallery | `src/components/physics-visuals/preview/PhysicsVisualGallery.tsx` | Developer-facing gallery to inspect registered visuals | All registered visuals | Dev route and app routes | Engineer, designer | Discoverable preview surface, helps auditing | Dev-only; not organised around accessibility modes or concepts | Partial | `registry/`, `topology/` |
| Cylinder charge and compare visuals | `src/components/physics-visuals/visuals/CylinderChargeVisual.tsx`, `src/components/physics-visuals/CylinderComparePanel.tsx` | Explains standard vs Mixergy charge behaviour | Stratification, stored hot water readiness, partial charge | Gallery and presentation deck go-further surface | Customer, adviser | Reduced-motion prop, side-by-side comparison, shared slider | Duplicates some tank animation ideas found elsewhere | Yes | `animations/`, `diagrams/` |
| Heat particles visual | `src/components/physics-visuals/visuals/HeatParticlesVisual.tsx` | Building-fabric heat transfer visual | Conduction, convection, insulation impact, wall heat loss | Registered physics visual | Customer, adviser | Reduced-motion prop, labelled layers, visual anchoring | Thermal meaning depends partly on colour/opacity | Yes | `animations/`, `diagrams/` |
| Flow split visual | `src/components/physics-visuals/visuals/FlowSplitVisual.tsx` | Shared-flow schematic | Simultaneous outlets, demand sharing | Registered physics visual | Customer | Clear cause/effect mapping, reusable prop contract | Needs canonical trigger metadata beyond component props | Yes | `animations/`, `diagrams/` |
| Solar mismatch visual | `src/components/physics-visuals/visuals/SolarMismatchVisual.tsx` | Time-of-day mismatch explainer | Solar timing vs household demand | Registered physics visual | Customer | Visual-first explanation, reduced-motion support | Needs shared educational context and audience targeting | Yes | `diagrams/` |
| Thermal store visual | `src/components/physics-visuals/visuals/ThermalStoreVisual.tsx` | Legacy current-system explainer | Thermal store architecture, high-temperature dependency | Registered current-system-only visual | Customer, adviser | Good guardrails in registry/mapping | Legacy-only logic needs explicit retirement rules in migration plan | Yes | `diagrams/` |
| Driving style visual | `src/components/physics-visuals/visuals/DrivingStyleVisual.tsx` | Lightweight reusable version of running-style comparison | System behaviour differences | Registered visual and deck surfaces | Customer | Shares reusable visual contract and reduced-motion support | Overlaps conceptually with richer explainer | Yes | `animations/`, `analogies/` |
| What-if animation frame and cards | `src/components/whatif/WhatIfVisualFrame.tsx`, `src/components/whatif/WhatIfScenarioCard.tsx` | Framing shell for compact animated myths/problem explanations | Scenario-based behavioural teaching | What-if cards | Customer, adviser | Reusable frame, reduced-motion detection, chunked layout | Metadata and trigger model are local to the what-if feature | Yes | `explainers/`, `animations/` |
| Boiler cycling animation | `src/components/whatif/BoilerCyclingAnimation.tsx`, `src/components/whatif/whatif-animations.css` | Animated oversizing/cycling concept | Oversized boiler cycling | What-if scenarios | Customer | Motion reduction implemented in CSS | Animation intent and concepts not tagged centrally | Yes | `animations/` |
| Flow restriction animation | `src/components/whatif/FlowRestrictionAnimation.tsx`, `src/components/whatif/whatif-animations.css` | Supply-vs-demand flow illustration | Flow-limited mains-fed supply, combi instability | What-if scenarios | Customer | Very direct cause/effect | Still presentation-specific and not registry-backed | Yes | `animations/` |
| Radiator upgrade animation | `src/components/whatif/RadiatorUpgradeAnimation.tsx`, `src/components/whatif/whatif-animations.css` | Lower-flow-temperature outcome visual | Radiator sizing, condensing operation | What-if scenarios | Customer | Strong outcome-first framing, reduced-motion support | Uses colour/glow heavily | Yes | `animations/` |
| Day Painter | `src/components/visualizers/LifestyleInteractive.tsx` | Interactive 24-hour demand and system-response visualiser | Demand vs system response, room comfort, DHW deliverability, cycling waste | Customer-facing simulation/education surface | Customer, adviser, engineer | Synchronized graphs, explicit cause/effect, progressive disclosure via steps | High information density; complex interaction hints are limited | Yes | `animations/`, `topology/`, `triggers/` |
| Side-by-side Day Painter | `src/components/visualizers/LifestyleInteractiveCompare.tsx` | Two-system comparison with shared timeline | System trade-offs across the same household behaviour | Comparison simulation surface | Adviser, engineer, advanced customer | Fair shared timeline, strong comparative anchoring | High cognitive load without guided scaffolding | Yes | `topology/`, `explainers/` |
| Unified simulator wrapper | `src/components/simulator/UnifiedSimulatorView.tsx` | Bridges engine output into simulator surfaces | Whole-system behaviour in context | Portal-safe and compare simulator flows | Adviser, engineer | Keeps truth anchored to engine output | Educational assets are embedded rather than library-addressable | Partial | `triggers/`, `topology/` |
| Simulator dashboard | `src/explainers/lego/simulator/SimulatorDashboard.tsx` | Four-panel simulation dashboard | Diagram, house view, draw-off behaviour, efficiency | Simulator route | Adviser, engineer | Panelisation lowers friction | Still monolithic for asset discovery | Partial | `topology/` |
| Lab canvas | `src/explainers/lego/animation/render/LabCanvas.tsx` | Rich SVG/canvas system animation layer | Thermal state, outlet behaviour, condensing state | Deep simulator and lego explainer flows | Engineer, advanced customer | Strong visual truth anchoring | Too large and specialised to be a single canonical asset; needs decomposition | Partial | `topology/`, `animations/` |
| Objective comparison panel | `src/components/portal/ObjectiveComparisonPanel.tsx` | Priority-led options explanation | Objective trade-offs and recommended fit | Portal comparison surface | Customer | Tab semantics, calm prioritised comparison, progressive disclosure | Comparison rationale and educational assets are not directly linked | Partial | `explainers/`, `triggers/` |
| Scenario preview panel | `src/components/portal/ScenarioPreviewPanel.tsx` | Shows scenario-specific context, including explainer links | Recommendation-specific educational hooks | Portal preview surface | Customer | Connects recommendation context to explainer titles | Uses explainer IDs indirectly instead of a richer asset contract | Partial | `triggers/` |
| Comparison matrix | `src/components/compare/ComparisonMatrix.tsx` | Surveyor-facing comparison matrix | Performance bands, physics constraints, objective trade-offs | Surveyor comparison page | Engineer, surveyor | Dense but structured matrix, stable layout | Colour/emoji density is higher; not ideal for low-literacy customer mode | Partial | `diagrams/`, `topology/` |

## Educational concepts already present

- Simultaneous outlet demand and shared mains flow: `src/explainers/educational/content.ts`, `src/components/physics-visuals/visuals/FlowSplitVisual.tsx`, `src/components/whatif/FlowRestrictionAnimation.tsx`
- On-demand hot water vs stored hot water: `src/explainers/educational/content.ts`, `src/components/physics-visuals/visuals/CylinderChargeVisual.tsx`
- Standard cylinder vs Mixergy stratification and reduced cycling: `src/explainers/educational/content.ts`, `src/components/physics-visuals/visuals/CylinderChargeVisual.tsx`
- Boiler cycling, condensing operation, and flow temperature: `src/explainers/educational/content.ts`, `src/components/whatif/BoilerCyclingAnimation.tsx`, `src/components/whatif/RadiatorUpgradeAnimation.tsx`
- Heat pump low-and-slow behaviour and energy transfer analogies: `src/explainers/educational/content.ts`, `src/features/explainers/energy/components/TortoiseVsBeeExplainer.tsx`, `src/features/explainers/energy/components/SpongeHeatPumpExplainer.tsx`
- Thermal mass, conduction, convection, and wall heat loss: `src/explainers/educational/content.ts`, `src/components/visualizers/ConvectionExplainer.tsx`, `src/components/physics-visuals/visuals/HeatParticlesVisual.tsx`
- System zoning and control behaviour: `src/explainers/educational/content.ts`
- Legacy thermal store architecture: `src/components/physics-visuals/visuals/ThermalStoreVisual.tsx`
- Day-to-day behaviour outcomes and system response under demand: `src/components/visualizers/LifestyleInteractive.tsx`, `src/components/visualizers/LifestyleInteractiveCompare.tsx`

## Existing accessibility features

### Content structure and pacing

- Short point-plus-bullets explainer model in `src/explainers/educational/content.ts`.
- Progressive disclosure via `ExplainersOverlay`, `ObjectiveComparisonPanel`, and compare modes.
- One-idea-per-control pattern in `SpongeHeatPumpExplainer`, `BigEmitterExplainer`, and `CylinderComparePanel`.
- Stable category grouping in `ExplainersOverlay.tsx` and stable display modes in `physicsVisualRegistry.ts`.

### Visual anchoring

- Strong iconography and labelled diagrams in the physics visual set.
- Synchronized dual-chart pattern in `LifestyleInteractive.tsx` already separates demand from system response.
- Comparison-oriented layouts in `ObjectiveComparisonPanel.tsx`, `CylinderComparePanel.tsx`, and `LifestyleInteractiveCompare.tsx`.

### Motion reduction

- `prefers-reduced-motion` support exists in what-if animations, explainer cards, the overlay, and multiple physics visual CSS files.
- `reducedMotion` props exist in the physics visual system and some interactive visuals.
- `WhatIfVisualFrame.tsx` and `PresentationVisualSlot.tsx` already detect reduced-motion preference in code.

### Semantic HTML and interaction support

- Modal and grouping semantics in `ExplainersOverlay.tsx`.
- Tab semantics in `ObjectiveComparisonPanel.tsx`.
- Image roles and aria labels in multiple physics visuals.
- Keyboard-expandable shells such as `SimulatorPanel.tsx`.

## Existing trigger systems

| Trigger source | File(s) | Current behaviour |
|---|---|---|
| Engine explainer IDs | `src/lib/explainers/explainerRegistry.ts` | Determines which explainers are contextually relevant |
| Behaviour limiting factors | `src/lib/explainers/getRelevantExplainers.ts` | Maps card factors to explainer IDs |
| Canonical presentation section + signals | `src/components/presentation/presentationVisualMapping.ts` | Picks section visuals and enforces visual validity |
| Physics visual signal types | `src/components/physics-visuals/physicsVisualRegistry.ts` | Declares which signals/families a visual applies to |
| Day simulation output | `src/components/visualizers/LifestyleInteractive.tsx`, `src/components/visualizers/LifestyleInteractiveCompare.tsx` | Drives demand and system-response charts |
| User interaction state | `DrivingStylePhysicsExplainer.tsx`, `ConvectionExplainer.tsx`, `SpongeHeatPumpExplainer.tsx`, `BigEmitterExplainer.tsx` | Starts or changes learning animations locally |
| Portal context | `src/components/portal/ScenarioPreviewPanel.tsx` | Surfaces explainer titles relevant to a scenario |

## Duplicate educational logic or visuals

1. Running-style education exists in both `DrivingStylePhysicsExplainer.tsx` and `visuals/DrivingStyleVisual.tsx`.
2. Cylinder charge/stratification logic overlaps between `CylinderChargeVisual.tsx` and `MixergyTankVisualizer.tsx`.
3. Trigger metadata exists in parallel forms across `explainerRegistry.ts`, `physicsVisualRegistry.ts`, and `presentationVisualMapping.ts`.
4. Time-based learning controls reappear in `ConvectionExplainer.tsx`, `CylinderComparePanel.tsx`, and `LifestyleInteractive.tsx` without a shared accessibility contract.
5. Status/severity explanation patterns recur across `ComparisonMatrix.tsx`, behaviour cards, and other advisory surfaces.

## Accessibility risks to address in the library foundation

1. **Metadata fragmentation:** audience, accessibility mode, technical depth, and explanation style are not first-class fields across all assets.
2. **Cognitive overload risk:** `LifestyleInteractive.tsx`, `LifestyleInteractiveCompare.tsx`, and `LabCanvas.tsx` expose a lot of state without a declared complexity budget.
3. **Colour dependence:** heat, severity, and system-state visuals often rely on colour/opacity as a primary cue.
4. **Local trigger logic:** many assets are only discoverable through page-specific imports instead of a canonical registry.
5. **Analogy duplication:** analogy assets exist, but analogy-specific cautions and concept links are not centrally declared.
6. **Reduced-motion inconsistency:** support exists widely, but the fallback mode is not standardised across assets.
7. **Audience ambiguity:** surveyor-facing matrices and customer-facing explainers sit beside each other without an explicit audience contract.
8. **Terminology drift risk:** existing content is mostly compliant, but a larger library needs canonical-term enforcement in metadata and review.

## Audit conclusion

Atlas already has the core pieces of an educational library:

- canonical short-form explainer content,
- canonical visual metadata,
- contextual trigger wiring,
- reusable interactive explainers,
- reduced-motion support in many assets.

What is missing is a single accessibility-first registry contract that can describe all of those assets with the same language: concept IDs, trigger IDs, audience, cognitive-load budget, motion policy, technical depth, and truth-boundary metadata.
