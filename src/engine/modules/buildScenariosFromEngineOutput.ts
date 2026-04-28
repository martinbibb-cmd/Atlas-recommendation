/**
 * buildScenariosFromEngineOutput.ts — Adapts EngineOutputV1 option cards to
 * the canonical ScenarioResult[] shape.
 *
 * This bridges the legacy EngineOutputV1 pipeline (used by CustomerPortalPage
 * and CanonicalPresentationPage) with the canonical ScenarioResult[] + AtlasDecisionV1
 * pipeline consumed by buildVisualBlocks and buildPortalViewModel.
 *
 * Design rules:
 *  - Content flows only from EngineOutputV1 — no new copy invented here.
 *  - One ScenarioResult is produced per OptionCardV1 in engineOutput.options.
 *  - physicsFlags are derived from option-level signals (DHW/heat plane status,
 *    option id, sensitivities). They are conservative approximations — the full
 *    physics flag model is the engine's recommendation result.
 *  - Performance bands map from option status and plane status.
 *  - Returns [] when engineOutput.options is absent or empty.
 */

import type { EngineOutputV1, OptionCardV1 } from '../../contracts/EngineOutputV1';
import type { ScenarioResult, ScenarioPerformance, ScenarioPhysicsFlags, ScenarioSystemType } from '../../contracts/ScenarioResult';
import { resolveNominalEfficiencyPct } from '../utils/efficiency';
import { estimateCop } from '../../features/explainers/energy/lib/energyMath';

// UK design outdoor temperature (°C) — canonical value matching SystemConditionImpactModule.
const OUTDOOR_DESIGN_TEMP_C = -3;
// Standard ASHP design flow temperature (°C) for a typical UK wet-system installation.
const ASHP_DESIGN_FLOW_TEMP_C = 45;

// ─── Maps ─────────────────────────────────────────────────────────────────────

