/**
 * buildPortalDisplayModel.ts
 *
 * PR9 — Derives a PortalDisplayModel from any report payload shape.
 *
 * Rules:
 *   - Canonical (schemaVersion: '2.0') payload is the primary truth.
 *   - Legacy payload is fallback only.
 *   - Portal components must not branch on payload schema directly.
 *   - All schema detection stays inside this file (and the underlying helpers).
 *   - Never throws — returns null when no usable engine output is found.
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import { readCanonicalReportPayload } from '../../../features/reports/adapters/readCanonicalReportPayload';
import { extractEngineRunFromPayload } from '../../../features/reports/adapters/extractEngineRunFromPayload';
import { extractAtlasPropertyFromPayload } from '../../../features/reports/adapters/extractAtlasPropertyFromPayload';
import { extractPresentationStateFromPayload } from '../../../features/reports/adapters/extractPresentationStateFromPayload';
import type {
  PortalDisplayModel,
  PortalEvidenceSummary,
  PortalKnowledgeSummary,
  KnowledgeStatus,
} from '../types/portalDisplay.types';
import type { SpatialEvidence3D, ExternalClearanceSceneV1 } from '../../../contracts/spatial3dEvidence';
import type { PropertyPlan } from '../../../components/floorplan/propertyPlan.types';
import {
  validatePlanReadiness,
  spatialConfidenceIsWeak,
} from '../../../features/floorplan/planReadinessValidator';

// ─── Field-value helpers ──────────────────────────────────────────────────────

type AnyFieldValue = { value: unknown; confidence?: string } | undefined;

function fvStatus(fv: AnyFieldValue, unknownValue?: string): KnowledgeStatus {
  if (fv == null || fv.value == null) return 'missing';
  if (unknownValue != null && fv.value === unknownValue) return 'review';
  if (fv.confidence === 'high' || fv.confidence === 'medium') return 'confirmed';
  return 'review';
}

// ─── Evidence summary ─────────────────────────────────────────────────────────

/**
 * Count FieldValues with high or medium confidence across canonical sub-models.
 * This is a proxy for "how many things were captured with useful certainty".
 */
function countExtractedFacts(p: AtlasPropertyV1): number {
  const fieldValues: AnyFieldValue[] = [
    p.property?.propertyType,
    p.property?.buildEra,
    p.household?.composition?.adultCount,
    p.household?.composition?.childCount0to4,
    p.household?.composition?.childCount5to10,
    p.household?.composition?.childCount11to17,
    p.household?.composition?.youngAdultCount18to25AtHome,
    p.household?.occupancyPattern,
    p.household?.hotWaterUsage?.bathPresent,
    p.household?.hotWaterUsage?.showerCount,
    p.currentSystem?.family,
    p.currentSystem?.dhwType,
    p.currentSystem?.heatSource?.ratedOutputKw,
    p.currentSystem?.heatSource?.installYear,
    p.currentSystem?.distribution?.dominantPipeDiameterMm,
    p.derived?.heatLoss?.peakWatts,
    p.derived?.hydraulics?.dynamicPressureBar,
    p.derived?.hydraulics?.mainsFlowLpm,
  ];

  let count = 0;
  for (const fv of fieldValues) {
    if (fv?.value != null && (fv.confidence === 'high' || fv.confidence === 'medium')) {
      count++;
    }
  }
  return count;
}

function buildEvidenceSummary(p: AtlasPropertyV1): PortalEvidenceSummary {
  return {
    photoCount:        p.evidence?.photos?.length ?? 0,
    voiceNoteCount:    p.evidence?.voiceNotes?.length ?? 0,
    textNoteCount:     p.evidence?.textNotes?.length ?? 0,
    extractedFactCount: countExtractedFacts(p),
  };
}

// ─── Knowledge summary ────────────────────────────────────────────────────────

function buildKnowledgeSummary(p: AtlasPropertyV1): PortalKnowledgeSummary {
  const adultFv        = p.household?.composition?.adultCount;
  const occupancyFv    = p.household?.occupancyPattern;
  const systemFamilyFv = p.currentSystem?.family;

  // household: confirmed/review/missing based on adult count field
  const household = fvStatus(adultFv);

  // usage: occupancy pattern primary; hot-water usage fields as secondary signal
  const hasAnyHotWaterUsage =
    !!p.household?.hotWaterUsage &&
    Object.values(p.household.hotWaterUsage).some((v) => v != null);

  const usage: KnowledgeStatus =
    fvStatus(occupancyFv) === 'confirmed'
      ? 'confirmed'
      : fvStatus(occupancyFv) === 'review' || hasAnyHotWaterUsage
        ? 'review'
        : 'missing';

  // currentSystem: present if family is known and not 'unknown'
  const currentSystem = fvStatus(systemFamilyFv, 'unknown');

  // priorities / constraints: not yet structured FieldValues
  const priorities: KnowledgeStatus = 'missing';
  const constraints: KnowledgeStatus = 'missing';

  return { household, usage, currentSystem, priorities, constraints };
}

// ─── Title derivation ─────────────────────────────────────────────────────────

