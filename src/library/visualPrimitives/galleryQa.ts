import { VISUAL_PRIMITIVE_REGISTRY, type VisualPrimitiveEntry } from './visualPrimitiveRegistry';

type PrimitiveCoverageStatus = 'rendered' | 'missing';

export interface PrimitiveGalleryCoverageEntry {
  status: PrimitiveCoverageStatus;
  note?: string;
}

export const CONTEXTUAL_RECOGNISABILITY_ALLOWED_IDS = new Set([
  'mixergy_cylinder',
  'thermal_store',
  'expansion_vessel',
  'circulation_pump',
  'filling_loop_valve',
  'abv',
  'magnetic_filter',
]);

export const GALLERY_RENDERED_REGISTRY_IDS = new Set([
  'combi_boiler',
  'system_boiler',
  'regular_boiler',
  'unvented_cylinder',
  'vented_cylinder',
  'mixergy_cylinder',
  'thermal_store',
  'panel_radiator',
  'circulation_pump',
  'powerflush_machine',
  'pipe_loop',
  'filling_loop_valve',
  'abv',
  'magnetic_filter',
  'pressure_gauge',
  'cold_water_storage_tank',
  'expansion_vessel',
]);

export const VISUAL_PRIMITIVE_GALLERY_COVERAGE: Record<string, PrimitiveGalleryCoverageEntry> = {
  combi_boiler: { status: 'rendered' },
  system_boiler: { status: 'rendered' },
  regular_boiler: { status: 'rendered' },
  unvented_cylinder: { status: 'rendered' },
  vented_cylinder: { status: 'rendered' },
  mixergy_cylinder: { status: 'rendered' },
  thermal_store: { status: 'rendered' },
  panel_radiator: { status: 'rendered' },
  circulation_pump: { status: 'rendered' },
  powerflush_machine: { status: 'rendered' },
  flow_pipe: {
    status: 'missing',
    note: 'Pipe segment primitive exists in diagrams but does not have a dedicated gallery card yet.',
  },
  pipe_loop: { status: 'rendered' },
  filling_loop_valve: { status: 'rendered' },
  abv: { status: 'rendered' },
  magnetic_filter: { status: 'rendered' },
  pressure_gauge: { status: 'rendered' },
  linear_flow_gauge: {
    status: 'missing',
    note: 'Linear gauge is a readout control and has no dedicated physical-equipment fixture card.',
  },
  cold_water_storage_tank: { status: 'rendered' },
  expansion_vessel: { status: 'rendered' },
  heat_flow_arrow: {
    status: 'missing',
    note: 'Heat-flow arrow is a flow annotation primitive and needs a dedicated fixture card.',
  },
  thermocline_boundary: {
    status: 'missing',
    note: 'Thermocline boundary is only shown inside mixergy visuals, not as a standalone card.',
  },
  flow_split: {
    status: 'missing',
    note: 'Flow-split visual exists in simulation contexts and is not yet surfaced in gallery cards.',
  },
  boiler_cycling_pattern: {
    status: 'missing',
    note: 'Boiler-cycling pattern is an abstract control explainer and currently has no fixture card.',
  },
};

function isCriticalImmediateRecognisabilityEntry(entry: VisualPrimitiveEntry): boolean {
  if (entry.category === 'boiler' || entry.category === 'radiator') return true;
  if (entry.category === 'cylinder') return entry.id !== 'mixergy_cylinder';
  return entry.id === 'pressure_gauge';
}

export interface VisualPrimitiveQaSummary {
  needsRebuildEntries: VisualPrimitiveEntry[];
  abstractPlaceholderEntries: VisualPrimitiveEntry[];
  recognisableWithContextEntries: VisualPrimitiveEntry[];
  criticalRecognisabilityFailures: VisualPrimitiveEntry[];
  contextualWithoutQaNote: VisualPrimitiveEntry[];
  contextualOutsideAllowedSet: VisualPrimitiveEntry[];
}

export function buildVisualPrimitiveQaSummary(
  entries: VisualPrimitiveEntry[] = VISUAL_PRIMITIVE_REGISTRY,
): VisualPrimitiveQaSummary {
  const needsRebuildEntries = entries.filter(entry => entry.recognisability === 'needs_rebuild');
  const abstractPlaceholderEntries = entries.filter(
    entry => entry.recognisability === 'abstract_placeholder',
  );
  const recognisableWithContextEntries = entries.filter(
    entry => entry.recognisability === 'recognisable_with_context',
  );

  const criticalRecognisabilityFailures = entries.filter(
    entry =>
      isCriticalImmediateRecognisabilityEntry(entry) &&
      entry.recognisability !== 'immediately_recognisable',
  );

  const contextualWithoutQaNote = recognisableWithContextEntries.filter(
    entry => CONTEXTUAL_RECOGNISABILITY_ALLOWED_IDS.has(entry.id) && !entry.qaNote?.trim(),
  );

  const contextualOutsideAllowedSet = recognisableWithContextEntries.filter(
    entry => !CONTEXTUAL_RECOGNISABILITY_ALLOWED_IDS.has(entry.id),
  );

  return {
    needsRebuildEntries,
    abstractPlaceholderEntries,
    recognisableWithContextEntries,
    criticalRecognisabilityFailures,
    contextualWithoutQaNote,
    contextualOutsideAllowedSet,
  };
}
