/**
 * buildEngineerDisplayModel.ts
 *
 * PR11 — Derives an EngineerDisplayModel from canonical property and engine truth.
 *
 * Rules:
 *   - Canonical (atlasProperty + engineRun) is the primary truth.
 *   - Legacy payload is fallback only.
 *   - Engineer components must not traverse raw payload shapes directly.
 *   - All schema detection stays inside this file and the underlying helpers.
 *   - Never throws — returns null when no usable engine output is found.
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import { extractEngineRunFromPayload } from '../../../features/reports/adapters/extractEngineRunFromPayload';
import { extractAtlasPropertyFromPayload } from '../../../features/reports/adapters/extractAtlasPropertyFromPayload';
import { visitStatusLabel, visitDisplayLabel } from '../../../lib/visits/visitApi';
import { SYSTEM_REGISTRY } from '../../../lib/system/systemRegistry';
import type { VisitMeta } from '../../../lib/visits/visitApi';
import type {
  EngineerDisplayModel,
  EngineerCaptureSummary,
  EngineerKeyComponent,
  EngineerKnowledgeSummary,
  EngineerRequiredWorkItem,
  EngineerWarnings,
  EngineerEvidenceSummary,
  KnowledgeStatus,
} from '../types/engineerDisplay.types';
import type { SpatialEvidence3D, ExternalClearanceSceneV1 } from '../../../contracts/spatial3dEvidence';

// ─── Field-value helpers ──────────────────────────────────────────────────────

type AnyFieldValue = { value: unknown; confidence?: string } | undefined;

function fvStatus(fv: AnyFieldValue, unknownValue?: string): KnowledgeStatus {
  if (fv == null || fv.value == null) return 'missing';
  if (unknownValue != null && fv.value === unknownValue) return 'review';
  if (fv.confidence === 'high' || fv.confidence === 'medium') return 'confirmed';
  return 'review';
}

// ─── System label resolution ──────────────────────────────────────────────────

const CURRENT_SYSTEM_FAMILY_LABELS: Record<string, string> = {
  combi:      'Combi boiler',
  system:     'System boiler',
  regular:    'Regular boiler',
  heat_pump:  'Heat pump',
  hybrid:     'Hybrid system',
  unknown:    'Unknown system',
};

function resolveCurrentSystemLabel(p: AtlasPropertyV1): string | undefined {
  const family = p.currentSystem?.family?.value;
  if (!family) return undefined;
  return CURRENT_SYSTEM_FAMILY_LABELS[family] ?? String(family);
}

function resolveRecommendedSystemLabel(
  engineOutput: { options?: Array<{ id: string; status?: string }> },
): string | undefined {
  const viableOption = engineOutput.options?.find(o => o.status === 'viable');
  if (!viableOption) return undefined;
  const registryEntry = SYSTEM_REGISTRY.get(viableOption.id as Parameters<typeof SYSTEM_REGISTRY.get>[0]);
  return registryEntry?.label ?? viableOption.id;
}

// ─── Title / address ──────────────────────────────────────────────────────────

function buildTitle(
  p: AtlasPropertyV1 | null,
  visitMeta: VisitMeta | null,
): string {
  if (p?.property) {
    const parts: string[] = [];
    if (p.property.address1) parts.push(p.property.address1);
    if (p.property.town)     parts.push(p.property.town);
    if (p.property.postcode) parts.push(p.property.postcode);
    if (parts.length > 0) return parts.join(', ');
  }
  if (visitMeta) return visitDisplayLabel(visitMeta);
  return 'Pre-install engineer view';
}

function buildAddress(
  p: AtlasPropertyV1 | null,
  visitMeta: VisitMeta | null,
): string | undefined {
  if (p?.property) {
    const parts: string[] = [];
    if (p.property.address1)   parts.push(p.property.address1);
    if (p.property.address2)   parts.push(p.property.address2);
    if (p.property.town)       parts.push(p.property.town);
    if (p.property.postcode)   parts.push(p.property.postcode);
    if (parts.length > 0) return parts.join(', ');
  }
  if (visitMeta?.address_line_1) {
    return visitMeta.postcode
      ? `${visitMeta.address_line_1}, ${visitMeta.postcode}`
      : visitMeta.address_line_1;
  }
  return undefined;
}

// ─── Capture summary ──────────────────────────────────────────────────────────

function buildCaptureSummary(p: AtlasPropertyV1 | null): EngineerCaptureSummary {
  if (!p) {
    return { roomCount: 0, objectCount: 0, photoCount: 0, voiceNoteCount: 0, extractedFactCount: 0 };
  }

  const roomCount   = p.building?.rooms?.length ?? 0;
  const objectCount = p.building?.systemComponents?.length ?? 0;
  const photoCount      = p.evidence?.photos?.length ?? 0;
  const voiceNoteCount  = p.evidence?.voiceNotes?.length ?? 0;

  // Count high/medium confidence field values as extracted facts.
  const fieldValues: AnyFieldValue[] = [
    p.property?.propertyType,
    p.property?.buildEra,
    p.household?.composition?.adultCount,
    p.household?.hotWaterUsage?.bathPresent,
    p.household?.hotWaterUsage?.showerCount,
    p.currentSystem?.family,
    p.currentSystem?.dhwType,
    p.currentSystem?.heatSource?.ratedOutputKw,
    p.currentSystem?.heatSource?.installYear,
    p.currentSystem?.distribution?.dominantPipeDiameterMm,
    p.derived?.heatLoss?.peakWatts,
    p.derived?.hydraulics?.dynamicPressureBar,
  ];
  let extractedFactCount = 0;
  for (const fv of fieldValues) {
    if (fv?.value != null && (fv.confidence === 'high' || fv.confidence === 'medium')) {
      extractedFactCount++;
    }
  }

  return { roomCount, objectCount, photoCount, voiceNoteCount, extractedFactCount };
}

// ─── Key components ───────────────────────────────────────────────────────────

const COMPONENT_CATEGORY_LABELS: Record<string, string> = {
  boiler:    'Boiler',
  heat_pump: 'Heat pump',
  cylinder:  'Cylinder',
  manifold:  'Manifold',
  pump:      'Pump',
  meter:     'Meter',
  flue:      'Flue',
  controls:  'Controls',
  other:     'Other component',
};

const KEY_COMPONENT_CATEGORIES = new Set([
  'boiler', 'heat_pump', 'cylinder', 'manifold', 'flue', 'controls',
]);

function buildKeyComponents(p: AtlasPropertyV1 | null): EngineerKeyComponent[] {
  if (!p?.building?.systemComponents) return [];

  const rooms = p.building?.rooms ?? [];

  return p.building.systemComponents
    .filter(c => KEY_COMPONENT_CATEGORIES.has(c.category))
    .map(c => {
      const room = rooms.find(r => r.roomId === c.roomId);
      return {
        id:           c.componentId,
        label:        c.label ?? COMPONENT_CATEGORY_LABELS[c.category] ?? c.category,
        type:         c.category,
        roomLabel:    room?.label,
        evidenceCount: undefined, // Photo/note linking requires evidence model traversal — deferred.
      };
    });
}

// ─── Knowledge summary ────────────────────────────────────────────────────────

function buildKnowledgeSummary(p: AtlasPropertyV1 | null): EngineerKnowledgeSummary {
  if (!p) {
    return { household: 'missing', usage: 'missing', currentSystem: 'missing', priorities: 'missing', constraints: 'missing' };
  }

  const adultFv        = p.household?.composition?.adultCount;
  const occupancyFv    = p.household?.occupancyPattern;
  const systemFamilyFv = p.currentSystem?.family;

  const household = fvStatus(adultFv);

  const hasAnyHotWaterUsage =
    !!p.household?.hotWaterUsage &&
    Object.values(p.household.hotWaterUsage).some(v => v != null);

  const usage: KnowledgeStatus =
    fvStatus(occupancyFv) === 'confirmed'
      ? 'confirmed'
      : fvStatus(occupancyFv) === 'review' || hasAnyHotWaterUsage
        ? 'review'
        : 'missing';

  const currentSystem = fvStatus(systemFamilyFv, 'unknown');

  // constraints from install constraint list
  const hasConstraints = (p.currentSystem?.constraints?.length ?? 0) > 0;
  const constraints: KnowledgeStatus = hasConstraints ? 'confirmed' : 'missing';

  return {
    household,
    usage,
    currentSystem,
    priorities: 'missing', // No structured priorities field yet.
    constraints,
  };
}

// ─── Required work ────────────────────────────────────────────────────────────

/**
 * Derives required work items from:
 *   1. Engine output constraints on the viable option (if present).
 *   2. Installation constraints recorded against the current system.
 */