function buildPropertyTitle(
  p: AtlasPropertyV1 | null,
  legacyPostcode: string | null | undefined,
): string {
  if (p?.property) {
    const parts: string[] = [];
    if (p.property.address1) parts.push(p.property.address1);
    if (p.property.town)     parts.push(p.property.town);
    if (p.property.postcode) parts.push(p.property.postcode);
    if (parts.length > 0) return parts.join(', ');
  }
  if (legacyPostcode) return legacyPostcode;
  return 'Your recommendation';
}

// ─── Recommended option id ────────────────────────────────────────────────────

function resolveRecommendedOptionId(
  payload: unknown,
  engineOutput: { options?: Array<{ id: string; status?: string }> },
): string | undefined {
  // Prefer presentationState
  const ps = extractPresentationStateFromPayload(payload);
  if (ps?.recommendedOptionId) return ps.recommendedOptionId;

  // Fall back to first viable option in engine output
  return engineOutput.options?.find((o) => o.status === 'viable')?.id;
}

// ─── 3D evidence extraction ───────────────────────────────────────────────────

function extractSpatialEvidence3D(p: AtlasPropertyV1 | null): SpatialEvidence3D[] | undefined {
  if (!p) return undefined;
  const records = (p as unknown as Record<string, unknown>)['spatialEvidence3d'];
  if (!Array.isArray(records) || records.length === 0) return undefined;
  return records as SpatialEvidence3D[];
}

function extractExternalClearanceScenes(p: AtlasPropertyV1 | null): ExternalClearanceSceneV1[] | undefined {
  if (!p) return undefined;
  const records = (p as unknown as Record<string, unknown>)['externalClearanceScenes'];
  if (!Array.isArray(records) || records.length === 0) return undefined;
  return records as ExternalClearanceSceneV1[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds a PortalDisplayModel from any report payload.
 *
 * Returns null when the payload contains no usable engine output.
 *
 * @param payload        Raw payload from the database (unknown shape).
 * @param reportPostcode Postcode from the report row — used as title fallback.
 * @param propertyPlan   Optional floor plan — when provided, spatialConfidenceWeak
 *                       is derived from plan-readiness validation (PR20).
 */
export function buildPortalDisplayModel(
  payload: unknown,
  reportPostcode?: string | null,
  propertyPlan?: PropertyPlan,
): PortalDisplayModel | null {
  // ── Engine run (required) ──────────────────────────────────────────────────
  const engineRun = extractEngineRunFromPayload(payload);
  if (!engineRun?.engineOutput) return null;

  const { engineOutput } = engineRun;

  // ── Presentation state ────────────────────────────────────────────────────
  const presentationState = extractPresentationStateFromPayload(payload);

  // ── Payload version detection ─────────────────────────────────────────────
  // Use readCanonicalReportPayload to detect schema version once rather than
  // calling individual helpers multiple times.
  const payloadInfo = readCanonicalReportPayload(payload);
  const isCanonical = payloadInfo.payloadVersion === 'canonical_v2';

  // ── Canonical property ─────────────────────────────────────────────────────
  // Only use atlasProperty for display purposes when the payload is genuinely
  // canonical (schemaVersion '2.0').  Legacy payloads produce a partial patch
  // via extractAtlasPropertyFromPayload — that patch is not real captured
  // evidence and should not populate evidenceSummary / knowledgeSummary.
  const atlasProperty = isCanonical ? extractAtlasPropertyFromPayload(payload) : null;

  // ── Property title ────────────────────────────────────────────────────────
  const legacyPostcode =
    reportPostcode ??
    payloadInfo.legacy?.surveyData?.postcode ??
    null;
  const propertyTitle = buildPropertyTitle(atlasProperty, legacyPostcode);

  // ── Recommendation option ids ─────────────────────────────────────────────
  const recommendedOptionId = resolveRecommendedOptionId(payload, engineOutput);
  const chosenOptionId      = presentationState?.chosenByCustomer && presentationState.chosenOptionId
    ? presentationState.chosenOptionId
    : undefined;

  // ── Evidence and knowledge (canonical only) ───────────────────────────────
  const evidenceSummary  = atlasProperty ? buildEvidenceSummary(atlasProperty)  : undefined;
  const knowledgeSummary = atlasProperty ? buildKnowledgeSummary(atlasProperty) : undefined;

  // ── 3D evidence (canonical only) ─────────────────────────────────────────
  const spatialEvidence3d       = extractSpatialEvidence3D(atlasProperty);
  const externalClearanceScenes = extractExternalClearanceScenes(atlasProperty);

  // ── Spatial confidence (PR20) ─────────────────────────────────────────────
  const spatialConfidenceWeak = propertyPlan
    ? spatialConfidenceIsWeak(validatePlanReadiness(propertyPlan))
    : undefined;

  return {
    propertyTitle,
    recommendationReady: true,
    recommendedOptionId,
    chosenOptionId,
    engineOutput,
    presentationState: presentationState ?? null,
    evidenceSummary,
    knowledgeSummary,
    ...(spatialEvidence3d       ? { spatialEvidence3d }       : {}),
    ...(externalClearanceScenes ? { externalClearanceScenes } : {}),
    ...(spatialConfidenceWeak !== undefined ? { spatialConfidenceWeak } : {}),
  };
}
