/**
 * VisitWorkspaceV1.ts
 *
 * Type definitions for a locally-stored visit workspace record.
 *
 * A VisitWorkspaceV1 wraps a single SessionCaptureV2 capture together with
 * per-item review decisions.  It lives entirely in IndexedDB (the
 * 'atlas-visit-workspace' database) and is never written to the remote D1
 * database unless the engineer explicitly publishes it.
 *
 * Storage layout:
 *   Database  : 'atlas-visit-workspace'
 *   Version   : 1
 *   Store     : workspaces (indexed by id, importedAt, visitReference)
 *
 * Lifecycle statuses:
 *   needs_review     — imported but evidence has not been reviewed yet
 *   ready_for_report — all evidence reviewed; outputs can be generated
 *   published        — visit has been published to Atlas / a portal link exists
 *
 * Storage type signals:
 *   local            — stored only in this browser's IndexedDB
 *   drive            — has been synchronised to Google Drive or OneDrive
 */

import type { SessionCaptureV2 } from '../../features/scanImport/contracts/sessionCaptureV2';

// ─── Review decision ──────────────────────────────────────────────────────────

/**
 * Per-item review decision persisted alongside the workspace.
 *
 * `ref`   — the stable entity ID (photoId, pinId, snapshotId, etc.)
 * `kind`  — discriminant to distinguish the entity type
 * `reviewStatus`           — 'pending' | 'confirmed' | 'rejected'
 * `includeInCustomerReport` — whether to surface in customer-facing outputs
 */
export interface VisitWorkspaceReviewDecision {
  ref: string;
  kind: 'photo' | 'object_pin' | 'floor_plan_snapshot' | 'voice_note' | 'room';
  reviewStatus: 'pending' | 'confirmed' | 'rejected';
  includeInCustomerReport: boolean;
}

// ─── Storage type ─────────────────────────────────────────────────────────────

/** Where the workspace is currently stored. */
export type WorkspaceStorageType = 'local' | 'drive';

// ─── Workspace status ─────────────────────────────────────────────────────────

/** Lifecycle status of the workspace. */
export type WorkspaceStatus =
  | 'needs_review'
  | 'ready_for_report'
  | 'published';

// ─── Top-level record ─────────────────────────────────────────────────────────

/**
 * VisitWorkspaceV1 — the top-level local workspace record.
 *
 * One workspace per imported capture session.  The raw SessionCaptureV2
 * payload is stored inline (as a JSON string in IDB) so the workspace is
 * self-contained and portable.
 */
export interface VisitWorkspaceV1 {
  /** Stable workspace UUID, assigned at import time. */
  id: string;

  /**
   * Human-readable visit reference, derived from the session capture.
   * Defaults to the sessionId when `visitReference` is absent in the capture.
   */
  visitReference: string;

  /** When the workspace was first imported into the browser. */
  importedAt: string;

  /** ISO-8601 `capturedAt` from the SessionCaptureV2 header. */
  capturedAt: string;

  /** Storage location for this workspace record. */
  storageType: WorkspaceStorageType;

  /** Workspace lifecycle status. */
  status: WorkspaceStatus;

  /**
   * The raw validated SessionCaptureV2 payload.
   * Stored as-is so all evidence is available without a round-trip.
   */
  sessionCapture: SessionCaptureV2;

  /**
   * Per-item review decisions.
   * Mutated by the engineer on the Capture Evidence Review Screen.
   */
  reviewDecisions: VisitWorkspaceReviewDecision[];

  /**
   * Optional property metadata derived from the session capture.
   * Shown in the workspace header and on the detail page.
   */
  property?: {
    address?: string;
    postcode?: string;
  };
}

// ─── Summary shape (no session capture payload) ───────────────────────────────

/**
 * WorkspaceSummary — a lightweight summary of a workspace record.
 *
 * Used in list views to avoid deserialising the full session capture
 * for every row.
 */
export interface WorkspaceSummary {
  id: string;
  visitReference: string;
  importedAt: string;
  capturedAt: string;
  storageType: WorkspaceStorageType;
  status: WorkspaceStatus;
  roomCount: number;
  photoCount: number;
  property?: { address?: string; postcode?: string };
}
