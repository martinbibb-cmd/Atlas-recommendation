/**
 * VisitWorkspaceStore.ts
 *
 * Dexie (IndexedDB) store for VisitWorkspaceV1 records.
 *
 * Database : 'atlas-visit-workspace'
 * Version  : 1
 * Store    : workspaces
 *   - id             string  (primary key, UUID)
 *   - importedAt     string  (ISO-8601, indexed for ordered listing)
 *   - visitReference string  (indexed for lookups)
 *   - status         string  (indexed for filter queries)
 *   - payloadJson    string  (full VisitWorkspaceV1 JSON — keeps IDB schema flat)
 *
 * No remote API is called at any point.  All data lives in the browser's
 * IndexedDB until the engineer explicitly publishes via the Publish action.
 *
 * Architecture rules:
 *   - This store is completely independent of visitApi.ts and the remote D1 DB.
 *   - Callers receive plain VisitWorkspaceV1 / WorkspaceSummary objects.
 *   - Import never triggers a fetch() to any /api/ endpoint.
 */

import Dexie from 'dexie';
import type {
  VisitWorkspaceV1,
  WorkspaceSummary,
  VisitWorkspaceReviewDecision,
} from './VisitWorkspaceV1';
import type { SessionCaptureV2 } from '../../features/scanImport/contracts/sessionCaptureV2';

// ─── Internal stored record ───────────────────────────────────────────────────

interface StoredWorkspace {
  /** UUID primary key */
  id: string;
  importedAt: string;
  visitReference: string;
  status: string;
  /** Full VisitWorkspaceV1 serialised as JSON */
  payloadJson: string;
}

// ─── Dexie database ───────────────────────────────────────────────────────────

export class AtlasVisitWorkspaceDb extends Dexie {
  workspaces!: Dexie.Table<StoredWorkspace, string>;

