import type { ScanBundleV1, ScanDetectedObject } from '@atlas/contracts';
import type { CanonicalFloorPlanDraft } from '../importer/scanMapper';

export type SessionScanState = 'scanning' | 'scanned' | 'reviewed' | 'needs_attention' | 'blocked_incomplete';
export type SessionReviewState = 'scanned' | 'reviewed' | 'needs_attention' | 'blocked_incomplete';
export type SessionSyncState = 'local_only' | 'queued_for_atlas' | 'uploaded' | 'failed_upload' | 'archived_remote';

export interface TaggedObject {
  id: string;
  category: string;
  label: string;
  roomId?: string;
  position: { x: number; y: number; z: number };
  dimensions: { width: number; depth: number; height: number };
  confidence: 'high' | 'medium' | 'low';
  linkedPhotoIds: string[];
  linkedIssueIds: string[];
  clearanceProfileId?: string;
}

export interface CapturedPhoto {
  id: string;
  localFileURL: string;
  capturedAt: string;
  roomId?: string;
  taggedObjectId?: string;
  issueTag?: string;
  note?: string;
  cameraPose?: { x: number; y: number; z: number; yawDeg?: number; pitchDeg?: number; rollDeg?: number };
  syncState: SessionSyncState;
  remoteAssetId?: string;
}

export interface ValidationIssue {
  id: string;
  severity: 'warning' | 'error';
  code: string;
  message: string;
  relatedRoomId?: string;
  relatedObjectId?: string;
}

export interface PropertyScanSession {
  id: string;
  jobReference: string;
  propertyAddress: string;
  createdAt: string;
  updatedAt: string;
  scanState: SessionScanState;
  reviewState: SessionReviewState;
  syncState: SessionSyncState;
  floors: CanonicalFloorPlanDraft['floors'];
  rooms: CanonicalFloorPlanDraft['floors'][number]['rooms'];
  taggedObjects: TaggedObject[];
  photos: CapturedPhoto[];
  issues: ValidationIssue[];
}

function objectToTaggedObject(object: ScanDetectedObject, roomId: string): TaggedObject {
  return {
    id: object.id,
    category: object.category,
    label: object.label,
    roomId,
    position: {
      x: (object.boundingBox.minX + object.boundingBox.maxX) / 2,
      y: (object.boundingBox.minY + object.boundingBox.maxY) / 2,
      z: (object.boundingBox.minZ + object.boundingBox.maxZ) / 2,
    },
    dimensions: {
      width: Math.max(0, object.boundingBox.maxX - object.boundingBox.minX),
      depth: Math.max(0, object.boundingBox.maxY - object.boundingBox.minY),
      height: Math.max(0, object.boundingBox.maxZ - object.boundingBox.minZ),
    },
    confidence: object.confidence,
    linkedPhotoIds: [],
    linkedIssueIds: [],
  };
}

export function buildPropertyScanSession(bundle: ScanBundleV1, draft: CanonicalFloorPlanDraft): PropertyScanSession {
  const createdAt = bundle.meta.capturedAt;
  const updatedAt = new Date().toISOString();
  const rooms = draft.floors.flatMap((floor) => floor.rooms);

  const sourceRoomById = new Map(bundle.rooms.map((room) => [room.id, room]));
  const taggedObjects: TaggedObject[] = [];
  for (const room of rooms) {
    const source = sourceRoomById.get(room.id);
    if (!source) continue;
    taggedObjects.push(...source.detectedObjects.map((object) => objectToTaggedObject(object, room.id)));
  }

  return {
    id: bundle.bundleId,
    jobReference: bundle.meta.propertyRef ?? bundle.bundleId,
    propertyAddress: bundle.meta.propertyRef ?? 'Unknown property',
    createdAt,
    updatedAt,
    scanState: 'scanned',
    reviewState: 'scanned',
    syncState: 'local_only',
    floors: draft.floors,
    rooms,
    taggedObjects,
    photos: [],
    issues: [],
  };
}
