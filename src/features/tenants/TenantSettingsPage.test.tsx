/**
 * src/features/tenants/TenantSettingsPage.test.tsx
 *
 * Tests for the TenantSettingsPage component.
 *
 * Coverage:
 *   - renders data-testid="tenant-settings-page"
 *   - renders workspace selector with built-in tenants
 *   - loads tenant.brandId → resolves current BrandProfileV1
 *   - renders BrandEditorPanel
 *   - renders BrandPreviewCard
 *   - saving workspace branding changes visible BrandProvider output
 *   - onBack is called when back button is clicked
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TenantSettingsPage } from './TenantSettingsPage';
import {
  deleteStoredBrandProfile,
  BRAND_PROFILE_STORE_KEY,
} from '../branding/brandProfileStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearStore(): void {
  try { localStorage.removeItem(BRAND_PROFILE_STORE_KEY); } catch { /* unavailable */ }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearStore();
  deleteStoredBrandProfile('installer-demo');
  deleteStoredBrandProfile('atlas-default');
});

describe('TenantSettingsPage', () => {
  it('renders data-testid="tenant-settings-page"', () => {
    render(<TenantSettingsPage />);
    expect(screen.getByTestId('tenant-settings-page')).toBeTruthy();
  });

  it('renders the workspace selector', () => {
    render(<TenantSettingsPage />);
    expect(screen.getByTestId('tenant-settings-workspace-select')).toBeTruthy();
  });

  it('lists built-in tenants in the workspace selector', () => {
    render(<TenantSettingsPage />);
    const select = screen.getByTestId('tenant-settings-workspace-select') as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toContain('atlas');
    expect(options).toContain('demo-heating');
  });

  it('renders BrandEditorPanel', () => {
    render(<TenantSettingsPage />);
    expect(screen.getByTestId('brand-editor-company-name')).toBeTruthy();
  });

  it('renders BrandPreviewCard', () => {
    render(<TenantSettingsPage />);
    expect(screen.getByTestId('brand-preview-card')).toBeTruthy();
  });

  it('loads tenant.brandId → resolves the correct company name in the editor', () => {
    render(<TenantSettingsPage />);
    // The first tenant in the list is 'atlas' → companyName 'Atlas'.
    const input = screen.getByTestId('brand-editor-company-name') as HTMLInputElement;
    expect(input.value).toBe('Atlas');
  });

  it('switches to demo-heating workspace on selection change', () => {
    render(<TenantSettingsPage />);
    const select = screen.getByTestId('tenant-settings-workspace-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'demo-heating' } });
    const input = screen.getByTestId('brand-editor-company-name') as HTMLInputElement;
    expect(input.value).toBe('Demo Heating Co');
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(<TenantSettingsPage onBack={onBack} />);
    fireEvent.click(screen.getByTestId('tenant-settings-back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders "Create new workspace" button when onCreateWorkspace is provided', () => {
    render(<TenantSettingsPage onCreateWorkspace={vi.fn()} />);
    expect(screen.getByTestId('tenant-settings-create-workspace-btn')).toBeTruthy();
  });

  it('calls onCreateWorkspace when "Create new workspace" button is clicked', () => {
    const onCreateWorkspace = vi.fn();
    render(<TenantSettingsPage onCreateWorkspace={onCreateWorkspace} />);
    fireEvent.click(screen.getByTestId('tenant-settings-create-workspace-btn'));
    expect(onCreateWorkspace).toHaveBeenCalledOnce();
  });

  it('does not render "Create new workspace" button when onCreateWorkspace is not provided', () => {
    render(<TenantSettingsPage />);
    expect(screen.queryByTestId('tenant-settings-create-workspace-btn')).toBeNull();
  });

  it('saving workspace branding updates the preview card company name', () => {
    render(<TenantSettingsPage />);
    // Switch to demo-heating.
    const select = screen.getByTestId('tenant-settings-workspace-select') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'demo-heating' } });
    // Change company name in editor.
    const nameInput = screen.getByTestId('brand-editor-company-name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Saved Heating Ltd' } });
    // Save.
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    // Preview card should now show the new name.
    expect(screen.getByTestId('brand-preview-company').textContent).toBe('Saved Heating Ltd');
  });
});
