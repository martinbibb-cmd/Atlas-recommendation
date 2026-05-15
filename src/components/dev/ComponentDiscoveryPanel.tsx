import { useMemo, useState, type CSSProperties } from 'react';
import { buildFullRouteExample } from '../../dev/devRouteRegistry';
import { getComponentDiscoveryReport, type RouteAuditRow } from '../../dev/utils/componentScanner';

type DiscoveryTab = 'route_audit' | 'unrouted';
type StatusFilter = 'all' | 'production' | 'dev_only' | 'unrouted';

interface Props {
  onBack?: () => void;
}

const TAB_LABELS: Record<DiscoveryTab, string> = {
  route_audit: '🧭 Route Auditor',
  unrouted: '🧩 Unrouted Components',
};

const STATUS_COLORS: Record<StatusFilter, string> = {
  all: '#475569',
  production: '#15803d',
  dev_only: '#ca8a04',
  unrouted: '#dc2626',
};

function statusBadge(status: StatusFilter): CSSProperties {
  return {
    display: 'inline-block',
    borderRadius: 999,
    background: `${STATUS_COLORS[status]}1A`,
    border: `1px solid ${STATUS_COLORS[status]}66`,
    color: STATUS_COLORS[status],
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    padding: '0.2rem 0.55rem',
  };
}

function matchesSearch(value: string, search: string): boolean {
  if (search.trim() === '') return true;
  return value.toLowerCase().includes(search.toLowerCase());
}

function matchesRouteFilter(row: RouteAuditRow, filter: StatusFilter): boolean {
  return filter === 'all' || row.status === filter;
}

