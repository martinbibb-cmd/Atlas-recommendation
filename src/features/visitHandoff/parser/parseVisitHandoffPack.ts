/**
 * parseVisitHandoffPack.ts
 *
 * PR11 — Safe parser / runtime guard for VisitHandoffPack.
 *
 * Responsibilities
 * ────────────────
 * - Validate the required top-level structure of an incoming pack.
 * - Normalise missing optional arrays to empty arrays so consumers never
 *   need to null-check array fields.
 * - Return null (never throw) on invalid or unrecognisable input, so the
 *   caller can show an error state without crashing the page.
 *
 * Architecture rules
 * ──────────────────
 * - No dependency on the legacy report / Insight pipeline.
 * - No dependency on the recommendation engine.
 * - Pure function — no side effects.
 */

import type {
  VisitHandoffPack,
  CustomerVisitSummary,
  EngineerVisitSummary,
} from '../types/visitHandoffPack';
import type { HardwarePatchV1, HardwarePatchEntryV1 } from '../../../contracts/hardware/HardwarePatchV1';

// ─── Internal validators ──────────────────────────────────────────────────────

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asArray<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter(guard);
}

function isHandoffRoom(value: unknown): value is import('../types/visitHandoffPack').HandoffRoom {
  if (!isObject(value)) return false;
  return typeof value['id'] === 'string' && typeof value['name'] === 'string';
}

function isHandoffKeyObject(value: unknown): value is import('../types/visitHandoffPack').HandoffKeyObject {
  if (!isObject(value)) return false;
  return typeof value['type'] === 'string';
}

function isHandoffProposedEmitter(value: unknown): value is import('../types/visitHandoffPack').HandoffProposedEmitter {
  if (!isObject(value)) return false;
  return (
    typeof value['roomId'] === 'string' &&
    typeof value['roomName'] === 'string' &&
    typeof value['emitterType'] === 'string'
  );
}

function isHandoffAccessNote(value: unknown): value is import('../types/visitHandoffPack').HandoffAccessNote {
  if (!isObject(value)) return false;
  return typeof value['location'] === 'string' && typeof value['note'] === 'string';
}

function parseHardwarePatchEntry(raw: unknown): HardwarePatchEntryV1 | null {
  if (!isObject(raw)) return null;
  if (!isObject(raw['definition'])) return null;
  const def = raw['definition'];
  if (
    typeof def['modelId'] !== 'string' ||
    typeof def['brand'] !== 'string' ||
    typeof def['brandName'] !== 'string' ||
    typeof def['seriesId'] !== 'string' ||
    typeof def['seriesName'] !== 'string' ||
    typeof def['modelName'] !== 'string' ||
    typeof def['outputKw'] !== 'number'
  ) return null;

  // Validate the required nested dimensions object
  const dims = def['dimensions'];
  if (
    !isObject(dims) ||
    typeof dims['widthMm'] !== 'number' ||
    typeof dims['depthMm'] !== 'number' ||
    typeof dims['heightMm'] !== 'number'
  ) return null;

  // Validate the required nested clearanceRules object
  const rules = def['clearanceRules'];
  if (
    !isObject(rules) ||
    typeof rules['frontMm'] !== 'number' ||
    typeof rules['sideMm'] !== 'number' ||
    typeof rules['topMm'] !== 'number' ||
    typeof rules['bottomMm'] !== 'number'
  ) return null;

  // Validate the required updatedAt field
  if (typeof raw['updatedAt'] !== 'string') return null;

  return raw as unknown as HardwarePatchEntryV1;
}

function parseHardwarePatch(raw: unknown): HardwarePatchV1 | undefined {
  if (!isObject(raw)) return undefined;
  if (raw['version'] !== '1') return undefined;
  if (!isObject(raw['overrides'])) return undefined;
  const overrides: Record<string, HardwarePatchEntryV1> = {};
  for (const [key, val] of Object.entries(raw['overrides'])) {
    const entry = parseHardwarePatchEntry(val);
    // Entries that fail structural validation are silently dropped so a single
    // malformed override cannot invalidate the entire patch.  Consumers that
    // need diagnostics should validate patch entries before embedding them.
    if (entry != null) {
      overrides[key] = entry;
    }
  }
  return { version: '1', overrides };
}

function parseCustomerSummary(raw: unknown): CustomerVisitSummary | null {
  if (!isObject(raw)) return null;
  if (typeof raw['address'] !== 'string') return null;

  return {
    address: raw['address'],
    currentSystemDescription:
      typeof raw['currentSystemDescription'] === 'string'
        ? raw['currentSystemDescription']
        : undefined,
    findings: asStringArray(raw['findings']),
    plannedWork: asStringArray(raw['plannedWork']),
    nextSteps:
      typeof raw['nextSteps'] === 'string' ? raw['nextSteps'] : undefined,
  };
}

function parseEngineerSummary(raw: unknown): EngineerVisitSummary | null {
  if (!isObject(raw)) return null;

  return {
    rooms: asArray(raw['rooms'], isHandoffRoom),
    keyObjects: asArray(raw['keyObjects'], isHandoffKeyObject),
    proposedEmitters: asArray(raw['proposedEmitters'], isHandoffProposedEmitter),
    accessNotes: asArray(raw['accessNotes'], isHandoffAccessNote),
    roomPlanNotes:
      typeof raw['roomPlanNotes'] === 'string' ? raw['roomPlanNotes'] : undefined,
    specNotes:
      typeof raw['specNotes'] === 'string' ? raw['specNotes'] : undefined,
    fieldNotesSummary:
      typeof raw['fieldNotesSummary'] === 'string'
        ? raw['fieldNotesSummary']
        : undefined,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * safeParseVisitHandoffPack
 *
 * Accepts any unknown input (e.g. pasted JSON, uploaded file contents, fixture)
 * and returns a fully normalised VisitHandoffPack, or null if the input is
 * structurally invalid.
 *
 * Missing optional arrays are normalised to [] — consumers can iterate safely
 * without checking for undefined.
 *
 * Never throws.
 */
export function safeParseVisitHandoffPack(input: unknown): VisitHandoffPack | null {
  try {
    if (!isObject(input)) return null;

    if (input['schemaVersion'] !== '1.0') return null;
    if (typeof input['visitId'] !== 'string' || input['visitId'].length === 0) return null;
    if (typeof input['completedAt'] !== 'string' || input['completedAt'].length === 0) return null;

    const customerSummary = parseCustomerSummary(input['customerSummary']);
    if (customerSummary === null) return null;

    const engineerSummary = parseEngineerSummary(input['engineerSummary']);
    if (engineerSummary === null) return null;

    return {
      schemaVersion: '1.0',
      visitId: input['visitId'],
      completedAt: input['completedAt'],
      engineerName:
        typeof input['engineerName'] === 'string' ? input['engineerName'] : undefined,
      customerSummary,
      engineerSummary,
      hardwarePatch: parseHardwarePatch(input['hardwarePatch']),
    };
  } catch {
    return null;
  }
}
