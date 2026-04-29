import { createD1CircuitBreaker } from "./_utils/circuitBreaker";

/**
 * POST /api/scan-sessions
 *
 * Creates a new scan session record in D1.
 *
 * Request body (JSON):
 *   {
 *     id?:               string   — optional; generated via crypto.randomUUID() if absent
 *     job_reference:     string
 *     property_address:  string
 *     scan_state?:       string   — defaults to 'scanned'
 *     review_state?:     string   — defaults to 'scanned'
 *     visit_id?:         string   — optional FK to visits table
 *   }
 *
 * Response (201):
 *   { ok: true, id: string }
 *
 * GET /api/scan-sessions
 *
 * Lists recent scan sessions (most recently updated first, max 50).
 *
 * Response (200):
 *   { ok: true, sessions: ScanSessionRow[] }
 */

interface ScanSessionRow {
  id: string;
  job_reference: string;
  property_address: string;
  created_at: string;
  updated_at: string;
  scan_state: string;
  review_state: string;
  sync_state: string;
  visit_id: string | null;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const jobReference =
    typeof body.job_reference === "string" && body.job_reference.trim().length > 0
      ? body.job_reference.trim()
      : null;
  const propertyAddress =
    typeof body.property_address === "string" && body.property_address.trim().length > 0
      ? body.property_address.trim()
      : null;

  if (!jobReference || !propertyAddress) {
    return Response.json(
      { ok: false, error: "job_reference and property_address are required" },
      { status: 400 },
    );
  }

  const id: string =
    typeof body.id === "string" && body.id.length > 0 ? body.id : crypto.randomUUID();
  const now = new Date().toISOString();
  const scanState = typeof body.scan_state === "string" ? body.scan_state : "scanned";
  const reviewState = typeof body.review_state === "string" ? body.review_state : "scanned";
  const visitId = typeof body.visit_id === "string" && body.visit_id.length > 0
    ? body.visit_id
    : null;

  const breaker = createD1CircuitBreaker();
  const result = await breaker.run(() =>
    env.ATLAS_REPORTS_D1.prepare(
      `INSERT INTO scan_sessions
         (id, job_reference, property_address, created_at, updated_at, scan_state, review_state, sync_state, visit_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'uploaded', ?)`,
    )
      .bind(id, jobReference, propertyAddress, now, now, scanState, reviewState, visitId)
      .run(),
  );

  if (!result.ok) {
    console.error(`[Atlas] Scan session insert failed: id=${id}`);
    return result.response;
  }

  console.log(`[Atlas] Scan session created: id=${id}`);
  return Response.json({ ok: true, id }, { status: 201 });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const breaker = createD1CircuitBreaker();
  const result = await breaker.run(() =>
    env.ATLAS_REPORTS_D1.prepare(
      `SELECT id, job_reference, property_address, created_at, updated_at,
              scan_state, review_state, sync_state, visit_id
       FROM scan_sessions
       ORDER BY updated_at DESC
       LIMIT 50`,
    ).all<ScanSessionRow>(),
  );

  if (!result.ok) return result.response;

  return Response.json({ ok: true, sessions: result.value.results ?? [] });
};
