/**
 * ResetSessionButton.test.tsx
 *
 * Tests for the in-app PWA cache reset control.
 *
 * Coverage:
 *   - Trigger button renders with correct label and test-id
 *   - Confirm dialog is hidden initially
 *   - Confirm dialog opens on button click
 *   - Cancel closes the dialog without clearing cache
 *   - clearAtlasCache is called on confirm
 *   - Dialog has accessible role="dialog"
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ResetSessionButton } from '../ResetSessionButton';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const clearAtlasCacheMock = vi.fn();
vi.mock('../../lib/storage/atlasCacheKeys', () => ({
  clearAtlasCache: () => clearAtlasCacheMock(),
}));

// Mock window.location.replace so tests don't navigate
const replaceMock = vi.fn();
Object.defineProperty(window, 'location', {
  value: { ...window.location, replace: replaceMock, pathname: '/' },
  writable: true,
});

// Suppress navigator.serviceWorker not being available in jsdom
Object.defineProperty(navigator, 'serviceWorker', {
  value: undefined,
  writable: true,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ResetSessionButton', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the reset button', () => {
    render(<ResetSessionButton />);
    expect(screen.getByTestId('reset-session-button')).toBeTruthy();
    expect(screen.getByText('Reset saved session')).toBeTruthy();
  });

  it('does not show the confirm dialog initially', () => {
    render(<ResetSessionButton />);
    expect(screen.queryByTestId('reset-session-dialog')).toBeNull();
  });

  it('opens the confirm dialog when the button is clicked', () => {
    render(<ResetSessionButton />);
    fireEvent.click(screen.getByTestId('reset-session-button'));
    expect(screen.getByTestId('reset-session-dialog')).toBeTruthy();
    expect(screen.getByText('Clear saved data?')).toBeTruthy();
  });

  it('shows the safety warning in the dialog body', () => {
    render(<ResetSessionButton />);
    fireEvent.click(screen.getByTestId('reset-session-button'));
    const dialog = screen.getByTestId('reset-session-dialog');
    expect(dialog.textContent).toContain('This clears saved Atlas survey/session data on this device');
    expect(dialog.textContent).toContain('will not delete anything already submitted');
  });

  it('closes the dialog when Cancel is clicked', () => {
    render(<ResetSessionButton />);
    fireEvent.click(screen.getByTestId('reset-session-button'));
    expect(screen.getByTestId('reset-session-dialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('reset-session-cancel'));
    expect(screen.queryByTestId('reset-session-dialog')).toBeNull();
  });

  it('calls clearAtlasCache when confirmed', async () => {
    render(<ResetSessionButton />);
    fireEvent.click(screen.getByTestId('reset-session-button'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('reset-session-confirm'));
    });
    expect(clearAtlasCacheMock).toHaveBeenCalledOnce();
  });

  it('calls window.location.replace after clearing', async () => {
    render(<ResetSessionButton />);
    fireEvent.click(screen.getByTestId('reset-session-button'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('reset-session-confirm'));
    });
    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  it('has role="dialog" on the confirm dialog for accessibility', () => {
    render(<ResetSessionButton />);
    fireEvent.click(screen.getByTestId('reset-session-button'));
    const dialog = screen.getByTestId('reset-session-dialog');
    expect(dialog.getAttribute('role')).toBe('dialog');
  });

  it('accepts a custom className for the trigger button', () => {
    render(<ResetSessionButton className="my-custom-class" />);
    const btn = screen.getByTestId('reset-session-button');
    expect(btn.classList.contains('my-custom-class')).toBe(true);
  });
});
