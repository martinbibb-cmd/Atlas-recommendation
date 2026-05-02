/**
 * src/features/tenants/WorkspaceSelector.test.tsx
 *
 * Tests for the WorkspaceSelector component.
 *
 * Coverage:
 *   - renders a combobox with built-in workspace options
 *   - selecting a different workspace calls onChange with the new slug
 *   - disabled prop disables the select
 *   - value prop controls the selected option
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspaceSelector } from './WorkspaceSelector';
import { TENANT_STORE_KEY } from './tenantStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clearStore(): void {
  try {
    localStorage.removeItem(TENANT_STORE_KEY);
  } catch {
    // unavailable
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearStore();
  vi.clearAllMocks();
});

describe('WorkspaceSelector — rendering', () => {
  it('renders a combobox', () => {
    render(<WorkspaceSelector value="atlas" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeTruthy();
  });

  it('includes the atlas workspace option', () => {
    render(<WorkspaceSelector value="atlas" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('atlas');
  });

  it('includes the demo-heating workspace option', () => {
    render(<WorkspaceSelector value="atlas" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('demo-heating');
  });

  it('reflects the value prop as the selected option', () => {
    render(<WorkspaceSelector value="demo-heating" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('demo-heating');
  });

  it('displays displayName and workspaceSlug in each option', () => {
    render(<WorkspaceSelector value="atlas" onChange={vi.fn()} />);
    // "Atlas (atlas)" should appear somewhere in the text
    expect(screen.getByText(/Atlas \(atlas\)/)).toBeTruthy();
  });
});

describe('WorkspaceSelector — interaction', () => {
  it('calls onChange with the selected workspaceSlug', () => {
    const onChange = vi.fn();
    render(<WorkspaceSelector value="atlas" onChange={onChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'demo-heating' } });
    expect(onChange).toHaveBeenCalledWith('demo-heating');
  });

  it('calls onChange with atlas when atlas option is selected', () => {
    const onChange = vi.fn();
    render(<WorkspaceSelector value="demo-heating" onChange={onChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'atlas' } });
    expect(onChange).toHaveBeenCalledWith('atlas');
  });
});

describe('WorkspaceSelector — disabled state', () => {
  it('disables the select when disabled prop is true', () => {
    render(<WorkspaceSelector value="atlas" onChange={vi.fn()} disabled />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });

  it('enables the select when disabled prop is false', () => {
    render(<WorkspaceSelector value="atlas" onChange={vi.fn()} disabled={false} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(false);
  });
});
