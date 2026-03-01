import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { VisualSpecV1, Timeline24hV1, Timeline24hEvent, Timeline24hSeries, TimelineBandsV1, DhwEventEntry, PhysicsDebugV1 } from '../contracts/EngineOutputV1';
import { buildAssumptionsV1 } from './AssumptionsBuilder';
import { solveSystemTimeline, buildSystemConfig, dhwKwFromFlow, DHW_COLD_WATER_TEMP_C, DHW_TARGET_HOT_TEMP_C } from './timeline/Solver24hV1';
import { resolveNominalEfficiencyPct, computeCurrentEfficiencyPct, deriveErpClass } from './utils/efficiency';

/** 96 time points at 15-minute intervals covering 0–1425 minutes. */
const TIME_MINUTES = Array.from({ length: 96 }, (_, i) => i * 15);

/** Default DHW event schedule for a typical UK household day (used when no lifestyle profile is provided). */
const DEFAULT_EVENTS: Timeline24hEvent[] = [
  { startMin: 420, endMin: 435, kind: 'sink',        intensity: 'med'  }, // 07:00–07:15 morning DHW draw
  { startMin: 1140, endMin: 1170, kind: 'bath',       intensity: 'high' }, // 19:00–19:30 evening bath
  { startMin: 1200, endMin: 1245, kind: 'dishwasher', intensity: 'low'  }, // 20:00–20:45 dishwasher
];

/**
 * Generate DHW events deterministically from a `lifestyleProfileV1` input.
 * Returns an array of Timeline24hEvent items reflecting the user's actual day
 * rather than the generic template.
 */
export function generateDhwEventsFromProfile(
  profile: NonNullable<EngineInputV2_3['lifestyleProfileV1']>,
): Timeline24hEvent[] {
  const events: Timeline24hEvent[] = [];

  if (profile.morningPeakEnabled) {
    if (profile.hasBath) {
      // Morning bath: 07:00–07:30 at high intensity
      events.push({ startMin: 420, endMin: 450, kind: 'bath', intensity: 'high' });
    } else {
      // Morning DHW draw (sink): 07:00–07:15 at medium intensity
      events.push({ startMin: 420, endMin: 435, kind: 'sink', intensity: 'med' });
    }
    if (profile.twoSimultaneousBathrooms) {
      // Second bathroom: 07:05–07:25 — deliberately overlaps with first event to model simultaneous demand
      events.push({ startMin: 425, endMin: 445, kind: 'sink', intensity: 'med' });
    }
  }

  if (profile.eveningPeakEnabled) {
    if (profile.hasBath) {
      // Evening bath: 19:00–19:30 at high intensity
      events.push({ startMin: 1140, endMin: 1170, kind: 'bath', intensity: 'high' });
    } else {
      // Evening DHW draw (sink): 19:00–19:15 at medium intensity
      events.push({ startMin: 1140, endMin: 1155, kind: 'sink', intensity: 'med' });
    }
    if (profile.twoSimultaneousBathrooms) {
      // Second bathroom: 19:05–19:25 — deliberately overlaps with first event to model simultaneous demand
      events.push({ startMin: 1145, endMin: 1165, kind: 'sink', intensity: 'med' });
    }
    if (profile.hasDishwasher) {
      // Dishwasher after dinner: 20:00–20:45 — cold-fill, cold flow event only (not thermal DHW)
      events.push({ startMin: 1200, endMin: 1245, kind: 'dishwasher', intensity: 'low' });
    }
  } else if (profile.hasDishwasher) {
    // Dishwasher even without an evening peak (e.g. lunch time) — cold-fill, cold flow event only
    events.push({ startMin: 780, endMin: 825, kind: 'dishwasher', intensity: 'low' });
  }

  if (profile.hasWashingMachine) {
    // Washing machine: first fill pulse 09:00–09:10 (~10 L/min), repeat fill pulse 09:55–10:05
    // Cold-fill only — does NOT contribute to DHW thermal demand
    events.push({ startMin: 540, endMin: 550, kind: 'washing_machine', intensity: 'low' });
    events.push({ startMin: 595, endMin: 605, kind: 'washing_machine', intensity: 'low' });
  }

  return events;
}

