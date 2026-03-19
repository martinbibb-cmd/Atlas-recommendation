/**
 * RecentVisitsList
 *
 * Renders a searchable, filterable list of the most recently updated visits
 * fetched from GET /api/visits.
 *
 * Each visit card shows:
 *   • Visit reference or address (prominent headline)
 *   • Address / postcode / customer name (subline)
 *   • Last updated (relative)
 *   • Status badge
 *   • Open button (routes to Visit Hub)
 *
 * Controls:
 *   • Text search: visit reference, address, postcode or customer name
 *   • Date filter: narrows to visits updated on a specific date
 *   • Filter pills: All | Active | Completed | Needs follow-up
 *   • Default cap of 20 rows; "Show all" reveals the full result set
 *
 * Default behaviour: newest first (ordered by the API), capped at 20.
 * Any active search or date filter bypasses the cap so no matches are hidden.
 *
 * If the API is unavailable (local dev without bindings, network error) the
 * list renders a graceful empty state rather than crashing.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  listVisits,
  visitStatusLabel,
  visitDisplayLabel,
  matchesFilter,
  type VisitMeta,
  type VisitFilterCategory,
} from '../../lib/visits/visitApi';
import {
  DEFAULT_LIST_LIMIT,
  matchesSearch,
  matchesDateFilter,
} from './recentVisitsHelpers';
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
  return visitDisplayLabel(v);
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
          {v.visit_reference && v.address_line_1 && (
            <span className="rv-card__customer">{v.address_line_1}{v.postcode ? `, ${v.postcode}` : ''}</span>
          )}
          {!v.visit_reference && v.customer_name && (
            <span className="rv-card__customer">{v.customer_name}</span>
          )}
          {!v.visit_reference && !v.customer_name && v.postcode && v.address_line_1 && (
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
  const [dateFilter, setDateFilter] = useState('');
  const [filter, setFilter] = useState<VisitFilterCategory>('all');
  const [showAll, setShowAll] = useState(false);

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
        (v) =>
          matchesSearch(v, search) &&
          matchesDateFilter(v, dateFilter) &&
          matchesFilter(v.status, filter),
      ),
    [visits, search, dateFilter, filter],
  );

  // When any active filter narrows the list, always show all matching results.
  // The cap only applies to the default "show recent" state.
  const isFiltering = search.trim() !== '' || dateFilter !== '' || filter !== 'all';
  const visibleItems = showAll || isFiltering ? filtered : filtered.slice(0, DEFAULT_LIST_LIMIT);
  const hasMore = !isFiltering && !showAll && filtered.length > DEFAULT_LIST_LIMIT;

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

      {/* Search + date filter row */}
      <div className="rv-search-row">
        <input
          className="rv-search"
          type="search"
          placeholder="Search by visit reference, address or customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search visits"
        />
        <input
          className="rv-date-filter"
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          aria-label="Filter by date updated"
          title="Filter by date updated"
        />
        {dateFilter && (
          <button
            className="rv-date-clear"
            type="button"
            onClick={() => setDateFilter('')}
            aria-label="Clear date filter"
          >
            ✕
          </button>
        )}
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

      {visibleItems.length === 0 ? (
        <p className="rv-empty">No visits match your search.</p>
      ) : (
        <>
          <ul className="recent-visits__list" role="list">
            {visibleItems.map((v) => (
              <VisitCard key={v.id} v={v} onOpen={() => onOpenVisit(v.id)} />
            ))}
          </ul>

          {hasMore && (
            <div className="rv-show-more">
              <button
                className="rv-show-more__btn"
                type="button"
                onClick={() => setShowAll(true)}
              >
                Show all {filtered.length} visits
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
