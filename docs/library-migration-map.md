# Atlas educational library migration map

## Keep in place for now

| Current area | Why it stays | Future relationship to library |
|---|---|---|
| `src/components/presentation/presentationVisualMapping.ts` | Presentation still owns page-slot decisions | Consume library registry IDs instead of raw visual IDs |
| `src/components/portal/ObjectiveComparisonPanel.tsx` | Portal layout is still a presentation concern | Pull educational comparison assets from the library |
| `src/components/compare/ComparisonMatrix.tsx` | Surveyor comparison remains a specialist surface | Consume shared comparison metadata and severity tokens |
| `src/explainers/ExplainersOverlay.tsx` | Existing discovery surface already works | Become a library browser over canonical registry records |
| `src/components/simulator/UnifiedSimulatorView.tsx` | Simulator orchestration should stay near simulation surfaces | Request library assets from trigger/topology bindings |

## Move into the library as shared educational assets

| Current asset | Action | Target location | Reason |
|---|---|---|---|
| `src/explainers/educational/content.ts` and `types.ts` | Migrate content records into canonical concept/explainer registry | `src/library/concepts/`, `src/library/registry/` | Already close to canonical educational content |
| `src/lib/explainers/explainerRegistry.ts` | Replace with adapter, then migrate metadata | `src/library/registry/` | Trigger and placement metadata belongs in one library registry |
| `src/components/physics-visuals/physicsVisualRegistry.ts` and `physicsVisualTypes.ts` | Fold into library contracts and asset registry | `src/library/contracts/`, `src/library/registry/` | Strongest existing metadata foundation |
| `src/components/visualizers/DrivingStylePhysicsExplainer.tsx` | Re-home as analogy asset renderer | `src/library/analogies/driving-style/` | Reusable, triggerable, reduced-motion aware |
| `src/components/visualizers/ConvectionExplainer.tsx` | Re-home as animation/diagram asset | `src/library/animations/airflow/` | Standalone educational asset with clear concept scope |
| `src/features/explainers/energy/components/TortoiseVsBeeExplainer.tsx` | Re-home as analogy asset | `src/library/analogies/tortoise-vs-bee/` | Good low-load entry asset |
| `src/features/explainers/energy/components/SpongeHeatPumpExplainer.tsx` | Re-home as analogy asset | `src/library/analogies/sponge-heat-transfer/` | Strong cause/effect explanation |
| `src/features/explainers/energy/components/BigEmitterExplainer.tsx` | Re-home as explainer/diagram asset | `src/library/explainers/emitter-sizing/` | Reusable selector-based explainer |
| `src/components/whatif/*.tsx` and `whatif-animations.css` | Re-home as canonical animation assets | `src/library/animations/` | Small focused assets with clear educational intent |
| `src/components/physics-visuals/visuals/*.tsx` | Re-home gradually as diagram/animation assets | `src/library/diagrams/`, `src/library/animations/` | Already mostly reusable |

## Keep renderer where it is, but bind it to library metadata

| Current asset | Target pattern | Why |
|---|---|---|
| `src/components/visualizers/LifestyleInteractive.tsx` | Keep renderer, add library metadata and trigger bindings | Large surface depends on simulation truth and synchronized charts |
| `src/components/visualizers/LifestyleInteractiveCompare.tsx` | Keep renderer, add comparison/topology binding | Advanced compare mode should stay near simulation code |
| `src/explainers/lego/simulator/SimulatorDashboard.tsx` | Keep renderer, resolve child assets through library registry | Dashboard is a shell more than a single educational asset |
| `src/explainers/lego/animation/render/LabCanvas.tsx` | Decompose into library-addressable sub-assets over time | Too large to move in one step |
| `src/components/portal/ScenarioPreviewPanel.tsx` | Keep renderer, switch to canonical asset references | Scenario preview is context-specific UI |

## Shared assets to extract first

1. A canonical educational asset metadata contract.
2. A canonical concept registry.
3. A canonical trigger registry.
4. A reduced-motion fallback contract.
5. A cognitive-load budget contract.
6. Shared severity/status tokens for educational warnings.
7. Shared slider/toggle accessibility guidance for interactive explainers.

## Retire or rewrite over time

| Current pattern | Proposed replacement | Reason |
|---|---|---|
| Separate metadata systems for explainers, visuals, and page mapping | Unified educational registry with adapters | Reduces drift and improves discoverability |
| Page-local trigger selection | Canonical trigger resolver | Prevents duplicated logic |
| Duplicated running-style assets without shared concept record | Shared concept + multiple asset variants | Supports layered depth without duplicated truth |
| Duplicated tank/cylinder visual logic | Shared cylinder asset primitives | Avoids parallel animation behaviour |
| Motion policies defined only in CSS | Asset-level motion contract plus CSS implementation | Makes accessibility reviewable and searchable |
| High-load educational surfaces without an explicit complexity score | Cognitive-load budget on every asset | Supports adaptive comprehension |

## Suggested migration order

1. Add contracts and empty registry foundation.
2. Add adapters for current explainer and visual registries.
3. Move focused assets first: what-if animations, energy analogies, driving-style explainer.
4. Bind portal, overlay, and presentation surfaces to canonical asset IDs.
5. Decompose large simulator surfaces into sub-assets only after registry consumption is stable.
