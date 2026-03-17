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
