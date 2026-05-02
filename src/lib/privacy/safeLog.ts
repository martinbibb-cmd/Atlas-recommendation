/**
 * src/lib/privacy/safeLog.ts
 *
 * Privacy-safe logging helpers for Atlas.
 *
 * Purpose
 * ───────
 * Ensure that ClientFileReferenceV1 sensitive fields (uri, externalId) and
 * ExternalVisitManifestV1 file arrays never leak into console logs, dev panel
 * output, or error messages.
 *
 * Exports
 * ───────
 * - redactSensitiveFields(value)  — deep-redacts blocked keys from any object
 * - safeStringify(value)          — JSON.stringify after redacting blocked keys
 * - redactString(s)               — strips http(s) URIs from a plain string
 */

// ─── Blocked keys ─────────────────────────────────────────────────────────────

/**
 * Object keys whose values must never appear in logs, dev panels, or error text.
 * Mirrors the keys blocked by the analytics privacy guard.
 */
const BLOCKED_LOG_KEYS: ReadonlySet<string> = new Set([
  'uri',
  'externalId',
  'files',
  'fileUri',
  'fileBlob',
  'fileContent',
  'fileData',
]);

// ─── URI pattern ──────────────────────────────────────────────────────────────

/**
 * Matches http / https URIs in plain strings.
 * Used to strip accidental URI leakage from error messages.
 */
const URI_PATTERN = /https?:\/\/[^\s"'<>)\]]+/g;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Recursively replaces the values of any blocked key with `"[redacted]"`.
 * Arrays are mapped element-by-element; primitives are returned as-is.
 */
export function redactSensitiveFields(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactSensitiveFields);

  const obj = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    result[key] = BLOCKED_LOG_KEYS.has(key)
      ? '[redacted]'
      : redactSensitiveFields(obj[key]);
  }
  return result;
}

/**
 * Like `JSON.stringify(value, null, 2)` but passes the value through
 * `redactSensitiveFields` first so that no blocked fields reach the output.
 */
export function safeStringify(value: unknown): string {
  return JSON.stringify(redactSensitiveFields(value), null, 2);
}

/**
 * Strips http / https URIs from a plain string, replacing each match with
 * `[redacted]`.  Use this to sanitise Error messages before displaying or
 * logging them when the source of the error is unknown (e.g. global error
 * handlers and React error boundaries).
 */
export function redactString(s: string): string {
  return s.replace(URI_PATTERN, '[redacted]');
}
