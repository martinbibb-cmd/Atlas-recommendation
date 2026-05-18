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
    abstractionLevel: 'physical_schematic',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
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
    abstractionLevel: 'physical_schematic',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
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
    abstractionLevel: 'physical_schematic',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
  },

  // ── Cylinders ───────────────────────────────────────────────────────────────

  {
    id: 'unvented_cylinder',
    category: 'cylinder',
    displayName: 'Unvented (Mains-Pressure) Cylinder',
    canonicalPurpose:
      'Sealed hot-water cylinder fed directly from the mains cold supply. Stores and delivers hot water at mains pressure. Requires PRV and expansion vessel.',
    sourceLocations: [
      'public/images/systems/unvented-cylinder.svg',
      'src/library/diagrams/primitives/WaterStoreTank.tsx',
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (cylinder rect)',
      'src/components/physics-visuals/visuals/CylinderChargeVisual.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_schematic',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
  },
  {
    id: 'vented_cylinder',
    category: 'cylinder',
    displayName: 'Vented (Tank-Fed) Cylinder',
    canonicalPurpose:
      'Hot-water cylinder fed from a cold-water storage tank in the loft. Open to atmosphere via vent pipe. Low-pressure supply — gravity-fed.',
    sourceLocations: [
      'public/images/systems/vented-cylinder.svg',
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (open-vented panel, cylinder rect)',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_schematic',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
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
    abstractionLevel: 'physical_schematic',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'The thermocline boundary distinguishes Mixergy from a standard cylinder visually. Verify this is perceptible without colour in print mode.',
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
    abstractionLevel: 'physical_schematic',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'Must visually distinguish from a standard cylinder. The internal coil element is the key differentiator.',
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
    abstractionLevel: 'physical_schematic',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
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
    abstractionLevel: 'physical_schematic',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'The P&ID circle-with-arrow convention is recognisable to engineers but may need a brief label for homeowners.',
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
    abstractionLevel: 'physical_schematic',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
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
  },
  {
    id: 'pipe_loop',
    category: 'pipework',
    displayName: 'Heating Circuit Loop',
    canonicalPurpose:
      'Closed loop showing the full central heating circuit: boiler → flow → emitters → return → boiler. Communicates sealed vs open-vented topology.',
    sourceLocations: [
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (loop path)',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_schematic',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
  },

  // ── Valves ──────────────────────────────────────────────────────────────────

  {
    id: 'filling_loop_valve',
    category: 'valve',
    displayName: 'Filling Loop (Isolation Valves)',
    canonicalPurpose:
      'Temporary connection between mains cold supply and sealed heating circuit used to re-pressurise. Two isolation valve dots show it is closed when not in use.',
    sourceLocations: [
      'src/library/diagrams/OpenVentedToUnventedDiagram.tsx (filling-loop and valve-dot elements)',
      'src/library/visualPrimitives/primitives/FillingLoopPrimitive.tsx',
    ],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_schematic',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'Two valve dots on the filling-loop pipe are the visual cue. Ensure they are distinct at 320px mobile width.',
  },
  {
    id: 'abv',
    category: 'valve',
    displayName: 'Automatic Bypass Valve (ABV)',
    canonicalPurpose:
      'Pressure-relief bypass valve installed on the heating circuit to prevent excessive pressure when all thermostatic radiator valves close simultaneously.',
    sourceLocations: [],
    reuseStatus: 'canonical_extracted',
    abstractionLevel: 'physical_schematic',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'No existing rendering found in the codebase. BoilerPrimitive or PipeLoopPrimitive may incorporate this in future topology diagrams.',
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
    abstractionLevel: 'physical_schematic',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
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
    abstractionLevel: 'physical_schematic',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
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
    abstractionLevel: 'physical_schematic',
    recognisability: 'immediately_recognisable',
    printSafe: true,
    motionSafe: true,
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
    abstractionLevel: 'physical_schematic',
    recognisability: 'recognisable_with_context',
    printSafe: true,
    motionSafe: true,
    qaNote:
      'The diaphragm split inside the vessel body is the key visual differentiator from a plain storage tank.',
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
