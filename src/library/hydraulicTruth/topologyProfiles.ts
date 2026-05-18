import type { VisualTopologyId } from '../visualTopologies/visualTopologyRegistry';
import type { TopologyHydraulicSignals } from './types';

function baseSignals() {
  return {
    pumpInline: false,
    flowReturnDistinguishable: true,
    potablePrimarySeparated: true,
    showsSharpThermocline: false,
    showsUniformWarmCylinder: false,
    showsTopHotZone: false,
    showsLowerCoolZone: false,
    hasTundish: false,
    hasVisibleTundishAirGap: false,
    hasD2ContinuousFall: false,
    abvAfterPumpBeforeRestrictions: false,
    abvDownstreamOfZoneValve: false,
    magneticFilterOnReturnBeforeBoiler: false,
    magneticFilterHasIsolationValves: false,
    openVentCloseCoupledToColdFeed: false,
    openVentHasValve: false,
    coldFeedHasValve: false,
    fillingLoopDisconnectedByDefault: false,
    fillingLoopPermanentlyConnected: false,
    radiatorsBottomFed: true,
    decorativePipework: false,
    simultaneousFullHeatingAndDhw: false,
    storesPotableInMainThermalStoreBody: false,
    mixergyRepresentedAsThermalStore: false,
    powerflushMarkedTemporary: false,
    systemPumpOperatingDuringPowerflush: false,
    d2HiddenOrMissing: true,
    dhwPriorityShown: false,
    separatePotableAndPrimaryPathsShown: true,
  } as const;
}

export const TOPOLOGY_HYDRAULIC_PROFILES: Record<VisualTopologyId, TopologyHydraulicSignals> = {
  open_vented_vented_cylinder: {
    topologyId: 'open_vented_vented_cylinder',
    templateId: 'open_vented',
    summary:
      'Open vented central-heating loop with indirect stored hot-water cylinder and loft feed-and-expansion reference.',
    signals: {
      ...baseSignals(),
      pumpInline: true,
      openVentCloseCoupledToColdFeed: true,
      separatePotableAndPrimaryPathsShown: true,
      showsUniformWarmCylinder: true,
      d2HiddenOrMissing: false,
    },
    knownSimplifications: [
      'Close-coupled feed-and-vent tees are represented as compact symbolic proximity rather than measured pipe spacing.',
      'Shepherd’s-crook vent termination detail is abstracted at this scale.',
    ],
  },
  sealed_unvented_cylinder: {
    topologyId: 'sealed_unvented_cylinder',
    templateId: 'sealed_unvented',
    summary:
      'Sealed primary with stored hot water supplied at mains pressure, expansion vessel, pressure gauge, and filling-loop cue.',
    signals: {
      ...baseSignals(),
      pumpInline: true,
      fillingLoopDisconnectedByDefault: true,
      showsUniformWarmCylinder: true,
      separatePotableAndPrimaryPathsShown: true,
      hasTundish: false,
      hasVisibleTundishAirGap: false,
      hasD2ContinuousFall: false,
      d2HiddenOrMissing: true,
    },
    knownSimplifications: [
      'G3 discharge stack (D1/tundish/D2) is currently represented as deferred QA requirement rather than full drawn discharge path.',
    ],
  },
  combi_direct_hot_water: {
    topologyId: 'combi_direct_hot_water',
    templateId: 'combi',
    summary: 'Combi on-demand hot-water path with separate primary flow/return and no cylinder.',
    signals: {
      ...baseSignals(),
      separatePotableAndPrimaryPathsShown: true,
      dhwPriorityShown: true,
      simultaneousFullHeatingAndDhw: false,
      d2HiddenOrMissing: false,
    },
    knownSimplifications: [
      'Diverter and plate heat-exchanger internals are represented behaviourally in topology intent rather than full internal schematic.',
    ],
  },
  mixergy_stratified_cylinder: {
    topologyId: 'mixergy_stratified_cylinder',
    templateId: 'mixergy',
    summary: 'Stored hot water with explicit top-down active stratification and sharp thermocline behaviour.',
    signals: {
      ...baseSignals(),
      pumpInline: true,
      showsSharpThermocline: true,
      showsTopHotZone: true,
      showsLowerCoolZone: true,
      separatePotableAndPrimaryPathsShown: true,
      d2HiddenOrMissing: false,
    },
    knownSimplifications: [
      'Low-velocity inlet diffuser is represented by controlled entry cue rather than full diffuser geometry.',
    ],
  },
  thermal_store_layout: {
    topologyId: 'thermal_store_layout',
    templateId: 'thermal_store',
    summary:
      'Primary-water thermal mass with separate potable mains through heat-exchange path and no potable-primary mixing.',
    signals: {
      ...baseSignals(),
      pumpInline: true,
      potablePrimarySeparated: true,
      separatePotableAndPrimaryPathsShown: true,
      storesPotableInMainThermalStoreBody: false,
      d2HiddenOrMissing: false,
    },
    knownSimplifications: [
      'Coil heat-exchanger path is shown as compact symbolic internals for recognisability.',
    ],
  },
  powerflush_service_layout: {
    topologyId: 'powerflush_service_layout',
    templateId: 'powerflush_setup',
    summary:
      'Temporary powerflush intervention with external machine hoses, dirty return cue, and clean treated return cue.',
    signals: {
      ...baseSignals(),
      magneticFilterOnReturnBeforeBoiler: true,
      powerflushMarkedTemporary: true,
      systemPumpOperatingDuringPowerflush: false,
      separatePotableAndPrimaryPathsShown: true,
      d2HiddenOrMissing: false,
    },
    knownSimplifications: [
      'Waste path destination is represented by labelled dirty-return cue rather than full drain endpoint.',
    ],
  },
  abv_protected_heating_loop: {
    topologyId: 'abv_protected_heating_loop',
    templateId: 'abv_protected_loop',
    summary:
      'ABV bridge between flow and return for minimum circulation with pump-overrun-compatible bypass path.',
    signals: {
      ...baseSignals(),
      pumpInline: true,
      abvAfterPumpBeforeRestrictions: true,
      abvDownstreamOfZoneValve: false,
      separatePotableAndPrimaryPathsShown: true,
      d2HiddenOrMissing: false,
    },
    knownSimplifications: [
      'Restriction devices are represented by branch intent rather than explicit zone-valve symbols.',
    ],
  },
  magnetic_filter_on_return: {
    topologyId: 'magnetic_filter_on_return',
    templateId: 'magnetic_filter_protection',
    summary:
      'Return-side magnetic filter positioned before boiler to capture magnetite before re-entry to heat source.',
    signals: {
      ...baseSignals(),
      magneticFilterOnReturnBeforeBoiler: true,
      magneticFilterHasIsolationValves: true,
      separatePotableAndPrimaryPathsShown: true,
      d2HiddenOrMissing: false,
    },
    knownSimplifications: [
      'Isolation valves are represented at primitive level rather than full valve train.',
    ],
  },
  system_pressure_layout: {
    topologyId: 'system_pressure_layout',
    templateId: 'sealed_unvented',
    summary:
      'Sealed pressure-state reference for low/normal/high gauge interpretation with expansion-vessel relationship.',
    signals: {
      ...baseSignals(),
      fillingLoopDisconnectedByDefault: true,
      separatePotableAndPrimaryPathsShown: true,
      hasTundish: false,
      hasVisibleTundishAirGap: false,
      hasD2ContinuousFall: false,
      d2HiddenOrMissing: true,
    },
    knownSimplifications: [
      'Pressure window panel focuses on sealed-loop pressure behaviour and intentionally omits full cylinder discharge assembly.',
    ],
  },
};
