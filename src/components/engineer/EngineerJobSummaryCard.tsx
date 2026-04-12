/**
 * EngineerJobSummaryCard.tsx
 *
 * PR11 — Top-level job card for the engineer pre-install route.
 *
 * Shows address, visit reference, status, current system, and recommended system.
 * This is the first thing an engineer sees — intended to feel like a job card.
 */

import type { EngineerDisplayModel } from './types/engineerDisplay.types';

interface Props {
  model: EngineerDisplayModel;
}

export function EngineerJobSummaryCard({ model }: Props) {
  return (
    <div
      data-testid="engineer-job-summary"
      style={{
        background: '#1a202c',
        color: '#fff',
        borderRadius: '8px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.25rem',
      }}
    >
      {/* Title / address */}
      <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
        {model.title}
      </h1>
      {model.address && model.address !== model.title && (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#a0aec0' }}>
          {model.address}
        </p>
      )}

      {/* Reference + status row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1rem', marginBottom: '0.85rem', alignItems: 'center' }}>
        {model.visitReference && (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#90cdf4',
            background: 'rgba(144,205,244,0.1)',
            padding: '0.15rem 0.5rem',
            borderRadius: '4px',
            border: '1px solid rgba(144,205,244,0.3)',
          }}>
            Ref: {model.visitReference}
          </span>
        )}
        {model.statusLabel && (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: '#68d391',
            background: 'rgba(104,211,145,0.1)',
            padding: '0.15rem 0.5rem',
            borderRadius: '4px',
            border: '1px solid rgba(104,211,145,0.3)',
          }}>
            {model.statusLabel}
          </span>
        )}
      </div>

      {/* System pair */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <div>
          <p style={{ margin: '0 0 0.15rem', fontSize: '0.65rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Current system
          </p>
          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0' }}>
            {model.currentSystem ?? '—'}
          </p>
        </div>
        <div>
          <p style={{ margin: '0 0 0.15rem', fontSize: '0.65rem', color: '#718096', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Recommended
          </p>
          <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: '#90cdf4' }}>
            {model.recommendedSystem ?? '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
