/**
 * src/features/analytics/privacyGuard.ts
 *
 * Data-minimisation guardrails for Atlas analytics.
 *
 * Purpose
 * ───────
 * Prevent accidental storage or export of customer/job data through the
 * analytics pipeline.  The guard operates at the boundary where data enters
 * the analytics store so that PII-bearing payloads are caught early — in
 * development as thrown errors, in production as console warnings — before
 * any write reaches localStorage or an export sink.
 *
 * Allowlist model
 * ───────────────
 * Analytics may only carry the fields enumerated in ANALYTICS_FIELD_ALLOWLIST.
 * Any top-level key outside this set is considered unexpected metadata; any key
 * that also appears in BLOCKED_CUSTOMER_KEYS is a hard privacy violation.
 *
 * Blocked keys (non-exhaustive — extend as data model grows)
 * ──────────────────────────────────────────────────────────
 *   name · address · postcode · photo · transcript · floorPlan
 *   roomScan · email · phone · customer · surveyData · surveyPayload
 *   heatLoss · report · visitDetails · jobDetails · rawSurvey
 *   uri · externalId · fileUri · fileBlob · fileContent · fileData
 */

// ─── Allowlist ────────────────────────────────────────────────────────────────

/**
 * Exhaustive set of field names that analytics events/aggregates are permitted
 * to carry.  Any write containing a key outside this set will trigger a dev
 * warning; any write containing a BLOCKED_CUSTOMER_KEY will throw in dev and
 * warn in production.
 */
export const ANALYTICS_FIELD_ALLOWLIST: ReadonlySet<string> = new Set([
  // AnalyticsEventBaseV1
  'eventId',
  'eventType',
  'tenantId',
  'visitId',
  'createdAt',
  // VisitCompletedEvent
  'durationSeconds',
  // RecommendationViewedEvent
  'scenarioIds',
  // RecommendationSelectedEvent
  'selectedScenarioId',
  // TenantAnalyticsAggregate
  'visitsCreated',
  'visitsCompleted',
  'completionRate',
  'avgDurationSeconds',
  'recommendationViews',
  'recommendationSelections',
  'topSelectedScenarioIds',
  'wonJobs',
  'lostJobs',
  'followUpCount',
  'closeRate',
  // topSelectedScenarioIds entries
  'scenarioId',
  'count',
]);

// ─── Blocklist ────────────────────────────────────────────────────────────────

/**
 * Keys that must never appear in any analytics payload.
 * Presence of any of these keys is a privacy violation.
 */
export const BLOCKED_CUSTOMER_KEYS: ReadonlySet<string> = new Set([
  'name',
  'address',
  'postcode',
  'photo',
  'transcript',
  'floorPlan',
  'roomScan',
  'email',
  'phone',
  'customer',
  'surveyData',
  'surveyPayload',
  'heatLoss',
  'report',
  'visitDetails',
  'jobDetails',
  'rawSurvey',
  // ClientFileReferenceV1 fields that must never enter analytics
  'uri',
  'externalId',
  'fileUri',
  'fileBlob',
  'fileContent',
  'fileData',
]);

// ─── Guard helper ─────────────────────────────────────────────────────────────

/**
 * Asserts that `value` contains no blocked customer/job data keys.
 *
 * Behaviour by environment
 * ────────────────────────
 * - **Development** (`import.meta.env.DEV`): throws an `Error` so that
 *   privacy regressions are surfaced immediately during development and CI.
 * - **Production**: emits a `console.warn` so the product journey is never
 *   interrupted for end-users, but the violation is still observable.
 *
 * The check is shallow (top-level keys only) because AnalyticsEventV1 types
 * are flat by design — nested objects would already be a schema violation.
 *
 * @param value - Any object that is about to enter the analytics pipeline.
 * @throws {Error} In development when a blocked key is found.
 */
export function assertNoCustomerPayload(value: unknown): void {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return;
  }

  const obj = value as Record<string, unknown>;
  const violations: string[] = [];

  for (const key of Object.keys(obj)) {
    if (BLOCKED_CUSTOMER_KEYS.has(key)) {
      violations.push(key);
    }
  }

  if (violations.length === 0) return;

  const message =
    `[Atlas privacy guard] Analytics payload contains blocked customer data ` +
    `key(s): ${violations.map((k) => `'${k}'`).join(', ')}. ` +
    `Analytics may only carry IDs and metadata — never PII or survey payloads.`;

  if (
    typeof import.meta !== 'undefined' &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (import.meta as any).env?.DEV
  ) {
    throw new Error(message);
  }

  // Production: warn but do not disrupt the user journey.
  console.warn(message);
}