/**
 * Interpolate the hourly demand kW array (24 values) to the given 15-minute
 * point index using linear interpolation between adjacent hours.
 */
function interpolateDemandKw(minuteIdx: number, hourlyDemandKw: number[]): number {
  const minute = minuteIdx * 15;
  const hour = Math.floor(minute / 60);
  const frac = (minute % 60) / 60;
  const h0 = hour % 24;
  const h1 = (hour + 1) % 24;
  const d0 = hourlyDemandKw[h0] ?? 0;
  const d1 = hourlyDemandKw[h1] ?? 0;
  return Math.max(0, d0 + (d1 - d0) * frac);
}

/**
 * Return true if the given minute falls within a **thermal** DHW event
 * (sink, bath, or charge). Cold-fill appliances (dishwasher, washing_machine)
 * and cold_only events do NOT create a thermal spike and are intentionally excluded here.
 */
function isDhwActive(minuteOfDay: number, events: Timeline24hEvent[]): boolean {
  return events.some(
    e =>
      minuteOfDay >= e.startMin &&
      minuteOfDay < e.endMin &&
      (e.kind === 'sink' || e.kind === 'bath' || e.kind === 'charge'),
  );
}

/**
 * Return true if the given minute falls within a cold-fill appliance event
 * (dishwasher or washing machine). These drive cold-mains flow demand but
 * do NOT constitute a DHW thermal load.
 */
function isColdFlowActive(minuteOfDay: number, events: Timeline24hEvent[]): boolean {
  return events.some(
    e =>
      minuteOfDay >= e.startMin &&
      minuteOfDay < e.endMin &&
      (e.kind === 'dishwasher' || e.kind === 'washing_machine'),
  );
}

/** Hot-water draw (kW) per event kind × intensity. Derived from dhwKwFromFlow() with ΔT = DHW_TARGET_HOT_TEMP_C − DHW_COLD_WATER_TEMP_C = 35°C. */
const DHW_DELTA_T_C = DHW_TARGET_HOT_TEMP_C - DHW_COLD_WATER_TEMP_C;
const DHW_DRAW_KW_TABLE: Record<string, Record<string, number>> = {
  bath:   { low: dhwKwFromFlow(6, DHW_DELTA_T_C), med: dhwKwFromFlow(9, DHW_DELTA_T_C), high: dhwKwFromFlow(12, DHW_DELTA_T_C) },
  sink:   { low: dhwKwFromFlow(2, DHW_DELTA_T_C), med: dhwKwFromFlow(4, DHW_DELTA_T_C), high: dhwKwFromFlow(6,  DHW_DELTA_T_C) },
};

/**
 * Return the list of active hot-water draw entries at `minuteOfDay` from the events schedule.
 * Cold-fill appliances (dishwasher, washing_machine) are excluded — they are not thermal loads.
 */
function getActiveHotWaterDraws(minuteOfDay: number, events: Timeline24hEvent[]): DhwEventEntry[] {
  const entries: DhwEventEntry[] = [];
  for (const ev of events) {
    if (minuteOfDay < ev.startMin || minuteOfDay >= ev.endMin) continue;
    if (ev.kind === 'dishwasher' || ev.kind === 'washing_machine' || ev.kind === 'cold_only') continue;
    const drawKw = DHW_DRAW_KW_TABLE[ev.kind]?.[ev.intensity] ?? 0;
    if (drawKw > 0) {
      entries.push({ kind: ev.kind as DhwEventEntry['kind'], drawKw });
    }
  }
  return entries;
}

/**
 * Build a 96-point cold mains flow demand array (L/min) from cold-flow events
 * (dishwasher and washing machine).
 *
 * Flow rates reflect realistic UK cold-fill appliance behaviour:
 *   - Dishwasher:      8–12 L/min for the first fill window
 *   - Washing machine: 6–8 L/min per fill pulse
 *
 * These are hydraulic loads on the cold mains, NOT thermal loads.
 */
