/**
 * EngineerLayoutSummary.tsx
 *
 * PR11 — Captured property and system layout panel for the engineer route.
 *
 * Shows room count, key tagged components, evidence counts, and spatial context.
 * Sourced from the EngineerDisplayModel's captureSummary and keyComponents.
 */

import type { EngineerDisplayModel } from './types/engineerDisplay.types';

interface Props {
  model: EngineerDisplayModel;
}

const COMPONENT_ICONS: Record<string, string> = {
  boiler:    '🔥',
  heat_pump: '♨️',
  cylinder:  '🛢️',
  manifold:  '🔧',
  pump:      '⚙️',
  meter:     '📊',
  flue:      '🏭',
  controls:  '🎛️',
  other:     '📦',
};

export function EngineerLayoutSummary({ model }: Props) {
  const { captureSummary, keyComponents } = model;

  return (
    <div
      data-testid="engineer-layout-summary"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
        📐 Captured layout &amp; evidence
      </h2>

      {/* Capture stat grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
        gap: '0.6rem',
        marginBottom: keyComponents.length > 0 ? '1rem' : 0,
      }}>
        {[
          { label: 'Rooms', value: captureSummary.roomCount },
          { label: 'Components', value: captureSummary.objectCount },
          { label: 'Photos', value: captureSummary.photoCount },
          { label: 'Voice notes', value: captureSummary.voiceNoteCount },
          { label: 'Extracted facts', value: captureSummary.extractedFactCount },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: '#f7fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              padding: '0.5rem 0.65rem',
              textAlign: 'center',
            }}
          >
            <p style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#2d3748' }}>
              {value}
            </p>
            <p style={{ margin: 0, fontSize: '0.65rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {/* Key components list */}
      {keyComponents.length > 0 && (
        <>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Key components
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {keyComponents.map(c => (
              <li
                key={c.id}
                data-testid={`engineer-component-${c.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.82rem',
                  color: '#2d3748',
                  background: '#f7fafc',
                  border: '1px solid #edf2f7',
                  borderRadius: '5px',
                  padding: '0.35rem 0.65rem',
                }}
              >
                <span aria-hidden="true">{COMPONENT_ICONS[c.type] ?? '📦'}</span>
                <span style={{ fontWeight: 600, flex: 1 }}>{c.label}</span>
                {c.roomLabel && (
                  <span style={{ fontSize: '0.72rem', color: '#718096' }}>
                    {c.roomLabel}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {keyComponents.length === 0 && captureSummary.objectCount === 0 && (
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#718096', fontStyle: 'italic' }}>
          No system components captured yet. Verify on arrival.
        </p>
      )}
    </div>
  );
}
