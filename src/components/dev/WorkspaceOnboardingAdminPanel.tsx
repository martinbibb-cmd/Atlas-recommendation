/**
 * WorkspaceOnboardingAdminPanel.tsx
 *
 * Developer-only admin panel for workspace member onboarding and approval.
 *
 * Sections:
 *   1. Pending join requests — approve / reject with optional notes.
 *   2. Invite new user — email, role, customisable permission checkboxes.
 *   3. Member list — role and permission summary for each current member.
 *
 * NOT customer-facing.  Only accessible via the Dev Menu.
 *
 * Design rules:
 *   - All state is in-component (no persistence).
 *   - Guard helpers enforce owner/admin-only actions; non-admin callers
 *     see a read-only view.
 *   - No email sending, no real backend.
 */

import { useState } from 'react';
import type { WorkspaceJoinRequestV1 } from '../../auth/workspaceOnboarding/WorkspaceJoinRequestV1';
import type { WorkspaceInviteV1 } from '../../auth/workspaceOnboarding/WorkspaceInviteV1';
import type { WorkspaceMemberPermissionDraftV1 } from '../../auth/workspaceOnboarding/WorkspaceMemberPermissionDraftV1';
import {
  applyRolePresetToDraft,
  togglePermissionInDraft,
  extractPermissionsFromDraft,
} from '../../auth/workspaceOnboarding/WorkspaceMemberPermissionDraftV1';
import {
  canInviteWorkspaceUser,
  canApproveWorkspaceUser,
  canEditMemberPermissions,
} from '../../auth/workspaceOnboarding/workspaceOnboardingGuards';
import type {
  WorkspaceMemberRole,
  WorkspaceMemberPermission,
  WorkspaceMembershipV1,
} from '../../auth/profile/WorkspaceMembershipV1';
import { DEFAULT_PERMISSIONS_BY_ROLE } from '../../auth/profile/WorkspaceMembershipV1';
import type { AtlasWorkspaceV1 } from '../../auth/profile/AtlasWorkspaceV1';

// ─── Constants ────────────────────────────────────────────────────────────────

const MS_PER_HOUR = 3_600_000;
const INVITE_EXPIRY_DAYS = 7;
const INVITE_EXPIRY_MS = INVITE_EXPIRY_DAYS * 24 * MS_PER_HOUR;

const ALL_ROLES: readonly WorkspaceMemberRole[] = [
  'owner',
  'admin',
  'surveyor',
  'engineer',
  'office',
  'viewer',
];

const ALL_PERMISSIONS: readonly WorkspaceMemberPermission[] = [
  'view_visits',
  'edit_visits',
  'export_workflows',
  'review_specification',
  'manage_workspace',
  'use_scan_handoff',
];

const PERMISSION_LABELS: Readonly<Record<WorkspaceMemberPermission, string>> = {
  view_visits: 'View visits',
  edit_visits: 'Edit visits',
  export_workflows: 'Export workflows',
  review_specification: 'Review specification',
  manage_workspace: 'Manage workspace',
  use_scan_handoff: 'Use scan handoff',
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const CARD_STYLE: React.CSSProperties = {
  border: '1px solid #e2e8f0',
  borderRadius: '0.75rem',
  padding: '0.75rem',
  background: '#fff',
  marginBottom: '0.75rem',
};

const SECTION_HEADING: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '0.85rem',
  fontWeight: 700,
  color: '#334155',
};

const MUTED: React.CSSProperties = { fontSize: 12, color: '#64748b' };

const BTN_BASE: React.CSSProperties = {
  fontSize: 12,
  padding: '0.25rem 0.6rem',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  cursor: 'pointer',
};

const BTN_PRIMARY: React.CSSProperties = {
  ...BTN_BASE,
  background: '#1e3a8a',
  color: '#fff',
  borderColor: '#1e3a8a',
};

const BTN_DANGER: React.CSSProperties = {
  ...BTN_BASE,
  background: '#fef2f2',
  color: '#991b1b',
  borderColor: '#fecaca',
};

