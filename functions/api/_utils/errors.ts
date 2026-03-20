/**
 * Shared error helpers for Atlas D1 API functions.
 */

/**
 * Returns true when the error is a D1/SQLite "no such table" schema-drift
 * error. This indicates that the remote database schema is behind the
 * application code and migrations need to be applied.
 */
export function isMissingTableError(err: unknown): boolean {
  return typeof err === "object" && err !== null && /no such table/i.test(String(err));
}

/**
 * Returns true when the error is a D1/SQLite "missing column" schema-drift
 * error. This indicates that a column added by a migration has not yet been
 * applied to the remote database, but the application code is already
 * querying or inserting it (e.g. visits.visit_reference added in migration 0004).
 *
 * SQLite surfaces two distinct messages depending on the statement type:
 *   - SELECT / UPDATE: "no such column: visit_reference"
 *   - INSERT:          "table visits has no column named visit_reference"
 * Both patterns are matched so that all DML paths are covered.
 */
export function isMissingColumnError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const msg = String(err);
  return /no such column/i.test(msg) || /has no column named/i.test(msg);
}

/**
 * Standard 503 response body for schema-drift errors.
 * The message is intentionally user-readable so it surfaces clearly
 * in API consumers and browser devtools.
 */
export const SCHEMA_DRIFT_RESPONSE = {
  ok: false,
  error: "Database schema is out of date. Apply D1 migrations.",
} as const;
