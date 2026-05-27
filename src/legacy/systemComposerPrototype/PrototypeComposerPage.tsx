/**
 * PrototypeComposerPage.tsx
 *
 * Top-level page for the legacy System Composer prototype — the archived
 * drag-and-drop workbench retained for diagnostics only.
 *
 * Wraps BuilderShell with a minimal chrome (back button + title) so it can
 * be rendered directly from the App navigation without modifications to the
 * engine contract or schema.
 */

import BuilderShell from './builder/BuilderShell';

interface Props {
  onBack: () => void;
}

export default function PrototypeComposerPage({ onBack }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8fafc' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: '#fff',
        borderBottom: '1px solid #e2e8f0',
        zIndex: 10,
      }}>
        <button
          onClick={onBack}
          aria-label="Back to home"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.95rem',
            color: '#475569',
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
          }}
        >
          ← Back
        </button>
        <span style={{ width: 1, height: '1.25rem', background: '#e2e8f0' }} aria-hidden />
        <span style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>
          🧱 Atlas System Composer
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <BuilderShell />
      </div>
    </div>
  );
}
