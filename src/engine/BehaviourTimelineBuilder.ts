/**
 * BehaviourTimelineBuilder.ts
 *
 * Builds a BehaviourTimelineV1 from FullEngineResultCore + EngineInputV2_3.
 *
 * All physics are resolved here — the timeline renderer must be "dumb"
 * (draw only; no calculations).
 *
 * Resolution: 15 minutes (96 points covering 00:00–23:45).
 */
import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { BehaviourTimelineV1, TimelineSeriesPoint } from '../contracts/EngineOutputV1';
import { computeCurrentEfficiencyPct } from './utils/efficiency';
import { DEFAULT_NOMINAL_EFFICIENCY_PCT } from './utils/efficiency';

/** 15-minute resolution: 96 points per day. */
const RESOLUTION_MINS = 15 as const;
const POINTS_PER_DAY = 96;

/**
 * Format a 15-minute index as "HH:MM".
 */
function indexToHHMM(idx: number): string {
  const totalMinutes = idx * RESOLUTION_MINS;
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Linearly interpolate hourly array (24 values) to a 15-minute index.
 */
function interpolateHourly(idx: number, hourly: number[]): number {
  const minute = idx * RESOLUTION_MINS;
  const hour = Math.floor(minute / 60);
  const frac = (minute % 60) / 60;
  const h0 = hour % 24;
  const h1 = (hour + 1) % 24;
  const d0 = hourly[h0] ?? 0;
  const d1 = hourly[h1] ?? 0;
  return Math.max(0, d0 + (d1 - d0) * frac);
}

function indexToHourFloat(idx: number): number {
  return parseFloat(((idx * RESOLUTION_MINS) / 60).toFixed(2));
}

/**
 * Determine operating mode for a timestep.
 */
function resolveMode(
  heatDemandKw: number,
  dhwDemandKw: number,
): TimelineSeriesPoint['mode'] {
  const hasHeat = heatDemandKw > 0.1;
  const hasDhw = dhwDemandKw > 0.1;
  if (hasHeat && hasDhw) return 'mixed';
  if (hasHeat) return 'space';
  if (hasDhw) return 'dhw';
  return 'idle';
}

export function buildBehaviourTimelineV1(
  result: FullEngineResultCore,
  input: EngineInputV2_3,
): BehaviourTimelineV1 {
  const { lifestyle, boilerEfficiencyModelV1 } = result;

  // ── Heat demand (kW) from lifestyle hourly data ──────────────────────────
  const heatLossKw = (input.heatLossWatts ?? 8000) / 1000;
  const hourlyDemandKw = lifestyle.hourlyData.map(h => h.demandKw);

  // ── DHW demand — derive from combiDhwV1 / lifestyle ──────────────────────
  // Use a simplified daily DHW profile: peaks at 07:00 and 19:00.
  // The full DHW timeline with event-level resolution lives in Timeline24hV1;
  // BehaviourTimelineV1 carries the coarser hourly aggregate for the console view.
  const occupancy = input.occupancyCount ?? 2;
  // Typical UK DHW draw: ~3 kW per person during peak windows, 0 otherwise.
  const DHW_KW_PER_PERSON = 2.5;
  const hourlyDhwKw = Array.from({ length: 24 }, (_, h) => {
    if (h === 7 || h === 8) return occupancy * DHW_KW_PER_PERSON;
    if (h === 19 || h === 20) return occupancy * DHW_KW_PER_PERSON * 0.7;
    return 0;
  });

  // ── Appliance capacity ────────────────────────────────────────────────────
  // Combi / boiler sprint capacity = 30 kW (per custom instructions spec).
  const isAshp = lifestyle.recommendedSystem === 'ashp';
  const applianceCap = isAshp ? heatLossKw * 1.2 : 30;

  // A combi boiler enforces DHW priority lockout: when DHW demand is present
  // the CH circuit is fully cut off (deliveredHeatKw = 0).
  // System boilers and regular boilers do NOT have this lockout because
  // they serve DHW via a separate cylinder (priority handled externally).
  // When no boiler type is specified, default to combi behaviour (most common
  // UK residential installation type).
  const boilerType = input.currentSystem?.boiler?.type;
  const isCombi = !isAshp && (boilerType === 'combi' || boilerType == null || boilerType === 'unknown');

  // ── Efficiency baseline ───────────────────────────────────────────────────
  let baseEtaFraction: number;
  if (boilerEfficiencyModelV1?.inHomeAdjustedEta != null) {
    baseEtaFraction = boilerEfficiencyModelV1.inHomeAdjustedEta;
  } else if (boilerEfficiencyModelV1?.ageAdjustedEta != null) {
    baseEtaFraction = boilerEfficiencyModelV1.ageAdjustedEta;
  } else {
    // Fall back to nominal minus a small standing-loss penalty.
    const nominalPct = computeCurrentEfficiencyPct(
      DEFAULT_NOMINAL_EFFICIENCY_PCT,
      0, // no age
    );
    baseEtaFraction = nominalPct / 100;
  }

  // ── Appliance label ───────────────────────────────────────────────────────
  let applianceName = 'Combi Boiler';
  if (isAshp) {
    applianceName = 'ASHP';
  } else if (input.currentSystem?.boiler?.type === 'system') {
    applianceName = 'System Boiler';
  }

  const efficiencyLabel: BehaviourTimelineV1['labels']['efficiencyLabel'] =
    isAshp ? 'COP' : 'Efficiency';

  // Stored DHW decoupling model:
  // - tap draw is decoupled from immediate appliance output
  // - appliance output appears in fixed reheat windows only
  const storedReheatHours = new Set([5, 6, 17, 18, 19]);
  const storedReheatSteps = Array.from({ length: POINTS_PER_DAY }, (_, idx) => idx)
    .filter(idx => storedReheatHours.has(Math.floor((idx * RESOLUTION_MINS) / 60)));
  const dailyDhwEnergyKwh = hourlyDhwKw.reduce((sum, kw) => sum + kw, 0);
  const storedReheatKw = storedReheatSteps.length > 0
    ? Math.min(applianceCap, dailyDhwEnergyKwh / (storedReheatSteps.length * (RESOLUTION_MINS / 60)))
    : 0;
  const storedReheatStepSet = new Set(storedReheatSteps);

  // ── Build 96 points ───────────────────────────────────────────────────────
  const points: TimelineSeriesPoint[] = Array.from({ length: POINTS_PER_DAY }, (_, idx) => {
    const heatDemandKw = parseFloat(interpolateHourly(idx, hourlyDemandKw).toFixed(3));
    const rawDhwDrawDemandKw = parseFloat(interpolateHourly(idx, hourlyDhwKw).toFixed(3));
    const dhwDrawDemandKw = isCombi ? rawDhwDrawDemandKw : 0;
    const storedDhwCallKw = !isAshp && !isCombi && storedReheatStepSet.has(idx)
      ? parseFloat(storedReheatKw.toFixed(3))
      : 0;
    const dhwDemandKw = parseFloat((isCombi ? dhwDrawDemandKw : storedDhwCallKw).toFixed(3));

    // Appliance output: capped at applianceCap, serves heat + DHW demand.
    const hasDhwPriorityCall = dhwDemandKw > 0.1;
    const dhwApplianceOutKw = hasDhwPriorityCall
      ? parseFloat(Math.min(applianceCap, dhwDemandKw).toFixed(3))
      : 0;
    const spaceHeatOutKw = hasDhwPriorityCall
      ? 0
      : parseFloat(Math.min(applianceCap, heatDemandKw).toFixed(3));
    const applianceOutKw = parseFloat((spaceHeatOutKw + dhwApplianceOutKw).toFixed(3));

    // Efficiency / COP
    let efficiency: number | undefined;
    let cop: number | undefined;

    if (isAshp) {
      // Simplified COP: modulates between 2.5 (design temp) and 4.5 (mild day).
      const loadFrac = heatDemandKw / Math.max(heatLossKw, 0.001);
      cop = parseFloat(Math.max(1, Math.min(5, 2.5 + (1 - loadFrac) * 2)).toFixed(2));
    } else {
      // Boiler: η slightly penalised during DHW priority mode (combi stress).
      const dhwActive = dhwDemandKw > 0.1;
      const cyclingPenalty = heatDemandKw < heatLossKw * 0.25 ? 0.05 : 0;
      const dhwPenalty = dhwActive ? 0.03 : 0;
      efficiency = parseFloat(
        Math.max(0.5, Math.min(0.99, baseEtaFraction - cyclingPenalty - dhwPenalty)).toFixed(3),
      );
    }

    const mode = resolveMode(heatDemandKw, dhwDemandKw);

    // ── Combi DHW priority lockout ───────────────────────────────────────
    // When DHW demand exists for a combi boiler, the CH circuit is fully cut:
    //   deliveredHeatKw = 0, deliveredDhwKw = applianceOutKw
    //   unmetHeatKw = heatDemandKw (house cools during DHW ticks)
    let deliveredHeatKw: number | undefined;
    let deliveredDhwKw: number | undefined;
    let unmetHeatKw: number | undefined;

    if (isCombi) {
      const dhwLockout = mode === 'dhw' || mode === 'mixed';
      deliveredHeatKw = dhwLockout ? 0 : parseFloat(applianceOutKw.toFixed(3));
      deliveredDhwKw = dhwLockout ? parseFloat(Math.min(applianceCap, dhwDemandKw).toFixed(3)) : 0;
      unmetHeatKw = dhwLockout ? parseFloat(heatDemandKw.toFixed(3)) : 0;
    }

    return {
      t: indexToHHMM(idx),
      tHour: indexToHourFloat(idx),
      heatDemandKw,
      dhwDemandKw,
      dhwDrawDemandKw,
      dhwApplianceOutKw,
      spaceHeatOutKw,
      applianceOutKw,
      applianceCapKw: parseFloat(applianceCap.toFixed(1)),
      ...(isAshp ? { cop } : { efficiency }),
      mode,
      ...(isCombi ? { deliveredHeatKw, deliveredDhwKw, unmetHeatKw } : {}),
    };
  });

  // ── Assumptions surface ───────────────────────────────────────────────────
  const assumptionsUsed: BehaviourTimelineV1['assumptionsUsed'] = [];

  const engineAssumptions = result.normalizer
    ? [] // normalizer doesn't directly expose assumptions; use meta
    : [];

  // Surface key assumptions that affect the timeline.
  if (!input.heatLossWatts) {
    assumptionsUsed.push({
      id: 'heat-loss-assumed',
      label: 'Heat loss assumed',
      details: 'No heat loss survey data provided — using 8 kW default.',
      severity: 'warn',
    });
  }
  if (!input.occupancyCount) {
    assumptionsUsed.push({
      id: 'occupancy-assumed',
      label: 'Occupancy assumed',
      details: 'Occupancy count not provided — DHW profile uses 2-person default.',
      severity: 'info',
    });
  }
  if (input.mainsDynamicFlowLpm == null) {
    assumptionsUsed.push({
      id: 'mains-flow-assumed',
      label: 'Mains flow assumed',
      details: 'No measured mains flow — capacity limits are estimated.',
      severity: 'warn',
    });
  }

  // Also surface any engine-level assumptions that are marked as warn.
  if (result.boilerEfficiencyModelV1 == null && !isAshp) {
    assumptionsUsed.push({
      id: 'efficiency-assumed',
      label: 'Boiler efficiency assumed',
      details: `No boiler data — using ${DEFAULT_NOMINAL_EFFICIENCY_PCT}% nominal efficiency.`,
      severity: 'info',
    });
  }

  // Suppress duplicate engine assumption IDs from meta if already added above.
  const addedIds = new Set(assumptionsUsed.map(a => a.id));
  const metaAssumptions = result.boilerEfficiencyModelV1?.disclaimerNotes ?? [];
  void metaAssumptions; // reserved for future use
  void engineAssumptions;
  void addedIds;

  // ── Annotations: callouts anchored to notable timeline points ───────────
  const annotations: BehaviourTimelineV1['annotations'] = [];

  if (!isAshp) {
    // DHW saturation annotation: find the first index where appliance is at cap during DHW
    const dhwSatIdx = points.findIndex(
      p => p.dhwDemandKw > 0.1 && p.applianceCapKw != null && p.applianceOutKw >= p.applianceCapKw * 0.98,
    );
    if (dhwSatIdx >= 0) {
      annotations.push({
        atIndex: dhwSatIdx,
        text: `DHW demand forces max output at ${points[dhwSatIdx].t}`,
        row: 'out',
      });
    }

    // Efficiency dip annotation: find the index of minimum efficiency
    const effPoints = points
      .map((p, i) => ({ i, eff: p.efficiency }))
      .filter(x => x.eff != null);
    if (effPoints.length > 0) {
      const minEffEntry = effPoints.reduce((min, x) => (x.eff! < min.eff! ? x : min), effPoints[0]);
      annotations.push({
        atIndex: minEffEntry.i,
        text: `Min ${(minEffEntry.eff! * 100).toFixed(0)}% efficiency`,
        row: 'eff',
      });
    }
  }

  return {
    timezone: 'Europe/London',
    resolutionMins: RESOLUTION_MINS,
    points,
    labels: { applianceName, efficiencyLabel, ...(isCombi ? { isCombi: true } : {}) },
    assumptionsUsed,
    annotations: annotations.length > 0 ? annotations : undefined,
  };
}
