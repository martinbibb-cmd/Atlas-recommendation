# Atlas accessibility library foundation

## Goal

Create a contextual educational rendering system for heating and energy concepts that adapts explanation depth to user needs while staying grounded in Atlas engine truth.

## Non-negotiable guardrails

1. The library explains already-determined truth only.
2. The library must not derive recommendations, scores, or physics independently.
3. All asset triggering must come from engine output, canonical presentation models, or explicitly declared simulation outputs.
4. User-facing terminology must remain aligned with `docs/atlas-terminology.md`.
5. Motion must teach, not decorate.
6. Reduced-motion fallbacks must be part of the asset contract, not ad hoc CSS only.

## Design philosophy

Atlas should not introduce a separate “simple mode”.

It should introduce **adaptive comprehension** with layered cognitive accessibility:

- outcome first,
- cause before specification,
- visual before textual,
- one dominant idea per asset,
- progressive disclosure,
- technical depth always available,
- stable layouts and terminology,
- explicit cause/effect mapping,
- motion only when it answers a question,
- same truth underneath every layer.

## Proposed folder structure

```text
src/library/
├── accessibility/
│   ├── cognitiveLoad.ts
│   ├── accessibilityModePolicy.ts
│   └── reducedMotionPolicy.ts
├── analogies/
│   ├── driving-style/
│   ├── sponge-heat-transfer/
│   └── tortoise-vs-bee/
├── animations/
│   ├── water-pressure/
│   ├── cylinder/
│   ├── combi/
│   ├── heat-pump/
│   └── weather-comp/
├── concepts/
│   ├── hot-water/
│   ├── heat-loss/
│   ├── controls/
│   └── system-behaviour/
├── diagrams/
│   ├── topology/
│   ├── comparison/
│   └── current-system/
├── explainers/
│   ├── cards/
│   ├── overlays/
│   └── summaries/
├── registry/
│   ├── educationalRegistryFoundation.ts
│   ├── educationalAssetAdapters.ts
│   └── educationalAssetResolver.ts
├── topology/
│   ├── rendererBindings.ts
│   └── pageSurfaceBindings.ts
├── triggers/
│   ├── buildEducationalContext.ts
│   ├── triggerResolver.ts
│   └── triggerAdapters.ts
└── contracts/
    └── EducationalContractsV1.ts
```

## Educational asset taxonomy

### Asset kinds

- `animation`: time-based teaching asset
- `diagram`: static or lightly interactive schematic
- `explainer`: concise concept card or modal article
- `simulation_visual`: chart or system-response surface driven by simulation output
- `comparison`: side-by-side explanation surface
- `interactive_demo`: user-controlled teaching surface
- `analogy`: metaphor-driven explanatory asset
- `topology_binding`: asset binding for topology/presentation renderers

### Core categories

- `water`
- `heat`
- `energy`
- `controls`
- `system_behaviour`
- `fabric`
- `comparison`
- `topology`

### Audiences

- `customer`
- `adviser`
- `engineer`
- `surveyor`
- `all`

### Accessibility modes

- `default`
- `dyslexia`
- `adhd`
- `low_technical_literacy`
- `screen_reader_first`
- `reduced_motion`
- `high_contrast`

### Technical depth

- `basic`
- `guided`
- `intermediate`
- `advanced`

### Explanation styles

- `visual`
- `cause_effect`
- `analogy`
- `comparative`
- `technical`
- `step_by_step`

## Registry architecture

### 1. Canonical registry layer

A single registry object should own:

- asset metadata,
- concept metadata,
- trigger metadata,
- analogy metadata,
- cognitive-load budget,
- truth-boundary metadata,
- reduced-motion policy,
- audience and technical-depth targeting.

### 2. Adapter layer

Short term, do not rewrite assets.

Instead, create adapters that ingest existing Atlas sources:

- `EDUCATIONAL_EXPLAINERS`
- `EXPLAINER_REGISTRY`
- `physicsVisualRegistry`
- `presentationVisualMapping`
- what-if scenario cards
- simulation surfaces that already rely on engine output

### 3. Resolver layer

A resolver should accept contextual truth, not raw survey state:

- engine explainer IDs,
- canonical presentation section IDs,
- scenario warnings and risks,
- recommendation family,
- simulation output flags,
- accessibility mode,
- audience,
- preferred technical depth.

