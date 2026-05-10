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
