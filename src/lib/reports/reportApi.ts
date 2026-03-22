/**
 * reportApi.ts
 *
 * Thin API client for Atlas report endpoints.
 * All functions return the parsed JSON response or throw on network errors.
 */

import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { RecommendationPresentationState } from '../selection/optionSelection';
import type { DerivedFloorplanOutput } from '../../components/floorplan/floorplanDerivations';

export interface ReportMeta {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  title: string | null;
  customer_name: string | null;
  postcode: string | null;
  visit_id: string | null;
}

/** The canonical payload shape stored in a report row. */
export interface ReportPayload {
  surveyData: FullSurveyModelV1;
  engineInput: EngineInputV2_3;
  engineOutput: EngineOutputV1;
  decisionSynthesis: unknown;
  /**
   * PR3 — Presentation-layer selection state.
   *
   * Records both the recommended option and any customer-chosen preference.
   * The engine recommendation is never replaced — both coexist so the
   * difference is always visible.
   *
   * Absent in reports saved before PR3.  Consumers must treat as optional.
   */
  presentationState?: RecommendationPresentationState;
  /**
   * Optional floor-plan derived outputs captured when the user completes the
   * floor-plan tool before generating the report.
   *
   * Absent in reports saved before this field was introduced.  Consumers must
   * treat as optional.
   */
  floorplanOutput?: DerivedFloorplanOutput | null;
}

export interface ReportDetail extends ReportMeta {
  payload: ReportPayload;
}

/**
 * Extracts a user-friendly error message from a failed API response.
 */
async function extractApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null) as { error?: string } | null;
  return body?.error ?? fallback;
}

/**
 * GET /api/reports/:id
 *
 * Fetches a single persisted report including its payload.
 */
export async function getReport(id: string): Promise<ReportDetail> {
  const res = await fetch(`/api/reports/${encodeURIComponent(id)}`);
  if (res.status === 404) {
    throw new Error('Report not found');
  }
  if (!res.ok) {
    throw new Error(await extractApiError(res, 'Failed to load report'));
  }
  const data = await res.json() as { ok: true; report: ReportDetail };
  return data.report;
}

/**
 * POST /api/reports
 *
 * Persists a new report snapshot and returns its ID.
 */
export async function saveReport(opts: {
  postcode?: string | null;
  visit_id?: string | null;
  status?: string;
  payload: ReportPayload;
}): Promise<{ ok: true; id: string }> {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    throw new Error(await extractApiError(res, 'Failed to save report'));
  }
  return res.json() as Promise<{ ok: true; id: string }>;
}

/**
 * GET /api/visits/:visitId/reports
 *
 * Lists all reports linked to a visit, most-recent first.
 */
export async function listReportsForVisit(visitId: string): Promise<ReportMeta[]> {
  const res = await fetch(`/api/visits/${encodeURIComponent(visitId)}/reports`);
  if (res.status === 404) {
    throw new Error('Visit not found');
  }
  if (!res.ok) {
    throw new Error(await extractApiError(res, 'Failed to list reports'));
  }
  const data = await res.json() as { ok: true; reports: ReportMeta[] };
  return data.reports;
}

/**
 * PATCH /api/reports/:id
 *
 * Updates mutable fields on an existing report.
 * Currently supports: status, title.
 */
export async function updateReport(
  id: string,
  patch: { status?: string; title?: string },
): Promise<{ ok: true; id: string }> {
  const res = await fetch(`/api/reports/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (res.status === 404) {
    throw new Error('Report not found');
  }
  if (!res.ok) {
    throw new Error(await extractApiError(res, 'Failed to update report'));
  }
  return res.json() as Promise<{ ok: true; id: string }>;
}

/**
 * POST /api/reports  (duplicate)
 *
 * Creates a copy of an existing report with a fresh ID and "draft" status.
 * Fetches the source report then saves a new row.
 */
export async function duplicateReport(id: string): Promise<{ ok: true; id: string }> {
  const source = await getReport(id);
  return saveReport({
    postcode: source.postcode,
    visit_id: source.visit_id,
    status: 'draft',
    payload: source.payload,
  });
}