function generateColdFlowLpm(events: Timeline24hEvent[]): number[] {
  const coldFlowLpm: number[] = new Array(96).fill(0);
  for (const event of events) {
    if (event.kind !== 'dishwasher' && event.kind !== 'washing_machine') continue;
    const flowLpm = event.kind === 'dishwasher' ? 10 : 7; // L/min representative values
    const startIdx = Math.floor(event.startMin / 15);
    const endIdx = Math.ceil(event.endMin / 15);
    for (let i = startIdx; i < endIdx && i < 96; i++) {
      coldFlowLpm[i] = Math.max(coldFlowLpm[i], flowLpm);
    }
  }
  return coldFlowLpm;
}

/**
 * Build series data for a combi / on-demand boiler system.
 * η drops during simultaneous DHW events (combi stress).
 * When `efficiencySeries` is provided it is used directly (SEDBUK tail-off model);
 * otherwise falls back to the constant `baseEtaPct` approach.
 *
 * Cold-fill appliance events (dishwasher, washing machine) do NOT cause a DHW
 * thermal penalty. However, if the cold-water supply quality is 'weak', their
 * mains flow demand can destabilise combi flow-switch behaviour — a minor
 * efficiency instability penalty is applied in that case.
 */
function buildCombiSeries(
  id: string,
  label: string,
  demandKwArr: number[],
  events: Timeline24hEvent[],
  baseEtaPct: number,
  efficiencySeries?: number[],
  cwsUnstable?: boolean,
): Timeline24hSeries {
  const heatDeliveredKw: number[] = [];
  const efficiency: number[] = [];
  const comfortTempC: number[] = [];
  const dhwOutletTempC: number[] = [];
  const dhwTotalKw: number[] = [];
  const dhwEventsActive: DhwEventEntry[][] = [];

  for (let i = 0; i < 96; i++) {
    const minuteOfDay = i * 15;
    const demandKw = demandKwArr[i];
    const dhwActive = isDhwActive(minuteOfDay, events);
    const coldFlowActive = isColdFlowActive(minuteOfDay, events);

    // Use SEDBUK tail-off efficiency when available; otherwise apply DHW stress penalty.
    // Cold-fill appliances (dishwasher/washing machine) are NOT thermal DHW events —
    // they do not trigger the thermal efficiency penalty.
    const etaBase = efficiencySeries ? efficiencySeries[i] : baseEtaPct / 100;
    let eta = (!efficiencySeries && dhwActive)
      ? Math.max(0.60, etaBase - 0.08)
      : (efficiencySeries && dhwActive)
        ? Math.max(0.55, etaBase - 0.05)
        : etaBase;

    // Cold flow instability: when mains supply is unstable (inconsistent readings or no measurements),
    // simultaneous cold-fill appliance demand can cause combi flow-switch wobble → minor efficiency penalty.
    if (coldFlowActive && cwsUnstable) {
      eta = Math.max(0.60, eta - 0.03);
    }

    const delivered = demandKw * eta;

    // Comfort: boiler provides sharp temperature swings (fraction-driven)
    const fraction = demandKwArr[i] / (Math.max(...demandKwArr) || 1);
    const comfort = 18 + fraction * 4;

    // DHW outlet: drops during heavy draw events
    const dhwOutlet = dhwActive ? 42 : 50;

    // Per-timestep DHW draw entries
    const activeDraws = getActiveHotWaterDraws(minuteOfDay, events);
    const totalDhw = parseFloat(activeDraws.reduce((s, e) => s + e.drawKw, 0).toFixed(3));

    heatDeliveredKw.push(parseFloat(delivered.toFixed(3)));
    efficiency.push(parseFloat(eta.toFixed(3)));
    comfortTempC.push(parseFloat(comfort.toFixed(1)));
    dhwOutletTempC.push(dhwOutlet);
    dhwTotalKw.push(totalDhw);
    dhwEventsActive.push(activeDraws);
  }

  return {
    id, label, heatDeliveredKw, efficiency, comfortTempC, dhwOutletTempC,
    performanceKind: 'eta',
    dhwTotalKw,
    dhwEventsActive,
  };
}

/**
 * Build series data for a stored hot-water system (vented or unvented).
 * Stable DHW delivery; space heating from a system boiler.
 * When `efficiencySeries` is provided it is used directly (SEDBUK tail-off model).
 */
