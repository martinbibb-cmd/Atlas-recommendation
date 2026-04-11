/**
 * importAtlasProperty.ts
 *
 * Core entry point for the canonical AtlasPropertyV1 handoff/import path.
 *
 * Architecture rules
 * ──────────────────
 * - This is an import boundary, not a save action.
 * - Do NOT mutate report persistence or visit DB inside this function.
 * - Do NOT call scanImporter, scanMapper, or scanPackageImporter from here.
 * - Do NOT let raw ScanBundleV1 types escape the scanImport boundary.
 * - Do NOT define a local clone of AtlasPropertyV1 — use @atlas/contracts directly.
 *
 * The function accepts an unknown value (raw JSON from any source) and returns
 * a typed AtlasPropertyImportResult, mirroring the discipline of the existing
 * scanImporter/scanPackageImporter pattern.
 */

import type { AtlasPropertyV1 } from '@atlas/contracts';
import { atlasPropertyToEngineInput } from '../../atlasProperty/adapters/atlasPropertyToEngineInput';
import { atlasPropertyCompletenessSummary } from '../../atlasProperty/selectors/atlasPropertyCompletenessSummary';
import type { AtlasPropertyImportResult, HandoffSource } from '../types/atlasPropertyHandoff.types';

// ─── Type narrowing ───────────────────────────────────────────────────────────

/**
 * Checks that a value has the minimum required shape to be treated as
 * AtlasPropertyV1.
 *
 * This is a structural guard, not a full JSON-schema validation.  The contracts
 * package does not yet export an AtlasPropertyV1 validator, so we check the
 * discriminating fields that are guaranteed by the contract:
 *   - version: '1.0'
 *   - propertyId (string)
 *   - status (string)
 *   - property (object)
 *   - building (object)
 *   - household (object)
 *   - currentSystem (object)
 *   - evidence (object)
 *   - capture (object)
 *   - sourceApps (array)
 */
function isAtlasPropertyV1(value: unknown): value is AtlasPropertyV1 {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v['version'] === '1.0' &&
    typeof v['propertyId'] === 'string' &&
    v['propertyId'].length > 0 &&
    typeof v['status'] === 'string' &&
    typeof v['property'] === 'object' && v['property'] !== null &&
    typeof v['building'] === 'object' && v['building'] !== null &&
    typeof v['household'] === 'object' && v['household'] !== null &&
    typeof v['currentSystem'] === 'object' && v['currentSystem'] !== null &&
    typeof v['evidence'] === 'object' && v['evidence'] !== null &&
    typeof v['capture'] === 'object' && v['capture'] !== null &&
    Array.isArray(v['sourceApps'])
  );
}

// ─── Warning derivation ───────────────────────────────────────────────────────

/**
 * Derive human-readable warnings from an AtlasPropertyV1 before import.
 *
 * These are soft concerns that the caller or arrival UI should surface for
 * review — they do not prevent the import from completing.
 */
function deriveImportWarnings(property: AtlasPropertyV1): string[] {
  const warnings: string[] = [];

  if (!property.property.postcode) {
    warnings.push('No postcode found — location-dependent engine results may be imprecise.');
  }

  const comp = property.household?.composition;
  if (!comp?.adultCount?.value) {
    warnings.push('Household adult count is missing — defaulting to 1 adult.');
  }

  const familyValue = property.currentSystem?.family?.value;
  if (!familyValue || familyValue === 'unknown') {
    warnings.push('Current system type is unknown — system-specific recommendations may be unavailable.');
  }

  const heatLoss = property.derived?.heatLoss?.peakWatts?.value;
  const hasRooms = (property.building?.rooms?.length ?? 0) > 0;
  if (!heatLoss && !hasRooms) {
    warnings.push('No heat loss figure and no building rooms — engine heat-loss results will rely on defaults.');
  }

  const dynPressure = property.derived?.hydraulics?.dynamicPressureBar?.value;
  const flow = property.derived?.hydraulics?.mainsFlowLpm?.value;
  if (!dynPressure && !flow) {
    warnings.push('No hydraulic measurements found — mains-pressure checks will use engine defaults.');
  }

  return warnings;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * importAtlasProperty — the single entry point for the canonical handoff path.
 *
 * Accepts any unknown value (parsed JSON from a handoff payload, fixture, or
 * manual paste) and returns an AtlasPropertyImportResult.
 *
 * Behaviour:
 *   1. Validate / narrow input to AtlasPropertyV1.
 *   2. Derive a partial EngineInputV2_3 via atlasPropertyToEngineInput().
 *   3. Derive a completeness summary via atlasPropertyCompletenessSummary().
 *   4. Collect any soft warnings.
 *   5. Return a clean typed result — no DB writes, no side-effects.
 *
 * @param input   Raw unknown value to narrow to AtlasPropertyV1.
 * @param source  The origin of the payload — defaults to 'manual_import'.
 * @returns       AtlasPropertyImportResult, or throws if input is not a valid
 *                AtlasPropertyV1 shape.
 *
 * @throws        Error if the input cannot be narrowed to AtlasPropertyV1.
 *                Callers should catch this and surface a user-facing error.
 *
 * Usage:
 *   try {
 *     const result = importAtlasProperty(parsedJson, 'atlas_scan_handoff');
 *     // result.completeness.readyForSimulation → gate engine run
 *   } catch (err) {
 *     // invalid payload
 *   }
 */
export function importAtlasProperty(
  input: unknown,
  source: HandoffSource = 'manual_import',
): AtlasPropertyImportResult {
  if (!isAtlasPropertyV1(input)) {
    throw new Error(
      'importAtlasProperty: input is not a valid AtlasPropertyV1 payload. ' +
      'Expected an object with version: "1.0", propertyId, status, property, ' +
      'building, household, currentSystem, evidence, capture, and sourceApps.',
    );
  }

  const atlasProperty = input;
  const engineInput = atlasPropertyToEngineInput(atlasProperty);
  const completeness = atlasPropertyCompletenessSummary(atlasProperty);
  const warnings = deriveImportWarnings(atlasProperty);

  return {
    atlasProperty,
    engineInput,
    completeness,
    warnings,
    source,
  };
}
