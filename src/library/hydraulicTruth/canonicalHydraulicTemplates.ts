import type { VisualTopologyId } from '../visualTopologies/visualTopologyRegistry';
import type {
  CanonicalHydraulicRuleSet,
  CanonicalHydraulicTemplateId,
  DiagramSimplificationRules,
  TopologyHydraulicTruthModel,
} from './types';

export const CANONICAL_HYDRAULIC_RULES: CanonicalHydraulicRuleSet = {
  componentPlacementRules: [
    'Heat source starts left; emitters and storage sit right to preserve left-to-right hydraulic readability.',
    'Radiator branches connect at lower radiator ports for service-realistic flow and return stubs.',
  ],
  flowReturnRules: [
    'Flow rail runs left-to-right on the top path and return rail runs right-to-left on the lower path.',
    'System protection components on return remain visibly upstream of boiler return entry.',
  ],
  closeCouplingRules: [
    'Open vent and cold feed in tank-fed layouts are close coupled near the low-pressure neutral point.',
  ],
  pressureRules: [
    'Sealed layouts show pressure management with expansion vessel and pressure gauge in the same hydraulic loop.',
    'Filling loops are temporary servicing links and must default to disconnected or ghosted presentation.',
  ],
  stratificationRules: [
    'Standard unvented cylinders do not show stratification bands or thermocline overlays.',
    'Mixergy layouts show explicit stratification and a visible thermocline boundary.',
  ],
  potablePrimarySeparationRules: [
    'Thermal stores must separate primary circuit water from potable water through internal exchange.',
  ],
  g3SafetyRoutingRules: [
    'Unvented safety discharge (D2) must route with continuous fall away from the cylinder.',
  ],
  pumpPlacementRules: [
    'Circulation pumps stay inline with return path routing in canonical closed-loop renderings.',
  ],
  abvPlacementRules: [
    'ABV sits after pump circulation drive and before flow restrictions to protect minimum circulation.',
  ],
  magneticFilterPlacementRules: [
    'Magnetic filters remain on return before boiler entry for debris interception.',
  ],
  fillingLoopRules: [
    'Normal-state diagrams show filling loops as temporary/disconnected servicing elements.',
  ],
};

export const CANONICAL_DIAGRAM_SIMPLIFICATIONS: Record<CanonicalHydraulicTemplateId, DiagramSimplificationRules> = {
  open_vented: {
    intentionallySimplified: [
      'Feed-and-expansion routing is shown as a compact tank-fed branch, not full loft routing.',
    ],
    cannotSimplifyWithoutMisleading: [
      'Do not remove close-coupled relationship between open vent and cold feed.',
    ],
  },
  sealed_unvented: {
    intentionallySimplified: [
      'Only core sealed-loop components are shown; minor service valves are omitted.',
    ],
    cannotSimplifyWithoutMisleading: [
      'Do not remove pressure vessel/gauge context or D2 safety discharge direction.',
      'Do not depict thermocline in standard unvented cylinder.',
    ],
  },
  combi: {
    intentionallySimplified: [
      'Internal combi plate exchanger is abstracted to on-demand hot water pipe stubs.',
    ],
    cannotSimplifyWithoutMisleading: [
      'Do not add cylinder-like storage cues to combi topology.',
    ],
  },
  mixergy: {
    intentionallySimplified: [
      'Charging path is reduced to key in/out stubs and omits secondary branch clutter.',
    ],
    cannotSimplifyWithoutMisleading: [
      'Do not remove thermocline and stratification cues.',
      'Do not frame Mixergy as a thermal store.',
    ],
  },
  thermal_store: {
    intentionallySimplified: [
      'Internal coil geometry is simplified while preserving potable/primary isolation.',
    ],
    cannotSimplifyWithoutMisleading: [
      'Do not merge potable and primary flow paths into one shared route.',
    ],
  },
  abv_protected_loop: {
    intentionallySimplified: [
      'Zone-valve detail is omitted; ABV bridge intent is emphasized.',
    ],
    cannotSimplifyWithoutMisleading: [
      'Do not place ABV downstream of restrictions that isolate bypass operation.',
    ],
  },
  magnetic_filter_protection: {
    intentionallySimplified: [
      'Filter internals are abstracted to a magnetite capture cue.',
    ],
    cannotSimplifyWithoutMisleading: [
      'Do not move filter away from return-before-boiler position.',
    ],
  },
  powerflush_setup: {
    intentionallySimplified: [
      'Hose and machine internals are reduced to dirty/clean path pairs.',
    ],
    cannotSimplifyWithoutMisleading: [
      'Do not reverse dirty/clean directional context for flushing paths.',
    ],
  },
};

