/**
 * GET /api/visits/:id
 *
 * Fetches a single Atlas visit record by its id.
 *
 * Response (200):
 *   {
 *     ok: true,
 *     visit: {
 *       id, created_at, updated_at, status,
 *       customer_name, address_line_1, postcode, current_step,
 *       working_payload: object   — parsed from working_payload_json
 *     }
 *   }
 *
 * Response (404) when no row with that id exists:
 *   { ok: false, error: "Visit not found" }
 *
 * PUT /api/visits/:id
 *
 * Updates a visit record's mutable fields.
 *
 * Request body (JSON, all optional):
 *   {
 *     customer_name?:     string
 *     address_line_1?:    string
 *     postcode?:          string
 *     current_step?:      string
 *     status?:            string
 *     working_payload?:   object
 *   }
 *
 * Response (200):
 *   { ok: true, id: string }
 *
 * Response (404) when no row with that id exists:
 *   { ok: false, error: "Visit not found" }
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

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const id = params["id"] as string;

  try {
    const row = await env.ATLAS_REPORTS_D1.prepare(
      `SELECT id, created_at, updated_at, status,
              customer_name, address_line_1, postcode, current_step, working_payload_json
       FROM visits WHERE id = ?`
    )
      .bind(id)
      .first<VisitRow>();

    if (row == null) {
      return Response.json(
        { ok: false, error: "Visit not found" },
        { status: 404 }
      );
    }

    const { working_payload_json, ...meta } = row;
    let working_payload: unknown;
    try {
      working_payload = JSON.parse(working_payload_json);
    } catch {
      return Response.json(
        { ok: false, error: "Corrupted visit data: working_payload_json is not valid JSON" },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      visit: { ...meta, working_payload },
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
};

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const id = params["id"] as string;

  // Verify the visit exists before updating
  const existing = await env.ATLAS_REPORTS_D1.prepare(
    "SELECT id FROM visits WHERE id = ?"
  )
    .bind(id)
    .first<{ id: string }>();

  if (existing == null) {
    return Response.json(
      { ok: false, error: "Visit not found" },
      { status: 404 }
    );
  }

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

  const now = new Date().toISOString();
  const setClauses: string[] = ["updated_at = ?"];
  const bindings: unknown[] = [now];

  if (typeof body.status === "string" && body.status.length > 0) {
    setClauses.push("status = ?");
    bindings.push(body.status);
  }
  if (typeof body.customer_name === "string") {
    setClauses.push("customer_name = ?");
    bindings.push(body.customer_name);
  }
  if (typeof body.address_line_1 === "string") {
    setClauses.push("address_line_1 = ?");
    bindings.push(body.address_line_1);
  }
  if (typeof body.postcode === "string") {
    setClauses.push("postcode = ?");
    bindings.push(body.postcode);
  }
  if (typeof body.current_step === "string") {
    setClauses.push("current_step = ?");
    bindings.push(body.current_step);
  }
  if (
    body.working_payload != null &&
    typeof body.working_payload === "object" &&
    !Array.isArray(body.working_payload)
  ) {
    setClauses.push("working_payload_json = ?");
    bindings.push(JSON.stringify(body.working_payload));
  }

  bindings.push(id);

  try {
    await env.ATLAS_REPORTS_D1.prepare(
      `UPDATE visits SET ${setClauses.join(", ")} WHERE id = ?`
    )
      .bind(...bindings)
      .run();

    return Response.json({ ok: true, id });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
};
