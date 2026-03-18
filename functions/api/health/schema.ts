/**
 * GET /api/health/schema
 *
 * Checks that all required D1 tables and columns exist in the bound database.
 * Use this after deploying to verify that remote migrations have been applied.
 *
 * Response (200) when all tables and columns are present:
 *   { ok: true,  requiredTables: ["reports","visits"], missingTables: [], missingColumns: [] }
 *
 * Response (200) when tables or columns are missing:
 *   { ok: false, requiredTables: ["reports","visits"], missingTables: [], missingColumns: ["visits.visit_reference"] }
 *
 * Response (503) when the D1 binding itself is unavailable:
 *   { ok: false, error: "D1 binding ATLAS_REPORTS_D1 is not available" }
 */

const REQUIRED_TABLES = ["reports", "visits"] as const;

/** Allowlisted table names — PRAGMA table_info does not support parameter binding. */
const ALLOWED_TABLES = new Set<string>(REQUIRED_TABLES);

/**
 * Columns that must exist for the current application code to work correctly.
 * Each entry is { table, column } — used to probe PRAGMA table_info.
 */
const REQUIRED_COLUMNS: Array<{ table: string; column: string }> = [
  { table: "visits", column: "visit_reference" },
];

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  if (!env.ATLAS_REPORTS_D1) {
    return Response.json(
      { ok: false, error: "D1 binding ATLAS_REPORTS_D1 is not available" },
      { status: 503 }
    );
  }

  try {
    // ── Check required tables ─────────────────────────────────────────────────
    const tableResult = await env.ATLAS_REPORTS_D1.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${REQUIRED_TABLES.map(() => "?").join(", ")})`
    )
      .bind(...REQUIRED_TABLES)
      .all<{ name: string }>();

    const presentTables = new Set((tableResult.results ?? []).map((r) => r.name));
    const missingTables = REQUIRED_TABLES.filter((t) => !presentTables.has(t));

    // ── Check required columns ────────────────────────────────────────────────
    const missingColumns: string[] = [];

    for (const { table, column } of REQUIRED_COLUMNS) {
      // Only probe a table's columns when the table itself is present.
      if (!presentTables.has(table)) continue;

      try {
        // PRAGMA does not support parameter binding — guard with an explicit
        // allowlist check so the table name can never be attacker-controlled.
        if (!ALLOWED_TABLES.has(table)) {
          missingColumns.push(`${table}.${column}`);
          continue;
        }
        const info = await env.ATLAS_REPORTS_D1.prepare(
          `PRAGMA table_info(${table})`
        ).all<{ name: string }>();

        const columns = new Set((info.results ?? []).map((r) => r.name));
        if (!columns.has(column)) {
          missingColumns.push(`${table}.${column}`);
        }
      } catch {
        missingColumns.push(`${table}.${column}`);
      }
    }

    const ok = missingTables.length === 0 && missingColumns.length === 0;

    return Response.json({
      ok,
      requiredTables: [...REQUIRED_TABLES],
      missingTables,
      missingColumns,
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 503 }
    );
  }
};
