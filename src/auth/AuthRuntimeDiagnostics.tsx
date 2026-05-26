import type { CSSProperties } from 'react';
import { useAtlasAuth } from './useAtlasAuth';

const SHOULD_SHOW_AUTH_RUNTIME_DIAGNOSTICS =
  import.meta.env.DEV &&
  import.meta.env.MODE !== 'test';

const PANEL_STYLE: CSSProperties = {
  position: 'fixed',
  right: '1rem',
  bottom: '1rem',
  zIndex: 2147483647,
  width: 'min(24rem, calc(100vw - 2rem))',
  background: 'rgba(15, 23, 42, 0.96)',
  color: '#e2e8f0',
  border: '1px solid rgba(148, 163, 184, 0.35)',
  borderRadius: 12,
  boxShadow: '0 16px 40px rgba(15, 23, 42, 0.35)',
  fontFamily: 'ui-monospace, SFMono-Regular, SFMono-Regular, Consolas, monospace',
  fontSize: '0.78rem',
};

const SUMMARY_STYLE: CSSProperties = {
  cursor: 'pointer',
  padding: '0.8rem 0.9rem',
  fontWeight: 700,
};

const CONTENT_STYLE: CSSProperties = {
  display: 'grid',
  gap: '0.55rem',
  padding: '0 0.9rem 0.9rem',
};

const ROW_STYLE: CSSProperties = {
  display: 'grid',
  gap: '0.15rem',
};

const LABEL_STYLE: CSSProperties = {
  color: '#94a3b8',
};

export function AuthRuntimeDiagnostics() {
  const { authRuntimeConfig } = useAtlasAuth();

  if (!SHOULD_SHOW_AUTH_RUNTIME_DIAGNOSTICS) {
    return null;
  }

  return (
    <details style={PANEL_STYLE} open>
      <summary style={SUMMARY_STYLE}>Auth runtime diagnostics</summary>
      <div style={CONTENT_STYLE}>
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Auth mode</span>
          <span>{authRuntimeConfig.modeLabel}</span>
        </div>
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Firebase config present</span>
          <span>{authRuntimeConfig.isFirebaseConfigured ? 'Yes' : 'No'}</span>
        </div>
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Google OAuth client ID present</span>
          <span>{authRuntimeConfig.googleOAuthClientIdPresent ? 'Yes' : 'No'}</span>
        </div>
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Auth disabled intentionally</span>
          <span>{authRuntimeConfig.authDisabledIntentionally ? 'Yes' : 'No'}</span>
        </div>
        {!authRuntimeConfig.isFirebaseConfigured && (
          <div style={ROW_STYLE}>
            <span style={LABEL_STYLE}>Missing Firebase vars</span>
            <span>{authRuntimeConfig.missingFirebaseVars.join(', ')}</span>
          </div>
        )}
        {authRuntimeConfig.usesLegacyFirebaseApiKeyFallback && (
          <div style={ROW_STYLE}>
            <span style={LABEL_STYLE}>Firebase API key source</span>
            <span>Legacy firebase_api_key compatibility fallback</span>
          </div>
        )}
        <div style={ROW_STYLE}>
          <span style={LABEL_STYLE}>Status</span>
          <span>{authRuntimeConfig.statusMessage}</span>
        </div>
      </div>
    </details>
  );
}
