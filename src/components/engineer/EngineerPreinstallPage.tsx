/**
 * EngineerPreinstallPage.tsx
 *
 * PR11 — Dedicated pre-install engineer route.
 *
 * This page gives an installer or second engineer a complete operational picture
 * of the job before attending:
 *   1. Job summary       — address, reference, status, current/recommended system
 *   2. Layout summary    — captured rooms, components, and evidence counts
 *   3. Current system    — what Atlas understood about the property
 *   4. Required work     — what needs to happen and why
 *   5. Before you start   — quick confirmations and low-confidence assumptions
 *   6. Evidence          — grouped evidence inspector
 *   7. Visit replay      — survey snapshot, voice notes, and note decision trail
 *
 * Data source: canonical atlasProperty + engineRun from the report payload.
 * The portal journey model is not used here — this page is operational, not
 * sales-oriented.
 */

import { useEffect, useRef, useState } from 'react';
import { getVisit } from '../../lib/visits/visitApi';
import { listReportsForVisit, getReport } from '../../lib/reports/reportApi';
import type { VisitMeta } from '../../lib/visits/visitApi';
import type { FullSurveyModelV1 } from '../../ui/fullSurvey/FullSurveyModelV1';
import type { VoiceNote } from '../../features/voiceNotes/voiceNoteTypes';
import { buildEngineerDisplayModel } from './selectors/buildEngineerDisplayModel';
import { EngineerJobSummaryCard } from './EngineerJobSummaryCard';
import { EngineerLayoutSummary } from './EngineerLayoutSummary';
import { EngineerCurrentSystemPanel } from './EngineerCurrentSystemPanel';
import { EngineerRequiredWorkPanel } from './EngineerRequiredWorkPanel';
import { EngineerWarningsPanel } from './EngineerWarningsPanel';
import { EngineerEvidencePanel } from './EngineerEvidencePanel';
import { VisitReplayPanel } from '../visit/VisitReplayPanel';

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  visitId: string;
  onBack: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EngineerPreinstallPage({ visitId, onBack }: Props) {
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [visitMeta, setVisitMeta] = useState<VisitMeta | null>(null);
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>([]);

  // The raw report payload and survey — used to build the display model.
  const reportPayloadRef = useRef<unknown>(null);
  const surveyRef        = useRef<FullSurveyModelV1 | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Load the visit record for meta (address, reference, status).
        const visitDetail = await getVisit(visitId);
        const { working_payload, ...meta } = visitDetail;

        if (cancelled) return;

        setVisitMeta(meta);

        // Hydrate voice notes from the working payload.
        const payload = working_payload as Partial<FullSurveyModelV1> | null;
        const persistedNotes = payload?.fullSurvey?.voiceNotes;
        if (Array.isArray(persistedNotes)) setVoiceNotes(persistedNotes);

        // Keep the survey for VisitReplayPanel.
        surveyRef.current = working_payload as unknown as FullSurveyModelV1 | null;

        // Load the latest report payload for the display model.
        const reports = await listReportsForVisit(visitId);
        if (!cancelled && reports.length > 0) {
          // Fetch the full report (including payload) for the most recent report.
          const reportDetail = await getReport(reports[0].id);
          if (!cancelled) {
            reportPayloadRef.current = reportDetail.payload;
          }
        } else if (!cancelled) {
          // No report saved yet — use the working_payload as fallback.
          reportPayloadRef.current = working_payload;
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [visitId]);

  if (loading) {
    return (
      <div
        data-testid="engineer-preinstall-loading"
        role="status"
        aria-live="polite"
        style={{ padding: '2rem', textAlign: 'center', color: '#718096' }}
      >
        Loading engineer view…
      </div>
    );
  }

  if (error) {
    return (
      <div data-testid="engineer-preinstall-error" role="alert" style={{ padding: '2rem' }}>
        <p style={{ color: '#742a2a' }}>Could not load engineer view: {error}</p>
        <button
          style={{ marginTop: '0.75rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
          onClick={onBack}
        >
          ← Back
        </button>
      </div>
    );
  }

  const displayModel = buildEngineerDisplayModel(
    reportPayloadRef.current,
    visitMeta,
    visitId,
  );

  return (
    <div
      data-testid="engineer-preinstall-page"
      style={{
        maxWidth: '720px',
        margin: '0 auto',
        padding: '1rem 1rem 3rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Back / header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        marginBottom: '1rem',
        padding: '0.5rem 0',
        borderBottom: '1px solid #e2e8f0',
      }}>
        <button
          aria-label="Back to visit hub"
          onClick={onBack}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            color: '#4a5568',
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
          }}
        >
          ←
        </button>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Pre-install engineer view
        </span>
      </div>

      {/* No engine output available */}
      {!displayModel ? (
        <div
          data-testid="engineer-preinstall-no-data"
          style={{
            background: '#fffff0',
            border: '1px solid #fefcbf',
            borderRadius: '8px',
            padding: '1.25rem',
            marginBottom: '1rem',
          }}
        >
          <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: '#744210' }}>
            ⚠️ Recommendation not yet available
          </p>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#744210' }}>
            The survey needs to be completed before the engineer view can show recommendation details.
            Complete the survey to unlock the full pre-install view.
          </p>
        </div>
      ) : (
        <>
          <EngineerJobSummaryCard model={displayModel} />
          <EngineerLayoutSummary model={displayModel} />
          <EngineerCurrentSystemPanel model={displayModel} />
          <EngineerRequiredWorkPanel model={displayModel} />
          <EngineerWarningsPanel model={displayModel} />
          <EngineerEvidencePanel model={displayModel} />
        </>
      )}

      {/* Visit replay — available regardless of display model (uses survey + voice notes) */}
      <VisitReplayPanel
        survey={surveyRef.current}
        voiceNotes={voiceNotes}
      />
    </div>
  );
}
