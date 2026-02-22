import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { TenantConfig, TenantId } from '../engine/schema/EngineInputV2_3';

// ─── Built-in tenant configurations ──────────────────────────────────────────

const TENANT_CONFIGS: Record<TenantId, TenantConfig> = {
  bg: {
    tenantId: 'bg',
    brandName: 'British Gas / Hive',
    accentColor: '#0A3CC7',
    priorityModules: ['maintenance_roi', 'wb_8000plus', 'home_health_check'],
  },
  octopus: {
    tenantId: 'octopus',
    brandName: 'Octopus Energy',
    accentColor: '#E53935',
    priorityModules: ['full_job_spf', 'hot_water_battery', 'agile_savings'],
  },
  default: {
    tenantId: 'default',
    brandName: 'Atlas',
    accentColor: '#2563EB',
    priorityModules: [],
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────

const TenantContext = createContext<TenantConfig>(TENANT_CONFIGS.default);

// ─── Provider ─────────────────────────────────────────────────────────────────

interface TenantConfigProviderProps {
  tenantId?: TenantId;
  children: ReactNode;
}

/**
 * TenantConfigProvider
 *
 * Wraps the application (or a subtree) with white-label tenant configuration.
 * Downstream components can call `useTenantConfig()` to read the active tenant's
 * branding and module priority list.
 *
 * Tenant identities:
 *  - 'bg':      British Gas / Hive – Home Health Check + WB 8000+ + Maintenance ROI
 *  - 'octopus': Octopus Energy – Heat Pump SPF + Hot Water Battery Agile savings
 *  - 'default': Neutral Atlas branding
 */
export function TenantConfigProvider({ tenantId = 'default', children }: TenantConfigProviderProps) {
  const config = TENANT_CONFIGS[tenantId] ?? TENANT_CONFIGS.default;
  return (
    <TenantContext.Provider value={config}>
      {children}
    </TenantContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the active tenant configuration from the nearest TenantConfigProvider.
 * Falls back to the 'default' (Atlas) configuration if no provider is present.
 */
export function useTenantConfig(): TenantConfig {
  return useContext(TenantContext);
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Returns the built-in configuration for a given tenant ID without requiring
 * React context (useful in pure-logic tests or server-side code).
 */
export function getTenantConfig(tenantId: TenantId): TenantConfig {
  return TENANT_CONFIGS[tenantId] ?? TENANT_CONFIGS.default;
}

export { TENANT_CONFIGS };