function chip(active: boolean): React.CSSProperties {
  return {
    borderRadius: 999,
    padding: '0.15rem 0.5rem',
    fontSize: 11,
    fontWeight: 600,
    border: '1.5px solid',
    display: 'inline-block',
    background: active ? '#1e3a8a' : '#f8fafc',
    color: active ? '#fff' : '#334155',
    borderColor: active ? '#1e3a8a' : '#cbd5e1',
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /**
   * The acting user's membership — used for guard checks.
   * Omit (or pass a viewer-role membership) to render the read-only view.
   */
  actingMembership: WorkspaceMembershipV1;

  /** Workspace metadata (used for display and as context for guard helpers). */
  workspace: AtlasWorkspaceV1;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_REQUESTS: WorkspaceJoinRequestV1[] = [
  {
    requestId: 'req_001',
    workspaceId: 'ws_001',
    email: 'bob@example.com',
    userId: 'atlas_uid_bob',
    requestedRole: 'engineer',
    requestedAt: new Date(Date.now() - 3_600_000).toISOString(),
    status: 'pending',
  },
  {
    requestId: 'req_002',
    workspaceId: 'ws_001',
    email: 'carol@example.com',
    requestedAt: new Date(Date.now() - 7_200_000).toISOString(),
    status: 'pending',
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PermissionCheckboxGrid({
  draft,
  onToggle,
  disabled,
}: {
  draft: WorkspaceMemberPermissionDraftV1;
  onToggle: (p: WorkspaceMemberPermission) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem 0.8rem', marginTop: '0.3rem' }}>
      {ALL_PERMISSIONS.map((p) => (
        <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: disabled ? 'not-allowed' : 'pointer' }}>
          <input
            type="checkbox"
            checked={draft.permissionCheckboxes[p]}
            disabled={disabled}
            onChange={() => onToggle(p)}
            data-testid={`permission-checkbox-${p}`}
          />
          {PERMISSION_LABELS[p]}
        </label>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WorkspaceOnboardingAdminPanel({ actingMembership, workspace }: Props) {
  // ── Join requests ────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<WorkspaceJoinRequestV1[]>(SEED_REQUESTS);
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});

  const canApprove = canApproveWorkspaceUser(actingMembership);

  function handleApprove(requestId: string) {
    setRequests((prev) =>
      prev.map((r) =>
        r.requestId === requestId
          ? { ...r, status: 'approved', reviewedAt: new Date().toISOString(), notes: requestNotes[requestId] }
          : r,
      ),
    );
  }

  function handleReject(requestId: string) {
    setRequests((prev) =>
      prev.map((r) =>
        r.requestId === requestId
          ? { ...r, status: 'rejected', reviewedAt: new Date().toISOString(), notes: requestNotes[requestId] }
          : r,
      ),
    );
  }

  // ── Invite new user ──────────────────────────────────────────────────────────
  const canInvite = canInviteWorkspaceUser(actingMembership);

  const [invites, setInvites] = useState<WorkspaceInviteV1[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceMemberRole>('viewer');
  const [inviteDraft, setInviteDraft] = useState<WorkspaceMemberPermissionDraftV1>(() =>
    applyRolePresetToDraft('__invite__', workspace.workspaceId, 'viewer'),
  );

  function handleInviteRoleChange(role: WorkspaceMemberRole) {
    setInviteRole(role);
    setInviteDraft(applyRolePresetToDraft('__invite__', workspace.workspaceId, role));
  }

  function handleInvitePermToggle(p: WorkspaceMemberPermission) {
    setInviteDraft((d) => togglePermissionInDraft(d, p));
  }

  function handleSendInvite() {
    if (!inviteEmail.trim()) return;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_EXPIRY_MS).toISOString();
    const invite: WorkspaceInviteV1 = {
      inviteId: `inv_${Date.now()}`,
      workspaceId: workspace.workspaceId,
      email: inviteEmail.trim(),
      role: inviteRole,
      permissions: extractPermissionsFromDraft(inviteDraft),
      invitedByUserId: actingMembership.userId,
      invitedAt: now.toISOString(),
      expiresAt,
      status: 'pending',
    };
    setInvites((prev) => [...prev, invite]);
    setInviteEmail('');
    setInviteRole('viewer');
    setInviteDraft(applyRolePresetToDraft('__invite__', workspace.workspaceId, 'viewer'));
  }

  function handleRevokeInvite(inviteId: string) {
    setInvites((prev) =>
      prev.map((inv) => (inv.inviteId === inviteId ? { ...inv, status: 'revoked' } : inv)),
    );
  }

  // ── Member list ──────────────────────────────────────────────────────────────
  const canEditPerms = canEditMemberPermissions(actingMembership);

  const [memberDrafts, setMemberDrafts] = useState<Record<string, WorkspaceMemberPermissionDraftV1>>({});

  function getMemberDraft(member: WorkspaceMembershipV1): WorkspaceMemberPermissionDraftV1 {
    return (
      memberDrafts[member.userId] ??
      applyRolePresetToDraft(member.userId, workspace.workspaceId, member.role)
    );
  }

  function handleMemberRoleChange(userId: string, role: WorkspaceMemberRole) {
    setMemberDrafts((prev) => ({
      ...prev,
      [userId]: applyRolePresetToDraft(userId, workspace.workspaceId, role),
    }));
  }

  function handleMemberPermToggle(userId: string, p: WorkspaceMemberPermission) {
    setMemberDrafts((prev) => {
      const existingRole = workspace.members.find((m) => m.userId === userId)?.role ?? 'viewer';
      const current = prev[userId] ?? applyRolePresetToDraft(userId, workspace.workspaceId, existingRole);
      return { ...prev, [userId]: togglePermissionInDraft(current, p) };
    });
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const pendingRequests = requests.filter((r) => r.status === 'pending');
  const reviewedRequests = requests.filter((r) => r.status !== 'pending');

  return (
    <section data-testid="workspace-onboarding-admin-panel">
      <h2 style={{ ...SECTION_HEADING, fontSize: '1rem', marginBottom: '0.75rem' }}>
        Workspace Onboarding — {workspace.name}
      </h2>

      {/* ── 1. Pending join requests ──────────────────────────────────────────── */}
      <div style={CARD_STYLE} data-testid="onboarding-join-requests">
        <h3 style={SECTION_HEADING}>Pending join requests ({pendingRequests.length})</h3>

        {!canApprove && (
          <p style={{ ...MUTED, fontStyle: 'italic' }}>You do not have permission to review join requests.</p>
        )}

        {pendingRequests.length === 0 && (
          <p style={MUTED}>No pending requests.</p>
        )}

        {pendingRequests.map((req) => (
          <div
            key={req.requestId}
            style={{ border: '1px solid #f1f5f9', borderRadius: 6, padding: '0.5rem', marginBottom: '0.4rem' }}
            data-testid={`join-request-${req.requestId}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 13 }}>{req.email}</strong>
              {req.requestedRole && <span style={chip(false)}>{req.requestedRole}</span>}
              <span style={{ ...MUTED, marginLeft: 'auto' }}>
                {new Date(req.requestedAt).toLocaleString()}
              </span>
            </div>
            {req.userId && (
              <p style={{ ...MUTED, margin: '0.2rem 0 0' }}>User ID: {req.userId}</p>
            )}
            {canApprove && (
              <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={requestNotes[req.requestId] ?? ''}
                  onChange={(e) =>
                    setRequestNotes((prev) => ({ ...prev, [req.requestId]: e.target.value }))
                  }
                  style={{
                    fontSize: 12,
                    padding: '0.2rem 0.4rem',
                    borderRadius: 5,
                    border: '1px solid #cbd5e1',
                    flex: '1 1 140px',
                  }}
                  data-testid={`join-request-notes-${req.requestId}`}
                />
                <button
                  type="button"
                  style={BTN_PRIMARY}
                  onClick={() => handleApprove(req.requestId)}
                  data-testid={`approve-request-${req.requestId}`}
                >
                  Approve
                </button>
                <button
                  type="button"
                  style={BTN_DANGER}
                  onClick={() => handleReject(req.requestId)}
                  data-testid={`reject-request-${req.requestId}`}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}

        {reviewedRequests.length > 0 && (
          <details style={{ marginTop: '0.4rem' }}>
            <summary style={{ ...MUTED, cursor: 'pointer' }}>Reviewed requests ({reviewedRequests.length})</summary>
            {reviewedRequests.map((req) => (
              <div
                key={req.requestId}
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.2rem 0', fontSize: 12 }}
              >
                <span>{req.email}</span>
                <span style={chip(req.status === 'approved')}>{req.status}</span>
                {req.notes && <span style={MUTED}>— {req.notes}</span>}
              </div>
            ))}
          </details>
        )}
      </div>

      {/* ── 2. Invite new user ────────────────────────────────────────────────── */}
      <div style={CARD_STYLE} data-testid="onboarding-invite-section">
        <h3 style={SECTION_HEADING}>Invite new user</h3>

        {!canInvite ? (
          <p style={{ ...MUTED, fontStyle: 'italic' }}>You do not have permission to invite users.</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: '1 1 200px' }}>
                <label style={{ fontSize: 11, color: '#64748b' }}>Email</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  style={{
                    fontSize: 12,
                    padding: '0.25rem 0.4rem',
                    borderRadius: 5,
                    border: '1px solid #cbd5e1',
                  }}
                  data-testid="invite-email-input"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <label style={{ fontSize: 11, color: '#64748b' }}>Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => handleInviteRoleChange(e.target.value as WorkspaceMemberRole)}
                  style={{
                    fontSize: 12,
                    padding: '0.25rem 0.4rem',
                    borderRadius: 5,
                    border: '1px solid #cbd5e1',
                    background: '#fff',
                  }}
                  data-testid="invite-role-select"
                >
                  {ALL_ROLES.filter((r) => r !== 'owner').map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                style={BTN_PRIMARY}
                onClick={handleSendInvite}
                disabled={!inviteEmail.trim()}
                data-testid="send-invite-btn"
              >
                Send invite
              </button>
            </div>

            <p style={{ margin: '0 0 0.2rem', fontSize: 11, color: '#64748b' }}>Permissions (pre-filled from role — customisable):</p>
            <PermissionCheckboxGrid draft={inviteDraft} onToggle={handleInvitePermToggle} disabled={false} />
          </>
        )}

        {invites.length > 0 && (
          <div style={{ marginTop: '0.6rem' }} data-testid="invite-list">
            <p style={{ ...MUTED, margin: '0 0 0.3rem', fontWeight: 600 }}>Sent invites:</p>
            {invites.map((inv) => (
              <div
                key={inv.inviteId}
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.2rem 0', fontSize: 12 }}
                data-testid={`invite-row-${inv.inviteId}`}
              >
                <span>{inv.email}</span>
                <span style={chip(false)}>{inv.role}</span>
                <span style={chip(inv.status === 'pending')}>{inv.status}</span>
                {inv.status === 'pending' && canInvite && (
                  <button
                    type="button"
                    style={BTN_DANGER}
                    onClick={() => handleRevokeInvite(inv.inviteId)}
                    data-testid={`revoke-invite-${inv.inviteId}`}
                  >
                    Revoke
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 3. Member list ────────────────────────────────────────────────────── */}
      <div style={CARD_STYLE} data-testid="onboarding-member-list">
        <h3 style={SECTION_HEADING}>Members ({workspace.members.length})</h3>

        {workspace.members.map((member) => {
          const draft = getMemberDraft(member);
          const isOwner = member.role === 'owner';
          const editDisabled = !canEditPerms || isOwner;

          return (
            <div
              key={member.userId}
              style={{ border: '1px solid #f1f5f9', borderRadius: 6, padding: '0.5rem', marginBottom: '0.4rem' }}
              data-testid={`member-row-${member.userId}`}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 13 }}>{member.userId}</strong>

                {editDisabled ? (
                  <span style={chip(true)}>{member.role}</span>
                ) : (
                  <select
                    value={draft.role}
                    onChange={(e) => handleMemberRoleChange(member.userId, e.target.value as WorkspaceMemberRole)}
                    style={{
                      fontSize: 12,
                      padding: '0.15rem 0.3rem',
                      borderRadius: 5,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                    }}
                    data-testid={`member-role-select-${member.userId}`}
                  >
                    {ALL_ROLES.filter((r) => r !== 'owner').map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                )}

                {isOwner && <span style={{ ...MUTED, fontStyle: 'italic' }}>owner — cannot be edited</span>}
              </div>

              <PermissionCheckboxGrid
                draft={
                  editDisabled
                    ? applyRolePresetToDraft(member.userId, workspace.workspaceId, member.role)
                    : draft
                }
                onToggle={(p) => !editDisabled && handleMemberPermToggle(member.userId, p)}
                disabled={editDisabled}
              />

              {draft.canManageWorkspace && !editDisabled && (
                <p style={{ ...MUTED, marginTop: '0.2rem' }}>
                  ⚠ This member will be able to manage workspace settings.
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Role preset reference ─────────────────────────────────────────────── */}
      <details style={{ fontSize: 12, color: '#64748b' }}>
        <summary style={{ cursor: 'pointer' }}>Role permission presets</summary>
        <table style={{ marginTop: '0.4rem', fontSize: 12, borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.2rem 0.4rem', borderBottom: '1px solid #e2e8f0' }}>Role</th>
              {ALL_PERMISSIONS.map((p) => (
                <th key={p} style={{ textAlign: 'center', padding: '0.2rem 0.4rem', borderBottom: '1px solid #e2e8f0', fontSize: 10 }}>
                  {PERMISSION_LABELS[p]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_ROLES.map((role) => (
              <tr key={role}>
                <td style={{ padding: '0.15rem 0.4rem' }}>{role}</td>
                {ALL_PERMISSIONS.map((p) => (
                  <td key={p} style={{ textAlign: 'center', padding: '0.15rem 0.4rem' }}>
                    {(DEFAULT_PERMISSIONS_BY_ROLE[role] as readonly string[]).includes(p) ? '✓' : ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
