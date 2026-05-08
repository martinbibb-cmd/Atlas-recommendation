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
  objectPins: NormalisedObjectPin[];
  ghostAppliances: string[];
  measurements: string[];
  surfaceSemantic: string | null;
}

interface NormalisedObjectPin {
  label: string;
  sections: ProposalSection[];
  needsReview: boolean;
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

/**
 * Normalizes category/template strings into stable lowercase tokens.
 * Converts spaces and slashes to underscores and strips punctuation.
 *
 * @param value - The raw category/template string to normalize.
 * @returns The normalized lowercase token with underscores.
 */
function normaliseToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s/]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Converts machine-style identifiers (snake/kebab case) into plain words.
 *
 * @param value - The machine-style identifier to convert.
 * @returns Human-readable text with spaces instead of underscores/hyphens.
 */
function humaniseToken(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    ...normaliseObjectPins(obj?.['objectPins']),
    ...normaliseObjectPins(obj?.['pins']),
    ...normaliseObjectPins(evidence?.['objectPins']),
  ].filter(
    (pin, i, arr) =>
      pin.label.length > 0 &&
      arr.findIndex(
        (p) => p.label === pin.label && p.sections.join('|') === pin.sections.join('|'),
      ) === i,
  );

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

  const pinNeedsReview = objectPins.some((pin) => pin.needsReview);
  return {
    id,
    needsReview: needsReview || pinNeedsReview,
    objectPins,
    ghostAppliances,
    measurements,
    surfaceSemantic,
  };
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

/**
 * Keywords in an object-pin label that map to the 'boiler' proposal section.
 *
 * The 'boiler' section covers the proposed heat source regardless of technology
 * type — gas boiler, back boiler, combi, or heat pump.  When the scan captures
 * a heat pump unit pin, it belongs to the same "proposed heat source" proposal
 * step that gas-boiler pins belong to.  Separate physics treatment of heat pump
 * vs. gas happens in the engine, not here.
 */
