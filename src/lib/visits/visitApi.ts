/**
 * visitApi.ts
 *
 * Thin API client for Atlas visit endpoints.
 * All functions return the parsed JSON response or throw on network errors.
 */

export interface VisitMeta {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  customer_name: string | null;
  address_line_1: string | null;
  postcode: string | null;
  current_step: string | null;
  visit_reference: string | null;
}

/**
 * Canonical visit status progression.
 *
 * new → survey_started → recommendation_ready → quoted → installed
 *
 * Legacy values ('draft', 'complete') are mapped to their nearest canonical
 * equivalents for display purposes.
 */
export type VisitStatusKey =
  | 'new'
  | 'survey_started'
  | 'recommendation_ready'
  | 'quoted'
  | 'installed';

/** Human-readable label for each visit status. */
export const VISIT_STATUS_LABELS: Record<string, string> = {
  'new':                  'New',
  'draft':                'New',
  'survey_started':       'Survey started',
  'recommendation_ready': 'Recommendation ready',
  'complete':             'Recommendation ready',
  'quoted':               'Quoted',
  'installed':            'Installed',
};

/** Returns the display label for a visit status value. */
export function visitStatusLabel(status: string): string {
  return VISIT_STATUS_LABELS[status] ?? status;
}

/**
 * Returns the primary display label for a visit, using this priority order:
 *   1. visit_reference (user-defined lead / job number)
 *   2. address_line_1
 *   3. truncated visit id (fallback)
 */
export function visitDisplayLabel(v: Pick<VisitMeta, 'id' | 'visit_reference' | 'address_line_1'>): string {
  if (v.visit_reference) return v.visit_reference;
  if (v.address_line_1) return v.address_line_1;
  return `Visit ${v.id.slice(-8).toUpperCase()}`;
}

/**
 * Filter category for the Visit List.
 * - active:          new or survey_started
 * - completed:       recommendation_ready, quoted, or installed
 * - needs_followup:  recommendation_ready but not yet quoted
 */
export type VisitFilterCategory = 'all' | 'active' | 'completed' | 'needs_followup';

/** Returns true when the visit status falls into the given filter category. */
export function matchesFilter(status: string, filter: VisitFilterCategory): boolean {
  if (filter === 'all') return true;
  const s = status.toLowerCase();
  if (filter === 'active')
    return s === 'new' || s === 'draft' || s === 'survey_started';
  if (filter === 'completed')
    return s === 'recommendation_ready' || s === 'complete' || s === 'quoted' || s === 'installed';
  if (filter === 'needs_followup')
    return s === 'recommendation_ready' || s === 'complete';
  return true;
}

/** Returns true when the survey step is considered complete (recommendation is available). */
export function isSurveyComplete(v: VisitMeta): boolean {
  const s = v.status.toLowerCase();
  return (
    s === 'complete' ||
    s === 'recommendation_ready' ||
    s === 'quoted' ||
    s === 'installed' ||
    v.current_step === 'complete'
  );
}

export interface VisitDetail extends VisitMeta {
  working_payload: Record<string, unknown>;
}

/**
 * Extracts a user-friendly error message from a failed API response.
 * 503 responses with schema-drift messaging are surfaced as a clear
 * maintenance notice rather than raw SQLite internals.
 */
async function extractApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null) as { error?: string } | null;
  const message = body?.error ?? fallback;
  if (res.status === 503 && message.includes("schema is out of date")) {
    return "Atlas database needs an update before this visit can load. Please run remote D1 migrations.";
  }
  return message;
}

/**
 * POST /api/visits
 *
 * Creates a new visit record and returns its ID.
 */
export async function createVisit(opts: {
  customer_name?: string;
  address_line_1?: string;
  postcode?: string;
  visit_reference?: string;
} = {}): Promise<{ ok: true; id: string }> {
  const res = await fetch("/api/visits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    throw new Error(await extractApiError(res, "Failed to create visit"));
  }
  return res.json() as Promise<{ ok: true; id: string }>;
}

/**
 * GET /api/visits
 *
 * Lists recent visits (most recently updated first, max 50).
 */
export async function listVisits(): Promise<VisitMeta[]> {
  const res = await fetch("/api/visits");
  if (!res.ok) {
    throw new Error(await extractApiError(res, "Failed to list visits"));
  }
  const data = await res.json() as { ok: true; visits: VisitMeta[] };
  return data.visits;
}

/**
 * GET /api/visits/:id
 *
 * Fetches a single visit record including its working payload.
 */
export async function getVisit(id: string): Promise<VisitDetail> {
  const res = await fetch(`/api/visits/${encodeURIComponent(id)}`);
  if (res.status === 404) {
    throw new Error("Visit not found");
  }
  if (!res.ok) {
    throw new Error(await extractApiError(res, "Failed to load visit"));
  }
  const data = await res.json() as { ok: true; visit: VisitDetail };
  return data.visit;
}

/**
 * PUT /api/visits/:id
 *
 * Persists updated working payload and/or metadata for a visit.
 */
export async function saveVisit(
  id: string,
  patch: {
    customer_name?: string;
    address_line_1?: string;
    postcode?: string;
    current_step?: string;
    status?: string;
    visit_reference?: string;
    working_payload?: Record<string, unknown>;
  }
): Promise<void> {
  const res = await fetch(`/api/visits/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    throw new Error(await extractApiError(res, "Failed to save visit"));
  }
}
