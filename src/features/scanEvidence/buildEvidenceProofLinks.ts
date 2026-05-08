/**
 * buildEvidenceProofLinks.ts
 *
 * Derives EvidenceProofLinkV1[] from a raw spatialEvidenceGraph.
 *
 * Formula:
 *   spatialEvidenceGraph (raw, any shape)
 *   → normalise rooms + capture points
 *   → classify each capture point by object-pin type / surface semantic / ghost appliance
 *   → group into proposal-section proof links
 *
 * Design rules:
 *   - Pure function, deterministic: same input → same output.
 *   - Does NOT call the Atlas engine or change any recommendation.
 *   - Uses the same normalisation logic as CapturedEvidencePanel so capture
 *     point IDs are stable and consistent.
 *   - A capture point can contribute to multiple sections (e.g. a boiler pin
 *     in a utility room may inform both 'boiler' and 'flue' sections).
 *   - `isResolved` is true when `needsReview` is false for that capture point.
 */

import type { EvidenceCaptureRef, EvidenceProofLinkV1, ProposalSection } from './EvidenceProofLinkV1';

// ─── Internal normalised types ────────────────────────────────────────────────

type UnknownRecord = Record<string, unknown>;

interface NormalisedCapturePoint {
  id: string;
  needsReview: boolean;
  objectPins: string[];
  ghostAppliances: string[];
  measurements: string[];
  surfaceSemantic: string | null;
}

interface NormalisedRoom {
  capturePoints: NormalisedCapturePoint[];
}

// ─── Micro-helpers (mirrors CapturedEvidencePanel logic) ──────────────────────

