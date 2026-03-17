/**
 * GET /api/bindings-check
 *
 * Returns a JSON snapshot of whether the required Cloudflare bindings are
 * present in the runtime environment.  It does NOT query real application
 * data — it only verifies that the bindings are wired up correctly so that
 * you can diagnose missing/misconfigured bindings after a deploy.
 *
 * Response shape:
 * {
 *   bindings: {
 *     ATLAS_REPORTS_D1: { present: boolean, ping?: "ok" | "error", detail?: string },
 *     ATLAS_CACHE_KV:   { present: boolean, ping?: "ok" | "error", detail?: string }
 *   }
 * }
 *
 * Diagnostic checklist if `present` is false:
 *   1. Go to Workers & Pages → your Pages project → Settings → Bindings.
 *   2. Add the missing binding (see README for exact names).
 *   3. Redeploy the Pages project — bindings do not take effect until redeploy.
 */

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  // ── D1 check ────────────────────────────────────────────────────────────────
  const d1Present = env.ATLAS_REPORTS_D1 != null;
  let d1Ping: "ok" | "error" | undefined;
  let d1Detail: string | undefined;

  if (d1Present) {
    try {
      await env.ATLAS_REPORTS_D1.prepare("SELECT 1").run();
      d1Ping = "ok";
    } catch (err) {
      d1Ping = "error";
      d1Detail = String(err);
    }
  }

  // ── KV check ────────────────────────────────────────────────────────────────
  const kvPresent = env.ATLAS_CACHE_KV != null;
  let kvPing: "ok" | "error" | undefined;
  let kvDetail: string | undefined;

  if (kvPresent) {
    try {
      const PROBE_KEY = "__bindings_check__";
      await env.ATLAS_CACHE_KV.put(PROBE_KEY, "1", { expirationTtl: 60 });
      const val = await env.ATLAS_CACHE_KV.get(PROBE_KEY);
      kvPing = val === "1" ? "ok" : "error";
      if (kvPing === "error") {
        kvDetail = "put succeeded but get returned unexpected value";
      }
    } catch (err) {
      kvPing = "error";
      kvDetail = String(err);
    }
  }

  // ── Response ─────────────────────────────────────────────────────────────────
  const allOk = d1Present && d1Ping === "ok" && kvPresent && kvPing === "ok";

  return Response.json(
    {
      ok: allOk,
      bindings: {
        ATLAS_REPORTS_D1: {
          present: d1Present,
          ...(d1Present ? { ping: d1Ping } : {}),
          ...(d1Detail ? { detail: d1Detail } : {}),
        },
        ATLAS_CACHE_KV: {
          present: kvPresent,
          ...(kvPresent ? { ping: kvPing } : {}),
          ...(kvDetail ? { detail: kvDetail } : {}),
        },
      },
    },
    { status: allOk ? 200 : 503 }
  );
};
