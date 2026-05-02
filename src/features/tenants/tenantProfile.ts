/**
 * src/features/tenants/tenantProfile.ts
 *
 * TenantProfileV1 — the product-customer (installer/company) data model.
 *
 * A tenant represents an installer or company that uses Atlas under their
 * own brand.  Each tenant is linked to a BrandProfileV1 via brandId.
 *
 * This file contains type definitions only.  It has no runtime side-effects.
 */

// ─── Status ───────────────────────────────────────────────────────────────────

export type TenantStatusV1 =
  | 'draft'
  | 'active'
  | 'suspended'
  | 'archived';

// ─── Profile ──────────────────────────────────────────────────────────────────

export interface TenantProfileV1 {
  /** Schema version — always '1.0'. */
  version: '1.0';

  /** Stable internal identifier for this tenant (e.g. "atlas", "demo-heating"). */
  tenantId: string;

  /**
   * Customer-facing workspace slug (e.g. "britishgas", "demo-heating").
   * Lowercase kebab-case, letters/numbers/hyphens only, length 3–40.
   * Must not include dots or domain segments.
   */
  workspaceSlug: string;

  /** Human-readable company name shown in the workspace selector. */
  displayName: string;

  /** brandId linking this tenant to a BrandProfileV1. */
  brandId: string;

  /** Current lifecycle status of the tenant record. */
  status: TenantStatusV1;

  /** ISO-8601 timestamp when the tenant record was first created. */
  createdAt: string;

  /** ISO-8601 timestamp when the tenant record was last modified. */
  updatedAt: string;
}
