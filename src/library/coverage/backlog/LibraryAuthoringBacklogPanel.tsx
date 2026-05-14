import { useMemo, useState } from 'react';
import { buildLibraryCoverageAudit } from '../buildLibraryCoverageAudit';
import { buildLibraryAuthoringBacklog } from './buildLibraryAuthoringBacklog';
import type {
  LibraryAuthoringBacklogItemV1,
  LibraryAuthoringBacklogPriorityV1,
  LibraryAuthoringBacklogStatusV1,
  LibraryAuthoringGapTypeV1,
} from './LibraryAuthoringBacklogItemV1';

const PRIORITY_ORDER: readonly LibraryAuthoringBacklogPriorityV1[] = ['blocker', 'high', 'medium', 'low'];

const GAP_TYPE_ORDER: readonly LibraryAuthoringGapTypeV1[] = [
  'projection_safety',
  'lived_experience',
  'what_you_may_notice',
  'misconception_reality',
  'diagram',
  'animation',
  'print_card',
  'journey_routing',
];

const STATUS_OPTIONS: readonly LibraryAuthoringBacklogStatusV1[] = [
  'open',
  'in_progress',
  'done',
  'accepted_risk',
];

type QuickFilter = 'all' | 'customer_blockers' | 'visual_gaps' | 'print_gaps' | 'unrouted';

const QUICK_FILTER_LABELS: Record<QuickFilter, string> = {
  all: 'All items',
  customer_blockers: 'Customer blockers',
  visual_gaps: 'Visual gaps',
  print_gaps: 'Print gaps',
  unrouted: 'Unrouted',
};

const PRIORITY_STYLES: Record<LibraryAuthoringBacklogPriorityV1, { background: string; color: string }> = {
  blocker: { background: '#fee2e2', color: '#991b1b' },
  high: { background: '#ffedd5', color: '#9a3412' },
  medium: { background: '#fef3c7', color: '#92400e' },
  low: { background: '#dbeafe', color: '#1d4ed8' },
};

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function sortItems(items: readonly LibraryAuthoringBacklogItemV1[]): LibraryAuthoringBacklogItemV1[] {
  const rank = new Map(PRIORITY_ORDER.map((priority, index) => [priority, index]));
  return [...items].sort((left, right) => {
    const priorityDelta = (rank.get(left.priority) ?? 0) - (rank.get(right.priority) ?? 0);
    if (priorityDelta !== 0) return priorityDelta;
    return left.title.localeCompare(right.title);
  });
}

