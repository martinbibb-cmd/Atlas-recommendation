/**
 * DevMenuPage.tsx
 *
 * Developer-only component browser / UI atlas for Atlas.
 *
 * Lists all curated UI surfaces from the dev registry, with:
 *   - free-text search (by name, file, route, query flags, access class)
 *   - status, category, access, route-kind filter chips
 *   - view mode toggles (full metadata / routes only / hierarchy / flagged only)
 *   - expandable cards showing route details, hierarchy, source files
 *   - isolated preview of each component on tap
 *   - "Copy routes" box at the bottom (plain text / markdown / JSON)
 *
 * NOT customer-facing. Accessible via ?devmenu=1 URL flag.
 */

import { useState, useMemo, useCallback, type CSSProperties, type ReactNode } from 'react';
import {
  DEV_UI_REGISTRY,
  type DevUiRegistryItem,
  type DevUiCategory,
  type DevUiStatus,
  type DevUiAccess,
  type DevUiRouteKind,
} from '../../dev/devUiRegistry';
import {
  applyFilters,
  isEligibleForCopyBox,
  INITIAL_FILTER_STATE,
  type DevUiFilterState,
  type DevUiViewMode,
} from '../../dev/devUiFilters';
import { generateCopyBoxOutput, formatSingleItemAsText, type CopyFormat } from '../../dev/devUiCopyExport';

// ─── Display helpers ──────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<DevUiCategory, string> = {
  simulator: 'Simulator',
  visualiser: 'Visualiser',
  journey: 'Journey',
  presentation: 'Presentation',
  assessment: 'Assessment',
  report: 'Report',
  utility: 'Utility',
  audit: 'Audit',
  deprecated: 'Deprecated',
  unknown: 'Unknown',
};

const STATUS_LABELS: Record<DevUiStatus, string> = {
  canonical: 'Canonical',
  active: 'Active',
  experimental: 'Experimental',
  review: 'Review',
  duplicate: 'Duplicate',
  deprecated: 'Deprecated',
  remove: 'Remove',
};

const STATUS_COLORS: Record<DevUiStatus, string> = {
  canonical: '#16a34a',
  active: '#2563eb',
  experimental: '#d97706',
  review: '#7c3aed',
  duplicate: '#0891b2',
  deprecated: '#dc2626',
  remove: '#991b1b',
};

const ACCESS_LABELS: Record<DevUiAccess, string> = {
  production: 'Production',
  dev_only: 'Dev only',
  fallback: 'Fallback',
  review: 'Review',
};

const ACCESS_COLORS: Record<DevUiAccess, string> = {
  production: '#16a34a',
  dev_only: '#64748b',
  fallback: '#d97706',
  review: '#7c3aed',
};

const ROUTE_KIND_LABELS: Record<DevUiRouteKind, string> = {
  path: 'Path',
  query_flag: 'Query flag',
  derived: 'Derived',
  unknown: 'Unknown',
};

const ROUTE_KIND_COLORS: Record<DevUiRouteKind, string> = {
  path: '#0369a1',
  query_flag: '#0891b2',
  derived: '#94a3b8',
  unknown: '#dc2626',
};

