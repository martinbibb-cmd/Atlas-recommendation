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

  // ── Derive hardConstraints from fail-status planes and rejection why[] ──────
  // Hard constraints are non-negotiable physics failures: fail-severity plane
  // bullets, or the rejection reasons for rejected options.
  const hardConstraints: string[] = [];
  if (option.dhw.status === 'fail') {
    hardConstraints.push(...option.dhw.bullets.slice(0, 3));
  }
  if (option.heat.status === 'fail') {
    hardConstraints.push(...option.heat.bullets.slice(0, 3));
  }
  // For rejected options, add why[] reasons not already captured above.
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

  return options.map(adaptOption).sort((a, b) => {
    if (recommendedId && a.scenarioId === recommendedId) return -1;
    if (recommendedId && b.scenarioId === recommendedId) return 1;
    return 0;
  });
}
