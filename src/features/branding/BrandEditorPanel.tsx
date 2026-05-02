/**
 * src/features/branding/BrandEditorPanel.tsx
 *
 * Brand editor form.  Allows a workspace admin to edit the visible Atlas
 * branding: company name, colours, contact details, logo URL, and output
 * settings.
 *
 * Design rules
 * ────────────
 * - All validation is local and lightweight (no external validators).
 * - Saving calls upsertStoredBrandProfile() and notifies via onSave.
 * - Reset calls deleteStoredBrandProfile() and notifies via onReset.
 * - Does not affect engine, physics, or recommendation logic.
 */

import { useState, useEffect } from 'react';
import type { BrandProfileV1, BrandToneV1 } from './brandProfile';
import { upsertStoredBrandProfile, deleteStoredBrandProfile } from './brandProfileStore';
import { BRAND_PROFILES } from './brandProfiles';

// ─── Validation helpers ───────────────────────────────────────────────────────

/** Returns true when the value is a valid 3- or 6-digit CSS hex colour. */
function isValidHex(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

function isValidUrl(value: string): boolean {
  return /^https?:\/\/.+/.test(value);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormState {
  companyName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  tone: BrandToneV1;
  showInstallerContact: boolean;
  showPricing: boolean;
  showCarbon: boolean;
}

function profileToForm(profile: BrandProfileV1): FormState {
  return {
    companyName: profile.companyName,
    logoUrl: profile.logoUrl ?? '',
    primaryColor: profile.theme.primaryColor,
    secondaryColor: profile.theme.secondaryColor ?? '',
    accentColor: profile.theme.accentColor ?? '',
    phone: profile.contact.phone ?? '',
    email: profile.contact.email ?? '',
    website: profile.contact.website ?? '',
    address: profile.contact.address ?? '',
    tone: profile.outputSettings.tone,
    showInstallerContact: profile.outputSettings.showInstallerContact,
    showPricing: profile.outputSettings.showPricing,
    showCarbon: profile.outputSettings.showCarbon,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

interface ValidationErrors {
  companyName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
}

function validate(form: FormState): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!form.companyName.trim()) {
    errors.companyName = 'Company name is required.';
  }
  if (!isValidHex(form.primaryColor)) {
    errors.primaryColor = 'Must be a valid hex colour (e.g. #2563EB).';
  }
  if (form.secondaryColor && !isValidHex(form.secondaryColor)) {
    errors.secondaryColor = 'Must be a valid hex colour if provided.';
  }
  if (form.accentColor && !isValidHex(form.accentColor)) {
    errors.accentColor = 'Must be a valid hex colour if provided.';
  }
  if (form.email && !isValidEmail(form.email)) {
    errors.email = 'Must look like a valid email address if provided.';
  }
  if (form.website && !isValidUrl(form.website)) {
    errors.website = 'Must start with http:// or https:// if provided.';
  }
  if (form.logoUrl && !isValidUrl(form.logoUrl)) {
    errors.logoUrl = 'Must start with http:// or https:// if provided.';
  }

  return errors;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface BrandEditorPanelProps {
  /** The brand profile to edit. */
  profile: BrandProfileV1;
  /** Called after a profile has been saved to the store. */
  onSave?: (profile: BrandProfileV1) => void;
  /** Called after the stored override has been deleted (reset to built-in). */
  onReset?: (profile: BrandProfileV1) => void;
  /** Called when the "Preview customer output" button is clicked. */
  onPreview?: (profile: BrandProfileV1) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/** Input row with label and optional error. */
function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: '0.875rem' }}>
      <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.875rem' }}>
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" style={{ color: '#dc2626', fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
          {error}
        </p>
      )}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0.4rem 0.6rem',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  fontSize: '0.9rem',
  boxSizing: 'border-box',
};

/**
 * BrandEditorPanel
 *
 * Renders an editable form for a BrandProfileV1.  Validates on submit;
 * on success calls upsertStoredBrandProfile and onSave.
 */
