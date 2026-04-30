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
 *  - No dependency on the recommendation engine — derived fields only.
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
} from '../types/visitHandoffPack';

// ─── Customer summary derivation ─────────────────────────────────────────────

function deriveCurrentSystemDescription(
  systemBuilder: FullSurveyModelV1['fullSurvey']['systemBuilder'] | undefined,
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
  systemBuilder: FullSurveyModelV1['fullSurvey']['systemBuilder'] | undefined,
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
  recommendation: FullSurveyModelV1['fullSurvey']['recommendation'] | undefined,
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
  systemBuilder: FullSurveyModelV1['fullSurvey']['systemBuilder'] | undefined,
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

  if (systemBuilder.dhwType && systemBuilder.dhwType !== 'combi') {
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

function buildEngineerSummary(
  payload: Partial<FullSurveyModelV1>,
): EngineerVisitSummary {
  const systemBuilder = payload.fullSurvey?.systemBuilder;

  return {
    rooms: [],
    keyObjects: deriveKeyObjects(systemBuilder),
    proposedEmitters: [],
    accessNotes: [],
  };
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Builds a VisitHandoffPack from a completed visit's metadata and working
 * payload.  Returns a structurally valid pack even when data is sparse.
 */
export function buildHandoffPackFromSurvey(
  meta: VisitMeta,
  payload: Partial<FullSurveyModelV1>,
): VisitHandoffPack {
  return {
    schemaVersion: '1.0',
    visitId: meta.id,
    completedAt: meta.completed_at ?? new Date().toISOString(),
    customerSummary: buildCustomerSummary(meta, payload),
    engineerSummary: buildEngineerSummary(payload),
  };
}
