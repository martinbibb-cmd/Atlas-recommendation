/**
 * src/components/dev/AnalyticsPanel.tsx
 *
 * Developer-only analytics view for Atlas.
 *
 * Shows privacy-first aggregate statistics computed from the local analytics
 * store — no survey data, PII, or raw payloads are displayed.
 *
 * Accessible from the developer menu (/dev/devmenu or legacy ?devmenu=1) only.
 *
 * Displays:
 *   - Total visits created
 *   - Completion rate
 *   - Average visit duration
 *   - Recommendation view and selection counts
 *   - Top selected scenario IDs
 */

import { useState, useEffect } from 'react';
import { listEvents, clearEvents, aggregateByTenant } from '../../features/analytics/analyticsStore';
import type { TenantAnalyticsAggregate } from '../../features/analytics/analyticsStore';
import type { AnalyticsEventV1 } from '../../features/analytics/analyticsEvents';
import { safeStringify } from '../../lib/privacy/safeLog';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AggregateCard({ agg }: { agg: TenantAnalyticsAggregate }) {
  return (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>
        Tenant: <code style={styles.code}>{agg.tenantId ?? '(no tenant)'}</code>
      </h3>
      <table style={styles.table}>
        <tbody>
          <tr>
            <td style={styles.label}>Visits created</td>
            <td style={styles.value}>{agg.visitsCreated}</td>
          </tr>
          <tr>
            <td style={styles.label}>Visits completed</td>
            <td style={styles.value}>{agg.visitsCompleted}</td>
          </tr>
          <tr>
            <td style={styles.label}>Completion rate</td>
            <td style={styles.value}>{formatPct(agg.completionRate)}</td>
          </tr>
          <tr>
            <td style={styles.label}>Avg duration</td>
            <td style={styles.value}>{formatDuration(agg.avgDurationSeconds)}</td>
          </tr>
          <tr>
            <td style={styles.label}>Recommendation views</td>
            <td style={styles.value}>{agg.recommendationViews}</td>
          </tr>
          <tr>
            <td style={styles.label}>Recommendation selections</td>
            <td style={styles.value}>{agg.recommendationSelections}</td>
          </tr>
        </tbody>
      </table>
      {agg.topSelectedScenarioIds.length > 0 && (
        <div style={{ marginTop: '0.75rem' }}>
          <p style={styles.subheading}>Top selected scenarios</p>
          <ul style={styles.scenarioList}>
            {agg.topSelectedScenarioIds.map(({ scenarioId, count }) => (
              <li key={scenarioId} style={styles.scenarioItem}>
                <code style={styles.code}>{scenarioId}</code>
                <span style={styles.count}>{count}×</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * AnalyticsPanel — developer-only, not customer-facing.
 *
 * Shows aggregate analytics from the local store.  Raw events can be
 * inspected for debugging but no survey data or PII is ever stored.
 */
export default function AnalyticsPanel() {
  const [aggregates, setAggregates] = useState<TenantAnalyticsAggregate[]>([]);
  const [events, setEvents] = useState<AnalyticsEventV1[]>([]);
  const [showRaw, setShowRaw] = useState(false);

  function refresh() {
    setAggregates(aggregateByTenant());
    setEvents(listEvents());
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleClear() {
    clearEvents();
    refresh();
  }

  const totalEvents = events.length;

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <h2 style={styles.heading}>Analytics (local, privacy-first)</h2>
        <div style={styles.headerActions}>
          <button style={styles.btn} onClick={refresh}>Refresh</button>
          <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={handleClear}>
            Clear all events
          </button>
        </div>
      </div>

      <p style={styles.meta}>
        {totalEvents} event{totalEvents !== 1 ? 's' : ''} stored locally.
        No survey data, PII, or file contents are included.
      </p>

      {aggregates.length === 0 ? (
        <p style={styles.empty}>No analytics events recorded yet.</p>
      ) : (
        <div style={styles.aggregates}>
          {aggregates.map((agg, i) => (
            <AggregateCard key={i} agg={agg} />
          ))}
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <button
          style={styles.btnSmall}
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? 'Hide raw events' : 'Show raw events'}
        </button>
        {showRaw && (
          <pre style={styles.rawJson}>
            {safeStringify(events)}
          </pre>
        )}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  root: {
    padding: '1.25rem',
    fontFamily: 'system-ui, sans-serif',
    maxWidth: 720,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap' as const,
    marginBottom: '0.5rem',
  },
  heading: {
    margin: 0,
    fontSize: '1.125rem',
    fontWeight: 600,
  },
  headerActions: {
    display: 'flex',
    gap: '0.5rem',
  },
  meta: {
    margin: '0 0 1rem',
    fontSize: '0.8125rem',
    color: '#64748b',
  },
  empty: {
    color: '#94a3b8',
    fontSize: '0.875rem',
  },
  aggregates: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  card: {
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '0.875rem 1rem',
    background: '#f8fafc',
  },
  cardTitle: {
    margin: '0 0 0.625rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '0.8125rem',
    background: '#e2e8f0',
    padding: '1px 4px',
    borderRadius: 3,
  },
  table: {
    borderCollapse: 'collapse' as const,
    width: '100%',
    fontSize: '0.875rem',
  },
  label: {
    padding: '0.2rem 0.75rem 0.2rem 0',
    color: '#475569',
    whiteSpace: 'nowrap' as const,
  },
  value: {
    padding: '0.2rem 0',
    fontWeight: 500,
  },
  subheading: {
    margin: '0 0 0.375rem',
    fontSize: '0.8125rem',
    color: '#475569',
    fontWeight: 500,
  },
  scenarioList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.25rem',
  },
  scenarioItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.8125rem',
  },
  count: {
    color: '#64748b',
    fontVariantNumeric: 'tabular-nums',
  },
  btn: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem',
    border: '1px solid #cbd5e1',
    borderRadius: 5,
    background: '#fff',
    cursor: 'pointer',
  },
  btnDanger: {
    borderColor: '#fca5a5',
    color: '#dc2626',
  },
  btnSmall: {
    padding: '0.25rem 0.625rem',
    fontSize: '0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    background: '#fff',
    cursor: 'pointer',
  },
  rawJson: {
    marginTop: '0.625rem',
    padding: '0.75rem',
    background: '#1e293b',
    color: '#e2e8f0',
    borderRadius: 6,
    fontSize: '0.75rem',
    overflowX: 'auto' as const,
    maxHeight: 400,
    overflow: 'auto',
  },
} as const;
