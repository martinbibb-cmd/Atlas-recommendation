import type { LegoTechnixGraphV1 } from '../types';
import type {
  ComponentStateV1,
  StoredWaterChargingModeV1,
  StoredWaterStorageModelV1,
  StratificationLayerStateV1,
} from './ComponentStateV1';
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
const DEFAULT_STRATIFICATION_LAYER_COUNT = 5;
const DEFAULT_STRATIFICATION_TEMP_SPREAD_C = 8;
const STRATIFICATION_SMOOTHING_FACTOR = 0.08;
const STRATIFICATION_INVERSION_TOLERANCE_C = 0.25;

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

function buildDefaultStratificationLayers(
  volumeLitres: number,
  meanTemperatureC: number,
): readonly StratificationLayerStateV1[] {
  const layerVolume = volumeLitres / DEFAULT_STRATIFICATION_LAYER_COUNT;
  const middleIndex = (DEFAULT_STRATIFICATION_LAYER_COUNT - 1) / 2;
  const stepC = DEFAULT_STRATIFICATION_TEMP_SPREAD_C / Math.max(DEFAULT_STRATIFICATION_LAYER_COUNT - 1, 1);
  return Array.from({ length: DEFAULT_STRATIFICATION_LAYER_COUNT }, (_, layerIndex) => {
    const temperatureC = clamp(
      meanTemperatureC + ((middleIndex - layerIndex) * stepC),
      STORED_WATER_TEMP_MIN_C,
      STORED_WATER_TEMP_MAX_C,
    );
    return {
      layerIndex,
      volumeLitres: round3(layerVolume),
      temperatureC: round3(temperatureC),
      usableAtTargetTemperature: temperatureC >= TARGET_HOT_WATER_TEMP_C,
      confidence: 'derived',
    };
  });
}

function normalizeStratificationLayers(
  componentId: string,
  layers: readonly StratificationLayerStateV1[] | undefined,
  volumeLitres: number,
  meanTemperatureC: number,
  chargingMode: StoredWaterChargingModeV1,
  warnings: LegoTechnixSimulationWarningV1[],
): readonly StratificationLayerStateV1[] {
  const fallbackLayers = buildDefaultStratificationLayers(volumeLitres, meanTemperatureC);
  if (!layers || layers.length === 0) {
    warnings.push({
      code: 'stratified_storage_layers_missing',
      componentId,
      message: `Stratified storage "${componentId}" has no layers; using ${DEFAULT_STRATIFICATION_LAYER_COUNT}-layer default.`,
    });
    return fallbackLayers;
  }

  const totalLayerVolume = layers.reduce((sum, layer) => sum + Math.max(layer.volumeLitres, 0), 0);
  if (Math.abs(totalLayerVolume - volumeLitres) > 0.25) {
    warnings.push({
      code: 'stratified_layer_volume_mismatch',
      componentId,
      message: `Stratified storage "${componentId}" layer volume (${round3(totalLayerVolume)} L) does not match component volume (${round3(volumeLitres)} L).`,
    });
  }

  if (chargingMode !== 'mixed') {
    const hasInversion = layers.some((layer, index) => (
      index > 0
      && layer.temperatureC > (layers[index - 1].temperatureC + STRATIFICATION_INVERSION_TOLERANCE_C)
    ));
    if (hasInversion) {
      warnings.push({
        code: 'stratified_layer_order_inverted',
        componentId,
        message: `Stratified storage "${componentId}" layer order is physically inverted without declared mixed charging mode.`,
      });
    }
  }

  const layerVolume = volumeLitres / layers.length;
  return layers.map((layer, layerIndex) => ({
    layerIndex,
    volumeLitres: round3(layerVolume),
    temperatureC: round3(clamp(layer.temperatureC, STORED_WATER_TEMP_MIN_C, STORED_WATER_TEMP_MAX_C)),
    usableAtTargetTemperature: layer.temperatureC >= TARGET_HOT_WATER_TEMP_C,
    confidence: layer.confidence ?? 'derived',
  }));
}

function applyLayerStandingLoss(
  layers: readonly StratificationLayerStateV1[],
  standingLossKw: number,
  timestepHours: number,
): readonly StratificationLayerStateV1[] {
  if (!(standingLossKw > 0) || !(timestepHours > 0)) {
    return layers;
  }

  const totalHeatCapacityKwhPerK = layers.reduce(
    (sum, layer) => sum + ((layer.volumeLitres * WATER_HEAT_CAPACITY_WH_PER_L_K) / 1000),
    0,
  );
  if (!(totalHeatCapacityKwhPerK > 0)) {
    return layers;
  }
  const deltaTempC = (standingLossKw * timestepHours) / totalHeatCapacityKwhPerK;
  return layers.map((layer) => ({
    ...layer,
    temperatureC: round3(clamp(
      layer.temperatureC - deltaTempC,
      STORED_WATER_TEMP_MIN_C,
      STORED_WATER_TEMP_MAX_C,
    )),
  }));
}

