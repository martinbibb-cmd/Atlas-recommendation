/**
 * buildHandoffPackFromSurvey.ts
 *
 * Derives a VisitHandoffPack from a completed visit's VisitMeta and
 * FullSurveyModelV1 working payload.  Used so the handoff review surfaces
 * can be opened directly from a completed visit without requiring the
 * engineer to upload or paste JSON.
 *
 * Rules:
 *  - Produces a valid VisitHandoffPack even when data is sparse.
 *  - Missing arrays default to [].
 *  - Missing strings default to undefined (not empty string).
 *  - When an optional engineTopOptionId is provided, the engineer specNotes
 *    will flag any mismatch between the physics ranking and the manually
 *    selected recommendation so the installing engineer is never surprised.
 */

import type { VisitMeta } from '../../../lib/visits/visitApi';
import { visitDisplayLabel } from '../../../lib/visits/visitApi';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';
import {
  HEAT_SOURCE_OPTIONS,
  WATER_SOURCE_OPTIONS,
} from '../../survey/recommendation/recommendationTypes';
import type {
  VisitHandoffPack,
  CustomerVisitSummary,
  EngineerVisitSummary,
  HandoffKeyObject,
  HandoffAccessNote,
} from '../types/visitHandoffPack';

// ─── Customer summary derivation ─────────────────────────────────────────────

function deriveCurrentSystemDescription(
  systemBuilder: NonNullable<FullSurveyModelV1['fullSurvey']>['systemBuilder'] | undefined,
): string | undefined {
  if (!systemBuilder?.heatSource) return undefined;
  const heatMap: Record<string, string> = {
    combi:         'a combination boiler providing central heating and on-demand hot water',
    system:        'a system boiler with a hot-water cylinder',
    regular:       'a regular (open-vented) boiler with a hot-water cylinder',
    storage_combi: 'a storage combination boiler',
  };
  const desc = heatMap[systemBuilder.heatSource];
  if (!desc) return undefined;
  const age = systemBuilder.boilerAgeYears;
  const agePart = age != null
    ? `, approximately ${age} year${age !== 1 ? 's' : ''} old`
    : '';
  return `You currently have ${desc}${agePart}.`;
}

function deriveFindingsFromSurvey(
  systemBuilder: NonNullable<FullSurveyModelV1['fullSurvey']>['systemBuilder'] | undefined,
): string[] {
  if (!systemBuilder) return [];
  const findings: string[] = [];
  const age = systemBuilder.boilerAgeYears;
  if (age != null && age >= 15) {
    findings.push(`The existing boiler is approximately ${age} years old and approaching end of service life.`);
  } else if (age != null && age >= 10) {
    findings.push(`The existing boiler is approximately ${age} years old.`);
  }
  return findings;
}

function derivePlannedWorkFromRecommendation(
  recommendation: NonNullable<FullSurveyModelV1['fullSurvey']>['recommendation'] | undefined,
): string[] {
  if (!recommendation?.heatSource) return [];
  const heatOpt = HEAT_SOURCE_OPTIONS.find(o => o.value === recommendation.heatSource);
  const waterOpt = recommendation.waterSource
    ? WATER_SOURCE_OPTIONS.find(o => o.value === recommendation.waterSource)
    : null;
  const planned: string[] = [];
  if (heatOpt) {
    const label = waterOpt && recommendation.waterSource !== 'keep_existing'
      ? `${heatOpt.label} with ${waterOpt.label}`
      : heatOpt.label;
    planned.push(`Install a new ${label}.`);
  }
  return planned;
}

function buildCustomerSummary(
  meta: VisitMeta,
  payload: Partial<FullSurveyModelV1>,
): CustomerVisitSummary {
  const systemBuilder = payload.fullSurvey?.systemBuilder;
  const recommendation = payload.fullSurvey?.recommendation;

  return {
    address: visitDisplayLabel(meta),
    currentSystemDescription: deriveCurrentSystemDescription(systemBuilder),
    findings: deriveFindingsFromSurvey(systemBuilder),
    plannedWork: derivePlannedWorkFromRecommendation(recommendation),
    nextSteps: 'Your engineer will be in touch to confirm the installation date.',
  };
}

// ─── Engineer summary derivation ─────────────────────────────────────────────

