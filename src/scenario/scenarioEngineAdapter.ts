import type { EngineInputV2_3 } from '../engine/schema/EngineInputV2_3';
import type { DayProfileV1, DhwEventV1, HeatingBandV1 } from '../contracts/EngineInputV2_3';

export type ScenarioState = {
  extraShowers: number;
  bathRunning: boolean;
  kitchenTap: boolean;
  utilityTap: boolean;
  heatingDemand: boolean;
  boilerOutputOverrideKw?: number;
};

export const DEFAULT_SCENARIO_STATE: ScenarioState = {
  extraShowers: 0,
  bathRunning: false,
  kitchenTap: false,
  utilityTap: false,
  heatingDemand: false,
};

const SCENARIO_START_MIN = 7 * 60;

const BASE_HEATING_BANDS: HeatingBandV1[] = [
  { startMin: 6 * 60, endMin: 9 * 60, targetC: 20 },
  { startMin: 17 * 60, endMin: 22 * 60, targetC: 20 },
];

const BASE_DHW_HEAT_BANDS: DayProfileV1['dhwHeatBands'] = [
  { startMin: 5 * 60 + 30, endMin: 9 * 60, on: true },
  { startMin: 16 * 60 + 30, endMin: 22 * 60, on: true },
];

function cloneDayProfile(dayProfile?: DayProfileV1): DayProfileV1 {
  if (!dayProfile) {
    return {
      heatingBands: BASE_HEATING_BANDS,
      dhwHeatBands: BASE_DHW_HEAT_BANDS,
      dhwEvents: [],
    };
  }

  return {
    heatingBands: dayProfile.heatingBands.map(b => ({ ...b })),
    dhwHeatBands: dayProfile.dhwHeatBands.map(b => ({ ...b })),
    dhwEvents: dayProfile.dhwEvents.map(e => ({ ...e })),
  };
}

function createDhwEvent(
  profile: DhwEventV1['profile'],
  durationMin: number,
  startOffsetMin = 0,
): DhwEventV1 {
  return {
    startMin: SCENARIO_START_MIN + startOffsetMin,
    durationMin,
    kind: 'taps',
    profile,
  };
}

function withScenarioEvents(baseEvents: DhwEventV1[], scenario: ScenarioState): DhwEventV1[] {
  const events = [...baseEvents];

  for (let i = 0; i < scenario.extraShowers; i += 1) {
    events.push(createDhwEvent('mixer12', 10, i));
  }

  if (scenario.bathRunning) {
    events.push(createDhwEvent('rainfall16', 18));
  }

  if (scenario.kitchenTap) {
    events.push(createDhwEvent('mixer10', 8, 2));
  }

  if (scenario.utilityTap) {
    events.push(createDhwEvent('mixer10', 6, 3));
  }

  return events;
}

export function applyScenarioToEngineInput(
  input: EngineInputV2_3,
  scenario: ScenarioState,
): EngineInputV2_3 {
  const nextInput: EngineInputV2_3 = {
    ...input,
    dayProfile: cloneDayProfile(input.dayProfile),
    currentSystem: input.currentSystem
      ? {
          ...input.currentSystem,
          boiler: input.currentSystem.boiler
            ? { ...input.currentSystem.boiler }
            : undefined,
        }
      : undefined,
  };

  const baseConcurrentOutlets = input.peakConcurrentOutlets ?? 1;
  const scenarioOutletLoad =
    scenario.extraShowers +
    (scenario.bathRunning ? 1 : 0) +
    (scenario.kitchenTap ? 1 : 0) +
    (scenario.utilityTap ? 1 : 0);

  nextInput.peakConcurrentOutlets = Math.max(baseConcurrentOutlets, baseConcurrentOutlets + scenarioOutletLoad);
  nextInput.dayProfile!.dhwEvents = withScenarioEvents(nextInput.dayProfile!.dhwEvents, scenario);

  if (scenario.heatingDemand) {
    nextInput.dayProfile!.heatingBands = [{ startMin: 0, endMin: 24 * 60, targetC: 21 }];
  }

  if (typeof scenario.boilerOutputOverrideKw === 'number') {
    nextInput.currentBoilerOutputKw = scenario.boilerOutputOverrideKw;
    nextInput.currentSystem = nextInput.currentSystem ?? {};
    const fallbackBoilerType =
      input.currentHeatSourceType === 'combi' ||
      input.currentHeatSourceType === 'system' ||
      input.currentHeatSourceType === 'regular'
        ? input.currentHeatSourceType
        : 'unknown';

    const boiler = nextInput.currentSystem.boiler ?? {
      type: fallbackBoilerType,
      condensing: 'yes' as const,
    };

    boiler.nominalOutputKw = scenario.boilerOutputOverrideKw;
    nextInput.currentSystem.boiler = boiler;
  }

  return nextInput;
}
