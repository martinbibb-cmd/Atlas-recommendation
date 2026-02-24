import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { VisualSpecV1, Timeline24hV1, Timeline24hEvent, Timeline24hSeries } from '../contracts/EngineOutputV1';
import { buildBoilerEfficiencySeriesV1 } from './modules/BoilerTailoffModule';

/** 96 time points at 15-minute intervals covering 0–1425 minutes. */
const TIME_MINUTES = Array.from({ length: 96 }, (_, i) => i * 15);

/** Default DHW event schedule for a typical UK household day. */
const DEFAULT_EVENTS: Timeline24hEvent[] = [
  { startMin: 420, endMin: 435, kind: 'shower',     intensity: 'med'  }, // 07:00–07:15 morning shower
  { startMin: 1140, endMin: 1170, kind: 'bath',       intensity: 'high' }, // 19:00–19:30 evening bath
  { startMin: 1200, endMin: 1245, kind: 'dishwasher', intensity: 'low'  }, // 20:00–20:45 dishwasher
];

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
 * Return true if the given minute falls within any DHW event.
 */
function isDhwActive(minuteOfDay: number, events: Timeline24hEvent[]): boolean {
  return events.some(e => minuteOfDay >= e.startMin && minuteOfDay < e.endMin);
}

/**
 * Build series data for a combi / on-demand boiler system.
 * η drops during simultaneous DHW events (combi stress).
 * When `efficiencySeries` is provided it is used directly (SEDBUK tail-off model);
 * otherwise falls back to the constant `baseEtaPct` approach.
 */
function buildCombiSeries(
  id: string,
  label: string,
  demandKwArr: number[],
  events: Timeline24hEvent[],
  baseEtaPct: number,
  efficiencySeries?: number[],
): Timeline24hSeries {
  const heatDeliveredKw: number[] = [];
  const efficiency: number[] = [];
  const comfortTempC: number[] = [];
  const dhwOutletTempC: number[] = [];

  for (let i = 0; i < 96; i++) {
    const minuteOfDay = i * 15;
    const demandKw = demandKwArr[i];
    const dhwActive = isDhwActive(minuteOfDay, events);

    // Use SEDBUK tail-off efficiency when available; otherwise apply DHW stress penalty
    const etaBase = efficiencySeries ? efficiencySeries[i] : baseEtaPct / 100;
    const eta = (!efficiencySeries && dhwActive)
      ? Math.max(0.60, etaBase - 0.08)
      : (efficiencySeries && dhwActive)
        ? Math.max(0.55, etaBase - 0.05)
        : etaBase;
    const delivered = demandKw * eta;

    // Comfort: boiler provides sharp temperature swings (fraction-driven)
    const fraction = demandKwArr[i] / (Math.max(...demandKwArr) || 1);
    const comfort = 18 + fraction * 4;

    // DHW outlet: drops during heavy draw events
    const dhwOutlet = dhwActive ? 42 : 50;

    heatDeliveredKw.push(parseFloat(delivered.toFixed(3)));
    efficiency.push(parseFloat(eta.toFixed(3)));
    comfortTempC.push(parseFloat(comfort.toFixed(1)));
    dhwOutletTempC.push(dhwOutlet);
  }

  return { id, label, heatDeliveredKw, efficiency, comfortTempC, dhwOutletTempC };
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

    heatDeliveredKw.push(parseFloat(delivered.toFixed(3)));
    efficiency.push(parseFloat(eta.toFixed(3)));
    comfortTempC.push(parseFloat(comfort.toFixed(1)));
    dhwOutletTempC.push(dhwOutlet);
  }

  return { id, label, heatDeliveredKw, efficiency, comfortTempC, dhwOutletTempC };
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
): Timeline24hSeries {
  // COP lookup: lower flow temp → higher COP
  const copByBand: Record<35 | 45 | 50, number> = { 35: 3.8, 45: 3.0, 50: 2.6 };
  const cop = copByBand[designFlowTempBand];

  const heatDeliveredKw: number[] = [];
  const efficiency: number[] = [];
  const comfortTempC: number[] = [];
  const dhwOutletTempC: number[] = [];

  for (let i = 0; i < 96; i++) {
    const demandKw = demandKwArr[i];
    // ASHP "low and slow" — stable delivery matching demand
    const delivered = demandKw; // heat pump output tracks demand smoothly
    // Comfort: ASHP maintains a flat horizon exploiting thermal mass
    const comfort = 19.5 + Math.sin((i / 96) * Math.PI) * 0.5;
    // DHW from ASHP cylinder is stable
    const dhwOutlet = 55;

    heatDeliveredKw.push(parseFloat(delivered.toFixed(3)));
    efficiency.push(parseFloat(cop.toFixed(2)));
    comfortTempC.push(parseFloat(comfort.toFixed(1)));
    dhwOutletTempC.push(dhwOutlet);
  }

  return { id, label, heatDeliveredKw, efficiency, comfortTempC, dhwOutletTempC };
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
): Timeline24hSeries {
  const label = systemLabel(systemId, input);

  // 'current' maps to the current heat source type or falls back to combi
  const effectiveId =
    systemId === 'current'
      ? (input.currentHeatSourceType === 'ashp' ? 'ashp' :
         input.currentHeatSourceType === 'system' ? 'stored_vented' :
         'on_demand')
      : systemId;

  switch (effectiveId) {
    case 'ashp':
      return buildAshpSeries(systemId, label, demandKwArr, designFlowTempBand);
    case 'stored_vented':
    case 'regular_vented':
      return buildStoredSeries(systemId, label, demandKwArr, events, false, efficiencySeries);
    case 'stored_unvented':
    case 'system_unvented':
      return buildStoredSeries(systemId, label, demandKwArr, events, true, efficiencySeries);
    case 'on_demand':
    default:
      return buildCombiSeries(systemId, label, demandKwArr, events, combiEtaPct, efficiencySeries);
  }
}