const VIEW_MODE_LABELS: Record<DevUiViewMode, string> = {
  full: 'Full metadata',
  routes: 'Routes only',
  hierarchy: 'Hierarchy',
  flagged: 'Flagged only',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onBack: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DevMenuPage({ onBack }: Props) {
  const [filters, setFilters] = useState<DevUiFilterState>(INITIAL_FILTER_STATE);
  const [selectedItem, setSelectedItem] = useState<DevUiRegistryItem | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [copyFormat, setCopyFormat] = useState<CopyFormat>('text');
  const [copyBoxCopied, setCopyBoxCopied] = useState(false);

  const filtered = useMemo(
    () => applyFilters(DEV_UI_REGISTRY, filters),
    [filters],
  );

  const copyBoxItems = useMemo(
    () => DEV_UI_REGISTRY.filter(isEligibleForCopyBox),
    [],
  );

  const copyBoxOutput = useMemo(
    () => generateCopyBoxOutput(copyBoxItems, copyFormat),
    [copyBoxItems, copyFormat],
  );

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function updateFilter<K extends keyof DevUiFilterState>(key: K, value: DevUiFilterState[K]) {
    setFilters(prev => ({ ...prev, [key]: value }));
  }

  function handleCopyCopyBox() {
    void navigator.clipboard.writeText(copyBoxOutput).then(() => {
      setCopyBoxCopied(true);
      setTimeout(() => setCopyBoxCopied(false), 2000);
    });
  }

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
          <h1 style={STYLES.title}>🗂 UI Inventory</h1>
          <span style={STYLES.devBadge}>DEV ONLY</span>
        </div>
        <p style={STYLES.subtitle}>
          Atlas UI surface registry — {DEV_UI_REGISTRY.length} surfaces registered.
          Inspect every UI surface with route details, hierarchy, and access type.
          Access via <code>?devmenu=1</code>.
        </p>
      </header>

      {/* Search */}
      <div style={STYLES.controls}>
        <input
          type="search"
          placeholder="Search by name, file, route, query flag, access…"
          value={filters.search}
          onChange={e => updateFilter('search', e.target.value)}
          style={STYLES.searchInput}
          aria-label="Search components"
        />
      </div>

      {/* View mode */}
      <div style={STYLES.filterRow}>
        <span style={STYLES.filterLabel}>View:</span>
        {(Object.keys(VIEW_MODE_LABELS) as DevUiViewMode[]).map(m => (
          <button
            key={m}
            className={`chip-btn${filters.viewMode === m ? ' chip-btn--active' : ''}`}
            onClick={() => updateFilter('viewMode', m)}
          >
            {VIEW_MODE_LABELS[m]}
          </button>
        ))}
      </div>

      {/* Status filter chips */}
      <div style={STYLES.filterRow}>
        <span style={STYLES.filterLabel}>Status:</span>
        {(['canonical', 'active', 'experimental', 'review', 'duplicate', 'deprecated', 'remove'] as DevUiStatus[]).map(s => (
          <button
            key={s}
            className={`chip-btn${filters.statusFilter === s ? ' chip-btn--active' : ''}`}
            onClick={() => updateFilter('statusFilter', filters.statusFilter === s ? null : s)}
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
            className={`chip-btn${filters.categoryFilter === c ? ' chip-btn--active' : ''}`}
            onClick={() => updateFilter('categoryFilter', filters.categoryFilter === c ? null : c)}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Access filter chips */}
      <div style={STYLES.filterRow}>
        <span style={STYLES.filterLabel}>Access:</span>
        {(['production', 'dev_only', 'fallback', 'review'] as DevUiAccess[]).map(a => (
          <button
            key={a}
            className={`chip-btn${filters.accessFilter === a ? ' chip-btn--active' : ''}`}
            onClick={() => updateFilter('accessFilter', filters.accessFilter === a ? null : a)}
          >
            {ACCESS_LABELS[a]}
          </button>
        ))}
      </div>

      {/* Route kind filter chips */}
      <div style={STYLES.filterRow}>
        <span style={STYLES.filterLabel}>Route:</span>
        {(['path', 'query_flag', 'derived', 'unknown'] as DevUiRouteKind[]).map(r => (
          <button
            key={r}
            className={`chip-btn${filters.routeKindFilter === r ? ' chip-btn--active' : ''}`}
            onClick={() => updateFilter('routeKindFilter', filters.routeKindFilter === r ? null : r)}
          >
            {ROUTE_KIND_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Registry list */}
      <div style={STYLES.list} role="list">
        {filtered.length === 0 ? (
          <p style={STYLES.empty}>No components match these filters.</p>
        ) : (
          filtered.map(item => (
            <RegistryCard
              key={item.id}
              item={item}
              expanded={expandedIds.has(item.id)}
              viewMode={filters.viewMode}
              onPreview={() => setSelectedItem(item)}
              onToggleExpand={() => handleToggleExpand(item.id)}
            />
          ))
        )}
      </div>

      {/* Copy box */}
      <CopyBox
        output={copyBoxOutput}
        format={copyFormat}
        copied={copyBoxCopied}
        onFormatChange={setCopyFormat}
        onCopy={handleCopyCopyBox}
      />
    </div>
  );
}

// ─── Registry card ────────────────────────────────────────────────────────────

function RegistryCard({
  item,
  expanded,
  viewMode,
  onPreview,
  onToggleExpand,
}: {
  item: DevUiRegistryItem;
  expanded: boolean;
  viewMode: DevUiViewMode;
  onPreview: () => void;
  onToggleExpand: () => void;
}) {
  const hasChildren = item.childElementIds != null && item.childElementIds.length > 0;
  const inCopyBox = isEligibleForCopyBox(item);

  return (
    <div role="listitem" style={STYLES.cardWrapper}>
      <div style={STYLES.cardTopRow}>
        <button style={STYLES.cardMainBtn} onClick={onPreview} aria-label={`Preview ${item.commonName}`}>
          <div style={STYLES.rowMain}>
            <span style={STYLES.commonName}>{item.commonName}</span>
            <span style={STYLES.codeName}>{item.codeName}</span>
            {viewMode !== 'routes' && (
              <span style={STYLES.fileName}>{item.fileName}</span>
            )}
            {(viewMode === 'routes' || viewMode === 'full') && item.fullRouteExample != null && (
              <span style={STYLES.routeExample}>
                🔗 {item.fullRouteExample}
              </span>
            )}
            {viewMode !== 'routes' && item.notes != null && (
              <span style={STYLES.rowNote}>{item.notes}</span>
            )}
          </div>
        </button>

        <div style={STYLES.cardBadgesCol}>
          <div style={STYLES.badgeRow}>
            {item.routeKind != null && (
              <span style={{ ...STYLES.badge, color: ROUTE_KIND_COLORS[item.routeKind], borderColor: ROUTE_KIND_COLORS[item.routeKind] }}>
                {ROUTE_KIND_LABELS[item.routeKind]}
              </span>
            )}
            {item.access != null && (
              <span style={{ ...STYLES.badge, color: ACCESS_COLORS[item.access], borderColor: ACCESS_COLORS[item.access] }}>
                {ACCESS_LABELS[item.access]}
              </span>
            )}
            <span style={{ ...STYLES.badge, ...STYLES.categoryBadge }}>
              {CATEGORY_LABELS[item.category]}
            </span>
            <span style={{ ...STYLES.badge, color: STATUS_COLORS[item.status], borderColor: STATUS_COLORS[item.status] }}>
              {STATUS_LABELS[item.status]}
            </span>
            {hasChildren && (
              <span style={{ ...STYLES.badge, ...STYLES.iconBadge }} title="Has child surfaces">
                ⬡ children
              </span>
            )}
            {inCopyBox && (
              <span style={{ ...STYLES.badge, ...STYLES.copyBadge }} title="Included in copy box">
                📋
              </span>
            )}
          </div>
          <button
            style={STYLES.expandBtn}
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            {expanded ? '▲ Less' : '▼ More'}
          </button>
        </div>
      </div>

      {expanded && <ExpandedPanel item={item} />}
    </div>
  );
}

// ─── Expanded panel ───────────────────────────────────────────────────────────

function ExpandedPanel({ item }: { item: DevUiRegistryItem }) {
  const [singleCopied, setSingleCopied] = useState(false);

  function handleCopySingle() {
    const text = formatSingleItemAsText(item);
    void navigator.clipboard.writeText(text).then(() => {
      setSingleCopied(true);
      setTimeout(() => setSingleCopied(false), 2000);
    });
  }

  return (
    <div style={STYLES.expandedPanel}>
      <table style={STYLES.metaTable}>
        <tbody>
          <ExpandRow label="Human name" value={item.commonName} />
          <ExpandRow label="Code name" value={<code style={STYLES.code}>{item.codeName}</code>} />
          <ExpandRow label="File" value={<code style={STYLES.code}>{item.fileName}</code>} />
          <ExpandRow label="Path" value={<code style={STYLES.code}>{item.filePath}</code>} />
          <ExpandRow label="Route kind" value={
            item.routeKind != null ? (
              <span style={{ ...STYLES.badge, color: ROUTE_KIND_COLORS[item.routeKind], borderColor: ROUTE_KIND_COLORS[item.routeKind] }}>
                {ROUTE_KIND_LABELS[item.routeKind]}
              </span>
            ) : '—'
          } />
          {item.queryFlags != null && item.queryFlags.length > 0 && (
            <ExpandRow label="Query flags" value={
              <span style={STYLES.tagList}>
                {item.queryFlags.map(f => (
                  <code key={f} style={STYLES.code}>?{f}</code>
                ))}
              </span>
            } />
          )}
          {item.routePath != null && (
            <ExpandRow label="Route path" value={<code style={STYLES.code}>{item.routePath}</code>} />
          )}
          <ExpandRow label="Route example" value={<code style={STYLES.code}>{item.fullRouteExample ?? 'unresolved'}</code>} />
          <ExpandRow label="Access" value={
            item.access != null ? (
              <span style={{ ...STYLES.badge, color: ACCESS_COLORS[item.access], borderColor: ACCESS_COLORS[item.access] }}>
                {ACCESS_LABELS[item.access]}
              </span>
            ) : '—'
          } />
          <ExpandRow label="Status" value={
            <span style={{ ...STYLES.badge, color: STATUS_COLORS[item.status], borderColor: STATUS_COLORS[item.status] }}>
              {STATUS_LABELS[item.status]}
            </span>
          } />
          <ExpandRow label="Category" value={
            <span style={{ ...STYLES.badge, ...STYLES.categoryBadge }}>{CATEGORY_LABELS[item.category]}</span>
          } />
          {item.parentCodeName != null && (
            <ExpandRow label="Parent surface" value={<code style={STYLES.code}>{item.parentCodeName}</code>} />
          )}
          {item.childElementIds != null && item.childElementIds.length > 0 && (
            <ExpandRow label="Contains" value={
              <span style={STYLES.tagList}>
                {item.childElementIds.map(c => <code key={c} style={STYLES.code}>{c}</code>)}
              </span>
            } />
          )}
          {item.usedByRoutes != null && item.usedByRoutes.length > 0 && (
            <ExpandRow label="Entry from / leads to" value={
              <span style={STYLES.tagList}>
                {item.usedByRoutes.map(r => <code key={r} style={STYLES.code}>{r}</code>)}
              </span>
            } />
          )}
          {item.sourceFiles != null && item.sourceFiles.length > 0 && (
            <ExpandRow label="Source files" value={
              <span style={STYLES.fileList}>
                {item.sourceFiles.map(f => <code key={f} style={{ ...STYLES.code, display: 'block', marginBottom: '2px' }}>{f}</code>)}
              </span>
            } />
          )}
          {item.notes != null && (
            <ExpandRow label="Notes" value={<span style={STYLES.notesText}>{item.notes}</span>} />
          )}
        </tbody>
      </table>
      <div style={{ marginTop: '0.75rem' }}>
        <button className="chip-btn" onClick={handleCopySingle}>
          {singleCopied ? '✓ Copied' : '📋 Copy this route'}
        </button>
      </div>
    </div>
  );
}

function ExpandRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <tr>
      <td style={STYLES.expandLabel}>{label}</td>
      <td style={STYLES.expandValue}>{value}</td>
    </tr>
  );
}

// ─── Copy box ─────────────────────────────────────────────────────────────────

function CopyBox({
  output,
  format,
  copied,
  onFormatChange,
  onCopy,
}: {
  output: string;
  format: CopyFormat;
  copied: boolean;
  onFormatChange: (f: CopyFormat) => void;
  onCopy: () => void;
}) {
  return (
    <div style={STYLES.copyBox}>
      <div style={STYLES.copyBoxHeader}>
        <span style={STYLES.copyBoxTitle}>📋 Copy routes</span>
        <span style={STYLES.copyBoxHint}>
          Includes canonical, production, and flagged surfaces.
        </span>
      </div>

      <div style={STYLES.filterRow}>
        <span style={STYLES.filterLabel}>Format:</span>
        {(['text', 'markdown', 'json'] as CopyFormat[]).map(f => (
          <button
            key={f}
            className={`chip-btn${format === f ? ' chip-btn--active' : ''}`}
            onClick={() => onFormatChange(f)}
          >
            {f === 'text' ? 'Plain text' : f === 'markdown' ? 'Markdown' : 'JSON'}
          </button>
        ))}
      </div>

      <textarea
        readOnly
        value={output}
        style={STYLES.copyTextarea}
        aria-label="Copy box output"
        rows={12}
      />

      <button className="chip-btn" onClick={onCopy} style={STYLES.copyBtn}>
        {copied ? '✓ Copied to clipboard' : '📋 Copy to clipboard'}
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
              <MetaRow label="Human name" value={item.commonName} />
              <MetaRow label="Code name" value={<code style={STYLES.code}>{item.codeName}</code>} />
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
              {item.routeKind != null && (
                <MetaRow label="Route kind" value={
                  <span style={{ ...STYLES.badge, color: ROUTE_KIND_COLORS[item.routeKind], borderColor: ROUTE_KIND_COLORS[item.routeKind] }}>
                    {ROUTE_KIND_LABELS[item.routeKind]}
                  </span>
                } />
              )}
              {item.queryFlags != null && item.queryFlags.length > 0 && (
                <MetaRow label="Query flags" value={
                  <span style={STYLES.tagList}>
                    {item.queryFlags.map(f => <code key={f} style={STYLES.code}>?{f}</code>)}
                  </span>
                } />
              )}
              <MetaRow label="Route example" value={<code style={STYLES.code}>{item.fullRouteExample ?? 'unresolved'}</code>} />
              {item.access != null && (
                <MetaRow label="Access" value={
                  <span style={{ ...STYLES.badge, color: ACCESS_COLORS[item.access], borderColor: ACCESS_COLORS[item.access] }}>
                    {ACCESS_LABELS[item.access]}
                  </span>
                } />
              )}
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
                  <span style={{ ...STYLES.badge, color: STATUS_COLORS[item.status], borderColor: STATUS_COLORS[item.status] }}>
                    {STATUS_LABELS[item.status]}
                  </span>
                }
              />
              {item.parentCodeName != null && (
                <MetaRow label="Parent surface" value={<code style={STYLES.code}>{item.parentCodeName}</code>} />
              )}
              {item.childElementIds != null && item.childElementIds.length > 0 && (
                <MetaRow label="Contains" value={
                  <span style={STYLES.tagList}>
                    {item.childElementIds.map(c => <code key={c} style={STYLES.code}>{c}</code>)}
                  </span>
                } />
              )}
              {item.usedByRoutes != null && item.usedByRoutes.length > 0 && (
                <MetaRow label="Entry from / leads to" value={
                  <span style={STYLES.tagList}>
                    {item.usedByRoutes.map(r => <code key={r} style={STYLES.code}>{r}</code>)}
                  </span>
                } />
              )}
              {item.sourceFiles != null && item.sourceFiles.length > 0 && (
                <MetaRow label="Source files" value={
                  <span style={STYLES.fileList}>
                    {item.sourceFiles.map(f => <code key={f} style={{ ...STYLES.code, display: 'block', marginBottom: '2px' }}>{f}</code>)}
                  </span>
                } />
              )}
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
    paddingBottom: '2rem',
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
    maxWidth: '560px',
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
    whiteSpace: 'nowrap',
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

  // Card
  cardWrapper: {
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    background: '#fff',
  },
  cardTopRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  cardMainBtn: {
    flex: 1,
    padding: '0.75rem 1rem',
    background: 'transparent',
    border: 'none',
    borderRadius: '0',
    cursor: 'pointer',
    textAlign: 'left',
    minWidth: 0,
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
  codeName: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    color: '#2563eb',
  },
  fileName: {
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    color: '#475569',
  },
  routeExample: {
    fontFamily: 'monospace',
    fontSize: '0.78rem',
    color: '#0369a1',
    marginTop: '0.15rem',
  },
  rowNote: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    marginTop: '0.1rem',
  },
  cardBadgesCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.4rem',
    padding: '0.75rem 0.75rem 0.75rem 0',
    flexShrink: 0,
  },
  badgeRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.3rem',
    justifyContent: 'flex-end',
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
  iconBadge: {
    color: '#0891b2',
    borderColor: '#bae6fd',
    background: '#f0f9ff',
  },
  copyBadge: {
    color: '#16a34a',
    borderColor: '#bbf7d0',
    background: '#f0fdf4',
    border: '1px solid',
  },
  expandBtn: {
    fontSize: '0.72rem',
    color: '#94a3b8',
    background: 'transparent',
    border: '1px solid #e2e8f0',
    borderRadius: '4px',
    padding: '0.15rem 0.5rem',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },

  // Expanded panel
  expandedPanel: {
    borderTop: '1px solid #e2e8f0',
    padding: '0.75rem 1rem 1rem',
    background: '#f8fafc',
  },
  expandLabel: {
    fontWeight: 600,
    color: '#64748b',
    fontSize: '0.8rem',
    paddingRight: '1rem',
    paddingTop: '0.2rem',
    paddingBottom: '0.2rem',
    verticalAlign: 'top',
    whiteSpace: 'nowrap',
  },
  expandValue: {
    color: '#1e293b',
    fontSize: '0.82rem',
    paddingTop: '0.2rem',
    paddingBottom: '0.2rem',
  },
  tagList: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: '0.3rem',
    alignItems: 'center',
  },
  fileList: {
    display: 'inline-flex',
    flexDirection: 'column',
    gap: '2px',
  },
  notesText: {
    color: '#475569',
    fontSize: '0.82rem',
  },

  // Copy box
  copyBox: {
    marginTop: '2rem',
    padding: '1.25rem',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  copyBoxHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.75rem',
    marginBottom: '0.75rem',
    flexWrap: 'wrap',
  },
  copyBoxTitle: {
    fontWeight: 700,
    fontSize: '1rem',
    color: '#1e293b',
  },
  copyBoxHint: {
    fontSize: '0.8rem',
    color: '#94a3b8',
  },
  copyTextarea: {
    width: '100%',
    boxSizing: 'border-box',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    padding: '0.75rem',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    background: '#f8fafc',
    color: '#1e293b',
    resize: 'vertical',
    marginTop: '0.5rem',
    marginBottom: '0.75rem',
  },
  copyBtn: {
    fontWeight: 600,
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
  previewMeta: {},
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
