import { useMemo, useState, type CSSProperties } from 'react';
import type {
  AtlasWorkspaceV1,
  WorkspaceBrandPolicy,
  WorkspaceMembershipV1,
  WorkspaceSessionStatus,
  WorkspaceStoragePreference,
} from '../../auth/profile';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../../auth/profile';
import {
  canManageBranding,
  canManageWorkspace,
} from '../../auth/workspaceOnboarding';
import {
  buildWorkspaceSettingsChangeSet,
  type WorkspaceIdentityDraftV1,
  type WorkspaceSettingsDraftV1,
  LocalWorkspaceSettingsStorageAdapter,
  type WorkspaceSettingsStorageAdapterV1,
} from '../../auth/workspaceSettings';
import WorkspaceOnboardingAdminPanel, {
  type WorkspaceOnboardingDraftSnapshot,
} from '../../components/dev/WorkspaceOnboardingAdminPanel';
import WorkspaceSettingsReviewPanel from '../../components/dev/WorkspaceSettingsReviewPanel';
import { listStoredBrandProfiles } from '../branding/brandProfileStore';

export interface WorkspaceSettingsPageBrandSummary {
  readonly activeBrandId: string;
  readonly companyName: string;
  readonly resolutionSource: string;
}

export interface WorkspaceSettingsPageProps {
  readonly workspace: AtlasWorkspaceV1 | null;
  readonly actingMembership: WorkspaceMembershipV1 | null;
  readonly activeBrandSummary: WorkspaceSettingsPageBrandSummary | null;
  readonly sessionStatus: WorkspaceSessionStatus;
  readonly onBack?: () => void;
  readonly onLocalApplySuccess?: () => Promise<void> | void;
}

interface BrandPolicyDraft {
  readonly policy: WorkspaceBrandPolicy;
  readonly allowedBrandIds: readonly string[];
  readonly defaultBrandId: string;
}

const PAGE_STYLE: CSSProperties = {
  minHeight: '100vh',
  background: '#f8fafc',
  padding: '1.5rem 1rem 2rem',
  color: '#0f172a',
};

const CARD_STYLE: CSSProperties = {
  background: '#fff',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '1rem 1.1rem',
  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
};

const LABEL_STYLE: CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#475569',
  marginBottom: 4,
};

const DEMO_VIEWER_USER_ID = 'demo_viewer';

function formatEnumValue(value: string): string {
  return value.replace(/_/g, ' ');
}

function createReadOnlyMembership(workspaceId: string): WorkspaceMembershipV1 {
  return {
    workspaceId,
    userId: DEMO_VIEWER_USER_ID,
    role: 'viewer',
    permissions: DEFAULT_PERMISSIONS_BY_ROLE.viewer,
  };
}

function buildBrandPolicyDraft(
  workspace: AtlasWorkspaceV1,
  activeBrandSummary: WorkspaceSettingsPageBrandSummary | null,
): BrandPolicyDraft {
  const fallbackBrandId = activeBrandSummary?.activeBrandId ?? workspace.defaultBrandId;
  const allowedBrandIds = Array.from(
    new Set([
      ...(workspace.allowedBrandIds.length > 0
        ? workspace.allowedBrandIds
        : [workspace.defaultBrandId]),
      workspace.defaultBrandId,
      fallbackBrandId,
    ]),
  );

  return {
    policy: workspace.brandPolicy,
    allowedBrandIds,
    defaultBrandId: allowedBrandIds.includes(workspace.defaultBrandId)
      ? workspace.defaultBrandId
      : allowedBrandIds[0],
  };
}

