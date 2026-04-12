/**
 * GET  /api/reports/:id  — fetch a single report by ID
 * PATCH /api/reports/:id  — update mutable fields (status, title)
 *
 * GET Response (200):
 *   {
 *     ok: true,
 *     report: {
 *       id, created_at, updated_at, status, title,
 *       customer_name, postcode, visit_id,
 *       payload: object   — parsed from payload_json
 *     }
 *   }
 *
 * PATCH Request body (JSON, all fields optional):
 *   {
 *     status?: "draft" | "complete" | "archived"
 *     title?:  string
 *   }
 *
 * PATCH Response (200):
 *   { ok: true, id: string }
 *
 * Response (404) when no row with that id exists:
 *   { ok: false, error: "Report not found" }
 *
 * The ATLAS_REPORTS_D1 binding is wired in wrangler.jsonc and must be configured
 * in the Cloudflare Pages dashboard before deploying to production.
 */

import { isMissingTableError, SCHEMA_DRIFT_RESPONSE } from "../_utils/errors.js";

/** Valid report lifecycle statuses. */
const VALID_STATUSES = new Set(["draft", "complete", "archived"]);

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

function hasRenderableEngineOutput(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  // Legacy snapshots persist engineOutput at the root of the payload.
  if ("engineOutput" in payload) {
    return true;
  }

  // Canonical snapshots persist it under payload.engineRun.engineOutput.
  if (!("engineRun" in payload)) {
    return false;
  }

  const engineRun = (payload as { engineRun?: unknown }).engineRun;
  if (typeof engineRun !== "object" || engineRun === null) {
    return false;
  }

  return "engineOutput" in engineRun;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const id = params["id"] as string;

  try {
    const row = await env.ATLAS_REPORTS_D1.prepare(
      "SELECT id, created_at, updated_at, status, title, customer_name, postcode, visit_id, payload_json FROM reports WHERE id = ?"
    )
      .bind(id)
      .first<ReportRow>();

    if (row == null) {
      return Response.json(
        { ok: false, error: "Report not found" },
        { status: 404 }
      );
    }

    const { payload_json, ...meta } = row;
    let payload: unknown;
    try {
      payload = JSON.parse(payload_json);
    } catch {
      return Response.json(
        { ok: false, error: "Corrupted report data: payload_json is not valid JSON" },
        { status: 500 }
      );
    }

    // Validate that essential payload fields exist so callers can trust the shape.
    if (!hasRenderableEngineOutput(payload)) {
      return Response.json(
        {
          ok: false,
          error:
            "Incomplete report snapshot: payload is missing required engine output",
        },
        { status: 422 }
      );
    }

    return Response.json({
      ok: true,
      report: {
        ...meta,
        payload,
      },
    });
  } catch (err) {
    if (isMissingTableError(err)) {
      return Response.json(SCHEMA_DRIFT_RESPONSE, { status: 503 });
    }
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
};

/**
 * PATCH /api/reports/:id
 *
 * Updates mutable fields on an existing report row.
 * Accepted fields: status, title.
 */
export const onRequestPatch: PagesFunction<Env> = async (context) => {
  const { env, params, request } = context;
  const id = params["id"] as string;

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json(
      { ok: false, error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }

  // Verify the report exists before attempting to update.
  try {
    const existing = await env.ATLAS_REPORTS_D1.prepare(
      "SELECT id FROM reports WHERE id = ?"
    )
      .bind(id)
      .first<{ id: string }>();

    if (existing == null) {
      return Response.json(
        { ok: false, error: "Report not found" },
        { status: 404 }
      );
    }
  } catch (err) {
    if (isMissingTableError(err)) {
      return Response.json(SCHEMA_DRIFT_RESPONSE, { status: 503 });
    }
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }

  // Build the SET clause dynamically from provided fields.
  const setClauses: string[] = [];
  const bindings: unknown[] = [];

  if (typeof body.status === "string") {
    if (body.status.length === 0) {
      return Response.json(
        { ok: false, error: "status must not be an empty string" },
        { status: 400 }
      );
    }
    if (!VALID_STATUSES.has(body.status)) {
      return Response.json(
        {
          ok: false,
          error: `Invalid status "${body.status}". Accepted values: ${[...VALID_STATUSES].join(", ")}`,
        },
        { status: 400 }
      );
    }
    setClauses.push("status = ?");
    bindings.push(body.status);
  }

  if (typeof body.title === "string") {
    setClauses.push("title = ?");
    bindings.push(body.title);
  }

  if (setClauses.length === 0) {
    return Response.json(
      { ok: false, error: "No patchable fields provided (accepted: status, title)" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  setClauses.push("updated_at = ?");
  bindings.push(now);
  bindings.push(id);

  try {
    await env.ATLAS_REPORTS_D1.prepare(
      `UPDATE reports SET ${setClauses.join(", ")} WHERE id = ?`
    )
      .bind(...bindings)
      .run();

    return Response.json({ ok: true, id });
  } catch (err) {
    if (isMissingTableError(err)) {
      return Response.json(SCHEMA_DRIFT_RESPONSE, { status: 503 });
    }
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
};
