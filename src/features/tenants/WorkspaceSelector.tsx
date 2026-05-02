/**
 * src/features/tenants/WorkspaceSelector.tsx
 *
 * Workspace selector UI for Atlas Mind.
 *
 * Renders a labelled <select> that lists all available tenants (built-in +
 * any stored/custom tenants).  Selecting a workspace sets the active tenant,
 * which in turn determines the brandId used for the visit.
 *
 * Design rules
 * ────────────
 * - Controlled: caller owns the selected workspaceSlug via value/onChange.
 * - Reads from listStoredTenants() so custom tenants are included automatically.
 * - No side-effects beyond calling onChange — caller persists the selection.
 */

import { listStoredTenants } from './tenantStore';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WorkspaceSelectorProps {
  /** Currently selected workspaceSlug. */
  value: string;
  /** Called when the engineer selects a different workspace. */
  onChange: (workspaceSlug: string) => void;
  /** Disable the selector while a form is submitting. */
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * WorkspaceSelector
 *
 * Renders a <select> populated with all available tenants.
 * Each option displays the tenant's displayName and workspaceSlug.
 */
export function WorkspaceSelector({ value, onChange, disabled }: WorkspaceSelectorProps) {
  const tenants = listStoredTenants();

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
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
      {tenants.map((tenant) => (
        <option key={tenant.tenantId} value={tenant.workspaceSlug}>
          {tenant.displayName} ({tenant.workspaceSlug})
        </option>
      ))}
    </select>
  );
}
