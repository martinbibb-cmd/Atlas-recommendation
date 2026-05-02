/**
 * src/features/analytics/AnalyticsDashboard.tsx
 *
 * Tenant-level KPI dashboard for workspace analytics.
 *
 * Privacy rules (inherited from analyticsStore)
 * ──────────────────────────────────────────────
 * - Displays only aggregated counts and percentages.
 * - No names, addresses, survey payloads, photos, transcripts, or raw visit
 *   details are ever shown or exported.
 * - Export produces the same aggregate-only shape as TenantAnalyticsAggregate.
 *
 * Features
 * ────────
 * - Date filters: All Time | Last 7 days | Last 30 days | Custom range
 * - KPI tiles: visits created, visits completed, completion rate, avg duration,
 *   recommendation views, recommendation selections, top selected scenario
 * - CSV export (aggregate only)
 * - JSON export (aggregate only)
 * - Tenant-scoped: if tenantId is provided, only that tenant's data is shown
 */

import { useState, useMemo } from 'react';
import {
  aggregateByTenantFiltered,
  aggregatesToCsv,
} from './analyticsStore';
import type {
  AnalyticsDateFilter,
  TenantAnalyticsAggregate,
} from './analyticsStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function formatPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysAgoIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function downloadText(text: string, filename: string, mimeType: string): void {
  try {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // Best effort — some environments don't support Blob/URL.createObjectURL.
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: '16px 20px',
        minWidth: 140,
        flex: '1 1 140px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: '#64748b',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#0f172a', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px',
        fontSize: 13,
        fontWeight: active ? 700 : 400,
        background: active ? '#4f46e5' : '#fff',
        color: active ? '#fff' : '#374151',
        border: `1px solid ${active ? '#4f46e5' : '#e2e8f0'}`,
        borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface AnalyticsDashboardProps {
  /** When provided, only this tenant's data is shown. */
  tenantId?: string;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyticsDashboard({ tenantId, onBack }: AnalyticsDashboardProps) {
  const [filterType, setFilterType] = useState<AnalyticsDateFilter['type']>('all_time');
  const [customFrom, setCustomFrom] = useState<string>(sevenDaysAgoIso());
  const [customTo, setCustomTo] = useState<string>(todayIso());
  const [showCustom, setShowCustom] = useState(false);

  const filter = useMemo<AnalyticsDateFilter>(() => {
    if (filterType === 'custom') {
      return { type: 'custom', from: customFrom, to: customTo };
    }
    return { type: filterType };
  }, [filterType, customFrom, customTo]);

  const allAggregates = useMemo(() => aggregateByTenantFiltered(filter), [filter]);

  // Scope to a single tenant when tenantId is supplied, else show all aggregates.
  const aggregates = useMemo<TenantAnalyticsAggregate[]>(() => {
    if (tenantId == null) return allAggregates;
    const match = allAggregates.find((a) => a.tenantId === tenantId);
    return match ? [match] : [];
  }, [allAggregates, tenantId]);

  // Combine all shown aggregates into a single KPI summary for the tiles.
  const summary = useMemo<TenantAnalyticsAggregate>(() => {
    if (aggregates.length === 1) return aggregates[0];

    const visitsCreated = aggregates.reduce((s, a) => s + a.visitsCreated, 0);
    const visitsCompleted = aggregates.reduce((s, a) => s + a.visitsCompleted, 0);
    const completionRate = visitsCreated > 0 ? visitsCompleted / visitsCreated : 0;
    const recommendationViews = aggregates.reduce((s, a) => s + a.recommendationViews, 0);
    const recommendationSelections = aggregates.reduce(
      (s, a) => s + a.recommendationSelections,
      0,
    );

    // Weighted average duration
    const durAggregates = aggregates.filter((a) => a.avgDurationSeconds !== null);
    const avgDurationSeconds =
      durAggregates.length > 0
        ? durAggregates.reduce(
            (sum, a) => sum + (a.avgDurationSeconds as number) * a.visitsCompleted,
            0,
          ) / durAggregates.reduce((sum, a) => sum + a.visitsCompleted, 0)
        : null;

    // Merge top scenarios
    const scenarioCounts: Record<string, number> = {};
    for (const a of aggregates) {
      for (const { scenarioId, count } of a.topSelectedScenarioIds) {
        scenarioCounts[scenarioId] = (scenarioCounts[scenarioId] ?? 0) + count;
      }
    }
    const topSelectedScenarioIds = Object.entries(scenarioCounts)
      .map(([scenarioId, count]) => ({ scenarioId, count }))
      .sort((a, b) => b.count - a.count);

    return {
      tenantId: tenantId ?? undefined,
      visitsCreated,
      visitsCompleted,
      completionRate,
      avgDurationSeconds: Number.isFinite(avgDurationSeconds ?? NaN)
        ? (avgDurationSeconds as number)
        : null,
      recommendationViews,
      recommendationSelections,
      topSelectedScenarioIds,
    };
  }, [aggregates, tenantId]);

  // ── Export handlers ─────────────────────────────────────────────────────────

  function handleExportCsv() {
    const csv = aggregatesToCsv(aggregates.length > 0 ? aggregates : [summary]);
    downloadText(csv, 'atlas-analytics-export.csv', 'text/csv');
  }

  function handleExportJson() {
    const payload = aggregates.length > 0 ? aggregates : [summary];
    downloadText(
      JSON.stringify(payload, null, 2),
      'atlas-analytics-export.json',
      'application/json',
    );
  }

  // ── Filter button active state ──────────────────────────────────────────────

  function handleFilterClick(type: AnalyticsDateFilter['type']) {
    setFilterType(type);
    setShowCustom(type === 'custom');
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const top = summary.topSelectedScenarioIds[0];

  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#fff',
          borderBottom: '1px solid #e2e8f0',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <button
          onClick={onBack}
          style={{
            fontSize: 13,
            padding: '4px 12px',
            border: '1px solid #e2e8f0',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Workspace Analytics</h1>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Tenant-level usage metrics — no customer data
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>

        {/* Date filter bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          <FilterButton
            label="All time"
            active={filterType === 'all_time'}
            onClick={() => handleFilterClick('all_time')}
          />
          <FilterButton
            label="Last 7 days"
            active={filterType === 'last_7_days'}
            onClick={() => handleFilterClick('last_7_days')}
          />
          <FilterButton
            label="Last 30 days"
            active={filterType === 'last_30_days'}
            onClick={() => handleFilterClick('last_30_days')}
          />
          <FilterButton
            label="Custom range"
            active={filterType === 'custom'}
            onClick={() => handleFilterClick('custom')}
          />
        </div>

        {/* Custom range picker */}
        {showCustom && (
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '14px 18px',
              marginBottom: 20,
              display: 'flex',
              gap: 16,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <label style={{ fontSize: 13, color: '#374151' }}>
              From
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                style={{
                  marginLeft: 8,
                  padding: '4px 8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  fontSize: 13,
                }}
              />
            </label>
            <label style={{ fontSize: 13, color: '#374151' }}>
              To
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={todayIso()}
                onChange={(e) => setCustomTo(e.target.value)}
                style={{
                  marginLeft: 8,
                  padding: '4px 8px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  fontSize: 13,
                }}
              />
            </label>
          </div>
        )}

        {/* KPI tiles */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 28,
          }}
        >
          <KpiTile label="Visits created" value={summary.visitsCreated} />
          <KpiTile label="Visits completed" value={summary.visitsCompleted} />
          <KpiTile
            label="Completion rate"
            value={formatPct(summary.completionRate)}
            sub={`${summary.visitsCompleted} of ${summary.visitsCreated}`}
          />
          <KpiTile
            label="Avg duration"
            value={formatDuration(summary.avgDurationSeconds)}
            sub="per completed visit"
          />
          <KpiTile label="Rec. views" value={summary.recommendationViews} />
          <KpiTile label="Rec. selections" value={summary.recommendationSelections} />
          <KpiTile
            label="Top scenario"
            value={top ? top.scenarioId : '—'}
            sub={top ? `${top.count} selection${top.count !== 1 ? 's' : ''}` : undefined}
          />
        </div>

        {/* Export bar */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 10,
            padding: '16px 20px',
          }}
        >
          <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#374151' }}>
            Export
          </h2>
          <p style={{ margin: '0 0 14px', fontSize: 13, color: '#64748b' }}>
            Aggregate-only — no names, addresses, survey answers, photos, or raw visit data.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={handleExportCsv}
              style={{
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: 600,
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Export CSV
            </button>
            <button
              onClick={handleExportJson}
              style={{
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: 600,
                background: '#fff',
                color: '#374151',
                border: '1px solid #e2e8f0',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Export JSON
            </button>
          </div>
        </div>

        {/* Empty state */}
        {aggregates.length === 0 && (
          <div
            style={{
              marginTop: 28,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '28px 24px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: 14,
            }}
          >
            No analytics events recorded for this date range yet.
          </div>
        )}
      </div>
    </div>
  );
}