export const HYDRAULIC_TRUTH_MODELS: TopologyHydraulicTruthModel[] = [
  {
    topologyId: 'open_vented_vented_cylinder',
    templateId: 'open_vented',
    hydraulicIntentSummary: 'Tank-fed hot water layout with close-coupled feed/vent and a traceable primary flow/return loop.',
    safetyNotes: ['Open vent route remains visible to avoid sealed-system interpretation mistakes.'],
    regulatoryNotes: ['Open-vented reference must keep vent and feed as a close-coupled pair.'],
    knownSimplifications: CANONICAL_DIAGRAM_SIMPLIFICATIONS.open_vented.intentionallySimplified,
    simplificationRules: CANONICAL_DIAGRAM_SIMPLIFICATIONS.open_vented,
    featureFlags: [
      'close_coupled_open_vent_and_cold_feed',
      'pump_inline_on_return',
      'no_top_fed_radiator_connections',
      'no_decorative_crossover_pipework',
    ],
    accessibilityCompatibility: {
      noLabelMode: true,
      monochromePrintSafeMode: true,
      reducedMotionMode: true,
      analogyOverlays: true,
    },
  },
  {
    topologyId: 'sealed_unvented_cylinder',
    templateId: 'sealed_unvented',
    hydraulicIntentSummary: 'Sealed heating loop with unvented hot water storage, pressure controls, and explicit G3 discharge fall.',
    safetyNotes: [
      'D2 safety discharge is shown as continuously falling pipework.',
      'Filling loop defaults to disconnected/ghosted service state.',
    ],
    regulatoryNotes: ['G3 safety routing is represented as a continuous-fall D2 path.'],
    knownSimplifications: CANONICAL_DIAGRAM_SIMPLIFICATIONS.sealed_unvented.intentionallySimplified,
    simplificationRules: CANONICAL_DIAGRAM_SIMPLIFICATIONS.sealed_unvented,
    featureFlags: [
      'pressure_controlled_loop',
      'filling_loop_disconnected_default',
      'unvented_standard_storage_visual',
      'd2_continuous_fall',
      'no_top_fed_radiator_connections',
      'no_decorative_crossover_pipework',
      'pump_inline_on_return',
    ],
    accessibilityCompatibility: {
      noLabelMode: true,
      monochromePrintSafeMode: true,
      reducedMotionMode: true,
      analogyOverlays: true,
    },
  },
  {
    topologyId: 'combi_direct_hot_water',
    templateId: 'combi',
    hydraulicIntentSummary: 'Combi layout showing on-demand hot water directly from boiler and no storage cylinder.',
    safetyNotes: ['No stored hot water cylinder path is presented in this template.'],
    regulatoryNotes: ['Mains-fed supply to combi is shown as direct inlet.'],
    knownSimplifications: CANONICAL_DIAGRAM_SIMPLIFICATIONS.combi.intentionallySimplified,
    simplificationRules: CANONICAL_DIAGRAM_SIMPLIFICATIONS.combi,
    featureFlags: ['on_demand_hot_water_path', 'no_top_fed_radiator_connections', 'no_decorative_crossover_pipework'],
    accessibilityCompatibility: {
      noLabelMode: true,
      monochromePrintSafeMode: true,
      reducedMotionMode: true,
      analogyOverlays: true,
    },
  },
  {
    topologyId: 'mixergy_stratified_cylinder',
    templateId: 'mixergy',
    hydraulicIntentSummary: 'Mixergy template with explicit top-hot and lower-cool layers separated by thermocline.',
    safetyNotes: ['Mixergy remains visually distinct from thermal-store primary-water semantics.'],
    regulatoryNotes: ['Stratification cue is mandatory for this template.'],
    knownSimplifications: CANONICAL_DIAGRAM_SIMPLIFICATIONS.mixergy.intentionallySimplified,
    simplificationRules: CANONICAL_DIAGRAM_SIMPLIFICATIONS.mixergy,
    featureFlags: ['thermocline_visualisation', 'mixergy_stratification', 'pump_inline_on_return', 'no_top_fed_radiator_connections', 'no_decorative_crossover_pipework'],
    accessibilityCompatibility: {
      noLabelMode: true,
      monochromePrintSafeMode: true,
      reducedMotionMode: true,
      analogyOverlays: true,
    },
  },
  {
    topologyId: 'thermal_store_layout',
    templateId: 'thermal_store',
    hydraulicIntentSummary: 'Thermal store template with primary-water storage and separate potable path through internal exchange.',
    safetyNotes: ['Potable and primary flows are intentionally separated in all views.'],
    regulatoryNotes: ['Diagram keeps potable and primary paths independent.'],
    knownSimplifications: CANONICAL_DIAGRAM_SIMPLIFICATIONS.thermal_store.intentionallySimplified,
    simplificationRules: CANONICAL_DIAGRAM_SIMPLIFICATIONS.thermal_store,
    featureFlags: ['thermal_store_potable_primary_separation', 'pump_inline_on_return', 'no_top_fed_radiator_connections', 'no_decorative_crossover_pipework'],
    accessibilityCompatibility: {
      noLabelMode: true,
      monochromePrintSafeMode: true,
      reducedMotionMode: true,
      analogyOverlays: true,
    },
  },
  {
    topologyId: 'powerflush_service_layout',
    templateId: 'powerflush_setup',
    hydraulicIntentSummary: 'Powerflush setup showing machine tie-in, dirty return extraction, and clean return reinjection.',
    safetyNotes: ['Service topology is instructional and not a permanent operating state.'],
    regulatoryNotes: ['Flow/return direction cues remain visible in print-safe and no-label views.'],
    knownSimplifications: CANONICAL_DIAGRAM_SIMPLIFICATIONS.powerflush_setup.intentionallySimplified,
    simplificationRules: CANONICAL_DIAGRAM_SIMPLIFICATIONS.powerflush_setup,
    featureFlags: ['powerflush_dirty_clean_paths', 'magnetic_filter_return_before_boiler', 'no_top_fed_radiator_connections'],
    accessibilityCompatibility: {
      noLabelMode: true,
      monochromePrintSafeMode: true,
      reducedMotionMode: true,
      analogyOverlays: true,
    },
  },
  {
    topologyId: 'abv_protected_heating_loop',
    templateId: 'abv_protected_loop',
    hydraulicIntentSummary: 'ABV-protected loop where bypass valve bridges flow/return after pump to preserve circulation.',
    safetyNotes: ['ABV stays before restrictions to maintain minimum circulation path.'],
    regulatoryNotes: ['ABV placement follows minimum-circulation safeguarding intent.'],
    knownSimplifications: CANONICAL_DIAGRAM_SIMPLIFICATIONS.abv_protected_loop.intentionallySimplified,
    simplificationRules: CANONICAL_DIAGRAM_SIMPLIFICATIONS.abv_protected_loop,
    featureFlags: [
      'abv_after_pump_before_restrictions',
      'pump_inline_on_return',
      'no_top_fed_radiator_connections',
      'no_decorative_crossover_pipework',
    ],
    accessibilityCompatibility: {
      noLabelMode: true,
      monochromePrintSafeMode: true,
      reducedMotionMode: true,
      analogyOverlays: true,
    },
  },
  {
    topologyId: 'magnetic_filter_on_return',
    templateId: 'magnetic_filter_protection',
    hydraulicIntentSummary: 'Return-path magnetic filter protection showing debris interception before boiler entry.',
    safetyNotes: ['Filter remains on return before boiler to match service practice.'],
    regulatoryNotes: ['Filter placement remains on boiler return side.'],
    knownSimplifications: CANONICAL_DIAGRAM_SIMPLIFICATIONS.magnetic_filter_protection.intentionallySimplified,
    simplificationRules: CANONICAL_DIAGRAM_SIMPLIFICATIONS.magnetic_filter_protection,
    featureFlags: ['magnetic_filter_return_before_boiler', 'no_top_fed_radiator_connections', 'no_decorative_crossover_pipework'],
    accessibilityCompatibility: {
      noLabelMode: true,
      monochromePrintSafeMode: true,
      reducedMotionMode: true,
      analogyOverlays: true,
    },
  },
  {
    topologyId: 'system_pressure_layout',
    templateId: 'sealed_unvented',
    hydraulicIntentSummary: 'Pressure reference view for sealed systems across low, normal, and high operating states.',
    safetyNotes: ['Pressure diagnostics are informational and not a full installation diagram.'],
    regulatoryNotes: ['Sealed pressure context remains tied to expansion-vessel behavior.'],
    knownSimplifications: CANONICAL_DIAGRAM_SIMPLIFICATIONS.sealed_unvented.intentionallySimplified,
    simplificationRules: CANONICAL_DIAGRAM_SIMPLIFICATIONS.sealed_unvented,
    featureFlags: ['pressure_controlled_loop'],
    accessibilityCompatibility: {
      noLabelMode: true,
      monochromePrintSafeMode: true,
      reducedMotionMode: true,
      analogyOverlays: true,
    },
  },
];

export const TOPOLOGY_TEMPLATE_MAP = Object.fromEntries(
  HYDRAULIC_TRUTH_MODELS.map((model) => [model.topologyId, model.templateId]),
) as Record<VisualTopologyId, CanonicalHydraulicTemplateId>;
