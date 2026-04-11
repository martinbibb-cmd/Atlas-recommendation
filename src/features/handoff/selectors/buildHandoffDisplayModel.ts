/**
 * buildHandoffDisplayModel.ts
 *
 * Derives a HandoffDisplayModel from an AtlasPropertyImportResult.
 *
 * This is a pure selector — it does not mutate or persist anything.
 * All presentational derivation logic for the handoff arrival surface lives
 * here so that components stay thin and this logic can be unit-tested in
 * isolation.
 *
 * Architecture rules
 * ──────────────────
 * - Import AtlasPropertyV1 only from @atlas/contracts.
 * - Do NOT import or reference any scan-boundary type (ScanBundleV1, etc.).
 * - Do NOT call importAtlasProperty() or atlasPropertyCompletenessSummary()
 *   from here — they are already called before the result is passed in.
 * - Keep migration / schema branching inside helpers here, not in components.
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import type { AtlasPropertyImportResult } from '../types/atlasPropertyHandoff.types';
import type {
  HandoffDisplayModel,
  HandoffKnowledgeSummary,
  HandoffReadinessSummary,
  KnowledgeStatus,
} from '../types/handoffDisplay.types';

// ─── Field-value helpers ──────────────────────────────────────────────────────

type AnyFieldValue = { value: unknown; confidence?: string } | undefined;

function fvStatus(fv: AnyFieldValue, unknownValue?: string): KnowledgeStatus {
  if (fv == null || fv.value == null) return 'missing';
  if (unknownValue != null && fv.value === unknownValue) return 'review';
  if (fv.confidence === 'high' || fv.confidence === 'medium') return 'confirmed';
  return 'review';
}

// ─── Title / address ──────────────────────────────────────────────────────────

function buildTitle(property: AtlasPropertyV1['property']): string {
  const parts: string[] = [];
  if (property.address1) parts.push(property.address1);
  if (property.town)     parts.push(property.town);
  if (property.postcode) parts.push(property.postcode);
  return parts.length > 0 ? parts.join(', ') : 'Unknown property';
}

function buildSubtitle(property: AtlasPropertyV1): string | undefined {
  const typeFv = property.property.propertyType;
  const eraFv  = property.property.buildEra;
  const parts: string[] = [];
  if (typeFv?.value) parts.push(String(typeFv.value).replace(/_/g, ' '));
  if (eraFv?.value)  parts.push(String(eraFv.value).replace(/_/g, '–'));
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function deriveReference(property: AtlasPropertyV1): string {
  const id = property.property;
  if (id.uprn)      return id.uprn;
  if (id.reference) return id.reference;
  return property.propertyId;
}

// ─── Extracted-fact count ─────────────────────────────────────────────────────

/**
 * Count the number of FieldValues in canonical sub-models that carry
 * high or medium confidence.  This is a proxy for "how many things were
 * captured with useful certainty", surfacing both structured voice-derived
 * facts and engineer-entered measurements.
 */
function countExtractedFacts(p: AtlasPropertyV1): number {
  let count = 0;

  const fieldValues: AnyFieldValue[] = [
    p.property.propertyType,
    p.property.buildEra,
    p.household?.composition?.adultCount,
    p.household?.composition?.childCount0to4,
    p.household?.composition?.childCount5to10,
    p.household?.composition?.childCount11to17,
    p.household?.composition?.youngAdultCount18to25AtHome,
    p.household?.occupancyPattern,
    p.household?.hotWaterUsage?.bathroomCount,
    p.household?.hotWaterUsage?.bathPresent,
    p.household?.hotWaterUsage?.showerPresent,
    p.currentSystem?.family,
    p.currentSystem?.dhwType,
    p.currentSystem?.heatSource?.ratedOutputKw,
    p.currentSystem?.heatSource?.installYear,
    p.currentSystem?.distribution?.dominantPipeDiameterMm,
    p.derived?.heatLoss?.peakWatts,
    p.derived?.hydraulics?.dynamicPressureBar,
    p.derived?.hydraulics?.mainsFlowLpm,
  ];

  for (const fv of fieldValues) {
    if (fv?.value != null && (fv.confidence === 'high' || fv.confidence === 'medium')) {
      count++;
    }
  }

  return count;
}

// ─── Knowledge summary ────────────────────────────────────────────────────────

