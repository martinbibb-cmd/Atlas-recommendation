/**
 * DevMenuPage.tsx
 *
 * Developer-only component browser / UI atlas for Atlas.
 *
 * Top-level tabs include:
 *   - UI Inventory  – curated registry of all Atlas UI surfaces
 *   - Library – browse + navigate registry entries with TXT reference export
 *   - Visuals Gallery – individual visual elements (Physics Visuals, Lego Builder Components)
 *   - Component Discovery – route auditor + unrouted component scanner
 *
 * UI Inventory lists all curated UI surfaces from the dev registry, with:
 *   - free-text search (by name, file, route, query flags, access class)
 *   - status, category, access, route-kind filter chips
 *   - view mode toggles (full metadata / routes only / hierarchy / flagged only)
 *   - expandable cards showing route details, hierarchy, source files
 *   - isolated preview of each component on tap
 *   - "Copy routes" box at the bottom (plain text / markdown / JSON)
 *
 * NOT customer-facing. Accessible via /dev/devmenu (or legacy ?devmenu=1).
 */

import { useState, useMemo, useCallback, type CSSProperties, type ReactNode } from 'react';
import VisualsGalleryPage from './VisualsGalleryPage';
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
import {
  generateCopyBoxOutput,
  formatSingleItemAsText,
  generateLibraryReferenceText,
  resolveRouteDisplay,
  type CopyFormat,
} from '../../dev/devUiCopyExport';
import { clearAtlasCache } from '../../lib/storage/atlasCacheKeys';
import StorageDiagnosticsPanel from './StorageDiagnosticsPanel';
import AnalyticsPanel from './AnalyticsPanel';
import ComponentDiscoveryPanel from './ComponentDiscoveryPanel';
import PhoneFirstQaHarness from '../../dev/PhoneFirstQaHarness';
import { useActiveUser } from '../../features/userProfiles/useActiveUser';
import { resetDemoData } from '../../dev/demoSeed';
import type { ApplianceDefinitionV1 } from '../../contracts/hardware/ApplianceDefinitionV1';
import type { HardwarePatchV1, HardwarePatchEntryV1 } from '../../contracts/hardware/HardwarePatchV1';
import {
  VISUAL_EDUCATION_LIBRARY_QA_HUB,
  VISUAL_EDUCATION_LIBRARY_SURFACES,
} from '../../dev/visualEducationLibrary';

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
  legacy_dev_only: 'Legacy (dev only)',
  fallback: 'Fallback',
  review: 'Review',
  retired: 'Retired',
};

const ACCESS_COLORS: Record<DevUiAccess, string> = {
  production: '#16a34a',
  dev_only: '#64748b',
  legacy_dev_only: '#92400e',
  fallback: '#d97706',
  review: '#7c3aed',
  retired: '#6b7280',
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
  /** Called after demo data is seeded — navigates to the workspace dashboard. */
  onLoadDemoWorkspace?: () => void;
}

// ─── Top-level page mode ──────────────────────────────────────────────────────

type DevMenuPageMode = 'inventory' | 'library' | 'visuals' | 'storage' | 'analytics' | 'hardware' | 'discovery' | 'phoneQa';

const PAGE_MODE_LABELS: Record<DevMenuPageMode, string> = {
  inventory: '🗂 UI Inventory',
  library:   '📚 Library',
  visuals:   '🎨 Visuals Gallery',
  storage:   '💾 Storage',
  analytics: '📊 Analytics',
  hardware:  '🔧 Hardware',
  discovery: '🔎 Component Discovery',
  phoneQa:   '📱 Phone customer QA',
};

const VISUAL_EDUCATION_LIBRARY_ENTRY_IDS = new Set<string>([
  VISUAL_EDUCATION_LIBRARY_QA_HUB.id,
  ...VISUAL_EDUCATION_LIBRARY_SURFACES.map(surface => surface.id),
]);

const CUSTOMER_FACING_ENTRY_ORDER = [
  'customer-portal-preview-page',
  'customer-portal-page',
  'house-simulator-page',
  'explainers-hub',
  'canonical-presentation',
  'portal-journey-print-pack',
] as const;

const CUSTOMER_FACING_ENTRY_IDS = new Set<string>(CUSTOMER_FACING_ENTRY_ORDER);

const INTERNAL_WORKFLOW_ENTRY_IDS = new Set<string>([
  'fast-choice-stepper',
  'full-survey-stepper',
  'lab-shell',
  'visit-workspace-home',
  'visit-workspace-detail',
  'visit-home-dashboard',
  'workspace-settings-page',
]);

const LEGACY_TOOL_IDS = new Set<string>([
  'lifestyle-interactive',
  'lifestyle-interactive-compare',
  'efficiency-curve',
  'footprint-xray',
  'diagram-fixture-page',
  'library-explorer-page',
]);

const CUSTOMER_FACING_SUMMARIES: Partial<Record<string, string>> = {
  'customer-portal-preview-page': 'Production-like preview of the calm customer journey using fixture data.',
  'customer-portal-page': 'Canonical customer recommendation journey used for live visit outputs.',
  'house-simulator-page': 'Home-level simulator used to explain likely system performance in visit review.',
  'explainers-hub': 'Main simulator and explainer experience for understanding heat, water, and system response.',
  'canonical-presentation': 'Customer presentation deck for reviewing the recommendation in a guided format.',
  'portal-journey-print-pack': 'Supporting PDF output paired with the portal and visit review journey.',
};

const VISUAL_LANGUAGE_SURFACE_ORDER = [
  'sealed-unvented-explainer-slice',
  'visual-primitive-gallery',
  'visual-topology-gallery',
  'analogy-overlay-gallery',
] as const;