/**
 * Build a `timeline_24h` VisualSpecV1 comparing two systems A and B.
 *
 * @param core     Full engine result core (all module outputs).
 * @param input    Engine input (used for heat loss, lifestyle profile, etc.).
 * @param systemIds  Tuple [systemIdA, systemIdB]. Defaults to ['current', primary recommendation].
 */
export function buildTimeline24hV1(
  core: FullEngineResultCore,
  input: EngineInputV2_3,
  systemIds?: [string, string],
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

  // Combi base efficiency: approximate from normalizer decay
  const combiEtaPct = Math.max(50, 92 - core.normalizer.tenYearEfficiencyDecayPct);

  const events = DEFAULT_EVENTS;

  // SEDBUK tail-off efficiency series for the 'current' system (series A) when available
  const sedbuk = core.sedbukV1;
  const boilerAgeYears = input.currentSystem?.boiler?.ageYears ?? input.currentBoilerAgeYears ?? 0;
  const oversizeRatio = core.sizingV1?.oversizeRatio ?? null;
  const sedbukEfficiencySeries = sedbuk?.seasonalEfficiency != null
    ? buildBoilerEfficiencySeriesV1({
        seasonalEfficiency: sedbuk.seasonalEfficiency,
        ageYears: boilerAgeYears,
        demandHeatKw: demandKwArr,
        oversizeRatio,
      })
    : undefined;

  // Apply SEDBUK series to series A if it is a boiler-based system; series B uses constant model
  const isBoilerBasedSystem = (id: string): boolean => {
    const isBoiler = id === 'current'
      ? (input.currentHeatSourceType !== 'ashp')
      : !['ashp'].includes(id);
    return isBoiler;
  };

  const seriesA = buildSeriesForSystem(
    idA, input, demandKwArr, events, designFlowTempBand, combiEtaPct,
    (idA === 'current' && isBoilerBasedSystem(idA)) ? sedbukEfficiencySeries : undefined,
  );
  const seriesB = buildSeriesForSystem(idB, input, demandKwArr, events, designFlowTempBand, combiEtaPct);

  const legendNotes: string[] = [
    'Efficiency values: η for boilers (fraction); COP proxy for ASHP.',
    'DHW events: shaded blocks indicate hot-water draw periods.',
  ];
  if (sedbuk) {
    legendNotes.push(`Current boiler baseline (SEDBUK ${sedbuk.label}): ${sedbuk.seasonalEfficiency != null ? `${Math.round(sedbuk.seasonalEfficiency * 100)}%` : 'unknown'}.`);
  }

  const payload: Timeline24hV1 = {
    timeMinutes: TIME_MINUTES,
    demandHeatKw: demandKwArr,
    series: [seriesA, seriesB],
    events,
    legendNotes,
  };

  return {
    id: 'timeline_24h',
    type: 'timeline_24h',
    title: '24-Hour Comparative Timeline',
    data: payload,
  };
}