function applyLayerCharging(
  layers: readonly StratificationLayerStateV1[],
  heatGainKw: number,
  timestepHours: number,
  chargingMode: StoredWaterChargingModeV1,
  targetTemperatureC?: number,
): readonly StratificationLayerStateV1[] {
  let remainingEnergyKwh = Math.max(heatGainKw, 0) * Math.max(timestepHours, 0);
  if (!(remainingEnergyKwh > 0) || layers.length === 0) {
    return layers;
  }

  const maxTemperatureC = targetTemperatureC ?? STORED_WATER_TEMP_MAX_C;
  const nextLayers = layers.map((layer) => ({ ...layer }));
  const indexOrder = chargingMode === 'bottom_coil'
    ? [...nextLayers.keys()].reverse()
    : [...nextLayers.keys()];

  if (chargingMode === 'mixed') {
    const perLayerEnergyKwh = remainingEnergyKwh / nextLayers.length;
    for (const layer of nextLayers) {
      const layerHeatCapacityKwhPerK = (layer.volumeLitres * WATER_HEAT_CAPACITY_WH_PER_L_K) / 1000;
      const maxDeltaTempC = Math.max(maxTemperatureC - layer.temperatureC, 0);
      const appliedEnergyKwh = Math.min(perLayerEnergyKwh, layerHeatCapacityKwhPerK * maxDeltaTempC);
      layer.temperatureC = round3(clamp(
        layer.temperatureC + (appliedEnergyKwh / Math.max(layerHeatCapacityKwhPerK, Number.EPSILON)),
        STORED_WATER_TEMP_MIN_C,
        STORED_WATER_TEMP_MAX_C,
      ));
    }
    return nextLayers;
  }

  for (const layerIndex of indexOrder) {
    if (!(remainingEnergyKwh > 0)) {
      break;
    }
    const layer = nextLayers[layerIndex];
    const layerHeatCapacityKwhPerK = (layer.volumeLitres * WATER_HEAT_CAPACITY_WH_PER_L_K) / 1000;
    const maxDeltaTempC = Math.max(maxTemperatureC - layer.temperatureC, 0);
    const layerEnergyCapacityKwh = layerHeatCapacityKwhPerK * maxDeltaTempC;
    if (!(layerEnergyCapacityKwh > 0)) {
      continue;
    }
    const appliedEnergyKwh = Math.min(remainingEnergyKwh, layerEnergyCapacityKwh);
    layer.temperatureC = round3(clamp(
      layer.temperatureC + (appliedEnergyKwh / Math.max(layerHeatCapacityKwhPerK, Number.EPSILON)),
      STORED_WATER_TEMP_MIN_C,
      STORED_WATER_TEMP_MAX_C,
    ));
    remainingEnergyKwh -= appliedEnergyKwh;
  }

  return nextLayers;
}

interface LayerChunkV1 {
  temperatureC: number;
  volumeLitres: number;
}

function applyTopDrawOffAndBottomReplenishment(
  layers: readonly StratificationLayerStateV1[],
  hotDrawnLitres: number,
  coldInletTemperatureC: number,
): readonly StratificationLayerStateV1[] {
  if (!(hotDrawnLitres > 0) || layers.length === 0) {
    return layers;
  }

  const chunks: LayerChunkV1[] = layers.map((layer) => ({
    temperatureC: layer.temperatureC,
    volumeLitres: layer.volumeLitres,
  }));
  let remainingDrawLitres = hotDrawnLitres;
  while (remainingDrawLitres > 1e-9 && chunks.length > 0) {
    const topChunk = chunks[0];
    const drawnLitres = Math.min(topChunk.volumeLitres, remainingDrawLitres);
    topChunk.volumeLitres -= drawnLitres;
    remainingDrawLitres -= drawnLitres;
    if (topChunk.volumeLitres <= 1e-9) {
      chunks.shift();
    }
  }

  chunks.push({
    temperatureC: clamp(coldInletTemperatureC, STORED_WATER_TEMP_MIN_C, STORED_WATER_TEMP_MAX_C),
    volumeLitres: hotDrawnLitres,
  });

  const rebuiltLayers: StratificationLayerStateV1[] = [];
  for (const layer of layers) {
    let requiredLitres = layer.volumeLitres;
    let weightedTempSum = 0;
    while (requiredLitres > 1e-9) {
      if (chunks.length === 0) {
        weightedTempSum += requiredLitres * coldInletTemperatureC;
        requiredLitres = 0;
        break;
      }
      const chunk = chunks[0];
      const usedLitres = Math.min(chunk.volumeLitres, requiredLitres);
      weightedTempSum += usedLitres * chunk.temperatureC;
      chunk.volumeLitres -= usedLitres;
      requiredLitres -= usedLitres;
      if (chunk.volumeLitres <= 1e-9) {
        chunks.shift();
      }
    }
    rebuiltLayers.push({
      ...layer,
      temperatureC: round3(clamp(
        weightedTempSum / Math.max(layer.volumeLitres, Number.EPSILON),
        STORED_WATER_TEMP_MIN_C,
        STORED_WATER_TEMP_MAX_C,
      )),
    });
  }

  return rebuiltLayers;
}

