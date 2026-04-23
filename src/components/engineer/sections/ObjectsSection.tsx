/**
 * ObjectsSection.tsx
 *
 * PR8 — Key objects and dimensions for the engineer handoff surface.
 *
 * Shows boiler, cylinder, radiators, fixtures and other tagged objects with
 * their dimensions, room location, and a confidence badge so the engineer
 * knows what was confirmed vs assumed.
 *
 * Data comes from EngineerHandoff.layout.objects.
 */

import type { EngineerHandoff } from '../../../contracts/EngineerHandoff';
import type { EngineerLayoutObject, EngineerLayoutObjectType, LayoutConfidence } from '../../../contracts/EngineerLayout';

interface Props {
  layout: EngineerHandoff['layout'];
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const OBJECT_ICONS: Record<EngineerLayoutObjectType, string> = {
  boiler:        '🔥',
  cylinder:      '🛢️',
  radiator:      '♨️',
  sink:          '🚿',
  bath:          '🛁',
  shower:        '🚿',
  consumer_unit: '⚡',
  flue:          '🏭',
  other:         '📦',
};

const OBJECT_TYPE_LABELS: Record<EngineerLayoutObjectType, string> = {
  boiler:        'Boiler',
  cylinder:      'Cylinder',
  radiator:      'Radiator / emitter',
  sink:          'Sink',
  bath:          'Bath',
  shower:        'Shower',
  consumer_unit: 'Consumer unit',
  flue:          'Flue',
  other:         'Other',
};

// ─── Confidence badge ─────────────────────────────────────────────────────────

const CONFIDENCE_CONFIG: Record<LayoutConfidence, { label: string; color: string; bg: string; border: string }> = {
  confirmed:          { label: 'Confirmed',      color: '#276749', bg: '#f0fff4', border: '#9ae6b4' },
  inferred:           { label: 'Inferred',       color: '#2a4365', bg: '#ebf8ff', border: '#bee3f8' },
  assumed:            { label: 'Assumed',        color: '#744210', bg: '#fffff0', border: '#f6e05e' },
  needs_verification: { label: 'Verify on site', color: '#742a2a', bg: '#fff5f5', border: '#feb2b2' },
};

function ConfidenceBadge({ confidence }: { confidence: LayoutConfidence }) {
  const cfg = CONFIDENCE_CONFIG[confidence];
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
      flexShrink: 0,
    }}>
      {cfg.label}
    </span>
  );
}

// ─── Dimension string ─────────────────────────────────────────────────────────

function dimensionString(obj: EngineerLayoutObject): string | null {
  const parts: string[] = [];
  if (obj.widthMm  !== undefined) parts.push(`W ${obj.widthMm} mm`);
  if (obj.heightMm !== undefined) parts.push(`H ${obj.heightMm} mm`);
  if (obj.depthMm  !== undefined) parts.push(`D ${obj.depthMm} mm`);
  return parts.length > 0 ? parts.join(' × ') : null;
}

// ─── Object row ───────────────────────────────────────────────────────────────

function ObjectRow({ obj }: { obj: EngineerLayoutObject }) {
  const label = obj.label ?? OBJECT_TYPE_LABELS[obj.type];
  const dims  = dimensionString(obj);

  return (
    <li
      data-testid={`engineer-layout-object-${obj.id}`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.5rem',
        fontSize: '0.82rem',
        color: '#2d3748',
        background: '#f7fafc',
        border: '1px solid #edf2f7',
        borderRadius: '5px',
        padding: '0.45rem 0.65rem',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '1rem', flexShrink: 0 }}>
        {OBJECT_ICONS[obj.type]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
        {obj.positionHint && (
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: '#718096' }}>
            {obj.positionHint}
          </p>
        )}
        {dims && (
          <p style={{ margin: '0.1rem 0 0', fontSize: '0.75rem', color: '#4a5568' }}>
            {dims}
          </p>
        )}
      </div>
      <ConfidenceBadge confidence={obj.confidence} />
    </li>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

// Display order for object types — key install objects first.
const TYPE_ORDER: EngineerLayoutObjectType[] = [
  'boiler', 'cylinder', 'flue', 'consumer_unit',
  'radiator', 'sink', 'bath', 'shower', 'other',
];

export function ObjectsSection({ layout }: Props) {
  if (!layout || layout.objects.length === 0) return null;

  const sorted = [...layout.objects].sort(
    (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type),
  );

  return (
    <div
      data-testid="engineer-layout-objects"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
        📦 Objects &amp; dimensions
      </h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {sorted.map(obj => (
          <ObjectRow key={obj.id} obj={obj} />
        ))}
      </ul>
    </div>
  );
}
