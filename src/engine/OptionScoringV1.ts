import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { OptionCardV1, OptionScoreV1, ScoreBreakdownItem } from '../contracts/EngineOutputV1';
import type { ConfidenceV1, AssumptionV1 } from '../contracts/EngineOutputV1';

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
    breakdown.push({ id: 'rejected', label: 'Option rejected — hard fail or incompatible physics', penalty: 100 });
    return { total: 0, breakdown };
  }

  let score = 100;

  // ── A) Status penalty ───────────────────────────────────────────────────────
  if (optionCard.status === 'caution') {
    breakdown.push({ id: 'status_caution', label: 'Option status: caution', penalty: 10 });
    score -= 10;
  }

  const id = optionCard.id;
  const { hydraulicV1, combiDhwV1, cwsSupplyV1, pressureAnalysis, sizingV1, heatPumpRegime } = core;
  const hasFutureLoftConversion = input.futureLoftConversion ?? input.hasLoftConversion ?? false;

  // ── B) Feasibility & risk penalties ────────────────────────────────────────

  // ASHP hydraulic risk
  if (id === 'ashp') {
    if (hydraulicV1.verdict.ashpRisk === 'warn') {
      breakdown.push({ id: 'ashp_hydraulic_warn', label: 'ASHP hydraulic risk: marginal pipe sizing', penalty: 12 });
      score -= 12;
    }
    // 'fail' is handled by rejected path above
  }

  // Combi short-draw collapse warning
  if (id === 'combi') {
    const shortDrawFlag = combiDhwV1.flags.find(f => f.id === 'combi-short-draw-collapse');
    if (shortDrawFlag) {
      breakdown.push({ id: 'combi_short_draw_warn', label: 'Combi short-draw collapse risk', penalty: 10 });
      score -= 10;
    }
  }

  // Cold-water supply / unvented options
  if (UNVENTED_OPTION_IDS.has(id)) {
    if (!cwsSupplyV1.hasMeasurements) {
      breakdown.push({ id: 'cws_no_measurements', label: 'Mains flow at pressure not measured (−8)', penalty: 8 });
      score -= 8;
    } else if (cwsSupplyV1.quality === 'weak') {
      breakdown.push({ id: 'cws_weak', label: 'Mains supply quality: weak', penalty: 12 });
      score -= 12;
    }
  }

  // Space constraints (stored options)
  if (STORED_OPTION_IDS.has(id)) {
    if (input.availableSpace === 'tight') {
      breakdown.push({ id: 'space_tight', label: 'Cylinder space tight', penalty: 8 });
      score -= 8;
    }
  }

  // Loft conversion risk (vented options)
  if (VENTED_OPTION_IDS.has(id) && hasFutureLoftConversion) {
    breakdown.push({ id: 'loft_conversion_risk', label: 'Future loft conversion risks header tank space', penalty: 12 });
    score -= 12;
  }

  // ── C) Performance match penalties ─────────────────────────────────────────

  // Boiler oversize cycling penalty (boiler-based options only)
  if (BOILER_OPTION_IDS.has(id) && sizingV1) {
    const band = sizingV1.sizingBand;
    if (band === 'mild_oversize') {
      breakdown.push({ id: 'oversize_mild', label: 'Boiler mildly oversized — some cycling loss', penalty: 4 });
      score -= 4;
    } else if (band === 'oversized') {
      breakdown.push({ id: 'oversize_moderate', label: 'Boiler oversized — increased cycling losses', penalty: 8 });
      score -= 8;
    } else if (band === 'aggressive') {
      breakdown.push({ id: 'oversize_aggressive', label: 'Aggressive boiler oversizing increases cycling losses', penalty: 12 });
      score -= 12;
    }
  }

  // ASHP: full system replacement / emitter upgrade required
  if (id === 'ashp') {
    if (heatPumpRegime.designFlowTempBand === 35) {
      breakdown.push({ id: 'ashp_full_emitter_replacement', label: 'Full emitter replacement required (35°C design flow)', penalty: 10 });
      score -= 10;
    } else if (heatPumpRegime.designFlowTempBand === 45) {
      breakdown.push({ id: 'ashp_partial_emitter_upgrade', label: 'Partial emitter upgrade required (45°C design flow)', penalty: 5 });
      score -= 5;
    }
    // Pipe upgrade required
    if (input.primaryPipeDiameter && input.primaryPipeDiameter < 28) {
      breakdown.push({ id: 'ashp_pipe_upgrade', label: 'Primary pipe upgrade required (< 28mm)', penalty: 8 });
      score -= 8;
    }
  }

  // Borderline mains pressure penalty (unvented: 1.0–1.5 bar)
  if (UNVENTED_OPTION_IDS.has(id)) {
    const bar = pressureAnalysis.dynamicBar;
    if (bar >= 1.0 && bar < 1.5) {
      breakdown.push({ id: 'pressure_borderline', label: `Mains pressure borderline (${bar.toFixed(1)} bar — min 1.5 bar recommended)`, penalty: 8 });
      score -= 8;
    }
  }

  // ── D) Confidence penalty ───────────────────────────────────────────────────
  let confidencePenalty = 0;

  if (confidence) {
    if (confidence.level === 'medium') {
      confidencePenalty += 6;
    } else if (confidence.level === 'low') {
      confidencePenalty += 12;
    }
  }

  // Per severe (warn) assumption: -2 each, capped at -8
  const warnAssumptionCount = assumptions?.filter(a => a.severity === 'warn').length ?? 0;
  confidencePenalty += Math.min(warnAssumptionCount * 2, 8);

  if (confidencePenalty > 0) {
    breakdown.push({
      id: 'confidence_penalty',
      label: `Confidence penalty (${confidence?.level ?? 'unknown'} confidence + ${warnAssumptionCount} warn assumption(s))`,
      penalty: confidencePenalty,
    });
    score -= confidencePenalty;
  }

  // ── Clamp ──────────────────────────────────────────────────────────────────
  const total = Math.max(0, Math.min(100, score));

  return { total, breakdown, confidencePenalty: confidencePenalty > 0 ? confidencePenalty : undefined };
}