function buildStoredSeries(
  id: string,
  label: string,
  demandKwArr: number[],
  events: Timeline24hEvent[],
  isUnvented: boolean,
  efficiencySeries?: number[],
): Timeline24hSeries {
  const baseEta = 0.88; // typical system boiler efficiency
  const heatDeliveredKw: number[] = [];
  const efficiency: number[] = [];
  const comfortTempC: number[] = [];
  const dhwOutletTempC: number[] = [];
  const dhwTotalKw: number[] = [];
  const dhwEventsActive: DhwEventEntry[][] = [];

  const peakDemand = Math.max(...demandKwArr) || 1;

  for (let i = 0; i < 96; i++) {
    const minuteOfDay = i * 15;
    const demandKw = demandKwArr[i];
    const dhwActive = isDhwActive(minuteOfDay, events);

    // Stored: space heating efficiency uses SEDBUK series when available, else stable baseEta
    const eta = efficiencySeries ? efficiencySeries[i] : baseEta;
    const delivered = demandKw * eta;
    const fraction = demandKw / peakDemand;
    const comfort = 19 + (fraction > 0.6 ? 1.5 : 0);

    // Unvented has slightly higher stable outlet temp due to mains pressure
    const dhwOutlet = dhwActive
      ? (isUnvented ? 57 : 53)
      : (isUnvented ? 62 : 58);

    // Per-timestep DHW draw entries
    const activeDraws = getActiveHotWaterDraws(minuteOfDay, events);
    const totalDhw = parseFloat(activeDraws.reduce((s, e) => s + e.drawKw, 0).toFixed(3));

    heatDeliveredKw.push(parseFloat(delivered.toFixed(3)));
    efficiency.push(parseFloat(eta.toFixed(3)));
    comfortTempC.push(parseFloat(comfort.toFixed(1)));
    dhwOutletTempC.push(dhwOutlet);
    dhwTotalKw.push(totalDhw);
    dhwEventsActive.push(activeDraws);
  }

  return {
    id, label, heatDeliveredKw, efficiency, comfortTempC, dhwOutletTempC,
    performanceKind: 'eta',
    dhwTotalKw,
    dhwEventsActive,
  };
}

/**
 * Build series data for an ASHP system.
 * COP proxy (≈ 3.0 at 45°C flow; higher at lower flow temps).
 */
function buildAshpSeries(
  id: string,
  label: string,
  demandKwArr: number[],
  designFlowTempBand: 35 | 45 | 50,
  events: Timeline24hEvent[],
): Timeline24hSeries {
  // COP lookup: lower flow temp → higher COP
  const copByBand: Record<35 | 45 | 50, number> = { 35: 3.8, 45: 3.0, 50: 2.6 };
  const cop = copByBand[designFlowTempBand];

  const heatDeliveredKw: number[] = [];
  const efficiency: number[] = [];
  const comfortTempC: number[] = [];
  const dhwOutletTempC: number[] = [];
  const dhwTotalKw: number[] = [];
  const dhwEventsActive: DhwEventEntry[][] = [];

  for (let i = 0; i < 96; i++) {
    const minuteOfDay = i * 15;
    const demandKw = demandKwArr[i];
    // ASHP "low and slow" — stable delivery matching demand
    const delivered = demandKw; // heat pump output tracks demand smoothly
    // Comfort: ASHP maintains a flat horizon exploiting thermal mass
    const comfort = 19.5 + Math.sin((i / 96) * Math.PI) * 0.5;
    // DHW from ASHP cylinder is stable
    const dhwOutlet = 55;

    // Per-timestep DHW draw entries
    const activeDraws = getActiveHotWaterDraws(minuteOfDay, events);
    const totalDhw = parseFloat(activeDraws.reduce((s, e) => s + e.drawKw, 0).toFixed(3));

    heatDeliveredKw.push(parseFloat(delivered.toFixed(3)));
    efficiency.push(parseFloat(cop.toFixed(2)));
    comfortTempC.push(parseFloat(comfort.toFixed(1)));
    dhwOutletTempC.push(dhwOutlet);
    dhwTotalKw.push(totalDhw);
    dhwEventsActive.push(activeDraws);
  }

  return {
    id, label, heatDeliveredKw, efficiency, comfortTempC, dhwOutletTempC,
    performanceKind: 'cop',
    dhwTotalKw,
    dhwEventsActive,
  };
}

