/**
 * GET /api/health/schema
 *
 * Checks that all required D1 tables exist in the bound database.
 * Use this after deploying to verify that remote migrations have been applied.
 *
 * Response (200) when all tables are present:
 *   { ok: true,  requiredTables: ["reports","visits"], missingTables: [] }
 *
 * Response (200) when tables are missing:
 *   { ok: false, requiredTables: ["reports","visits"], missingTables: ["visits"] }
 *
 * Response (503) when the D1 binding itself is unavailable:
 *   { ok: false, error: "D1 binding ATLAS_REPORTS_D1 is not available" }
 */

const REQUIRED_TABLES = ["reports", "visits"] as const;

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.ATLAS_REPORTS_D1) {
    return Response.json(
      { ok: false, error: "D1 binding ATLAS_REPORTS_D1 is not available" },
      { status: 503 }
    );
  }

  try {
    const result = await env.ATLAS_REPORTS_D1.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${REQUIRED_TABLES.map(() => "?").join(", ")})`
    )
      .bind(...REQUIRED_TABLES)
      .all<{ name: string }>();

    const presentTables = new Set((result.results ?? []).map((r) => r.name));
    const missingTables = REQUIRED_TABLES.filter((t) => !presentTables.has(t));

    return Response.json({
      ok: missingTables.length === 0,
      requiredTables: [...REQUIRED_TABLES],
      missingTables,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 503 }
    );
  }
};
