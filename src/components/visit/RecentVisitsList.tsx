/**
 * RecentVisitsList
 *
 * Renders a searchable, filterable list of the most recently updated visits
 * fetched from GET /api/visits.
 *
 * Each visit card shows:
 *   • Headline: visit reference / address / postcode / customer name (priority order)
 *   • Meta subline: last-updated date · secondary identifier
 *   • Status badge
 *   • Open button (routes to Visit Hub)
 *
 * Controls:
 *   • Text search: ref, address, postcode, or customer name
 *   • Date filter: narrows to visits updated on a specific date
 *   • Filter pills: All | Active | Completed | Needs follow-up
 *   • Clear filters: one-tap reset back to newest-first capped default
 *   • Default cap of 20 rows; "Show all" reveals the full result set
 *
 * Default behaviour: newest first (ordered by the API), capped at 20.
 * Any active search, date, or status filter bypasses the cap so no matches are hidden.
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
  isAnyFilterActive,
  cardSubline,
  buildListSummary,
} from './recentVisitsHelpers';
import { getVisitIdentity } from '../../visits/visitIdentityStore';
import { useWorkspaceSession } from '../../auth/profile';
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
  const headline = visitDisplayLabel(v);
  const statusKey = v.status.toLowerCase().replace(/[^a-z_]/g, '_');
  const label = visitStatusLabel(v.status);

  const secondary = cardSubline(v);
  const dateLabel = formatRelativeDate(v.updated_at);
  const meta = secondary ? `${dateLabel} · ${secondary}` : dateLabel;

  return (
    <li className="rv-card" role="listitem">
      <button className="rv-card__body" onClick={onOpen} aria-label={`Open visit: ${headline}`}>
        <div className="rv-card__main">
          <span className="rv-card__headline">{headline}</span>
          <span className="rv-card__meta">{meta}</span>
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
  const workspaceSession = useWorkspaceSession();
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

  /** Resets all filters and returns to the newest-first capped default view. */
  function clearFilters() {
    setSearch('');
    setDateFilter('');
    setFilter('all');
    setShowAll(false);
  }

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

  const {
    workspaceOwnedVisits,
    legacyUnownedVisits,
  } = useMemo(() => {
    if (workspaceSession.status !== 'workspace_active' || workspaceSession.activeWorkspace === null) {
      return {
        workspaceOwnedVisits: filtered,
        legacyUnownedVisits: [] as VisitMeta[],
      };
    }

    const owned: VisitMeta[] = [];
    const unowned: VisitMeta[] = [];
    for (const visit of filtered) {
      const identity = getVisitIdentity(visit.id);
      if (identity == null) {
        unowned.push(visit);
        continue;
      }
      if (identity.workspaceId === workspaceSession.activeWorkspace.workspaceId) {
        owned.push(visit);
      }
    }
    return {
      workspaceOwnedVisits: owned,
      legacyUnownedVisits: unowned,
    };
  }, [filtered, workspaceSession.activeWorkspace, workspaceSession.status]);

  // When any active filter narrows the list, always show all matching results.
  // The cap only applies to the default "show recent" state.
  const isFiltering = isAnyFilterActive(search, dateFilter, filter);
  const visibleItems = showAll || isFiltering
    ? workspaceOwnedVisits
    : workspaceOwnedVisits.slice(0, DEFAULT_LIST_LIMIT);
  const hasMore = !isFiltering && !showAll && workspaceOwnedVisits.length > DEFAULT_LIST_LIMIT;

  const listSummary = buildListSummary({
    isFiltering,
    showAll,
    visibleCount: visibleItems.length,
    totalFilteredCount: workspaceOwnedVisits.length,
  });

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

      {/* Search box */}
      <div className="rv-search-row">
        <input
          className="rv-search"
          type="search"
          placeholder="Search by ref or address"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search visits"
        />
      </div>

      {/* Date filter row */}
      <div className="rv-date-row">
        <label className="rv-date-label" htmlFor="rv-date-input">Date</label>
        <input
          id="rv-date-input"
          className={`rv-date-filter${dateFilter ? ' rv-date-filter--active' : ''}`}
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

      {/* Filter pills + reset */}
      <div className="rv-controls-footer">
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
        {isFiltering && (
          <button
            className="rv-reset-btn"
            type="button"
            onClick={clearFilters}
            aria-label="Clear all filters and return to recent visits"
          >
            Clear filters
          </button>
        )}
      </div>

      {visibleItems.length === 0 ? (
        <div className="rv-empty">
          <p className="rv-empty__message">No visits match this search.</p>
          {isFiltering && (
            <p className="rv-empty__hint">
              Try clearing the date filter or searching by reference.{' '}
              <button
                className="rv-empty__reset"
                type="button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="rv-list-summary" aria-live="polite">{listSummary}</p>

          <ul className="recent-visits__list" role="list">
            {visibleItems.map((v) => (
              <VisitCard key={v.id} v={v} onOpen={() => onOpenVisit(v.id)} />
            ))}
          </ul>

          {hasMore && (
            <div className="rv-show-more">
              <span className="rv-show-more__cap">Showing latest {DEFAULT_LIST_LIMIT} visits</span>
              <button
                className="rv-show-more__btn"
                type="button"
                onClick={() => setShowAll(true)}
              >
                Show all {workspaceOwnedVisits.length} visits
              </button>
            </div>
          )}
          {legacyUnownedVisits.length > 0 && (
            <div className="rv-legacy-warning" data-testid="recent-visits-legacy-warning">
              <strong>Legacy unowned visits</strong> are hidden from this workspace view.
              {legacyUnownedVisits.slice(0, 3).map((visit) => (
                <div key={visit.id} className="rv-legacy-warning__item">
                  ⚠ {visitDisplayLabel(visit)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
