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

## Terminology Overrides

- **Lego Technix** is the canonical name for the functional heating-system graph foundation.
- **Never** refer to the system as "Lego Builder", "Building Set", or "Lego Set" for functional graph or simulation references.
- Do not apply Lego Technix naming, contracts, or simulation assumptions to legacy builder-set files under `src/explainers/lego/`.

## Strict Naming & Directory Boundaries

### 1. Lego Technix

- **Path Focus:** `src/features/legoTechnix/` and `docs/lego-technix/`
- **Definition:** Active, authoritative physics-driven system graph and simulation engine.
- **Rule:** Simulation math, efficiency clamping, and graph logic changes must stay in this path.

### 2. Lego Builder Set (System Composer)

- **Path Focus:** `src/explainers/lego/` (including `src/explainers/lego/LegoBuildingSetPage.tsx`)
- **Definition:** Legacy visual component sandbox with drag-and-drop builder mechanics.
- **CRITICAL PROTECTION RULE:** Never suggest renaming, refactoring, or updating these legacy files to match Lego Technix paradigms. The domains are functionally isolated until explicit deprecation.

## Layout

- The Twin Visualiser (`LifestyleInteractive.tsx`) renders two charts:
  - **Graph 1** (`demandChartData`): area series for `Heat (kW)` and `DHW (kW)` sourced from `LifestyleSimulationModule.hourlyData`.
  - **Graph 2** (`chartData`): system response — boiler stepped curve / HP horizon / hot-water reserve.
- Both charts share the same 24-hour X-axis so they are visually synchronized.
