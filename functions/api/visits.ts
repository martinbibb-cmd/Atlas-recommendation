import { createD1CircuitBreaker } from "./_utils/circuitBreaker";

/**
 * POST /api/visits
 *
 * Creates a new Atlas visit record in D1.
 * A visit is the top-level case record; reports are generated later as child
 * outputs of a visit.
 *
 * Request body (JSON, all optional):
 *   {
 *     id?:                string   — optional; generated via crypto.randomUUID() if absent
 *     customer_name?:     string
 *     address_line_1?:    string
 *     postcode?:          string
 *     current_step?:      string
 *     visit_reference?:   string
 *     working_payload?:   object   — defaults to {} if absent
 *   }
 *
 * Response (201):
 *   { ok: true, id: string }
 *
 * Response (400) when body is not valid JSON:
 *   { ok: false, error: string }
 *
 * GET /api/visits
 *
 * Lists recent visit records (most recently updated first, max 50).
 *
 * Response (200):
 *   {
 *     ok: true,
 *     visits: Array<{
 *       id, created_at, updated_at, status,
 *       customer_name, address_line_1, postcode, current_step
 *     }>
 *   }
 */

interface VisitRow {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  customer_name: string | null;
  address_line_1: string | null;
  postcode: string | null;
  current_step: string | null;
  visit_reference: string | null;
  completed_at: string | null;
  completion_method: string | null;
  working_payload_json: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.trim().length > 0) {
      body = JSON.parse(text) as Record<string, unknown>;
    }
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  const id: string =
    typeof body.id === "string" && body.id.length > 0
      ? body.id
      : crypto.randomUUID();

  const now = new Date().toISOString();
  const customerName =
    typeof body.customer_name === "string" ? body.customer_name : null;
  const addressLine1 =
    typeof body.address_line_1 === "string" ? body.address_line_1 : null;
  const postcode =
    typeof body.postcode === "string" ? body.postcode : null;
  const currentStep =
    typeof body.current_step === "string" ? body.current_step : null;
  const visitReference =
    typeof body.visit_reference === "string" && body.visit_reference.trim().length > 0
      ? body.visit_reference.trim()
      : null;
  const workingPayload =
    body.working_payload != null &&
    typeof body.working_payload === "object" &&
    !Array.isArray(body.working_payload)
      ? body.working_payload
      : {};
  const workingPayloadJson = JSON.stringify(workingPayload);

  const breaker = createD1CircuitBreaker();

  const insertResult = await breaker.run(() =>
    env.ATLAS_REPORTS_D1.prepare(
      `INSERT INTO visits
         (id, created_at, updated_at, status, customer_name, address_line_1, postcode, current_step, visit_reference, working_payload_json)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, now, now, customerName, addressLine1, postcode, currentStep, visitReference, workingPayloadJson)
      .run()
  );

  if (!insertResult.ok) {
    console.error(`[Atlas] Visit insert failed (circuit breaker): id=${id}`);
    return insertResult.response;
  }

  console.log(`[Atlas] Visit created: id=${id}`);
  return Response.json({ ok: true, id }, { status: 201 });
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  const breaker = createD1CircuitBreaker();

  const listResult = await breaker.run(() =>
    env.ATLAS_REPORTS_D1.prepare(
      `SELECT id, created_at, updated_at, status, customer_name, address_line_1, postcode, current_step, visit_reference, completed_at, completion_method
       FROM visits
       ORDER BY updated_at DESC
       LIMIT 50`
    ).all<Omit<VisitRow, "working_payload_json">>()
  );

  if (!listResult.ok) {
    return listResult.response;
  }

  return Response.json({ ok: true, visits: listResult.value.results ?? [] });
};
