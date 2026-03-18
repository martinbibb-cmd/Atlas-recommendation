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
 * Returns true when the error is a D1/SQLite "no such column" schema-drift
 * error. This indicates that a column added by a migration has not yet been
 * applied to the remote database, but the application code is already
 * querying it (e.g. visits.visit_reference added in migration 0004).
 */
export function isMissingColumnError(err: unknown): boolean {
  return typeof err === "object" && err !== null && /no such column/i.test(String(err));
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
