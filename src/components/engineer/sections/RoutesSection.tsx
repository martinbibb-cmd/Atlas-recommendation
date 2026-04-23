/**
 * RoutesSection.tsx
 *
 * PR8 — Pipe and service routes for the engineer handoff surface.
 *
 * Shows existing, proposed, and assumed routes with clear visual distinction.
 * Assumed routes are always flagged so the engineer knows what needs
 * confirming on site.
 *
 * Data comes from EngineerHandoff.layout.routes.
 */

import type { EngineerHandoff } from '../../../contracts/EngineerHandoff';
import type { EngineerLayoutRoute, EngineerLayoutRouteType, LayoutConfidence } from '../../../contracts/EngineerLayout';

interface Props {
  layout: EngineerHandoff['layout'];
}

// ─── Route type labels ────────────────────────────────────────────────────────

const ROUTE_TYPE_LABELS: Record<EngineerLayoutRouteType, string> = {
  flow:        'Flow',
  return:      'Return',
  cold:        'Cold supply',
  hot:         'Hot supply',
  condensate:  'Condensate',
  discharge:   'Discharge',
};

const ROUTE_TYPE_COLORS: Record<EngineerLayoutRouteType, string> = {
  flow:        '#e53e3e',   // red — heating flow
  return:      '#3182ce',   // blue — heating return
  cold:        '#63b3ed',   // light blue — cold supply
  hot:         '#ed8936',   // orange — hot supply
  condensate:  '#718096',   // grey — condensate
  discharge:   '#d69e2e',   // amber — discharge / PRV
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EngineerLayoutRoute['status'], { label: string; color: string; bg: string; border: string }> = {
  existing: { label: 'Existing',  color: '#276749', bg: '#f0fff4', border: '#9ae6b4' },
  proposed: { label: 'Proposed',  color: '#2a4365', bg: '#ebf8ff', border: '#bee3f8' },
  assumed:  { label: 'Assumed',   color: '#744210', bg: '#fffff0', border: '#f6e05e' },
};

function StatusBadge({ status }: { status: EngineerLayoutRoute['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      fontSize: '0.65rem',
      fontWeight: 700,
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      padding: '0.1rem 0.45rem',
      borderRadius: '4px',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

const CONFIDENCE_NEEDS_BADGE: LayoutConfidence[] = ['assumed', 'needs_verification'];

const CONFIDENCE_LABELS: Record<LayoutConfidence, string> = {
  confirmed:          'Confirmed',
  inferred:           'Inferred',
  assumed:            'Assumed',
  needs_verification: 'Verify on site',
};

const CONFIDENCE_COLORS: Record<LayoutConfidence, { color: string; bg: string; border: string }> = {
  confirmed:          { color: '#276749', bg: '#f0fff4', border: '#9ae6b4' },
  inferred:           { color: '#2a4365', bg: '#ebf8ff', border: '#bee3f8' },
  assumed:            { color: '#744210', bg: '#fffff0', border: '#f6e05e' },
  needs_verification: { color: '#742a2a', bg: '#fff5f5', border: '#feb2b2' },
};

function ConfidenceBadge({ confidence }: { confidence: LayoutConfidence }) {
  if (!CONFIDENCE_NEEDS_BADGE.includes(confidence)) return null;
  const cfg = CONFIDENCE_COLORS[confidence];
  return (
    <span style={{
      fontSize: '0.65rem',
      fontWeight: 700,
      color: cfg.color,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      padding: '0.1rem 0.45rem',
      borderRadius: '4px',
      whiteSpace: 'nowrap',
    }}>
      {CONFIDENCE_LABELS[confidence]}
    </span>
  );
}

// ─── Route row ────────────────────────────────────────────────────────────────

function RouteRow({ route }: { route: EngineerLayoutRoute }) {
  const typeColor = ROUTE_TYPE_COLORS[route.type];
  const typeLabel = ROUTE_TYPE_LABELS[route.type];

  return (
    <li
      data-testid={`engineer-layout-route-${route.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.82rem',
        color: '#2d3748',
        background: '#f7fafc',
        border: '1px solid #edf2f7',
        borderRadius: '5px',
        padding: '0.4rem 0.65rem',
      }}
    >
      {/* Colour bar indicating route type */}
      <span
        aria-hidden="true"
        style={{
          display: 'inline-block',
          width: '4px',
          height: '2rem',
          borderRadius: '2px',
          background: typeColor,
          flexShrink: 0,
        }}
      />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{typeLabel}</p>
        {(route.fromLabel || route.toLabel) && (
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: '#718096' }}>
            {route.fromLabel ?? '—'} → {route.toLabel ?? '—'}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexShrink: 0 }}>
        <StatusBadge status={route.status} />
        <ConfidenceBadge confidence={route.confidence} />
      </div>
    </li>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

// Display order: existing before proposed before assumed.
const STATUS_ORDER: EngineerLayoutRoute['status'][] = ['existing', 'proposed', 'assumed'];

export function RoutesSection({ layout }: Props) {
  if (!layout?.routes || layout.routes.length === 0) return null;

  const sorted = [...layout.routes].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status),
  );

  const hasAssumed = sorted.some(r => r.status === 'assumed');

  return (
    <div
      data-testid="engineer-layout-routes"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
        🔧 Routes
      </h2>

      {hasAssumed && (
        <p style={{
          margin: '0 0 0.75rem',
          padding: '0.4rem 0.65rem',
          background: '#fffff0',
          border: '1px solid #f6e05e',
          borderRadius: '5px',
          fontSize: '0.78rem',
          color: '#744210',
        }}>
          ⚠️ Some routes are assumed — confirm paths on arrival before cutting or drilling.
        </p>
      )}

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {sorted.map(route => (
          <RouteRow key={route.id} route={route} />
        ))}
      </ul>
    </div>
  );
}
