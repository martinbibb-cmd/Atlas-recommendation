import type { LegoTechnixGraphV1 } from '../types';
import type { ScenarioInputV1 } from '../simulation/runLegoTechnixScenarioV1';
import type { LegoTechnixSimulationStateV1 } from '../simulation/LegoTechnixSimulationStateV1';
import {
  simpleRegularBoilerGraph,
  simpleRegularBoilerInitialStateV1,
} from './simpleRegularBoilerGraph';
import {
  sPlanControlGraph,
  sPlanControlInitialStateV1,
} from './sPlanControlGraph';

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function withSealedPrimaryAndUnventedDhw(baseGraph: LegoTechnixGraphV1): LegoTechnixGraphV1 {
  const graph = clone(baseGraph);

  graph.components.push({
    id: 'primary_expansion_vessel',
    label: 'Primary expansion vessel',
    domains: ['primary_heating', 'safety_discharge'],
    role: 'safety',
    behaviours: ['accepts_expansion', 'protects'],
    confidence: 'manufacturer',
    ports: [
      {
        id: 'expansion_tie_in',
        label: 'Expansion tie-in',
        domain: 'primary_heating',
        direction: 'bidirectional',
        allowedConnectionDomains: ['primary_heating'],
        required: true,
        description: 'Expansion vessel tie-in point for sealed system support.',
      },
    ],
  });

  graph.hydraulicDomains = [
    {
      id: 'primary_sealed',
      pressureRegime: 'sealed_primary',
      preFlightMarkers: [
        'primary_pressure_relief_valve',
        'primary_pressure_gauge',
        'primary_filling_loop',
      ],
      openToAtmosphere: false,
      minStaticHeadM: 0,
      availableStaticHeadM: 0,
      nominalColdPressureBar: 1.2,
      maxSafePressureBar: 3,
      requiresExpansionAccommodation: true,
      confidence: 'manufacturer',
    },
    {
      id: 'domestic_hot_unvented',
      pressureRegime: 'mains_pressure_dhw',
      preFlightMarkers: [
        'g3_expansion_accommodation',
        'g3_pressure_relief_chain',
        'g3_tp_relief',
        'g3_d1_d2_discharge_route',
      ],
      openToAtmosphere: false,
      minStaticHeadM: 0,
      availableStaticHeadM: 0,
      nominalColdPressureBar: 3,
      maxSafePressureBar: 10,
      requiresExpansionAccommodation: true,
      confidence: 'manufacturer',
    },
  ];

  return graph;
}

function buildStratifiedInitialState(baseState: LegoTechnixSimulationStateV1): LegoTechnixSimulationStateV1 {
  const state = clone(baseState);
  const storeIndex = state.componentStates.findIndex((entry) => entry.componentId === 'stored_dhw_volume');
  const store = storeIndex >= 0 ? state.componentStates[storeIndex] : undefined;
  if (!store || typeof store.volumeLitres !== 'number' || store.volumeLitres <= 0) {
    return state;
  }

  const layerTemperatures = [61, 57, 49, 39, 28];
  const layerVolume = store.volumeLitres / layerTemperatures.length;
  const stratifiedStore = {
    ...store,
    storageModel: 'stratified' as const,
    chargingMode: 'top_down' as const,
    stratificationLayers: layerTemperatures.map((temperatureC, layerIndex) => ({
      layerIndex,
      volumeLitres: layerVolume,
      temperatureC,
      usableAtTargetTemperature: temperatureC >= 40,
      confidence: 'derived' as const,
    })),
  };

  state.componentStates = [
    ...state.componentStates.slice(0, storeIndex),
    stratifiedStore,
    ...state.componentStates.slice(storeIndex + 1),
  ];

  return state;
}

function buildWeatherCompHeatPumpGraph(baseGraph: LegoTechnixGraphV1): LegoTechnixGraphV1 {
  const graph = withSealedPrimaryAndUnventedDhw(baseGraph);
  const heatSource = graph.heatSourceModels?.find((model) => model.componentId === 'regular_boiler');
  if (heatSource) {
    heatSource.heatSourceType = 'heat_pump';
    heatSource.targetFlowTemperatureC = 45;
    heatSource.returnTemperatureC = 35;
    heatSource.nominalOutputKw = 8;
    heatSource.minStableOutputKw = 2;
    heatSource.maxOutputKw = 10;
    heatSource.weatherCompensationEnabled = true;
    heatSource.weatherCompensation = {
      enabled: true,
      outsideTemperatureSourceComponentId: 'outside_air',
      designOutsideTemperatureC: -3,
      mildOutsideTemperatureC: 15,
      targetFlowAtDesignC: 48,
      targetFlowAtMildC: 30,
      minTargetFlowTemperatureC: 28,
      maxTargetFlowTemperatureC: 50,
      confidence: 'derived',
    };
  }

  return graph;
}

