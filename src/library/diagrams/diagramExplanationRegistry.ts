import type { VisualReadinessMetadata } from '../visualReadiness';

export interface DiagramExplanationEntry extends VisualReadinessMetadata {
  diagramId: string;
  title: string;
  conceptIds: string[];
  misconceptionsTargeted: string[];
  journeyIds: string[];
  screenReaderSummary: string;
  whatThisMeans: string;
}

export const diagramExplanationRegistry: DiagramExplanationEntry[] = [
  {
    diagramId: 'pressure_vs_storage',
    title: 'Pressure vs storage',
    visualStatus: 'production_ready',
    customerReady: true,
    conceptIds: ['pressure_vs_storage', 'STR-01', 'premium_hot_water_performance'],
    misconceptionsTargeted: [
      'Cylinders mean weak pressure.',
      'Stored hot water is outdated.',
      'Combi boilers always have better pressure.',
    ],
    journeyIds: ['open_vented_to_sealed_unvented', 'regular_to_regular_unvented'],
    screenReaderSummary:
      'Diagram showing how an unvented cylinder uses mains pressure to supply multiple outlets simultaneously. The cylinder stores hot water at mains pressure, so flow to showers and taps overlaps without a pump.',
    whatThisMeans:
      'An unvented cylinder stores water at mains pressure. Multiple outlets can run at the same time without a pump. The cylinder does not weaken pressure — it preserves it.',
  },
  {
    diagramId: 'warm_vs_hot_radiators',
    title: 'Warm vs hot radiators',
    visualStatus: 'production_ready',
    customerReady: true,
    conceptIds: ['hot_radiator_expectation', 'flow_temperature_living_with_it', 'CON-01'],
    misconceptionsTargeted: [
      'Warm radiators mean the heating is failing.',
      'Heat pumps cannot heat a home properly.',
      'Higher flow temperature always means more comfort.',
    ],
    journeyIds: ['heat_pump_reality'],
    screenReaderSummary:
      'Diagram comparing a heat pump running warm radiators at 45°C continuously against a conventional boiler running hotter radiators in shorter bursts. Both achieve the same room temperature. The heat pump approach uses lower peak temperatures for longer periods.',
    whatThisMeans:
      'Heat pumps deliver comfort at lower radiator temperatures over longer run times. Radiators that feel warm rather than hot are working correctly, not failing.',
  },
  {
    diagramId: 'water_main_limitation',
    title: 'Water main limitation',
    visualStatus: 'production_ready',
    customerReady: true,
    conceptIds: ['water_main_limit_not_boiler_limit', 'microbore_flow_limits'],
    misconceptionsTargeted: [
      'A bigger boiler gives better flow.',
      "Poor pressure is the boiler's fault.",
      'Upgrading the boiler fixes low flow.',
    ],
    journeyIds: ['water_constraint_reality'],
    screenReaderSummary:
      'Diagram showing the incoming water main as the fixed flow limit. The boiler or cylinder sits downstream and cannot increase the incoming flow rate. Multiple outlets drawing at once divide the available mains flow.',
    whatThisMeans:
      'The incoming water main sets the maximum flow. No boiler or cylinder can create more flow than the main supplies. Running multiple outlets at once divides the available flow between them.',
  },
  {
    diagramId: 'open_vented_to_unvented',
    title: 'Open-vented to sealed + unvented',
    visualStatus: 'production_ready',
    customerReady: true,
    conceptIds: ['open_vented_to_unvented_upgrade', 'sealed_system_conversion', 'pressure_vs_storage'],
    misconceptionsTargeted: [
      'Removing loft tanks weakens the heating.',
      'Sealed systems are more complicated to live with.',
      'Upgrading means losing the existing heating strengths.',
    ],
    journeyIds: ['open_vented_to_sealed_unvented'],
    screenReaderSummary:
      'Two-panel comparison. Left: open-vented setup with loft cold-water storage tank, vented cylinder, boiler, pump, and open vent path. Right: sealed system with boiler, pump, sealed-system cylinder, expansion vessel cutaway, filling-loop cue, and pressure gauge in the normal operating zone.',
    whatThisMeans:
      'The upgrade changes heating from an open vented path with loft-tank dependence to a sealed pressure-managed loop with expansion-vessel protection and controlled top-up practice.',
  },
  {
    diagramId: 'stratified_cylinder_mixergy',
    title: 'Stratified cylinder (Mixergy) cutaway',
    visualStatus: 'production_ready',
    customerReady: true,
    conceptIds: ['STR-01', 'stored_hot_water_efficiency', 'premium_hot_water_performance'],
    misconceptionsTargeted: [
      'A hot-water cylinder heats uniformly from top to bottom.',
      'Stratification is just marketing language.',
      'Useful draw-off only improves if the full cylinder is heated.',
    ],
    journeyIds: ['open_vented_to_sealed_unvented', 'regular_to_regular_unvented'],
    screenReaderSummary:
      'Side-by-side cylinder cutaway. Traditional cylinder shows broader blending and lukewarm middle water. Stratified Mixergy cylinder keeps a clear hot top layer, cold lower layer, and a sharper thermocline during draw-off.',
    whatThisMeans:
      'A stratified cylinder protects a usable hot layer at the top instead of blending the full store lukewarm, so household draw-off stays more predictable.',
  },
  {
    diagramId: 'powerflush_condition_led',
    title: 'Condition-led Powerflush',
    visualStatus: 'production_ready',
    customerReady: true,
    conceptIds: ['MNT-01', 'MNT-02', 'flow_restriction', 'system_work_explainer'],
    misconceptionsTargeted: [
      'Powerflushing is always required regardless of circuit condition.',
      'Cleaning is cosmetic rather than hydraulic.',
      'Dirty circuit water has no effect on radiator balance or pump load.',
    ],
    journeyIds: ['open_vented_to_sealed_unvented', 'water_constraint_reality'],
    screenReaderSummary:
      'Before and after heating-loop diagram. Before shows dirty return path and patchy radiator heating. After shows a flushing machine with dirty water extraction and clean return path restoring more even heat.',
    whatThisMeans:
      'Powerflushing is condition-led: when contamination restricts flow, targeted cleaning can restore circulation and radiator performance.',
  },
  {
    diagramId: 'magnetic_filter_capture',
    title: 'Magnetic filter capture path',
    visualStatus: 'production_ready',
    customerReady: true,
    conceptIds: ['MNT-01', 'MNT-02', 'HYD-03'],
    misconceptionsTargeted: [
      'A magnetic filter is optional decoration.',
      'Debris stays harmless once the system is running.',
      'Filter position does not matter.',
    ],
    journeyIds: ['open_vented_to_sealed_unvented', 'water_constraint_reality'],
    screenReaderSummary:
      'Return pipe passes through a magnetic filter body before the boiler. A removable magnetic core captures dark magnetite particles while cleaner return water continues to the boiler.',
    whatThisMeans:
      'A magnetic filter on the return helps protect the boiler and pump by capturing iron debris before it circulates through sensitive components.',
  },
  {
    diagramId: 'system_pressure_window',
    title: 'Sealed-system pressure window',
    visualStatus: 'production_ready',
    customerReady: true,
    conceptIds: ['HYD-02', 'SAF-02'],
    misconceptionsTargeted: [
      'Higher pressure always means better heating.',
      'Repeated top-up is normal and harmless.',
      'Gauge movement between hot and cold means immediate failure.',
    ],
    journeyIds: ['open_vented_to_sealed_unvented', 'water_constraint_reality'],
    screenReaderSummary:
      'Pressure gauge with low, healthy, and high zones. The healthy band is centred around normal cold-fill values while warning zones call out low-circulation and high-pressure discharge risks.',
    whatThisMeans:
      'Stable pressure in the healthy zone supports reliable circulation; persistent low or high readings should be checked rather than ignored.',
  },
  {
    diagramId: 'system_fit_decision_map',
    title: 'System fit decision map',
    visualStatus: 'placeholder',
    customerReady: false,
    replacementNeededReason: 'Current schematic reads like an internal decision map rather than a customer visual.',
    conceptIds: ['system_fit_explanation', 'system_work_explainer', 'scope_clarity'],
    misconceptionsTargeted: [
      'There is one universally best system type for every home.',
      'System fit is chosen by brand preference rather than measured constraints.',
      'Scope and fit are separate conversations.',
    ],
    journeyIds: [
      'open_vented_to_sealed_unvented',
      'regular_to_regular_unvented',
      'heat_pump_reality',
      'water_constraint_reality',
    ],
    screenReaderSummary:
      'Decision map showing how your recommendation is matched to your home: demand pattern, supply limits, distribution constraints, and comfort goals. Different homes can need different system routes for practical day-to-day results.',
    whatThisMeans:
      'Your recommendation is tailored to your home and routines, so comfort and hot-water performance stay reliable when daily demand rises.',
  },
  {
    diagramId: 'stored_hot_water_recovery_timeline',
    title: 'Stored hot water recovery timeline',
    visualStatus: 'draft',
    customerReady: false,
    replacementNeededReason: 'Timeline needs a more designed reserve-and-recovery treatment for customer use.',
    conceptIds: ['system_work_explainer', 'stored_hot_water_efficiency', 'operating_behaviour'],
    misconceptionsTargeted: [
      'Stored hot water output is identical at all times of day.',
      'Recovery behaviour means the system is faulty.',
      'Pressure and recovery are the same performance dimension.',
    ],
    journeyIds: ['open_vented_to_sealed_unvented', 'regular_to_regular_unvented'],
    screenReaderSummary:
      'Timeline showing stored hot water use and recovery: morning draw, recovery period, daytime top-up, evening draw, and overnight recovery. Available hot water changes with use pattern and recharge time.',
    whatThisMeans:
      'Stored hot water performance is about thermal capacity and recovery time. Heavy draws are followed by recovery, and this is normal system behaviour.',
  },
  {
    diagramId: 'warm_radiator_emitter_sizing',
    title: 'Warm radiator and emitter sizing comparison',
    visualStatus: 'draft',
    customerReady: false,
    replacementNeededReason: 'Current emitter diagram is too technical for the portal journey.',
    conceptIds: ['emitter_sizing', 'flow_temperature', 'flow_temperature_living_with_it'],
    misconceptionsTargeted: [
      'Warm radiators always mean poor heating performance.',
      'Flow temperature can be assessed without emitter sizing.',
      'If radiators are not hot, the system must be failing.',
    ],
    journeyIds: ['heat_pump_reality'],
    screenReaderSummary:
      'Comparison diagram: correctly sized emitter with warm flow temperature delivers stable room comfort; undersized emitter at the same flow temperature struggles to match room heat loss.',
    whatThisMeans:
      'Warm radiators can deliver comfort when emitter sizing matches room heat loss. If emitters are undersized, comfort may require emitter upgrades or flow-temperature changes.',
  },
  {
    diagramId: 'flow_restriction_bottleneck',
    title: 'Flow restriction bottleneck',
    visualStatus: 'draft',
    customerReady: false,
    replacementNeededReason: 'Needs a calmer customer illustration with less schematic pipe detail.',
    conceptIds: [
      'flow_restriction',
      'pipework_constraint',
      'water_main_limit_not_boiler_limit',
      'microbore_flow_limits',
    ],
    misconceptionsTargeted: [
      'A larger appliance can overcome restrictive pipework.',
      'Flow restrictions affect only one outlet at a time.',
      'Low-flow complaints always indicate appliance failure.',
    ],
    journeyIds: ['water_constraint_reality', 'open_vented_to_sealed_unvented'],
    screenReaderSummary:
      'Diagram showing a flow bottleneck: incoming supply reaches a restricted section of pipework, then available flow is divided across outlets. Restriction limits throughput regardless of downstream appliance size.',
    whatThisMeans:
      'Flow restriction is usually a pipework and supply issue. A larger appliance cannot push more water through a bottleneck than the restricted section allows.',
  },
  {
    diagramId: 'weather_compensation_curve',
    title: 'Weather compensation curve',
    visualStatus: 'production_ready',
    customerReady: true,
    conceptIds: ['weather_compensation', 'control_strategy', 'flow_temperature'],
    misconceptionsTargeted: [
      'Flow temperature should stay fixed all day in all weather.',
      'Weather compensation means unstable comfort.',
      'Manual setpoint changes are always better than automatic compensation.',
    ],
    journeyIds: ['heat_pump_reality'],
    screenReaderSummary:
      'Two-part diagram with sections labelled Weather vs load compensation and Automatic bypass valve (ABV). The first section compares compensation behaviour on boiler-and-radiator systems; the second shows TRVs closing while ABV opens between flow and return to protect boiler circulation.',
    whatThisMeans:
      'Weather compensation helps the boiler run gently before the home gets cold, while the automatic bypass valve protects flow through the boiler when radiator valves close.',
  },
];

export function getDiagramsByJourneyId(journeyId: string): DiagramExplanationEntry[] {
  return diagramExplanationRegistry.filter((d) => d.journeyIds.includes(journeyId));
}

export function getDiagramsByConceptId(conceptId: string): DiagramExplanationEntry[] {
  return diagramExplanationRegistry.filter((d) => d.conceptIds.includes(conceptId));
}

export function getDiagramById(diagramId: string): DiagramExplanationEntry | undefined {
  return diagramExplanationRegistry.find((d) => d.diagramId === diagramId);
}
