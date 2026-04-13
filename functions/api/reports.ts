import { withD1CircuitBreaker } from "./_utils/circuitBreaker.js";

/**
 * POST /api/reports
 *
 * Creates a new persisted Atlas report row in D1.
 *
 * Request body (JSON):
 *   {
 *     id?:            string   — optional; generated via crypto.randomUUID() if absent
 *     title?:         string
 *     customer_name?: string
 *     postcode?:      string
 *     status?:        string   — defaults to "draft"
 *     payload:        object   — required; canonical report snapshot
 *                               { surveyData, engineInput, engineOutput, decisionSynthesis }
 *   }
 *
 * Response (201):
 *   { ok: true, id: string }
 *
 * Response (400) when payload is missing or body is not valid JSON:
 *   { ok: false, error: string }
 *
 * The ATLAS_REPORTS_D1 binding is wired in wrangler.jsonc and must be configured
 * in the Cloudflare Pages dashboard before deploying to production.
 * Apply the schema with: npm run db:migrate:remote
 */

interface ReportRow {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  title: string | null;
  customer_name: string | null;
  postcode: string | null;
  visit_id: string | null;
  payload_json: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { env, request } = context;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  if (body.payload == null || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    return Response.json(
      { ok: false, error: "Missing required field: payload" },
      { status: 400 }
    );
  }

  const id: string =
    typeof body.id === "string" && body.id.length > 0
      ? body.id
      : crypto.randomUUID();

  const now = new Date().toISOString();
  const status =
    typeof body.status === "string" && body.status.length > 0
      ? body.status
      : "draft";

  const title = typeof body.title === "string" ? body.title : null;
  const customerName =
    typeof body.customer_name === "string" ? body.customer_name : null;
  const postcode =
    typeof body.postcode === "string" ? body.postcode : null;
  const visitId =
    typeof body.visit_id === "string" && body.visit_id.length > 0
      ? body.visit_id
      : null;

  const payloadJson = JSON.stringify(body.payload);

  const result = await withD1CircuitBreaker(() =>
    env.ATLAS_REPORTS_D1.prepare(
      `INSERT INTO reports
         (id, created_at, updated_at, status, title, customer_name, postcode, visit_id, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, now, now, status, title, customerName, postcode, visitId, payloadJson)
      .run()
  );

  if (!result.ok) {
    return result.response;
  }

  return Response.json({ ok: true, id }, { status: 201 });
};
