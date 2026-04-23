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
  const sensitivityIds = sensitivities.map((s) => s.id ?? '');

  return {
    hydraulicLimit:      sensitivityIds.some((id) => id.includes('hydraulic') || id.includes('pipe') || id.includes('flow')),
    combiFlowRisk:       option.id === 'combi' && option.dhw.status !== 'ok',
    highTempRequired:    sensitivityIds.some((id) => id.includes('temp') || id.includes('heat')),
    pressureConstraint:  sensitivityIds.some((id) => id.includes('pressure') || id.includes('mains')),
  };
}

function adaptOption(option: OptionCardV1): ScenarioResult {
  const systemType = OPTION_ID_TO_SYSTEM_TYPE[option.id] ?? 'combi';
  const benefits = option.status === 'viable' || option.status === 'caution'
    ? option.why.slice(0, 4)
    : [];
  const constraints = option.status === 'rejected' ? option.why.slice(0, 3) : [];

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
