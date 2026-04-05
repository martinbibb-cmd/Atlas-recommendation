/**
 * scanContracts.ts
 *
 * @deprecated
 * This file is a compatibility shim.  The canonical source of truth for all
 * scan-bundle contract types, version constants, and helpers is now the shared
 * `@atlas/contracts` package.
 *
 * Import directly from `@atlas/contracts` instead:
 *
 *   import type { ScanBundleV1, ScanRoom, … } from '@atlas/contracts';
 *   import { SUPPORTED_SCAN_BUNDLE_VERSIONS } from '@atlas/contracts';
 *
 * This file will be removed in a future cleanup pass once all internal
 * consumers have been migrated.
 */

export type {
  ScanCoordinateConvention,
  ScanConfidenceBand,
  ScanQAFlag,
  ScanPoint2D,
  ScanPoint3D,
  ScanOpening,
  ScanWall,
  ScanDetectedObject,
  ScanAnchor,
  ScanRoom,
  ScanMeta,
  ScanBundleV1,
  ScanBundle,
  UnknownScanBundle,
} from '@atlas/contracts';

export { SUPPORTED_SCAN_BUNDLE_VERSIONS } from '@atlas/contracts';
export type { ScanBundleVersion } from '@atlas/contracts';