const BOILER_KEYWORDS = [
  'boiler', 'heat_pump', 'heat pump', 'furnace',
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

/**
 * Maps structured equipment categories/templates to proposal evidence sections.
 */
function sectionsForCategory(value: string | null): ProposalSection[] {
  if (!value) return [];
  const token = normaliseToken(value);
  if (token.includes('heat_source') || token.includes('boiler')) return ['boiler'];
  if (
    token.includes('hot_water_storage') ||
    token.includes('cylinder') ||
    token.includes('thermal_store')
  ) {
    return ['cylinder'];
  }
  if (token.includes('flue') || token.includes('external')) return ['flue'];
  if (token.includes('emitter') || token.includes('radiator') || token.includes('ufh')) {
    return ['radiators'];
  }
  if (token.includes('heating_component') || token.includes('heating_components')) {
    return ['general'];
  }
  return [];
}

/**
 * Builds a human-readable manual equipment label using manufacturer/model and
 * optional type/dimensions metadata.
 *
 * @param manualEntry - Manual equipment entry metadata.
 * @returns A formatted equipment label string.
 */
function buildManualIdentityLabel(manualEntry: UnknownRecord): string {
  const manufacturer =
    readString(manualEntry['manufacturer']) ??
    readString(manualEntry['make']) ??
    readString(manualEntry['brand']);
  const model = readString(manualEntry['model']);
  const type =
    readString(manualEntry['type']) ??
    readString(manualEntry['applianceType']) ??
    readString(manualEntry['productType']);
  const dimensions =
    readString(manualEntry['dimensions']) ??
    readString(manualEntry['dimensionsMm']) ??
    readString(manualEntry['dimensionsText']);

  const parts = [manufacturer, model].filter((p): p is string => Boolean(p));
  const detailParts: string[] = [];
  if (type) detailParts.push(`type: ${type}`);
  if (dimensions) detailParts.push(`dimensions: ${dimensions}`);
  if (detailParts.length > 0) parts.push(`(${detailParts.join(', ')})`);
  return parts.join(' ').trim();
}

/**
 * Normalizes mixed pin payloads (string labels or structured objects) into a
 * unified object-pin model with section mapping and review status.
 *
 * @param value - Mixed array of string labels or structured equipment pin objects.
 * @returns Normalized object pins with labels, sections, and review status.
 */
function normaliseObjectPins(value: unknown): NormalisedObjectPin[] {
  const result: NormalisedObjectPin[] = [];
  for (const item of asArray(value)) {
    if (typeof item === 'string' && item.trim().length > 0) {
      const label = item.trim();
      result.push({
        label,
        sections: sectionsForPin(label),
        needsReview: false,
      });
      continue;
    }

    const obj = asObject(item);
    if (!obj) continue;

    const objectCategory = readString(obj['objectCategory']);
    const selectedTemplateId = readString(obj['selectedTemplateId']);
    const objectCategoryToken =
      objectCategory != null ? normaliseToken(objectCategory) : null;
    const selectedTemplateToken =
      selectedTemplateId != null ? normaliseToken(selectedTemplateId) : null;
    const locationContext = readString(obj['locationContext']);
    const provenance = readString(obj['provenance']);
    const reviewStatus = readString(obj['reviewStatus']);
    const anchorConfidence = readNumber(obj['anchorConfidence']);
    const manualEntry = asObject(obj['manualEntry']);

    const manualIdentity = manualEntry ? buildManualIdentityLabel(manualEntry) : '';
    const fallbackLabel =
      readString(obj['label']) ??
      readString(obj['name']) ??
      readString(obj['title']) ??
      selectedTemplateId ??
      objectCategory ??
      readString(obj['type']) ??
      readString(obj['id']) ??
      'Unknown equipment';

    const label = [
      manualIdentity.length > 0 ? manualIdentity : humaniseToken(fallbackLabel),
      locationContext ? `(${humaniseToken(locationContext)})` : null,
    ]
      .filter((v): v is string => v != null && v.trim().length > 0)
      .join(' ')
      .trim();

    const sections = [
      ...sectionsForCategory(objectCategory),
      ...sectionsForCategory(selectedTemplateId),
      ...sectionsForPin(label),
    ].filter((s, i, arr) => arr.indexOf(s) === i);

    const isPlaceholder =
      (selectedTemplateToken != null &&
        (selectedTemplateToken.includes('unknown') ||
          selectedTemplateToken.includes('placeholder') ||
          selectedTemplateToken.includes('manual'))) ||
      (objectCategoryToken != null &&
        (objectCategoryToken.includes('unknown') ||
          objectCategoryToken.includes('placeholder'))) ||
      (manualEntry != null && manualIdentity.length === 0);

    const needsReview =
      reviewStatus === 'pending' ||
      reviewStatus === 'unresolved' ||
      reviewStatus === 'needs_review' ||
      reviewStatus === 'pending_review' ||
      provenance === 'unknown' ||
      (anchorConfidence != null && anchorConfidence < 0.6) ||
      isPlaceholder;

    result.push({ label, sections, needsReview });
  }
  return result;
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

function measurementLabel(count: number): string {
  return `${count} measurement${count !== 1 ? 's' : ''}`;
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
        const pinSections = new Set<ProposalSection>(
          cp.objectPins.flatMap((pin) =>
            pin.sections.length > 0 ? pin.sections : (['general'] as ProposalSection[]),
          ),
        );
        for (const section of pinSections) {
          const sectionPins = cp.objectPins.filter((pin) =>
            pin.sections.length > 0
              ? pin.sections.includes(section)
              : section === 'general',
          );
          push(section, {
            capturePointId: cp.id,
            storyboardCardKey: 'key-objects',
            label: sectionPins.map((p) => p.label).join(', '),
            isResolved: resolved && sectionPins.every((pin) => !pin.needsReview),
          });
        }
        if (pinSections.size === 0) {
          // Object pins exist but no specific section matched → general
          push('general', {
            capturePointId: cp.id,
            storyboardCardKey: 'key-objects',
            label: cp.objectPins.map((pin) => pin.label).join(', '),
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
        const mLabel = measurementLabel(cp.measurements.length);
        const surfaceSections = new Set(sectionsForSurface(cp.surfaceSemantic));
        if (surfaceSections.size > 0) {
          for (const section of surfaceSections) {
            push(section, {
              capturePointId: cp.id,
              storyboardCardKey: 'measurements',
              label: mLabel,
              isResolved: resolved,
            });
          }
        } else {
          push('general', {
            capturePointId: cp.id,
            storyboardCardKey: 'measurements',
            label: mLabel,
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