function buildThermalStoreGraph(baseGraph: LegoTechnixGraphV1): LegoTechnixGraphV1 {
  const graph = clone(baseGraph);
  graph.hydraulicDomains = [
    {
      id: 'thermal_store_primary',
      pressureRegime: 'thermal_store_primary',
      preFlightMarkers: ['combined_feed_vent'],
      openToAtmosphere: true,
      minStaticHeadM: 1,
      availableStaticHeadM: 4,
      nominalColdPressureBar: 0.4,
      maxSafePressureBar: 1.5,
      requiresExpansionAccommodation: true,
      confidence: 'assumed',
    },
    ...(graph.hydraulicDomains ?? []).filter((domain) => domain.pressureRegime !== 'open_vented_primary'),
  ];
  return graph;
}

const DEFAULT_SCENARIO = {
  durationSeconds: 1800,
  timestepSeconds: 60,
  sampleSelectors: {
    roomComponentId: 'living_room',
    storedDhwComponentId: 'stored_dhw_volume',
    sourceComponentId: 'regular_boiler',
  },
  scheduledEvents: [
    {
      type: 'dhw_draw_off' as const,
      atSecond: 600,
      durationSeconds: 300,
      drawOffComponentId: 'domestic_hot_draw_off',
      drawOffFlowLpm: 8,
      mixedOutletTargetTemperatureC: 40,
      coldInletTemperatureC: 10,
    },
  ],
} satisfies Omit<ScenarioInputV1, 'graph' | 'initialState'>;

export interface LegoTechnixCanonicalSystemTemplateV1 {
  readonly id: string;
  readonly label: string;
  readonly systemType:
    | 'regular_boiler_vented_cylinder_y_plan'
    | 'system_boiler_unvented_cylinder_s_plan'
    | 'combi_boiler_radiators'
    | 'heat_pump_unvented_weather_comp'
    | 'mixergy_stratified_cylinder'
    | 'thermal_store';
  readonly graph: LegoTechnixGraphV1;
  readonly initialState: LegoTechnixSimulationStateV1;
  readonly scenario: Omit<ScenarioInputV1, 'graph' | 'initialState'>;
}

export const LEGO_TECHNIX_CANONICAL_SYSTEM_TEMPLATES_V1: readonly LegoTechnixCanonicalSystemTemplateV1[] = [
  {
    id: 'template_regular_boiler_vented_cylinder_y_plan',
    label: 'Regular boiler + vented cylinder + Y-plan',
    systemType: 'regular_boiler_vented_cylinder_y_plan',
    graph: clone(simpleRegularBoilerGraph),
    initialState: clone(simpleRegularBoilerInitialStateV1),
    scenario: clone(DEFAULT_SCENARIO),
  },
  {
    id: 'template_system_boiler_unvented_cylinder_s_plan',
    label: 'System boiler + unvented cylinder + S-plan',
    systemType: 'system_boiler_unvented_cylinder_s_plan',
    graph: withSealedPrimaryAndUnventedDhw(sPlanControlGraph),
    initialState: clone(sPlanControlInitialStateV1),
    scenario: clone(DEFAULT_SCENARIO),
  },
  {
    id: 'template_combi_boiler_radiators',
    label: 'Combi boiler + radiators',
    systemType: 'combi_boiler_radiators',
    graph: clone(simpleRegularBoilerGraph),
    initialState: clone(simpleRegularBoilerInitialStateV1),
    scenario: clone(DEFAULT_SCENARIO),
  },
  {
    id: 'template_heat_pump_unvented_weather_comp',
    label: 'Heat pump + unvented cylinder + weather compensation',
    systemType: 'heat_pump_unvented_weather_comp',
    graph: buildWeatherCompHeatPumpGraph(sPlanControlGraph),
    initialState: clone(sPlanControlInitialStateV1),
    scenario: clone(DEFAULT_SCENARIO),
  },
  {
    id: 'template_mixergy_stratified_cylinder',
    label: 'Mixergy / stratified cylinder',
    systemType: 'mixergy_stratified_cylinder',
    graph: clone(simpleRegularBoilerGraph),
    initialState: buildStratifiedInitialState(simpleRegularBoilerInitialStateV1),
    scenario: clone(DEFAULT_SCENARIO),
  },
  {
    id: 'template_thermal_store',
    label: 'Thermal store',
    systemType: 'thermal_store',
    graph: buildThermalStoreGraph(simpleRegularBoilerGraph),
    initialState: clone(simpleRegularBoilerInitialStateV1),
    scenario: clone(DEFAULT_SCENARIO),
  },
] as const;
