/**
 * src/features/visits/createAtlasVisit.ts
 *
 * Visit model helpers for Atlas Mind.
 *
 * Builds an AtlasVisit identity object that carries a server-issued visitId
 * and an attached brandId.  This is the canonical in-memory representation of
 * a visit created by Mind — it is not the full VisitMeta returned by the API.
 *
 * Design rules
 * ────────────
 * - No side-effects.  The factory only constructs the object.
 * - brandId falls back to DEFAULT_BRAND_ID when not supplied.
 * - visitId comes from the caller (typically the POST /api/visits response).
 */

import { DEFAULT_BRAND_ID } from '../branding';
import type { VisitStorageTarget } from '../../auth/profile/AtlasVisitOwnershipV1';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Lightweight identity carried by Atlas Mind for the duration of a visit
 * session.  Consumed by VisitProvider and persisted by visitStore.
 */
export interface AtlasVisit {
  /** Server-issued stable visit identifier (e.g. "visit_abc123"). */
  visitId: string;

  /**
   * Brand identifier attached at visit creation time.
   * Controls white-label theming and output settings for this visit.
   * Defaults to "atlas-default" when not specified.
   */
  brandId: string;

  /** ISO-8601 timestamp of when the visit object was created on this device. */
  createdAt: string;

  /**
   * Optional userId of the engineer who created the visit.
   * Set from the active user profile when available.
   * Never exposed to analytics without explicit opt-in.
   */
  createdByUserId?: string;

  /** Authenticated Atlas user identity for this visit (Mind source of truth). */
  atlasUserId?: string;

  /** Workspace owning this visit (Mind source of truth). */
  workspaceId?: string;

  /** Visit-level storage target resolved from workspace/session context. */
  storageTarget?: VisitStorageTarget;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Constructs an AtlasVisit from a server-issued visitId and optional options.
 *
 * @param visitId           - The stable visit ID returned by POST /api/visits.
 * @param brandId           - Optional brand to attach.  Falls back to DEFAULT_BRAND_ID.
 * @param createdByUserId   - Optional userId of the engineer creating the visit.
 * @returns                 A fully-populated AtlasVisit ready for context / storage.
 */
export function createAtlasVisit(
  visitId: string,
  brandId?: string,
  createdByUserId?: string,
  identity?: { atlasUserId?: string; workspaceId?: string; storageTarget?: VisitStorageTarget },
): AtlasVisit {
  return {
    visitId,
    brandId: brandId ?? DEFAULT_BRAND_ID,
    createdAt: new Date().toISOString(),
    ...(createdByUserId !== undefined ? { createdByUserId } : {}),
    ...(identity?.atlasUserId !== undefined ? { atlasUserId: identity.atlasUserId } : {}),
    ...(identity?.workspaceId !== undefined ? { workspaceId: identity.workspaceId } : {}),
    ...(identity?.storageTarget !== undefined ? { storageTarget: identity.storageTarget } : {}),
  };
}