  constructor(dbName = 'atlas-visit-workspace') {
    super(dbName);
    this.version(1).stores({
      workspaces: 'id, importedAt, visitReference, status',
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nowIso(): string {
  return new Date().toISOString();
}

function generateId(): string {
  return crypto.randomUUID();
}

function toStoredRecord(w: VisitWorkspaceV1): StoredWorkspace {
  return {
    id: w.id,
    importedAt: w.importedAt,
    visitReference: w.visitReference,
    status: w.status,
    payloadJson: JSON.stringify(w),
  };
}

function fromStoredRecord(stored: StoredWorkspace): VisitWorkspaceV1 {
  try {
    return JSON.parse(stored.payloadJson) as VisitWorkspaceV1;
  } catch {
    // Corrupt payload — return a minimal shell so the caller can handle gracefully.
    return {
      id: stored.id,
      visitReference: stored.visitReference,
      importedAt: stored.importedAt,
      capturedAt: stored.importedAt,
      storageType: 'local',
      status: 'needs_review',
      sessionCapture: {
        version: '2.0',
        sessionId: stored.id,
        capturedAt: stored.importedAt,
        exportedAt: stored.importedAt,
        deviceModel: 'unknown',
        roomScans: [],
        photos: [],
        voiceNotes: [],
        objectPins: [],
        floorPlanSnapshots: [],
        qaFlags: [],
      },
      reviewDecisions: [],
    };
  }
}

function toSummary(w: VisitWorkspaceV1): WorkspaceSummary {
  return {
    id: w.id,
    visitReference: w.visitReference,
    importedAt: w.importedAt,
    capturedAt: w.capturedAt,
    storageType: w.storageType,
    status: w.status,
    roomCount: w.sessionCapture.roomScans.length,
    photoCount: w.sessionCapture.photos.length,
    property: w.property,
  };
}

/** Build the initial review decisions for a freshly imported capture. */
function buildInitialReviewDecisions(
  capture: SessionCaptureV2,
): VisitWorkspaceReviewDecision[] {
  const decisions: VisitWorkspaceReviewDecision[] = [];

  for (const photo of capture.photos) {
    const customerSafe = photo.scope === 'session' || photo.scope === 'room';
    decisions.push({
      ref: photo.photoId,
      kind: 'photo',
      reviewStatus: 'confirmed',
      includeInCustomerReport: customerSafe,
    });
  }

  for (const pin of capture.objectPins) {
    const lidarInferred = pin.metadata?.['inferredByLidar'] === true;
    decisions.push({
      ref: pin.pinId,
      kind: 'object_pin',
      reviewStatus: lidarInferred ? 'pending' : 'confirmed',
      includeInCustomerReport: false,
    });
  }

  for (const snap of capture.floorPlanSnapshots) {
    decisions.push({
      ref: snap.snapshotId,
      kind: 'floor_plan_snapshot',
      reviewStatus: 'confirmed',
      includeInCustomerReport: true,
    });
  }

  for (const vn of capture.voiceNotes) {
    decisions.push({
      ref: vn.voiceNoteId,
      kind: 'voice_note',
      reviewStatus: 'confirmed',
      includeInCustomerReport: false,
    });
  }

  return decisions;
}

// ─── Store class ──────────────────────────────────────────────────────────────

/**
 * VisitWorkspaceStore
 *
 * All CRUD for local visit workspaces.  No network calls are made.
 */
export class VisitWorkspaceStore {
  private readonly db: AtlasVisitWorkspaceDb;

  constructor(db?: AtlasVisitWorkspaceDb) {
    this.db = db ?? new AtlasVisitWorkspaceDb();
  }

  /**
   * Import a validated SessionCaptureV2 as a new local workspace.
   *
   * Creates a VisitWorkspaceV1 record with initialised review_decisions
   * and stores it in IndexedDB.  No remote API is called.
   *
   * Returns the new workspace's ID.
   */
  async importCapture(capture: SessionCaptureV2): Promise<string> {
    const id = generateId();
    const now = nowIso();

    const workspace: VisitWorkspaceV1 = {
      id,
      visitReference: capture.visitReference ?? capture.sessionId,
      importedAt: now,
      capturedAt: capture.capturedAt,
      storageType: 'local',
      status: 'needs_review',
      sessionCapture: capture,
      reviewDecisions: buildInitialReviewDecisions(capture),
      property: capture.property
        ? { address: capture.property.address, postcode: capture.property.postcode }
        : undefined,
    };

    await this.db.workspaces.add(toStoredRecord(workspace));
    return id;
  }

  /**
   * List all workspaces as lightweight summaries, most-recently-imported first.
   * Returns an empty array when no workspaces exist.
   */
  async listSummaries(): Promise<WorkspaceSummary[]> {
    const rows = await this.db.workspaces
      .orderBy('importedAt')
      .reverse()
      .limit(50)
      .toArray();
    return rows.map((r) => toSummary(fromStoredRecord(r)));
  }

  /**
   * Fetch the full workspace record by ID.
   * Throws 'Workspace not found' when the ID does not exist.
   */
  async getWorkspace(id: string): Promise<VisitWorkspaceV1> {
    const stored = await this.db.workspaces.get(id);
    if (!stored) throw new Error('Workspace not found');
    return fromStoredRecord(stored);
  }

  /**
   * Update the review decisions for an existing workspace and advance its
   * status to 'ready_for_report' when all items are confirmed or rejected.
   */
  async saveReviewDecisions(
    id: string,
    decisions: VisitWorkspaceReviewDecision[],
  ): Promise<void> {
    const workspace = await this.getWorkspace(id);
    workspace.reviewDecisions = decisions;

    // Auto-advance status when all items are reviewed.
    const hasPending = decisions.some((d) => d.reviewStatus === 'pending');
    if (!hasPending && workspace.status === 'needs_review') {
      workspace.status = 'ready_for_report';
    }

    await this.db.workspaces.put(toStoredRecord(workspace));
  }

  /**
   * Update workspace status directly (e.g. to 'published').
   * Throws 'Workspace not found' when the ID does not exist.
   */
  async updateStatus(
    id: string,
    status: VisitWorkspaceV1['status'],
  ): Promise<void> {
    const workspace = await this.getWorkspace(id);
    workspace.status = status;
    await this.db.workspaces.put(toStoredRecord(workspace));
  }

  /**
   * Delete a workspace by ID.
   * Throws 'Workspace not found' when the ID does not exist.
   */
  async deleteWorkspace(id: string): Promise<void> {
    const existing = await this.db.workspaces.get(id);
    if (!existing) throw new Error('Workspace not found');
    await this.db.workspaces.delete(id);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

/**
 * Shared VisitWorkspaceStore singleton.
 *
 * All workspace UI surfaces should import this value rather than
 * instantiating their own store, matching the pattern used by defaultWorkspace.
 */
export const visitWorkspaceStore = new VisitWorkspaceStore();
