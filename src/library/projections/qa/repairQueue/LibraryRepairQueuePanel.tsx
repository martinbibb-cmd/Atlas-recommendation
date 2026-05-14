import { useMemo, useState } from 'react';
import type { ProjectionSafetyRepairPlanV1 } from '../buildProjectionSafetyRepairPlan';
import { buildLibraryRepairQueue } from './buildLibraryRepairQueue';
import type {
  LibraryRepairQueueAreaV1,
  LibraryRepairQueueItemV1,
  LibraryRepairQueuePriorityV1,
  LibraryRepairQueueStatusV1,
} from './LibraryRepairQueueItemV1';

const AREA_ORDER: readonly LibraryRepairQueueAreaV1[] = [
  'audience_routing',
  'copy_rewrite',
  'diagram_coverage',
  'lived_experience_content',
  'taxonomy_mapping',
];

const AREA_LABELS: Record<LibraryRepairQueueAreaV1, string> = {
  audience_routing: 'Audience routing',
  copy_rewrite: 'Copy rewrite',
  diagram_coverage: 'Diagram coverage',
  lived_experience_content: 'Lived-experience content',
  taxonomy_mapping: 'Taxonomy mapping',
};

const PRIORITY_STYLES: Record<LibraryRepairQueuePriorityV1, { background: string; color: string }> = {
  blocker: { background: '#fee2e2', color: '#991b1b' },
  high: { background: '#ffedd5', color: '#9a3412' },
  medium: { background: '#fef3c7', color: '#92400e' },
  low: { background: '#dbeafe', color: '#1d4ed8' },
};

const STATUS_OPTIONS: readonly LibraryRepairQueueStatusV1[] = [
  'open',
  'in_progress',
  'done',
  'accepted_risk',
];

function formatEnumLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function MetadataRow({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <div style={{ fontSize: 11, color: '#475569' }}>
      <strong>{label}:</strong>
      {' '}
      {values.length > 0 ? values.join(', ') : 'none'}
    </div>
  );
}

function sortQueueItems(items: readonly LibraryRepairQueueItemV1[]): LibraryRepairQueueItemV1[] {
  const priorityOrder: Record<LibraryRepairQueuePriorityV1, number> = {
    blocker: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return [...items].sort((left, right) => {
    const priorityDelta = priorityOrder[left.priority] - priorityOrder[right.priority];
    if (priorityDelta !== 0) return priorityDelta;
    return left.title.localeCompare(right.title);
  });
}

export interface LibraryRepairQueuePanelProps {
  readonly repairPlan: ProjectionSafetyRepairPlanV1;
}

export function LibraryRepairQueuePanel({ repairPlan }: LibraryRepairQueuePanelProps) {
  const queue = useMemo(() => buildLibraryRepairQueue(repairPlan), [repairPlan]);
  const [localStatuses, setLocalStatuses] = useState<Record<string, LibraryRepairQueueStatusV1>>({});

  const groupedQueueItems = useMemo(
    () => AREA_ORDER.map((area) => ({
      area,
      items: sortQueueItems(queue.queueItems.filter((item) => item.area === area)),
    })).filter((group) => group.items.length > 0),
    [queue.queueItems],
  );

  if (queue.queueItems.length === 0) return null;

  return (
    <section
      style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '0.75rem', background: '#f8fafc' }}
      data-testid="library-repair-queue-panel"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>Library repair queue</p>
          <p style={{ margin: '0.15rem 0 0', fontSize: 11, color: '#64748b' }}>
            Reviewable authoring tasks generated from projection repair suggestions.
          </p>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }} data-testid="library-repair-queue-count">
          {queue.queueItems.length}
          {' '}
          item{queue.queueItems.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        {groupedQueueItems.map((group) => (
          <section
            key={group.area}
            style={{ display: 'grid', gap: '0.5rem' }}
            data-testid={`library-repair-queue-group-${group.area}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: 12, color: '#0f172a' }}>{AREA_LABELS[group.area]}</h4>
              <span style={{ fontSize: 11, color: '#64748b' }}>{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
            </div>

            {group.items.map((item) => {
              const selectedStatus = localStatuses[item.queueItemId] ?? item.status;
              const priorityStyle = PRIORITY_STYLES[item.priority];
              return (
                <article
                  key={item.queueItemId}
                  style={{ border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', padding: '0.65rem', display: 'grid', gap: '0.4rem' }}
                  data-testid={`library-repair-queue-item-${item.queueItemId}`}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h5 style={{ margin: 0, fontSize: 13, color: '#0f172a' }}>{item.title}</h5>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 999,
                            padding: '0.15rem 0.5rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            ...priorityStyle,
                          }}
                          data-testid={`library-repair-queue-priority-${item.queueItemId}`}
                        >
                          {item.priority}
                        </span>
                      </div>
                      <p style={{ margin: '0.25rem 0 0', fontSize: 12, color: '#475569' }}>{item.description}</p>
                    </div>

                    <label style={{ display: 'grid', gap: '0.2rem', fontSize: 11, color: '#475569' }}>
                      Status
                      <select
                        value={selectedStatus}
                        onChange={(event) => {
                          const nextStatus = event.target.value as LibraryRepairQueueStatusV1;
                          setLocalStatuses((current) => ({
                            ...current,
                            [item.queueItemId]: nextStatus,
                          }));
                        }}
                        style={{ fontFamily: 'monospace', fontSize: 11, padding: '0.25rem 0.4rem' }}
                        data-testid={`library-repair-queue-status-${item.queueItemId}`}
                      >
                        {STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>{formatEnumLabel(status)}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gap: '0.2rem' }}>
                    <MetadataRow label="Concepts" values={item.affectedConceptIds} />
                    <MetadataRow label="Cards" values={item.affectedCardIds} />
                    <MetadataRow label="Tasks" values={item.linkedTaskIds} />
                  </div>

                  <div style={{ fontSize: 12, color: '#0f172a' }}>
                    <strong>Suggested change:</strong>
                    {' '}
                    {item.suggestedChange}
                  </div>
                </article>
              );
            })}
          </section>
        ))}
      </div>
    </section>
  );
}
