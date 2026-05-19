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
export type TopologyVisualReviewState = 'passed' | 'human_visual_review_required';

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
  humanVisualReviewState: TopologyVisualReviewState;
  humanVisualReviewNote?: string;
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
    ],
    physicalPurpose:
      'Shows a tank-fed hot-water layout with feed-and-expansion/header tank, vent pipe, vented cylinder, and connected primary flow/return loop.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
    qaNote: 'No-label view must keep vent pipe/tank-fed path obvious and radiator branches bottom-connected and traceable.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Still blocked until a reviewer confirms the open-vented tank-fed path reads as a believable system without labels.',
  },
  {
    id: 'sealed_unvented_cylinder',
    title: 'Sealed heating + unvented cylinder',
    systemType: 'sealed_unvented',
    primitivesUsed: [
      'system_boiler',
      'panel_radiator',
      'expansion_vessel',
      'pressure_gauge',
      'filling_loop_valve',
      'unvented_cylinder',
      'flow_pipe',
    ],
    physicalPurpose:
      'Shows a pressure-managed sealed loop with expansion vessel, pressure gauge, filling loop cue, and unvented cylinder with mains cold in/hot draw-off out.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
    qaNote: 'Radiator branches should read as bottom-connected emitters on a plausible sealed flow/return route.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Still blocked until a reviewer confirms the no-label layout reads as a plausible sealed heating + mains-fed stored hot-water system.',
  },
  {
    id: 'combi_direct_hot_water',
    title: 'Combi boiler direct hot water',
    systemType: 'combi',
    primitivesUsed: ['combi_boiler', 'panel_radiator', 'flow_pipe'],
    physicalPurpose:
      'Shows combi on-demand hot water with mains cold in, hot water out, and central heating flow/return with no cylinder in circuit.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
    qaNote: 'Emitter branches should remain bottom-connected with no decorative crossovers.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Still blocked until a reviewer confirms the no-label combi layout reads as a real system rather than symbolic rails.',
  },
  {
    id: 'mixergy_stratified_cylinder',
    title: 'Stratified cylinder / Mixergy layout',
    systemType: 'mixergy',
    primitivesUsed: ['mixergy_cylinder', 'system_boiler', 'flow_pipe'],
    physicalPurpose:
      'Shows Mixergy cylinder with hot top layer, cooler lower layer, cold mains entry, hot draw-off from top, and charging input cue.',
    recognisability: 'recognisable_with_context',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
    qaNote: 'Keep this visually clean and stratified with minimal pipework; do not describe or present this as a thermal store.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Still blocked until a reviewer confirms the no-label view is clearly Mixergy and not a generic cylinder or thermal store.',
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
    qaNote: 'Primary stored water and potable water paths must remain visibly separate via internal heat-exchanger representation.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Still blocked until a reviewer confirms the primary body and separate DHW heat-exchange path are obvious without labels.',
  },
  {
    id: 'powerflush_service_layout',
    title: 'Powerflush service layout',
    systemType: 'service_powerflush',
    primitivesUsed: ['powerflush_machine', 'panel_radiator', 'regular_boiler', 'magnetic_filter', 'flow_pipe'],
    physicalPurpose:
      'Shows flushing machine hoses connected into heating circuit/radiator loop with dirty and clean return paths and optional downstream magnetic filter protection.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
    qaNote: 'ABV should read as a compact bypass valve with angled adjustment head bridging flow and return.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Still blocked until a reviewer confirms the service layout looks like connected equipment rather than stretched symbolic strips.',
  },
  {
    id: 'abv_protected_heating_loop',
    title: 'ABV protected heating loop',
    systemType: 'sealed_abv',
    primitivesUsed: ['system_boiler', 'panel_radiator', 'abv', 'flow_pipe'],
    physicalPurpose:
      'Shows flow pipe, return pipe, TRV radiator loop, and ABV bridge between flow and return protecting minimum circulation.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
    qaNote: 'Return filtering should stay physically traceable with radiator branches connected to plausible emitter ports.',
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Still blocked until a reviewer confirms the ABV bridge and emitter routing read as a believable circuit in no-label mode.',
  },
  {
    id: 'magnetic_filter_on_return',
    title: 'Magnetic filter on return',
    systemType: 'system_protection',
    primitivesUsed: ['system_boiler', 'magnetic_filter', 'panel_radiator', 'flow_pipe'],
    physicalPurpose:
      'Shows return path through magnetic filter before boiler with captured magnetite cue and cleaner return entering boiler.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'clear',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Still blocked until a reviewer confirms the return filter sits on believable connected pipework entering the real product ports.',
  },
  {
    id: 'system_pressure_layout',
    title: 'System pressure layout',
    systemType: 'sealed_pressure_window',
    primitivesUsed: ['system_boiler', 'pressure_gauge', 'expansion_vessel', 'flow_pipe'],
    physicalPurpose:
      'Shows sealed heating loop with pressure gauge and expansion vessel, including low/normal/high pressure states.',
    recognisability: 'immediately_recognisable',
    pipeTraceability: 'adequate',
    printSafe: true,
    motionSafe: true,
    allowedCustomerUse: false,
    humanVisualReviewState: 'human_visual_review_required',
    humanVisualReviewNote:
      'Still blocked until a reviewer confirms the pressure-window layout reads as a believable sealed-system presentation without labels.',
  },
];