function buildRequiredWork(
  p: AtlasPropertyV1 | null,
  engineOutput: { options?: Array<{ id: string; status?: string; constraints?: Array<{ id: string; label: string; severity?: string }> }> } | null,
): EngineerRequiredWorkItem[] {
  const items: EngineerRequiredWorkItem[] = [];

  // 1. Derive from engine option constraints (viability caveats).
  if (engineOutput?.options) {
    const viableOption = engineOutput.options.find(o => o.status === 'viable');
    if (viableOption?.constraints) {
      for (const c of viableOption.constraints) {
        const engineSeverity = c.severity;
        let severity: EngineerRequiredWorkItem['severity'] = 'review';
        if (engineSeverity === 'fail')       severity = 'required';
        else if (engineSeverity === 'warn')  severity = 'recommended';
        items.push({
          title:    c.label,
          reason:   'Flagged by Atlas recommendation engine',
          severity,
        });
      }
    }
  }

  // 2. Derive from canonical install constraints on current system.
  if (p?.currentSystem?.constraints) {
    for (const c of p.currentSystem.constraints) {
      let severity: EngineerRequiredWorkItem['severity'] = 'review';
      if (c.severity === 'blocking')        severity = 'required';
      else if (c.severity === 'significant') severity = 'recommended';
      items.push({
        title:  c.description,
        reason: `Install constraint (${c.code})`,
        severity,
      });
    }
  }

  // 3. Derive standard work items from the recommended system type.
  if (engineOutput?.options) {
    const viableOption = engineOutput.options.find(o => o.status === 'viable');
    if (viableOption) {
      const systemLabel = resolveRecommendedSystemLabel(engineOutput) ?? viableOption.id;
      items.push({
        title:  `Install ${systemLabel}`,
        reason: 'Primary recommendation from Atlas engine',
        severity: 'required',
      });
    }
  }

  return items;
}

