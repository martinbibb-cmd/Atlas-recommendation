/**
 * src/features/userProfiles/UserProfilePanel.tsx
 *
 * User profile management panel.
 *
 * Allows the engineer to:
 *   - Browse and select an existing local profile.
 *   - Create a new profile with display name, optional email,
 *     default workspace slug, role per tenant, and developer-mode toggle.
 *   - Edit the currently active profile.
 *
 * Design rules
 * ────────────
 * - No auth / passwords — local-only profile switcher.
 * - email is shown for display only; never forwarded to analytics.
 * - All persistence is via upsertUserProfile + setActiveUser from context.
 * - Generates a userId with crypto.randomUUID() for new profiles.
 */

import { useState } from 'react';
import type { UserProfileV1, UserRoleV1 } from './userProfile';
import { listUserProfiles } from './userProfileStore';
import { useActiveUser } from './useActiveUser';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLES: UserRoleV1[] = ['owner', 'admin', 'engineer', 'sales', 'viewer'];

const ROLE_LABELS: Record<UserRoleV1, string> = {
  owner: 'Owner',
  admin: 'Admin',
  engineer: 'Engineer',
  sales: 'Sales',
  viewer: 'Viewer',
};

function generateUserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `user_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  }
  // Fallback: combine timestamp with a random number to avoid collisions when
  // multiple profiles are created in rapid succession.
  return `user_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffff).toString(16)}`;
}

function makeEmptyDraft(): Omit<UserProfileV1, 'userId' | 'version' | 'createdAt' | 'updatedAt'> {
  return {
    displayName: '',
    email: '',
    defaultWorkspaceSlug: '',
    rolesByTenant: {},
    developerMode: false,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserProfilePanelProps {
  /** Called when the user closes / dismisses the panel. */
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

type PanelView = 'list' | 'edit';

/**
 * UserProfilePanel
 *
 * Two-screen panel:
 *   list — shows all saved profiles + "New profile" button; the active profile
 *           is highlighted and each item can be selected or edited.
 *   edit — create or modify a single profile.
 */
export function UserProfilePanel({ onClose }: UserProfilePanelProps) {
  const { activeUser, setActiveUser, clearActiveUser } = useActiveUser();

  const [view, setView] = useState<PanelView>('list');
  const [profiles, setProfiles] = useState<UserProfileV1[]>(() => listUserProfiles());
  const [editingProfile, setEditingProfile] = useState<UserProfileV1 | null>(null);

  // ── Draft state (used in 'edit' view) ──────────────────────────────────────
  const [draft, setDraft] = useState(makeEmptyDraft());
  const [roleInput, setRoleInput] = useState<{ tenantId: string; role: UserRoleV1 }>({
    tenantId: '',
    role: 'engineer',
  });
  const [saveError, setSaveError] = useState<string | null>(null);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function openCreateForm() {
    setEditingProfile(null);
    setDraft(makeEmptyDraft());
    setRoleInput({ tenantId: '', role: 'engineer' });
    setSaveError(null);
    setView('edit');
  }

  function openEditForm(profile: UserProfileV1) {
    setEditingProfile(profile);
    setDraft({
      displayName: profile.displayName,
      email: profile.email ?? '',
      defaultWorkspaceSlug: profile.defaultWorkspaceSlug ?? '',
      rolesByTenant: { ...profile.rolesByTenant },
      developerMode: profile.developerMode ?? false,
    });
    setRoleInput({ tenantId: '', role: 'engineer' });
    setSaveError(null);
    setView('edit');
  }

  function handleSelect(profile: UserProfileV1) {
    setActiveUser(profile);
    onClose();
  }

  function handleClearActiveUser() {
    clearActiveUser();
  }

  function handleSave() {
    const name = draft.displayName.trim();
    if (!name) {
      setSaveError('Display name is required.');
      return;
    }

    const now = new Date().toISOString();

    if (editingProfile !== null) {
      // Update existing
      const updated: UserProfileV1 = {
        ...editingProfile,
        displayName: name,
        email: draft.email?.trim() || undefined,
        defaultWorkspaceSlug: draft.defaultWorkspaceSlug?.trim() || undefined,
        rolesByTenant: draft.rolesByTenant,
        developerMode: draft.developerMode,
        updatedAt: now,
      };
      setActiveUser(updated);
      setProfiles(listUserProfiles());
    } else {
      // Create new
      const created: UserProfileV1 = {
        version: '1.0',
        userId: generateUserId(),
        displayName: name,
        email: draft.email?.trim() || undefined,
        defaultWorkspaceSlug: draft.defaultWorkspaceSlug?.trim() || undefined,
        rolesByTenant: draft.rolesByTenant,
        developerMode: draft.developerMode,
        createdAt: now,
        updatedAt: now,
      };
      setActiveUser(created);
      setProfiles(listUserProfiles());
    }

    setView('list');
    setSaveError(null);
  }

  function handleAddRole() {
    const tid = roleInput.tenantId.trim();
    if (!tid) return;
    setDraft(prev => ({
      ...prev,
      rolesByTenant: { ...prev.rolesByTenant, [tid]: roleInput.role },
    }));
    setRoleInput(prev => ({ ...prev, tenantId: '' }));
  }

  function handleRemoveRole(tenantId: string) {
    setDraft(prev => {
      const next = { ...prev.rolesByTenant };
      delete next[tenantId];
      return { ...prev, rolesByTenant: next };
    });
  }

  // ─── Render helpers ───────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    fontSize: '1rem',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.25rem',
    fontWeight: 500,
    fontSize: '0.875rem',
  };

  // ─── List view ────────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div style={{ padding: '1.5rem', maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>User Profiles</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
          >
            ✕
          </button>
        </div>

        {activeUser !== null && (
          <div
            style={{
              padding: '0.625rem 0.75rem',
              background: '#eff6ff',
              border: '1px solid #93c5fd',
              borderRadius: 6,
              marginBottom: '0.75rem',
              fontSize: '0.875rem',
            }}
          >
            <span style={{ color: '#1e40af', fontWeight: 600 }}>Active: </span>
            <span style={{ color: '#1e3a8a' }}>{activeUser.displayName}</span>
            {activeUser.email && (
              <span style={{ color: '#64748b', marginLeft: '0.375rem' }}>· {activeUser.email}</span>
            )}
            <button
              onClick={handleClearActiveUser}
              style={{
                float: 'right',
                background: 'none',
                border: 'none',
                fontSize: '0.75rem',
                color: '#64748b',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              Sign out
            </button>
          </div>
        )}

        {profiles.length === 0 && (
          <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1rem' }}>
            No profiles saved yet. Create one below.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
          {profiles.map(profile => {
            const isActive = activeUser?.userId === profile.userId;
            return (
              <div
                key={profile.userId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.625rem 0.75rem',
                  border: `1px solid ${isActive ? '#93c5fd' : '#e2e8f0'}`,
                  borderRadius: 6,
                  background: isActive ? '#f0f7ff' : '#fff',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: isActive ? 600 : 400, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {profile.displayName}
                  </p>
                  {profile.email && (
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {profile.email}
                    </p>
                  )}
                </div>
                {!isActive && (
                  <button
                    onClick={() => handleSelect(profile)}
                    style={{
                      padding: '0.25rem 0.625rem',
                      background: '#2563eb',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    Select
                  </button>
                )}
                <button
                  onClick={() => openEditForm(profile)}
                  style={{
                    padding: '0.25rem 0.625rem',
                    background: 'transparent',
                    color: '#475569',
                    border: '1px solid #cbd5e1',
                    borderRadius: 4,
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={openCreateForm}
          style={{
            width: '100%',
            padding: '0.625rem 1.25rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          + New Profile
        </button>
      </div>
    );
  }

  // ─── Edit / Create view ───────────────────────────────────────────────────

  return (
    <div style={{ padding: '1.5rem', maxWidth: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={() => setView('list')}
          style={{ background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', color: '#2563eb', padding: 0 }}
        >
          ← Back
        </button>
        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
          {editingProfile !== null ? 'Edit Profile' : 'New Profile'}
        </h2>
      </div>

      {/* Display name */}
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="profile-display-name" style={labelStyle}>
          Display name <span style={{ color: '#dc2626' }}>*</span>
        </label>
        <input
          id="profile-display-name"
          type="text"
          value={draft.displayName}
          onChange={e => setDraft(prev => ({ ...prev, displayName: e.target.value }))}
          placeholder="e.g. Alex Smith"
          style={inputStyle}
        />
      </div>

      {/* Email */}
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="profile-email" style={labelStyle}>
          Email <span style={{ fontWeight: 400, color: '#64748b' }}>(optional)</span>
        </label>
        <input
          id="profile-email"
          type="email"
          value={draft.email ?? ''}
          onChange={e => setDraft(prev => ({ ...prev, email: e.target.value }))}
          placeholder="e.g. alex@example.com"
          style={inputStyle}
        />
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
          For display only — never sent to analytics.
        </p>
      </div>

      {/* Default workspace */}
      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="profile-workspace" style={labelStyle}>
          Default workspace slug <span style={{ fontWeight: 400, color: '#64748b' }}>(optional)</span>
        </label>
        <input
          id="profile-workspace"
          type="text"
          value={draft.defaultWorkspaceSlug ?? ''}
          onChange={e => setDraft(prev => ({ ...prev, defaultWorkspaceSlug: e.target.value }))}
          placeholder="e.g. demo-heating"
          style={inputStyle}
        />
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
          Pre-selects this workspace when starting a new visit.
        </p>
      </div>

      {/* Developer mode */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <input
          id="profile-dev-mode"
          type="checkbox"
          checked={draft.developerMode ?? false}
          onChange={e => setDraft(prev => ({ ...prev, developerMode: e.target.checked }))}
          style={{ width: 16, height: 16, cursor: 'pointer' }}
        />
        <label htmlFor="profile-dev-mode" style={{ ...labelStyle, margin: 0, cursor: 'pointer' }}>
          Developer mode
        </label>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
          (shows dev menus and diagnostics panels)
        </span>
      </div>

      {/* Roles by tenant */}
      <div style={{ marginBottom: '1.25rem' }}>
        <p style={{ ...labelStyle, marginBottom: '0.5rem' }}>Roles by tenant</p>
        {Object.entries(draft.rolesByTenant).length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
            {Object.entries(draft.rolesByTenant).map(([tenantId, role]) => (
              <div
                key={tenantId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.25rem 0.5rem',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 4,
                  fontSize: '0.875rem',
                }}
              >
                <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8125rem', color: '#334155' }}>{tenantId}</span>
                <span style={{ color: '#475569' }}>{ROLE_LABELS[role] ?? role}</span>
                <button
                  onClick={() => handleRemoveRole(tenantId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: '0 0.125rem', fontSize: '0.875rem' }}
                  aria-label={`Remove role for ${tenantId}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <input
            type="text"
            value={roleInput.tenantId}
            onChange={e => setRoleInput(prev => ({ ...prev, tenantId: e.target.value }))}
            placeholder="Tenant ID"
            style={{ ...inputStyle, flex: 2 }}
          />
          <select
            value={roleInput.role}
            onChange={e => setRoleInput(prev => ({ ...prev, role: e.target.value as UserRoleV1 }))}
            style={{ ...inputStyle, flex: 1, padding: '0.5rem' }}
          >
            {ROLES.map(r => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAddRole}
            style={{
              padding: '0.5rem 0.75rem',
              background: '#475569',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            Add
          </button>
        </div>
      </div>

      {saveError !== null && (
        <p role="alert" style={{ color: '#dc2626', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
          {saveError}
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem' }}>
        <button
          onClick={handleSave}
          style={{
            flex: 1,
            padding: '0.625rem 1.25rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          {editingProfile !== null ? 'Save Changes' : 'Create Profile'}
        </button>
        <button
          onClick={() => setView('list')}
          style={{
            padding: '0.625rem 1.25rem',
            background: 'transparent',
            color: '#64748b',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
