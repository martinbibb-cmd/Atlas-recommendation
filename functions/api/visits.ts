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
  const workingPayload =
    body.working_payload != null &&
    typeof body.working_payload === "object" &&
    !Array.isArray(body.working_payload)
      ? body.working_payload
      : {};
  const workingPayloadJson = JSON.stringify(workingPayload);

  try {
    await env.ATLAS_REPORTS_D1.prepare(
      `INSERT INTO visits
         (id, created_at, updated_at, status, customer_name, address_line_1, postcode, current_step, working_payload_json)
       VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)`
    )
      .bind(id, now, now, customerName, addressLine1, postcode, currentStep, workingPayloadJson)
      .run();

    return Response.json({ ok: true, id }, { status: 201 });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    const result = await env.ATLAS_REPORTS_D1.prepare(
      `SELECT id, created_at, updated_at, status, customer_name, address_line_1, postcode, current_step
       FROM visits
       ORDER BY updated_at DESC
       LIMIT 50`
    ).all<Omit<VisitRow, "working_payload_json">>();

    return Response.json({ ok: true, visits: result.results ?? [] });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
};
