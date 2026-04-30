/**
 * LocalWorkspaceProvider.ts
 *
 * File-based (drive-local) implementation of WorkspaceProvider.
 *
 * Each visit is persisted as a JSON record in a dedicated Dexie (IndexedDB)
 * database named 'atlas-workspace'.  This database is separate from the
 * 'atlas-scan-share' database used by the scan session store so the two
 * concerns remain independent and do not share a version lock.
 *
 * Storage layout
 * ──────────────
 * Database  : 'atlas-workspace'
 * Version   : 1
 * Store     : visits
 *   - id           string   (primary key, UUID)
 *   - created_at   string   (ISO-8601, indexed)
 *   - updated_at   string   (ISO-8601, indexed)
 *   - status       string
 *   - payloadJson  string   (full VisitDetail JSON including working_payload)
 *
 * Why IndexedDB?
 * ─────────────
 * In a web environment, IndexedDB is the only reliable cross-browser
 * file-like storage mechanism that supports structured data without a
 * network round-trip.  The records can be exported to / imported from
 * JSON files at any time, giving engineers a familiar "save to drive"
 * mental model.
 *
 * Architecture rules
 * ──────────────────
 * - No dependency on visitApi.ts or any remote API client.
 * - No dependency on the legacy Insight / report pipeline.
 * - Pure async — all operations return Promises.
 */

import Dexie from 'dexie';
import type { WorkspaceProvider, CreateVisitOpts, VisitPatch } from './WorkspaceProvider';
import type { VisitMeta, VisitDetail } from '../visits/visitApi';

// ─── Internal stored record ───────────────────────────────────────────────────

interface StoredVisit {
  /** UUID — primary key */
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  customer_name: string | null;
  address_line_1: string | null;
  postcode: string | null;
  current_step: string | null;
  visit_reference: string | null;
  completed_at: string | null;
  completion_method: string | null;
  /** Full working_payload serialised as a JSON string */
  working_payload_json: string;
}

// ─── Dexie database ───────────────────────────────────────────────────────────

export class AtlasWorkspaceDb extends Dexie {
  visits!: Dexie.Table<StoredVisit, string>;

  constructor(dbName = 'atlas-workspace') {
    super(dbName);
    this.version(1).stores({
      // Index updated_at for ordered listing; index status for filter queries.
      visits: 'id, updated_at, status',
    });
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a stable, unique visit ID. */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments that do not support crypto.randomUUID.
  return `visit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Map a StoredVisit to the public VisitMeta shape (no working_payload). */
function toVisitMeta(stored: StoredVisit): VisitMeta {
  return {
    id: stored.id,
    created_at: stored.created_at,
    updated_at: stored.updated_at,
    status: stored.status,
    customer_name: stored.customer_name,
    address_line_1: stored.address_line_1,
    postcode: stored.postcode,
    current_step: stored.current_step,
    visit_reference: stored.visit_reference,
    completed_at: stored.completed_at,
    completion_method: stored.completion_method,
  };
}

/** Map a StoredVisit to the public VisitDetail shape (includes working_payload). */
function toVisitDetail(stored: StoredVisit): VisitDetail {
  let working_payload: Record<string, unknown> = {};
  try {
    working_payload = JSON.parse(stored.working_payload_json) as Record<string, unknown>;
  } catch {
    // Corrupt payload — return empty object so the caller can still render.
  }
  return {
    ...toVisitMeta(stored),
    working_payload,
  };
}

// ─── Implementation ───────────────────────────────────────────────────────────

/**
 * LocalWorkspaceProvider
 *
 * Stores visits as JSON records in IndexedDB ('atlas-workspace' database).
 * No network connection is required; all data lives on the device.
 *
 * This is the default WorkspaceProvider used by Atlas Mind.
 */
export class LocalWorkspaceProvider implements WorkspaceProvider {
  private readonly db: AtlasWorkspaceDb;

  constructor(db?: AtlasWorkspaceDb) {
    this.db = db ?? new AtlasWorkspaceDb();
  }

  /**
   * List all visits, most-recently-updated first (max 50).
   */
  async listVisits(): Promise<VisitMeta[]> {
    const rows = await this.db.visits
      .orderBy('updated_at')
      .reverse()
      .limit(50)
      .toArray();
    return rows.map(toVisitMeta);
  }

  /**
   * Fetch a single visit by ID including its working payload.
   * Throws "Visit not found" when the ID does not exist.
   */
  async getVisit(id: string): Promise<VisitDetail> {
    const stored = await this.db.visits.get(id);
    if (!stored) throw new Error('Visit not found');
    return toVisitDetail(stored);
  }

  /**
   * Create a new visit record.  Returns `{ ok: true, id }`.
   */
  async createVisit(opts: CreateVisitOpts = {}): Promise<{ ok: true; id: string }> {
    const id = generateId();
    const now = nowIso();
    const stored: StoredVisit = {
      id,
      created_at: now,
      updated_at: now,
      status: 'new',
      customer_name: opts.customer_name ?? null,
      address_line_1: opts.address_line_1 ?? null,
      postcode: opts.postcode ?? null,
      current_step: null,
      visit_reference: opts.visit_reference ?? null,
      completed_at: null,
      completion_method: null,
      working_payload_json: '{}',
    };
    await this.db.visits.add(stored);
    return { ok: true, id };
  }

  /**
   * Apply a partial update patch to an existing visit.
   * Throws "Visit not found" when the ID does not exist.
   */
  async saveVisit(id: string, patch: VisitPatch): Promise<void> {
    const existing = await this.db.visits.get(id);
    if (!existing) throw new Error('Visit not found');

    const updated: StoredVisit = { ...existing, updated_at: nowIso() };

    if (patch.customer_name !== undefined)   updated.customer_name   = patch.customer_name ?? null;
    if (patch.address_line_1 !== undefined)  updated.address_line_1  = patch.address_line_1 ?? null;
    if (patch.postcode !== undefined)        updated.postcode        = patch.postcode ?? null;
    if (patch.current_step !== undefined)    updated.current_step    = patch.current_step ?? null;
    if (patch.status !== undefined)          updated.status          = patch.status;
    if (patch.visit_reference !== undefined) updated.visit_reference = patch.visit_reference ?? null;
    if (patch.completed_at !== undefined)    updated.completed_at    = patch.completed_at ?? null;
    if (patch.completion_method !== undefined) updated.completion_method = patch.completion_method ?? null;
    if (patch.working_payload !== undefined) {
      updated.working_payload_json = JSON.stringify(patch.working_payload);
    }

    await this.db.visits.put(updated);
  }

  /**
   * Permanently delete a visit record.
   * Throws "Visit not found" when the ID does not exist.
   */
  async deleteVisit(id: string): Promise<void> {
    const existing = await this.db.visits.get(id);
    if (!existing) throw new Error('Visit not found');
    await this.db.visits.delete(id);
  }
}