function applyNeighbourSmoothing(
  layers: readonly StratificationLayerStateV1[],
): readonly StratificationLayerStateV1[] {
  if (layers.length < 2) {
    return layers;
  }

  const nextTemperatures = layers.map((layer) => layer.temperatureC);
  for (let index = 0; index < layers.length - 1; index += 1) {
    const deltaC = nextTemperatures[index] - nextTemperatures[index + 1];
    const exchangeC = deltaC * STRATIFICATION_SMOOTHING_FACTOR;
    nextTemperatures[index] -= exchangeC;
    nextTemperatures[index + 1] += exchangeC;
  }

  return layers.map((layer, layerIndex) => ({
    ...layer,
    temperatureC: round3(clamp(nextTemperatures[layerIndex], STORED_WATER_TEMP_MIN_C, STORED_WATER_TEMP_MAX_C)),
  }));
}

function computeLayerUsableLitresAt40C(
  layer: StratificationLayerStateV1,
): number {
  return clamp(
    layer.volumeLitres * (
      (layer.temperatureC - COLD_FEED_REFERENCE_TEMP_C)
      / (TARGET_HOT_WATER_TEMP_C - COLD_FEED_REFERENCE_TEMP_C)
    ),
    0,
    layer.volumeLitres,
  );
}

function computeTopLayerUsableHotWaterLitresAt40C(
  layers: readonly StratificationLayerStateV1[],
): number {
  let totalUsableLitres = 0;
  for (const layer of layers) {
    const usableLitres = computeLayerUsableLitresAt40C(layer);
    if (!(usableLitres > 0)) {
      break;
    }
    totalUsableLitres += usableLitres;
  }
  return round3(totalUsableLitres);
}

