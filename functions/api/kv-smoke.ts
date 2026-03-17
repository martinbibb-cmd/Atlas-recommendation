/**
 * GET /api/kv-smoke
 *
 * Smoke-tests the KV binding by writing a value then reading it back.
 * Returns { status: "ok", value: "smoke-ok" } on success.
 *
 * The KV binding is wired in wrangler.jsonc and must be configured in the
 * Cloudflare Pages dashboard before deploying to production.
 */

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const key = "__smoke__";
  const expected = "smoke-ok";

  try {
    await env.KV.put(key, expected);
    const value = await env.KV.get(key);
    return Response.json({ status: "ok", value });
  } catch (err) {
    return Response.json(
      { status: "error", message: String(err) },
      { status: 500 }
    );
  }
};