function isLegacyInventoryItem(item: DevUiRegistryItem): boolean {
  return (
    item.status === 'deprecated'
    || item.status === 'remove'
    || item.access === 'legacy_dev_only'
    || item.access === 'retired'
    || LEGACY_TOOL_IDS.has(item.id)
  );
}

function sortByPreferredIds(items: DevUiRegistryItem[], preferredIds: readonly string[]): DevUiRegistryItem[] {
  const order = new Map(preferredIds.map((id, index) => [id, index]));
  return [...items].sort((left, right) => {
    const leftIndex = order.get(left.id) ?? Number.MAX_SAFE_INTEGER;
    const rightIndex = order.get(right.id) ?? Number.MAX_SAFE_INTEGER;
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;
    return left.commonName.localeCompare(right.commonName);
  });
}

function resolveDirectRouteHref(item: Pick<DevUiRegistryItem, 'routePath' | 'queryFlags'>): string | null {
  if (item.routePath != null && !item.routePath.includes(':')) {
    return item.routePath;
  }
  if (item.queryFlags != null && item.queryFlags.length > 0) {
    return `/?${item.queryFlags[0]}`;
  }
  return null;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DevMenuPage({ onBack, onLoadDemoWorkspace }: Props) {
  const [pageMode, setPageMode] = useState<DevMenuPageMode>('inventory');
  const [filters, setFilters] = useState<DevUiFilterState>(INITIAL_FILTER_STATE);
  const [selectedItem, setSelectedItem] = useState<DevUiRegistryItem | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [showDevTools, setShowDevTools] = useState(false);
  const [showInternalWorkflows, setShowInternalWorkflows] = useState(false);
  const [showLegacyTools, setShowLegacyTools] = useState(false);

  const [copyFormat, setCopyFormat] = useState<CopyFormat>('text');
  const [copyBoxCopied, setCopyBoxCopied] = useState(false);
  const [cacheResetDone, setCacheResetDone] = useState(false);
  const [demoSeedDone, setDemoSeedDone] = useState(false);

  const { activeUser } = useActiveUser();

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
  const visualEducationLibraryItems = useMemo(
    () =>
      VISUAL_EDUCATION_LIBRARY_SURFACES.map((surface) => ({
        surface,
        registryItem: DEV_UI_REGISTRY.find((item) => item.codeName === surface.codeName),
      })).filter(
        (
          entry,
        ): entry is {
          surface: (typeof VISUAL_EDUCATION_LIBRARY_SURFACES)[number];
          registryItem: DevUiRegistryItem;
        } => entry.registryItem != null,
      ),
    [],
  );
  const orderedVisualEducationLibraryItems = useMemo(
    () =>
      [...visualEducationLibraryItems].sort((left, right) => {
        const leftIndex = VISUAL_LANGUAGE_SURFACE_ORDER.indexOf(left.surface.id);
        const rightIndex = VISUAL_LANGUAGE_SURFACE_ORDER.indexOf(right.surface.id);
        if (leftIndex === -1 && rightIndex === -1) {
          return left.surface.commonName.localeCompare(right.surface.commonName);
        }
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      }),
    [visualEducationLibraryItems],
  );
  const candidateReferenceSurface = useMemo(
    () => orderedVisualEducationLibraryItems.find((entry) => entry.surface.isCandidateReference)?.surface ?? null,
    [orderedVisualEducationLibraryItems],
  );
  const inventorySections = useMemo(() => {
    const customerFacing: DevUiRegistryItem[] = [];
    const internalWorkflows: DevUiRegistryItem[] = [];
    const developmentQa: DevUiRegistryItem[] = [];
    const deprecatedLegacy: DevUiRegistryItem[] = [];

    for (const item of filtered) {
      if (VISUAL_EDUCATION_LIBRARY_ENTRY_IDS.has(item.id)) continue;

      if (CUSTOMER_FACING_ENTRY_IDS.has(item.id)) {
        customerFacing.push(item);
        continue;
      }

      if (isLegacyInventoryItem(item)) {
        deprecatedLegacy.push(item);
        continue;
      }

      if (INTERNAL_WORKFLOW_ENTRY_IDS.has(item.id)) {
        internalWorkflows.push(item);
        continue;
      }

      developmentQa.push(item);
    }

    return {
      customerFacing: sortByPreferredIds(customerFacing, CUSTOMER_FACING_ENTRY_ORDER),
      internalWorkflows,
      developmentQa,
      deprecatedLegacy,
    };
  }, [filtered]);

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

  function handleResetCache() {
    if (!window.confirm('Reset local Atlas session cache?\n\nThis clears only Atlas state — not browser-wide storage. The page will reload.')) {
      return;
    }
    clearAtlasCache();
    console.info('[Atlas] Dev reset: Atlas local session cache cleared.');
    setCacheResetDone(true);
    // Give the user a moment to see the confirmation before reloading.
    setTimeout(() => window.location.reload(), 800);
  }

  function handleResetDemoData() {
    if (!window.confirm('Load demo workspace?\n\nThis reseeds the canonical Demo Heating Co workspace (user profiles, analytics events, file manifest). All existing analytics events will be replaced. The page will navigate to the workspace dashboard.')) {
      return;
    }
    resetDemoData();
    console.info('[Atlas] Dev: demo workspace loaded.');
    setDemoSeedDone(true);
    setTimeout(() => {
      if (onLoadDemoWorkspace) {
        onLoadDemoWorkspace();
      } else {
        // Strip query params so we land on the workspace dashboard.
        window.location.href = window.location.pathname;
      }
    }, 800);
  }

  if (selectedItem != null) {
    return <PreviewPage item={selectedItem} onBack={() => setSelectedItem(null)} />;
  }

  if (pageMode === 'visuals') {
    return <VisualsGalleryPage onBack={() => setPageMode('inventory')} />;
  }

  if (pageMode === 'library') {
    return (
      <LibraryBrowserPanel
        onBack={() => setPageMode('inventory')}
        onPreview={setSelectedItem}
      />
    );
  }

  if (pageMode === 'storage') {
    return (
      <div style={STYLES.page}>
        <header style={STYLES.header}>
          <button className="back-btn" onClick={() => setPageMode('inventory')} style={{ marginBottom: '1rem' }}>
            ← UI Inventory
          </button>
          <div style={STYLES.titleRow}>
            <h1 style={STYLES.title}>💾 Storage</h1>
            <span style={STYLES.devBadge}>DEV ONLY</span>
          </div>
        </header>
        <StorageDiagnosticsPanel />
      </div>
    );
  }

  if (pageMode === 'analytics') {
    return (
      <div style={STYLES.page}>
        <header style={STYLES.header}>
          <button className="back-btn" onClick={() => setPageMode('inventory')} style={{ marginBottom: '1rem' }}>
            ← UI Inventory
          </button>
          <div style={STYLES.titleRow}>
            <h1 style={STYLES.title}>📊 Analytics</h1>
            <span style={STYLES.devBadge}>DEV ONLY</span>
          </div>
        </header>
        <AnalyticsPanel />
      </div>
    );
  }

  if (pageMode === 'hardware') {
    return (
      <div style={STYLES.page}>
        <header style={STYLES.header}>
          <button className="back-btn" onClick={() => setPageMode('inventory')} style={{ marginBottom: '1rem' }}>
            ← UI Inventory
          </button>
          <div style={STYLES.titleRow}>
            <h1 style={STYLES.title}>🔧 Hardware</h1>
            <span style={STYLES.devBadge}>DEV ONLY</span>
          </div>
          <p style={STYLES.subtitle}>
            Define custom appliance definitions that are not in the standard MasterRegistry.
            Patches are stored locally and can be dispatched to Atlas Scan via the Visit Hub.
          </p>
        </header>
        <HardwarePatchEditorPanel />
      </div>
    );
  }

  if (pageMode === 'discovery') {
    return <ComponentDiscoveryPanel onBack={() => setPageMode('inventory')} />;
  }

  if (pageMode === 'phoneQa') {
    return <PhoneFirstQaHarness onBack={() => setPageMode('inventory')} />;
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
          Default view now prioritises customer-facing entry points and the canonical visual-language front door.
          Access via <code>/dev/devmenu</code> (or <code>?devmenu=1</code>).
        </p>
        {activeUser !== null && (
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#2563eb' }}>
            👤 Active user: <strong>{activeUser.displayName}</strong>
            {activeUser.email ? ` · ${activeUser.email}` : ''}
            {activeUser.developerMode ? ' · dev mode' : ''}
          </p>
        )}
      </header>

      {/* Top-level page mode selector */}
      <div style={STYLES.pageModeRow}>
        {(Object.keys(PAGE_MODE_LABELS) as DevMenuPageMode[]).map(mode => (
          <button
            key={mode}
            className={`chip-btn${pageMode === mode ? ' chip-btn--active' : ''}`}
            onClick={() => setPageMode(mode)}
          >
            {PAGE_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      <section
        data-testid="devmenu-visual-education-library"
        style={STYLES.visualAuthorityPanel}
      >
        <div style={{ display: 'grid', gap: 4 }}>
          <h2 style={{ margin: 0, fontSize: '1rem', color: '#1e3a8a' }}>Atlas Visual Language Authority</h2>
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#1d4ed8' }}>
            Use the Visual Education Library as the single front door for canonical heating visuals.
            The sealed + unvented visual workbench is currently a candidate reference under visual correction, not yet canonical.
          </p>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#1d4ed8' }}>
            Mechanical drawing source of truth: <code style={STYLES.code}>docs/atlas-canonical-mechanical-primitive-spec.md</code>.
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a className="chip-btn" href={VISUAL_EDUCATION_LIBRARY_QA_HUB.routePath}>Open canonical hub</a>
            {candidateReferenceSurface != null && (
              <a className="chip-btn" href={candidateReferenceSurface.routePath}>{candidateReferenceSurface.actionLabel ?? 'Open candidate reference'}</a>
            )}
          </div>
        </div>
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          {orderedVisualEducationLibraryItems.map(({ surface, registryItem }) => {
            const routeKind = registryItem.routeKind ?? 'unknown';
            const access = registryItem.access ?? 'dev_only';
            return (
            <article
              key={surface.id}
              data-testid={`devmenu-visual-education-library-${surface.id}`}
              style={{
                background: '#fff',
                border: '1px solid #bfdbfe',
                borderRadius: 10,
                padding: '0.75rem',
                display: 'grid',
                gap: 8,
              }}
            >
              <div style={{ display: 'grid', gap: 4 }}>
                <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{surface.commonName}</strong>
                <p style={{ margin: 0, fontSize: '0.8125rem', color: '#475569' }}>{surface.description}</p>
              </div>
              <div style={STYLES.badgeRow}>
                <span style={{ ...STYLES.badge, color: ROUTE_KIND_COLORS[routeKind], borderColor: ROUTE_KIND_COLORS[routeKind] }}>
                  {ROUTE_KIND_LABELS[routeKind]}
                </span>
                <span style={{ ...STYLES.badge, color: ACCESS_COLORS[access], borderColor: ACCESS_COLORS[access] }}>
                  {ACCESS_LABELS[access]}
                </span>
                <span style={{ ...STYLES.badge, color: STATUS_COLORS[registryItem.status], borderColor: STATUS_COLORS[registryItem.status] }}>
                  {STATUS_LABELS[registryItem.status]}
                </span>
                {surface.statusBadges?.map((statusBadge) => (
                  <span key={`${surface.id}-${statusBadge}`} style={STYLES.badge}>
                    {statusBadge}
                  </span>
                ))}
              </div>
               <div style={{ display: 'grid', gap: 4, fontSize: '0.75rem', color: '#334155' }}>
                 <span><strong>Primary route:</strong> <code style={STYLES.code}>{surface.routePath}</code></span>
               </div>
               <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                 <a className="chip-btn" href={surface.routePath}>{surface.actionLabel ?? 'Open surface'}</a>
                </div>
             </article>
            );
          })}
        </div>
      </section>

      <InventorySection
        title="Customer-facing tools"
        description="Start here for the product surfaces that matter most in demos, reviews, and editorial sign-off."
        items={inventorySections.customerFacing}
        emptyMessage="No customer-facing tools match the current filters."
        renderItem={(item) => (
          <FeaturedEntryCard
            key={item.id}
            item={item}
            summary={CUSTOMER_FACING_SUMMARIES[item.id] ?? item.notes ?? 'Customer-facing Atlas surface.'}
            onPreview={() => setSelectedItem(item)}
          />
        )}
      />

      <details style={STYLES.devControlsPanel}>
        <summary style={STYLES.devControlsSummary}>Developer inventory filters and route shortcuts</summary>

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

        <div style={STYLES.filterRow}>
          <span style={STYLES.filterLabel}>Access:</span>
          {(['production', 'dev_only', 'fallback', 'review', 'retired'] as DevUiAccess[]).map(a => (
            <button
              key={a}
              className={`chip-btn${filters.accessFilter === a ? ' chip-btn--active' : ''}`}
              onClick={() => updateFilter('accessFilter', filters.accessFilter === a ? null : a)}
            >
              {ACCESS_LABELS[a]}
            </button>
          ))}
        </div>

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

        <div style={STYLES.filterRow}>
          <span style={STYLES.filterLabel}>Dev QA links:</span>
          <button className="chip-btn" onClick={() => { window.location.href = '/dev/portal-fixtures'; }}>Portal fixtures</button>
          <button className="chip-btn" onClick={() => { window.location.href = '/dev/welcome-pack'; }}>Welcome pack diagnostics</button>
          <button className="chip-btn" onClick={() => { window.location.href = '/?workspace-lifecycle-qa=1'; }}>Workspace lifecycle QA</button>
          <button className="chip-btn" onClick={() => setPageMode('phoneQa')}>Phone customer QA</button>
          <button className="chip-btn" onClick={() => { window.location.href = '/dev/inspector'; }}>Component discovery</button>
          <button className="chip-btn" onClick={() => { window.location.href = '/dev/workspace-settings'; }}>Workspace settings</button>
        </div>
      </details>

      <div style={STYLES.sectionToggleRow}>
        <button className={`chip-btn${showInternalWorkflows ? ' chip-btn--active' : ''}`} onClick={() => setShowInternalWorkflows(prev => !prev)}>
          {showInternalWorkflows ? 'Hide internal workflows' : 'Show internal workflows'} ({inventorySections.internalWorkflows.length})
        </button>
        <button className={`chip-btn${showDevTools ? ' chip-btn--active' : ''}`} onClick={() => setShowDevTools(prev => !prev)}>
          {showDevTools ? 'Hide dev & QA tools' : 'Show dev & QA tools'} ({inventorySections.developmentQa.length})
        </button>
        <button className={`chip-btn${showLegacyTools ? ' chip-btn--active' : ''}`} onClick={() => setShowLegacyTools(prev => !prev)}>
          {showLegacyTools ? 'Hide legacy tools' : 'Show legacy tools'} ({inventorySections.deprecatedLegacy.length})
        </button>
      </div>

      {showInternalWorkflows && (
        <InventorySection
          title="Internal workflows"
          description="Operational journeys and workspace flows used by the team, not the main educational entry points."
          items={inventorySections.internalWorkflows}
          emptyMessage="No internal workflows match the current filters."
          renderItem={(item) => (
            <RegistryCard
              key={item.id}
              item={item}
              expanded={expandedIds.has(item.id)}
              viewMode={filters.viewMode}
              onPreview={() => setSelectedItem(item)}
              onToggleExpand={() => handleToggleExpand(item.id)}
            />
          )}
        />
      )}

      {showDevTools && (
        <InventorySection
          title="Development and QA tools"
          description="Diagnostics, audits, and engineering-only surfaces kept out of the default customer-focused view."
          items={inventorySections.developmentQa}
          emptyMessage="No dev or QA tools match the current filters."
          renderItem={(item) => (
            <RegistryCard
              key={item.id}
              item={item}
              expanded={expandedIds.has(item.id)}
              viewMode={filters.viewMode}
              onPreview={() => setSelectedItem(item)}
              onToggleExpand={() => handleToggleExpand(item.id)}
            />
          )}
        />
      )}

      {showLegacyTools && (
        <InventorySection
          title="Deprecated and legacy tools"
          description="Archived or superseded surfaces kept only for explicit comparison, diagnostics, or migration support."
          items={inventorySections.deprecatedLegacy}
          emptyMessage="No legacy tools match the current filters."
          renderItem={(item) => (
            <RegistryCard
              key={item.id}
              item={item}
              expanded={expandedIds.has(item.id)}
              viewMode={filters.viewMode}
              onPreview={() => setSelectedItem(item)}
              onToggleExpand={() => handleToggleExpand(item.id)}
            />
          )}
        />
      )}

      {!showInternalWorkflows && !showDevTools && !showLegacyTools && (
        <p style={STYLES.hiddenSectionsHint}>
          Dev, QA, and legacy surfaces are hidden by default so this page behaves like an entry-point hub instead of a historical dump.
        </p>
      )}

      {/* Copy box */}
      <CopyBox
        output={copyBoxOutput}
        format={copyFormat}
        copied={copyBoxCopied}
        onFormatChange={setCopyFormat}
        onCopy={handleCopyCopyBox}
      />

      {/* Demo data seed */}
      <div style={STYLES.demoSeedSection}>
        <p style={STYLES.demoSeedHint}>
          🎬 <strong>Load demo workspace</strong> — restores the canonical Demo Heating Co workspace
          with sample user profiles, analytics events, and a sample file manifest.
          After loading you will land on the workspace dashboard with the demo banner active.
          Clears all existing analytics events. Leaves brand profiles and real visits untouched.
        </p>
        <button
          className="chip-btn"
          onClick={handleResetDemoData}
          disabled={demoSeedDone}
          style={STYLES.demoSeedBtn}
        >
          {demoSeedDone ? '✓ Demo workspace loaded — navigating…' : '🎬 Load demo workspace'}
        </button>
      </div>

      {/* Dev/support: reset local Atlas session cache */}
      <div style={STYLES.cacheResetSection}>
        <p style={STYLES.cacheResetHint}>
          ⚠️ <strong>Reset local session cache</strong> — clears Atlas-owned localStorage keys only.
          Use when state becomes stale or to reproduce a fresh-start scenario.
        </p>
        <button
          className="chip-btn"
          onClick={handleResetCache}
          disabled={cacheResetDone}
          style={STYLES.cacheResetBtn}
        >
          {cacheResetDone ? '✓ Cache cleared — reloading…' : '🗑 Reset local session cache'}
        </button>
      </div>
    </div>
  );
}

// ─── Hardware patch store helpers ─────────────────────────────────────────────

const HARDWARE_PATCHES_STORAGE_KEY = 'atlas_dev_hardware_patches';

function loadHardwarePatches(): HardwarePatchV1 {
  try {
    const raw = localStorage.getItem(HARDWARE_PATCHES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (
        parsed != null &&
        typeof parsed === 'object' &&
        'version' in parsed &&
        (parsed as { version: unknown }).version === '1'
      ) {
        return parsed as HardwarePatchV1;
      }
    }
  } catch {
    // Ignore parse errors — return empty patch set.
  }
  return { version: '1', overrides: {} };
}

function saveHardwarePatches(patch: HardwarePatchV1): void {
  localStorage.setItem(HARDWARE_PATCHES_STORAGE_KEY, JSON.stringify(patch));
}

// ─── Blank form state ─────────────────────────────────────────────────────────

interface PatchFormState {
  modelId: string;
  brand: string;
  brandName: string;
  seriesId: string;
  seriesName: string;
  seriesDescription: string;
  modelName: string;
  outputKw: string;
  widthMm: string;
  depthMm: string;
  heightMm: string;
  frontMm: string;
  sideMm: string;
  topMm: string;
  bottomMm: string;
  notes: string;
}

const BLANK_PATCH_FORM: PatchFormState = {
  modelId: '', brand: '', brandName: '', seriesId: '', seriesName: '',
  seriesDescription: '', modelName: '', outputKw: '', widthMm: '', depthMm: '',
  heightMm: '', frontMm: '', sideMm: '', topMm: '', bottomMm: '', notes: '',
};

function parsePatchForm(form: PatchFormState): ApplianceDefinitionV1 | null {
  const outputKw = parseFloat(form.outputKw);
  const widthMm = parseInt(form.widthMm, 10);
  const depthMm = parseInt(form.depthMm, 10);
  const heightMm = parseInt(form.heightMm, 10);
  const frontMm = parseInt(form.frontMm, 10);
  const sideMm = parseInt(form.sideMm, 10);
  const topMm = parseInt(form.topMm, 10);
  const bottomMm = parseInt(form.bottomMm, 10);

  if (
    !form.modelId.trim() || !form.brand.trim() || !form.brandName.trim() ||
    !form.seriesId.trim() || !form.seriesName.trim() || !form.modelName.trim() ||
    isNaN(outputKw) || isNaN(widthMm) || isNaN(depthMm) || isNaN(heightMm) ||
    isNaN(frontMm) || isNaN(sideMm) || isNaN(topMm) || isNaN(bottomMm)
  ) {
    return null;
  }

  return {
    modelId: form.modelId.trim(),
    brand: form.brand.trim(),
    brandName: form.brandName.trim(),
    seriesId: form.seriesId.trim(),
    seriesName: form.seriesName.trim(),
    seriesDescription: form.seriesDescription.trim() || undefined,
    modelName: form.modelName.trim(),
    outputKw,
    dimensions: { widthMm, depthMm, heightMm },
    clearanceRules: { frontMm, sideMm, topMm, bottomMm },
    logoPath: null,
  };
}

// ─── Hardware Patch Editor Panel ──────────────────────────────────────────────

function HardwarePatchEditorPanel() {
  const [patches, setPatches] = useState<HardwarePatchV1>(() => loadHardwarePatches());
  const [form, setForm] = useState<PatchFormState>(BLANK_PATCH_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedModelId, setSavedModelId] = useState<string | null>(null);

  const overrideEntries = Object.entries(patches.overrides);

  function handleField(key: keyof PatchFormState, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
    setFormError(null);
  }

  function handleSave() {
    const definition = parsePatchForm(form);
    if (!definition) {
      setFormError('Please fill in all required fields with valid values.');
      return;
    }
    const entry: HardwarePatchEntryV1 = {
      updatedAt: new Date().toISOString(),
      definition,
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };
    const updated: HardwarePatchV1 = {
      version: '1',
      overrides: { ...patches.overrides, [definition.modelId]: entry },
    };
    saveHardwarePatches(updated);
    setPatches(updated);
    setSavedModelId(definition.modelId);
    setForm(BLANK_PATCH_FORM);
    setFormError(null);
    setTimeout(() => setSavedModelId(null), 3000);
  }

  function handleDelete(modelId: string) {
    const { [modelId]: _deletedEntry, ...rest } = patches.overrides;
    const updated: HardwarePatchV1 = { version: '1', overrides: rest };
    saveHardwarePatches(updated);
    setPatches(updated);
  }

  const fieldStyle: CSSProperties = {
    width: '100%', padding: '0.4rem 0.5rem', border: '1px solid #cbd5e1',
    borderRadius: '6px', fontSize: '0.875rem', background: '#fff', color: '#1e293b',
    boxSizing: 'border-box',
  };
  const labelStyle: CSSProperties = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569',
    marginBottom: '0.2rem',
  };
  const gridStyle: CSSProperties = {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '0.75rem', marginBottom: '1rem',
  };
  const sectionStyle: CSSProperties = {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px',
    padding: '1.25rem', marginBottom: '1.5rem',
  };
  const sectionHeadingStyle: CSSProperties = {
    margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 700, color: '#1e293b',
  };

  return (
    <div>
      {/* ── Add / edit form ───────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>Add custom appliance</h2>

        <p style={{ fontSize: '0.8125rem', color: '#64748b', marginBottom: '1rem' }}>
          Define an appliance not in the standard MasterRegistry. All dimension
          and clearance values must be in millimetres.
        </p>

        <div style={{ ...gridStyle, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
          <div>
            <label style={labelStyle} htmlFor="patch-modelId">Model ID *</label>
            <input id="patch-modelId" style={fieldStyle} type="text" placeholder="e.g. custom_wb_30kw"
              value={form.modelId} onChange={e => handleField('modelId', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="patch-modelName">Model name *</label>
            <input id="patch-modelName" style={fieldStyle} type="text" placeholder="e.g. Custom WB 30kW"
              value={form.modelName} onChange={e => handleField('modelName', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="patch-outputKw">Output (kW) *</label>
            <input id="patch-outputKw" style={fieldStyle} type="number" min="0" step="0.1" placeholder="30"
              value={form.outputKw} onChange={e => handleField('outputKw', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="patch-brand">Brand slug *</label>
            <input id="patch-brand" style={fieldStyle} type="text" placeholder="e.g. worcester_bosch"
              value={form.brand} onChange={e => handleField('brand', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="patch-brandName">Brand name *</label>
            <input id="patch-brandName" style={fieldStyle} type="text" placeholder="e.g. Worcester Bosch"
              value={form.brandName} onChange={e => handleField('brandName', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="patch-seriesId">Series ID *</label>
            <input id="patch-seriesId" style={fieldStyle} type="text" placeholder="e.g. greenstar_4000"
              value={form.seriesId} onChange={e => handleField('seriesId', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="patch-seriesName">Series name *</label>
            <input id="patch-seriesName" style={fieldStyle} type="text" placeholder="e.g. Greenstar 4000"
              value={form.seriesName} onChange={e => handleField('seriesName', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="patch-seriesDescription">Series description</label>
            <input id="patch-seriesDescription" style={fieldStyle} type="text" placeholder="e.g. Wall-hung combi range"
              value={form.seriesDescription} onChange={e => handleField('seriesDescription', e.target.value)} />
          </div>
        </div>

        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', margin: '0 0 0.5rem' }}>
          Dimensions (mm) *
        </p>
        <div style={gridStyle}>
          <div>
            <label style={labelStyle} htmlFor="patch-widthMm">Width (W)</label>
            <input id="patch-widthMm" style={fieldStyle} type="number" min="0" placeholder="390"
              value={form.widthMm} onChange={e => handleField('widthMm', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="patch-depthMm">Depth (D)</label>
            <input id="patch-depthMm" style={fieldStyle} type="number" min="0" placeholder="338"
              value={form.depthMm} onChange={e => handleField('depthMm', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="patch-heightMm">Height (H)</label>
            <input id="patch-heightMm" style={fieldStyle} type="number" min="0" placeholder="740"
              value={form.heightMm} onChange={e => handleField('heightMm', e.target.value)} />
          </div>
        </div>

        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', margin: '0 0 0.5rem' }}>
          Clearance offsets (mm) *
        </p>
        <div style={gridStyle}>
          <div>
            <label style={labelStyle} htmlFor="patch-frontMm">Front</label>
            <input id="patch-frontMm" style={fieldStyle} type="number" min="0" placeholder="450"
              value={form.frontMm} onChange={e => handleField('frontMm', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="patch-sideMm">Side</label>
            <input id="patch-sideMm" style={fieldStyle} type="number" min="0" placeholder="50"
              value={form.sideMm} onChange={e => handleField('sideMm', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="patch-topMm">Top</label>
            <input id="patch-topMm" style={fieldStyle} type="number" min="0" placeholder="150"
              value={form.topMm} onChange={e => handleField('topMm', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle} htmlFor="patch-bottomMm">Bottom</label>
            <input id="patch-bottomMm" style={fieldStyle} type="number" min="0" placeholder="100"
              value={form.bottomMm} onChange={e => handleField('bottomMm', e.target.value)} />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle} htmlFor="patch-notes">Notes (optional)</label>
          <input id="patch-notes" style={{ ...fieldStyle, maxWidth: '480px' }} type="text"
            placeholder="e.g. Legacy boiler not in manufacturer's current range."
            value={form.notes} onChange={e => handleField('notes', e.target.value)} />
        </div>

        {formError && (
          <p role="alert" style={{ color: '#dc2626', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
            ⚠ {formError}
          </p>
        )}

        {savedModelId && (
          <p role="status" style={{ color: '#16a34a', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
            ✓ Saved custom appliance: <code>{savedModelId}</code>
          </p>
        )}

        <button className="chip-btn" onClick={handleSave} style={{ fontWeight: 600 }}>
          💾 Save custom appliance
        </button>
      </div>

      {/* ── Saved patches list ────────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <h2 style={sectionHeadingStyle}>
          Saved custom appliances{overrideEntries.length > 0 ? ` (${overrideEntries.length})` : ''}
        </h2>

        {overrideEntries.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            No custom appliances defined yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {overrideEntries.map(([modelId, entry]) => (
              <div key={modelId} style={{
                border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.875rem',
                background: '#f8fafc',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                      {entry.definition.modelName}
                    </p>
                    <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                      <code>{modelId}</code> · {entry.definition.brandName} · {entry.definition.outputKw} kW
                    </p>
                    <p style={{ margin: '0.1rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                      {entry.definition.dimensions.widthMm} × {entry.definition.dimensions.depthMm} × {entry.definition.dimensions.heightMm} mm
                    </p>
                    {entry.notes && (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                        {entry.notes}
                      </p>
                    )}
                  </div>
                  <button
                    className="chip-btn"
                    onClick={() => handleDelete(modelId)}
                    aria-label={`Delete custom appliance ${modelId}`}
                    style={{ flexShrink: 0, marginLeft: '0.75rem', color: '#dc2626', borderColor: '#dc2626' }}
                  >
                    🗑 Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function resolveNavigableRoute(item: DevUiRegistryItem): string | null {
  const route = resolveRouteDisplay(item);
  if (route === 'unresolved' || route.startsWith('unresolved')) return null;
  return route;
}

function downloadTextFile(fileName: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}

function LibraryBrowserPanel({
  onBack,
  onPreview,
}: {
  onBack: () => void;
  onPreview: (item: DevUiRegistryItem) => void;
}) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<DevUiCategory | 'all'>('all');

  const categoryOptions = useMemo(() => {
    const set = new Set<DevUiCategory>();
    DEV_UI_REGISTRY.forEach(item => set.add(item.category));
    return Array.from(set).sort();
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return DEV_UI_REGISTRY.filter((item) => {
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (query === '') return true;
      const text = [
        item.commonName,
        item.codeName,
        item.filePath,
        item.fileName,
        item.fullRouteExample ?? '',
        item.routePath ?? '',
        ...(item.queryFlags ?? []),
      ].join(' ').toLowerCase();
      return text.includes(query);
    });
  }, [search, categoryFilter]);

  function handleDownloadReference() {
    const referenceText = generateLibraryReferenceText(DEV_UI_REGISTRY);
    downloadTextFile('atlas-ui-library-reference.txt', referenceText);
  }

  return (
    <div style={STYLES.page}>
      <header style={STYLES.header}>
        <button className="back-btn" onClick={onBack} style={{ marginBottom: '1rem' }}>
          ← UI Inventory
        </button>
        <div style={STYLES.titleRow}>
          <h1 style={STYLES.title}>📚 Library</h1>
          <span style={STYLES.devBadge}>DEV ONLY</span>
        </div>
        <p style={STYLES.subtitle}>
          Browse and navigate the Atlas UI library, then download a text reference file.
        </p>
      </header>

      <div style={STYLES.libraryToolbar}>
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search by name, code, file, route…"
          style={STYLES.searchInput}
          aria-label="Search library entries"
        />
        <button className="chip-btn" onClick={handleDownloadReference}>
          ⬇ Download reference (.txt)
        </button>
      </div>

      <div style={STYLES.filterRow}>
        <span style={STYLES.filterLabel}>Category:</span>
        <button
          className={`chip-btn${categoryFilter === 'all' ? ' chip-btn--active' : ''}`}
          onClick={() => setCategoryFilter('all')}
        >
          All
        </button>
        {categoryOptions.map(category => (
          <button
            key={category}
            className={`chip-btn${categoryFilter === category ? ' chip-btn--active' : ''}`}
            onClick={() => setCategoryFilter(category)}
          >
            {CATEGORY_LABELS[category]}
          </button>
        ))}
      </div>

      <div style={STYLES.librarySummaryRow}>
        <span style={STYLES.summaryText}>
          Showing {filteredItems.length} of {DEV_UI_REGISTRY.length} entries.
        </span>
      </div>

      <div style={STYLES.tableWrap}>
        <table style={STYLES.table}>
          <thead>
            <tr>
              <th style={STYLES.th}>Name</th>
              <th style={STYLES.th}>Category</th>
              <th style={STYLES.th}>Route</th>
              <th style={STYLES.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map(item => {
              const route = resolveNavigableRoute(item);
              return (
                <tr key={item.id}>
                  <td style={STYLES.td}>
                    <div style={STYLES.libraryNameCell}>
                      <strong>{item.commonName}</strong>
                      <code>{item.codeName}</code>
                    </div>
                  </td>
                  <td style={STYLES.td}>
                    <span style={{ ...STYLES.badge, ...STYLES.categoryBadge }}>
                      {CATEGORY_LABELS[item.category]}
                    </span>
                  </td>
                  <td style={STYLES.td}>
                    <code>{route ?? 'unresolved'}</code>
                  </td>
                  <td style={STYLES.td}>
                    <div style={STYLES.libraryActionsRow}>
                      <button className="chip-btn" onClick={() => onPreview(item)}>
                        Preview
                      </button>
                      {route != null && (
                        <button
                          className="chip-btn"
                          onClick={() => { window.location.href = route; }}
                        >
                          Open route
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Registry card ────────────────────────────────────────────────────────────

function InventorySection({
  title,
  description,
  items,
  emptyMessage,
  renderItem,
}: {
  title: string;
  description: string;
  items: DevUiRegistryItem[];
  emptyMessage: string;
  renderItem: (item: DevUiRegistryItem) => ReactNode;
}) {
  return (
    <section style={STYLES.inventorySection}>
      <div style={STYLES.inventorySectionHeader}>
        <div>
          <h2 style={STYLES.inventorySectionTitle}>{title}</h2>
          <p style={STYLES.inventorySectionDescription}>{description}</p>
        </div>
        <span style={STYLES.inventorySectionCount}>{items.length}</span>
      </div>

      <div style={STYLES.list} role="list">
        {items.length === 0 ? (
          <p style={STYLES.empty}>{emptyMessage}</p>
        ) : (
          items.map(item => renderItem(item))
        )}
      </div>
    </section>
  );
}

function FeaturedEntryCard({
  item,
  summary,
  onPreview,
}: {
  item: DevUiRegistryItem;
  summary: string;
  onPreview: () => void;
}) {
  const href = resolveDirectRouteHref(item);
  const actionLabel = href != null ? 'Open tool' : 'Preview surface';

  return (
    <article role="listitem" style={STYLES.featuredCard}>
      <div style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'grid', gap: 4 }}>
          <strong style={STYLES.featuredCardTitle}>{item.commonName}</strong>
          <p style={STYLES.featuredCardSummary}>{summary}</p>
        </div>
        <div style={STYLES.badgeRow}>
          {item.access != null && (
            <span style={{ ...STYLES.badge, color: ACCESS_COLORS[item.access], borderColor: ACCESS_COLORS[item.access] }}>
              {ACCESS_LABELS[item.access]}
            </span>
          )}
          <span style={{ ...STYLES.badge, color: STATUS_COLORS[item.status], borderColor: STATUS_COLORS[item.status] }}>
            {STATUS_LABELS[item.status]}
          </span>
          <span style={{ ...STYLES.badge, ...STYLES.categoryBadge }}>
            {CATEGORY_LABELS[item.category]}
          </span>
        </div>
      </div>

      {href != null ? (
        <a className="chip-btn" href={href}>{actionLabel}</a>
      ) : (
        <button className="chip-btn" onClick={onPreview}>{actionLabel}</button>
      )}
    </article>
  );
}

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
  pageModeRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.25rem',
    flexWrap: 'wrap',
  },
  controls: {
    marginBottom: '0.75rem',
  },
  devControlsPanel: {
    marginTop: '1.25rem',
    marginBottom: '1rem',
    padding: '0.9rem 1rem',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
  },
  devControlsSummary: {
    cursor: 'pointer',
    fontWeight: 600,
    color: '#334155',
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
  visualAuthorityPanel: {
    background: '#eff6ff',
    border: '1px solid #93c5fd',
    borderRadius: 12,
    padding: '0.9rem 1rem',
    display: 'grid',
    gap: '0.85rem',
  },
  sectionToggleRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginTop: '1rem',
    marginBottom: '1rem',
  },
  inventorySection: {
    marginTop: '1.25rem',
  },
  inventorySectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
    marginBottom: '0.75rem',
  },
  inventorySectionTitle: {
    margin: 0,
    fontSize: '1rem',
    color: '#1e293b',
  },
  inventorySectionDescription: {
    margin: '0.25rem 0 0',
    fontSize: '0.8125rem',
    color: '#64748b',
  },
  inventorySectionCount: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '2rem',
    padding: '0.2rem 0.55rem',
    borderRadius: '999px',
    background: '#e2e8f0',
    color: '#334155',
    fontSize: '0.75rem',
    fontWeight: 700,
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
  hiddenSectionsHint: {
    margin: '0.25rem 0 0',
    color: '#64748b',
    fontSize: '0.8125rem',
  },
  featuredCard: {
    borderRadius: '12px',
    border: '1px solid #dbeafe',
    background: '#fff',
    padding: '1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '1rem',
  },
  featuredCardTitle: {
    fontSize: '1rem',
    color: '#0f172a',
  },
  featuredCardSummary: {
    margin: 0,
    fontSize: '0.8125rem',
    color: '#475569',
    maxWidth: '48rem',
  },
  summaryText: {
    color: '#334155',
    fontSize: '0.82rem',
  },
  libraryToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginBottom: '0.75rem',
  },
  librarySummaryRow: {
    marginBottom: '0.75rem',
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
  libraryNameCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  libraryActionsRow: {
    display: 'flex',
    gap: '0.4rem',
    flexWrap: 'wrap',
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
  cacheResetSection: {
    marginTop: '2rem',
    padding: '1rem',
    background: '#fef9c3',
    border: '1px solid #fde047',
    borderRadius: '0.5rem',
  },
  cacheResetHint: {
    margin: '0 0 0.75rem',
    fontSize: '0.875rem',
    color: '#92400e',
  },
  cacheResetBtn: {
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: '0.375rem',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
  demoSeedSection: {
    marginTop: '1.5rem',
    padding: '1rem',
    background: '#f0fdf4',
    border: '1px solid #86efac',
    borderRadius: '0.5rem',
  },
  demoSeedHint: {
    margin: '0 0 0.75rem',
    fontSize: '0.875rem',
    color: '#166534',
  },
  demoSeedBtn: {
    background: '#16a34a',
    color: '#fff',
    border: 'none',
    borderRadius: '0.375rem',
    padding: '0.5rem 1rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
  },
};