const OPTION_ID_TO_SYSTEM_TYPE: Record<OptionCardV1['id'], ScenarioSystemType> = {
  combi:            'combi',
  stored_vented:    'regular',
  stored_unvented:  'system',
  system_unvented:  'system',
  regular_vented:   'regular',
  ashp:             'ashp',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function planeStatusToBand(status: string): ScenarioPerformance['hotWater'] {
  switch (status) {
    case 'ok':      return 'excellent';
    case 'caution': return 'good';
    case 'fail':    return 'poor';
    default:        return 'good';
  }
}

function derivePerformance(option: OptionCardV1): ScenarioPerformance {
  return {
    hotWater:   planeStatusToBand(option.dhw.status),
    heating:    planeStatusToBand(option.heat.status),
    efficiency: option.status === 'viable' ? 'very_good' : option.status === 'caution' ? 'good' : 'poor',
    reliability: option.status === 'viable' ? 'very_good' : option.status === 'caution' ? 'needs_setup' : 'poor',
  };
}

function derivePhysicsFlags(option: OptionCardV1): ScenarioPhysicsFlags {
  const sensitivities = option.sensitivities ?? [];
  const sensitivityKeys = sensitivities.map((s) => s.lever ?? '');

  return {
    hydraulicLimit:      sensitivityKeys.some((key) => key.includes('hydraulic') || key.includes('pipe') || key.includes('flow')),
    combiFlowRisk:       option.id === 'combi' && option.dhw.status !== 'ok',
    highTempRequired:    sensitivityKeys.some((key) => key.includes('temp') || key.includes('heat')),
    pressureConstraint:  sensitivityKeys.some((key) => key.includes('pressure') || key.includes('mains')),
  };
}

/**
 * Derive a physics-based efficiency metric for a given option.
 *
 * ASHP options: estimated COP at UK design conditions (−3 °C outdoor, 45 °C
 * flow temperature) using the Carnot-fraction model from energyMath.ts.
 * Boiler options: nominal SEDBUK seasonal efficiency from efficiency.ts
 * (defaults to DEFAULT_NOMINAL_EFFICIENCY_PCT when no better data is available).
 *
 * The returned value is a conservative physics default.  Callers with richer
 * per-option engine data (e.g. measured SEDBUK or SPF) should override this
 * field on the returned ScenarioResult.
 */
function deriveEfficiencyMetric(option: OptionCardV1): ScenarioResult['efficiencyMetric'] {
  if (option.id === 'ashp') {
    return {
      kind:  'cop',
      value: Math.round(estimateCop(OUTDOOR_DESIGN_TEMP_C, ASHP_DESIGN_FLOW_TEMP_C) * 10) / 10,
    };
  }
  return {
    kind:  'eta',
    value: resolveNominalEfficiencyPct(),
  };
}

function adaptOption(option: OptionCardV1): ScenarioResult {
  const systemType = OPTION_ID_TO_SYSTEM_TYPE[option.id] ?? 'combi';

  // 'viable' options: why[] contains positive reasons → keyBenefits.
  // 'caution' options: why[] contains constraint/caution reasons → keyConstraints.
  // 'rejected' options: why[] contains rejection reasons → keyConstraints.
  // This ensures the ProblemBlock can surface real constraints for non-viable
  // options and that buildDecisionFromScenarios doesn't treat constraint text
  // as evidence of a benefit.
  const benefits     = option.status === 'viable'    ? option.why.slice(0, 4) : [];
  const constraints  = option.status !== 'viable'    ? option.why.slice(0, 4) : [];

  // ── Derive hardConstraints from rejection why[] ──────────────────────────────
  // Hard constraints are non-negotiable physics failures captured as rejection
  // reasons for rejected options. OptionPlane.status is 'ok' | 'caution' | 'na'
  // (no 'fail' value exists in the contract), so plane bullets are surfaced via
  // performancePenalties below when status is 'caution'.
  const hardConstraints: string[] = [];
  // For rejected options, add why[] reasons.
  // Deduplication here avoids duplicate strings going into the Set in
  // buildDecisionFromScenarios and inflating the constraint list.
  if (option.status === 'rejected') {
    const seen = new Set(hardConstraints);
    for (const w of option.why.slice(0, 4)) {
      if (!seen.has(w)) {
        hardConstraints.push(w);
        seen.add(w);
      }
    }
  }

  // ── Derive performancePenalties from caution-status planes ──────────────────
  // Performance penalties are warn-level degradations, not hard failures.
  const performancePenalties: string[] = [];
  if (option.dhw.status === 'caution') {
    performancePenalties.push(...option.dhw.bullets.slice(0, 3));
  }
  if (option.heat.status === 'caution') {
    performancePenalties.push(...option.heat.bullets.slice(0, 3));
  }

  return {
    scenarioId:       option.id,
    system:           { type: systemType, summary: option.headline || option.label },
    performance:      derivePerformance(option),
    keyBenefits:      benefits,
    keyConstraints:   constraints,
    dayToDayOutcomes: [...option.dhw.bullets.slice(0, 2), ...option.heat.bullets.slice(0, 2)],
    requiredWorks:    option.typedRequirements?.mustHave ?? option.requirements.slice(0, 3),
    upgradePaths:     option.typedRequirements?.likelyUpgrades ?? [],
    physicsFlags:     derivePhysicsFlags(option),
    efficiencyMetric: deriveEfficiencyMetric(option),
    ...(hardConstraints.length > 0    ? { hardConstraints }    : {}),
    ...(performancePenalties.length > 0 ? { performancePenalties } : {}),
  };
}

// ─── Public builder ───────────────────────────────────────────────────────────

/**
 * buildScenariosFromEngineOutput
 *
 * Converts EngineOutputV1 option cards to a ScenarioResult[] that is
 * compatible with buildDecisionFromScenarios, buildVisualBlocks, and
 * buildPortalViewModel.
 *
 * The recommended scenario is placed first. Returns [] when no options exist.
 */
export function buildScenariosFromEngineOutput(engineOutput: EngineOutputV1): ScenarioResult[] {
  const options = engineOutput.options ?? [];
  if (options.length === 0) return [];

  const recommendedLabel = engineOutput.recommendation?.primary ?? '';
  const recommended = options.find((o) => o.label === recommendedLabel || o.status === 'viable');
  const recommendedId = recommended?.id;

  // When the engine's primary recommendation contains "mixergy" (i.e. the
  // MIXERGY_RECOMMENDATION_LABEL from OutputBuilder), the stored-water unvented
  // scenarios must be tagged so downstream headline builders and label maps
  // can surface the correct Mixergy / pressure-tolerant copy instead of the
  // generic "unvented cylinder" framing.
  const isMixergyRecommended = /mixergy/i.test(recommendedLabel);
  const UNVENTED_IDS = new Set<string>(['stored_unvented', 'system_unvented']);

  return options.map((o) => {
    const adapted = adaptOption(o);
    if (isMixergyRecommended && UNVENTED_IDS.has(o.id)) {
      return { ...adapted, dhwSubtype: 'mixergy' as const };
    }
    return adapted;
  }).sort((a, b) => {
    if (recommendedId && a.scenarioId === recommendedId) return -1;
    if (recommendedId && b.scenarioId === recommendedId) return 1;
    return 0;
  });
}
