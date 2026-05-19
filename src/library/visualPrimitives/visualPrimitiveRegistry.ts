/**
 * visualPrimitiveRegistry.ts
 *
 * Canonical visual primitive registry for the Atlas heating system library.
 *
 * This file is the single source of truth for every reusable physical-object
 * visual that has been identified or extracted across the codebase.
 *
 * Architecture layer: Physical truth layer only.
 * No analogies. No traffic/medical/electrical overlays. Just recognisable
 * heating-system objects that a homeowner can identify without labels.
 *
 * Populating rules:
 *   - id: snake_case, globally unique
 *   - category: one of VisualPrimitiveCategory
 *   - canonicalPurpose: what physics truth this primitive communicates
 *   - sourceLocations: every file where equivalent rendering currently exists
 *   - reuseStatus: whether the primitive is already reused, inline-only, or scattered
 *   - abstractionLevel: how abstracted from actual equipment the shape is
 *   - recognisability: homeowner QA score — can they identify without labels?
 *   - printSafe: safe to render in print/PDF without motion or colour-only cues
 *   - motionSafe: reduced-motion variant exists or motion is never required
 */

// ─── Category ──────────────────────────────────────────────────────────────────

export type VisualPrimitiveCategory =
  | 'boiler'
  | 'cylinder'
  | 'thermal_store'
  | 'radiator'
  | 'pump'
  | 'pipework'
  | 'valve'
  | 'filter'
  | 'gauge'
  | 'tank'
  | 'heat_flow'
  | 'water_flow'
  | 'warning'
  | 'sensor'
  | 'control';

// ─── Recognisability ───────────────────────────────────────────────────────────

/**
 * QA rating for homeowner recognisability without labels.
 *
 * immediately_recognisable  — a plumber or homeowner identifies it instantly.
 * recognisable_with_context — identifiable when shown alongside other equipment.
 * abstract_placeholder      — communicates a concept but not a specific object.
 * needs_rebuild             — currently generic SaaS art; must be redrawn as
 *                            real equipment before customer exposure.
 */
export type VisualPrimitiveRecognisability =
  | 'immediately_recognisable'
  | 'recognisable_with_context'
  | 'abstract_placeholder'
  | 'needs_rebuild';

// ─── Reuse status ─────────────────────────────────────────────────────────────

export type VisualPrimitiveReuseStatus =
  | 'canonical_extracted'   // lives in src/library/visualPrimitives/primitives/ — use this
  | 'inline_multiple'       // same shape duplicated inline across N files — extract candidate
  | 'inline_single'         // exists only inside one diagram/explainer — candidate once needed
  | 'svg_asset_only';       // exists only as a static SVG file in /public

// ─── Abstraction level ────────────────────────────────────────────────────────

export type VisualPrimitiveAbstractionLevel =
  | 'physical_accurate'   // matches real equipment silhouette/proportions
  | 'physical_schematic'  // simplified but equipment-shaped (standard P&ID style)
  | 'iconic'              // icon-level simplification, still recognisable
  | 'abstract';           // purely conceptual — shape conveys no equipment identity

export type HumanVisualReviewState =
  | 'passed'
  | 'human_visual_review_required';

// ─── Registry entry ───────────────────────────────────────────────────────────

