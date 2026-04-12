/**
 * EngineerWarningsPanel.tsx
 *
 * PR11 — Pre-install review warnings panel for the engineer route.
 *
 * Shows missing critical information, missing recommended data,
 * and low-confidence items that should be verified before the visit.
 */

import type { EngineerDisplayModel } from './types/engineerDisplay.types';

interface Props {
  model: EngineerDisplayModel;
}

function WarningList({ items, variant }: { items: string[]; variant: 'critical' | 'recommended' | 'confidence' }) {
  if (items.length === 0) return null;

  const config = {
    critical:   { icon: '🔴', color: '#742a2a', bg: '#fff5f5', border: '#fed7d7', heading: 'Confirm before starting' },
    recommended: { icon: '💡', color: '#744210', bg: '#fffff0', border: '#fefcbf', heading: 'Worth checking on arrival' },
    confidence: { icon: '⚠️', color: '#2a4365', bg: '#ebf8ff', border: '#bee3f8', heading: 'Assumption to verify on arrival' },
  }[variant];

  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <p style={{
        margin: '0 0 0.4rem',
        fontSize: '0.72rem',
        fontWeight: 700,
        color: config.color,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        {config.icon} {config.heading}
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              fontSize: '0.82rem',
              color: config.color,
              background: config.bg,
              border: `1px solid ${config.border}`,
              borderRadius: '5px',
              padding: '0.35rem 0.65rem',
            }}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EngineerWarningsPanel({ model }: Props) {
  const { warnings } = model;

  const hasWarnings =
    warnings.missingCritical.length > 0 ||
    warnings.missingRecommended.length > 0 ||
    warnings.confidenceWarnings.length > 0;

  return (
    <div
      data-testid="engineer-warnings"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
        Before you start
      </h2>

      {!hasWarnings ? (
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#276749', fontWeight: 500 }}>
          ✓ All good — nothing to confirm before starting.
        </p>
      ) : (
        <>
          <WarningList items={warnings.missingCritical}    variant="critical" />
          <WarningList items={warnings.missingRecommended} variant="recommended" />
          <WarningList items={warnings.confidenceWarnings} variant="confidence" />
        </>
      )}
    </div>
  );
}
