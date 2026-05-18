import type { CanonicalHydraulicTemplate } from './types';

export const CANONICAL_HYDRAULIC_TEMPLATES: readonly CanonicalHydraulicTemplate[] = [
  {
    id: 'open_vented',
    title: 'Open vented reference',
    hydraulicIntentSummary:
      'Open vented central heating with close-coupled feed-and-vent connection, pump pushing away from boiler, and separate indirect DHW coil path.',
    safetyNotes: [
      'Open vent remains unobstructed with no isolation valves.',
      'Feed and expansion cistern is at highest point.',
    ],
    regulatoryNotes: [
      'Feed-and-vent geometry is treated as a non-negotiable hydraulic neutral point.',
    ],
    nonNegotiableSimplifications: [
      'Do not separate cold feed and vent for visual symmetry.',
      'Do not show top-fed modern radiator connections.',
    ],
  },
  {
    id: 'sealed_unvented',
    title: 'Sealed + unvented reference',
    hydraulicIntentSummary:
      'Sealed primary circuit with expansion vessel and pressure management, with unvented stored hot water and explicit G3 discharge routing.',
    safetyNotes: [
      'Filling loop is temporary/disconnected in normal operation.',
      'Safety discharge includes visible tundish air gap and continuously falling D2.',
    ],
    regulatoryNotes: [
      'Unvented discharge path follows G3 intent: D1 into tundish, larger D2 out.',
    ],
    nonNegotiableSimplifications: [
      'No sharp thermocline in standard unvented cylinder rendering.',
      'Never hide or flatten safety discharge routing.',
    ],
  },
  {
    id: 'combi',
    title: 'Combi reference',
    hydraulicIntentSummary:
      'On-demand hot water branch remains separate from central-heating primary flow/return, with DHW-priority operating behaviour.',
    safetyNotes: [
      'Potable and primary loops are thermally coupled only via heat exchanger behaviour.',
    ],
    regulatoryNotes: [
      'No stored hot-water cylinder path in canonical combi topology.',
    ],
    nonNegotiableSimplifications: [
      'Do not depict simultaneous full CH + full DHW delivery.',
    ],
  },
  {
    id: 'mixergy',
    title: 'Mixergy reference',
    hydraulicIntentSummary:
      'Stored hot water with active stratification: hot top zone, lower cool zone, and sharp thermocline with controlled low-level inlet behaviour.',
    safetyNotes: [
      'Mixergy remains potable stored hot water, not primary thermal mass.',
    ],
    regulatoryNotes: [
      'Mixergy is modelled separately from both standard unvented and thermal store templates.',
    ],
    nonNegotiableSimplifications: [
      'Sharp thermocline must remain visible.',
      'Do not frame Mixergy as thermal store behaviour.',
    ],
  },
  {
    id: 'thermal_store',
    title: 'Thermal store reference',
    hydraulicIntentSummary:
      'Main vessel stores primary heating water; potable mains passes through a separated heat-exchange path and exits as DHW without fluid mixing.',
    safetyNotes: [
      'Potable path and primary mass must stay visibly separate at all times.',
    ],
    regulatoryNotes: [
      'Thermal store is not modelled as an unvented G3 cylinder body.',
    ],
    nonNegotiableSimplifications: [
      'Do not draw potable outlets from stored primary vessel body.',
      'Do not reuse Mixergy stratification markers.',
    ],
  },
  {
    id: 'abv_protected_loop',
    title: 'ABV protected loop reference',
    hydraulicIntentSummary:
      'ABV bridges primary flow to return to maintain minimum circulation and pump overrun path when restrictions close.',
    safetyNotes: [
      'ABV remains downstream of pump and upstream of restrictions.',
    ],
    regulatoryNotes: [
      'Bypass path is functional, not decorative.',
    ],
    nonNegotiableSimplifications: [
      'Do not place ABV downstream of zone-valve restrictions.',
    ],
  },
  {
    id: 'magnetic_filter_protection',
    title: 'Magnetic filter protection reference',
    hydraulicIntentSummary:
      'Magnetic filter is on primary return and acts as final protection stage before the boiler.',
    safetyNotes: [
      'Service isolation logic is preserved around filter representation.',
    ],
    regulatoryNotes: [
      'Filter is never shown as potable-water treatment.',
    ],
    nonNegotiableSimplifications: [
      'Do not place magnetic filter on flow side.',
    ],
  },
  {
    id: 'powerflush_setup',
    title: 'Powerflush setup reference',
    hydraulicIntentSummary:
      'Temporary powerflush intervention with external machine, temporary hoses, dirty return to waste, and clean treated flow back into system.',
    safetyNotes: [
      'Powerflush state is temporary and does not depict permanent installation.',
    ],
    regulatoryNotes: [
      'External machine function replaces normal pump role during flush state.',
    ],
    nonNegotiableSimplifications: [
      'Do not show permanent-looking decorative flush loops.',
      'Do not show system pump operating simultaneously with external flush machine.',
    ],
  },
] as const;