function deriveKeyObjects(
  systemBuilder: NonNullable<FullSurveyModelV1['fullSurvey']>['systemBuilder'] | undefined,
): HandoffKeyObject[] {
  if (!systemBuilder) return [];
  const objects: HandoffKeyObject[] = [];

  if (systemBuilder.heatSource) {
    const heatMap: Record<string, string> = {
      combi:         'Combination boiler',
      system:        'System boiler',
      regular:       'Regular boiler',
      storage_combi: 'Storage combination boiler',
    };
    const boilerType = heatMap[systemBuilder.heatSource] ?? 'Boiler';
    const age = systemBuilder.boilerAgeYears;
    objects.push({
      type: boilerType,
      condition: age != null ? `Approximately ${age} year${age !== 1 ? 's' : ''} old` : undefined,
    });
  }

  if (systemBuilder.dhwType) {
    const cylinderLabels: Record<string, string> = {
      cylinder:        'Hot water cylinder',
      megaflo:         'Unvented (mains-pressure) hot water cylinder',
      thermal_store:   'Thermal store',
    };
    const label = cylinderLabels[systemBuilder.dhwType] ?? 'Hot water storage';
    const ageBand = systemBuilder.cylinderAgeBand;
    objects.push({
      type: label,
      condition: ageBand ?? undefined,
    });
  }

  return objects;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Engineer-facing note added to the handoff access notes when the survey
 * records pipework as buried / concealed in walls.
 */
const BURIED_PIPEWORK_ACCESS_NOTE =
  'Pipework is buried / concealed in walls — access for inspection or replacement will be restricted. Include a full repipe in the installation scope if the system type changes or the existing pipe condition is unknown.'

/**
 * Maps engine option IDs to the comparable recommendation heat-source key so
 * the handoff builder can detect mismatches between the physics ranking and
 * the surveyor's manual selection.
 *
 * Keep in sync with the `OptionCardV1['id']` union and
 * `HEAT_SOURCE_OPTIONS` in recommendationTypes.ts.
 */
const ENGINE_OPTION_ID_TO_HEAT_SOURCE: Readonly<Record<string, string>> = {
  combi:           'combi_boiler',
  stored_vented:   'regular_boiler',
  stored_unvented: 'system_boiler',
  ashp:            'heat_pump_air',
  regular_vented:  'regular_boiler',
  system_unvented: 'system_boiler',
}

// ─── Engineer summary derivation ─────────────────────────────────────────────

function buildEngineerSummary(
  payload: Partial<FullSurveyModelV1>,
  engineTopOptionId?: string,
): EngineerVisitSummary {
  const systemBuilder = payload.fullSurvey?.systemBuilder;
  const recommendation = payload.fullSurvey?.recommendation;

  // ── Access notes ───────────────────────────────────────────────────────────
  const accessNotes: HandoffAccessNote[] = []
  if (systemBuilder?.pipeworkAccess === 'buried') {
    accessNotes.push({
      location: 'Primary pipework',
      note: BURIED_PIPEWORK_ACCESS_NOTE,
    })
  }

  // ── Spec notes — recommendation consistency check ──────────────────────────
  const specNoteParts: string[] = []

  if (recommendation?.heatSource) {
    const heatOpt   = HEAT_SOURCE_OPTIONS.find(o => o.value === recommendation.heatSource)
    const waterOpt  = recommendation.waterSource
      ? WATER_SOURCE_OPTIONS.find(o => o.value === recommendation.waterSource)
      : null
    const agreedLabel = waterOpt && recommendation.waterSource !== 'keep_existing'
      ? `${heatOpt?.label ?? recommendation.heatSource} + ${waterOpt.label}`
      : (heatOpt?.label ?? recommendation.heatSource)
    specNoteParts.push(`Agreed installation: ${agreedLabel}`)
  }

  // Flag when the physics-ranked top option differs from the manual selection.
  let recommendationMismatchWarning: string | undefined;
  if (engineTopOptionId != null && recommendation?.heatSource != null) {
    const physicsHeatSource = ENGINE_OPTION_ID_TO_HEAT_SOURCE[engineTopOptionId]
    if (physicsHeatSource != null && physicsHeatSource !== recommendation.heatSource) {
      const physicsLabel =
        HEAT_SOURCE_OPTIONS.find(o => o.value === physicsHeatSource)?.label ?? engineTopOptionId
      recommendationMismatchWarning =
        `Atlas physics ranking placed "${physicsLabel}" as the top option, ` +
        `but the surveyor selected a different system. ` +
        `Confirm the agreed recommendation before customer handoff.`
      specNoteParts.push(`⚠ Recommendation mismatch: ${recommendationMismatchWarning}`)
    }
  }

  return {
    rooms: [],
    keyObjects: deriveKeyObjects(systemBuilder),
    proposedEmitters: [],
    accessNotes,
    specNotes: specNoteParts.length > 0 ? specNoteParts.join('\n\n') : undefined,
    recommendationMismatchWarning,
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Builds a VisitHandoffPack from a completed visit's metadata and working
 * payload.  Returns a structurally valid pack even when data is sparse.
 *
 * @param engineTopOptionId  Optional ID of the engine's top-ranked option
 *   (e.g. 'system_unvented', 'combi').  When provided, the engineer spec notes
 *   will flag any mismatch between the physics ranking and the surveyor's
 *   manually selected recommendation.
 */
export function buildHandoffPackFromSurvey(
  meta: VisitMeta,
  payload: Partial<FullSurveyModelV1>,
  engineTopOptionId?: string,
): VisitHandoffPack {
  return {
    schemaVersion: '1.0',
    visitId: meta.id,
    completedAt: meta.completed_at ?? new Date().toISOString(),
    customerSummary: buildCustomerSummary(meta, payload),
    engineerSummary: buildEngineerSummary(payload, engineTopOptionId),
  };
}
