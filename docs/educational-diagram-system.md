# Educational Diagram System

## Purpose and design principles

The Educational Diagram System provides reusable SVG-based visual primitives and composed diagrams for the Atlas recommendation engine. Each diagram explains a specific concept or corrects a misconception in the customer-facing educational journeys.

Design principles:

- **No colour-only meaning.** Every visual state is accompanied by a text label.
- **Physics-driven.** No arbitrary data or `Math.random()`. All visual states reflect real system behaviour.
- **Print-safe.** Diagrams degrade gracefully to black borders and white backgrounds when printed.
- **Reduced-motion safe.** All animations and transitions are suppressed via `data-motion` attribute or `prefers-reduced-motion` media query.
- **Screen-reader accessible.** Every diagram has a visually-hidden screen-reader summary and `aria-label` attributes.

## Accessibility requirements

- **No colour-only communication:** every visual indicator (pressure bar, fill state, active outlet) has an accompanying text label rendered in HTML.
- **Screen-reader summaries:** each composed diagram renders a `<p className="atlas-edu-diagram__screen-reader-summary">` element using the clip-path visually-hidden technique. This is picked up by screen readers but not visible on screen.
- **Print-safe:** pass `printSafe={true}` to any diagram to add `data-print-safe="true"` on the wrapper. CSS overrides gradients, colours, and shadows for print output.
- **Reduced-motion:** wrap diagrams in an element with `data-motion="off"` or `data-motion="reduce"`, or rely on the `@media (prefers-reduced-motion: reduce)` rule in `diagrams.css`. Both suppress all animations and transitions.

## Primitive components

| Component | Description |
|---|---|
| `FlowLine` | SVG arrow showing fluid flow direction with a text label. |
| `PressureIndicator` | Labelled bar indicator showing pressure level (high / medium / low). |
| `HeatGradientBar` | Bar showing a temperature gradient from low to high with labelled endpoints. |
| `WaterStoreTank` | SVG cylindrical tank with capacity and pressure labels. |
| `OutletNode` | SVG circle representing a tap or shower outlet, with active state label. |
| `RadiatorHeatMap` | SVG rectangle representing a radiator with surface temperature and comfort labels. |
| `SystemTopologyPanel` | Labelled container panel for system layout diagrams with screen-reader summary. |
| `BeforeAfterSplit` | Side-by-side before/after layout with screen-reader summary. |
| `ExplanationCallout` | Small annotation box with a label and body text. |
| `ComfortTimeline` | Labelled time-phase bar with per-phase descriptions. |

## Available diagrams

| Diagram | Component | Concept IDs | Journey IDs |
|---|---|---|---|
| Pressure vs storage | `PressureVsStorageDiagram` | `pressure_vs_storage`, `STR-01`, `premium_hot_water_performance` | `open_vented_to_sealed_unvented`, `regular_to_regular_unvented` |
| Warm vs hot radiators | `WarmVsHotRadiatorsDiagram` | `hot_radiator_expectation`, `flow_temperature_living_with_it`, `CON-01` | `heat_pump_reality` |
| Water main limitation | `WaterMainLimitationDiagram` | `water_main_limit_not_boiler_limit`, `microbore_flow_limits` | `water_constraint_reality` |
| Open-vented to sealed + unvented | `OpenVentedToUnventedDiagram` | `open_vented_to_unvented_upgrade`, `sealed_system_conversion`, `pressure_vs_storage` | `open_vented_to_sealed_unvented` |

## How to add a new diagram

1. Create a new `.tsx` file in `src/library/diagrams/`, e.g. `MyNewDiagram.tsx`.
2. Import `'./diagrams.css'` and the required primitives from `'./primitives'`.
3. Define and export a `MyNewDiagramProps` interface with at least a `printSafe?: boolean` prop.
4. Apply `data-print-safe={printSafe ? 'true' : undefined}` on the root wrapper.
5. Include a `<p className="atlas-edu-diagram__screen-reader-summary" aria-label="Screen reader summary">` with a descriptive summary.
6. Include a `<p className="atlas-edu-diagram__caption">` with the `whatThisMeans` text.
7. Add a registry entry to `diagramExplanationRegistry.ts` with `diagramId`, `title`, `conceptIds`, `misconceptionsTargeted`, `journeyIds`, `screenReaderSummary`, and `whatThisMeans`.
8. Export the component and its props from `src/library/diagrams/index.ts`.
9. Add tests in `src/library/__tests__/educationalDiagramSystem.test.tsx`.

## Registry lookup functions

```ts
import {
  getDiagramById,
  getDiagramsByConceptId,
  getDiagramsByJourneyId,
} from '../library/diagrams';

getDiagramsByJourneyId('open_vented_to_sealed_unvented');
getDiagramsByConceptId('pressure_vs_storage');
getDiagramById('pressure_vs_storage');
```

Each function returns matching `DiagramExplanationEntry` objects from `diagramExplanationRegistry`.