function buildKnowledgeSummary(p: AtlasPropertyV1): HandoffKnowledgeSummary {
  const adultFv       = p.household?.composition?.adultCount;
  const occupancyFv   = p.household?.occupancyPattern;
  const bathroomFv    = p.household?.hotWaterUsage?.bathroomCount;
  const systemFamilyFv = p.currentSystem?.family;

  // household: present if adult count is known
  const household = fvStatus(adultFv);

  // usage: present if occupancy pattern or bathroom count is known
  const usage: KnowledgeStatus =
    fvStatus(occupancyFv) === 'confirmed' || fvStatus(bathroomFv) === 'confirmed'
      ? 'confirmed'
      : fvStatus(occupancyFv) === 'review' || fvStatus(bathroomFv) === 'review'
        ? 'review'
        : 'missing';

  // currentSystem: present if family is known and not 'unknown'
  const currentSystem = fvStatus(systemFamilyFv, 'unknown');

  // priorities: not yet a structured FieldValue — mark as missing for now
  const priorities: KnowledgeStatus = 'missing';

  // constraints: not yet a structured FieldValue — mark as missing for now
  const constraints: KnowledgeStatus = 'missing';

  return { household, usage, currentSystem, priorities, constraints };
}

// ─── Readiness summary ────────────────────────────────────────────────────────

/**
 * Canonical fields whose absence is critical (prevents simulation).
 */
const CRITICAL_FIELD_LABELS: Record<string, string> = {
  'property.postcode':                    'Property postcode',
  'household.composition.adultCount':     'Household adult count',
  'currentSystem.family':                 'Current heating system type',
  'derived.heatLoss.peakWatts':           'Peak heat loss figure',
  'building.rooms':                       'Building room layout',
  'derived.hydraulics.dynamicPressureBar': 'Mains dynamic pressure',
};

/**
 * Fields whose absence is recommended but not blocking.
 */
const RECOMMENDED_FIELD_LABELS: Record<string, string> = {
  'currentSystem.heatSource.ratedOutputKw':  'Boiler rated output (kW)',
  'currentSystem.heatSource.installYear':    'Boiler install year',
  'derived.hydraulics.mainsFlowLpm':         'Mains flow rate (L/min)',
};

function buildReadinessSummary(
  importResult: AtlasPropertyImportResult,
): HandoffReadinessSummary {
  const { completeness, warnings } = importResult;

  const criticalFieldKeys = Object.keys(CRITICAL_FIELD_LABELS);
  const missingCritical = completeness.missingFields
    .filter(f => criticalFieldKeys.includes(f))
    .map(f => CRITICAL_FIELD_LABELS[f] ?? f);

  const recommendedFieldKeys = Object.keys(RECOMMENDED_FIELD_LABELS);
  const missingRecommended = completeness.missingFields
    .filter(f => recommendedFieldKeys.includes(f))
    .map(f => RECOMMENDED_FIELD_LABELS[f] ?? f);

  return {
    readyForSimulation: completeness.readyForSimulation,
    missingCritical,
    missingRecommended,
    confidenceWarnings: warnings,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * buildHandoffDisplayModel — derive a HandoffDisplayModel from an import result.
 *
 * @param importResult  The result returned by importAtlasProperty().
 * @returns             A flat HandoffDisplayModel ready for the arrival page.
 */
export function buildHandoffDisplayModel(
  importResult: AtlasPropertyImportResult,
): HandoffDisplayModel {
  const { atlasProperty: p } = importResult;

  const title      = buildTitle(p.property);
  const subtitle   = buildSubtitle(p);
  const reference  = deriveReference(p);
  const capturedAt = p.capture.completedAt ?? p.capture.startedAt ?? p.updatedAt;

  const roomCount      = p.building.rooms.length;
  const objectCount    = p.building.systemComponents.length;
  const photoCount     = p.evidence.photos.length;
  const voiceNoteCount = p.evidence.voiceNotes.length;
  const noteCount      = p.evidence.textNotes.length;
  const extractedFactCount = countExtractedFacts(p);

  const knowledge  = buildKnowledgeSummary(p);
  const readiness  = buildReadinessSummary(importResult);

  return {
    title,
    subtitle,
    sourceLabel: 'From Atlas Scan',
    capturedAt,
    reference,
    roomCount,
    objectCount,
    photoCount,
    voiceNoteCount,
    noteCount,
    extractedFactCount,
    knowledge,
    readiness,
  };
}
