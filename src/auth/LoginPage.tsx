import { useState } from 'react';
import { useAtlasAuth } from './useAtlasAuth';

export function LoginPage() {
  const { continueWithGoogle, isDevMockAuthEnabled } = useAtlasAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await continueWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in with Google.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#f8fafc',
        padding: '1rem',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          padding: '1.4rem',
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
        }}
      >
        <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.35rem' }}>Atlas Mind</h1>
        <p style={{ margin: '0 0 1rem', fontSize: '0.92rem', color: '#475569' }}>
          Sign in to access your workspace and visits.
        </p>

        <button
          type="button"
          onClick={() => { void handleContinue(); }}
          disabled={busy}
          style={{
            width: '100%',
            padding: '0.72rem 1rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: busy ? 'not-allowed' : 'pointer',
            opacity: busy ? 0.75 : 1,
          }}
        >
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>

        {isDevMockAuthEnabled && (
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', color: '#64748b' }}>
            Dev mock auth is enabled.
          </p>
        )}

        {error && (
          <p role="alert" style={{ margin: '0.75rem 0 0', color: '#dc2626', fontSize: '0.85rem' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
