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
import { useWorkspaceSession } from './WorkspaceSessionProvider';

// ─── Props ────────────────────────────────────────────────────────────────────

interface WorkspaceSessionGuardProps {
  /** Show workspace details banner for active workspace sessions. */
  readonly showWorkspaceActiveState?: boolean;
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

const ACTIVE_WORKSPACE_BANNER: React.CSSProperties = {
  ...BANNER_BASE,
  background: '#eff6ff',
  border: '1px solid #bfdbfe',
  color: '#1e3a8a',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function WorkspaceSessionGuard({
  showWorkspaceActiveState = false,
}: WorkspaceSessionGuardProps): React.ReactElement | null {
  const session = useWorkspaceSession();
  if (session.status === 'unauthenticated_demo') {
    return (
      <div style={UNAUTHENTICATED_BANNER} role="status" aria-label="Demo mode banner">
        Demo/session mode — visits are not linked to an account.
      </div>
    );
  }

  if (session.status === 'authenticated_no_workspace') {
    return (
      <div style={NO_WORKSPACE_BANNER} role="status" aria-label="No workspace banner">
        Create or join workspace before creating customer visits.
      </div>
    );
  }

  if (showWorkspaceActiveState && session.activeWorkspace !== null) {
    return (
      <div style={ACTIVE_WORKSPACE_BANNER} role="status" aria-label="Workspace active banner">
        Workspace active: <strong>{session.activeWorkspace.name}</strong> · storage preference:{' '}
        <strong>{session.storageTarget}</strong>
      </div>
    );
  }

  return null;
}