It should return:

- recommended assets,
- ordering,
- whether to render inline or behind disclosure,
- reduced-motion fallback selection,
- any “show advanced detail” follow-up assets.

## Metadata contract strategy

The V1 contract should support these questions for every asset:

1. What concept does it explain?
2. What truth source is it allowed to depend on?
3. Who is it for?
4. Which accessibility modes is it optimised for?
5. How much motion and text does it use?
6. How much cognitive load does it consume?
7. Which engine or presentation triggers make it relevant?
8. What is the fallback when motion or density must be reduced?
9. What current files and registries does it map back to?

The initial contract lives in `src/library/contracts/EducationalContractsV1.ts`.

## Accessibility mode strategy

### Dyslexia

Prioritise:

- shorter line lengths,
- stronger visual grouping,
- predictable card structure,
- lower text density,
- explicit headings and labels,
- optional read-in-stages disclosure.

### ADHD

Prioritise:

- strong visual anchors,
- one primary action or idea per surface,
- visible progress states,
- fewer simultaneous choices,
- high signal-to-noise layout,
- clearly bounded comparisons.

### Low technical literacy

Prioritise:

- outcome-first summaries,
- cause/effect sequencing,
- analogy-first entry points,
- delayed technical drill-down,
- stable terminology.

### Reduced motion

Every animated asset should declare one of these fallbacks:

- static frame,
- manual step-through,
- text-only summary,
- diagram swap.

## Trigger system strategy

### Trigger inputs

The library should accept declared triggers from:

- `EngineOutputV1`
- canonical presentation models
- scenario comparison models
- timeline/simulation outputs already produced by Atlas modules
- explicit user intent such as “learn why” or “show deeper detail”

### Trigger flow

```text
Engine / canonical truth
  -> trigger adapters
  -> educational context
  -> registry resolver
  -> ranked asset list
  -> presentation renderer
```

### Important boundary

The trigger layer should classify relevance only.
It should not calculate missing physics or invent recommendations.

## Analogy system strategy

Analogy assets should become first-class records, not just clever components.

Each analogy should declare:

- the concepts it simplifies,
- the risk of misunderstanding,
- the audiences it helps most,
- the technical drill-down assets that should follow it,
- the conditions where the analogy should not be used.

Example pattern:

- `driving-style` introduces running-style differences,
- then links to `cycling_efficiency`, `standard_vs_mixergy`, or demand/system-response charts for deeper truth.

## Future topology renderer integration

The library should not own layout decisions for decks or portal pages.

Instead it should provide topology bindings that let a renderer ask:

- which asset best fits this page section,
- which fallback to use for this accessibility mode,
- which comparison asset pairs with this recommendation,
- which demand chart and response chart must stay synchronized.

This is especially important for:

- the Day Painter,
- presentation deck section visuals,
- portal scenario previews,
- current-system vs future-option explainers.

## Cognitive load budget

Each asset should carry a small explicit complexity declaration.

Recommended V1 fields:

- numeric score `1-5`,
- dominant idea count,
- interaction count,
- text density,
- motion level,
- escalation path.

Recommended policy:

- default customer flows should aim for a low combined budget,
- advanced drill-down should be intentional,
- compare views should declare higher load and require explicit entry,
- high-load assets should always have a lower-load companion asset.

## Migration approach

### Phase 1: inventory and contracts

- keep current assets in place,
- add canonical V1 contracts,
- document concepts, triggers, and migration destinations,
- build adapters around existing registries.

### Phase 2: shared registry consumption

- make overlay, portal, and presentation surfaces read from the new registry,
- keep legacy components as renderers behind registry records,
- unify trigger selection.

### Phase 3: asset extraction

- move reusable assets into `src/library/` folders,
- remove duplicated metadata maps,
- standardise reduced-motion and cognitive-load policies.

### Phase 4: adaptive comprehension

- enable audience and accessibility-aware asset selection,
- enable technical-depth drill-down chains,
- add topology-aware educational composition.

## Success criteria

The foundation is successful when Atlas can answer all of these without custom page logic:

- what asset explains this recommendation warning,
- what lower-load version should appear first,
- what deeper technical follow-up exists,
- what reduced-motion fallback is allowed,
- what concept this asset belongs to,
- what truth source it is allowed to depend on.