// ─── Warnings ─────────────────────────────────────────────────────────────────

function buildWarnings(
  p: AtlasPropertyV1 | null,
  knowledgeSummary: EngineerKnowledgeSummary,
): EngineerWarnings {
  const missingCritical: string[] = [];
  const missingRecommended: string[] = [];
  const confidenceWarnings: string[] = [];

  // Critical missing fields
  if (knowledgeSummary.currentSystem === 'missing') {
    missingCritical.push('Current system type — confirm on arrival');
  }
  if (knowledgeSummary.household === 'missing') {
    missingCritical.push('Household composition — verify with customer on arrival');
  }

  // Recommended fields
  if (knowledgeSummary.usage === 'missing') {
    missingRecommended.push('Occupancy and hot-water usage — verify with customer');
  }
  if (knowledgeSummary.constraints === 'missing') {
    missingRecommended.push('No constraints noted — confirm access and clearances on arrival');
  }

  // Confidence warnings from field values
  if (knowledgeSummary.currentSystem === 'review') {
    confidenceWarnings.push('Current system type from survey — confirm on arrival');
  }
  if (knowledgeSummary.household === 'review') {
    confidenceWarnings.push('Household size from survey — verify with customer');
  }

  // QA flags as warnings
  if (p?.evidence?.qaFlags) {
    const openFlags = p.evidence.qaFlags.filter(f => !f.resolved);
    for (const flag of openFlags) {
      if (flag.severity === 'blocking' || flag.severity === 'error') {
        missingCritical.push(flag.message);
      } else if (flag.severity === 'warning') {
        confidenceWarnings.push(flag.message);
      }
    }
  }

  return { missingCritical, missingRecommended, confidenceWarnings };
}

// ─── Evidence summary ─────────────────────────────────────────────────────────