function SessionBanner({ sessionStatus }: { sessionStatus: WorkspaceSessionStatus }) {
  if (sessionStatus === 'unauthenticated_demo') {
    return (
      <div
        role="status"
        data-testid="workspace-settings-session-banner"
        style={{
          ...CARD_STYLE,
          background: '#f8fafc',
          borderColor: '#cbd5e1',
          color: '#64748b',
          marginBottom: '1rem',
        }}
      >
        Demo/session mode - workspace settings are shown read-only until you sign in.
      </div>
    );
  }

  if (sessionStatus === 'authenticated_no_workspace') {
    return (
      <div
        role="status"
        data-testid="workspace-settings-session-banner"
        style={{
          ...CARD_STYLE,
          background: '#fffbeb',
          borderColor: '#fde68a',
          color: '#92400e',
          marginBottom: '1rem',
        }}
      >
        Create or join a workspace before editing workspace settings.
      </div>
    );
  }

  return null;
}

export default function WorkspaceSettingsPage({
  workspace,
  actingMembership,
  activeBrandSummary,
  sessionStatus,
  onBack,
  onLocalApplySuccess,
}: WorkspaceSettingsPageProps) {
  const [applyStatusMessage, setApplyStatusMessage] = useState<string | null>(null);

  const resolvedMembership = useMemo(
    () =>
      workspace === null
        ? null
        : (actingMembership ?? createReadOnlyMembership(workspace.workspaceId)),
    [actingMembership, workspace],
  );

  const canEditWorkspace = resolvedMembership !== null && canManageWorkspace(resolvedMembership);
  const canEditBrandPolicy = resolvedMembership !== null && canManageBranding(resolvedMembership);

  if (workspace === null) {
    return (
      <div data-testid="workspace-settings-page" style={PAGE_STYLE}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                data-testid="workspace-settings-back"
                style={{ border: 'none', background: 'none', color: '#334155', cursor: 'pointer' }}
              >
                ← Back
              </button>
            )}
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Workspace settings</h1>
          </div>
          <SessionBanner sessionStatus={sessionStatus} />
        </div>
      </div>
    );
  }
  return (
    <WorkspaceSettingsContent
      key={`${workspace.workspaceId}:${workspace.updatedAt}:${activeBrandSummary?.activeBrandId ?? 'none'}`}
      workspace={workspace}
      activeBrandSummary={activeBrandSummary}
      sessionStatus={sessionStatus}
      onBack={onBack}
      applyStatusMessage={applyStatusMessage}
      resolvedMembership={resolvedMembership ?? createReadOnlyMembership(workspace.workspaceId)}
      canEditWorkspace={canEditWorkspace}
      canEditBrandPolicy={canEditBrandPolicy}
      onLocalApplySuccess={async () => {
        await onLocalApplySuccess?.();
        setApplyStatusMessage('Local workspace settings applied');
      }}
    />
  );
}

