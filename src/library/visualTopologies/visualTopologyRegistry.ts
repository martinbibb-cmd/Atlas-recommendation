export type VisualTopologyId =
  | 'open_vented_vented_cylinder'
  | 'sealed_unvented_cylinder'
  | 'combi_direct_hot_water'
  | 'mixergy_stratified_cylinder'
  | 'thermal_store_layout'
  | 'powerflush_service_layout'
  | 'abv_protected_heating_loop'
  | 'magnetic_filter_on_return'
  | 'system_pressure_layout';

export type VisualTopologyRecognisability =
  | 'immediately_recognisable'
  | 'recognisable_with_context';

export type PipeTraceability = 'clear' | 'adequate' | 'unclear';

export interface VisualTopologyEntry {
  id: VisualTopologyId;
  title: string;
  systemType: string;
  primitivesUsed: string[];
  physicalPurpose: string;
  recognisability: VisualTopologyRecognisability;
  pipeTraceability: PipeTraceability;
  printSafe: boolean;
  motionSafe: boolean;
  allowedCustomerUse: boolean;
  qaNote?: string;
}

export const VISUAL_TOPOLOGY_REGISTRY: VisualTopologyEntry[] = [
  {
    id: 'open_vented_vented_cylinder',
    title: 'Open-vented heating + vented cylinder',
    systemType: 'open_vented',
    primitivesUsed: [
      'regular_boiler',
      'circulation_pump',
      'panel_radiator',
      'cold_water_storage_tank',
      'vented_cylinder',
      'flow_pipe',
      'pipe_loop',
    ],
    physicalPurpose:
      'Shows a tank-fed hot-water layout with feed-and-expansion/header tank, vent pipe, vented cylinder, and connected primary flow/return loop.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
    qaNote: 'No-label view must still make the vent pipe and tank-fed path obvious.',
  },
  {
    id: 'sealed_unvented_cylinder',
    title: 'Sealed heating + unvented cylinder',
    systemType: 'sealed_unvented',
    primitivesUsed: [
      'system_boiler',
      'circulation_pump',
      'panel_radiator',
      'expansion_vessel',
      'pressure_gauge',
      'filling_loop_valve',
      'unvented_cylinder',
      'flow_pipe',
      'pipe_loop',
    ],
    physicalPurpose:
      'Shows a pressure-managed sealed loop with expansion vessel, pressure gauge, filling loop cue, and unvented cylinder with mains cold in/hot draw-off out.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
  },
  {
    id: 'combi_direct_hot_water',
    title: 'Combi boiler direct hot water',
    systemType: 'combi',
    primitivesUsed: ['combi_boiler', 'panel_radiator', 'flow_pipe', 'pipe_loop'],
    physicalPurpose:
      'Shows combi on-demand hot water with mains cold in, hot water out, and central heating flow/return with no cylinder in circuit.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
  },
  {
    id: 'mixergy_stratified_cylinder',
    title: 'Stratified cylinder / Mixergy layout',
    systemType: 'mixergy',
    primitivesUsed: ['mixergy_cylinder', 'system_boiler', 'circulation_pump', 'flow_pipe'],
    physicalPurpose:
      'Shows Mixergy cylinder with hot top layer, cooler lower layer, cold mains entry, hot draw-off from top, and charging input cue.',
    recognisability: 'recognisable_with_context',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
    qaNote: 'Do not describe or present this as a thermal store.',
  },
  {
    id: 'thermal_store_layout',
    title: 'Thermal store layout',
    systemType: 'thermal_store',
    primitivesUsed: ['thermal_store', 'regular_boiler', 'circulation_pump', 'flow_pipe'],
    physicalPurpose:
      'Shows thermal store primary water with domestic hot-water path routed through internal coil/heat exchanger and clear potable/primary separation.',
    recognisability: 'recognisable_with_context',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
    qaNote: 'Primary stored water and potable water paths must remain visually separate.',
  },
  {
    id: 'powerflush_service_layout',
    title: 'Powerflush service layout',
    systemType: 'service_powerflush',
    primitivesUsed: ['powerflush_machine', 'panel_radiator', 'regular_boiler', 'magnetic_filter', 'flow_pipe', 'pipe_loop'],
    physicalPurpose:
      'Shows flushing machine hoses connected into heating circuit/radiator loop with dirty and clean return paths and optional downstream magnetic filter protection.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
  },
  {
    id: 'abv_protected_heating_loop',
    title: 'ABV protected heating loop',
    systemType: 'sealed_abv',
    primitivesUsed: ['system_boiler', 'circulation_pump', 'panel_radiator', 'abv', 'flow_pipe', 'pipe_loop'],
    physicalPurpose:
      'Shows flow pipe, return pipe, TRV radiator loop, and ABV bridge between flow and return protecting minimum circulation.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
  },
  {
    id: 'magnetic_filter_on_return',
    title: 'Magnetic filter on return',
    systemType: 'system_protection',
    primitivesUsed: ['system_boiler', 'magnetic_filter', 'panel_radiator', 'flow_pipe', 'pipe_loop'],
    physicalPurpose:
      'Shows return path through magnetic filter before boiler with captured magnetite cue and cleaner return entering boiler.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
  },
  {
    id: 'system_pressure_layout',
    title: 'System pressure layout',
    systemType: 'sealed_pressure_window',
    primitivesUsed: ['system_boiler', 'pipe_loop', 'pressure_gauge', 'expansion_vessel'],
    physicalPurpose:
      'Shows sealed heating loop with pressure gauge and expansion vessel, including low/normal/high pressure states.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'adequate',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
  },
];
