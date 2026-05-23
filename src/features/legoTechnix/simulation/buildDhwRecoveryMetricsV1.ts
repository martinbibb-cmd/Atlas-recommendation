import type { LegoTechnixConfidence } from '../confidence';
import type { ComponentStateV1 } from './ComponentStateV1';
import type { ScenarioResultV1 } from './runLegoTechnixScenarioV1';

const DEFAULT_EXHAUSTION_THRESHOLD_LITRES = 0.5;
const DEFAULT_SHOWER_TARGET_TEMPERATURE_C = 40;
const TARGET_TEMPERATURE_TOLERANCE_C = 0.05;
const DRAW_OFF_TARGET_TOLERANCE_C = 0.5;

export interface DhwRecoveryMetricsOptionsV1 {
  readonly targetTemperatureC?: number;
  readonly showerTargetTemperatureC?: number;
  readonly exhaustionThresholdLitres?: number;
}

export interface DhwRecoveryTimelinePointV1 {
  readonly offsetSeconds: number;
  readonly storedDhwTemperatureC?: number;
  readonly targetTemperatureC?: number;
  readonly usableHotWaterLitresAt40C?: number;
  readonly usableTopLayerHotWaterLitresAt40C?: number;
  readonly recoveryGainKw?: number;
  readonly sourceHeatOutputKw?: number;
  readonly drawOffFlowLpm?: number;
  readonly drawOffTargetTemperatureC?: number;
  readonly exhausted: boolean;
}

export interface DhwRecoveryMetricsV1 {
  readonly schemaVersion: '1.0';
  readonly usableHotWaterTimeline: readonly DhwRecoveryTimelinePointV1[];
  readonly timeToTargetTemperature?: number;
  readonly timeToRecoverAfterDrawOff?: number;
  readonly showerMinutesAvailable?: number;
  readonly bathFillCapacity?: number;
  readonly exhaustionPoint?: number;
  readonly recoveryRateKw?: number;
  readonly recoveryConfidence: LegoTechnixConfidence;
  readonly provenance: readonly string[];
  readonly storageModel: 'mixed' | 'stratified';
  readonly mixedCylinderApproximation: boolean;
  readonly stratifiedCylinderApproximation: boolean;
  readonly targetTemperatureC?: number;
}

function round3(value: number): number {
  return Number(value.toFixed(3));
}

function findStoredDhwState(result: ScenarioResultV1): ComponentStateV1 | undefined {
  const storedDhwComponentId = result.sampleSelectors.storedDhwComponentId;
  if (!storedDhwComponentId) {
    return undefined;
  }

  return result.finalState.componentStates.find((componentState) => componentState.componentId === storedDhwComponentId);
}

function buildTargetTemperatureC(
  result: ScenarioResultV1,
  options: DhwRecoveryMetricsOptionsV1,
): number | undefined {
  return options.targetTemperatureC
    ?? findStoredDhwState(result)?.targetTemperatureC
    ?? result.timelineSamples.find((sample) => typeof sample.storedDhwTargetTemperatureC === 'number')
      ?.storedDhwTargetTemperatureC;
}

function buildTimeline(
  result: ScenarioResultV1,
  exhaustionThresholdLitres: number,
  storageModel: 'mixed' | 'stratified',
): readonly DhwRecoveryTimelinePointV1[] {
  return result.timelineSamples.map((sample) => ({
    offsetSeconds: sample.offsetSeconds,
    storedDhwTemperatureC: sample.storedDhwTemperatureC,
    targetTemperatureC: sample.storedDhwTargetTemperatureC,
    usableHotWaterLitresAt40C: sample.usableHotWaterLitresAt40C,
    usableTopLayerHotWaterLitresAt40C: sample.usableTopLayerHotWaterLitresAt40C,
    recoveryGainKw: sample.storedDhwRecoveryKw,
    sourceHeatOutputKw: sample.sourceHeatOutputKw,
    drawOffFlowLpm: sample.dhwDrawOffFlowLpm,
    drawOffTargetTemperatureC: sample.dhwDrawOffTargetTemperatureC,
    exhausted: (
      storageModel === 'stratified'
        ? (sample.usableTopLayerHotWaterLitresAt40C ?? Number.POSITIVE_INFINITY)
        : (sample.usableHotWaterLitresAt40C ?? Number.POSITIVE_INFINITY)
    ) <= exhaustionThresholdLitres,
  }));
}

function resolveStorageModel(result: ScenarioResultV1): 'mixed' | 'stratified' {
  return findStoredDhwState(result)?.storageModel ?? 'mixed';
}

function findTargetReachOffsetSeconds(
  timeline: readonly DhwRecoveryTimelinePointV1[],
  targetTemperatureC: number | undefined,
  startOffsetSeconds = 0,
): number | undefined {
  if (typeof targetTemperatureC !== 'number') {
    return undefined;
  }

  return timeline.find((sample) => (
    sample.offsetSeconds >= startOffsetSeconds
    && typeof sample.storedDhwTemperatureC === 'number'
    && sample.storedDhwTemperatureC >= (targetTemperatureC - TARGET_TEMPERATURE_TOLERANCE_C)
  ))?.offsetSeconds;
}

function findExhaustionPoint(
  timeline: readonly DhwRecoveryTimelinePointV1[],
): number | undefined {
  for (let index = 0; index < timeline.length; index += 1) {
    const sample = timeline[index];
    const previousSample = index > 0 ? timeline[index - 1] : undefined;
    if (sample.exhausted && !previousSample?.exhausted) {
      return sample.offsetSeconds;
    }
  }

  return undefined;
}