export function BrandEditorPanel({ profile, onSave, onReset, onPreview }: BrandEditorPanelProps) {
  const [form, setForm] = useState<FormState>(() => profileToForm(profile));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saved, setSaved] = useState(false);

  // Re-initialise form whenever the incoming profile changes.
  useEffect(() => {
    setForm(profileToForm(profile));
    setErrors({});
    setSaved(false);
  }, [profile]);

  function handleChange(field: keyof FormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function buildProfile(): BrandProfileV1 {
    return {
      version: '1.0',
      brandId: profile.brandId,
      companyName: form.companyName.trim(),
      logoUrl: form.logoUrl.trim() || undefined,
      theme: {
        primaryColor: form.primaryColor.trim(),
        secondaryColor: form.secondaryColor.trim() || undefined,
        accentColor: form.accentColor.trim() || undefined,
        backgroundColor: profile.theme.backgroundColor,
        surfaceColor: profile.theme.surfaceColor,
        textColor: profile.theme.textColor,
      },
      contact: {
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        address: form.address.trim() || undefined,
      },
      outputSettings: {
        tone: form.tone,
        showInstallerContact: form.showInstallerContact,
        showPricing: form.showPricing,
        showCarbon: form.showCarbon,
      },
    };
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    const updated = buildProfile();
    upsertStoredBrandProfile(updated);
    setSaved(true);
    onSave?.(updated);
  }

  function handleReset() {
    deleteStoredBrandProfile(profile.brandId);
    const builtIn = BRAND_PROFILES[profile.brandId] ?? BRAND_PROFILES['atlas-default'];
    setForm(profileToForm(builtIn));
    setErrors({});
    setSaved(false);
    onReset?.(builtIn);
  }

  function handlePreview() {
    const errs = validate(form);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onPreview?.(buildProfile());
  }

  return (
    <form
      onSubmit={handleSave}
      aria-label="Brand editor"
      style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
    >
      {/* Company */}
      <Field label="Company name" error={errors.companyName}>
        <input
          data-testid="brand-editor-company-name"
          style={INPUT_STYLE}
          type="text"
          value={form.companyName}
          onChange={(e) => handleChange('companyName', e.target.value)}
          placeholder="e.g. Demo Heating Co"
        />
      </Field>

      <Field label="Logo URL" error={errors.logoUrl}>
        <input
          data-testid="brand-editor-logo-url"
          style={INPUT_STYLE}
          type="text"
          value={form.logoUrl}
          onChange={(e) => handleChange('logoUrl', e.target.value)}
          placeholder="https://example.com/logo.png"
        />
      </Field>

      {/* Colours */}
      <Field label="Primary colour" error={errors.primaryColor}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            data-testid="brand-editor-primary-color"
            style={{ ...INPUT_STYLE, flex: 1 }}
            type="text"
            value={form.primaryColor}
            onChange={(e) => handleChange('primaryColor', e.target.value)}
            placeholder="#2563EB"
          />
          <input
            aria-label="Primary colour picker"
            type="color"
            value={isValidHex(form.primaryColor) ? form.primaryColor : '#000000'}
            onChange={(e) => handleChange('primaryColor', e.target.value)}
            style={{ width: 36, height: 36, padding: 2, border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}
          />
        </div>
      </Field>

      <Field label="Secondary colour (optional)" error={errors.secondaryColor}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            data-testid="brand-editor-secondary-color"
            style={{ ...INPUT_STYLE, flex: 1 }}
            type="text"
            value={form.secondaryColor}
            onChange={(e) => handleChange('secondaryColor', e.target.value)}
            placeholder="#1E40AF"
          />
          <input
            aria-label="Secondary colour picker"
            type="color"
            value={isValidHex(form.secondaryColor) ? form.secondaryColor : '#000000'}
            onChange={(e) => handleChange('secondaryColor', e.target.value)}
            style={{ width: 36, height: 36, padding: 2, border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}
          />
        </div>
      </Field>

      <Field label="Accent colour (optional)" error={errors.accentColor}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            data-testid="brand-editor-accent-color"
            style={{ ...INPUT_STYLE, flex: 1 }}
            type="text"
            value={form.accentColor}
            onChange={(e) => handleChange('accentColor', e.target.value)}
            placeholder="#3B82F6"
          />
          <input
            aria-label="Accent colour picker"
            type="color"
            value={isValidHex(form.accentColor) ? form.accentColor : '#000000'}
            onChange={(e) => handleChange('accentColor', e.target.value)}
            style={{ width: 36, height: 36, padding: 2, border: '1px solid #cbd5e1', borderRadius: 4, cursor: 'pointer' }}
          />
        </div>
      </Field>

      {/* Contact */}
      <Field label="Phone">
        <input
          data-testid="brand-editor-phone"
          style={INPUT_STYLE}
          type="text"
          value={form.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
          placeholder="0800 123 4567"
        />
      </Field>

      <Field label="Email" error={errors.email}>
        <input
          data-testid="brand-editor-email"
          style={INPUT_STYLE}
          type="text"
          value={form.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="hello@example.co.uk"
        />
      </Field>

      <Field label="Website" error={errors.website}>
        <input
          data-testid="brand-editor-website"
          style={INPUT_STYLE}
          type="text"
          value={form.website}
          onChange={(e) => handleChange('website', e.target.value)}
          placeholder="https://example.co.uk"
        />
      </Field>

      <Field label="Address">
        <input
          data-testid="brand-editor-address"
          style={INPUT_STYLE}
          type="text"
          value={form.address}
          onChange={(e) => handleChange('address', e.target.value)}
          placeholder="123 High Street, London"
        />
      </Field>

      {/* Output settings */}
      <Field label="Tone">
        <select
          data-testid="brand-editor-tone"
          style={INPUT_STYLE}
          value={form.tone}
          onChange={(e) => handleChange('tone', e.target.value as BrandToneV1)}
        >
          <option value="formal">Formal</option>
          <option value="friendly">Friendly</option>
          <option value="technical">Technical</option>
        </select>
      </Field>

      <div style={{ marginBottom: '0.875rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
          <input
            data-testid="brand-editor-show-installer-contact"
            type="checkbox"
            checked={form.showInstallerContact}
            onChange={(e) => handleChange('showInstallerContact', e.target.checked)}
          />
          Show installer contact
        </label>
      </div>

      <div style={{ marginBottom: '0.875rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
          <input
            data-testid="brand-editor-show-pricing"
            type="checkbox"
            checked={form.showPricing}
            onChange={(e) => handleChange('showPricing', e.target.checked)}
          />
          Show pricing
        </label>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
          <input
            data-testid="brand-editor-show-carbon"
            type="checkbox"
            checked={form.showCarbon}
            onChange={(e) => handleChange('showCarbon', e.target.checked)}
          />
          Show carbon
        </label>
      </div>

      {saved && (
        <p
          role="status"
          data-testid="brand-editor-saved-notice"
          style={{ color: '#16a34a', fontSize: '0.875rem', marginBottom: '0.75rem' }}
        >
          ✓ Branding saved.
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          type="submit"
          data-testid="brand-editor-save-btn"
          style={{
            padding: '0.5rem 1.25rem',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Save branding
        </button>
        <button
          type="button"
          data-testid="brand-editor-reset-btn"
          onClick={handleReset}
          style={{
            padding: '0.5rem 1.25rem',
            background: '#f1f5f9',
            color: '#334155',
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Reset to default
        </button>
        {onPreview && (
          <button
            type="button"
            data-testid="brand-editor-preview-btn"
            onClick={handlePreview}
            style={{
              padding: '0.5rem 1.25rem',
              background: '#f8fafc',
              color: '#0f172a',
              border: '1px solid #cbd5e1',
              borderRadius: 6,
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            Preview customer output
          </button>
        )}
      </div>
    </form>
  );
}
