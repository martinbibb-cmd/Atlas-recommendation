/**
 * RecentVisitsList
 *
 * Renders a compact list of the most recently updated visits fetched from
 * GET /api/visits.  Each row shows the created date, postcode or title,
 * status, and an "Open" action button.
 *
 * If the API is unavailable (local dev without bindings, network error) the
 * list renders a graceful empty state rather than crashing.
 */

import { useEffect, useState } from 'react';
import { listVisits, type VisitMeta } from '../../lib/visits/visitApi';
import './RecentVisitsList.css';

interface Props {
  /** Called when the user clicks "Open" on a visit row. */
  onOpenVisit: (visitId: string) => void;
}

/** Returns a short human-readable date label (e.g. "17 Mar 2026"). */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** Returns a short display title for a visit row. */
function visitTitle(v: VisitMeta): string {
  if (v.customer_name) return v.customer_name;
  if (v.postcode) return v.postcode;
  if (v.address_line_1) return v.address_line_1;
  return `Visit ${v.id.slice(0, 8)}`;
}

export default function RecentVisitsList({ onOpenVisit }: Props) {
  const [visits, setVisits] = useState<VisitMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listVisits()
      .then((data) => {
        if (!cancelled) setVisits(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // Graceful fallback — API may be unavailable in local dev.
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="recent-visits__loading" role="status" aria-live="polite">
        Loading recent visits…
      </div>
    );
  }

  if (error || visits.length === 0) {
    // Silently hide when no visits exist or API is unreachable.
    return null;
  }

  return (
    <section className="recent-visits" aria-label="Recent visits">
      <h2 className="recent-visits__heading">Recent visits</h2>
      <ul className="recent-visits__list" role="list">
        {visits.map((v) => (
          <li key={v.id} className="recent-visits__row" role="listitem">
            <div className="recent-visits__info">
              <span className="recent-visits__title">{visitTitle(v)}</span>
              <span className="recent-visits__meta">
                {formatDate(v.updated_at)}
                {v.current_step && (
                  <span className="recent-visits__step"> · {v.current_step}</span>
                )}
              </span>
            </div>
            <span
              className={`recent-visits__status recent-visits__status--${v.status}`}
              aria-label={`Status: ${v.status}`}
            >
              {v.status}
            </span>
            <button
              className="recent-visits__open-btn"
              onClick={() => onOpenVisit(v.id)}
              aria-label={`Open visit: ${visitTitle(v)}`}
            >
              Open →
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
