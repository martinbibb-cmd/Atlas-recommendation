/**
 * IncludedScopeSection.tsx
 *
 * PR7 — Lists all items included in the proposed scope of work.
 *
 * Items come directly from AtlasDecisionV1.includedItems via the EngineerHandoff
 * projection. Rendered as a simple scan-friendly list.
 */

import type { EngineerHandoff } from '../../../contracts/EngineerHandoff';

interface Props {
  includedScope: EngineerHandoff['includedScope'];
  requiredWorks: EngineerHandoff['requiredWorks'];
}

export function IncludedScopeSection({ includedScope, requiredWorks }: Props) {
  const hasScope = includedScope.length > 0;
  const hasWorks = requiredWorks.length > 0;

  if (!hasScope && !hasWorks) return null;

  return (
    <div
      data-testid="engineer-handoff-scope"
      style={{
        background: '#fff',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      {hasScope && (
        <>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
            📦 Included scope
          </h2>
          <ul style={{ listStyle: 'none', margin: '0 0 1rem', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {includedScope.map((item, i) => (
              <li
                key={i}
                style={{
                  fontSize: '0.85rem',
                  color: '#2d3748',
                  padding: '0.35rem 0.65rem',
                  background: '#f7fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span aria-hidden="true" style={{ color: '#48bb78', fontWeight: 700 }}>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </>
      )}

      {hasWorks && (
        <>
          <h2 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', fontWeight: 700, color: '#2d3748' }}>
            🔧 Required works
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {requiredWorks.map((item, i) => (
              <li
                key={i}
                style={{
                  fontSize: '0.85rem',
                  color: '#744210',
                  padding: '0.35rem 0.65rem',
                  background: '#fffff0',
                  border: '1px solid #fefcbf',
                  borderRadius: '5px',
                }}
              >
                {item}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