function WorkspaceSettingsContent({
  workspace,
  resolvedMembership,
  activeBrandSummary,
  sessionStatus,
  onBack,
  applyStatusMessage,
  canEditWorkspace,
  canEditBrandPolicy,
  onLocalApplySuccess,
}: {
  workspace: AtlasWorkspaceV1;
  resolvedMembership: WorkspaceMembershipV1;
  activeBrandSummary: WorkspaceSettingsPageBrandSummary | null;
  sessionStatus: WorkspaceSessionStatus;
  onBack?: () => void;
  applyStatusMessage: string | null;
  canEditWorkspace: boolean;
  canEditBrandPolicy: boolean;
  onLocalApplySuccess: () => Promise<void>;
}) {
  const [storageDraft, setStorageDraft] = useState<WorkspaceStoragePreference>(
    workspace.storagePreference,
  );
  const [workspaceIdentityDraft, setWorkspaceIdentityDraft] = useState<WorkspaceIdentityDraftV1>({
    name: workspace.name,
    slug: workspace.slug,
  });
  const [brandPolicyDraft, setBrandPolicyDraft] = useState<BrandPolicyDraft>(() =>
    buildBrandPolicyDraft(workspace, activeBrandSummary),
  );
  const [onboardingDraft, setOnboardingDraft] = useState<WorkspaceOnboardingDraftSnapshot>({
    memberPermissionEdits: [],
    inviteDrafts: [],
    joinRequestDecisions: [],
    pendingJoinRequests: [],
  });

  const brandRegistry = useMemo(() => listStoredBrandProfiles(), []);

  const brandOptions = useMemo(() => {
    const ids = new Set<string>(Object.keys(brandRegistry));
    ids.add(workspace.defaultBrandId);
    workspace.allowedBrandIds.forEach((brandId) => ids.add(brandId));
    if (activeBrandSummary !== null) {
      ids.add(activeBrandSummary.activeBrandId);
    }
    return Array.from(ids).sort((a, b) => a.localeCompare(b));
  }, [activeBrandSummary, brandRegistry, workspace.allowedBrandIds, workspace.defaultBrandId]);

  function handlePolicyChange(policy: WorkspaceBrandPolicy) {
    if (!canEditBrandPolicy) return;
    setBrandPolicyDraft({ ...brandPolicyDraft, policy });
  }

  function handleAllowedBrandToggle(brandId: string) {
    if (!canEditBrandPolicy) return;

    const isEnabled = brandPolicyDraft.allowedBrandIds.includes(brandId);
    // Keep at least one allowed brand available so the default-brand selector stays valid.
    if (isEnabled && brandPolicyDraft.allowedBrandIds.length === 1) return;

    const allowedBrandIds = isEnabled
      ? brandPolicyDraft.allowedBrandIds.filter((candidate) => candidate !== brandId)
      : [...brandPolicyDraft.allowedBrandIds, brandId];
    const defaultBrandId = allowedBrandIds.includes(brandPolicyDraft.defaultBrandId)
      ? brandPolicyDraft.defaultBrandId
      : allowedBrandIds[0];

    setBrandPolicyDraft({
      ...brandPolicyDraft,
      allowedBrandIds,
      defaultBrandId,
    });
  }

  function handleDefaultBrandChange(defaultBrandId: string) {
    if (!canEditBrandPolicy) return;
    setBrandPolicyDraft({ ...brandPolicyDraft, defaultBrandId });
  }

  const activeBrandCompanyName =
    activeBrandSummary?.companyName ??
    brandRegistry[workspace.defaultBrandId]?.companyName ??
    workspace.defaultBrandId;

  const workspaceSettingsDraft = useMemo<WorkspaceSettingsDraftV1>(
    () => ({
      workspaceId: workspace.workspaceId,
      workspace: workspaceIdentityDraft,
      brand: brandPolicyDraft,
      storagePreference: storageDraft,
      memberPermissionEdits: onboardingDraft.memberPermissionEdits,
      inviteDrafts: onboardingDraft.inviteDrafts,
      joinRequestDecisions: onboardingDraft.joinRequestDecisions,
    }),
    [brandPolicyDraft, onboardingDraft, storageDraft, workspace.workspaceId, workspaceIdentityDraft],
  );

  const workspaceSettingsChangeSet = useMemo(
    () =>
      buildWorkspaceSettingsChangeSet(workspaceSettingsDraft, {
        workspace,
        joinRequests: onboardingDraft.pendingJoinRequests,
        googleDriveConnectorAvailable: false,
      }),
    [onboardingDraft.pendingJoinRequests, workspace, workspaceSettingsDraft],
  );

  const workspaceSettingsStorageAdapter = useMemo<WorkspaceSettingsStorageAdapterV1>(() => {
    return new LocalWorkspaceSettingsStorageAdapter();
  }, []);

  return (
    <div data-testid="workspace-settings-page" style={PAGE_STYLE}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              data-testid="workspace-settings-back"
              style={{ border: 'none', background: 'none', color: '#334155', cursor: 'pointer' }}
            >
              ← Back
            </button>
          )}
          <div>
            <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Workspace settings</h1>
            <p style={{ margin: '0.2rem 0 0', fontSize: 13, color: '#64748b' }}>
              Onboarding and policy controls are draft-only. Changes are not persisted yet.
            </p>
          </div>
        </div>

        <SessionBanner sessionStatus={sessionStatus} />
        {applyStatusMessage !== null && (
          <div
            role="status"
            data-testid="workspace-settings-apply-banner"
            style={{
              ...CARD_STYLE,
              background: '#f0fdf4',
              borderColor: '#bbf7d0',
              color: '#166534',
              marginBottom: '1rem',
            }}
          >
            {applyStatusMessage}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <section data-testid="workspace-settings-workspace-summary" style={CARD_STYLE}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: 16 }}>Active workspace</h2>
            <dl style={{ margin: 0, display: 'grid', gap: '0.55rem' }}>
              <div>
                <dt style={LABEL_STYLE}>Name</dt>
                <dd style={{ margin: 0 }}>
                  <div
                    data-testid="workspace-settings-active-workspace-name"
                    style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}
                  >
                    {workspace.name}
                  </div>
                  <input
                    type="text"
                    value={workspaceIdentityDraft.name}
                    disabled={!canEditWorkspace}
                    onChange={(event) =>
                      setWorkspaceIdentityDraft((prev) => ({ ...prev, name: event.target.value }))
                    }
                    data-testid="workspace-settings-name-input"
                    style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff' }}
                  />
                </dd>
              </div>
              <div>
                <dt style={LABEL_STYLE}>Slug</dt>
                <dd style={{ margin: 0 }}>
                  <div
                    data-testid="workspace-settings-active-workspace-slug"
                    style={{ fontSize: 12, color: '#64748b', marginBottom: 4, fontFamily: 'monospace' }}
                  >
                    {workspace.slug}
                  </div>
                  <input
                    type="text"
                    value={workspaceIdentityDraft.slug}
                    disabled={!canEditWorkspace}
                    onChange={(event) =>
                      setWorkspaceIdentityDraft((prev) => ({ ...prev, slug: event.target.value }))
                    }
                    data-testid="workspace-settings-slug-input"
                    style={{ width: '100%', padding: '0.45rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', fontFamily: 'monospace' }}
                  />
                </dd>
              </div>
              <div>
                <dt style={LABEL_STYLE}>Members</dt>
                <dd style={{ margin: 0 }}>{workspace.members.length}</dd>
              </div>
            </dl>
          </section>

          <section data-testid="workspace-settings-brand-summary" style={CARD_STYLE}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: 16 }}>Active brand</h2>
            <dl style={{ margin: 0, display: 'grid', gap: '0.55rem' }}>
              <div>
                <dt style={LABEL_STYLE}>Company</dt>
                <dd data-testid="workspace-settings-active-brand-name" style={{ margin: 0 }}>{activeBrandCompanyName}</dd>
              </div>
              <div>
                <dt style={LABEL_STYLE}>Brand ID</dt>
                <dd data-testid="workspace-settings-active-brand-id" style={{ margin: 0, fontFamily: 'monospace' }}>
                  {activeBrandSummary?.activeBrandId ?? workspace.defaultBrandId}
                </dd>
              </div>
              <div>
                <dt style={LABEL_STYLE}>Resolution source</dt>
                <dd data-testid="workspace-settings-active-brand-source" style={{ margin: 0 }}>
                  {formatEnumValue(activeBrandSummary?.resolutionSource ?? 'workspace_default')}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <section data-testid="workspace-settings-storage-card" style={CARD_STYLE}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: 16 }}>Storage preference</h2>
            <label htmlFor="workspace-settings-storage-select" style={LABEL_STYLE}>
              Workspace storage mode
            </label>
            <select
              id="workspace-settings-storage-select"
              data-testid="workspace-settings-storage-select"
              value={storageDraft}
              disabled={!canEditWorkspace}
              onChange={(event) => setStorageDraft(event.target.value as WorkspaceStoragePreference)}
              style={{ width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff' }}
            >
              <option value="disabled">Disabled</option>
              <option value="local_only">Local only</option>
              <option value="google_drive">Google Drive workspace placeholder</option>
            </select>
            <p data-testid="workspace-settings-storage-helper" style={{ margin: '0.65rem 0 0', fontSize: 12, color: '#64748b' }}>
              {canEditWorkspace
                ? 'Draft only — storage changes are not persisted yet.'
                : 'Read-only — owner, admin, or manage workspace permission required.'}
            </p>
          </section>

          <section data-testid="workspace-settings-brand-policy-card" style={CARD_STYLE}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: 16 }}>Brand policy</h2>
            <div
              data-testid="workspace-settings-brand-policy-summary"
              style={{ marginBottom: '0.85rem', padding: '0.7rem', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}
            >
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
                Policy: <strong>{formatEnumValue(brandPolicyDraft.policy)}</strong>
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
                Default brand: <strong>{brandPolicyDraft.defaultBrandId}</strong>
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>
                Allowed brands: {brandPolicyDraft.allowedBrandIds.join(', ')}
              </div>
            </div>

            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend style={{ ...LABEL_STYLE, marginBottom: 8 }}>Selection mode</legend>
              {(['locked', 'workspace_default', 'user_selectable'] as const).map((policy) => (
                <label key={policy} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 8 }}>
                  <input
                    type="radio"
                    name="workspace-brand-policy"
                    value={policy}
                    checked={brandPolicyDraft.policy === policy}
                    onChange={() => handlePolicyChange(policy)}
                    disabled={!canEditBrandPolicy}
                    data-testid={`workspace-settings-brand-policy-${policy}`}
                  />
                  {formatEnumValue(policy)}
                </label>
              ))}
            </fieldset>

            <div style={{ marginTop: '0.9rem' }}>
              <label htmlFor="workspace-settings-default-brand-select" style={LABEL_STYLE}>
                Default brand
              </label>
              <select
                id="workspace-settings-default-brand-select"
                data-testid="workspace-settings-default-brand-select"
                value={brandPolicyDraft.defaultBrandId}
                disabled={!canEditBrandPolicy}
                onChange={(event) => handleDefaultBrandChange(event.target.value)}
                style={{ width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff' }}
              >
                {brandPolicyDraft.allowedBrandIds.map((brandId) => (
                  <option key={brandId} value={brandId}>
                    {brandRegistry[brandId]?.companyName ?? brandId}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginTop: '0.9rem' }}>
              <span style={LABEL_STYLE}>Allowed brands</span>
              <div style={{ display: 'grid', gap: 8 }}>
                {brandOptions.map((brandId) => (
                  <label key={brandId} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={brandPolicyDraft.allowedBrandIds.includes(brandId)}
                      disabled={!canEditBrandPolicy}
                      onChange={() => handleAllowedBrandToggle(brandId)}
                      data-testid={`workspace-settings-allowed-brand-${brandId}`}
                    />
                    <span>{brandRegistry[brandId]?.companyName ?? brandId}</span>
                    <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>{brandId}</span>
                  </label>
                ))}
              </div>
            </div>

            <p style={{ margin: '0.85rem 0 0', fontSize: 12, color: '#64748b' }}>
              {canEditBrandPolicy
                ? 'Draft only — brand policy edits stay local to this session.'
                : 'Read-only — owner, admin, or manage workspace permission required.'}
            </p>
          </section>
        </div>

        <WorkspaceOnboardingAdminPanel
          actingMembership={resolvedMembership}
          workspace={workspace}
          onDraftStateChange={setOnboardingDraft}
        />
        <div style={{ marginTop: '1rem' }}>
          <WorkspaceSettingsReviewPanel
            changeSet={workspaceSettingsChangeSet}
            storageAdapter={workspaceSettingsStorageAdapter}
            draft={workspaceSettingsDraft}
            currentWorkspace={workspace}
            currentJoinRequests={onboardingDraft.pendingJoinRequests}
            onLocalApplySuccess={async () => {
              await onLocalApplySuccess();
            }}
          />
        </div>
      </div>
    </div>
  );
}