/** Resolve a system ID to its human-readable label. */
function systemLabel(systemId: string, input: EngineInputV2_3): string {
  const labels: Record<string, string> = {
    current:          'Current System',
    on_demand:        'Combi Boiler',
    stored_vented:    'Stored — Vented Cylinder',
    stored_unvented:  'Stored — Unvented Cylinder',
    ashp:             'Air Source Heat Pump',
    regular_vented:   'Regular Vented Boiler',
    system_unvented:  'System Unvented Boiler',
  };
  if (systemId === 'current' && input.currentHeatSourceType) {
    const currentLabels: Record<string, string> = {
      combi:  'Current Combi Boiler',
      system: 'Current System Boiler',
      regular: 'Current Regular Boiler',
      ashp:   'Current ASHP',
      other:  'Current Heat Source',
    };
    return currentLabels[input.currentHeatSourceType] ?? 'Current System';
  }
  return labels[systemId] ?? systemId;
}

/** Build a series for any recognised system ID. */
function buildSeriesForSystem(
  systemId: string,
  input: EngineInputV2_3,
  demandKwArr: number[],
  events: Timeline24hEvent[],
  designFlowTempBand: 35 | 45 | 50,
  combiEtaPct: number,
  efficiencySeries?: number[],
  cwsUnstable?: boolean,
  solverCore?: { peakHeatLossKw: number; tauHours: number },
): Timeline24hSeries {
  const label = systemLabel(systemId, input);

  // 'current' maps to the current heat source type or falls back to combi
  const effectiveId =
    systemId === 'current'
      ? (input.currentHeatSourceType === 'ashp' ? 'ashp' :
         input.currentHeatSourceType === 'system' ? 'stored_vented' :
         'on_demand')
      : systemId;

  let series: Timeline24hSeries;
  switch (effectiveId) {
    case 'ashp':
      series = buildAshpSeries(systemId, label, demandKwArr, designFlowTempBand, events);
      break;
    case 'stored_vented':
    case 'regular_vented':
      series = buildStoredSeries(systemId, label, demandKwArr, events, false, efficiencySeries);
      break;
    case 'stored_unvented':
    case 'system_unvented':
      series = buildStoredSeries(systemId, label, demandKwArr, events, true, efficiencySeries);
      break;
    case 'on_demand':
    default:
      series = buildCombiSeries(systemId, label, demandKwArr, events, combiEtaPct, efficiencySeries, cwsUnstable);
      break;
  }

  // Augment series with solver-based physics fields when solver core is available
  if (solverCore && solverCore.peakHeatLossKw > 0 && solverCore.tauHours > 0) {
    // Derive mean baseEta for boilers: use mean of SEDBUK series when available, else combi pct
    const baseEta = (efficiencySeries && efficiencySeries.length > 0)
      ? efficiencySeries.reduce((a, b) => a + b, 0) / efficiencySeries.length
      : combiEtaPct / 100;

    const systemConfig = buildSystemConfig(systemId, solverCore.peakHeatLossKw, {
      baseEta,
      designFlowTempBand,
      currentHeatSourceType: input.currentHeatSourceType,
    });

    const physicsResult = solveSystemTimeline(
      { ...solverCore },
      systemConfig,
      events,
    );

    series = {
      ...series,
      roomTempC: physicsResult.roomTempC,
      inputPowerKw: physicsResult.inputPowerKw,
      dhwState: physicsResult.dhwState,
      heatDemandKw: physicsResult.heatDemandKw,
    };
  }

  return series;
}

/**
 * Build a `timeline_24h` VisualSpecV1 comparing two systems A and B.
 *
 * @param core     Full engine result core (all module outputs).
 * @param input    Engine input (used for heat loss, lifestyle profile, etc.).
 * @param systemIds  Tuple [systemIdA, systemIdB]. Defaults to ['current', primary recommendation].
 * @param debug    When true, populates physicsDebug in the payload for the debug overlay.
 */