export function LibraryAuthoringBacklogPanel() {
  const coverageAudit = useMemo(() => buildLibraryCoverageAudit(), []);
  const backlog = useMemo(() => buildLibraryAuthoringBacklog(coverageAudit), [coverageAudit]);
  const [localStatuses, setLocalStatuses] = useState<Record<string, LibraryAuthoringBacklogStatusV1>>({});
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');

  const filteredItems = useMemo(() => {
    const items = backlog.backlogItems;

    switch (quickFilter) {
      case 'customer_blockers':
        return items.filter((item) => item.priority === 'blocker' && item.affectedAudiences.includes('customer'));
      case 'visual_gaps':
        return items.filter((item) => item.gapType === 'diagram' || item.gapType === 'animation');
      case 'print_gaps':
        return items.filter((item) => item.gapType === 'print_card');
      case 'unrouted':
        return items.filter((item) => item.gapType === 'journey_routing');
      default:
        return items;
    }
  }, [backlog.backlogItems, quickFilter]);

  const byPriority = useMemo(
    () => PRIORITY_ORDER.map((priority) => ({
      priority,
      items: sortItems(filteredItems.filter((item) => item.priority === priority)),
    })).filter((group) => group.items.length > 0),
    [filteredItems],
  );

  const byGapType = useMemo(
    () => GAP_TYPE_ORDER.map((gapType) => ({
      gapType,
      items: sortItems(filteredItems.filter((item) => item.gapType === gapType)),
    })).filter((group) => group.items.length > 0),
    [filteredItems],
  );

  if (backlog.backlogItems.length === 0) return null;

  return (
    <section
      style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#f8fafc', padding: '0.75rem' }}
      data-testid="library-authoring-backlog-panel"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Library authoring backlog</p>
          <p style={{ margin: '0.15rem 0 0', fontSize: 11, color: '#64748b' }}>
            Prioritised authoring tasks generated from coverage gaps.
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }} data-testid="library-authoring-backlog-count">
          {filteredItems.length}
          {' '}
          item{filteredItems.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {(Object.keys(QUICK_FILTER_LABELS) as QuickFilter[]).map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setQuickFilter(filter)}
            data-testid={`library-authoring-backlog-filter-${filter}`}
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 10,
              border: '1px solid',
              borderColor: quickFilter === filter ? '#2563eb' : '#cbd5e1',
              background: quickFilter === filter ? '#eff6ff' : '#fff',
              color: quickFilter === filter ? '#1d4ed8' : '#475569',
              cursor: 'pointer',
            }}
          >
            {QUICK_FILTER_LABELS[filter]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <section data-testid="library-authoring-backlog-group-by-priority">
          <h4 style={{ margin: '0 0 0.4rem', fontSize: 12 }}>Grouped by priority</h4>
          {byPriority.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>No backlog items match this filter.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {byPriority.map((group) => (
                <section key={group.priority} data-testid={`library-authoring-backlog-priority-${group.priority}`}>
                  <h5 style={{ margin: '0 0 0.25rem', fontSize: 11, textTransform: 'uppercase', color: '#334155' }}>
                    {formatLabel(group.priority)} ({group.items.length})
                  </h5>
                  <div style={{ display: 'grid', gap: '0.45rem' }}>
                    {group.items.map((item) => {
                      const selectedStatus = localStatuses[item.backlogItemId] ?? item.status;
                      const priorityStyle = PRIORITY_STYLES[item.priority];
                      return (
                        <article
                          key={item.backlogItemId}
                          style={{ border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', padding: '0.6rem', display: 'grid', gap: '0.3rem' }}
                          data-testid={`library-authoring-backlog-item-${item.backlogItemId}`}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: 12, color: '#0f172a' }}>{item.title}</strong>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    borderRadius: 999,
                                    padding: '0.12rem 0.45rem',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    ...priorityStyle,
                                  }}
                                >
                                  {item.priority}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: '#475569', marginTop: '0.1rem' }}>
                                <strong>Gap:</strong>
                                {' '}
                                {formatLabel(item.gapType)}
                                {' · '}
                                <strong>Concept:</strong>
                                {' '}
                                {item.conceptId}
                              </div>
                            </div>
                            <label style={{ display: 'grid', gap: '0.2rem', fontSize: 11, color: '#475569' }}>
                              Status
                              <select
                                value={selectedStatus}
                                onChange={(event) => {
                                  const nextStatus = event.target.value as LibraryAuthoringBacklogStatusV1;
                                  setLocalStatuses((current) => ({
                                    ...current,
                                    [item.backlogItemId]: nextStatus,
                                  }));
                                }}
                                style={{ fontFamily: 'monospace', fontSize: 11, padding: '0.25rem 0.4rem' }}
                                data-testid={`library-authoring-backlog-status-${item.backlogItemId}`}
                              >
                                {STATUS_OPTIONS.map((status) => (
                                  <option key={status} value={status}>{formatLabel(status)}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div style={{ fontSize: 11, color: '#0f172a' }}>
                            <strong>Suggested action:</strong>
                            {' '}
                            {item.suggestedAction}
                          </div>
                          <div style={{ fontSize: 11, color: '#475569' }}>
                            <strong>Audiences:</strong>
                            {' '}
                            {item.affectedAudiences.join(', ')}
                            {' · '}
                            <strong>Journeys:</strong>
                            {' '}
                            {item.relatedJourneyIds.length > 0 ? item.relatedJourneyIds.join(', ') : 'none'}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section data-testid="library-authoring-backlog-group-by-gap-type">
          <h4 style={{ margin: '0 0 0.4rem', fontSize: 12 }}>Grouped by gap type</h4>
          {byGapType.length === 0 ? (
            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>No backlog items match this filter.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.35rem' }}>
              {byGapType.map((group) => (
                <div key={group.gapType} style={{ fontSize: 11, color: '#334155' }} data-testid={`library-authoring-backlog-gap-${group.gapType}`}>
                  <strong>{formatLabel(group.gapType)}:</strong>
                  {' '}
                  {group.items.length}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
