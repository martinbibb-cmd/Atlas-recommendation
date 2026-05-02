/**
 * src/features/tenants/TenantSettingsPage.tsx
 *
 * Workspace branding settings page.
 *
 * Allows a product customer to:
 *   - Select their workspace (tenant)
 *   - Edit the BrandProfileV1 linked to that workspace
 *   - Preview changes immediately
 *   - Save a stored override
 *   - Reset to the built-in default
 *
 * Design rules
 * ────────────
 * - No auth, billing, or domain routing.
 * - Resolves brand via tenant.brandId → resolveBrandProfile().
 * - Saves via upsertStoredBrandProfile().
 * - Preview updates immediately in BrandPreviewCard.
 */

import { useState, useCallback } from 'react';
import { listStoredTenants } from './tenantStore';
import { resolveBrandProfile } from '../branding/resolveBrandProfile';
import { BrandEditorPanel } from '../branding/BrandEditorPanel';
import { BrandPreviewCard } from '../branding/BrandPreviewCard';
import type { BrandProfileV1 } from '../branding/brandProfile';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TenantSettingsPageProps {
  /** Called when the user navigates back. */
  onBack?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * TenantSettingsPage
 *
 * Full-page settings surface for workspace branding.
 * Accessible from the landing page via the "Workspace Branding" card.
 */
export function TenantSettingsPage({ onBack }: TenantSettingsPageProps) {
  const tenants = listStoredTenants();

  const [selectedSlug, setSelectedSlug] = useState<string>(() => {
    // Default to the first tenant in the list.
    return tenants[0]?.workspaceSlug ?? 'atlas';
  });

  const activeTenant = tenants.find((t) => t.workspaceSlug === selectedSlug) ?? tenants[0];

  // Resolved profile for the active tenant — reads stored overrides automatically.
  const resolvedProfile = resolveBrandProfile(activeTenant?.brandId);

  // Preview profile — updated live when the user edits without saving.
  const [previewProfile, setPreviewProfile] = useState<BrandProfileV1>(resolvedProfile);

  // When the workspace selection changes, reset the preview to the newly-resolved profile.
  function handleWorkspaceChange(slug: string) {
    setSelectedSlug(slug);
    const tenant = tenants.find((t) => t.workspaceSlug === slug);
    setPreviewProfile(resolveBrandProfile(tenant?.brandId));
  }

  const handleSave = useCallback((saved: BrandProfileV1) => {
    setPreviewProfile(saved);
  }, []);

  const handleReset = useCallback((reset: BrandProfileV1) => {
    setPreviewProfile(reset);
  }, []);

  const handlePreview = useCallback((profile: BrandProfileV1) => {
    setPreviewProfile(profile);
  }, []);

  return (
    <div
      data-testid="tenant-settings-page"
      style={{ minHeight: '100vh', background: '#f8fafc', padding: '1.5rem 1rem' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {onBack && (
          <button
            data-testid="tenant-settings-back"
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '0.25rem 0.5rem',
              borderRadius: 4,
              color: '#334155',
            }}
            aria-label="Back"
          >
            ← Back
          </button>
        )}
        <h1 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 700, color: '#0f172a' }}>
          Workspace Branding
        </h1>
      </div>

      {/* Workspace selector */}
      <div style={{ marginBottom: '1.5rem', maxWidth: 520 }}>
        <label
          htmlFor="tenant-settings-workspace-select"
          style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', fontSize: '0.875rem' }}
        >
          Select workspace
        </label>
        <select
          id="tenant-settings-workspace-select"
          data-testid="tenant-settings-workspace-select"
          value={selectedSlug}
          onChange={(e) => handleWorkspaceChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem 0.75rem',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            fontSize: '1rem',
            background: '#fff',
            boxSizing: 'border-box',
          }}
        >
          {tenants.map((t) => (
            <option key={t.tenantId} value={t.workspaceSlug}>
              {t.displayName} ({t.workspaceSlug})
            </option>
          ))}
        </select>
      </div>

      {/* Two-column layout: editor + preview */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '1.5rem',
          alignItems: 'start',
        }}
      >
        {/* Editor */}
        <div
          style={{
            background: '#fff',
            borderRadius: 10,
            padding: '1.25rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          }}
        >
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700 }}>
            Edit branding
          </h2>
          {activeTenant && (
            <BrandEditorPanel
              profile={resolvedProfile}
              onSave={handleSave}
              onReset={handleReset}
              onPreview={handlePreview}
            />
          )}
        </div>

        {/* Preview */}
        <div>
          <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem', fontWeight: 700 }}>
            Live preview
          </h2>
          <BrandPreviewCard profile={previewProfile} />
        </div>
      </div>
    </div>
  );
}
