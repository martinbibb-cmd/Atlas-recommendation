/**
 * src/features/scanEvidence/index.ts
 *
 * Public barrel for the scanEvidence feature.
 *
 * Exports all viewer components, badge components, and the selector/helper
 * layer.  The primary consumer is EngineerPreinstallPage which renders
 * ScanEvidenceSummary when a scan capture exists for the active visit.
 *
 * Architecture notes
 * ──────────────────
 * - Viewer only: no engine calls, no physics, no recommendations.
 * - Consumes SessionCaptureV2 from the scanHandoff store (PR 6).
 * - Does not mutate captured evidence.
 * - SessionCaptureV2 contract types are NOT re-exported — consumers should
 *   import them directly from scanImport/contracts/sessionCaptureV2.
 */

// ─── Top-level viewer ─────────────────────────────────────────────────────────

export type { ScanEvidenceSummaryProps } from './ScanEvidenceSummary';
export { ScanEvidenceSummary } from './ScanEvidenceSummary';

// ─── Section components ───────────────────────────────────────────────────────

export type { ScanRoomListProps } from './ScanRoomList';
export { ScanRoomList } from './ScanRoomList';

export type { ScanPhotoEvidenceGridProps } from './ScanPhotoEvidenceGrid';
export { ScanPhotoEvidenceGrid } from './ScanPhotoEvidenceGrid';

export type { ScanTranscriptPanelProps } from './ScanTranscriptPanel';
export { ScanTranscriptPanel } from './ScanTranscriptPanel';

export type { ScanObjectPinListProps } from './ScanObjectPinList';
export { ScanObjectPinList } from './ScanObjectPinList';

export type { ScanPipeRouteListProps } from './ScanPipeRouteList';
export { ScanPipeRouteList } from './ScanPipeRouteList';

export type { ScanPointCloudAssetListProps } from './ScanPointCloudAssetList';
export { ScanPointCloudAssetList } from './ScanPointCloudAssetList';

export type { ScanFabricEvidencePanelProps } from './ScanFabricEvidencePanel';
export { ScanFabricEvidencePanel } from './ScanFabricEvidencePanel';

export type { ScanHazardObservationPanelProps } from './ScanHazardObservationPanel';
export { ScanHazardObservationPanel } from './ScanHazardObservationPanel';

export type { ScanPreinstallSignalsProps } from './ScanPreinstallSignals';
export { ScanPreinstallSignals } from './ScanPreinstallSignals';

// ─── Badge components ─────────────────────────────────────────────────────────

export type { ReviewStatusBadgeProps, ReviewStatus } from './ReviewStatusBadge';
export { ReviewStatusBadge } from './ReviewStatusBadge';

export type { ProvenanceBadgeProps } from './ProvenanceBadge';
export { ProvenanceBadge } from './ProvenanceBadge';

export type { AnchorConfidenceBadgeProps } from './AnchorConfidenceBadge';
export { AnchorConfidenceBadge } from './AnchorConfidenceBadge';

// ─── Selectors ────────────────────────────────────────────────────────────────

export type {
  ScanEvidenceCounts,
  AnchorConfidenceTier,
  RoomScanV2,
  PhotoV2,
  VoiceNoteV2,
  ObjectPinV2,
  FloorPlanSnapshotV2,
  QaFlagV2,
  FloorPlanFabricCaptureV1,
  FabricBoundaryV1,
  HazardObservationCaptureV1,
  HazardSoftWarningEntry,
} from './scanEvidenceSelectors';

export {
  isLidarInferred,
  selectRooms,
  selectPhotos,
  selectPhotosByRoom,
  selectPhotosByPin,
  selectVoiceNotes,
  selectTranscripts,
  selectObjectPins,
  selectPipeRoutes,
  selectPointCloudAssets,
  selectQaFlags,
  selectEvidenceCounts,
  deriveSessionConfidence,
  deriveEntityConfidence,
  getFabricEvidenceSummary,
  getConfirmedFabricBoundaries,
  getCustomerSafeFabricEvidence,
  getFabricConfidenceSignals,
  getHazardEvidenceSummary,
  getHazardSoftWarnings,
  getHazardSoftWarningEntries,
  hasBlockingHazard,
} from './scanEvidenceSelectors';