export function buildTimeline24hV1(
  core: FullEngineResultCore,
  input: EngineInputV2_3,
  systemIds?: [string, string],
  debug?: boolean,
): VisualSpecV1 {
  // Resolve the recommendation for system B default
  const primaryRec = core.lifestyle.recommendedSystem === 'ashp' ? 'ashp'
    : core.lifestyle.recommendedSystem === 'stored_water' ? 'stored_unvented'
    : 'on_demand';

  const [idA, idB] = systemIds ?? ['current', primaryRec];

  // Build hourly demand array (kW) from lifestyle module output (24 values)
  const hourlyDemandKw = core.lifestyle.hourlyData.map(h => h.demandKw);

  // Expand 24-hour demand to 96 15-min points via linear interpolation
  const demandKwArr: number[] = TIME_MINUTES.map((_, i) =>
    parseFloat(interpolateDemandKw(i, hourlyDemandKw).toFixed(3)),
  );

  // Clamp negative values (shouldn't occur but defensive)
  for (let i = 0; i < demandKwArr.length; i++) {
    if (demandKwArr[i] < 0) demandKwArr[i] = 0;
  }

  // ASHP design flow temp from heat pump regime module
  const designFlowTempBand = core.heatPumpRegime.designFlowTempBand;

  // Combi base efficiency: nominal SEDBUK (surveyed or 92% fallback) minus decay.
  // resolveNominalEfficiencyPct is the single fallback + clamp point; post-decay
  // result is also clamped so future uplift (negative decay) stays within range.
  const nominalEfficiencyPct = resolveNominalEfficiencyPct(input.currentBoilerSedbukPct);
  const combiEtaPct = computeCurrentEfficiencyPct(nominalEfficiencyPct, core.normalizer.tenYearEfficiencyDecayPct);

  const events = input.lifestyleProfileV1
    ? generateDhwEventsFromProfile(input.lifestyleProfileV1)
    : DEFAULT_EVENTS;

  // Cold mains flow demand — driven by cold-fill appliances (dishwasher, washing machine).
  // Only present when the profile contains cold-flow events; undefined when using defaults.
  const hasColdFlowEvents = events.some(
    e => e.kind === 'dishwasher' || e.kind === 'washing_machine',
  );
  const coldFlowLpm: number[] | undefined = hasColdFlowEvents
    ? generateColdFlowLpm(events)
    : undefined;

  // CWS supply instability — used to apply cold-flow instability penalty for combi systems.
  // Only penalise when we have measurements that show a problem (inconsistent readings or large drop).
  const cwsUnstable =
    (core.cwsSupplyV1?.inconsistent === true) ||
    (core.cwsSupplyV1?.hasMeasurements === true &&
     core.cwsSupplyV1?.dropBar !== null &&
     core.cwsSupplyV1?.dropBar !== undefined &&
     core.cwsSupplyV1.dropBar >= 1.0);

  // Canonical current-boiler efficiency model from engine core.
  const boilerModel = core.boilerEfficiencyModelV1;
  const currentSystemType = input.currentSystem?.boiler?.type
    ?? (input.currentHeatSourceType === 'system' ? 'system'
      : input.currentHeatSourceType === 'regular' ? 'regular'
      : input.currentHeatSourceType === 'combi' ? 'combi'
      : 'unknown');

  const currentEfficiencySeries = currentSystemType === 'combi'
    ? (boilerModel?.etaSeries96
      ?? (boilerModel?.inHomeAdjustedEta != null ? new Array(96).fill(boilerModel.inHomeAdjustedEta) : undefined))
    : (boilerModel?.ageAdjustedEta != null ? new Array(96).fill(boilerModel.ageAdjustedEta) : undefined);

  // Solver core inputs for RC 1-node building physics (new fields: roomTempC, inputPowerKw, dhwState)
  const peakHeatLossKw = input.heatLossWatts != null ? input.heatLossWatts / 1000 : 0;
  const tauHours = core.fabricModelV1?.driftTauHours ?? 35; // 35h = medium/moderate default
  const solverCore = peakHeatLossKw > 0 ? { peakHeatLossKw, tauHours } : undefined;

  // Apply SEDBUK series to series A if it is a boiler-based system; series B uses constant model
  const isBoilerBasedSystem = (id: string): boolean => {
    const isBoiler = id === 'current'
      ? (input.currentHeatSourceType !== 'ashp')
      : !['ashp'].includes(id);
    return isBoiler;
  };

  const seriesA = buildSeriesForSystem(
    idA, input, demandKwArr, events, designFlowTempBand, combiEtaPct,
    (idA === 'current' && isBoilerBasedSystem(idA)) ? currentEfficiencySeries : undefined,
    cwsUnstable,
    solverCore,
  );
  const seriesB = buildSeriesForSystem(
    idB, input, demandKwArr, events, designFlowTempBand, combiEtaPct,
    undefined, // no SEDBUK tail-off series for system B
    cwsUnstable,
    solverCore,
  );

  const legendNotes: string[] = [
    'Performance: η (efficiency fraction) for boilers; COP for ASHP.',
    'DHW events: shaded bands indicate hot-water draw periods.',
    'Dishwasher / washing machine: cold-fill only — no DHW thermal load.',
  ];
  if (boilerModel?.baselineSeasonalEta != null) {
    legendNotes.push(`Current boiler baseline (SEDBUK): ${Math.round(boilerModel.baselineSeasonalEta * 100)}% (modelled estimate).`);
  }
  if (boilerModel?.disclaimerNotes?.length) {
    legendNotes.push(...boilerModel.disclaimerNotes);
  }

  // Confidence note — surface at legend level so it's visible alongside the chart
  const { confidence } = buildAssumptionsV1(core, input);
  const confidenceLegendLabel: Record<'high' | 'medium' | 'low', string> = {
    high:   'High confidence (measured)',
    medium: 'Medium confidence (assumed mains stability)',
    low:    'Low confidence (no flow test)',
  };
  legendNotes.unshift(confidenceLegendLabel[confidence.level]);

  // DHW schedule note
  if (input.lifestyleProfileV1) {
    legendNotes.push('DHW schedule: derived from your lifestyle profile (morning/evening peaks).');
  } else {
    legendNotes.push('DHW schedule: typical UK household defaults (no user profile provided).');
  }

  // Build bands from thermal DHW events and space-heating schedule.
  // dhw_on: shower / bath / sink events (hot-water draw active).
  // sh_on: approximate heating schedule (home period 06:00–23:00).
  const bands: TimelineBandsV1 = {
    bands: [
      // Space-heating "on" band covering the home occupancy window
      { kind: 'sh_on', startMin: 360, endMin: 1380 },
      // DHW active bands from thermal events only (cold-fill appliances excluded)
      ...events
        .filter(e => e.kind !== 'dishwasher' && e.kind !== 'washing_machine')
        .map(e => ({ kind: 'dhw_on', startMin: e.startMin, endMin: e.endMin })),
    ],
  };

  // Physics debug snapshot — engine-side values that should match the chart lines.
  // Populated ONLY when debug=true is passed; absent for normal production payloads.
  // This keeps production docs clean and avoids debug noise in persisted outputs.
  const physicsDebug: PhysicsDebugV1 | undefined = debug
    ? {
        erpClass: deriveErpClass(nominalEfficiencyPct) ?? undefined,
        nominalEfficiencyPct,
        tenYearEfficiencyDecayPct: core.normalizer.tenYearEfficiencyDecayPct,
        currentEfficiencyPct: combiEtaPct,
        sedbukSource: boilerModel?.sedbuk.source ?? 'fallback',
        timelinePoints: TIME_MINUTES.length,
      }
    : undefined;

  const payload: Timeline24hV1 = {
    timeMinutes: TIME_MINUTES,
    demandHeatKw: demandKwArr,
    ...(coldFlowLpm !== undefined && { coldFlowLpm }),
    series: [seriesA, seriesB],
    events,
    bands,
    legendNotes,
    physicsDebug,
  };

  return {
    id: 'timeline_24h',
    type: 'timeline_24h',
    title: '24-Hour Comparative Timeline',
    data: payload,
  };
}
