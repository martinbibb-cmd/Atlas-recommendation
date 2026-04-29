import { isMissingTableError, SCHEMA_DRIFT_RESPONSE } from "../../_utils/errors";

/**
 * GET /api/visits/:id/reports
 *
 * Lists all reports linked to a visit, ordered by created_at descending.
 *
 * Response (200):
 *   {
 *     ok: true,
 *     reports: Array<{
 *       id, created_at, updated_at, status, title, customer_name, postcode, visit_id
 *     }>
 *   }
 *
 * Response (404) when no visit with that id exists:
 *   { ok: false, error: "Visit not found" }
 */

interface ReportMetaRow {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  title: string | null;
  customer_name: string | null;
  postcode: string | null;
  visit_id: string | null;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, params } = context;
  const visitId = params["id"] as string;

  try {
    // Verify the visit exists.
    const visitRow = await env.ATLAS_REPORTS_D1.prepare(
      "SELECT id FROM visits WHERE id = ?"
    )
      .bind(visitId)
      .first<{ id: string }>();

    if (visitRow == null) {
      return Response.json(
        { ok: false, error: "Visit not found" },
        { status: 404 }
      );
    }

    const { results } = await env.ATLAS_REPORTS_D1.prepare(
      `SELECT id, created_at, updated_at, status, title, customer_name, postcode, visit_id
       FROM reports
       WHERE visit_id = ?
       ORDER BY created_at DESC
       LIMIT 50`
    )
      .bind(visitId)
      .all<ReportMetaRow>();

    return Response.json({ ok: true, reports: results ?? [] });
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
