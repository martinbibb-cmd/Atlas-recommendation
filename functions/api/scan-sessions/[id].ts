import { createD1CircuitBreaker } from "../_utils/circuitBreaker.js";

/**
 * GET /api/scan-sessions/:id
 *
 * Fetches a single scan session with its asset manifest and transcripts.
 *
 * Response (200):
 *   { ok: true, session: ScanSessionRow, assets: AssetRow[], transcripts: TranscriptRow[] }
 *
 * Response (404):
 *   { ok: false, error: string }
 *
 * PATCH /api/scan-sessions/:id
 *
 * Updates mutable state fields on a scan session.
 *
 * Request body (JSON, all optional):
 *   {
 *     scan_state?:    string
 *     review_state?:  string
 *     sync_state?:    string
 *   }
 *
 * Response (200):
 *   { ok: true }
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

interface AssetRow {
  id: string;
  session_id: string;
  asset_type: string;
  r2_key: string;
  file_name: string;
  mime_type: string;
  captured_at: string | null;
  metadata_json: string;
}

interface TranscriptRow {
  id: string;
  session_id: string;
  room_id: string | null;
  source: string;
  text: string;
  created_at: string;
}

// Number of concurrent D1 queries in the session GET handler (session + assets + transcripts).
const CONCURRENT_QUERY_COUNT = 3;

export const onRequestGet: PagesFunction<Env, "id"> = async (context) => {
  const { env, params } = context;
  const sessionId = params.id as string;

  const breaker = createD1CircuitBreaker(CONCURRENT_QUERY_COUNT);

  const [sessionResult, assetsResult, transcriptsResult] = await Promise.all([
    breaker.run(() =>
      env.ATLAS_REPORTS_D1.prepare(
        `SELECT id, job_reference, property_address, created_at, updated_at,
                scan_state, review_state, sync_state, visit_id
         FROM scan_sessions WHERE id = ?`,
      )
        .bind(sessionId)
        .first<ScanSessionRow>(),
    ),
    breaker.run(() =>
      env.ATLAS_REPORTS_D1.prepare(
        `SELECT id, session_id, asset_type, r2_key, file_name, mime_type, captured_at, metadata_json
         FROM scan_assets WHERE session_id = ? ORDER BY captured_at ASC`,
      )
        .bind(sessionId)
        .all<AssetRow>(),
    ),
    breaker.run(() =>
      env.ATLAS_REPORTS_D1.prepare(
        `SELECT id, session_id, room_id, source, text, created_at
         FROM transcripts WHERE session_id = ? ORDER BY created_at ASC`,
      )
        .bind(sessionId)
        .all<TranscriptRow>(),
    ),
  ]);

  if (!sessionResult.ok) return sessionResult.response;
  if (!assetsResult.ok) return assetsResult.response;
  if (!transcriptsResult.ok) return transcriptsResult.response;

  if (!sessionResult.value) {
    return Response.json({ ok: false, error: "Scan session not found" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    session: sessionResult.value,
    assets: assetsResult.value.results ?? [],
    transcripts: transcriptsResult.value.results ?? [],
  });
};

export const onRequestPatch: PagesFunction<Env, "id"> = async (context) => {
  const { env, request, params } = context;
  const sessionId = params.id as string;

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

  const updates: string[] = [];
  const bindings: unknown[] = [];

  if (typeof body.scan_state === "string") {
    updates.push("scan_state = ?");
    bindings.push(body.scan_state);
  }
  if (typeof body.review_state === "string") {
    updates.push("review_state = ?");
    bindings.push(body.review_state);
  }
  if (typeof body.sync_state === "string") {
    updates.push("sync_state = ?");
    bindings.push(body.sync_state);
  }

  if (updates.length === 0) {
    return Response.json({ ok: false, error: "No updatable fields provided" }, { status: 400 });
  }

  updates.push("updated_at = ?");
  bindings.push(new Date().toISOString());
  bindings.push(sessionId);

  const breaker = createD1CircuitBreaker();
  const result = await breaker.run(() =>
    env.ATLAS_REPORTS_D1.prepare(
      `UPDATE scan_sessions SET ${updates.join(", ")} WHERE id = ?`,
    )
      .bind(...bindings)
      .run(),
  );

  if (!result.ok) return result.response;
  return Response.json({ ok: true });
};
