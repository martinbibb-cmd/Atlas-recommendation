import type { LegoTechnixGraphV1 } from '../types';
import type { ComponentStateV1 } from './ComponentStateV1';
import type { HeatTransferEvaluationResultV1 } from './evaluateHeatTransfersV1';
import type { LegoTechnixSimulationStateV1 } from './LegoTechnixSimulationStateV1';
import type { DomesticDrawOffDemandV1 } from './DomesticDrawOffDemandV1';
import type { LegoTechnixTickInputV1 } from './LegoTechnixTickInputV1';
import type {
  LegoTechnixSimulationEventV1,
  LegoTechnixSimulationWarningV1,
} from './LegoTechnixTickResultV1';

const WATER_HEAT_CAPACITY_WH_PER_L_K = 1.16;
const ROOM_TEMP_MIN_C = -30;
const ROOM_TEMP_MAX_C = 60;
const STORED_WATER_TEMP_MIN_C = 0;
const STORED_WATER_TEMP_MAX_C = 95;
const DEFAULT_OUTSIDE_TEMP_C = 5;
const DEFAULT_ROOM_TEMP_C = 18;
const DEFAULT_STORED_WATER_TEMP_C = 45;
const COLD_FEED_REFERENCE_TEMP_C = 10;
const TARGET_HOT_WATER_TEMP_C = 40;

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveStoreDrawOffDemandsByComponentId(
  graph: LegoTechnixGraphV1,
  tickInput: LegoTechnixTickInputV1,
  warnings: LegoTechnixSimulationWarningV1[],
): ReadonlyMap<string, readonly DomesticDrawOffDemandV1[]> {
  const demandsByStoreComponentId = new Map<string, DomesticDrawOffDemandV1[]>();
  const componentById = new Map(graph.components.map((component) => [component.id, component]));
  const drawOffDemands = tickInput.domesticDrawOffDemands ?? [];

  for (const demand of drawOffDemands) {
    if (!Number.isFinite(demand.drawOffFlowLpm) || demand.drawOffFlowLpm <= 0) {
      warnings.push({
        code: 'domestic_draw_off_invalid_flow',
        componentId: demand.drawOffComponentId,
        message: `Domestic draw-off "${demand.drawOffComponentId}" has non-positive drawOffFlowLpm.`,
      });
      continue;
    }

    const drawOffComponent = componentById.get(demand.drawOffComponentId);
    if (!drawOffComponent || !drawOffComponent.domains?.includes('domestic_hot')) {
      warnings.push({
        code: 'domestic_draw_off_component_invalid',
        componentId: demand.drawOffComponentId,
        message: `Domestic draw-off component "${demand.drawOffComponentId}" was not found in domestic_hot domain.`,
      });
      continue;
    }

    const hotDrawConnection = graph.connections.find((connection) => (
      connection.targetComponentId === demand.drawOffComponentId
      && connection.domain === 'domestic_hot'
      && componentById.get(connection.sourceComponentId)?.role === 'store'
      && componentById.get(connection.sourceComponentId)?.domains?.includes('domestic_hot')
    ));
    if (!hotDrawConnection) {
      warnings.push({
        code: 'domestic_draw_off_store_unmapped',
        componentId: demand.drawOffComponentId,
        message: `Domestic draw-off "${demand.drawOffComponentId}" is not mapped to a stored domestic water node.`,
      });
      continue;
    }

    const storeComponentId = hotDrawConnection.sourceComponentId;
    const existing = demandsByStoreComponentId.get(storeComponentId);
    if (existing) {
      existing.push(demand);
    } else {
      demandsByStoreComponentId.set(storeComponentId, [demand]);
    }
  }

  return demandsByStoreComponentId;
}

export interface ThermalIntegrationResultV1 {
  readonly thermalStateByComponentId: Readonly<Record<string, Partial<ComponentStateV1>>>;
  readonly events: readonly LegoTechnixSimulationEventV1[];
  readonly warnings: readonly LegoTechnixSimulationWarningV1[];
}

