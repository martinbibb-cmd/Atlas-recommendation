/**
 * GET /api/health/runtime
 *
 * Checks whether the required Cloudflare bindings are present in the runtime
 * environment.  This lets you distinguish a missing binding from a missing
 * schema table or broken application code.
 *
 * Response (200) when all bindings are present:
 *   {
 *     ok: true,
 *     bindings: {
 *       ATLAS_REPORTS_D1: { present: true },
 *       ATLAS_CACHE_KV:   { present: true }
 *     }
 *   }
 *
 * Response (200) when one or more bindings are absent:
 *   {
 *     ok: false,
 *     bindings: {
 *       ATLAS_REPORTS_D1: { present: true },
 *       ATLAS_CACHE_KV:   { present: false }
 *     }
 *   }
 */

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const d1Present = Boolean(env.ATLAS_REPORTS_D1);
  const kvPresent = Boolean(env.ATLAS_CACHE_KV);

  return Response.json({
    ok: d1Present && kvPresent,
    bindings: {
      ATLAS_REPORTS_D1: { present: d1Present },
      ATLAS_CACHE_KV: { present: kvPresent },
    },
  });
};