function asObject(value: unknown): UnknownRecord | null {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as UnknownRecord;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function readStringArray(value: unknown): string[] {
  const result: string[] = [];
  for (const item of asArray(value)) {
    if (typeof item === 'string' && item.trim().length > 0) {
      result.push(item.trim());
      continue;
    }
    const obj = asObject(item);
    if (!obj) continue;
    const label =
      readString(obj['label']) ??
      readString(obj['name']) ??
      readString(obj['title']) ??
      readString(obj['type']) ??
      readString(obj['id']);
    if (label) result.push(label);
  }
  return result;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normaliseMeasurements(value: unknown): string[] {
  const out: string[] = [];
  for (const entry of asArray(value)) {
    if (typeof entry === 'string' && entry.trim().length > 0) {
      out.push(entry.trim());
      continue;
    }
    const obj = asObject(entry);
    if (!obj) continue;
    const label = readString(obj['label']) ?? readString(obj['kind']) ?? readString(obj['name']);
    const numericValue =
      readNumber(obj['value']) ??
      readNumber(obj['valueM']) ??
      readNumber(obj['length']) ??
      readNumber(obj['distance']);
    const unit =
      readString(obj['unit']) ??
      (obj['valueM'] != null ? 'm' : null);
    if (numericValue != null) {
      const fv = `${numericValue}${unit ? ` ${unit}` : ''}`;
      out.push(label ? `${label}: ${fv}` : fv);
      continue;
    }
    const fallback = readString(obj['detail']) ?? readString(obj['text']) ?? readString(obj['id']);
    if (fallback) out.push(label ? `${label}: ${fallback}` : fallback);
  }
  return out;
}

function normaliseCapturePoint(raw: unknown, index: number): NormalisedCapturePoint {
  const obj = asObject(raw);
  const evidence = obj ? asObject(obj['evidence']) : null;
  const id =
    (obj &&
      (readString(obj['capturePointId']) ??
        readString(obj['capture_point_id']) ??
        readString(obj['id']))) ??
    `capture-point-${index + 1}`;
  const reviewStatus = readString(obj?.['reviewStatus']);
  const needsReview =
    obj?.['needsReview'] === true ||
    reviewStatus === 'needs_review' ||
    reviewStatus === 'unresolved' ||
    reviewStatus === 'pending_review';

  const objectPins = [
    ...readStringArray(obj?.['objectPins']),
    ...readStringArray(obj?.['pins']),
    ...readStringArray(evidence?.['objectPins']),
  ].filter((v, i, arr) => v.length > 0 && arr.indexOf(v) === i);

  const ghostAppliances = [
    ...readStringArray(obj?.['ghostAppliances']),
    ...readStringArray(evidence?.['ghostAppliances']),
  ].filter((v, i, arr) => v.length > 0 && arr.indexOf(v) === i);

  const measurements = [
    ...normaliseMeasurements(obj?.['measurements']),
    ...normaliseMeasurements(evidence?.['measurements']),
  ].filter((v, i, arr) => v.length > 0 && arr.indexOf(v) === i);

  const surfaceSemantic =
    (obj &&
      (readString(obj['surfaceSemantic']) ??
        readString(obj['semantic']) ??
        readString(asObject(obj['surface'])?.['semantic']))) ??
    null;

  return { id, needsReview, objectPins, ghostAppliances, measurements, surfaceSemantic };
}

function normaliseGraph(graph: unknown): NormalisedRoom[] {
  const graphObj = asObject(graph);
  const roomsRaw = graphObj
    ? [...asArray(graphObj['rooms']), ...asArray(graphObj['roomNodes'])]
    : [];

  if (roomsRaw.length > 0) {
    return roomsRaw.map((rawRoom) => {
      const room = asObject(rawRoom);
      const cpRaw = room
        ? [
            ...asArray(room['capturePoints']),
            ...asArray(room['capture_points']),
            ...asArray(room['points']),
          ]
        : [];
      return { capturePoints: cpRaw.map(normaliseCapturePoint) };
    });
  }

  // Flat capture-point list
  const flat = graphObj
    ? [
        ...asArray(graphObj['capturePoints']),
        ...asArray(graphObj['capture_points']),
        ...asArray(graphObj['nodes']),
      ]
    : asArray(graph);

  if (flat.length === 0) return [];
  return [{ capturePoints: flat.map(normaliseCapturePoint) }];
}

// ─── Section classification ───────────────────────────────────────────────────

/** Keywords in an object-pin label that map to a proposal section. */
const BOILER_KEYWORDS = [
  'boiler', 'heat_pump', 'heat pump', 'furnace', 'back boiler',
  'system boiler', 'combi', 'combination',
];
const CYLINDER_KEYWORDS = [
  'cylinder', 'hot water', 'hot_water', 'thermal store', 'mixergy',
  'airing cupboard', 'tank', 'unvented',
];
const FLUE_KEYWORDS = [
  'flue', 'flue_terminal', 'terminal', 'chimney', 'liner',
  'combustion', 'exhaust',
];
const RADIATOR_KEYWORDS = [
  'radiator', 'rad', 'emitter', 'towel rail', 'underfloor', 'ufh',
  'heat emitter',
];

function containsKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function sectionsForPin(pin: string): ProposalSection[] {
  const sections: ProposalSection[] = [];
  if (containsKeyword(pin, BOILER_KEYWORDS)) sections.push('boiler');
  if (containsKeyword(pin, CYLINDER_KEYWORDS)) sections.push('cylinder');
  if (containsKeyword(pin, FLUE_KEYWORDS)) sections.push('flue');
  if (containsKeyword(pin, RADIATOR_KEYWORDS)) sections.push('radiators');
  return sections;
}

function sectionsForSurface(semantic: string | null): ProposalSection[] {
  if (!semantic) return [];
  const sections: ProposalSection[] = [];
  const lower = semantic.toLowerCase();
  if (lower.includes('boiler') || lower.includes('plant')) sections.push('boiler');
  if (lower.includes('cylinder') || lower.includes('airing')) sections.push('cylinder');
  if (lower.includes('flue') || lower.includes('chimney')) sections.push('flue');
  if (lower.includes('wall') || lower.includes('room') || lower.includes('radiator')) {
    sections.push('radiators');
  }
  return sections;
}

// ─── Aggregate status ─────────────────────────────────────────────────────────

function aggregateStatus(
  refs: EvidenceCaptureRef[],
): EvidenceProofLinkV1['reviewStatus'] {
  if (refs.every((r) => r.isResolved)) return 'confirmed';
  if (refs.some((r) => r.isResolved)) return 'needs_review';
  return 'unresolved';
}

// ─── buildEvidenceProofLinks ──────────────────────────────────────────────────

/**
 * Derives evidence proof links from a raw spatial evidence graph.
 *
 * Returned links group capture-point references by proposal section
 * (boiler, cylinder, flue, radiators, general) so that each proposal
 * step can show which captured evidence supports it.
 *
 * Rules:
 *   - Returns an empty array when no relevant evidence is found.
 *   - A capture point may appear in multiple sections.
 *   - Does not call the Atlas engine or alter any recommendation.
 *   - The `general` link is only emitted when there is measurement or
 *     ghost-appliance evidence not already assigned to a specific section.
 *
 * @param spatialEvidenceGraph - Raw graph from SessionCaptureV2 or any
 *   compatible shape (see CapturedEvidencePanel normalisation logic).
 */
export function buildEvidenceProofLinks(
  spatialEvidenceGraph: unknown,
): EvidenceProofLinkV1[] {
  const rooms = normaliseGraph(spatialEvidenceGraph);
  if (rooms.length === 0) return [];

  const bySection = new Map<ProposalSection, EvidenceCaptureRef[]>([
    ['boiler', []],
    ['cylinder', []],
    ['flue', []],
    ['radiators', []],
    ['general', []],
  ]);

  const allSections: ProposalSection[] = ['boiler', 'cylinder', 'flue', 'radiators', 'general'];

  function push(section: ProposalSection, ref: EvidenceCaptureRef) {
    // De-duplicate by capturePointId + storyboardCardKey
    const existing = bySection.get(section) ?? [];
    const isDuplicate = existing.some(
      (r) => r.capturePointId === ref.capturePointId && r.storyboardCardKey === ref.storyboardCardKey,
    );
    if (!isDuplicate) {
      existing.push(ref);
      bySection.set(section, existing);
    }
  }

  for (const room of rooms) {
    for (const cp of room.capturePoints) {
      const resolved = !cp.needsReview;

      // Object pins → classify by keyword
      if (cp.objectPins.length > 0) {
        const pinSections = new Set(cp.objectPins.flatMap(sectionsForPin));
        for (const section of pinSections) {
          push(section, {
            capturePointId: cp.id,
            storyboardCardKey: 'key-objects',
            label: cp.objectPins
              .filter((p) => sectionsForPin(p).includes(section))
              .join(', '),
            isResolved: resolved,
          });
        }
        if (pinSections.size === 0) {
          // Object pins exist but no specific section matched → general
          push('general', {
            capturePointId: cp.id,
            storyboardCardKey: 'key-objects',
            label: cp.objectPins.join(', '),
            isResolved: resolved,
          });
        }
      }

      // Ghost appliances → classify by keyword (same as object pins)
      if (cp.ghostAppliances.length > 0) {
        const ghostSections = new Set(cp.ghostAppliances.flatMap(sectionsForPin));
        for (const section of ghostSections) {
          push(section, {
            capturePointId: cp.id,
            storyboardCardKey: 'ghost-appliances',
            label: cp.ghostAppliances
              .filter((g) => sectionsForPin(g).includes(section))
              .join(', '),
            isResolved: resolved,
          });
        }
        if (ghostSections.size === 0) {
          push('general', {
            capturePointId: cp.id,
            storyboardCardKey: 'ghost-appliances',
            label: cp.ghostAppliances.join(', '),
            isResolved: resolved,
          });
        }
      }

      // Measurements → always relevant; classify by surface semantic if available
      if (cp.measurements.length > 0) {
        const surfaceSections = new Set(sectionsForSurface(cp.surfaceSemantic));
        if (surfaceSections.size > 0) {
          for (const section of surfaceSections) {
            push(section, {
              capturePointId: cp.id,
              storyboardCardKey: 'measurements',
              label: `${cp.measurements.length} measurement${cp.measurements.length !== 1 ? 's' : ''}`,
              isResolved: resolved,
            });
          }
        } else {
          push('general', {
            capturePointId: cp.id,
            storyboardCardKey: 'measurements',
            label: `${cp.measurements.length} measurement${cp.measurements.length !== 1 ? 's' : ''}`,
            isResolved: resolved,
          });
        }
      }

      // Surface semantic alone (no object pins or measurements) → surface context
      if (
        cp.surfaceSemantic &&
        cp.objectPins.length === 0 &&
        cp.ghostAppliances.length === 0 &&
        cp.measurements.length === 0
      ) {
        const surfaceSections = new Set(sectionsForSurface(cp.surfaceSemantic));
        for (const section of surfaceSections) {
          push(section, {
            capturePointId: cp.id,
            storyboardCardKey: 'what-scanned',
            label: cp.surfaceSemantic,
            isResolved: resolved,
          });
        }
      }

      // Capture points flagged for review → open-review card in general section
      if (cp.needsReview) {
        push('general', {
          capturePointId: cp.id,
          storyboardCardKey: 'open-review',
          label: 'Capture point needs review',
          isResolved: false,
        });
      }
    }
  }

  // Build output — only emit links with at least one capture ref
  const result: EvidenceProofLinkV1[] = [];
  for (const section of allSections) {
    const refs = bySection.get(section) ?? [];
    if (refs.length > 0) {
      result.push({
        section,
        captureRefs: refs,
        reviewStatus: aggregateStatus(refs),
      });
    }
  }

  return result;
}
