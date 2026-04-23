/**
 * WarningsSection.tsx
 *
 * PR7 — Compatibility warnings and key reasons for the engineer handoff surface.
 *
 * Shows physics-grounded compatibility warnings (from AtlasDecisionV1.compatibilityWarnings)
 * and the key reasons the scenario was chosen (from AtlasDecisionV1.keyReasons).
 * Styled for fast scanning — warnings get red, reasons get blue.
 */

import type { EngineerHandoff } from '../../../contracts/EngineerHandoff';

interface Props {
  compatibilityWarnings: EngineerHandoff['compatibilityWarnings'];
  keyReasons: EngineerHandoff['keyReasons'];
}

export function WarningsSection({ compatibilityWarnings, keyReasons }: Props) {
  const hasWarnings = compatibilityWarnings.length > 0;
  const hasReasons  = keyReasons.length > 0;

  if (!hasWarnings && !hasReasons) return null;

  return (
    <div
      data-testid="engineer-handoff-warnings"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      {hasWarnings && (
        <>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#742a2a' }}>
            ⚠️ Compatibility warnings
          </h2>
          <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {compatibilityWarnings.map((warning, i) => (
              <li
                key={i}
                style={{
                  fontSize: '0.82rem',
                  color: '#742a2a',
                  padding: '0.35rem 0.65rem',
                  background: '#fff5f5',
                  border: '1px solid #fed7d7',
                  borderRadius: '5px',
                }}
              >
                {warning}
              </li>
            ))}
          </ul>
        </>
      )}

      {hasReasons && (
        <>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
            ✅ Why this system
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {keyReasons.map((reason, i) => (
              <li
                key={i}
                style={{
                  fontSize: '0.82rem',
                  color: '#2b6cb0',
                  padding: '0.35rem 0.65rem',
                  background: '#ebf8ff',
                  border: '1px solid #bee3f8',
                  borderRadius: '5px',
                }}
              >
                {reason}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
