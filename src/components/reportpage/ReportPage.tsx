/**
 * ReportPage
 *
 * Renders a saved Atlas report from persisted payload.
 * Fetches the report by ID from GET /api/reports/:id and passes the stored
 * engine output + survey data to DecisionSynthesisPage.
 *
 * This is the target of share links and QR codes (e.g. /report/:id).
 * It renders the recommendation from the persisted snapshot, not live state.
 */

import { useEffect, useState } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import { getReport, type ReportMeta } from '../../lib/reports/reportApi';
import DecisionSynthesisPage from '../advice/DecisionSynthesisPage';
import { buildCompareSeedFromSurvey } from '../../lib/simulator/buildCompareSeedFromSurvey';
import './ReportPage.css';

interface Props {
  reportId: string;
  onBack?: () => void;
}

export default function ReportPage({ reportId, onBack }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [engineOutput, setEngineOutput] = useState<EngineOutputV1 | null>(null);
  const [surveyData, setSurveyData] = useState<FullSurveyModelV1 | null>(null);

  useEffect(() => {
    let cancelled = false;
    getReport(reportId)
      .then((report) => {
        if (cancelled) return;
        const { payload, ...reportMeta } = report;
        setMeta(reportMeta);
        setEngineOutput(payload.engineOutput);
        setSurveyData(payload.surveyData ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  if (loading) {
    return (
      <div className="report-page__loading" role="status" aria-live="polite">
        Loading report…
      </div>
    );
  }

  if (error || engineOutput == null) {
    return (
      <div className="report-page__error" role="alert">
        <p>{error ?? 'Report could not be loaded.'}</p>
        {onBack && (
          <button className="cta-btn" onClick={onBack}>
            ← Back to home
          </button>
        )}
      </div>
    );
  }

  // Build compare seed from saved survey + engine output if available.
  const compareSeed =
    surveyData != null
      ? buildCompareSeedFromSurvey(surveyData, engineOutput)
      : undefined;

  return (
    <div className="report-page">
      {/* Shared report banner */}
      <div className="report-page__banner" aria-label="Shared report">
        <span className="report-page__banner-label">
          📋 Shared Atlas report
        </span>
        {meta?.postcode && (
          <span className="report-page__banner-postcode">{meta.postcode}</span>
        )}
        {meta?.created_at && (
          <span className="report-page__banner-date">
            {new Date(meta.created_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        )}
        {onBack && (
          <button
            className="report-page__home-btn"
            onClick={onBack}
            aria-label="Back to Atlas home"
          >
            ← Home
          </button>
        )}
      </div>

      {/* Report metadata strip */}
      {meta && (
        <dl className="report-page__meta-strip" aria-label="Report details">
          <div className="report-page__meta-item">
            <dt>Report ID</dt>
            <dd className="report-page__meta-id">{meta.id}</dd>
          </div>
          <div className="report-page__meta-item">
            <dt>Created</dt>
            <dd>
              {new Date(meta.created_at).toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </dd>
          </div>
          {meta.visit_id && (
            <div className="report-page__meta-item">
              <dt>Visit ID</dt>
              <dd className="report-page__meta-id">{meta.visit_id}</dd>
            </div>
          )}
          <div className="report-page__meta-item">
            <dt>Status</dt>
            <dd>
              <span
                className={`report-page__status-badge report-page__status-badge--${meta.status}`}
              >
                {meta.status}
              </span>
            </dd>
          </div>
        </dl>
      )}

      <DecisionSynthesisPage
        engineOutput={engineOutput}
        surveyData={surveyData ?? undefined}
        compareSeed={compareSeed}
      />
    </div>
  );
}
