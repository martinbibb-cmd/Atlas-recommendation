import { createD1CircuitBreaker } from "../../_utils/circuitBreaker";

/**
 * POST /api/scan-sessions/:id/assets
 *
 * Uploads a binary asset (photo, PLY, scan bundle) to R2 and records its
 * metadata in D1.
 *
 * Content-Type: multipart/form-data
 * Fields:
 *   file        — the binary file (required)
 *   asset_type  — 'photo' | 'ply' | 'transcript' | 'scan_bundle' (required)
 *   captured_at — ISO-8601 timestamp (optional)
 *   metadata    — JSON string of extra metadata (optional)
 *
 * Response (201):
 *   { ok: true, assetId: string, r2Key: string }
 *
 * GET /api/scan-sessions/:id/assets/:assetId
 * is handled by [assetId].ts in the nested route.
 */

interface AssetRow {
  id: string;
  r2_key: string;
}

const ALLOWED_ASSET_TYPES = ["photo", "ply", "transcript", "scan_bundle"] as const;
type AssetType = (typeof ALLOWED_ASSET_TYPES)[number];

function isAssetType(v: unknown): v is AssetType {
  return typeof v === "string" && (ALLOWED_ASSET_TYPES as readonly string[]).includes(v);
}

// Two D1 queries in the asset upload handler: session existence check + insert.
const ASSET_UPLOAD_QUERY_COUNT = 2;

export const onRequestPost: PagesFunction<Env, "id"> = async (context) => {
  const { env, request, params } = context;
  const sessionId = params.id as string;

  // ── Parse multipart form-data ──────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { ok: false, error: "Request must be multipart/form-data" },
      { status: 400 },
    );
  }

  const fileField = formData.get("file");
  if (!(fileField instanceof File)) {
    return Response.json(
      { ok: false, error: "Missing or invalid 'file' field" },
      { status: 400 },
    );
  }

  const assetTypeRaw = formData.get("asset_type");
  if (!isAssetType(assetTypeRaw)) {
    return Response.json(
      { ok: false, error: `asset_type must be one of: ${ALLOWED_ASSET_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const capturedAt = formData.get("captured_at");
  const metadataRaw = formData.get("metadata");
  let metadataJson = "{}";
  if (typeof metadataRaw === "string") {
    try {
      JSON.parse(metadataRaw); // validate
      metadataJson = metadataRaw;
    } catch {
      // ignore invalid metadata — fall back to {}
    }
  }

  // ── Verify session exists ──────────────────────────────────────────────────
  const breaker = createD1CircuitBreaker(ASSET_UPLOAD_QUERY_COUNT);
  const sessionCheck = await breaker.run(() =>
    env.ATLAS_REPORTS_D1.prepare("SELECT id FROM scan_sessions WHERE id = ?")
      .bind(sessionId)
      .first<AssetRow>(),
  );
  if (!sessionCheck.ok) return sessionCheck.response;
  if (!sessionCheck.value) {
    return Response.json({ ok: false, error: "Scan session not found" }, { status: 404 });
  }

  // ── Upload to R2 ───────────────────────────────────────────────────────────
  const assetId = crypto.randomUUID();
  // Sanitize the file extension to alphanumeric characters only to prevent
  // path traversal or unusual extension injection in the R2 object key.
  const rawExt = fileField.name.split(".").pop() ?? "bin";
  const ext = rawExt.replace(/[^a-z0-9]/gi, '').slice(0, 10) || 'bin';
  const r2Key = `scan-sessions/${sessionId}/${assetId}.${ext}`;
  const arrayBuffer = await fileField.arrayBuffer();

  try {
    await env.ATLAS_ASSETS_R2.put(r2Key, arrayBuffer, {
      httpMetadata: { contentType: fileField.type || "application/octet-stream" },
      customMetadata: { sessionId, assetType: assetTypeRaw, fileName: fileField.name },
    });
  } catch (err) {
    console.error("[Atlas] R2 upload failed:", err);
    return Response.json(
      { ok: false, error: "Asset upload failed" },
      { status: 502 },
    );
  }

  // ── Record in D1 ──────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const d1Result = await breaker.run(() =>
    env.ATLAS_REPORTS_D1.prepare(
      `INSERT INTO scan_assets
         (id, session_id, asset_type, r2_key, file_name, mime_type, captured_at, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        assetId,
        sessionId,
        assetTypeRaw,
        r2Key,
        fileField.name,
        fileField.type || "application/octet-stream",
        typeof capturedAt === "string" ? capturedAt : now,
        metadataJson,
      )
      .run(),
  );

  if (!d1Result.ok) {
    // Best-effort: try to delete the orphaned R2 object.
    void env.ATLAS_ASSETS_R2.delete(r2Key);
    return d1Result.response;
  }

  console.log(`[Atlas] Asset uploaded: sessionId=${sessionId} assetId=${assetId} r2Key=${r2Key}`);
  return Response.json({ ok: true, assetId, r2Key }, { status: 201 });
};
