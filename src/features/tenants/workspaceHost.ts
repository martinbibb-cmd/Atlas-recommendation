/**
 * src/features/tenants/workspaceHost.ts
 *
 * Pure host resolver for Atlas workspace subdomain routing.
 *
 * Maps workspace-style hosts to tenants/brands so product customers can use
 * routes like britishgas.atlas-phm.uk.  This module only performs the mapping;
 * it does not automate DNS, auth, billing, or custom-domain onboarding.
 *
 * Design rules
 * ────────────
 * - All functions are pure: no side-effects, no I/O (except loadTenantStore,
 *   which reads localStorage synchronously).
 * - Unknown workspace slugs fall back to atlas.
 * - Reserved slugs (both workspace-level and host-level) fall back to atlas.
 * - Preview / localhost / root-domain hosts fall back to atlas.
 */

import { isValidWorkspaceSlug } from './workspaceSlug';
import { getTenantBySlug } from './tenantRegistry';
import { loadTenantStore } from './tenantStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const ATLAS_ROOT_DOMAIN = 'atlas-phm.uk';

/** brandId used for all atlas fallback resolutions. */
const ATLAS_FALLBACK_BRAND_ID = 'atlas-default';

/**
 * Subdomains of atlas-phm.uk that are reserved for infrastructure and must
 * never be treated as customer workspace slugs.
 *
 * Note: workspace-level reserved slugs (admin, api, app, …) are enforced
 * separately via isValidWorkspaceSlug.  These are host-specific additions for
 * staging / preview subdomain names.
 */
const HOST_RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'next',
  'staging',
  'dev',
  'preview',
  'test',
  'local',
  'beta',
  'alpha',
]);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WorkspaceHostResolutionV1 {
  /** The normalised host that was resolved. */
  host: string;
  /** The workspace slug extracted from the host, when recognised. */
  workspaceSlug?: string;
  /** The tenantId that owns this workspace, when recognised. */
  tenantId?: string;
  /** The brandId to apply.  Always present — defaults to 'atlas-default'. */
  brandId: string;
  /** How the brand was resolved: directly from host or atlas fallback. */
  source: 'host' | 'fallback';
}

// ─── Normalisation ────────────────────────────────────────────────────────────

/**
 * Normalises a raw host string by stripping an optional port suffix and
 * lowercasing.
 *
 * Examples:
 *   'localhost:5173'           → 'localhost'
 *   'BritishGas.ATLAS-PHM.UK' → 'britishgas.atlas-phm.uk'
 *   'atlas-phm.uk'             → 'atlas-phm.uk'
 */
export function normaliseHost(input: string): string {
  return input.trim().toLowerCase().replace(/:\d+$/, '');
}

// ─── Slug extraction ──────────────────────────────────────────────────────────

/**
 * Extracts a workspace slug from a host of the form `<slug>.atlas-phm.uk`.
 *
 * Returns null when:
 *  - the host is not a single-level subdomain of atlas-phm.uk
 *  - the subdomain is a host-reserved slug (e.g. 'next' for the staging deploy)
 *  - the subdomain fails the workspace slug validation rules (length, chars,
 *    or workspace-level reserved slugs such as 'www', 'admin', etc.)
 */
export function extractWorkspaceSlugFromHost(host: string): string | null {
  const normalised = normaliseHost(host);
  const suffix = `.${ATLAS_ROOT_DOMAIN}`;

  if (!normalised.endsWith(suffix)) return null;

  const subdomain = normalised.slice(0, normalised.length - suffix.length);

  // Reject empty or multi-level subdomains (e.g. a.b.atlas-phm.uk).
  if (!subdomain || subdomain.includes('.')) return null;

  // Reject infrastructure/staging subdomains.
  if (HOST_RESERVED_SLUGS.has(subdomain)) return null;

  // Reject workspace-level reserved slugs and invalid characters.
  if (!isValidWorkspaceSlug(subdomain)) return null;

  return subdomain;
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolves a WorkspaceHostResolutionV1 from a browser host string.
 *
 * Fallback rules (first match wins):
 *  1. localhost / 127.0.0.1                               → atlas fallback
 *  2. Preview deploy hosts (*.pages.dev, *.vercel.app, …) → atlas fallback
 *  3. atlas-phm.uk / www.atlas-phm.uk                     → atlas fallback
 *  4. Host-reserved subdomains (next, staging, …)          → atlas fallback
 *  5. Workspace slug not found in tenant registry/store    → atlas fallback
 *  6. Known workspace slug                                 → resolved tenant + brand
 *
 * Never throws — all error paths fall back to atlas.
 */
export function resolveWorkspaceFromHost(host: string): WorkspaceHostResolutionV1 {
  const normalised = normaliseHost(host);

  function atlasFallback(): WorkspaceHostResolutionV1 {
    return { host: normalised, brandId: ATLAS_FALLBACK_BRAND_ID, source: 'fallback' };
  }

  // 1. Local development hosts.
  if (normalised === 'localhost' || normalised === '127.0.0.1') {
    return atlasFallback();
  }

  // 2. Preview / CI deploy hosts.
  if (
    normalised.endsWith('.pages.dev') ||
    normalised.endsWith('.vercel.app') ||
    normalised.endsWith('.netlify.app')
  ) {
    return atlasFallback();
  }

  // 3. Root domain and www alias.
  if (
    normalised === ATLAS_ROOT_DOMAIN ||
    normalised === `www.${ATLAS_ROOT_DOMAIN}`
  ) {
    return atlasFallback();
  }

  // 4 + 5. Extract and validate the workspace slug.
  //   - HOST_RESERVED_SLUGS and workspace-level reserved slugs are both
  //     rejected inside extractWorkspaceSlugFromHost.
  const workspaceSlug = extractWorkspaceSlugFromHost(normalised);
  if (workspaceSlug === null) {
    return atlasFallback();
  }

  // 5. Look up tenant — check stored (edited) tenants first, then built-in
  //    registry.  This mirrors the priority used by resolveActiveTenant.
  const stored = loadTenantStore();
  const storedTenant = Object.values(stored).find(
    (t) => t.workspaceSlug === workspaceSlug,
  );
  const tenant = storedTenant ?? getTenantBySlug(workspaceSlug);

  if (tenant === undefined) {
    // Unknown workspace — safe fallback.
    return atlasFallback();
  }

  return {
    host: normalised,
    workspaceSlug,
    tenantId: tenant.tenantId,
    brandId: tenant.brandId,
    source: 'host',
  };
}
