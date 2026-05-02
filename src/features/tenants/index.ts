/**
 * src/features/tenants/index.ts
 *
 * Public barrel for the tenants module.
 *
 * Consumers should import from this file rather than from individual modules
 * to keep the public API stable as internals evolve.
 *
 * Note: contract types (TenantProfileV1, TenantStatusV1) are not re-exported
 * here to avoid shadow type surfaces — consumers should import them directly
 * from tenantProfile.ts.
 */

// ─── Registry ─────────────────────────────────────────────────────────────────

export {
  BUILT_IN_TENANTS,
  listTenants,
  getTenantById,
  getTenantBySlug,
  getBrandIdForTenant,
  getBrandIdForWorkspaceSlug,
} from './tenantRegistry';

// ─── Store ────────────────────────────────────────────────────────────────────

export {
  TENANT_STORE_KEY,
  loadTenantStore,
  saveTenantStore,
  upsertTenant,
  deleteTenant,
  listStoredTenants,
} from './tenantStore';

// ─── Slug helpers ─────────────────────────────────────────────────────────────

export {
  normaliseWorkspaceSlug,
  isValidWorkspaceSlug,
  assertValidWorkspaceSlug,
} from './workspaceSlug';

// ─── Active tenant resolver ───────────────────────────────────────────────────

export { resolveActiveTenant, FALLBACK_TENANT_ID } from './activeTenant';
export type { ResolveActiveTenantInput } from './activeTenant';

// ─── React ────────────────────────────────────────────────────────────────────

export { WorkspaceSelector } from './WorkspaceSelector';
export type { WorkspaceSelectorProps } from './WorkspaceSelector';

// ─── Settings page ────────────────────────────────────────────────────────────

export { TenantSettingsPage } from './TenantSettingsPage';
export type { TenantSettingsPageProps } from './TenantSettingsPage';

// ─── Onboarding page ──────────────────────────────────────────────────────────

export { TenantOnboardingPage } from './TenantOnboardingPage';
export type { TenantOnboardingPageProps } from './TenantOnboardingPage';

// ─── Create workspace helper ──────────────────────────────────────────────────

export { createTenantWorkspace } from './createTenantWorkspace';
export type {
  CreateTenantWorkspaceInput,
  CreateTenantWorkspaceResult,
} from './createTenantWorkspace';

// ─── Host resolver ────────────────────────────────────────────────────────────

export {
  normaliseHost,
  extractWorkspaceSlugFromHost,
  resolveWorkspaceFromHost,
} from './workspaceHost';
export type { WorkspaceHostResolutionV1 } from './workspaceHost';

// ─── Host resolver hook ───────────────────────────────────────────────────────

export { useWorkspaceFromHost } from './useWorkspaceFromHost';
