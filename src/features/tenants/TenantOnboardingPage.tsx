/**
 * src/features/tenants/TenantOnboardingPage.tsx
 *
 * Self-serve workspace onboarding UI.
 *
 * Allows a product customer to create a new Atlas workspace from the browser,
 * including workspace name, slug, and initial branding.  Persisted locally
 * only.  No auth, billing, DNS automation, or production tenant provisioning.
 *
 * Design rules
 * ────────────
 * - Slug is auto-suggested from displayName via normaliseWorkspaceSlug().
 * - Slug availability is checked live against listStoredTenants().
 * - On success a success panel is shown with workspace details and CTAs.
 * - No engine/recommendation/physics changes.
 */

import { useState, useEffect } from 'react';
import { normaliseWorkspaceSlug, isValidWorkspaceSlug } from './workspaceSlug';
import { listStoredTenants } from './tenantStore';
import { createTenantWorkspace } from './createTenantWorkspace';
import type { CreateTenantWorkspaceResult } from './createTenantWorkspace';

// ─── Slug availability ────────────────────────────────────────────────────────

type SlugAvailability = 'available' | 'taken' | 'invalid' | 'empty';

function checkSlugAvailability(slug: string): SlugAvailability {
  if (!slug) return 'empty';
  if (!isValidWorkspaceSlug(slug)) return 'invalid';
  const taken = listStoredTenants().some((t) => t.workspaceSlug === slug);
  return taken ? 'taken' : 'available';
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface TenantOnboardingPageProps {
  /** Called when the user cancels without creating a workspace. */
  onCancel?: () => void;
  /**
   * Called after a workspace is successfully created.
   * Receives the new workspaceSlug so the caller can pre-select it.
   */
  onCreated?: (workspaceSlug: string) => void;
  /**
   * Called when "Start visit in this workspace" is clicked from the success
   * panel.  Receives the new workspaceSlug.
   */
  onStartVisit?: (workspaceSlug: string) => void;
  /**
   * Called when "Open workspace settings" is clicked from the success panel.
   * Receives the new workspaceSlug.
   */
  onOpenWorkspaceSettings?: (workspaceSlug: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * TenantOnboardingPage
 *
 * Full-page onboarding form for creating a new Atlas workspace locally.
 */
export function TenantOnboardingPage({
  onCancel,
  onCreated,
  onStartVisit,
  onOpenWorkspaceSettings,
}: TenantOnboardingPageProps) {
  // ── Form state ──────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563EB');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [website, setWebsite] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateTenantWorkspaceResult | null>(null);

  // ── Auto-suggest slug from displayName ──────────────────────────────────
  useEffect(() => {
    if (!slugManuallyEdited) {
      setSlug(normaliseWorkspaceSlug(displayName));
    }
  }, [displayName, slugManuallyEdited]);

  const slugAvailability = checkSlugAvailability(slug);

  // ── Handlers ─────────────────────────────────────────────────────────────
  function handleSlugChange(value: string) {
    setSlugManuallyEdited(true);
    setSlug(value);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = createTenantWorkspace({
        displayName,
        workspaceSlug: slug,
        companyName: companyName || displayName,
        logoUrl: logoUrl || undefined,
        primaryColor,
        contactEmail: contactEmail || undefined,
        contactPhone: contactPhone || undefined,
        website: website || undefined,
      });
      setResult(created);
      onCreated?.(created.tenant.workspaceSlug);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success panel ─────────────────────────────────────────────────────────
  if (result !== null) {
    return (
      <div
        data-testid="tenant-onboarding-success"
        style={{ minHeight: '100vh', background: '#f8fafc', padding: '1.5rem 1rem' }}
      >
        <div
          style={{
            maxWidth: 520,
            margin: '0 auto',
            background: '#fff',
            borderRadius: 12,
            padding: '2rem 1.5rem',
            boxShadow: '0 2px 12px rgba(0,0,0,0.09)',
          }}
        >
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎉</div>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.375rem', fontWeight: 700, color: '#0f172a' }}>
            Workspace created
          </h1>

          <dl style={{ margin: '1rem 0 1.5rem', lineHeight: 1.7 }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <dt style={{ fontWeight: 600, color: '#475569', minWidth: 120 }}>Workspace name</dt>
              <dd data-testid="success-display-name" style={{ margin: 0 }}>
                {result.tenant.displayName}
              </dd>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <dt style={{ fontWeight: 600, color: '#475569', minWidth: 120 }}>Workspace slug</dt>
              <dd data-testid="success-workspace-slug" style={{ margin: 0, fontFamily: 'monospace' }}>
                {result.tenant.workspaceSlug}
              </dd>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <dt style={{ fontWeight: 600, color: '#475569', minWidth: 120 }}>Company name</dt>
              <dd data-testid="success-company-name" style={{ margin: 0 }}>
                {result.brand.companyName}
              </dd>
            </div>
          </dl>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {onStartVisit && (
              <button
                data-testid="success-start-visit-btn"
                onClick={() => onStartVisit(result.tenant.workspaceSlug)}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Start visit in this workspace
              </button>
            )}
            {onOpenWorkspaceSettings && (
              <button
                data-testid="success-edit-branding-btn"
                onClick={() => onOpenWorkspaceSettings(result.tenant.workspaceSlug)}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: 'transparent',
                  color: '#2563eb',
                  border: '1px solid #2563eb',
                  borderRadius: 6,
                  fontSize: '1rem',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                Open workspace settings
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────
  return (
    <div
      data-testid="tenant-onboarding-page"
      style={{ minHeight: '100vh', background: '#f8fafc', padding: '1.5rem 1rem' }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {onCancel && (
            <button
              data-testid="tenant-onboarding-back"
              onClick={onCancel}
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
            Create workspace
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          style={{
            background: '#fff',
            borderRadius: 10,
            padding: '1.5rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          }}
        >
          {/* Workspace display name */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="onboarding-display-name"
              style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.875rem' }}
            >
              Workspace display name <RequiredMark />
            </label>
            <input
              id="onboarding-display-name"
              data-testid="onboarding-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. British Gas Heating"
              disabled={submitting}
              required
              style={inputStyle}
            />
          </div>

          {/* Workspace slug */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="onboarding-workspace-slug"
              style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.875rem' }}
            >
              Workspace slug <RequiredMark />
            </label>
            <input
              id="onboarding-workspace-slug"
              data-testid="onboarding-workspace-slug"
              type="text"
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="e.g. british-gas"
              disabled={submitting}
              required
              style={{
                ...inputStyle,
                fontFamily: 'monospace',
                borderColor:
                  slugAvailability === 'available'
                    ? '#16a34a'
                    : slugAvailability === 'taken' || slugAvailability === 'invalid'
                    ? '#dc2626'
                    : '#cbd5e1',
              }}
            />
            {slug !== '' && (
              <p
                data-testid="onboarding-slug-status"
                style={{
                  margin: '0.25rem 0 0',
                  fontSize: '0.8125rem',
                  color:
                    slugAvailability === 'available'
                      ? '#16a34a'
                      : slugAvailability === 'taken'
                      ? '#dc2626'
                      : slugAvailability === 'invalid'
                      ? '#dc2626'
                      : '#64748b',
                }}
              >
                {slugAvailability === 'available' && '✓ Available'}
                {slugAvailability === 'taken' && '✗ Already exists'}
                {slugAvailability === 'invalid' && '✗ Reserved or invalid'}
              </p>
            )}
          </div>

          {/* Company name */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="onboarding-company-name"
              style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.875rem' }}
            >
              Company name
            </label>
            <input
              id="onboarding-company-name"
              data-testid="onboarding-company-name"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Shown on customer outputs (defaults to workspace name)"
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          {/* Primary colour */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="onboarding-primary-color"
              style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.875rem' }}
            >
              Primary colour <RequiredMark />
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                id="onboarding-primary-color"
                data-testid="onboarding-primary-color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                disabled={submitting}
                style={{ width: 48, height: 38, padding: 2, border: '1px solid #cbd5e1', borderRadius: 6, cursor: 'pointer' }}
              />
              <input
                data-testid="onboarding-primary-color-hex"
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#2563EB"
                disabled={submitting}
                maxLength={7}
                style={{ ...inputStyle, fontFamily: 'monospace', flex: 1 }}
              />
            </div>
          </div>

          {/* Logo URL */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="onboarding-logo-url"
              style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.875rem' }}
            >
              Logo URL <OptionalTag />
            </label>
            <input
              id="onboarding-logo-url"
              data-testid="onboarding-logo-url"
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          {/* Contact email */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="onboarding-contact-email"
              style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.875rem' }}
            >
              Contact email <OptionalTag />
            </label>
            <input
              id="onboarding-contact-email"
              data-testid="onboarding-contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="hello@yourcompany.co.uk"
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          {/* Contact phone */}
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="onboarding-contact-phone"
              style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.875rem' }}
            >
              Contact phone <OptionalTag />
            </label>
            <input
              id="onboarding-contact-phone"
              data-testid="onboarding-contact-phone"
              type="tel"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="0800 123 4567"
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          {/* Website */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="onboarding-website"
              style={{ display: 'block', fontWeight: 600, marginBottom: '0.3rem', fontSize: '0.875rem' }}
            >
              Website <OptionalTag />
            </label>
            <input
              id="onboarding-website"
              data-testid="onboarding-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourcompany.co.uk"
              disabled={submitting}
              style={inputStyle}
            />
          </div>

          {/* Error */}
          {error !== null && (
            <p
              role="alert"
              data-testid="onboarding-error"
              style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.875rem' }}
            >
              {error}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="submit"
              data-testid="onboarding-create-btn"
              disabled={submitting || slugAvailability === 'taken' || slugAvailability === 'invalid'}
              style={{
                flex: 1,
                padding: '0.625rem 1.25rem',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: '1rem',
                cursor: submitting ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Creating…' : 'Create workspace'}
            </button>
            {onCancel && (
              <button
                type="button"
                data-testid="onboarding-cancel-btn"
                onClick={onCancel}
                disabled={submitting}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: 'transparent',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  fontSize: '1rem',
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Small inline helpers ─────────────────────────────────────────────────────

function RequiredMark() {
  return <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>;
}

function OptionalTag() {
  return (
    <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.8125rem' }}>
      {' '}(optional)
    </span>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: '1rem',
  boxSizing: 'border-box',
};
