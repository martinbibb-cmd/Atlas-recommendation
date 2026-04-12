/**
 * EngineerRequiredWorkPanel.tsx
 *
 * PR11 — Required work and install reasoning panel for the engineer route.
 *
 * Shows what work is needed, why Atlas flagged it, and what caveats apply.
 * Severity is indicated by colour so the engineer can prioritise at a glance.
 */

import type { EngineerDisplayModel, EngineerRequiredWorkItem } from './types/engineerDisplay.types';

interface Props {
  model: EngineerDisplayModel;
}

const SEVERITY_CONFIG: Record<EngineerRequiredWorkItem['severity'], { label: string; color: string; bg: string; border: string; icon: string }> = {
  required:    { label: 'Required',    color: '#742a2a', bg: '#fff5f5', border: '#fed7d7', icon: '🔴' },
  recommended: { label: 'Recommended', color: '#744210', bg: '#fffff0', border: '#fefcbf', icon: '🟡' },
  review:      { label: 'Review',      color: '#2a4365', bg: '#ebf8ff', border: '#bee3f8', icon: '🔵' },
};

export function EngineerRequiredWorkPanel({ model }: Props) {
  const { requiredWork } = model;

  return (
    <div
      data-testid="engineer-required-work"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
        🔧 Required work &amp; why
      </h2>

      {requiredWork.length === 0 ? (
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#718096', fontStyle: 'italic' }}>
          No specific work items derived from available data. Review on arrival.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {requiredWork.map((item, i) => {
            const cfg = SEVERITY_CONFIG[item.severity];
            return (
              <li
                key={i}
                data-testid={`engineer-work-item-${i}`}
                style={{
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  borderRadius: '6px',
                  padding: '0.6rem 0.85rem',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start',
                }}
              >
                <span aria-hidden="true" style={{ flexShrink: 0, lineHeight: 1.4 }}>{cfg.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 0.2rem', fontSize: '0.85rem', fontWeight: 600, color: cfg.color }}>
                    {item.title}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: '#4a5568' }}>
                    {item.reason}
                  </p>
                </div>
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: cfg.color,
                  background: 'rgba(255,255,255,0.5)',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                  flexShrink: 0,
                }}>
                  {cfg.label}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
