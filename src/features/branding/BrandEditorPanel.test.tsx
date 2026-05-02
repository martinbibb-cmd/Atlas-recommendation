/**
 * src/features/branding/BrandEditorPanel.test.tsx
 *
 * Tests for the BrandEditorPanel component.
 *
 * Coverage:
 *   - renders all form fields
 *   - saves companyName / contact / theme / output settings
 *   - invalid colour blocks save
 *   - invalid URL blocks save
 *   - invalid email blocks save
 *   - empty companyName blocks save
 *   - reset removes stored override and calls onReset
 *   - preview renders changed company name
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrandEditorPanel } from './BrandEditorPanel';
import {
  loadStoredBrandProfiles,
  deleteStoredBrandProfile,
  BRAND_PROFILE_STORE_KEY,
} from './brandProfileStore';
import type { BrandProfileV1 } from './brandProfile';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearStore(): void {
  try { localStorage.removeItem(BRAND_PROFILE_STORE_KEY); } catch { /* unavailable */ }
}

const BASE_PROFILE: BrandProfileV1 = {
  version: '1.0',
  brandId: 'installer-demo',
  companyName: 'Demo Heating Co',
  theme: {
    primaryColor: '#16A34A',
    secondaryColor: '#15803D',
    accentColor: '#22C55E',
  },
  contact: {
    phone: '0800 123 4567',
    email: 'hello@demo-heating.co.uk',
    website: 'https://demo-heating.co.uk',
  },
  outputSettings: {
    showPricing: true,
    showCarbon: true,
    showInstallerContact: true,
    tone: 'friendly',
  },
};

function renderEditor(props?: Partial<React.ComponentProps<typeof BrandEditorPanel>>) {
  return render(<BrandEditorPanel profile={BASE_PROFILE} {...props} />);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearStore();
});

describe('BrandEditorPanel rendering', () => {
  it('renders company name input with current value', () => {
    renderEditor();
    const input = screen.getByTestId('brand-editor-company-name') as HTMLInputElement;
    expect(input.value).toBe('Demo Heating Co');
  });

  it('renders primary colour input', () => {
    renderEditor();
    expect(screen.getByTestId('brand-editor-primary-color')).toBeTruthy();
  });

  it('renders email input with current value', () => {
    renderEditor();
    const input = screen.getByTestId('brand-editor-email') as HTMLInputElement;
    expect(input.value).toBe('hello@demo-heating.co.uk');
  });

  it('renders tone selector', () => {
    renderEditor();
    const select = screen.getByTestId('brand-editor-tone') as HTMLSelectElement;
    expect(select.value).toBe('friendly');
  });

  it('renders showInstallerContact checkbox checked', () => {
    renderEditor();
    const cb = screen.getByTestId('brand-editor-show-installer-contact') as HTMLInputElement;
    expect(cb.checked).toBe(true);
  });

  it('renders Save branding button', () => {
    renderEditor();
    expect(screen.getByTestId('brand-editor-save-btn')).toBeTruthy();
  });

  it('renders Reset to default button', () => {
    renderEditor();
    expect(screen.getByTestId('brand-editor-reset-btn')).toBeTruthy();
  });
});

describe('BrandEditorPanel saving', () => {
  it('saves profile to store on submit with valid data', () => {
    const onSave = vi.fn();
    renderEditor({ onSave });
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    expect(onSave).toHaveBeenCalledOnce();
    const stored = loadStoredBrandProfiles();
    expect(stored['installer-demo']).toBeDefined();
  });

  it('saves updated companyName to store', () => {
    renderEditor();
    const input = screen.getByTestId('brand-editor-company-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Heating Ltd' } });
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    const stored = loadStoredBrandProfiles();
    expect(stored['installer-demo']?.companyName).toBe('New Heating Ltd');
  });

  it('saves updated tone', () => {
    renderEditor();
    const select = screen.getByTestId('brand-editor-tone') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'formal' } });
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    const stored = loadStoredBrandProfiles();
    expect(stored['installer-demo']?.outputSettings.tone).toBe('formal');
  });

  it('saves showPricing toggled off', () => {
    renderEditor();
    const cb = screen.getByTestId('brand-editor-show-pricing') as HTMLInputElement;
    // Click the checkbox to toggle it off (it starts checked).
    fireEvent.click(cb);
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    const stored = loadStoredBrandProfiles();
    expect(stored['installer-demo']?.outputSettings.showPricing).toBe(false);
  });

  it('shows saved notice after successful save', () => {
    renderEditor();
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    expect(screen.getByTestId('brand-editor-saved-notice')).toBeTruthy();
  });
});

describe('BrandEditorPanel validation', () => {
  it('blocks save when companyName is empty', () => {
    const onSave = vi.fn();
    renderEditor({ onSave });
    const input = screen.getByTestId('brand-editor-company-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('blocks save when primaryColor is not a valid hex', () => {
    const onSave = vi.fn();
    renderEditor({ onSave });
    const input = screen.getByTestId('brand-editor-primary-color') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not-a-colour' } });
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('blocks save when website does not start with http', () => {
    const onSave = vi.fn();
    renderEditor({ onSave });
    const input = screen.getByTestId('brand-editor-website') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'demo-heating.co.uk' } });
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('blocks save when email is not email-like', () => {
    const onSave = vi.fn();
    renderEditor({ onSave });
    const input = screen.getByTestId('brand-editor-email') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('blocks save when logoUrl does not start with http', () => {
    const onSave = vi.fn();
    renderEditor({ onSave });
    const input = screen.getByTestId('brand-editor-logo-url') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'ftp://bad-url.com/logo.png' } });
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('allows empty optional colour fields', () => {
    const onSave = vi.fn();
    renderEditor({ onSave });
    const secondary = screen.getByTestId('brand-editor-secondary-color') as HTMLInputElement;
    fireEvent.change(secondary, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    expect(onSave).toHaveBeenCalledOnce();
  });
});

describe('BrandEditorPanel reset', () => {
  it('calls onReset when reset button is clicked', () => {
    const onReset = vi.fn();
    renderEditor({ onReset });
    fireEvent.click(screen.getByTestId('brand-editor-reset-btn'));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('removes stored override on reset', () => {
    renderEditor();
    // First save a custom value.
    const input = screen.getByTestId('brand-editor-company-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Custom Name' } });
    fireEvent.click(screen.getByTestId('brand-editor-save-btn'));
    expect(loadStoredBrandProfiles()['installer-demo']).toBeDefined();
    // Reset.
    fireEvent.click(screen.getByTestId('brand-editor-reset-btn'));
    expect(loadStoredBrandProfiles()['installer-demo']).toBeUndefined();
  });
});

describe('BrandEditorPanel preview', () => {
  it('calls onPreview with the current form data', () => {
    const onPreview = vi.fn();
    renderEditor({ onPreview });
    const input = screen.getByTestId('brand-editor-company-name') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Preview Co' } });
    fireEvent.click(screen.getByTestId('brand-editor-preview-btn'));
    expect(onPreview).toHaveBeenCalledOnce();
    const called: BrandProfileV1 = onPreview.mock.calls[0][0];
    expect(called.companyName).toBe('Preview Co');
  });

  it('does not show preview button when onPreview is not provided', () => {
    renderEditor();
    expect(screen.queryByTestId('brand-editor-preview-btn')).toBeNull();
  });
});
