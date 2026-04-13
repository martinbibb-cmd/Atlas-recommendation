/**
 * circuitBreaker.ts
 *
 * Simple in-request circuit-breaker helper for Cloudflare D1 API calls.
 *
 * Because Cloudflare Workers are stateless per-request, a persistent
 * circuit-breaker across requests would require KV/DO storage. Instead this
 * module provides:
 *
 *   1. A per-request circuit-breaker that short-circuits after the first D1
 *      failure within the same request execution context (useful for fan-out
 *      patterns where a single handler makes multiple D1 calls).
 *
 *   2. A `withD1CircuitBreaker()` wrapper that catches schema-drift AND
 *      general D1 errors, maps them to standardised 503 response bodies, and
 *      prevents further calls once the breaker is open.
 *
 *   3. A `MaintenanceModeResponse` constant for consistent Maintenance Mode
 *      UI detection — consumers check `response.headers.get('X-Atlas-Mode')`
 *      for the value `'maintenance'`.
 *
 * Usage
 * ─────
 *   const breaker = createD1CircuitBreaker();
 *
 *   const result = await breaker.run(() =>
 *     env.ATLAS_REPORTS_D1.prepare('SELECT …').first()
 *   );
 *
 *   if (!result.ok) {
 *     return result.response;   // pre-built 503 Maintenance Mode response
 *   }
 *   // result.value is the D1 result
 */

import { isMissingTableError, isMissingColumnError, SCHEMA_DRIFT_RESPONSE } from "./errors.js";

// ─── Response bodies ──────────────────────────────────────────────────────────

/**
 * Standard response body emitted when the circuit breaker opens due to a
 * transient D1 failure (connectivity, rate-limit, etc.).
 *
 * Distinct from SCHEMA_DRIFT_RESPONSE so that the client can show a
 * "temporarily unavailable" message rather than a "run migrations" message.
 */
export const D1_UNAVAILABLE_RESPONSE = {
  ok: false,
  error: "Database temporarily unavailable. Please try again shortly.",
  maintenanceMode: true,
} as const;

/**
 * Builds a 503 Maintenance Mode `Response` with the `X-Atlas-Mode: maintenance`
 * header so clients can detect and render a dedicated Maintenance Mode UI.
 */
function maintenanceResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 503,
    headers: {
      "Content-Type": "application/json",
      "X-Atlas-Mode": "maintenance",
      // 30 seconds: a reasonable window for transient D1 connectivity blips and
      // schema-drift migrations (which typically complete within 10–30 s on D1).
      // Cloudflare Workers' 30 s CPU limit also means a new request context will
      // be created after this interval, resetting any in-request breaker state.
      "Retry-After": "30",
    },
  });
}

// ─── Circuit-breaker state ────────────────────────────────────────────────────

export interface CircuitBreakerState {
  /** Number of consecutive failures recorded in this request context. */
  failureCount: number;
  /** True once the breaker has opened (won't attempt further calls). */
  open: boolean;
  /** Reason the breaker opened, if any. */
  openReason?: string;
}

// ─── Per-request circuit-breaker ─────────────────────────────────────────────

export interface D1CircuitBreaker {
  /** The current state of the breaker. */
  readonly state: CircuitBreakerState;

  /**
   * Execute a D1 operation.
   *
   * Returns `{ ok: true, value }` on success.
   * Returns `{ ok: false, response }` when the breaker opens or on an error —
   * callers should return `result.response` immediately as the HTTP response.
   */
  run<T>(operation: () => Promise<T>): Promise<
    | { ok: true; value: T }
    | { ok: false; response: Response }
  >;
}

/**
 * Create a per-request D1 circuit breaker.
 *
 * @param maxFailures - How many failures before the breaker opens (default: 1
 *   for a single-request context where any failure should short-circuit).
 */
export function createD1CircuitBreaker(maxFailures = 1): D1CircuitBreaker {
  const state: CircuitBreakerState = {
    failureCount: 0,
    open: false,
  };

  return {
    get state() {
      return state;
    },

    async run<T>(operation: () => Promise<T>) {
      // If already open, short-circuit immediately.
      if (state.open) {
        return {
          ok: false as const,
          response: maintenanceResponse({
            ...D1_UNAVAILABLE_RESPONSE,
            error: `Circuit breaker open: ${state.openReason ?? "previous D1 failure"}`,
          }),
        };
      }

      try {
        const value = await operation();
        return { ok: true as const, value };
      } catch (err) {
        state.failureCount += 1;

        // Schema-drift errors: surface as Maintenance Mode with migration hint.
        if (isMissingTableError(err) || isMissingColumnError(err)) {
          state.open = true;
          state.openReason = "schema drift";
          return {
            ok: false as const,
            response: maintenanceResponse(SCHEMA_DRIFT_RESPONSE),
          };
        }

        // Other D1 errors: open the breaker after maxFailures.
        if (state.failureCount >= maxFailures) {
          state.open = true;
          state.openReason = String(err);
        }

        return {
          ok: false as const,
          response: maintenanceResponse(D1_UNAVAILABLE_RESPONSE),
        };
      }
    },
  };
}

/**
 * Convenience wrapper: run a single D1 operation through a fresh circuit breaker.
 *
 * Equivalent to `createD1CircuitBreaker().run(operation)` but saves a local
 * variable when only one call is needed.
 */
export async function withD1CircuitBreaker<T>(
  operation: () => Promise<T>,
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  return createD1CircuitBreaker().run(operation);
}
