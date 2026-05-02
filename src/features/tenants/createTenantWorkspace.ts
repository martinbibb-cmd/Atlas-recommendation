/**
 * src/features/tenants/createTenantWorkspace.ts
 *
 * Core helper for self-serve workspace onboarding.
 *
 * Creates a new Atlas workspace locally: validates the slug, builds a
 * TenantProfileV1 and a BrandProfileV1, persists both, and returns them.
 *
 * Design rules
 * ────────────
 * - No auth, billing, DNS automation, or production tenant provisioning.
 * - No physics, engine, or recommendation changes.
 * - All validation is performed before any writes.
 * - Pure: throws on invalid input rather than returning null / undefined.
 */

import type { TenantProfileV1 } from './tenantProfile';
import type { BrandProfileV1 } from '../branding/brandProfile';
import { normaliseWorkspaceSlug, assertValidWorkspaceSlug } from './workspaceSlug';
import { listStoredTenants, upsertTenant } from './tenantStore';
import { upsertStoredBrandProfile } from '../branding/brandProfileStore';

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface CreateTenantWorkspaceInput {
  /** Human-readable workspace name (e.g. "British Gas Heating"). */
  displayName: string;
  /**
   * Desired workspace slug (e.g. "british-gas").
   * Will be normalised before validation.
   */
  workspaceSlug: string;
  /** Company name shown on Atlas outputs. */
  companyName: string;
  /** Optional logo URL (must start with https:// or http://). */
  logoUrl?: string;
  /** Primary brand colour as a CSS hex string (e.g. "#2563EB"). */
  primaryColor: string;
  /** Optional contact email address. */
  contactEmail?: string;
  /** Optional contact phone number. */
  contactPhone?: string;
  /** Optional company website URL (must start with https:// or http://). */
  website?: string;
}

export interface CreateTenantWorkspaceResult {
  tenant: TenantProfileV1;
  brand: BrandProfileV1;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

function isValidHex(value: string): boolean {
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value);
}

function isValidUrl(value: string): boolean {
  return /^https?:\/\/.+/.test(value);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a new workspace locally.
 *
 * Steps:
 *  1. Normalise the workspaceSlug.
 *  2. Validate the slug (throws on invalid or reserved).
 *  3. Reject duplicates (throws when slug already exists).
 *  4. Validate colour, URL, and email fields.
 *  5. Build TenantProfileV1 and BrandProfileV1.
 *  6. Persist via upsertTenant + upsertStoredBrandProfile.
 *  7. Return the created tenant + brand.
 *
 * @throws Error with a descriptive message on any validation failure.
 */
export function createTenantWorkspace(
  input: CreateTenantWorkspaceInput,
): CreateTenantWorkspaceResult {
  // ── 1. Normalise slug ────────────────────────────────────────────────────
  const slug = normaliseWorkspaceSlug(input.workspaceSlug);

  // ── 2. Validate slug ─────────────────────────────────────────────────────
  assertValidWorkspaceSlug(slug);

  // ── 3. Reject duplicates ─────────────────────────────────────────────────
  const existing = listStoredTenants();
  const duplicate = existing.find((t) => t.workspaceSlug === slug);
  if (duplicate) {
    throw new Error(`Workspace slug "${slug}" is already in use.`);
  }

  // ── 4. Validate other fields ─────────────────────────────────────────────
  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new Error('Workspace display name must not be empty.');
  }

  const companyName = input.companyName.trim();
  if (!companyName) {
    throw new Error('Company name must not be empty.');
  }

  if (!isValidHex(input.primaryColor)) {
    throw new Error(
      'Primary colour must be a valid CSS hex colour (e.g. "#2563EB").',
    );
  }

  if (input.logoUrl !== undefined && input.logoUrl.trim() !== '') {
    if (!isValidUrl(input.logoUrl.trim())) {
      throw new Error('Logo URL must start with http:// or https://.');
    }
  }

  if (input.website !== undefined && input.website.trim() !== '') {
    if (!isValidUrl(input.website.trim())) {
      throw new Error('Website URL must start with http:// or https://.');
    }
  }

  if (input.contactEmail !== undefined && input.contactEmail.trim() !== '') {
    if (!isValidEmail(input.contactEmail.trim())) {
      throw new Error('Contact email address is not valid.');
    }
  }

  // ── 5. Build records ──────────────────────────────────────────────────────
  const now = new Date().toISOString();
  const tenantId = `tenant_${slug}`;
  const brandId = `brand_${slug}`;

  const tenant: TenantProfileV1 = {
    version: '1.0',
    tenantId,
    workspaceSlug: slug,
    displayName,
    brandId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };

  const brand: BrandProfileV1 = {
    version: '1.0',
    brandId,
    companyName,
    ...(input.logoUrl?.trim() ? { logoUrl: input.logoUrl.trim() } : {}),
    theme: {
      primaryColor: input.primaryColor,
    },
    contact: {
      ...(input.contactEmail?.trim() ? { email: input.contactEmail.trim() } : {}),
      ...(input.contactPhone?.trim() ? { phone: input.contactPhone.trim() } : {}),
      ...(input.website?.trim() ? { website: input.website.trim() } : {}),
    },
    outputSettings: {
      showPricing: true,
      showCarbon: true,
      showInstallerContact: !!(input.contactEmail || input.contactPhone || input.website),
      tone: 'friendly',
    },
  };

  // ── 6. Persist ────────────────────────────────────────────────────────────
  upsertTenant(tenant);
  upsertStoredBrandProfile(brand);

  // ── 7. Return ─────────────────────────────────────────────────────────────
  return { tenant, brand };
}
