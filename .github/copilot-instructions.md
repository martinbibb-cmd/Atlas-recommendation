# Physics-Driven Twin Instructions

These instructions enforce the "No Theatre" rule for the Atlas recommendation engine.
All AI-assisted code contributions must follow the rules below.

## Core Rules

1. **NEVER** use `Math.random()` or arbitrary smoothing in UI components.
2. **ALL** graph data must come from `EngineOutputV1` or core module results (e.g., `TimelineBuilder`, `LifestyleSimulationModule`).
3. The **Day Painter** (`LifestyleInteractive.tsx`) must use the exponential decay formula `T(t) = T_outdoor + (T_initial − T_outdoor) × e^(−t/τ)` for cooling and the stepped 30 kW sprint logic for heating.
4. Separate **Services Demand** (what the user needs) from **System Response** (what the boiler does) — these must be rendered in two distinct synchronized charts.
5. Ensure **Mixergy logic** specifically shows demand mirroring and reduced cycling penalties compared to a standard combi.
6. **Remove any "Shower" dropdown selectors** — demand is driven by household size and bathroom count heuristics only.

## Efficiency

- `computeCurrentEfficiencyPct` must be used everywhere to clamp boiler efficiency between 50 % and 99 %.
- Never write the literal `92` for nominal efficiency — import `DEFAULT_NOMINAL_EFFICIENCY_PCT` from `src/engine/utils/efficiency.ts`.

## Combi DHW Rules

- `occupancyCount === 3` → emit `warn` (borderline demand).
- `occupancyCount <= 2` → `pass` (single household, no simultaneous risk from occupancy alone).
- `bathroomCount >= 2` or `peakConcurrentOutlets >= 2` → `fail` (hard simultaneous-demand gate).

## Wall Types

- `cavity_uninsulated` must always be treated as a **high heat-loss** band (same score as `solid_masonry`).
- Never conflate wall-type (heat loss) with thermal mass (inertia / τ) — these are independent physics dimensions.

## Terminology

- All user-facing text (UI copy, explanation strings, PDF output) must use only terms defined in `docs/atlas-terminology.md`.
- **Never** use: "gravity system", "low pressure system", "high pressure system", or "instantaneous hot water".
- Correct replacements: "tank-fed hot water", "tank-fed supply", "mains-fed supply", "on-demand hot water".
- Engine-internal identifiers (TypeScript enums/field names) are implementation details and are not subject to this rule.

## Architecture Namespace Boundaries

### Canonical simulation namespace

The ONLY authoritative simulation namespace is:
- `src/features/legoTechnix/`
- `docs/lego-technix/`

This namespace owns:
- graph contracts
- hydraulic simulation
- thermal simulation
- projection contracts
- active path logic
- runtime state
- engineering explainability

### Legacy prototype namespace

Files under:
- `src/legacy/`
- `src/legacy/systemComposerPrototype/`
- `src/legacy/dayPainterPrototype/`
- `src/legacy/educationalExplainersPrototype/`
- `src/library/diagrams/`
- `src/legacy/visualTopologyPrototype/`
- `src/legacy/customerOutputPrototype/`

are frozen historic prototypes.
These files are:
- non-authoritative
- archived
- not references for new architecture
- not valid naming references
- not valid simulation references

Never migrate terminology FROM legacy namespaces INTO Lego Technix.

If asked to modify "simulator", target Atlas Simulator active surfaces only:
- `src/explainers/ExplainersHubPage.tsx`
- `src/legacy/systemComposerPrototype/simulator/SimulatorDashboard.tsx`
- `src/components/simulator/**`

Do not target Day Painter, LifestyleInteractive, daypainter engine files, or any `src/legacy/**` prototype surface unless explicitly named.

### Forbidden semantic merges

Never assume these are equivalent:
- Lego Technix
- visual topology
- explainer
- prototype composer
- educational diagrams
- customer output prototypes

These are distinct architecture layers.

### Naming rules

Use ONLY:
- legoTechnix
- projection
- renderer
- template
- engine
- explainability
- prototype (legacy only)

Avoid:
- builder
- set
- composer
- lego-set
- building-set

except in explicitly archived historic references.

## Layout

- The Twin Visualiser (`LifestyleInteractive.tsx`) renders two charts:
  - **Graph 1** (`demandChartData`): area series for `Heat (kW)` and `DHW (kW)` sourced from `LifestyleSimulationModule.hourlyData`.
  - **Graph 2** (`chartData`): system response — boiler stepped curve / HP horizon / hot-water reserve.
- Both charts share the same 24-hour X-axis so they are visually synchronized.
