/**
 * InstallNotesSection.tsx
 *
 * PR7 — Install-time operational notes for the engineer handoff surface.
 *
 * Shows install notes derived from physics flags, DHW architecture, and
 * lifecycle condition. Also shows the future upgrade path when present.
 *
 * Tone: direct, factual. Examples:
 *   "G3 installer required"
 *   "Verify discharge route"
 *   "22mm primary pipework present — verify flow rate"
 */

import type { EngineerHandoff } from '../../../contracts/EngineerHandoff';

interface Props {
  installNotes: EngineerHandoff['installNotes'];
  futurePath?: EngineerHandoff['futurePath'];
}

export function InstallNotesSection({ installNotes, futurePath }: Props) {
  const hasNotes       = installNotes.length > 0;
  const hasFuturePath  = (futurePath?.length ?? 0) > 0;

  if (!hasNotes && !hasFuturePath) return null;

  return (
    <div
      data-testid="engineer-handoff-install-notes"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      {hasNotes && (
        <>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
            📋 Install notes
          </h2>
          <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {installNotes.map((note, i) => (
              <li
                key={i}
                style={{
                  fontSize: '0.82rem',
                  color: '#2d3748',
                  padding: '0.4rem 0.65rem',
                  background: '#f7fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '5px',
                  display: 'flex',
                  gap: '0.4rem',
                  alignItems: 'flex-start',
                }}
              >
                <span aria-hidden="true" style={{ color: '#ed8936', flexShrink: 0 }}>→</span>
                {note}
              </li>
            ))}
          </ul>
        </>
      )}

      {hasFuturePath && futurePath && futurePath.length > 0 && (
        <>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
            🔮 Future path
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {futurePath.map((path, i) => (
              <li
                key={i}
                style={{
                  fontSize: '0.82rem',
                  color: '#553c9a',
                  padding: '0.35rem 0.65rem',
                  background: '#faf5ff',
                  border: '1px solid #e9d8fd',
                  borderRadius: '5px',
                }}
              >
                {path}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
