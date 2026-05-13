/**
 * WorkspaceSessionGuard.tsx
 *
 * UI guard that renders contextual placeholder banners when a user's
 * workspace or authentication state prevents normal Atlas operation.
 *
 * Two states are handled:
 *
 * 1. Authenticated but no workspace
 *    The user has signed in but is not a member of any workspace yet.
 *    Shows a "Create or join workspace" prompt.
 *
 * 2. Unauthenticated (demo/session mode)
 *    The user has not signed in.  Visits and workflows are not linked to
 *    any account.  Shows an informational banner.
 *
 * When neither condition applies the component renders nothing (null) so it
 * can be composed anywhere without layout side-effects.
 */

import React from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkspaceSessionGuardProps {
  /** Whether the user currently has an authenticated session. */
  readonly isAuthenticated: boolean;

  /**
   * Whether the authenticated user is a member of at least one workspace.
   * Ignored when isAuthenticated is false.
   */
  readonly hasWorkspace: boolean;

  /**
   * Optional callback for the "Create workspace" action.
   * When provided, a button is rendered that invokes it.
   */
  readonly onCreateWorkspace?: () => void;
}

// ─── Banner styles (inline to avoid CSS dependency) ──────────────────────────

const BANNER_BASE: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: 8,
  fontSize: '0.9rem',
  lineHeight: 1.5,
  marginBottom: '1rem',
};

const UNAUTHENTICATED_BANNER: React.CSSProperties = {
  ...BANNER_BASE,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  color: '#64748b',
};

const NO_WORKSPACE_BANNER: React.CSSProperties = {
  ...BANNER_BASE,
  background: '#fffbeb',
  border: '1px solid #fde68a',
  color: '#92400e',
};

const ACTION_BUTTON: React.CSSProperties = {
  marginTop: '0.5rem',
  padding: '0.4rem 0.9rem',
  background: '#0f172a',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: '0.85rem',
  cursor: 'pointer',
};

// ─── Component ────────────────────────────────────────────────────────────────

import React from 'react';

export function WorkspaceSessionGuard({
  isAuthenticated,
  hasWorkspace,
  onCreateWorkspace,
}: WorkspaceSessionGuardProps): React.ReactElement | null {
  if (!isAuthenticated) {
    return (
      <div style={UNAUTHENTICATED_BANNER} role="status" aria-label="Demo mode banner">
        <strong>Demo / session mode</strong> — visits are not linked to an
        account. Sign in to save visits, export workflow packages, and
        collaborate with your team.
      </div>
    );
  }

  if (!hasWorkspace) {
    return (
      <div style={NO_WORKSPACE_BANNER} role="status" aria-label="No workspace banner">
        <strong>No workspace found.</strong> You need to create or join a
        workspace before you can save visits or export workflows.
        {onCreateWorkspace && (
          <div>
            <button
              style={ACTION_BUTTON}
              type="button"
              onClick={onCreateWorkspace}
            >
              Create or join workspace
            </button>
          </div>
        )}
      </div>
    );
  }

  return null;
}
