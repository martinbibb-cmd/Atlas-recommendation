/**
 * buildEngineerHandoff.ts — Projects canonical decision truth into an engineer handoff.
 *
 * PR7 — Takes an AtlasDecisionV1 and the evaluated ScenarioResult[] and produces
 * an EngineerHandoff suitable for the engineer-facing surface.
 *
 * Rules:
 *  - No new recommendation logic.
 *  - No re-scoring or re-ranking.
 *  - All output is derived from the supplied AtlasDecisionV1, ScenarioResult[],
 *    and optional engine input context.
 *  - Output is concise and install-oriented.
 */

import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { EngineInputV2_3Contract } from '../../contracts/EngineInputV2_3';
import type { EngineerHandoff, EngineerHandoffFact, EngineerHandoffEvidence } from '../../contracts/EngineerHandoff';

// ─── System type labels ───────────────────────────────────────────────────────

const SYSTEM_TYPE_LABELS: Record<ScenarioResult['system']['type'], string> = {
  combi:   'Combi boiler',
  system:  'System boiler',
  regular: 'Regular (heat-only) boiler',
  ashp:    'Air source heat pump',
};

// ─── Job summary ──────────────────────────────────────────────────────────────

function buildJobSummary(
  decision: AtlasDecisionV1,
  recommended: ScenarioResult,
): EngineerHandoff['jobSummary'] {
  const systemLabel = SYSTEM_TYPE_LABELS[recommended.system.type] ?? recommended.system.type;
  // Use the scenario's own system summary as the operational one-liner —
  // it's physics-derived and avoids repeating customer narrative.
  return {
    recommendedScenarioId: decision.recommendedScenarioId,
    recommendedSystemLabel: systemLabel,
    summary: recommended.system.summary,
  };
}

// ─── Existing system ──────────────────────────────────────────────────────────

function buildExistingSystem(
  decision: AtlasDecisionV1,
  engineInput?: EngineInputV2_3Contract,
): EngineerHandoff['existingSystem'] {
  const boilerType =
    engineInput?.currentSystem?.boiler?.type ??
    decision.lifecycle.currentSystem.type ??
    undefined;

  const boilerAgeYears =
    engineInput?.currentSystem?.boiler?.ageYears ??
    (decision.lifecycle.currentSystem.ageYears > 0
      ? decision.lifecycle.currentSystem.ageYears
      : undefined);

  const nominalOutputKw = engineInput?.currentSystem?.boiler?.nominalOutputKw ?? undefined;

  const hotWaterType = engineInput?.dhw?.architecture ?? undefined;

  return {
    ...(boilerType      !== undefined ? { boilerType:      String(boilerType) }  : {}),
    ...(boilerAgeYears  !== undefined ? { boilerAgeYears }                       : {}),
    ...(nominalOutputKw !== undefined ? { nominalOutputKw }                      : {}),
    ...(hotWaterType    !== undefined ? { hotWaterType:    String(hotWaterType) } : {}),
  };
}

// ─── Measured facts ───────────────────────────────────────────────────────────

function buildMeasuredFacts(
  decision: AtlasDecisionV1,
  engineInput?: EngineInputV2_3Contract,
): EngineerHandoffFact[] {
  // Start from the canonical supporting facts already in the decision.
  const facts: EngineerHandoffFact[] = decision.supportingFacts.map(f => ({
    label:  f.label,
    value:  f.value,
    source: f.source,
  }));

  // Append additional physics inputs from engineInput when available and not
  // already present in supportingFacts.
  const existingLabels = new Set(facts.map(f => f.label.toLowerCase()));

  function addFact(label: string, value: string | number, source: EngineerHandoffFact['source']) {
    if (!existingLabels.has(label.toLowerCase())) {
      facts.push({ label, value, source });
      existingLabels.add(label.toLowerCase());
    }
  }

  if (engineInput) {
    if (engineInput.infrastructure.primaryPipeSizeMm !== undefined) {
      addFact('Primary pipe diameter', `${engineInput.infrastructure.primaryPipeSizeMm} mm`, 'survey');
    }
    if (engineInput.property.peakHeatLossKw !== undefined) {
      addFact('Peak heat loss', `${engineInput.property.peakHeatLossKw} kW`, 'engine');
    }
    if (engineInput.services?.mainsStaticPressureBar !== undefined) {
      addFact('Mains static pressure', `${engineInput.services.mainsStaticPressureBar} bar`, 'survey');
    }
    if (engineInput.services?.mainsDynamicPressureBar !== undefined) {
      addFact('Mains dynamic pressure', `${engineInput.services.mainsDynamicPressureBar} bar`, 'survey');
    }
    if (engineInput.services?.mainsDynamicFlowLpm !== undefined) {
      addFact('Mains flow rate', `${engineInput.services.mainsDynamicFlowLpm} L/min`, 'survey');
    }
    if (engineInput.occupancy.peakConcurrentOutlets !== undefined) {
      addFact('Peak concurrent outlets', engineInput.occupancy.peakConcurrentOutlets, 'survey');
    }
    if (engineInput.currentSystem?.boiler?.nominalOutputKw !== undefined) {
      addFact('Current boiler output', `${engineInput.currentSystem.boiler.nominalOutputKw} kW`, 'survey');
    }
  }

  return facts;
}

