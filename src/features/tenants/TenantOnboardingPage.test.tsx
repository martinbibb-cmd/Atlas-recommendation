/**
 * src/features/tenants/TenantOnboardingPage.test.tsx
 *
 * Tests for the TenantOnboardingPage component.
 *
 * Coverage:
 *   - renders the form
 *   - displayName generates slug suggestion
 *   - slug normalisation reflected in slug field
 *   - reserved slug shows invalid status
 *   - duplicate slug shows taken status
 *   - available slug shows available status
 *   - invalid colour blocks creation (via createTenantWorkspace error)
 *   - invalid logo/website URL blocks creation
 *   - valid workspace creates tenant + brand (success panel shown)
 *   - success panel shows workspace name, slug, company name
 *   - success panel "Start visit" button calls onStartVisit
 *   - success panel "Open workspace settings" button calls onOpenWorkspaceSettings
 *   - cancel button calls onCancel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TenantOnboardingPage } from './TenantOnboardingPage';
import { TENANT_STORE_KEY } from './tenantStore';
import { BRAND_PROFILE_STORE_KEY } from '../branding/brandProfileStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearStores(): void {
  try { localStorage.removeItem(TENANT_STORE_KEY); } catch { /* unavailable */ }
  try { localStorage.removeItem(BRAND_PROFILE_STORE_KEY); } catch { /* unavailable */ }
}

function fillForm(opts: {
  displayName?: string;
  slug?: string;
  companyName?: string;
  primaryColor?: string;
}) {
  if (opts.displayName !== undefined) {
    fireEvent.change(screen.getByTestId('onboarding-display-name'), {
      target: { value: opts.displayName },
    });
  }
  if (opts.slug !== undefined) {
    fireEvent.change(screen.getByTestId('onboarding-workspace-slug'), {
      target: { value: opts.slug },
    });
  }
  if (opts.companyName !== undefined) {
    fireEvent.change(screen.getByTestId('onboarding-company-name'), {
      target: { value: opts.companyName },
    });
  }
  if (opts.primaryColor !== undefined) {
    fireEvent.change(screen.getByTestId('onboarding-primary-color-hex'), {
      target: { value: opts.primaryColor },
    });
  }
}

function submitForm() {
  fireEvent.click(screen.getByTestId('onboarding-create-btn'));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearStores();
  vi.clearAllMocks();
});

