/**
 * VisitReportsList
 *
 * Renders a compact list of reports linked to a given visit.
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

  return (
    <section className="visit-reports" aria-label="Reports for this visit">
      <h2 className="visit-reports__heading">Reports</h2>
      <ul className="visit-reports__list" role="list">
        {reports.map((r) => (
          <li key={r.id} className="visit-reports__row" role="listitem">
            <div className="visit-reports__info">
              <span className="visit-reports__title">{reportLabel(r)}</span>
              <span className="visit-reports__meta">{formatDate(r.created_at)}</span>
            </div>
            <span
              className={`visit-reports__status visit-reports__status--${r.status}`}
              aria-label={`Status: ${r.status}`}
            >
              {r.status}
            </span>
            <button
              className="visit-reports__open-btn"
              onClick={() => onOpenReport(r.id)}
              aria-label={`Open report: ${reportLabel(r)}`}
            >
              Open →
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
