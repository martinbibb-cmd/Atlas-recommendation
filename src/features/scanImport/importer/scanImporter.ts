/**
 * scanImporter.ts
 *
 * Main importer entry point: validate → normalise → map → result.
 *
 * This is the only module that should be called by the rest of Atlas when
 * consuming scan bundle data.  It returns a typed ScanImportResult that the
 * caller can match against to obtain the canonical floor-plan draft or handle
 * rejection gracefully.
 *
 * IMPORTANT architecture rules:
 *   - Do NOT call this function and then pass raw ScanBundle types further.
 *   - The draft in a 'success' result contains only canonical Atlas entities.
 *   - Recommendation / simulation state is never touched here.
 */

import { validateScanBundle, isUnsupportedVersion, SUPPORTED_SCAN_BUNDLE_VERSIONS } from '@atlas/contracts';
import { normaliseScanCoordinates } from './scanNormaliser';
import {
  mapScanBundleToFloorPlanDraft,
  buildProvenanceSummary,
  type CanonicalFloorPlanDraft,
  type ScanImportWarning,
  type ProvenanceSummary,
} from './scanMapper';
import { buildPropertyScanSession, type PropertyScanSession } from '../session/propertyScanSession';

// ─── Result type ──────────────────────────────────────────────────────────────

/**
 * ScanImportResult — discriminated union returned by importScanBundle.
 *
 * success
 *   The bundle was valid and all entities were mapped without warnings.
 *
 * success_with_warnings
 *   The bundle was valid and entities were mapped, but some confidence,
 *   type inference or QA issues were detected.  The draft is still usable;
 *   the warnings should be shown to the user for review.
 *
 * rejected_invalid
 *   The bundle failed structural or schema validation.
 *
 * rejected_unsupported_version
 *   The bundle's version field is not in SUPPORTED_SCAN_BUNDLE_VERSIONS.
 */
export type ScanImportResult =
  | {
      status: 'success';
      draft: CanonicalFloorPlanDraft;
      session: PropertyScanSession;
      warnings: [];
      provenanceSummary: ProvenanceSummary;
    }
  | {
      status: 'success_with_warnings';
      draft: CanonicalFloorPlanDraft;
      session: PropertyScanSession;
      warnings: ScanImportWarning[];
      provenanceSummary: ProvenanceSummary;
    }
  | {
      status: 'rejected_invalid';
      errors: string[];
    }
  | {
      status: 'rejected_unsupported_version';
      version: string;
      supportedVersions: string[];
    };

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * importScanBundle — the single entry point for ingesting a scan bundle.
 *
 * Accepts any unknown value (e.g. parsed JSON from a fixture file or network
 * response) and returns a ScanImportResult.
 *
 * Usage:
 *   const result = importScanBundle(parsedJson);
 *   switch (result.status) {
 *     case 'success':
 *     case 'success_with_warnings':
 *       // use result.draft and result.provenanceSummary
 *       break;
 *     case 'rejected_invalid':
 *       // handle result.errors
 *       break;
 *     case 'rejected_unsupported_version':
 *       // inform user of version mismatch
 *       break;
 *   }
 */
export function importScanBundle(input: unknown): ScanImportResult {
  // 1. Check for unsupported version before full validation so we can surface
  //    a clearer rejection reason.
  if (isUnsupportedVersion(input)) {
    const raw = input as Record<string, unknown>;
    return {
      status: 'rejected_unsupported_version',
      version: String(raw['version'] ?? ''),
      supportedVersions: [...SUPPORTED_SCAN_BUNDLE_VERSIONS],
    };
  }

  // 2. Full structural validation.
  const validationResult = validateScanBundle(input);
  if (!validationResult.ok) {
    return { status: 'rejected_invalid', errors: validationResult.errors };
  }

  const bundle = validationResult.bundle;

  // 3. Normalise coordinates from scan space → Atlas canvas units.
  const normalisedBundle = normaliseScanCoordinates(bundle);

  // 4. Map to canonical floor-plan draft entities.
  const { draft, warnings } = mapScanBundleToFloorPlanDraft(normalisedBundle);
  const session = buildPropertyScanSession(normalisedBundle, draft);

  // 5. Build provenance summary.
  const provenanceSummary = buildProvenanceSummary(normalisedBundle, draft);

  // 6. Return typed result.
  if (warnings.length === 0) {
    return {
      status: 'success',
      draft,
      session,
      warnings: [],
      provenanceSummary,
    };
  }

  return {
    status: 'success_with_warnings',
    draft,
    session,
    warnings,
    provenanceSummary,
  };
}
