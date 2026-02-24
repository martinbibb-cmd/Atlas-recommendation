import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { AssumptionV1, ConfidenceV1 } from '../contracts/EngineOutputV1';
import { ASSUMPTION_IDS } from '../contracts/assumptions.ids';
import { ASSUMPTION_CATALOG } from './assumptions.catalog';

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
      id: ASSUMPTION_IDS.BOILER_GC_MISSING,
      ...ASSUMPTION_CATALOG[ASSUMPTION_IDS.BOILER_GC_MISSING],
      affects: ['options', 'recommendation', 'context'],
      severity: 'warn',
    });
  }

  if (!boiler?.ageYears && !input?.currentBoilerAgeYears) {
    missingKeyCount++;
    assumptions.push({
      id: ASSUMPTION_IDS.BOILER_AGE_MISSING,
      ...ASSUMPTION_CATALOG[ASSUMPTION_IDS.BOILER_AGE_MISSING],
      affects: ['options', 'context'],
      severity: 'warn',
    });
  }

  if (!boiler?.nominalOutputKw && !input?.currentBoilerOutputKw) {
    missingKeyCount++;
    assumptions.push({
      id: ASSUMPTION_IDS.BOILER_OUTPUT_DEFAULTED,
      ...ASSUMPTION_CATALOG[ASSUMPTION_IDS.BOILER_OUTPUT_DEFAULTED],
      affects: ['options', 'recommendation'],
      severity: 'warn',
    });
  }

  const peakHeatLossKw = input?.heatLossWatts != null ? input.heatLossWatts / 1000 : null;
  const hasPeakHeatLoss = peakHeatLossKw != null && peakHeatLossKw > 0;
  if (!hasPeakHeatLoss) {
    missingKeyCount++;
    assumptions.push({
      id: ASSUMPTION_IDS.BOILER_PEAK_HEATLOSS_MISSING,
      ...ASSUMPTION_CATALOG[ASSUMPTION_IDS.BOILER_PEAK_HEATLOSS_MISSING],
      affects: ['options', 'recommendation'],
      severity: 'warn',
    });
  }

  // ── Water supply assumptions ────────────────────────────────────────────────

  if (!input?.mainsDynamicFlowLpm) {
    missingKeyCount++;
    assumptions.push({
      id: ASSUMPTION_IDS.MAINS_FLOW_MISSING,
      ...ASSUMPTION_CATALOG[ASSUMPTION_IDS.MAINS_FLOW_MISSING],
      affects: ['options', 'recommendation'],
      severity: 'warn',
    });
  }

  if (!input?.staticMainsPressureBar) {
    assumptions.push({
      id: ASSUMPTION_IDS.MAINS_STATIC_MISSING,
      ...ASSUMPTION_CATALOG[ASSUMPTION_IDS.MAINS_STATIC_MISSING],
      affects: ['options', 'context'],
      severity: 'info',
    });
  }

  // ── Timeline / schedule assumptions ────────────────────────────────────────

  // Only add the default-schedule assumption when the user hasn't provided a lifestyle profile
  if (!input?.lifestyleProfileV1) {
    assumptions.push({
      id: ASSUMPTION_IDS.DEFAULT_DHW_SCHEDULE,
      ...ASSUMPTION_CATALOG[ASSUMPTION_IDS.DEFAULT_DHW_SCHEDULE],
      affects: ['timeline_24h'],
      severity: 'info',
    });
  }

  // τ is always inferred from building mass slider, not measured from Hive telemetry
  assumptions.push({
    id: ASSUMPTION_IDS.TAU_DERIVED_FROM_SLIDERS,
    ...ASSUMPTION_CATALOG[ASSUMPTION_IDS.TAU_DERIVED_FROM_SLIDERS],
    affects: ['timeline_24h', 'context'],
    severity: 'info',
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

  if (input?.lifestyleProfileV1) {
    reasons.push('Daily hot-water schedule derived from your lifestyle profile (morning/evening peaks, bath, dishwasher).');
  } else {
    reasons.push('Daily hot-water schedule uses defaults (no painted user schedule).');
  }

  return { confidence: { level, reasons }, assumptions };
}
