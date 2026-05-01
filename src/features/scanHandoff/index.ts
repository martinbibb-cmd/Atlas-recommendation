/**
 * src/features/scanHandoff/index.ts
 *
 * Public barrel for the scanHandoff feature.
 *
 * Exports:
 *   Types:
 *     - AtlasVisitV1
 *     - ScanToMindHandoffV1
 *     - ScanToMindHandoffV1ValidationResult
 *     - ReceiveScanHandoffResult
 *
 *   Functions:
 *     - validateScanToMindHandoffV1()
 *     - receiveScanHandoff()
 *     - storeScanCapture()
 *     - getScanCapture()
 *     - removeScanCapture()
 *     - listScanCaptures()
 *     - clearScanHandoffStore()
 *
 *   Hooks:
 *     - useScanCaptureForVisit()
 *
 *   Components:
 *     - ScanHandoffReceivePage
 *
 * Architecture notes
 * ──────────────────
 * @atlas/contracts types (SessionCaptureV2, etc.) are NOT re-exported here —
 * consumers should import them directly from their source to avoid creating a
 * local shadow of the shared contract surface.
 */

// ─── Contract types ───────────────────────────────────────────────────────────

export type { AtlasVisitV1 } from './contracts/AtlasVisitV1';
export { isAtlasVisitV1 } from './contracts/AtlasVisitV1';

export type {
  ScanToMindHandoffV1,
  ScanToMindHandoffV1ValidationResult,
  ScanToMindHandoffV1ValidationSuccess,
  ScanToMindHandoffV1ValidationFailure,
} from './contracts/ScanToMindHandoffV1';
export {
  SCAN_TO_MIND_HANDOFF_KIND,
  validateScanToMindHandoffV1,
} from './contracts/ScanToMindHandoffV1';

// ─── Receive logic ────────────────────────────────────────────────────────────

export type { ReceiveScanHandoffResult } from './receiveScanHandoff';
export { receiveScanHandoff } from './receiveScanHandoff';

// ─── Storage helpers ──────────────────────────────────────────────────────────

export {
  SCAN_HANDOFF_STORAGE_KEY,
  storeScanCapture,
  getScanCapture,
  removeScanCapture,
  listScanCaptures,
  clearScanHandoffStore,
} from './scanHandoffStore';

// ─── React hook ───────────────────────────────────────────────────────────────

export { useScanCaptureForVisit } from './useScanCaptureForVisit';

// ─── UI ───────────────────────────────────────────────────────────────────────

export type { ScanHandoffReceivePageProps } from './ScanHandoffReceivePage';
export { ScanHandoffReceivePage } from './ScanHandoffReceivePage';
