import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { OptionCardV1, OptionScoreV1, ScoreBreakdownItem } from '../contracts/EngineOutputV1';
import type { ConfidenceV1, AssumptionV1 } from '../contracts/EngineOutputV1';
import { PENALTY_IDS } from '../contracts/scoring.penaltyIds';

/** Option IDs that are boiler-based (cycling penalty applies). */
const BOILER_OPTION_IDS: ReadonlySet<OptionCardV1['id']> = new Set([
  'combi', 'stored_vented', 'stored_unvented', 'regular_vented', 'system_unvented',
]);

/** Option IDs affected by cold-water supply quality. */
const UNVENTED_OPTION_IDS: ReadonlySet<OptionCardV1['id']> = new Set([
  'stored_unvented', 'system_unvented',
]);

/** Option IDs that require stored cylinder space. */
const STORED_OPTION_IDS: ReadonlySet<OptionCardV1['id']> = new Set([
  'stored_vented', 'stored_unvented', 'system_unvented', 'ashp',
]);

/** Option IDs that require loft head space (open-vented). */
const VENTED_OPTION_IDS: ReadonlySet<OptionCardV1['id']> = new Set([
  'stored_vented', 'regular_vented',
]);

/**
 * Compute a deterministic 0–100 score for a single option card.
 *
 * Scoring model:
 *   - Start at 100.
 *   - Hard reject → 0, no further evaluation.
 *   - Subtract penalty buckets (feasibility/risk, performance, complexity, confidence).
 *   - Clamp result to [0, 100].
 */