// ─── Install notes ────────────────────────────────────────────────────────────

/**
 * Derives install-time notes from physics flags, DHW architecture, and lifecycle
 * condition. These are operational reminders, not recommendation rationale.
 */
function buildInstallNotes(
  decision: AtlasDecisionV1,
  recommended: ScenarioResult,
  engineInput?: EngineInputV2_3Contract,
): string[] {
  const notes: string[] = [];
  const flags = recommended.physicsFlags;

  if (flags.hydraulicLimit) {
    notes.push('22mm primary pipework present — verify flow rate before sizing pump');
  }
  if (flags.pressureConstraint) {
    notes.push('Verify discharge route for unvented cylinder (G3 requirement)');
  }
  if (flags.highTempRequired) {
    notes.push('Radiators may require higher-than-ideal flow temperatures — confirm emitter sizing');
  }
  if (flags.combiFlowRisk) {
    notes.push('Simultaneous DHW draw risk noted — confirm cylinder sizing is sufficient');
  }

  const dhwArch = engineInput?.dhw?.architecture;
  if (dhwArch === 'stored_mixergy') {
    notes.push('Mixergy cylinder specified — confirm stratification probe and smart controller wiring');
  }
  if (dhwArch === 'stored_standard') {
    notes.push('Unvented cylinder specified — G3 installer required');
  }

  // Lifecycle-derived note
  const condition = decision.lifecycle.currentSystem.condition;
  if (condition === 'at_risk' || condition === 'worn') {
    notes.push('Existing system at or beyond typical service life — inspect primary circuit on arrival');
  }

  return notes;
}

// ─── Evidence ─────────────────────────────────────────────────────────────────

/**
 * Placeholder — evidence records will be populated from AtlasPropertyV1
 * in a future PR when floor plan / object / photo truth is fed in.
 */
function buildEvidence(): EngineerHandoffEvidence[] {
  return [];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * buildEngineerHandoff
 *
 * Projects an AtlasDecisionV1 and its source ScenarioResult[] into an
 * EngineerHandoff view model.
 *
 * @param decision     The canonical AtlasDecisionV1 for this job.
 * @param scenarios    All evaluated ScenarioResult entries for this job.
 * @param engineInput  Optional engine input — used to surface measured facts
 *                     (pipe sizes, pressures, outputs) not already in decision.supportingFacts.
 *
 * @throws {Error} when the recommended scenario cannot be located in scenarios[].
 */
export function buildEngineerHandoff(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
  engineInput?: EngineInputV2_3Contract,
): EngineerHandoff {
  const recommended = scenarios.find(s => s.scenarioId === decision.recommendedScenarioId);
  if (!recommended) {
    throw new Error(
      `buildEngineerHandoff: recommended scenario "${decision.recommendedScenarioId}" not found in scenarios[]`,
    );
  }

  return {
    jobSummary:            buildJobSummary(decision, recommended),
    includedScope:         decision.includedItems,
    requiredWorks:         decision.requiredWorks,
    compatibilityWarnings: decision.compatibilityWarnings,
    keyReasons:            decision.keyReasons,
    existingSystem:        buildExistingSystem(decision, engineInput),
    measuredFacts:         buildMeasuredFacts(decision, engineInput),
    installNotes:          buildInstallNotes(decision, recommended, engineInput),
    evidence:              buildEvidence(),
    futurePath:            decision.futureUpgradePaths,
  };
}
