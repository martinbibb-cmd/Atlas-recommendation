import type { AssumptionV1, ConfidenceV1 } from '../contracts/EngineOutputV1';
import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';

/**
 * Builds confidence and assumption metadata for EngineOutputV1.meta.
 *
 * Rules:
 *  - Start high
 *  - Each missing key input knocks it down:
 *    - 1–2 key items missing → medium
 *    - 3+ key items missing, or peak heat loss missing AND boiler model used → low
 *  - Missing flow@pressure → medium/low depending on other unknowns
 */
export function buildAssumptionsV1(
  core: FullEngineResultCore,
  input: EngineInputV2_3,
): { confidence: ConfidenceV1; assumptions: AssumptionV1[] } {
  const assumptions: AssumptionV1[] = [];
  const reasons: string[] = [];
  let missingCount = 0;
  let peakHeatLossMissing = false;
  let boilerModelUsed = false;

  // ── Boiler assumptions ────────────────────────────────────────────────────

  const boiler = input.currentSystem?.boiler;

  if (!boiler?.gcNumber) {
    missingCount++;
    assumptions.push({
      id: 'assumption-no-gc-number',
      title: 'GC number not provided',
      detail: 'Boiler efficiency has been estimated using a band fallback based on boiler type and age rather than a SEDBUK database lookup.',
      affects: ['recommendation', 'context'],
      severity: 'warn',
      improveBy: 'Add the GC number from the boiler data plate.',
    });
    reasons.push('Boiler efficiency is modelled from SEDBUK band + age/cycling (no GC number).');
    boilerModelUsed = true;
  }

  const boilerAgeProvided = !!(boiler?.ageYears ?? input.currentBoilerAgeYears);
  if (!boilerAgeProvided) {
    missingCount++;
    assumptions.push({
      id: 'assumption-no-boiler-age',
      title: 'Boiler age not provided',
      detail: 'An assumed age band has been used when modelling boiler performance degradation.',
      affects: ['recommendation', 'context'],
      severity: 'warn',
      improveBy: 'Add the approximate boiler age in years.',
    });
    reasons.push('Boiler efficiency is modelled from SEDBUK + assumed age band (age not provided).');
    boilerModelUsed = true;
  }

  const nominalKwProvided = !!(boiler?.nominalOutputKw ?? input.currentBoilerOutputKw);
  if (!nominalKwProvided) {
    missingCount++;
    assumptions.push({
      id: 'assumption-no-nominal-kw',
      title: 'Nominal boiler output not provided',
      detail: 'A type default (24 kW for combi, 18 kW for regular/system) has been used for sizing calculations.',
      affects: ['options', 'recommendation'],
      severity: 'warn',
      improveBy: 'Add the nominal rated output from the boiler data plate.',
    });
  }

  // Peak heat loss: use sizingV1 result — null peakHeatLossKw means it was unavailable
  if (core.sizingV1 && core.sizingV1.peakHeatLossKw == null) {
    missingCount++;
    peakHeatLossMissing = true;
    assumptions.push({
      id: 'assumption-no-peak-heat-loss',
      title: 'Peak heat loss not available',
      detail: 'Oversize ratio is unavailable — cycling loss model is weaker without a measured or calculated heat loss figure.',
      affects: ['timeline_24h', 'options', 'recommendation'],
      severity: 'warn',
      improveBy: 'Run a heat loss calculation or provide a design heat loss figure.',
    });
  }

  // ── Water supply assumptions ──────────────────────────────────────────────

  if (!input.mainsDynamicFlowLpm) {
    missingCount++;
    assumptions.push({
      id: 'assumption-no-dynamic-flow',
      title: 'Dynamic flow rate not measured',
      detail: 'Cold-water supply quality is unknown. A flow-at-pressure measurement (L/min at bar) is required to accurately characterise the mains supply.',
      affects: ['options', 'recommendation'],
      severity: 'warn',
      improveBy: 'Measure flow rate (L/min) at the mains supply under flow conditions.',
    });
    reasons.push('Cold-water supply lacks a flow-at-pressure measurement (L/min @ bar).');
  }

  if (!input.staticMainsPressureBar) {
    assumptions.push({
      id: 'assumption-no-static-pressure',
      title: 'Static mains pressure not measured',
      detail: 'Pressure drop cannot be calculated — the difference between static and dynamic pressure (ΔP) indicates supply resistance.',
      affects: ['options'],
      severity: 'info',
      improveBy: 'Measure static pressure at the mains supply with no flow running.',
    });
    // Info-only: not counted against confidence level
  }

  // ── Timeline / schedule assumptions ──────────────────────────────────────

  assumptions.push({
    id: 'assumption-default-dhw-schedule',
    title: 'Default hot water schedule used',
    detail: 'The 24-hour demand profile uses a default daily schedule. If your household pattern differs significantly, the timeline simulation may not reflect your typical day.',
    affects: ['timeline_24h'],
    severity: 'info',
    improveBy: 'Use the schedule painter to record your actual daily hot water usage.',
  });
  reasons.push('Daily hot water schedule used defaults.');

  assumptions.push({
    id: 'assumption-tau-from-sliders',
    title: 'Thermal response derived from building sliders',
    detail: 'The thermal time constant (τ) has been inferred from building fabric controls rather than measured from live telemetry or a calibrated heat loss survey.',
    affects: ['timeline_24h'],
    severity: 'info',
  });
  reasons.push('τ (thermal response) derived from sliders — not measured from Hive telemetry.');

  // ── Confidence level ─────────────────────────────────────────────────────

  let level: ConfidenceV1['level'];

  if (missingCount === 0) {
    level = 'high';
  } else if (missingCount >= 3 || (peakHeatLossMissing && boilerModelUsed)) {
    level = 'low';
  } else {
    level = 'medium';
  }

  return {
    confidence: { level, reasons },
    assumptions,
  };
}