function isShowerSample(
  sample: DhwRecoveryTimelinePointV1,
  showerTargetTemperatureC: number,
): boolean {
  return (sample.drawOffFlowLpm ?? 0) > 0
    && typeof sample.drawOffTargetTemperatureC === 'number'
    && sample.drawOffTargetTemperatureC <= (showerTargetTemperatureC + DRAW_OFF_TARGET_TOLERANCE_C);
}

function findShowerMinutesAvailable(
  timeline: readonly DhwRecoveryTimelinePointV1[],
  showerTargetTemperatureC: number,
  exhaustionPoint: number | undefined,
): number | undefined {
  const showerSamples = timeline.filter((sample) => isShowerSample(sample, showerTargetTemperatureC));
  const showerStartOffsetSeconds = showerSamples[0]?.offsetSeconds;
  if (typeof showerStartOffsetSeconds !== 'number') {
    return undefined;
  }

  const showerEndOffsetSeconds = typeof exhaustionPoint === 'number' && exhaustionPoint >= showerStartOffsetSeconds
    ? exhaustionPoint
    : showerSamples.at(-1)?.offsetSeconds;
  if (typeof showerEndOffsetSeconds !== 'number' || showerEndOffsetSeconds < showerStartOffsetSeconds) {
    return undefined;
  }

  return round3((showerEndOffsetSeconds - showerStartOffsetSeconds) / 60);
}

function findRecoveryWindowStartOffsetSeconds(
  timeline: readonly DhwRecoveryTimelinePointV1[],
): number {
  const lastDrawOffSample = [...timeline].reverse().find((sample) => (sample.drawOffFlowLpm ?? 0) > 0);
  return lastDrawOffSample?.offsetSeconds ?? 0;
}

function findRecoveryRateKw(
  timeline: readonly DhwRecoveryTimelinePointV1[],
  recoveryWindowStartOffsetSeconds: number,
  recoveryWindowEndOffsetSeconds: number | undefined,
): number | undefined {
  const recoverySamples = timeline.filter((sample) => {
    if (sample.offsetSeconds < recoveryWindowStartOffsetSeconds) {
      return false;
    }
    if (
      typeof recoveryWindowEndOffsetSeconds === 'number'
      && sample.offsetSeconds > recoveryWindowEndOffsetSeconds
    ) {
      return false;
    }
    return (sample.recoveryGainKw ?? 0) > 0;
  });

  if (recoverySamples.length === 0) {
    return undefined;
  }

  const averageRecoveryKw = recoverySamples.reduce(
    (sum, sample) => sum + (sample.recoveryGainKw ?? 0),
    0,
  ) / recoverySamples.length;
  return round3(averageRecoveryKw);
}

function buildRecoveryConfidence(
  timeline: readonly DhwRecoveryTimelinePointV1[],
): LegoTechnixConfidence {
  if (timeline.some((sample) => (sample.recoveryGainKw ?? 0) > 0)) {
    return 'derived';
  }
  if (timeline.some((sample) => (sample.sourceHeatOutputKw ?? 0) > 0)) {
    return 'estimated';
  }
  return 'assumed';
}

export function buildDhwRecoveryMetricsV1(
  result: ScenarioResultV1,
  options: DhwRecoveryMetricsOptionsV1 = {},
): DhwRecoveryMetricsV1 {
  const exhaustionThresholdLitres = options.exhaustionThresholdLitres ?? DEFAULT_EXHAUSTION_THRESHOLD_LITRES;
  const showerTargetTemperatureC = options.showerTargetTemperatureC ?? DEFAULT_SHOWER_TARGET_TEMPERATURE_C;
  const targetTemperatureC = buildTargetTemperatureC(result, options);
  const storageModel = resolveStorageModel(result);
  const usableHotWaterTimeline = buildTimeline(result, exhaustionThresholdLitres, storageModel);
  const timeToTargetTemperature = findTargetReachOffsetSeconds(usableHotWaterTimeline, targetTemperatureC);
  const exhaustionPoint = findExhaustionPoint(usableHotWaterTimeline);
  const recoveryWindowStartOffsetSeconds = findRecoveryWindowStartOffsetSeconds(usableHotWaterTimeline);
  const recoveryWindowEndOffsetSeconds = findTargetReachOffsetSeconds(
    usableHotWaterTimeline,
    targetTemperatureC,
    recoveryWindowStartOffsetSeconds,
  );

  return {
    schemaVersion: '1.0',
    usableHotWaterTimeline,
    timeToTargetTemperature,
    timeToRecoverAfterDrawOff: typeof recoveryWindowEndOffsetSeconds === 'number'
      ? recoveryWindowEndOffsetSeconds - recoveryWindowStartOffsetSeconds
      : undefined,
    showerMinutesAvailable: findShowerMinutesAvailable(
      usableHotWaterTimeline,
      showerTargetTemperatureC,
      exhaustionPoint,
    ),
    bathFillCapacity: usableHotWaterTimeline[0]?.usableHotWaterLitresAt40C,
    exhaustionPoint,
    recoveryRateKw: findRecoveryRateKw(
      usableHotWaterTimeline,
      recoveryWindowStartOffsetSeconds,
      recoveryWindowEndOffsetSeconds,
    ),
    recoveryConfidence: buildRecoveryConfidence(usableHotWaterTimeline),
    provenance: [
      'Derived from ScenarioResultV1 timeline samples and final stored-water state.',
      'Recovery rate uses actual per-tick stored-water gains, with source output telemetry retained for provenance.',
      storageModel === 'stratified'
        ? 'Stratified-cylinder approximation: usable hot water and exhaustion are derived from top-layer availability and blending potential.'
        : 'Mixed-cylinder approximation: stored water is treated as fully mixed with no stratification layer modelling.',
    ],
    storageModel,
    mixedCylinderApproximation: storageModel === 'mixed',
    stratifiedCylinderApproximation: storageModel === 'stratified',
    targetTemperatureC,
  };
}
