/**
 * GET /api/reports/:id
 *
 * Fetches a single persisted Atlas report by its id.
 *
 * Response (200):
 *   {
 *     ok: true,
 *     report: {
 *       id, created_at, updated_at, status, title,
 *       customer_name, postcode,
 *       payload: object   — parsed from payload_json
 *     }
 *   }
 *
 * Response (404) when no row with that id exists:
 *   { ok: false, error: "Report not found" }
 *
 * The ATLAS_REPORTS_D1 binding is wired in wrangler.jsonc and must be configured
 * in the Cloudflare Pages dashboard before deploying to production.
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
    return Response.json({
      ok: true,
      report: {
        ...meta,
        payload,
      },
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
};
