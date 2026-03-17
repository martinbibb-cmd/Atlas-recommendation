/**
 * GET /api/d1-smoke
 *
 * Smoke-tests the D1 binding by running a trivial SQL query.
 * Returns { status: "ok", result: { ok: 1 } } on success.
 *
 * The DB binding is wired in wrangler.jsonc and must be configured in the
 * Cloudflare Pages dashboard before deploying to production.
 */

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return Response.json({ status: "ok", result: row });
  } catch (err) {
    return Response.json(
      { status: "error", message: String(err) },
      { status: 500 }
    );
  }
};