export function integrateThermalStateV1(
  graph: LegoTechnixGraphV1,
  previousState: LegoTechnixSimulationStateV1,
  heatTransferResult: HeatTransferEvaluationResultV1,
  tickInput: LegoTechnixTickInputV1,
): ThermalIntegrationResultV1 {
  const previousByComponentId = new Map(
    previousState.componentStates.map((componentState) => [componentState.componentId, componentState]),
  );
  const componentById = new Map(graph.components.map((component) => [component.id, component]));
  const thermalStateByComponentId: Record<string, Partial<ComponentStateV1>> = {};
  const events: LegoTechnixSimulationEventV1[] = [];
  const warnings: LegoTechnixSimulationWarningV1[] = [];
  const timestepHours = tickInput.timestepSeconds / 3600;

  const outsideComponent = graph.components.find((component) => (
    component.domains?.includes('outside_environment')
  ));
  const outsideTempC = outsideComponent
    ? (
      previousByComponentId.get(outsideComponent.id)?.currentTemperatureC
      ?? DEFAULT_OUTSIDE_TEMP_C
    )
    : DEFAULT_OUTSIDE_TEMP_C;

  const roomGainByComponentId = new Map<string, number>();
  const storedGainByComponentId = new Map<string, number>();
  const drawOffDemandsByStoreComponentId = resolveStoreDrawOffDemandsByComponentId(graph, tickInput, warnings);

  for (const component of graph.components) {
    const transfer = heatTransferResult.transferByComponentId[component.id];
    if (!transfer || transfer.lastSecondaryGainKw <= 0) {
      continue;
    }

    if (transfer.family === 'radiator') {
      const roomConnection = graph.connections.find((connection) => (
        connection.sourceComponentId === component.id && connection.domain === 'room_air'
      ));
      if (roomConnection) {
        roomGainByComponentId.set(
          roomConnection.targetComponentId,
          (roomGainByComponentId.get(roomConnection.targetComponentId) ?? 0) + transfer.lastSecondaryGainKw,
        );
      }
    }

    if (transfer.family === 'cylinder_coil') {
      const storeConnection = graph.connections.find((connection) => (
        connection.sourceComponentId === component.id
        && connection.domain === 'domestic_hot'
        && componentById.get(connection.targetComponentId)?.role === 'store'
      ));
      if (storeConnection) {
        storedGainByComponentId.set(
          storeConnection.targetComponentId,
          (storedGainByComponentId.get(storeConnection.targetComponentId) ?? 0) + transfer.lastSecondaryGainKw,
        );
      }
    }
  }

  for (const component of graph.components) {
    if (!component.domains?.includes('room_air')) {
      continue;
    }

    const previous = previousByComponentId.get(component.id);
    const currentTempC = previous?.currentTemperatureC
      ?? previous?.targetTemperatureC
      ?? DEFAULT_ROOM_TEMP_C;
    const heatGainKw = round3(roomGainByComponentId.get(component.id) ?? 0);
    const heatLossKwPerK = previous?.heatLossKwPerK;
    const heatLossKw = (heatGainKw > 0 && typeof heatLossKwPerK === 'number')
      ? round3(heatLossKwPerK * (currentTempC - outsideTempC))
      : 0;
    const netHeatKw = round3(heatGainKw - heatLossKw);

    const thermalMassKwhPerK = previous?.thermalMassKwhPerK;
    let nextTempC = currentTempC;
    if (typeof thermalMassKwhPerK === 'number' && thermalMassKwhPerK > 0) {
      const deltaKwh = netHeatKw * timestepHours;
      const deltaTempC = deltaKwh / thermalMassKwhPerK;
      nextTempC = clamp(currentTempC + deltaTempC, ROOM_TEMP_MIN_C, ROOM_TEMP_MAX_C);
    } else {
      warnings.push({
        code: 'room_thermal_mass_missing',
        componentId: component.id,
        message: `Room "${component.id}" is missing thermalMassKwhPerK; temperature integration skipped.`,
      });
    }

    thermalStateByComponentId[component.id] = {
      currentTemperatureC: round3(nextTempC),
      targetTemperatureC: previous?.targetTemperatureC,
      thermalMassKwhPerK: previous?.thermalMassKwhPerK,
      heatLossKwPerK: previous?.heatLossKwPerK,
      heatGainKw,
      heatLossKw,
      netHeatKw,
    };
  }

  for (const component of graph.components) {
    if (component.role !== 'store' || !component.domains?.includes('domestic_hot')) {
      continue;
    }

    const previous = previousByComponentId.get(component.id);
    const currentTempC = previous?.currentTemperatureC
      ?? previous?.targetTemperatureC
      ?? DEFAULT_STORED_WATER_TEMP_C;
    const volumeLitres = previous?.volumeLitres;
    const targetTemperatureC = previous?.targetTemperatureC;
    const heatGainKw = round3(storedGainByComponentId.get(component.id) ?? 0);
    const standingLossKw = previous?.standingLossKw ?? 0;
    const netHeatKw = round3(heatGainKw - standingLossKw);

    let nextTempC = currentTempC;
    if (typeof volumeLitres === 'number' && volumeLitres > 0) {
      const heatCapacityKwhPerK = (volumeLitres * WATER_HEAT_CAPACITY_WH_PER_L_K) / 1000;
      const deltaKwh = netHeatKw * timestepHours;
      const deltaTempC = deltaKwh / heatCapacityKwhPerK;
      nextTempC = clamp(currentTempC + deltaTempC, STORED_WATER_TEMP_MIN_C, STORED_WATER_TEMP_MAX_C);
      if (typeof targetTemperatureC === 'number') {
        nextTempC = Math.min(nextTempC, targetTemperatureC);
      }

      const drawOffDemands = drawOffDemandsByStoreComponentId.get(component.id) ?? [];
      if (drawOffDemands.length > 0) {
        const timestepMinutes = Math.max(tickInput.timestepSeconds, 0) / 60;
        let drawOffEventCount = 0;
        for (const drawOffDemand of drawOffDemands) {
          if (timestepMinutes <= 0) {
            continue;
          }
          const drawOffFlowLpm = Math.max(drawOffDemand.drawOffFlowLpm, 0);
          if (drawOffFlowLpm <= 0) {
            continue;
          }

          const mixedOutletTargetTemperatureC = drawOffDemand.mixedOutletTargetTemperatureC;
          const coldInletTemperatureC = drawOffDemand.coldInletTemperatureC;
          const mixedOutletLitres = drawOffFlowLpm * timestepMinutes;
          if (!Number.isFinite(mixedOutletLitres) || mixedOutletLitres <= 0) {
            continue;
          }

          const hotFractionDenominator = nextTempC - coldInletTemperatureC;
          const hotFraction = (
            nextTempC <= mixedOutletTargetTemperatureC
              || !Number.isFinite(hotFractionDenominator)
              || hotFractionDenominator <= 0
          )
            ? 1
            : clamp(
              (mixedOutletTargetTemperatureC - coldInletTemperatureC) / hotFractionDenominator,
              0,
              1,
            );
          const hotDrawnLitres = mixedOutletLitres * hotFraction;
          if (hotDrawnLitres <= 0) {
            continue;
          }

          const drawOffTemperatureDelta = nextTempC - coldInletTemperatureC;
          const drawOffCoolingRatio = hotDrawnLitres / volumeLitres;
          nextTempC = clamp(
            nextTempC - (drawOffCoolingRatio * drawOffTemperatureDelta),
            STORED_WATER_TEMP_MIN_C,
            STORED_WATER_TEMP_MAX_C,
          );
          drawOffEventCount += 1;
        }

        if (drawOffEventCount > 0) {
          events.push({
            type: 'domestic_draw_off_applied',
            componentId: component.id,
            message: `Applied ${drawOffEventCount} domestic draw-off event(s) to stored water node "${component.id}".`,
          });
        }
      }
    } else {
      warnings.push({
        code: 'stored_water_volume_missing',
        componentId: component.id,
        message: `Stored-water node "${component.id}" is missing volumeLitres; temperature integration skipped.`,
      });
    }

    const nextStoredEnergyKwh = typeof volumeLitres === 'number' && volumeLitres > 0
      ? round3((volumeLitres * WATER_HEAT_CAPACITY_WH_PER_L_K * nextTempC) / 1000)
      : previous?.storedEnergyKwh;
    const usableHotWaterLitresAt40C = typeof volumeLitres === 'number' && volumeLitres > 0
      ? round3(clamp(
        TARGET_HOT_WATER_TEMP_C <= COLD_FEED_REFERENCE_TEMP_C
          ? 0
          : volumeLitres
            * ((nextTempC - COLD_FEED_REFERENCE_TEMP_C)
              / (TARGET_HOT_WATER_TEMP_C - COLD_FEED_REFERENCE_TEMP_C)),
        0,
        volumeLitres,
      ))
      : previous?.usableHotWaterLitresAt40C;

    thermalStateByComponentId[component.id] = {
      currentTemperatureC: round3(nextTempC),
      targetTemperatureC,
      volumeLitres,
      heatGainKw,
      standingLossKw,
      netHeatKw,
      storedEnergyKwh: nextStoredEnergyKwh,
      usableHotWaterLitresAt40C,
    };
  }

  for (const component of graph.components) {
    const transfer = heatTransferResult.transferByComponentId[component.id];
    if (!transfer) {
      continue;
    }

    thermalStateByComponentId[component.id] = {
      ...(thermalStateByComponentId[component.id] ?? {}),
      lastTransferKw: transfer.lastTransferKw,
      lastPrimaryInletTemperatureC: transfer.lastPrimaryInletTemperatureC,
      lastPrimaryOutletTemperatureC: transfer.lastPrimaryOutletTemperatureC,
      lastSecondaryGainKw: transfer.lastSecondaryGainKw,
    };
  }

  events.push({
    type: 'thermal_state_integrated',
    message: 'Stage 5 thermal integration applied room and stored-water state updates.',
  });

  return {
    thermalStateByComponentId,
    events,
    warnings,
  };
}
