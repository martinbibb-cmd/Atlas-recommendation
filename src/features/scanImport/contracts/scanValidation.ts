/**
 * scanValidation.ts
 *
 * @deprecated
 * This file is a compatibility shim.  The canonical source of truth for all
 * scan-bundle validation logic is now the shared `@atlas/contracts` package.
 *
 * Import directly from `@atlas/contracts` instead:
 *
 *   import { validateScanBundle, isUnsupportedVersion } from '@atlas/contracts';
 *   import type { ScanValidationResult } from '@atlas/contracts';
 *
 * This file will be removed in a future cleanup pass once all internal
 * consumers have been migrated.
 */

export { validateScanBundle, isUnsupportedVersion } from '@atlas/contracts';
export type {
  ScanValidationResult,
  ScanValidationSuccess,
  ScanValidationFailure,
} from '@atlas/contracts';
