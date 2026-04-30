/**
 * WorkspaceProvider.ts
 *
 * Abstraction layer that decouples Atlas Mind from a specific visit-persistence
 * backend.  All visit CRUD operations in the application must go through a
 * WorkspaceProvider rather than calling the remote API directly.
 *
 * Two implementations are provided:
 *   - LocalWorkspaceProvider  — file-based, IndexedDB-backed (default)
 *   - RemoteWorkspaceProvider — thin wrapper around the Cloudflare /api/visits
 *     endpoints (legacy / server-connected mode)
 *
 * Design rules
 * ────────────
 * - This interface mirrors the shape of the existing visitApi.ts helpers so
 *   the call-sites can be migrated with minimal churn.
 * - The interface is intentionally free of implementation details; callers
 *   must not cast to a concrete type.
 * - All methods return Promises and must never throw synchronously.
 */

import type { VisitMeta, VisitDetail } from '../visits/visitApi';

// ─── Re-export shared visit types ─────────────────────────────────────────────

export type { VisitMeta, VisitDetail };

// ─── createVisit options ──────────────────────────────────────────────────────

export interface CreateVisitOpts {
  customer_name?: string;
  address_line_1?: string;
  postcode?: string;
  visit_reference?: string;
}

// ─── saveVisit patch ──────────────────────────────────────────────────────────

export interface VisitPatch {
  customer_name?: string;
  address_line_1?: string;
  postcode?: string;
  current_step?: string;
  status?: string;
  visit_reference?: string;
  working_payload?: Record<string, unknown>;
  /** ISO-8601 timestamp written when the engineer formally completes the visit. */
  completed_at?: string;
  /** Records how the visit was completed, e.g. 'manual_pwa'. */
  completion_method?: string;
}

// ─── WorkspaceProvider interface ──────────────────────────────────────────────

/**
 * All visit persistence operations in Atlas Mind are routed through this
 * interface.  Swap the concrete implementation to change the storage backend
 * without touching any of the call-sites.
 */
export interface WorkspaceProvider {
  /**
   * List all visits in the workspace, ordered most-recently-updated first.
   * Returns an empty array when no visits exist (never throws on empty).
   */
  listVisits(): Promise<VisitMeta[]>;

  /**
   * Fetch a single visit record including its working payload.
   * Throws with message "Visit not found" when the id does not exist.
   */
  getVisit(id: string): Promise<VisitDetail>;

  /**
   * Create a new visit record and return its generated ID.
   */
  createVisit(opts?: CreateVisitOpts): Promise<{ ok: true; id: string }>;

  /**
   * Apply a partial update to an existing visit.
   * Throws with message "Visit not found" when the id does not exist.
   */
  saveVisit(id: string, patch: VisitPatch): Promise<void>;

  /**
   * Permanently delete a visit record.
   * Throws with message "Visit not found" when the id does not exist.
   */
  deleteVisit(id: string): Promise<void>;
}