describe('TenantOnboardingPage — rendering', () => {
  it('renders data-testid="tenant-onboarding-page"', () => {
    render(<TenantOnboardingPage />);
    expect(screen.getByTestId('tenant-onboarding-page')).toBeTruthy();
  });

  it('renders displayName, slug, companyName, primaryColor fields', () => {
    render(<TenantOnboardingPage />);
    expect(screen.getByTestId('onboarding-display-name')).toBeTruthy();
    expect(screen.getByTestId('onboarding-workspace-slug')).toBeTruthy();
    expect(screen.getByTestId('onboarding-company-name')).toBeTruthy();
    expect(screen.getByTestId('onboarding-primary-color-hex')).toBeTruthy();
  });

  it('renders Create workspace and Cancel buttons', () => {
    render(<TenantOnboardingPage onCancel={vi.fn()} />);
    expect(screen.getByTestId('onboarding-create-btn')).toBeTruthy();
    expect(screen.getByTestId('onboarding-cancel-btn')).toBeTruthy();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(<TenantOnboardingPage onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('onboarding-cancel-btn'));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('TenantOnboardingPage — slug preview', () => {
  it('auto-suggests slug from displayName', () => {
    render(<TenantOnboardingPage />);
    fireEvent.change(screen.getByTestId('onboarding-display-name'), {
      target: { value: 'British Gas Heating' },
    });
    const slugInput = screen.getByTestId('onboarding-workspace-slug') as HTMLInputElement;
    expect(slugInput.value).toBe('british-gas-heating');
  });

  it('shows "available" status for a valid unused slug', () => {
    render(<TenantOnboardingPage />);
    fillForm({ displayName: 'My Company', slug: 'my-company' });
    const status = screen.getByTestId('onboarding-slug-status');
    expect(status.textContent).toContain('Available');
  });

  it('shows "invalid" status for a reserved slug', () => {
    render(<TenantOnboardingPage />);
    fillForm({ displayName: 'Admin', slug: 'admin' });
    const status = screen.getByTestId('onboarding-slug-status');
    expect(status.textContent).toContain('Reserved or invalid');
  });

  it('shows "already exists" status for a duplicate slug', () => {
    // Pre-create a workspace to make 'my-company' taken.
    render(<TenantOnboardingPage />);
    fillForm({ displayName: 'My Company', slug: 'my-company', primaryColor: '#2563EB' });
    submitForm();

    // Re-render and try the same slug.
    clearStores(); // clear stores to avoid duplicate
    // Instead, simulate by creating the workspace first and then rendering a new page.
  });

  it('shows "already exists" after a workspace with that slug was created', () => {
    // First render — create the workspace.
    const { unmount } = render(<TenantOnboardingPage />);
    fillForm({ displayName: 'My Company', slug: 'my-company', primaryColor: '#2563EB' });
    submitForm();
    // Success panel shown.
    expect(screen.getByTestId('tenant-onboarding-success')).toBeTruthy();
    unmount();

    // Second render — same slug should show taken.
    render(<TenantOnboardingPage />);
    fillForm({ displayName: 'Another', slug: 'my-company' });
    const status = screen.getByTestId('onboarding-slug-status');
    expect(status.textContent).toContain('Already exists');
  });
});

describe('TenantOnboardingPage — creation', () => {
  it('shows success panel after valid form submission', () => {
    render(<TenantOnboardingPage />);
    fillForm({ displayName: 'Acme Heating', slug: 'acme-heating', primaryColor: '#FF0000' });
    submitForm();
    expect(screen.getByTestId('tenant-onboarding-success')).toBeTruthy();
  });

  it('success panel shows workspace name', () => {
    render(<TenantOnboardingPage />);
    fillForm({ displayName: 'Acme Heating', slug: 'acme-heating', primaryColor: '#FF0000' });
    submitForm();
    expect(screen.getByTestId('success-display-name').textContent).toBe('Acme Heating');
  });

  it('success panel shows workspace slug', () => {
    render(<TenantOnboardingPage />);
    fillForm({ displayName: 'Acme Heating', slug: 'acme-heating', primaryColor: '#FF0000' });
    submitForm();
    expect(screen.getByTestId('success-workspace-slug').textContent).toBe('acme-heating');
  });

  it('success panel shows company name', () => {
    render(<TenantOnboardingPage />);
    fillForm({
      displayName: 'Acme Heating',
      slug: 'acme-heating',
      companyName: 'Acme Ltd',
      primaryColor: '#FF0000',
    });
    submitForm();
    expect(screen.getByTestId('success-company-name').textContent).toBe('Acme Ltd');
  });

  it('success panel "Start visit in this workspace" calls onStartVisit', () => {
    const onStartVisit = vi.fn();
    render(<TenantOnboardingPage onStartVisit={onStartVisit} />);
    fillForm({ displayName: 'Acme Heating', slug: 'acme-heating', primaryColor: '#FF0000' });
    submitForm();
    fireEvent.click(screen.getByTestId('success-start-visit-btn'));
    expect(onStartVisit).toHaveBeenCalledWith('acme-heating');
  });

  it('success panel "Open workspace settings" calls onOpenWorkspaceSettings', () => {
    const onOpenWorkspaceSettings = vi.fn();
    render(<TenantOnboardingPage onOpenWorkspaceSettings={onOpenWorkspaceSettings} />);
    fillForm({ displayName: 'Acme Heating', slug: 'acme-heating', primaryColor: '#FF0000' });
    submitForm();
    fireEvent.click(screen.getByTestId('success-edit-branding-btn'));
    expect(onOpenWorkspaceSettings).toHaveBeenCalledOnce();
  });

  it('calls onCreated with the new workspaceSlug on success', () => {
    const onCreated = vi.fn();
    render(<TenantOnboardingPage onCreated={onCreated} />);
    fillForm({ displayName: 'Acme Heating', slug: 'acme-heating', primaryColor: '#FF0000' });
    submitForm();
    expect(onCreated).toHaveBeenCalledWith('acme-heating');
  });
});

describe('TenantOnboardingPage — validation errors', () => {
  it('shows an error when primaryColor hex is invalid', () => {
    render(<TenantOnboardingPage />);
    fillForm({ displayName: 'Test Co', slug: 'test-co', primaryColor: 'not-a-color' });
    submitForm();
    expect(screen.getByTestId('onboarding-error')).toBeTruthy();
    expect(screen.getByTestId('onboarding-error').textContent).toContain('hex');
  });

  it('shows an error when logoUrl is invalid', () => {
    render(<TenantOnboardingPage />);
    fillForm({ displayName: 'Test Co', slug: 'test-co2', primaryColor: '#2563EB' });
    fireEvent.change(screen.getByTestId('onboarding-logo-url'), {
      target: { value: 'not-a-url' },
    });
    submitForm();
    expect(screen.getByTestId('onboarding-error').textContent).toContain('Logo URL');
  });

  it('shows an error when website is invalid', () => {
    render(<TenantOnboardingPage />);
    fillForm({ displayName: 'Test Co', slug: 'test-co3', primaryColor: '#2563EB' });
    fireEvent.change(screen.getByTestId('onboarding-website'), {
      target: { value: 'not-a-url' },
    });
    submitForm();
    expect(screen.getByTestId('onboarding-error').textContent).toContain('Website URL');
  });
});
