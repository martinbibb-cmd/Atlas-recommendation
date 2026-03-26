/**
 * DevMenuPage.tsx
 *
 * Developer-only component browser / UI atlas for Atlas.
 *
 * Lists all curated UI surfaces from the dev registry, with:
 *   - free-text search (by common name or file name)
 *   - status filter chips (canonical / active / experimental / deprecated)
 *   - category filter chips (simulator / visualiser / journey / …)
 *   - isolated preview of each component on tap
 *
 * NOT customer-facing. Accessible via ?devmenu=1 URL flag.
 */

import { useState, useMemo, type CSSProperties } from 'react';
import {
  DEV_UI_REGISTRY,
  type DevUiRegistryItem,
  type DevUiCategory,
  type DevUiStatus,
} from '../../dev/devUiRegistry';

// ─── Display helpers ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<DevUiCategory, string> = {
  simulator: 'Simulator',
  visualiser: 'Visualiser',
  journey: 'Journey',
  presentation: 'Presentation',
  audit: 'Audit',
  deprecated: 'Deprecated',
};

const STATUS_LABELS: Record<DevUiStatus, string> = {
  canonical: 'Canonical',
  active: 'Active',
  experimental: 'Experimental',
  deprecated: 'Deprecated',
};

const STATUS_COLORS: Record<DevUiStatus, string> = {
  canonical: '#16a34a',
  active: '#2563eb',
  experimental: '#d97706',
  deprecated: '#dc2626',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DevMenuPage({ onBack }: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DevUiCategory | null>(null);
  const [statusFilter, setStatusFilter] = useState<DevUiStatus | null>(null);
  const [selectedItem, setSelectedItem] = useState<DevUiRegistryItem | null>(null);

  const filtered = useMemo(() => {
    return DEV_UI_REGISTRY.filter(item => {
      if (categoryFilter != null && item.category !== categoryFilter) return false;
      if (statusFilter != null && item.status !== statusFilter) return false;
      if (search.trim() !== '') {
        const q = search.toLowerCase();
        return (
          item.commonName.toLowerCase().includes(q) ||
          item.fileName.toLowerCase().includes(q) ||
          item.filePath.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [search, categoryFilter, statusFilter]);

  if (selectedItem != null) {
    return <PreviewPage item={selectedItem} onBack={() => setSelectedItem(null)} />;
  }

  return (
    <div style={STYLES.page}>
      <header style={STYLES.header}>
        <button className="back-btn" onClick={onBack} style={{ marginBottom: '1rem' }}>
          ← Home
        </button>
        <div style={STYLES.titleRow}>
          <h1 style={STYLES.title}>🛠 Dev Menu</h1>
          <span style={STYLES.devBadge}>DEV ONLY</span>
        </div>
        <p style={STYLES.subtitle}>
          Atlas UI component browser — {DEV_UI_REGISTRY.length} surfaces registered.
          Not customer-facing. Access via <code>?devmenu=1</code>.
        </p>
      </header>

      {/* Search */}
      <div style={STYLES.controls}>
        <input
          type="search"
          placeholder="Search by name or file…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={STYLES.searchInput}
          aria-label="Search components"
        />
      </div>

      {/* Status filter chips */}
      <div style={STYLES.filterRow}>
        <span style={STYLES.filterLabel}>Status:</span>
        {(['canonical', 'active', 'experimental', 'deprecated'] as DevUiStatus[]).map(s => (
          <button
            key={s}
            className={`chip-btn${statusFilter === s ? ' chip-btn--active' : ''}`}
            onClick={() => setStatusFilter(prev => (prev === s ? null : s))}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Category filter chips */}
      <div style={STYLES.filterRow}>
        <span style={STYLES.filterLabel}>Category:</span>
        {(Object.keys(CATEGORY_LABELS) as DevUiCategory[]).map(c => (
          <button
            key={c}
            className={`chip-btn${categoryFilter === c ? ' chip-btn--active' : ''}`}
            onClick={() => setCategoryFilter(prev => (prev === c ? null : c))}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Registry list */}
      <div style={STYLES.list} role="list">
        {filtered.length === 0 ? (
          <p style={STYLES.empty}>No components match these filters.</p>
        ) : (
          filtered.map(item => (
            <RegistryRow
              key={item.id}
              item={item}
              onClick={() => setSelectedItem(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Registry row ─────────────────────────────────────────────────────────────

function RegistryRow({
  item,
  onClick,
}: {
  item: DevUiRegistryItem;
  onClick: () => void;
}) {
  return (
    <div role="listitem" style={STYLES.rowWrapper}>
      <button style={STYLES.row} onClick={onClick} aria-label={`Preview ${item.commonName}`}>
        <div style={STYLES.rowMain}>
          <span style={STYLES.commonName}>{item.commonName}</span>
          <span style={STYLES.fileName}>{item.fileName}</span>
          {item.notes != null && <span style={STYLES.rowNote}>{item.notes}</span>}
        </div>
        <div style={STYLES.rowMeta}>
          <span style={{ ...STYLES.badge, ...STYLES.categoryBadge }}>
            {CATEGORY_LABELS[item.category]}
          </span>
          <span
            style={{
              ...STYLES.badge,
              color: STATUS_COLORS[item.status],
              borderColor: STATUS_COLORS[item.status],
            }}
          >
            {STATUS_LABELS[item.status]}
          </span>
          <span style={STYLES.rowArrow}>→</span>
        </div>
      </button>
    </div>
  );
}

// ─── Preview page ─────────────────────────────────────────────────────────────

function PreviewPage({
  item,
  onBack,
}: {
  item: DevUiRegistryItem;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopyPath() {
    void navigator.clipboard.writeText(item.filePath).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={STYLES.previewPage}>
      <header style={STYLES.previewHeader}>
        <button className="back-btn" onClick={onBack}>
          ← Dev Menu
        </button>

        <div style={STYLES.previewMeta}>
          <div style={STYLES.previewTitleRow}>
            <h2 style={STYLES.previewTitle}>{item.commonName}</h2>
            <span style={STYLES.devBadge}>DEV ONLY</span>
          </div>

          <table style={STYLES.metaTable}>
            <tbody>
              <MetaRow label="File" value={<code style={STYLES.code}>{item.fileName}</code>} />
              <MetaRow
                label="Path"
                value={
                  <span style={STYLES.pathRow}>
                    <code style={STYLES.code}>{item.filePath}</code>
                    <button
                      className="chip-btn"
                      style={{ marginLeft: '0.5rem' }}
                      onClick={handleCopyPath}
                      aria-label="Copy file path"
                    >
                      {copied ? '✓ Copied' : 'Copy path'}
                    </button>
                  </span>
                }
              />
              <MetaRow
                label="Category"
                value={
                  <span style={{ ...STYLES.badge, ...STYLES.categoryBadge }}>
                    {CATEGORY_LABELS[item.category]}
                  </span>
                }
              />
              <MetaRow
                label="Status"
                value={
                  <span
                    style={{
                      ...STYLES.badge,
                      color: STATUS_COLORS[item.status],
                      borderColor: STATUS_COLORS[item.status],
                    }}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                }
              />
              {item.notes != null && <MetaRow label="Notes" value={item.notes} />}
            </tbody>
          </table>
        </div>
      </header>

      <div style={STYLES.previewDivider} />

      <div style={STYLES.previewContent}>{item.render()}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <tr>
      <td style={STYLES.metaLabel}>{label}</td>
      <td style={STYLES.metaValue}>{value}</td>
    </tr>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES: Record<string, CSSProperties> = {
  page: {
    background: '#f8fafc',
    minHeight: '100vh',
    padding: '1.5rem',
    fontFamily: 'inherit',
  },
  header: {
    marginBottom: '1.5rem',
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
    borderRadius: '4px',
    textTransform: 'uppercase',
  },
  subtitle: {
    color: '#64748b',
    fontSize: '0.875rem',
    marginTop: '0.4rem',
    marginBottom: 0,
  },
  controls: {
    marginBottom: '0.75rem',
  },
  searchInput: {
    width: '100%',
    maxWidth: '480px',
    padding: '0.5rem 0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '0.9rem',
    background: '#fff',
    color: '#1e293b',
    boxSizing: 'border-box',
  },
  filterRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.4rem',
    marginBottom: '0.5rem',
  },
  filterLabel: {
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#475569',
    marginRight: '0.25rem',
  },
  list: {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  empty: {
    color: '#64748b',
    padding: '1rem 0',
    margin: 0,
  },
  rowWrapper: {
    borderRadius: '10px',
    overflow: 'hidden',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '0.75rem 1rem',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    cursor: 'pointer',
    textAlign: 'left',
    gap: '1rem',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  rowMain: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    minWidth: 0,
    flex: 1,
  },
  commonName: {
    fontWeight: 600,
    fontSize: '0.95rem',
    color: '#1e293b',
  },
  fileName: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    color: '#475569',
  },
  rowNote: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    marginTop: '0.1rem',
  },
  rowMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexShrink: 0,
  },
  badge: {
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: 600,
    border: '1px solid',
    whiteSpace: 'nowrap',
  },
  categoryBadge: {
    color: '#475569',
    borderColor: '#cbd5e1',
    background: '#f1f5f9',
  },
  rowArrow: {
    color: '#94a3b8',
    fontSize: '1rem',
    marginLeft: '0.25rem',
  },

  // Preview page styles
  previewPage: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: 'inherit',
  },
  previewHeader: {
    padding: '1.5rem',
    background: '#fff',
    borderBottom: '1px solid #e2e8f0',
  },
  previewTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginTop: '1rem',
    marginBottom: '0.75rem',
  },
  previewTitle: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: 700,
    color: '#1e293b',
  },
  metaTable: {
    borderCollapse: 'collapse' as const,
    fontSize: '0.85rem',
  },
  metaLabel: {
    fontWeight: 600,
    color: '#475569',
    paddingRight: '1rem',
    paddingTop: '0.25rem',
    paddingBottom: '0.25rem',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
  },
  metaValue: {
    color: '#1e293b',
    paddingTop: '0.25rem',
    paddingBottom: '0.25rem',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '0.82rem',
    background: '#f1f5f9',
    padding: '0.1rem 0.35rem',
    borderRadius: '3px',
    border: '1px solid #e2e8f0',
  },
  pathRow: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.25rem',
  },
  previewDivider: {
    height: '1px',
    background: '#e2e8f0',
  },
  previewContent: {
    padding: '1.5rem',
  },
};
