/**
 * src/features/workspace/WorkspaceDashboard.tsx
 *
 * Workspace Dashboard — the single obvious landing page for each workspace.
 *
 * Sections
 * ────────
 * 1. Active workspace / tenant header (name, slug, status badge)
 * 2. Active user + resolved role
 * 3. Start New Visit CTA (role-aware)
 * 4. Visits — three buckets shown inline:
 *      • Recent (last 5 by updated_at)
 *      • Incomplete (new / survey_started)
 *      • Completed needing outcome (recommendation_ready / complete — not yet quoted)
 * 5. Analytics snapshot KPI tiles (role-aware: canViewAnalytics)
 * 6. Branding setup card (role-aware: canEditBranding)
 * 7. External files / privacy note
 * 8. Role-aware action row (analytics, branding, workspace settings, user profile)
 *
 * Design rules
 * ────────────
 * - No engine or recommendation logic — visits and analytics only.
 * - Uses resolveActiveTenant for tenant header.
 * - Uses useActiveUser + useRolePermissions for user/role.
 * - Uses aggregateByTenant for analytics snapshot.
 * - Uses listVisits from visitApi for the three visit buckets.
 * - All inline styles — matches existing Atlas component convention.
 */

import { useEffect, useMemo, useState } from 'react';
import { useActiveUser } from '../userProfiles/useActiveUser';
import { useRolePermissions } from '../userProfiles/useRolePermissions';
import { resolveActiveTenant } from '../tenants/activeTenant';
import { listStoredBrandProfiles } from '../branding/brandProfileStore';
import { aggregateByTenant } from '../analytics/analyticsStore';
import {
  listVisits,
  visitDisplayLabel,
  visitStatusLabel,
  matchesFilter,
  type VisitMeta,
} from '../../lib/visits/visitApi';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WorkspaceDashboardProps {
  /** Called when the user clicks the Start New Visit CTA. */
  onStartNewVisit: () => void;
  /** Called when the user opens a specific visit. */
  onOpenVisit: (visitId: string) => void;
  /** Called when the user opens the full visits list. */
  onOpenAllVisits: () => void;
  /** Called when the user opens the analytics dashboard. */
  onOpenAnalytics: () => void;
  /** Called when the user opens the branding editor. */
  onOpenBranding: () => void;
  /** Called when the user opens the workspace settings. */
  onOpenWorkspaceSettings: () => void;
  /** Called when the user opens the user profile panel. */
  onOpenUserProfile: () => void;
  /** Called to access the full legacy landing / all-tools view. */
  onOpenAllTools: () => void;
  /**
   * Called from the demo banner to open the external-files manifest for the
   * completed demo visit.  Only wired when demo data is active.
   */
  onOpenDemoExternalFiles?: () => void;
  /**
   * Called from the demo banner to open the customer-facing presentation/pack
   * for the completed demo visit.  Only wired when demo data is active.
   */
  onOpenDemoPresentation?: () => void;
  /**
   * Called from the demo banner (dev-mode only) to reseed the demo workspace
   * and return to the dashboard.
   */
  onLoadDemoWorkspace?: () => void;
}

// ─── Role label map ───────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  owner:    'Owner',
  admin:    'Admin',
  engineer: 'Engineer',
  sales:    'Sales',
  viewer:   'Viewer',
};

const ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  owner:    { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  admin:    { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  engineer: { bg: '#e0f2fe', color: '#075985', border: '#7dd3fc' },
  sales:    { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
  viewer:   { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({
  label,
  style,
}: {
  label: string;
  style: { bg: string; color: string; border: string };
}) {
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 12,
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '16px 20px',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#374151' }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// ─── Visit row ────────────────────────────────────────────────────────────────

function VisitRow({ v, onOpen }: { v: VisitMeta; onOpen: () => void }) {
  const headline = visitDisplayLabel(v);
  const label = visitStatusLabel(v.status);
  const dateLabel = formatRelativeDate(v.updated_at);

  return (
    <button
      onClick={onOpen}
      aria-label={`Open visit: ${headline}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        background: 'none',
        border: 'none',
        padding: '8px 0',
        cursor: 'pointer',
        borderBottom: '1px solid #f1f5f9',
        textAlign: 'left',
        gap: 8,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {headline}
        </div>
        {v.address_line_1 && (
          <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {v.address_line_1}{v.postcode ? ` · ${v.postcode}` : ''}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>{dateLabel}</span>
        <Badge
          label={label}
          style={{ bg: '#f8fafc', color: '#475569', border: '#e2e8f0' }}
        />
        <span style={{ color: '#94a3b8', fontSize: 14 }}>›</span>
      </div>
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyHint({ message }: { message: string }) {
  return (
    <p style={{ margin: 0, fontSize: 13, color: '#94a3b8', padding: '4px 0' }}>{message}</p>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────

function KpiTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: '12px 16px',
        flex: '1 1 120px',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WorkspaceDashboard({
  onStartNewVisit,
  onOpenVisit,
  onOpenAllVisits,
  onOpenAnalytics,
  onOpenBranding,
  onOpenWorkspaceSettings,
  onOpenUserProfile,
  onOpenAllTools,
  onOpenDemoExternalFiles,
  onOpenDemoPresentation,
  onLoadDemoWorkspace,
}: WorkspaceDashboardProps) {
  const { activeUser } = useActiveUser();
  const permissions = useRolePermissions(activeUser?.defaultTenantId);
  const { effectiveRole, canCreateVisit, canViewAnalytics, canEditBranding, canManageWorkspace } = permissions;

  // ── Active tenant ──────────────────────────────────────────────────────────
  const tenant = useMemo(() => {
    return resolveActiveTenant({
      tenantId: activeUser?.defaultTenantId ?? null,
      workspaceSlug: activeUser?.defaultWorkspaceSlug ?? null,
    });
  }, [activeUser]);

  // ── Brand profile ──────────────────────────────────────────────────────────
  const brandProfile = useMemo(() => {
    if (!tenant.brandId) return null;
    const profiles = listStoredBrandProfiles();
    return profiles[tenant.brandId] ?? null;
  }, [tenant.brandId]);

  const hasBrandingSetUp = brandProfile !== null && (
    (typeof brandProfile.companyName === 'string' && brandProfile.companyName.trim().length > 0) ||
    brandProfile.logoUrl != null
  );

  // ── Visits ─────────────────────────────────────────────────────────────────
  const [allVisits, setAllVisits] = useState<VisitMeta[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listVisits()
      .then((data) => {
        if (!cancelled) {
          setAllVisits(data);
          setVisitsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setVisitsLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Recent visits: last 5 by updated_at (server returns newest first)
  const recentVisits = useMemo(() => allVisits.slice(0, 5), [allVisits]);

  // Incomplete visits: new / survey_started
  const incompleteVisits = useMemo(
    () => allVisits.filter((v) => matchesFilter(v.status, 'active')),
    [allVisits],
  );

  // Completed needing outcome: recommendation_ready / complete (not yet quoted)
  const needsOutcomeVisits = useMemo(
    () => allVisits.filter((v) => matchesFilter(v.status, 'needs_followup')),
    [allVisits],
  );

  // ── Analytics snapshot ─────────────────────────────────────────────────────
  const analyticsSnapshot = useMemo(() => {
    if (!canViewAnalytics) return null;
    const aggregates = aggregateByTenant();
    // Prefer the tenant's own aggregate; fall back to combined summary.
    const match = aggregates.find((a) => a.tenantId === tenant.tenantId);
    if (match) return match;
    if (aggregates.length === 0) return null;
    // Combine all aggregates into a summary.
    const total = aggregates.reduce(
      (acc, a) => ({
        visitsCreated: acc.visitsCreated + a.visitsCreated,
        visitsCompleted: acc.visitsCompleted + a.visitsCompleted,
        wonJobs: acc.wonJobs + a.wonJobs,
        lostJobs: acc.lostJobs + a.lostJobs,
      }),
      { visitsCreated: 0, visitsCompleted: 0, wonJobs: 0, lostJobs: 0 },
    );
    const closeRate = total.wonJobs + total.lostJobs > 0
      ? total.wonJobs / (total.wonJobs + total.lostJobs)
      : 0;
    return {
      visitsCreated: total.visitsCreated,
      visitsCompleted: total.visitsCompleted,
      completionRate: total.visitsCreated > 0 ? total.visitsCompleted / total.visitsCreated : 0,
      wonJobs: total.wonJobs,
      lostJobs: total.lostJobs,
      closeRate,
    };
  }, [canViewAnalytics, tenant.tenantId]);

  // ── Styles ─────────────────────────────────────────────────────────────────

  const isDemoActive = tenant.tenantId === 'demo-heating';

  const roleColors = effectiveRole != null
    ? (ROLE_COLORS[effectiveRole] ?? ROLE_COLORS['viewer'])
    : { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };

  const roleLabel = effectiveRole != null
    ? (ROLE_LABELS[effectiveRole] ?? effectiveRole)
    : 'Guest';

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
      }}
    >
      {/* ── Header: workspace + user ──────────────────────────────────────── */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          padding: '14px 20px',
        }}
      >
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Workspace row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
                {brandProfile?.companyName ?? tenant.displayName}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                Workspace: <span style={{ fontFamily: 'monospace' }}>{tenant.workspaceSlug}</span>
                {tenant.status !== 'active' && (
                  <span style={{ marginLeft: 6, color: '#f59e0b', fontWeight: 600 }}>
                    [{tenant.status}]
                  </span>
                )}
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge label={roleLabel} style={roleColors} />
            </div>
          </div>

          {/* User row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>👤</span>
            <div>
              {activeUser !== null ? (
                <>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                    {activeUser.displayName}
                  </span>
                  {activeUser.email && (
                    <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 6 }}>
                      {activeUser.email}
                    </span>
                  )}
                </>
              ) : (
                <span style={{ fontSize: 13, color: '#94a3b8' }}>No profile set — guest access</span>
              )}
            </div>
            <button
              onClick={onOpenUserProfile}
              style={{
                marginLeft: 'auto',
                fontSize: 12,
                color: '#4f46e5',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              {activeUser !== null ? 'Switch profile' : 'Set up profile'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 20px 40px' }}>

        {/* ── Demo workspace banner ──────────────────────────────────────── */}
        {isDemoActive && (
          <div
            style={{
              background: '#fffbeb',
              border: '1px solid #fcd34d',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>🎬</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                  Demo workspace active
                </div>
                <div style={{ fontSize: 12, color: '#78350f' }}>
                  Demo Heating Co — use the shortcuts below to explore the key journeys.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <button
                onClick={() => onOpenVisit('demo_visit_001')}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#92400e',
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: 6,
                  padding: '5px 12px',
                  cursor: 'pointer',
                }}
              >
                📋 Open sample visit
              </button>
              <button
                onClick={onOpenAnalytics}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#92400e',
                  background: '#fef3c7',
                  border: '1px solid #fcd34d',
                  borderRadius: 6,
                  padding: '5px 12px',
                  cursor: 'pointer',
                }}
              >
                📊 View analytics
              </button>
              {onOpenDemoExternalFiles && (
                <button
                  onClick={onOpenDemoExternalFiles}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#92400e',
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    borderRadius: 6,
                    padding: '5px 12px',
                    cursor: 'pointer',
                  }}
                >
                  📎 View external files
                </button>
              )}
              {onOpenDemoPresentation && (
                <button
                  onClick={onOpenDemoPresentation}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#92400e',
                    background: '#fef3c7',
                    border: '1px solid #fcd34d',
                    borderRadius: 6,
                    padding: '5px 12px',
                    cursor: 'pointer',
                  }}
                >
                  🎯 View customer pack
                </button>
              )}
            </div>
            {activeUser?.developerMode && onLoadDemoWorkspace && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #fcd34d' }}>
                <button
                  onClick={onLoadDemoWorkspace}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: '#78350f',
                    background: 'none',
                    border: '1px solid #fcd34d',
                    borderRadius: 6,
                    padding: '4px 10px',
                    cursor: 'pointer',
                  }}
                >
                  🔄 Reload demo workspace
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Start New Visit CTA ─────────────────────────────────────────── */}
        {canCreateVisit && (
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={onStartNewVisit}
              style={{
                display: 'block',
                width: '100%',
                padding: '14px 20px',
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              ＋ Start New Visit
            </button>
          </div>
        )}

        {/* ── Incomplete visits ───────────────────────────────────────────── */}
        {!visitsLoading && incompleteVisits.length > 0 && (
          <SectionCard
            title={`Incomplete visits (${incompleteVisits.length})`}
            action={
              <button
                onClick={onOpenAllVisits}
                style={{ fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                See all →
              </button>
            }
          >
            {incompleteVisits.slice(0, 5).map((v) => (
              <VisitRow key={v.id} v={v} onOpen={() => onOpenVisit(v.id)} />
            ))}
            {incompleteVisits.length > 5 && (
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
                +{incompleteVisits.length - 5} more — <button onClick={onOpenAllVisits} style={{ fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>see all</button>
              </p>
            )}
          </SectionCard>
        )}

        {/* ── Completed needing outcome ────────────────────────────────────── */}
        {!visitsLoading && needsOutcomeVisits.length > 0 && (
          <SectionCard
            title={`Completed — needs outcome (${needsOutcomeVisits.length})`}
            action={
              <button
                onClick={onOpenAllVisits}
                style={{ fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                See all →
              </button>
            }
          >
            <p style={{ margin: '0 0 8px', fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 6, padding: '6px 10px' }}>
              ⚠ These visits have a recommendation ready but no job outcome recorded yet.
            </p>
            {needsOutcomeVisits.slice(0, 5).map((v) => (
              <VisitRow key={v.id} v={v} onOpen={() => onOpenVisit(v.id)} />
            ))}
            {needsOutcomeVisits.length > 5 && (
              <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
                +{needsOutcomeVisits.length - 5} more — <button onClick={onOpenAllVisits} style={{ fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>see all</button>
              </p>
            )}
          </SectionCard>
        )}

        {/* ── Recent visits ───────────────────────────────────────────────── */}
        <SectionCard
          title="Recent visits"
          action={
            allVisits.length > 5 ? (
              <button
                onClick={onOpenAllVisits}
                style={{ fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                See all →
              </button>
            ) : undefined
          }
        >
          {visitsLoading && (
            <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>Loading visits…</p>
          )}
          {!visitsLoading && recentVisits.length === 0 && (
            <EmptyHint message="No visits yet. Start a new visit to get going." />
          )}
          {!visitsLoading && recentVisits.map((v) => (
            <VisitRow key={v.id} v={v} onOpen={() => onOpenVisit(v.id)} />
          ))}
        </SectionCard>

        {/* ── Analytics snapshot ──────────────────────────────────────────── */}
        {canViewAnalytics && (
          <SectionCard
            title="Analytics snapshot"
            action={
              <button
                onClick={onOpenAnalytics}
                style={{ fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Full dashboard →
              </button>
            }
          >
            {analyticsSnapshot === null || analyticsSnapshot.visitsCreated === 0 ? (
              <EmptyHint message="No analytics data yet. Complete some visits to see stats here." />
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <KpiTile
                  label="Visits created"
                  value={analyticsSnapshot.visitsCreated}
                />
                <KpiTile
                  label="Visits completed"
                  value={analyticsSnapshot.visitsCompleted}
                  sub={`${formatPct(analyticsSnapshot.completionRate)} completion`}
                />
                <KpiTile
                  label="Close rate"
                  value={formatPct(analyticsSnapshot.closeRate)}
                  sub={`${analyticsSnapshot.wonJobs} won · ${analyticsSnapshot.lostJobs} lost`}
                />
              </div>
            )}
          </SectionCard>
        )}

        {/* ── Branding setup card ──────────────────────────────────────────── */}
        {canEditBranding && (
          <SectionCard title="Branding">
            {hasBrandingSetUp ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {brandProfile?.logoUrl && (
                  <img
                    src={brandProfile.logoUrl}
                    alt="Brand logo"
                    style={{ height: 36, maxWidth: 80, objectFit: 'contain', borderRadius: 4 }}
                  />
                )}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                    {brandProfile?.companyName}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Branding configured
                    {brandProfile?.theme?.primaryColor && (
                      <span style={{ marginLeft: 6 }}>
                        · <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: brandProfile.theme.primaryColor, verticalAlign: 'middle', marginRight: 2, border: '1px solid #e2e8f0' }} />
                        {brandProfile.theme.primaryColor}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={onOpenBranding}
                  style={{
                    marginLeft: 'auto',
                    fontSize: 12,
                    color: '#4f46e5',
                    background: 'none',
                    border: '1px solid #e2e8f0',
                    borderRadius: 6,
                    padding: '4px 10px',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#374151' }}>
                    Brand not configured. Add your company name, colors, and logo for white-labelled outputs.
                  </div>
                </div>
                <button
                  onClick={onOpenBranding}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    background: '#4f46e5',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 14px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Set up branding
                </button>
              </div>
            )}
          </SectionCard>
        )}

        {/* ── External files / privacy note ────────────────────────────────── */}
        <SectionCard title="External files &amp; privacy">
          <p style={{ margin: 0, fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
            External file references attached to visits (floor plans, photos, documents) are stored
            as URI pointers only — <strong>file contents are never sent to the Atlas analytics pipeline</strong>.
            File paths and URIs are redacted from all logs and developer panels.
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
            To attach files to a visit, open the visit and use the <em>External Files</em> option.
          </p>
        </SectionCard>

        {/* ── Role-aware action row ─────────────────────────────────────────── */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '16px 20px',
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#374151' }}>
            Quick actions
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {canCreateVisit && (
              <ActionChip label="＋ New Visit" onClick={onStartNewVisit} primary />
            )}
            <ActionChip label="🔍 Open Visit" onClick={onOpenAllVisits} />
            {canViewAnalytics && (
              <ActionChip label="📊 Analytics" onClick={onOpenAnalytics} />
            )}
            {canEditBranding && (
              <ActionChip label="🎨 Branding" onClick={onOpenBranding} />
            )}
            {canManageWorkspace && (
              <ActionChip label="⚙ Workspace settings" onClick={onOpenWorkspaceSettings} />
            )}
            <ActionChip label="👤 Profile" onClick={onOpenUserProfile} />
            <ActionChip label="All tools →" onClick={onOpenAllTools} muted />
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── ActionChip ───────────────────────────────────────────────────────────────

function ActionChip({
  label,
  onClick,
  primary = false,
  muted = false,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        fontSize: 13,
        fontWeight: primary ? 700 : 400,
        background: primary ? '#4f46e5' : '#fff',
        color: primary ? '#fff' : muted ? '#94a3b8' : '#374151',
        border: `1px solid ${primary ? '#4f46e5' : '#e2e8f0'}`,
        borderRadius: 20,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
