/**
 * VisitReportsList
 *
 * Renders a compact list of reports linked to a given visit.
 * Reports are shown newest first (API ordering).
 *
 * ⚠️ INTERNAL DIAGNOSTIC SURFACE ONLY
 * These reports are engine snapshot artefacts for QA and engineer review.
 * They must not be surfaced as a customer-facing primary output.
 *
 * Usage:
 *   - In VisitHubPage: rendered inside a collapsed "Internal diagnostics" section.
 *   - Not rendered in VisitPage (the customer-facing survey path).
 *
 * When internalOnly is true (the default), the section heading clearly marks it as internal-only.
 * Silently hides itself when the API is unavailable or the visit has no reports.
 */

import { useEffect, useState } from 'react';
import { listReportsForVisit, type ReportMeta } from '../../lib/reports/reportApi';
import './VisitReportsList.css';

interface Props {
  visitId: string;
  onOpenReport: (reportId: string) => void;
  /**
   * When true, renders the section with an "Internal diagnostic" heading and
   * a warning that this output is not customer-facing.  Defaults to true —
   * all call sites should keep this set to true.  Only set false if the
   * containing surface already has its own explicit internal-only warning
   * context and does not need this component to repeat the banner.
   */
  internalOnly?: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function reportLabel(r: ReportMeta): string {
  if (r.title) return r.title;
  if (r.postcode) return r.postcode;
  if (r.customer_name) return r.customer_name;
  return 'Untitled report';
}

export default function VisitReportsList({ visitId, onOpenReport, internalOnly = true }: Props) {
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listReportsForVisit(visitId)
      .then((data) => {
        if (!cancelled) setReports(data);
      })
      .catch((err: unknown) => {
        // Graceful fallback — API may be unavailable in local dev.
        console.error('[VisitReportsList] Failed to load reports:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visitId]);

  if (loading || reports.length === 0) return null;

  const headingId = `visit-reports-heading-${visitId.slice(-8)}`;

  return (
    <section
      className={`visit-reports${internalOnly ? ' visit-reports--internal' : ''}`}
      aria-labelledby={headingId}
      data-testid="visit-reports-list"
    >
      <h2 className="visit-reports__heading" id={headingId}>
        {internalOnly ? 'Internal diagnostics' : 'Reports'}
        <span className="visit-reports__count">
          {reports.length}
        </span>
        {internalOnly && (
          <span className="visit-reports__internal-badge" aria-label="Internal QA only — not customer-facing">
            QA only
          </span>
        )}
      </h2>
      {internalOnly && (
        <p className="visit-reports__internal-note">
          Engine snapshot artefacts for QA and engineer review. Not customer-facing outputs.
        </p>
      )}
      <ul className="visit-reports__list" role="list">
        {reports.map((r, idx) => {
          const isLatest = idx === 0;
          return (
            <li
              key={r.id}
              className={`visit-reports__row${isLatest ? ' visit-reports__row--latest' : ''}`}
              role="listitem"
            >
              <div className="visit-reports__info">
                <span className="visit-reports__title">{reportLabel(r)}</span>
                <span className="visit-reports__meta">{formatDate(r.created_at)}</span>
              </div>
              <div className="visit-reports__badges">
                {isLatest && (
                  <span className="visit-reports__badge visit-reports__badge--latest" aria-label="Latest report">
                    Latest
                  </span>
                )}
                <span
                  className={`visit-reports__status visit-reports__status--${r.status}`}
                  aria-label={`Status: ${r.status}`}
                >
                  {r.status}
                </span>
              </div>
              <button
                className="visit-reports__open-btn"
                onClick={() => onOpenReport(r.id)}
                aria-label={`Open report: ${reportLabel(r)}`}
              >
                Open →
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
