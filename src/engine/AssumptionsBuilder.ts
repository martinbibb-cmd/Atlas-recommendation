import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { AssumptionV1, ConfidenceV1 } from '../contracts/EngineOutputV1';

export function buildAssumptionsV1(
  _core: FullEngineResultCore,
  input: EngineInputV2_3 | undefined,
): { confidence: ConfidenceV1; assumptions: AssumptionV1[] } {
  const assumptions: AssumptionV1[] = [];
  let missingKeyCount = 0;

  // ── Boiler model assumptions ────────────────────────────────────────────────

  const boiler = input?.currentSystem?.boiler;

  if (!boiler?.gcNumber) {
    missingKeyCount++;
    assumptions.push({
      id: 'boiler-gc-fallback',
      title: 'GC number not provided',
      detail: 'Boiler efficiency is estimated from manufacturer band defaults, not a direct SEDBUK database lookup.',
      affects: ['options', 'recommendation', 'context'],
      severity: 'warn',
      improveBy: 'Add the GC number from the boiler data plate.',
    });
  }

  if (!boiler?.ageYears && !input?.currentBoilerAgeYears) {
    missingKeyCount++;
    assumptions.push({
      id: 'boiler-age-assumed',
      title: 'Boiler age not provided',
      detail: 'Age-related efficiency degradation has been estimated using a typical mid-range age band.',
      affects: ['options', 'context'],
      severity: 'warn',
      improveBy: 'Enter the boiler installation year or approximate age.',
    });
  }

  if (!boiler?.nominalOutputKw && !input?.currentBoilerOutputKw) {
    missingKeyCount++;
    assumptions.push({
      id: 'boiler-nominal-kw-default',
      title: 'Boiler nominal output not provided',
      detail: 'A type-default output (24 kW for combi, 18 kW for system/regular) has been assumed for sizing calculations.',
      affects: ['options', 'recommendation'],
      severity: 'warn',
      improveBy: 'Enter the rated kW output from the boiler data plate or manual.',
    });
  }

  const peakHeatLossKw = input?.heatLossWatts != null ? input.heatLossWatts / 1000 : null;
  const hasPeakHeatLoss = peakHeatLossKw != null && peakHeatLossKw > 0;
  if (!hasPeakHeatLoss) {
    missingKeyCount++;
    assumptions.push({
      id: 'boiler-peak-heat-loss-missing',
      title: 'Peak heat loss not provided',
      detail: 'The oversize ratio between boiler output and building demand cannot be calculated. Cycling loss modelling is weaker without this.',
      affects: ['options', 'recommendation'],
      severity: 'warn',
      improveBy: 'Run a heat loss calculation or enter the estimated peak demand in kW.',
    });
  }

  // ── Water supply assumptions ────────────────────────────────────────────────

  if (!input?.mainsDynamicFlowLpm) {
    missingKeyCount++;
    assumptions.push({
      id: 'water-flow-at-pressure-missing',
      title: 'Flow-at-pressure measurement missing',
      detail: 'Cold-water supply quality is unknown without a dynamic flow measurement (L/min at pressure). Combi and unvented eligibility relies on modelled estimates.',
      affects: ['options', 'recommendation'],
      severity: 'warn',
      improveBy: 'Measure mains flow rate at the stopcock (L/min) using a flow bag.',
    });
  }

  if (!input?.staticMainsPressureBar) {
    assumptions.push({
      id: 'water-static-pressure-missing',
      title: 'Static mains pressure not measured',
      detail: 'Pressure drop between static and dynamic conditions cannot be determined. Supply quality classification is based on dynamic pressure alone.',
      affects: ['options', 'context'],
      severity: 'info',
      improveBy: 'Measure static pressure at the stopcock with flow closed off.',
    });
  }

  // ── Timeline / schedule assumptions ────────────────────────────────────────

  // The timeline always uses the default event schedule (no user-painted schedule in V1)
  assumptions.push({
    id: 'timeline-default-schedule',
    title: 'Default daily hot-water schedule used',
    detail: 'Hot-water events (morning shower, evening bath, dishwasher) follow a typical UK household day. Your actual pattern may differ.',
    affects: ['timeline_24h'],
    severity: 'info',
    improveBy: 'Paint your actual daily schedule to improve timeline accuracy.',
  });

  // τ is always inferred from building mass slider, not measured from Hive telemetry
  assumptions.push({
    id: 'timeline-tau-from-sliders',
    title: 'Thermal response (τ) inferred from building mass',
    detail: 'The thermal time constant is estimated from your selected building mass rather than measured from real thermostat telemetry.',
    affects: ['timeline_24h', 'context'],
    severity: 'info',
    improveBy: 'Connect Hive telemetry to derive τ from measured temperature decay.',
  });

  // ── Confidence level ────────────────────────────────────────────────────────

  const reasons: string[] = [];
  let level: ConfidenceV1['level'] = 'high';

  if (missingKeyCount >= 3 || (!hasPeakHeatLoss && boiler?.gcNumber == null)) {
    level = 'low';
  } else if (missingKeyCount >= 1) {
    level = 'medium';
  }

  if (boiler?.gcNumber) {
    reasons.push('Boiler efficiency is modelled from SEDBUK + age/cycling.');
  } else {
    reasons.push('Boiler efficiency is estimated from manufacturer band defaults (no GC number).');
  }

  if (input?.mainsDynamicFlowLpm) {
    reasons.push('Cold-water supply characterised by a flow-at-pressure measurement (L/min @ bar).');
  } else {
    reasons.push('Cold-water supply lacks a flow-at-pressure measurement (L/min @ bar).');
  }

  reasons.push('Daily hot-water schedule uses defaults (no painted user schedule).');

  return { confidence: { level, reasons }, assumptions };
}
