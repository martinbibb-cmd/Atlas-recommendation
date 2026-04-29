import { createD1CircuitBreaker } from "../../../_utils/circuitBreaker.js";

/**
 * GET /api/scan-sessions/:id/assets/:assetId
 *
 * Streams a scan asset from R2 back to the caller.
 *
 * Response (200): binary asset with appropriate Content-Type header
 * Response (404): { ok: false, error: string }
 */

interface AssetRow {
  r2_key: string;
  mime_type: string;
  file_name: string;
}

export const onRequestGet: PagesFunction<Env, "id" | "assetId"> = async (context) => {
  const { env, params } = context;
  const sessionId = params.id as string;
  const assetId = params.assetId as string;

  // ── Look up the R2 key for this asset ─────────────────────────────────────
  const breaker = createD1CircuitBreaker();
  const d1Result = await breaker.run(() =>
    env.ATLAS_REPORTS_D1.prepare(
      `SELECT r2_key, mime_type, file_name
       FROM scan_assets WHERE id = ? AND session_id = ?`,
    )
      .bind(assetId, sessionId)
      .first<AssetRow>(),
  );

  if (!d1Result.ok) return d1Result.response;
  if (!d1Result.value) {
    return Response.json({ ok: false, error: "Asset not found" }, { status: 404 });
  }

  const { r2_key, mime_type, file_name } = d1Result.value;

  // ── Stream from R2 ────────────────────────────────────────────────────────
  const r2Object = await env.ATLAS_ASSETS_R2.get(r2_key);
  if (!r2Object) {
    return Response.json({ ok: false, error: "Asset not found in storage" }, { status: 404 });
  }

  const disposition = `attachment; filename="${encodeURIComponent(file_name)}"`;
  return new Response(r2Object.body, {
    headers: {
      "Content-Type": mime_type,
      "Content-Disposition": disposition,
      "Cache-Control": "private, max-age=3600",
    },
  });
};