export interface VisualPrimitiveEntry {
  /** Globally unique identifier in snake_case. */
  id: string;
  /** Equipment category. */
  category: VisualPrimitiveCategory;
  /** Human-readable display name. */
  displayName: string;
  /** What physical truth or equipment behaviour this primitive communicates. */
  canonicalPurpose: string;
  /** Every file path where equivalent rendering currently exists. */
  sourceLocations: string[];
  /** Whether a canonical extracted component exists or this is still scattered. */
  reuseStatus: VisualPrimitiveReuseStatus;
  /** How closely the shape resembles real equipment. */
  abstractionLevel: VisualPrimitiveAbstractionLevel;
  /** Homeowner recognisability QA without labels. */
  recognisability: VisualPrimitiveRecognisability;
  /** Safe to render in print/PDF without losing meaning. */
  printSafe: boolean;
  /** Reduced-motion variant exists or motion is never required. */
  motionSafe: boolean;
  /**
   * Optional notes for the QA reviewer — e.g. specific deficiencies that
   * must be fixed before this primitive is marked customer-ready.
   */
  qaNote?: string;
  /** Manual no-label recognition gate that can override metadata-only compliance. */
  humanVisualReviewState: HumanVisualReviewState;
  /** Why human review is still required, even if automated checks are green. */
  humanVisualReviewNote?: string;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const VISUAL_PRIMITIVE_REGISTRY: VisualPrimitiveEntry[] = [

  // ── Boilers ─────────────────────────────────────────────────────────────────

  {
    id: 'combi_boiler',
    category: 'boiler',
    displayName: 'Combination Boiler',
    canonicalPurpose:
      'Wall-mounted gas appliance that heats central heating water and produces on-demand hot water. No cylinder required. High flow-temperature dependence.',
    sourceLocations: [
      'public/images/systems/combination.svg',
      'src/components/physics-visuals/visuals/ThermalStoreVisual.tsx (boiler sub-element)',
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (boiler rect)',
      'src/library/diagrams/MagneticFilterDiagram.tsx (boiler rect)',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'passed',
  },
  {
    id: 'system_boiler',
    category: 'boiler',
    displayName: 'System Boiler',
    canonicalPurpose:
      'Wall-mounted boiler with internal pump and expansion vessel. Requires a separate cylinder for stored hot water. Drives a sealed heating circuit.',
    sourceLocations: [
      'public/images/systems/system-boiler.svg',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'passed',
  },
  {
    id: 'regular_boiler',
    category: 'boiler',
    displayName: 'Regular Boiler',
    canonicalPurpose:
      'Heat-only wall-mounted boiler serving heating flow/return with a separate cylinder and external pump arrangement.',
    sourceLocations: [
      'public/images/systems/regular-boiler.svg',
      'src/library/visualPrimitives/primitives/BoilerPrimitive.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'passed',
  },

  // ── Cylinders ───────────────────────────────────────────────────────────────

  {
    id: 'unvented_cylinder',
    category: 'cylinder',
    displayName: 'Unvented (Mains-fed) Cylinder',
    canonicalPurpose:
      'Sealed hot-water cylinder fed directly from the mains cold supply. Stores and delivers hot water at mains pressure. Requires PRV and expansion vessel.',
    sourceLocations: [
      'public/images/systems/unvented-cylinder.svg',
      'src/library/diagrams/primitives/WaterStoreTank.tsx',
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (cylinder rect)',
      'src/components/physics-visuals/visuals/CylinderChargeVisual.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Lower coil, tundish/discharge cue, and connected topology ports still need manual no-label review before this can be trusted as customer-ready.',
  },
  {
    id: 'vented_cylinder',
    category: 'cylinder',
    displayName: 'Vented (Tank-Fed) Cylinder',
    canonicalPurpose:
      'Hot-water cylinder fed from a cold-water storage tank in the loft. Open to atmosphere via vent pipe with tank-fed supply.',
    sourceLocations: [
      'public/images/systems/vented-cylinder.svg',
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (open-vented panel, cylinder rect)',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Vented cylinder still needs manual no-label review for tank-fed venting and coil readability before it can override the gate.',
  },
  {
    id: 'mixergy_cylinder',
    category: 'cylinder',
    displayName: 'Mixergy Smart Cylinder',
    canonicalPurpose:
      'Stratified cylinder with top-down charging. Hot zone builds from the top downward, enabling a smaller vessel to deliver equivalent usable hot water compared to a conventional cylinder at full charge.',
    sourceLocations: [
      'src/components/visualizers/MixergyTankVisualizer.tsx',
      'src/components/physics-visuals/visuals/CylinderChargeVisual.tsx (mixergyMode=true)',
      'src/library/diagrams/StratifiedCylinderMixergyDiagram.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'Keep a clean smart-cylinder silhouette with a sharp horizontal thermocline, top-heating cue, and bottom diffuser; avoid hose-heavy external pipework.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Mixergy remains blocked until a reviewer confirms it is distinguishable from a standard cylinder without labels.',
  },

  // ── Thermal store ──────────────────────────────────────────────────────────

  {
    id: 'thermal_store',
    category: 'thermal_store',
    displayName: 'Thermal Store',
    canonicalPurpose:
      'Large insulated vessel that stores primary heating water at high temperature (75–85 °C). Domestic hot water is produced via an internal heat exchanger coil — the stored water is never directly consumed.',
    sourceLocations: [
      'src/components/physics-visuals/visuals/ThermalStoreVisual.tsx',
      'src/library/visualPrimitives/primitives/ThermalStorePrimitive.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'Must remain distinct from Mixergy by showing primary-water storage with a dedicated potable separation path (coil/heat exchanger).',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Thermal store remains blocked until a reviewer confirms the separate potable heat-exchange path reads without labels.',
  },

  // ── Radiators ───────────────────────────────────────────────────────────────

  {
    id: 'panel_radiator',
    category: 'radiator',
    displayName: 'Panel Radiator',
    canonicalPurpose:
      'Flat panel heat emitter. Delivers space heating via convection and radiation. Surface temperature depends on flow temperature and panel size.',
    sourceLocations: [
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (rad rects)',
      'src/library/diagrams/primitives/RadiatorHeatMap.tsx',
      'src/library/diagrams/WarmVsHotRadiatorsDiagram.tsx',
      'src/components/whatif/RadiatorUpgradeAnimation.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'passed',
  },

  // ── Pumps ───────────────────────────────────────────────────────────────────

  {
    id: 'circulation_pump',
    category: 'pump',
    displayName: 'Circulation Pump',
    canonicalPurpose:
      'Drives heated water around the central heating circuit. Usually located on the boiler flow or return pipe. Represented as a circle with an impeller symbol in P&ID schematics.',
    sourceLocations: [
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (pump circle)',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'Render as an inline Grundfos/Wilo-style circulator body with visible pipe entry/exit; avoid P&ID-only circle symbols.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Pump still needs human confirmation that the inline circulator reads as equipment without context labels.',
  },
  {
    id: 'powerflush_machine',
    category: 'pump',
    displayName: 'Powerflush Machine',
    canonicalPurpose:
      'Service pump-and-reservoir unit used to circulate cleaning fluid through a heating circuit during condition-led flushing work.',
    sourceLocations: [
      'src/library/visualPrimitives/primitives/PowerflushMachinePrimitive.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'passed',
  },

  // ── Pipework ────────────────────────────────────────────────────────────────

  {
    id: 'flow_pipe',
    category: 'pipework',
    displayName: 'Flow Pipe',
    canonicalPurpose:
      'Primary heating circuit flow pipe — carries heated water from boiler to emitters. Conventionally shown in red.',
    sourceLocations: [
      'src/library/diagrams/primitives/FlowLine.tsx',
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (pipe lines)',
      'src/library/diagrams/MagneticFilterDiagram.tsx (pipe/path elements)',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_schematic',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Pipe-only visuals are schematic cues, not standalone no-label equipment drawings.',
  },
  // ── Valves ──────────────────────────────────────────────────────────────────

  {
    id: 'filling_loop_valve',
    category: 'valve',
    displayName: 'Filling Loop (Isolation Valves)',
    canonicalPurpose:
      'Temporary braided-hose connection between mains cold supply and sealed heating circuit used to re-pressurise, with isolation valves at each end.',
    sourceLocations: [
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (filling-loop and valve-dot elements)',
      'src/library/visualPrimitives/primitives/FillingLoopPrimitive.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'Show a braided flexible hose with two isolation valves in a default disconnected/ghosted service state.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Filling loop remains blocked until a reviewer confirms the disconnected service state is recognisable without its label.',
  },
  {
    id: 'abv',
    category: 'valve',
    displayName: 'Automatic Bypass Valve (ABV)',
    canonicalPurpose:
      'Pressure-relief bypass valve installed on the heating circuit to prevent excessive pressure when all thermostatic radiator valves close simultaneously.',
    sourceLocations: [],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'Render as a compact bypass valve body with an angled adjustment head on a flow-to-return bridge, not a generic valve icon.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'ABV remains blocked until a reviewer confirms the bypass body reads as a real valve rather than a generic symbol.',
  },

  // ── Filters ─────────────────────────────────────────────────────────────────

  {
    id: 'magnetic_filter',
    category: 'filter',
    displayName: 'Magnetic Filter',
    canonicalPurpose:
      'In-line filter body on the heating return pipe. A removable magnet core captures magnetite particles (black iron oxide sludge) before they reach the boiler heat exchanger.',
    sourceLocations: [
      'src/library/diagrams/MagneticFilterDiagram.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Magnetic filter remains blocked pending human review of the serviceable filter body in no-label mode.',
  },

  // ── Gauges ──────────────────────────────────────────────────────────────────

  {
    id: 'pressure_gauge',
    category: 'gauge',
    displayName: 'System Pressure Gauge',
    canonicalPurpose:
      'Circular analogue gauge indicating central heating circuit static pressure. Normal operating range 1.0–1.5 bar shown as a green band sector.',
    sourceLocations: [
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (gauge-face circle, gauge-needle, gauge-band)',
      'src/library/diagrams/SystemPressureWindowDiagram.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'passed',
  },
  {
    id: 'linear_flow_gauge',
    category: 'gauge',
    displayName: 'Linear Flow / Pressure Gauge',
    canonicalPurpose:
      'Horizontal linear gauge for flow rate (L/min) or dynamic pressure (bar). Used for water performance readouts from site surveys.',
    sourceLocations: [
      'src/components/behaviour/WaterPerformanceGauge.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'abstract',
    recognisability: 'abstract_placeholder',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'Abstract progress-bar form — does not look like a physical gauge. Acceptable for numeric data readout contexts. Do not use as an equipment symbol.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Abstract data readout must stay blocked from visual compliance because it is not a physical object drawing.',
  },

  // ── Tanks ───────────────────────────────────────────────────────────────────

  {
    id: 'cold_water_storage_tank',
    category: 'tank',
    displayName: 'Cold Water Storage Tank (Loft)',
    canonicalPurpose:
      'Rectangular loft tank providing tank-fed supply to a vented cylinder in open-vented hot-water layouts.',
    sourceLocations: [
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (tank rect in open-vented panel)',
      'src/library/diagrams/primitives/WaterStoreTank.tsx',
      'src/library/visualPrimitives/primitives/HeaderTankPrimitive.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'passed',
  },

  // ── Expansion vessel ────────────────────────────────────────────────────────

  {
    id: 'expansion_vessel',
    category: 'tank',
    displayName: 'Expansion Vessel',
    canonicalPurpose:
      'Sealed pressurised vessel with an internal rubber diaphragm. Absorbs the small volume increase of heating water as it warms, preventing pressure spikes in a sealed circuit.',
    sourceLocations: [
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (vessel ellipse + diaphragm path)',
      'public/images/systems/unvented-cylinder.svg (expansion vessel ellipse)',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_accurate',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'Render as a red/grey pressure vessel silhouette with diaphragm split and mounting/bracket cue so it does not read as a generic tank.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Expansion vessel remains blocked until a reviewer confirms the vessel silhouette is recognisable without text.',
  },

  // ── Heat flow ───────────────────────────────────────────────────────────────

  {
    id: 'heat_flow_arrow',
    category: 'heat_flow',
    displayName: 'Heat Flow Arrow',
    canonicalPurpose:
      'Directional arrow indicating movement of thermal energy through pipework or across an interface. Colour (red/orange = hot, blue = cool) communicates temperature direction.',
    sourceLocations: [
      'src/library/diagrams/primitives/FlowLine.tsx',
      'src/library/diagrams/primitives/HeatGradientBar.tsx',
      'src/components/physics-visuals/visuals/HeatParticlesVisual.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'iconic',
    recognisability: 'immediately_recognisable',
    printSafe: false,
    motionSafe: true,
    qaNote:
      'printSafe=false because colour-only coding (red/blue) loses meaning in monochrome print. A dashed/solid line pattern must be used as a secondary cue.',
    humanVisualReviewState: 'passed',
  },
  {
    id: 'thermocline_boundary',
    category: 'heat_flow',
    displayName: 'Thermocline Boundary',
    canonicalPurpose:
      'The sharp horizontal boundary between the hot upper zone and cooler lower zone inside a stratified cylinder. Critical to communicating Mixergy and stratification physics.',
    sourceLocations: [
      'src/library/diagrams/StratifiedCylinderMixergyDiagram.tsx (thermocline--sharp line)',
      'src/components/physics-visuals/visuals/CylinderChargeVisual.tsx (ccv__mx-boundary)',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_schematic',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Thermocline marker is a contextual internal cue and cannot satisfy no-label equipment review on its own.',
  },

  // ── Water flow ──────────────────────────────────────────────────────────────

  {
    id: 'flow_split',
    category: 'water_flow',
    displayName: 'Flow Split (Outlet Demand)',
    canonicalPurpose:
      'Visual showing how available flow is divided across simultaneously active outlets. Stream width or bar width communicates delivered flow per outlet.',
    sourceLocations: [
      'src/components/physics-visuals/visuals/FlowSplitVisual.tsx',
      'src/library/diagrams/FlowRestrictionBottleneckDiagram.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'iconic',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Flow-split graphic is still a contextual explainer, not a self-sufficient no-label equipment drawing.',
  },

  // ── Controls ────────────────────────────────────────────────────────────────

  {
    id: 'boiler_cycling_pattern',
    category: 'control',
    displayName: 'Boiler Cycling Pattern',
    canonicalPurpose:
      'Bar-chart pattern showing alternating fire/idle cycles. Communicates boiler short-cycling caused by oversizing or poor control. Animated in interactive contexts.',
    sourceLocations: [
      'src/components/whatif/BoilerCyclingAnimation.tsx',
      'src/components/whatif/visuals/ControlsVisual.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'abstract',
    recognisability: 'abstract_placeholder',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'Abstract bar pattern — not a physical object. Appropriate as a concept explainer but should always accompany a physical boiler visual in customer-facing contexts.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Cycling bars are a behaviour explainer and must stay blocked by the human visual review gate.',
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/** Look up a single entry by its id. */
export function getPrimitiveById(id: string): VisualPrimitiveEntry | undefined {
  return VISUAL_PRIMITIVE_REGISTRY.find(p => p.id === id);
}

/** All entries in a given category. */
export function getPrimitivesByCategory(
  category: VisualPrimitiveCategory,
): VisualPrimitiveEntry[] {
  return VISUAL_PRIMITIVE_REGISTRY.filter(p => p.category === category);
}

/** Entries that still need extraction to a canonical file. */
export function getPrimitivesNeedingExtraction(): VisualPrimitiveEntry[] {
  return VISUAL_PRIMITIVE_REGISTRY.filter(
    p => p.reuseStatus === 'inline_multiple' || p.reuseStatus === 'inline_single',
  );
}

/** Entries failing the homeowner recognisability acceptance test. */
export function getPrimitivesNeedingRebuild(): VisualPrimitiveEntry[] {
  return VISUAL_PRIMITIVE_REGISTRY.filter(
    p =>
      p.recognisability === 'needs_rebuild' ||
      p.recognisability === 'abstract_placeholder',
  );
}
