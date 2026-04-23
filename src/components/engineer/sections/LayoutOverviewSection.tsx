/**
 * LayoutOverviewSection.tsx
 *
 * PR8 — Spatial overview card for the engineer handoff surface.
 *
 * Shows room count, named spaces, any recorded measurements, and a
 * structural summary. When no layout is available the section is silent
 * (null) so the page does not show an empty or broken card.
 *
 * Data comes from EngineerHandoff.layout and EngineerHandoff.layoutSummary.
 */

import type { EngineerHandoff } from '../../../contracts/EngineerHandoff';

interface Props {
  layout: EngineerHandoff['layout'];
  layoutSummary?: EngineerHandoff['layoutSummary'];
}

export function LayoutOverviewSection({ layout, layoutSummary }: Props) {
  if (!layout) return null;

  const { rooms, walls, objects } = layout;
  const roomCount    = rooms.length;
  const wallCount    = walls.length;
  const openingCount = walls.reduce((n, w) => n + (w.openings?.length ?? 0), 0);
  const objectCount  = objects.length;

  const hasSummaryLines = (layoutSummary?.length ?? 0) > 0;

  return (
    <div
      data-testid="engineer-layout-overview"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <h2 style={{ margin: '0 0 0.85rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
        🗺 Layout overview
      </h2>

      {/* Summary lines from builder */}
      {hasSummaryLines && layoutSummary && (
        <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          {layoutSummary.map((line, i) => (
            <li
              key={i}
              style={{
                fontSize: '0.82rem',
                color: '#2d3748',
                padding: '0.35rem 0.65rem',
                background: '#ebf8ff',
                border: '1px solid #bee3f8',
                borderRadius: '5px',
              }}
            >
              {line}
            </li>
          ))}
        </ul>
      )}

      {/* Stat grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
        gap: '0.6rem',
        marginBottom: roomCount > 0 ? '1rem' : 0,
      }}>
        {[
          { label: 'Rooms',    value: roomCount    },
          { label: 'Walls',    value: wallCount    },
          { label: 'Openings', value: openingCount },
          { label: 'Objects',  value: objectCount  },
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

      {/* Named spaces */}
      {roomCount > 0 && (
        <>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Recorded spaces
          </h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {rooms.map(room => (
              <li
                key={room.id}
                style={{
                  fontSize: '0.78rem',
                  color: '#2d3748',
                  background: '#f7fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '5px',
                  padding: '0.25rem 0.6rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                {room.name}
                {room.areaM2 !== undefined && (
                  <span style={{ fontSize: '0.7rem', color: '#718096' }}>
                    {room.areaM2.toFixed(1)} m²
                  </span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {roomCount === 0 && objectCount === 0 && (
        <p style={{ margin: 0, fontSize: '0.82rem', color: '#718096', fontStyle: 'italic' }}>
          No spatial data recorded — verify on arrival.
        </p>
      )}
    </div>
  );
}