function computeTotalUsableHotWaterLitresAt40C(
  layers: readonly StratificationLayerStateV1[],
): number {
  return round3(layers.reduce(
    (sum, layer) => sum + computeLayerUsableLitresAt40C(layer),
    0,
  ));
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
    const storageModel: StoredWaterStorageModelV1 = previous?.storageModel ?? 'mixed';
    const chargingMode: StoredWaterChargingModeV1 | undefined = storageModel === 'stratified'
      ? (previous?.chargingMode ?? 'top_down')
      : previous?.chargingMode;
    const heatGainKw = round3(storedGainByComponentId.get(component.id) ?? 0);
    const standingLossKw = previous?.standingLossKw ?? 0;
    const netHeatKw = round3(heatGainKw - standingLossKw);

    let nextTempC = currentTempC;
    let stratificationLayers: readonly StratificationLayerStateV1[] | undefined = previous?.stratificationLayers;
    if (typeof volumeLitres === 'number' && volumeLitres > 0) {
      const drawOffDemands = drawOffDemandsByStoreComponentId.get(component.id) ?? [];
      if (storageModel === 'stratified') {
        if (chargingMode !== 'top_down') {
          warnings.push({
            code: 'mixergy_lite_non_top_down',
            componentId: component.id,
            message: `Stratified storage "${component.id}" is using "${chargingMode}" charging mode; Mixergy-lite default is top_down.`,
          });
        }

        stratificationLayers = normalizeStratificationLayers(
          component.id,
          previous?.stratificationLayers,
          volumeLitres,
          currentTempC,
          chargingMode ?? 'top_down',
          warnings,
        );
        stratificationLayers = applyLayerCharging(
          stratificationLayers,
          heatGainKw,
          timestepHours,
          chargingMode ?? 'top_down',
          targetTemperatureC,
        );
        stratificationLayers = applyLayerStandingLoss(stratificationLayers, standingLossKw, timestepHours);

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
          const mixedOutletLitres = drawOffFlowLpm * timestepMinutes;
          if (!Number.isFinite(mixedOutletLitres) || mixedOutletLitres <= 0) {
            continue;
          }
          const hottestLayerTempC = Math.max(...stratificationLayers.map((layer) => layer.temperatureC));
          if (hottestLayerTempC < drawOffDemand.mixedOutletTargetTemperatureC) {
            warnings.push({
              code: 'stratified_draw_target_unmet',
              componentId: component.id,
              message: `Stratified storage "${component.id}" cannot meet draw-off target ${drawOffDemand.mixedOutletTargetTemperatureC}°C from any layer.`,
            });
          }

          const hotFractionDenominator = hottestLayerTempC - drawOffDemand.coldInletTemperatureC;
          const hotFraction = (
            hottestLayerTempC <= drawOffDemand.mixedOutletTargetTemperatureC
              || !Number.isFinite(hotFractionDenominator)
              || hotFractionDenominator <= 0
          )
            ? 1
            : clamp(
              (drawOffDemand.mixedOutletTargetTemperatureC - drawOffDemand.coldInletTemperatureC)
                / hotFractionDenominator,
              0,
              1,
            );
          const hotDrawnLitres = mixedOutletLitres * hotFraction;
          if (!(hotDrawnLitres > 0)) {
            continue;
          }
          stratificationLayers = applyTopDrawOffAndBottomReplenishment(
            stratificationLayers,
            hotDrawnLitres,
            drawOffDemand.coldInletTemperatureC,
          );
          drawOffEventCount += 1;
        }

        stratificationLayers = applyNeighbourSmoothing(stratificationLayers)
          .map((layer) => ({
            ...layer,
            usableAtTargetTemperature: layer.temperatureC >= TARGET_HOT_WATER_TEMP_C,
            confidence: layer.confidence ?? 'derived',
          }));

        const weightedTemperatureSum = stratificationLayers.reduce(
          (sum, layer) => sum + (layer.temperatureC * layer.volumeLitres),
          0,
        );
        nextTempC = clamp(
          weightedTemperatureSum / Math.max(volumeLitres, Number.EPSILON),
          STORED_WATER_TEMP_MIN_C,
          STORED_WATER_TEMP_MAX_C,
        );
        if (drawOffEventCount > 0) {
          events.push({
            type: 'domestic_draw_off_applied',
            componentId: component.id,
            message: `Applied ${drawOffEventCount} domestic draw-off event(s) to stored water node "${component.id}".`,
          });
        }
      } else {
        const heatCapacityKwhPerK = (volumeLitres * WATER_HEAT_CAPACITY_WH_PER_L_K) / 1000;
        const deltaKwh = netHeatKw * timestepHours;
        const deltaTempC = deltaKwh / heatCapacityKwhPerK;
        nextTempC = clamp(currentTempC + deltaTempC, STORED_WATER_TEMP_MIN_C, STORED_WATER_TEMP_MAX_C);
        if (typeof targetTemperatureC === 'number') {
          nextTempC = Math.min(nextTempC, targetTemperatureC);
        }

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
      ? storageModel === 'stratified' && stratificationLayers
        ? computeTotalUsableHotWaterLitresAt40C(stratificationLayers)
        : round3(clamp(
          TARGET_HOT_WATER_TEMP_C <= COLD_FEED_REFERENCE_TEMP_C
            ? 0
            : volumeLitres
              * ((nextTempC - COLD_FEED_REFERENCE_TEMP_C)
                / (TARGET_HOT_WATER_TEMP_C - COLD_FEED_REFERENCE_TEMP_C)),
          0,
          volumeLitres,
        ))
      : previous?.usableHotWaterLitresAt40C;
    const usableTopLayerHotWaterLitresAt40C = storageModel === 'stratified' && stratificationLayers
      ? computeTopLayerUsableHotWaterLitresAt40C(stratificationLayers)
      : previous?.usableTopLayerHotWaterLitresAt40C;

    thermalStateByComponentId[component.id] = {
      currentTemperatureC: round3(nextTempC),
      targetTemperatureC,
      volumeLitres,
      storageModel,
      chargingMode,
      stratificationLayers,
      heatGainKw,
      standingLossKw,
      netHeatKw,
      storedEnergyKwh: nextStoredEnergyKwh,
      usableHotWaterLitresAt40C,
      usableTopLayerHotWaterLitresAt40C,
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
      primaryCoilInletTemperatureC: transfer.family === 'cylinder_coil'
        ? transfer.lastPrimaryInletTemperatureC
        : undefined,
      primaryCoilOutletTemperatureC: transfer.family === 'cylinder_coil'
        ? transfer.lastPrimaryOutletTemperatureC
        : undefined,
      lastRecoveryKw: transfer.family === 'cylinder_coil' ? transfer.lastSecondaryGainKw : undefined,
      radiatorPrimaryReturnTemperatureC: transfer.family === 'radiator'
        ? transfer.lastPrimaryOutletTemperatureC
        : undefined,
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
