/**
 * VisitReportsList
 *
 * Renders a compact list of reports linked to a given visit.
 * Reports are shown newest first (API ordering).
 * The most recent report is badged "Latest"; older reports are shown as history.
 * Silently hides itself when the API is unavailable or the visit has no reports.
 */

import { useEffect, useState } from 'react';
import { listReportsForVisit, type ReportMeta } from '../../lib/reports/reportApi';
import './VisitReportsList.css';

interface Props {
  visitId: string;
  onOpenReport: (reportId: string) => void;
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

export default function VisitReportsList({ visitId, onOpenReport }: Props) {
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
    <section className="visit-reports" aria-labelledby={headingId}>
      <h2 className="visit-reports__heading" id={headingId}>
        Reports
        <span className="visit-reports__count" aria-label={`${reports.length} report${reports.length !== 1 ? 's' : ''}`}>
          {reports.length}
        </span>
      </h2>
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
