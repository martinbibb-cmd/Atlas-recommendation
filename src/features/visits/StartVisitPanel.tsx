/**
 * src/features/visits/StartVisitPanel.tsx
 *
 * Minimal start-visit UI for Atlas Mind.
 *
 * Allows the engineer to select a workspace (tenant) before creating a new
 * visit.  The selected workspace determines the brandId for the visit.
 * On confirmation the panel calls the supplied `onStart` callback with the
 * newly-created AtlasVisit so the caller can push it into context.
 *
 * Design rules
 * ────────────
 * - Calls createVisit() from lib/visits/visitApi.ts to issue the POST.
 * - Calls createAtlasVisit() to assemble the AtlasVisit with the brandId.
 * - No direct sessionStorage writes here — caller owns persistence via
 *   VisitProvider / visitStore.
 * - Workspace selection drives brandId via resolveActiveTenant().
 */

import { useContext, useState } from 'react';
import { createVisit } from '../../lib/visits/visitApi';
import { createAtlasVisit } from './createAtlasVisit';
import type { AtlasVisit } from './createAtlasVisit';
import { WorkspaceSelector } from '../tenants/WorkspaceSelector';
import { resolveActiveTenant } from '../tenants/activeTenant';
import { trackVisitCreated } from '../analytics/analyticsTracker';
import { useActiveUser } from '../userProfiles/useActiveUser';
import { AtlasAuthContext } from '../../auth/AtlasAuthContext';
import { useWorkspaceSession, useOptionalWorkspaceBrandSession } from '../../auth/profile';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StartVisitPanelProps {
  /**
   * Called after a visit is successfully created.
   * Receives the constructed AtlasVisit (visitId + brandId + createdAt).
   */
  onStart: (visit: AtlasVisit) => void;
  /**
   * Called when the engineer cancels without creating a visit.
   */
  onCancel?: () => void;
  /**
   * Pre-select this workspace slug in the workspace selector on first render.
   * Supplied by the host-workspace resolver when the app is accessed via a
   * branded subdomain (e.g. britishgas.atlas-phm.uk).  The engineer can still
   * change the workspace manually.
   */
  defaultWorkspaceSlug?: string;
  /**
   * Optional callback invoked when the engineer clicks "Create workspace".
   * When provided a small "Create workspace" link is shown below the selector.
   */
  onCreateWorkspace?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * StartVisitPanel
 *
 * Renders a minimal form with:
 *   - Optional visit reference input.
 *   - Workspace selector (determines the brandId for the visit).
 *   - Start / Cancel actions.
 *
 * On submit: POSTs to /api/visits, constructs an AtlasVisit with the
 * brandId derived from the selected workspace, and calls onStart.
 */
export function StartVisitPanel({ onStart, onCancel, defaultWorkspaceSlug, onCreateWorkspace }: StartVisitPanelProps) {
  const { activeUser } = useActiveUser();
  const authContext = useContext(AtlasAuthContext);
  const userProfile = authContext?.userProfile ?? null;
  const currentWorkspace = authContext?.currentWorkspace ?? null;
  const workspaceSession = useWorkspaceSession();
  const workspaceBrandSession = useOptionalWorkspaceBrandSession();

  // Workspace default priority: explicit prop (host workspace) > active user default > 'atlas'
  const resolvedDefaultSlug = defaultWorkspaceSlug ?? activeUser?.defaultWorkspaceSlug ?? 'atlas';

  const [reference, setReference] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState(resolvedDefaultSlug);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Resolve the brandId for the new visit.
   * Priority: workspace brand session (resolved from policy/preference/route)
   *           → legacy tenant resolver (from workspace slug selector)
   */
  function resolveVisitBrandId(): string {
    if (workspaceBrandSession !== null) {
      return workspaceBrandSession.activeBrandId;
    }
    return resolveActiveTenant({ workspaceSlug }).brandId;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    if (workspaceSession.status === 'authenticated_no_workspace') return;
    setCreating(true);
    setError(null);
    try {
      const opts = {
        ...(reference.trim().length > 0 ? { visit_reference: reference.trim() } : {}),
        ...(workspaceSession.status === 'workspace_active' && currentWorkspace?.workspaceId !== undefined
          ? { workspace_id: currentWorkspace.workspaceId }
          : {}),
        ...(workspaceSession.status === 'workspace_active' && userProfile?.atlasUserId !== undefined
          ? { atlas_user_id: userProfile.atlasUserId }
          : {}),
      };
      const { id } = await createVisit(opts);
      const tenant = resolveActiveTenant({ workspaceSlug });
      const visit = createAtlasVisit(id, resolveVisitBrandId(), activeUser?.userId, {
        atlasUserId: workspaceSession.status === 'workspace_active' ? userProfile?.atlasUserId : undefined,
        workspaceId: workspaceSession.status === 'workspace_active' ? currentWorkspace?.workspaceId : undefined,
        storageTarget: workspaceSession.storageTarget,
      });
      trackVisitCreated(visit, tenant.tenantId);
      onStart(visit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create visit');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 480 }}>
      <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>
        Start New Visit
      </h2>
      <form onSubmit={handleSubmit}>
        {/* Visit reference */}
        <div style={{ marginBottom: '1rem' }}>
          <label
            htmlFor="start-visit-reference"
            style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}
          >
            Visit reference <span style={{ fontWeight: 400, color: '#64748b' }}>(optional)</span>
          </label>
          <input
            id="start-visit-reference"
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="e.g. JOB-2024-001"
            disabled={creating}
            style={{
              width: '100%',
              padding: '0.5rem 0.75rem',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontSize: '1rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Workspace selector */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            htmlFor="start-visit-workspace"
            style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}
          >
            Workspace
          </label>
          <p
            style={{ margin: '0 0 0.375rem', fontSize: '0.8125rem', color: '#64748b' }}
          >
            Brand used for customer outputs
          </p>
          <WorkspaceSelector
            value={workspaceSlug}
            onChange={setWorkspaceSlug}
            disabled={creating}
          />
          {onCreateWorkspace !== undefined && (
            <button
              type="button"
              data-testid="start-visit-create-workspace-link"
              onClick={onCreateWorkspace}
              style={{
                marginTop: '0.375rem',
                background: 'none',
                border: 'none',
                padding: 0,
                color: '#2563eb',
                fontSize: '0.8125rem',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              + Create workspace
            </button>
          )}
        </div>

        {/* Workspace brand session — resolved brand and source */}
        {workspaceBrandSession !== null && (
          <div
            data-testid="start-visit-brand-session"
            style={{
              marginBottom: '1.25rem',
              padding: '0.5rem 0.75rem',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: 6,
              fontSize: '0.8125rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.125rem',
            }}
          >
            {workspaceBrandSession.activeWorkspace !== null && (
              <span style={{ color: '#166534' }}>
                <strong>Workspace:</strong> {workspaceBrandSession.activeWorkspace.name}
              </span>
            )}
            <span style={{ color: '#166534' }}>
              <strong>Brand:</strong> {workspaceBrandSession.activeBrandProfile.companyName}
            </span>
            <span style={{ color: '#64748b' }}>
              <strong>Resolution:</strong> {workspaceBrandSession.resolutionSource.replace(/_/g, ' ')}
            </span>
          </div>
        )}

        {/* Inline error */}
        {workspaceSession.status === 'authenticated_no_workspace' && (
          <p
            role="status"
            style={{ color: '#92400e', marginBottom: '1rem', fontSize: '0.875rem' }}
          >
            Create or join workspace before creating customer visits.
          </p>
        )}
        {error !== null && (
          <p
            role="alert"
            style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.875rem' }}
          >
            {error}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="submit"
            disabled={creating || workspaceSession.status === 'authenticated_no_workspace'}
            style={{
              flex: 1,
              padding: '0.625rem 1.25rem',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: '1rem',
              cursor: creating || workspaceSession.status === 'authenticated_no_workspace' ? 'not-allowed' : 'pointer',
              opacity: creating || workspaceSession.status === 'authenticated_no_workspace' ? 0.6 : 1,
            }}
          >
            {creating ? 'Starting…' : 'Start Visit'}
          </button>
          {onCancel !== undefined && (
            <button
              type="button"
              onClick={onCancel}
              disabled={creating}
              style={{
                padding: '0.625rem 1.25rem',
                background: 'transparent',
                color: '#64748b',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                fontSize: '1rem',
                cursor: creating ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