export default function ComponentDiscoveryPanel({ onBack }: Props) {
  const [tab, setTab] = useState<DiscoveryTab>('route_audit');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const report = useMemo(() => getComponentDiscoveryReport(), []);

  const routeRows = useMemo(
    () =>
      report.routeAuditRows.filter(
        row =>
          matchesRouteFilter(row, statusFilter) &&
          matchesSearch(`${row.codeName} ${row.filePath} ${row.routeMeta?.routePath ?? ''}`, search),
      ),
    [report.routeAuditRows, search, statusFilter],
  );

  const unroutedRows = useMemo(
    () =>
      report.unroutedComponents.filter(row =>
        matchesSearch(`${row.codeName} ${row.filePath}`, search),
      ),
    [report.unroutedComponents, search],
  );

  return (
    <div style={STYLES.page}>
      <header style={STYLES.header}>
        {onBack && (
          <button className="back-btn" onClick={onBack} style={{ marginBottom: '1rem' }}>
            ← UI Inventory
          </button>
        )}
        <div style={STYLES.titleRow}>
          <h1 style={STYLES.title}>🔎 Component Discovery</h1>
          <span style={STYLES.devBadge}>DEV ONLY</span>
        </div>
        <p style={STYLES.subtitle}>
          Compares candidate UI files against <code>DEV_ROUTE_REGISTRY</code> and the curated UI inventory to highlight routed, dev-only, and unrouted surfaces.
        </p>
      </header>

      <div style={STYLES.summaryRow}>
        <span style={statusBadge('production')}>Green · production routes: {report.counts.production}</span>
        <span style={statusBadge('dev_only')}>Yellow · dev-only routes: {report.counts.devOnly}</span>
        <span style={statusBadge('unrouted')}>Red · unrouted pages: {report.counts.unrouted}</span>
        <span style={STYLES.summaryText}>Unrouted visual/dev components: {report.unroutedComponents.length}</span>
      </div>

      <div style={STYLES.tabRow}>
        {(Object.keys(TAB_LABELS) as DiscoveryTab[]).map(mode => (
          <button
            key={mode}
            className={`chip-btn${tab === mode ? ' chip-btn--active' : ''}`}
            onClick={() => setTab(mode)}
          >
            {TAB_LABELS[mode]}
          </button>
        ))}
      </div>

      <div style={STYLES.controlRow}>
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search by component name or file path…"
          style={STYLES.searchInput}
        />
        {tab === 'route_audit' && (
          <div style={STYLES.filterRow}>
            {(['all', 'production', 'dev_only', 'unrouted'] as StatusFilter[]).map(filter => (
              <button
                key={filter}
                className={`chip-btn${statusFilter === filter ? ' chip-btn--active' : ''}`}
                onClick={() => setStatusFilter(filter)}
              >
                {filter === 'all' ? 'All' : filter.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'route_audit' ? (
        <div style={STYLES.tableWrap}>
          <table style={STYLES.table}>
            <thead>
              <tr>
                <th style={STYLES.th}>Component</th>
                <th style={STYLES.th}>File</th>
                <th style={STYLES.th}>Route status</th>
                <th style={STYLES.th}>Route entry</th>
              </tr>
            </thead>
            <tbody>
              {routeRows.map(row => (
                <tr key={`${row.codeName}:${row.filePath}`}>
                  <td style={STYLES.td}>
                    <code>{row.codeName}</code>
                    {!row.inUiInventory && (
                      <div style={STYLES.metaHint}>Not in UI inventory</div>
                    )}
                  </td>
                  <td style={STYLES.td}><code>{row.filePath}</code></td>
                  <td style={STYLES.td}>
                    <span style={statusBadge(row.status)}>
                      {row.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={STYLES.td}>
                    {row.routeMeta ? <code>{buildFullRouteExample(row.routeMeta)}</code> : <span style={STYLES.unresolved}>No registry entry</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={STYLES.tableWrap}>
          <table style={STYLES.table}>
            <thead>
              <tr>
                <th style={STYLES.th}>Component</th>
                <th style={STYLES.th}>File</th>
                <th style={STYLES.th}>UI inventory</th>
                <th style={STYLES.th}>Suggested action</th>
              </tr>
            </thead>
            <tbody>
              {unroutedRows.map(row => (
                <tr key={`${row.codeName}:${row.filePath}`}>
                  <td style={STYLES.td}><code>{row.codeName}</code></td>
                  <td style={STYLES.td}><code>{row.filePath}</code></td>
                  <td style={STYLES.td}>
                    {row.inUiInventory ? <span style={STYLES.ok}>Listed</span> : <span style={STYLES.unresolved}>Missing</span>}
                  </td>
                  <td style={STYLES.td}><code>Add to DEV_ROUTE_REGISTRY with access: 'dev_only'</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const STYLES: Record<string, CSSProperties> = {
  page: {
    background: '#f8fafc',
    minHeight: '100vh',
    padding: '1.5rem',
    paddingBottom: '2rem',
  },
  header: {
    marginBottom: '1rem',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  title: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1e293b',
  },
  devBadge: {
    display: 'inline-block',
    background: '#7c3aed',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    padding: '0.2rem 0.5rem',
    borderRadius: 4,
  },
  subtitle: {
    marginTop: '0.5rem',
    marginBottom: 0,
    color: '#64748b',
    fontSize: '0.875rem',
    lineHeight: 1.5,
  },
  summaryRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  summaryText: {
    color: '#334155',
    fontSize: '0.82rem',
    alignSelf: 'center',
    marginLeft: '0.5rem',
  },
  tabRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.75rem',
  },
  controlRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.75rem',
    marginBottom: '0.75rem',
    alignItems: 'center',
  },
  searchInput: {
    minWidth: 300,
    flex: '1 1 320px',
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    padding: '0.55rem 0.7rem',
    fontSize: '0.9rem',
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.4rem',
  },
  tableWrap: {
    border: '1px solid #e2e8f0',
    background: '#fff',
    borderRadius: 10,
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    borderBottom: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#334155',
    fontSize: '0.76rem',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    padding: '0.65rem 0.75rem',
  },
  td: {
    borderBottom: '1px solid #f1f5f9',
    padding: '0.65rem 0.75rem',
    fontSize: '0.84rem',
    color: '#1e293b',
    verticalAlign: 'top',
  },
  metaHint: {
    marginTop: '0.2rem',
    color: '#b45309',
    fontSize: '0.72rem',
  },
  unresolved: {
    color: '#b91c1c',
    fontWeight: 600,
    fontSize: '0.78rem',
  },
  ok: {
    color: '#166534',
    fontWeight: 600,
    fontSize: '0.78rem',
  },
};