export function scoreOptionV1(
  core: FullEngineResultCore,
  input: EngineInputV2_3,
  optionCard: OptionCardV1,
  confidence: ConfidenceV1 | undefined,
  assumptions: AssumptionV1[] | undefined,
): OptionScoreV1 {
  const breakdown: ScoreBreakdownItem[] = [];

  // ── Hard reject ────────────────────────────────────────────────────────────
  if (optionCard.status === 'rejected') {
    breakdown.push({ id: PENALTY_IDS.OPTION_REJECTED, label: 'Option rejected — hard fail or incompatible physics', penalty: 100 });
    return { total: 0, breakdown, band: 'not_viable' };
  }

  let score = 100;

  // ── A) Status penalty ───────────────────────────────────────────────────────
  if (optionCard.status === 'caution') {
    breakdown.push({ id: PENALTY_IDS.STATUS_CAUTION, label: 'Option status: caution', penalty: 10 });
    score -= 10;
  }

  const id = optionCard.id;
  const { hydraulicV1, combiDhwV1, cwsSupplyV1, pressureAnalysis, sizingV1, heatPumpRegime } = core;
  const hasFutureLoftConversion = input.futureLoftConversion ?? input.hasLoftConversion ?? false;

  // ── B) Feasibility & risk penalties ────────────────────────────────────────

  // ASHP hydraulic risk
  if (id === 'ashp') {
    if (hydraulicV1.verdict.ashpRisk === 'warn') {
      breakdown.push({ id: PENALTY_IDS.ASHP_HYDRAULICS_WARN, label: 'ASHP hydraulic risk: marginal pipe sizing', penalty: 12 });
      score -= 12;
    }
    // 'fail' is handled by rejected path above
  }

  // Combi short-draw collapse warning
  if (id === 'combi') {
    const shortDrawFlag = combiDhwV1.flags.find(f => f.id === 'combi-short-draw-collapse');
    if (shortDrawFlag) {
      breakdown.push({ id: PENALTY_IDS.DHW_SHORT_DRAW_WARN, label: 'Combi short-draw collapse risk', penalty: 10 });
      score -= 10;
    }
  }

  // Cold-water supply / unvented options
  // Track whether measurements are missing to avoid double-penalising the same uncertainty (pressure.borderline_unvented).
  let cwsMeasurementsMissing = false;
  if (UNVENTED_OPTION_IDS.has(id)) {
    if (cwsSupplyV1.inconsistent) {
      breakdown.push({ id: PENALTY_IDS.CWS_QUALITY_WEAK, label: 'Pressure readings inconsistent (dynamic > static)', penalty: 12 });
      score -= 12;
    } else if (!cwsSupplyV1.hasMeasurements) {
      cwsMeasurementsMissing = true;
      breakdown.push({ id: PENALTY_IDS.CWS_MEASUREMENTS_MISSING, label: 'Mains flow at pressure not measured (−8)', penalty: 8 });
      score -= 8;
    } else if (!cwsSupplyV1.meetsUnventedRequirement) {
      breakdown.push({ id: PENALTY_IDS.CWS_QUALITY_WEAK, label: 'Mains supply does not meet unvented requirement', penalty: 12 });
      score -= 12;
    }
  }

  // Space constraints (stored options)
  if (STORED_OPTION_IDS.has(id)) {
    if (input.availableSpace === 'tight') {
      breakdown.push({ id: PENALTY_IDS.SPACE_TIGHT, label: 'Cylinder space tight', penalty: 8 });
      score -= 8;
    }
  }

  // Loft conversion risk (vented options)
  if (VENTED_OPTION_IDS.has(id) && hasFutureLoftConversion) {
    breakdown.push({ id: PENALTY_IDS.FUTURE_LOFT_CONFLICT, label: 'Future loft conversion risks header tank space', penalty: 12 });
    score -= 12;
  }

  // ── C) Performance match penalties ─────────────────────────────────────────

  // Boiler oversize cycling penalty (boiler-based options only)
  if (BOILER_OPTION_IDS.has(id) && sizingV1) {
    const band = sizingV1.sizingBand;
    if (band === 'mild_oversize') {
      breakdown.push({ id: PENALTY_IDS.BOILER_OVERSIZE_MILD, label: 'Boiler mildly oversized — some cycling loss', penalty: 4 });
      score -= 4;
    } else if (band === 'oversized') {
      breakdown.push({ id: PENALTY_IDS.BOILER_OVERSIZE_MODERATE, label: 'Boiler oversized — increased cycling losses', penalty: 8 });
      score -= 8;
    } else if (band === 'aggressive') {
      breakdown.push({ id: PENALTY_IDS.BOILER_OVERSIZE_AGGRESSIVE, label: 'Aggressive boiler oversizing increases cycling losses', penalty: 12 });
      score -= 12;
    }
  }

  // ASHP: full system replacement / emitter upgrade required
  if (id === 'ashp') {
    if (heatPumpRegime.designFlowTempBand === 35) {
      breakdown.push({ id: PENALTY_IDS.ASHP_FLOWTEMP_FULL_JOB, label: 'Full emitter replacement required (35°C design flow)', penalty: 10 });
      score -= 10;
    } else if (heatPumpRegime.designFlowTempBand === 45) {
      breakdown.push({ id: PENALTY_IDS.ASHP_FLOWTEMP_PARTIAL, label: 'Partial emitter upgrade required (45°C design flow)', penalty: 5 });
      score -= 5;
    }
    // Pipe upgrade required
    if (input.primaryPipeDiameter && input.primaryPipeDiameter < 28) {
      breakdown.push({ id: PENALTY_IDS.ASHP_PIPE_UPGRADE_REQUIRED, label: 'Primary pipe upgrade required (< 28mm)', penalty: 8 });
      score -= 8;
    }
  }

  // Borderline mains pressure penalty (unvented: 1.0–1.5 bar)
  // Guard: skip if measurements are missing — we can't confirm the boundary, and cws.measurements_missing already penalises the uncertainty.
  if (UNVENTED_OPTION_IDS.has(id) && !cwsMeasurementsMissing) {
    const bar = pressureAnalysis.dynamicBar;
    if (bar >= 1.0 && bar < 1.5) {
      breakdown.push({ id: PENALTY_IDS.PRESSURE_BORDERLINE_UNVENTED, label: `Mains pressure borderline (${bar.toFixed(1)} bar — min 1.5 bar recommended)`, penalty: 8 });
      score -= 8;
    }
  }

  // ── D) Confidence penalty ───────────────────────────────────────────────────
  let confidencePenalty = 0;

  if (confidence) {
    if (confidence.level === 'medium') {
      const p = 6;
      breakdown.push({ id: PENALTY_IDS.CONFIDENCE_MEDIUM, label: 'Confidence: medium — key inputs modelled', penalty: p });
      score -= p;
      confidencePenalty += p;
    } else if (confidence.level === 'low') {
      const p = 12;
      breakdown.push({ id: PENALTY_IDS.CONFIDENCE_LOW, label: 'Confidence: low — significant inputs missing', penalty: p });
      score -= p;
      confidencePenalty += p;
    }
  }

  // Per severe (warn) assumption: -2 each, capped at -8
  const warnAssumptionCount = assumptions?.filter(a => a.severity === 'warn').length ?? 0;
  if (warnAssumptionCount > 0) {
    const p = Math.min(warnAssumptionCount * 2, 8);
    breakdown.push({ id: PENALTY_IDS.ASSUMPTION_WARN_COUNT, label: `${warnAssumptionCount} warn assumption(s)`, penalty: p });
    score -= p;
    confidencePenalty += p;
  }

  // ── Clamp & band ───────────────────────────────────────────────────────────
  const total = Math.max(0, Math.min(100, score));

  const scoreBand: OptionScoreV1['band'] =
    total === 0 ? 'not_viable' :
    total <= 49 ? 'poor' :
    total <= 69 ? 'mixed' :
    total <= 84 ? 'good' :
    'excellent';

  return { total, breakdown, band: scoreBand, confidencePenalty: confidencePenalty > 0 ? confidencePenalty : undefined };
}