function buildEvidenceSummary(p: AtlasPropertyV1 | null): EngineerEvidenceSummary {
  if (!p) {
    return { photos: 0, voiceNotes: 0, textNotes: 0, qaFlags: 0, timelineEvents: 0 };
  }
  return {
    photos:         p.evidence?.photos?.length ?? 0,
    voiceNotes:     p.evidence?.voiceNotes?.length ?? 0,
    textNotes:      p.evidence?.textNotes?.length ?? 0,
    qaFlags:        p.evidence?.qaFlags?.length ?? 0,
    timelineEvents: p.evidence?.events?.length ?? 0,
  };
}

// ─── 3D evidence extraction ───────────────────────────────────────────────────

/**
 * Extracts internal room scan evidence from atlasProperty, if present.
 * The atlasProperty type from @atlas/contracts may be extended in the iOS app
 * to include spatialEvidence3d — we read it defensively via cast.
 */
function extractSpatialEvidence3D(p: AtlasPropertyV1 | null): SpatialEvidence3D[] | undefined {
  if (!p) return undefined;
  const records = (p as unknown as Record<string, unknown>)['spatialEvidence3d'];
  if (!Array.isArray(records) || records.length === 0) return undefined;
  return records as SpatialEvidence3D[];
}

/**
 * Extracts external flue-clearance scene records from atlasProperty, if present.
 */
function extractExternalClearanceScenes(p: AtlasPropertyV1 | null): ExternalClearanceSceneV1[] | undefined {
  if (!p) return undefined;
  const records = (p as unknown as Record<string, unknown>)['externalClearanceScenes'];
  if (!Array.isArray(records) || records.length === 0) return undefined;
  return records as ExternalClearanceSceneV1[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Builds an EngineerDisplayModel from any report payload plus optional visit metadata.
 *
 * Returns null when the payload contains no usable engine output.
 *
 * @param payload   Raw payload from the database (unknown shape).
 * @param visitMeta VisitMeta row — used for title, reference, status, and address fallback.
 * @param visitId   The visit ID to embed in the model.
 */
export function buildEngineerDisplayModel(
  payload: unknown,
  visitMeta: VisitMeta | null,
  visitId: string,
): EngineerDisplayModel | null {
  // ── Engine run (required) ─────────────────────────────────────────────────
  const engineRun = extractEngineRunFromPayload(payload);
  if (!engineRun?.engineOutput) return null;

  const { engineOutput } = engineRun;

  // ── Canonical property ────────────────────────────────────────────────────
  const atlasProperty = extractAtlasPropertyFromPayload(payload);

  // ── Core fields ───────────────────────────────────────────────────────────
  const title          = buildTitle(atlasProperty, visitMeta);
  const address        = buildAddress(atlasProperty, visitMeta);
  const visitReference = visitMeta?.visit_reference ?? undefined;
  const statusLabel    = visitMeta ? visitStatusLabel(visitMeta.status) : undefined;

  // ── System labels ─────────────────────────────────────────────────────────
  const currentSystem     = atlasProperty ? resolveCurrentSystemLabel(atlasProperty) : undefined;
  const recommendedSystem = resolveRecommendedSystemLabel(engineOutput);

  // ── Derived model sections ────────────────────────────────────────────────
  const captureSummary   = buildCaptureSummary(atlasProperty);
  const keyComponents    = buildKeyComponents(atlasProperty);
  const knowledgeSummary = buildKnowledgeSummary(atlasProperty);
  const requiredWork     = buildRequiredWork(atlasProperty, engineOutput);
  const warnings         = buildWarnings(atlasProperty, knowledgeSummary);
  const evidence         = buildEvidenceSummary(atlasProperty);

  // ── 3D evidence (optional) ────────────────────────────────────────────────
  const spatialEvidence3d      = extractSpatialEvidence3D(atlasProperty);
  const externalClearanceScenes = extractExternalClearanceScenes(atlasProperty);

  return {
    visitId,
    title,
    address,
    visitReference,
    statusLabel,
    currentSystem,
    recommendedSystem,
    captureSummary,
    keyComponents,
    knowledgeSummary,
    requiredWork,
    warnings,
    evidence,
    ...(spatialEvidence3d       ? { spatialEvidence3d }       : {}),
    ...(externalClearanceScenes ? { externalClearanceScenes } : {}),
  };
}
