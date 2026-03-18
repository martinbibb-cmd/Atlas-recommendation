/**
 * RecentVisitsList
 *
 * Renders a searchable, filterable list of the most recently updated visits
 * fetched from GET /api/visits.
 *
 * Each visit card shows:
 *   • Address (prominent)
 *   • Customer name
 *   • Last updated (relative)
 *   • Status badge
 *   • Open button (routes to Visit Hub)
 *
 * Controls:
 *   • Search by address or customer name
 *   • Filter pills: All | Active | Completed | Needs follow-up
 *
 * If the API is unavailable (local dev without bindings, network error) the
 * list renders a graceful empty state rather than crashing.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  listVisits,
  visitStatusLabel,
  matchesFilter,
  type VisitMeta,
  type VisitFilterCategory,
} from '../../lib/visits/visitApi';
import './RecentVisitsList.css';

interface Props {
  /** Called when the user taps a visit card — routes to Visit Hub. */
  onOpenVisit: (visitId: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

/** Returns a relative date label (Today / Yesterday / N days ago / full date). */
function formatRelativeDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / MILLISECONDS_PER_DAY);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

/** Prominent address line for the card. */
function cardAddress(v: VisitMeta): string {
  if (v.address_line_1) return v.address_line_1;
  if (v.postcode) return v.postcode;
  return `Visit ${v.id.slice(-8).toUpperCase()}`;
}

/** Returns true when the query matches address or customer name (case-insensitive). */
function matchesSearch(v: VisitMeta, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    (v.address_line_1?.toLowerCase().includes(q) ?? false) ||
    (v.postcode?.toLowerCase().includes(q) ?? false) ||
    (v.customer_name?.toLowerCase().includes(q) ?? false)
  );
}

// ─── Filter pill labels ───────────────────────────────────────────────────────

const FILTER_LABELS: Record<VisitFilterCategory, string> = {
  all:            'All',
  active:         'Active',
  completed:      'Completed',
  needs_followup: 'Needs follow-up',
};

const FILTERS: VisitFilterCategory[] = ['all', 'active', 'completed', 'needs_followup'];

// ─── Visit card ───────────────────────────────────────────────────────────────

function VisitCard({ v, onOpen }: { v: VisitMeta; onOpen: () => void }) {
  const address = cardAddress(v);
  const statusKey = v.status.toLowerCase().replace(/[^a-z_]/g, '_');
  const label = visitStatusLabel(v.status);

  return (
    <li className="rv-card" role="listitem">
      <button className="rv-card__body" onClick={onOpen} aria-label={`Open visit: ${address}`}>
        <div className="rv-card__main">
          <span className="rv-card__address">{address}</span>
          {v.customer_name && (
            <span className="rv-card__customer">{v.customer_name}</span>
          )}
          {!v.customer_name && v.postcode && v.address_line_1 && (
            <span className="rv-card__customer">{v.postcode}</span>
          )}
          <span className="rv-card__updated">Updated {formatRelativeDate(v.updated_at)}</span>
        </div>
        <div className="rv-card__side">
          <span
            className={`rv-card__status rv-card__status--${statusKey}`}
            aria-label={`Status: ${label}`}
          >
            {label}
          </span>
          <span className="rv-card__arrow" aria-hidden="true">›</span>
        </div>
      </button>
    </li>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function RecentVisitsList({ onOpenVisit }: Props) {
  const [visits, setVisits] = useState<VisitMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<VisitFilterCategory>('all');

  useEffect(() => {
    let cancelled = false;
    listVisits()
      .then((data) => {
        if (!cancelled) setVisits(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
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

  const filtered = useMemo(
    () =>
      visits.filter(
        (v) => matchesSearch(v, search) && matchesFilter(v.status, filter)
      ),
    [visits, search, filter]
  );

  if (loading) {
    return (
      <div className="recent-visits__loading" role="status" aria-live="polite">
        Loading recent visits…
      </div>
    );
  }

  if (error || visits.length === 0) {
    return null;
  }

  return (
    <section className="recent-visits" aria-label="Recent visits">
      <h2 className="recent-visits__heading">Recent visits</h2>

      {/* Search */}
      <div className="rv-search-row">
        <input
          className="rv-search"
          type="search"
          placeholder="Search by address or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search visits"
        />
      </div>

      {/* Filter pills */}
      <div className="rv-filters" role="group" aria-label="Filter visits">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`rv-filter-pill${filter === f ? ' rv-filter-pill--active' : ''}`}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rv-empty">No visits match your search.</p>
      ) : (
        <ul className="recent-visits__list" role="list">
          {filtered.map((v) => (
            <VisitCard key={v.id} v={v} onOpen={() => onOpenVisit(v.id)} />
          ))}
        </ul>
      )}
    </section>
  );
}
