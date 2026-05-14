export interface DiagramExplanationEntry {
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
    conceptIds: ['open_vented_to_unvented_upgrade', 'sealed_system_conversion', 'pressure_vs_storage'],
    misconceptionsTargeted: [
      'Removing loft tanks weakens the heating.',
      'Sealed systems are more complicated to live with.',
      'Upgrading means losing the existing heating strengths.',
    ],
    journeyIds: ['open_vented_to_sealed_unvented'],
    screenReaderSummary:
      'Side-by-side diagram. Left: open-vented system with cold water storage tank in loft and vented hot water cylinder. Right: sealed system with unvented cylinder fed directly by mains. Loft tanks are removed. Heating circuit remains unchanged.',
    whatThisMeans:
      'Switching to a sealed system with an unvented cylinder removes loft tanks and brings mains pressure to hot water outlets. The heating circuit and radiators remain unchanged.',
  },
  {
    diagramId: 'system_fit_decision_map',
    title: 'System fit decision map',
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
      'Decision map showing how system fit is chosen from measured site constraints: demand pattern, supply limits, distribution constraints, and control goals. Different homes reach different system outcomes for evidence-based reasons.',
    whatThisMeans:
      'System fit is selected from measured evidence, not a one-size-fits-all preference. The chosen path reflects your demand pattern, supply limits, and home constraints.',
  },
  {
    diagramId: 'stored_hot_water_recovery_timeline',
    title: 'Stored hot water recovery timeline',
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
    conceptIds: ['weather_compensation', 'control_strategy', 'flow_temperature'],
    misconceptionsTargeted: [
      'Flow temperature should stay fixed all day in all weather.',
      'Weather compensation means unstable comfort.',
      'Manual setpoint changes are always better than automatic compensation.',
    ],
    journeyIds: ['heat_pump_reality'],
    screenReaderSummary:
      'Line chart showing weather compensation: as outdoor temperature falls, target flow temperature rises along a smooth curve; as outdoor temperature rises, target flow temperature falls.',
    whatThisMeans:
      'Weather compensation changes flow temperature automatically with outdoor conditions. Small day-to-day flow-temperature shifts are normal and help maintain stable comfort.',
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
