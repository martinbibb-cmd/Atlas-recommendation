import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { ReadingPreferencesProvider } from '../ReadingPreferencesProvider';
import { ReadingAssistOverlay } from '../../readingAssist/ReadingAssistOverlay';
import { ReadingPreferencesLauncher } from '../ReadingPreferencesLauncher';
import { DEFAULT_READING_PREFERENCES_V1 } from '../ReadingPreferencesV1';

function renderWithProvider(ui: React.ReactNode) {
  return render(<ReadingPreferencesProvider>{ui}</ReadingPreferencesProvider>);
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  // Reset html attributes set by the provider
  document.documentElement.removeAttribute('data-atlas-reading-enabled');
  document.documentElement.removeAttribute('data-atlas-reading-ruler-enabled');
});

describe('ReadingPreferences — ruler disabled by default', () => {
  it('ruler is disabled in default profile', () => {
    expect(DEFAULT_READING_PREFERENCES_V1.readingRulerEnabled).toBe(false);
  });

  it('data-atlas-reading-ruler-enabled is false when reading mode is off', () => {
    renderWithProvider(<ReadingPreferencesLauncher />);
    expect(document.documentElement.getAttribute('data-atlas-reading-ruler-enabled')).toBe('false');
  });

  it('data-atlas-reading-ruler-enabled is false even when enabled but ruler not toggled', () => {
    renderWithProvider(<ReadingPreferencesLauncher />);
    // Open panel and enable reading mode
    fireEvent.click(screen.getByText('Reading preferences'));
    fireEvent.click(screen.getByLabelText(/Focus reading mode/i) ?? screen.getByRole('checkbox', { name: /Focus reading mode/i }));
    expect(document.documentElement.getAttribute('data-atlas-reading-ruler-enabled')).toBe('false');
  });

  it('data-atlas-reading-ruler-enabled is true only when both enabled and ruler toggled on', () => {
    renderWithProvider(<ReadingPreferencesLauncher />);
    fireEvent.click(screen.getByText('Reading preferences'));
    // Enable focus reading mode
    const focusCheckbox = screen.getByRole('checkbox', { name: /Focus reading mode/i });
    fireEvent.click(focusCheckbox);
    // Enable ruler
    const rulerCheckbox = screen.getByRole('checkbox', { name: /Reading ruler/i });
    fireEvent.click(rulerCheckbox);
    expect(document.documentElement.getAttribute('data-atlas-reading-ruler-enabled')).toBe('true');
  });
});

describe('ReadingPreferences — ruler scoped, not viewport-fixed', () => {
  it('provider does not render a viewport-fixed atlas-reading-ruler element', () => {
    renderWithProvider(<ReadingPreferencesLauncher />);
    // Open panel, enable both reading mode and ruler
    fireEvent.click(screen.getByText('Reading preferences'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Focus reading mode/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Reading ruler/i }));
    // The old viewport-fixed div must not exist
    expect(document.querySelector('.atlas-reading-ruler')).toBeNull();
  });
});

describe('ReadingPreferences — launcher placement', () => {
  it('launcher does not use position:fixed by default (no rp-launcher--fixed class)', () => {
    renderWithProvider(<ReadingPreferencesLauncher />);
    const launcher = screen.getByTestId('reading-preferences-launcher');
    expect(launcher.classList.contains('rp-launcher--fixed')).toBe(false);
  });
});

describe('ReadingPreferences — reset', () => {
  it('reset reading preferences restores defaults', () => {
    renderWithProvider(<ReadingPreferencesLauncher />);
    fireEvent.click(screen.getByText('Reading preferences'));
    // Change font scale
    const fontScaleInput = screen.getByRole('slider', { name: /Text scale/i });
    fireEvent.change(fontScaleInput, { target: { value: '1.3' } });
    expect(fontScaleInput).toHaveValue('1.3');
    // Reset
    fireEvent.click(screen.getByText('Reset reading preferences'));
    expect(screen.getByRole('slider', { name: /Text scale/i })).toHaveValue(String(DEFAULT_READING_PREFERENCES_V1.fontScale));
  });
});

describe('ReadingPreferences — fontScale token applied on reading surface', () => {
  it('sets --atlas-reading-font-scale CSS variable when profile changes', () => {
    renderWithProvider(<ReadingPreferencesLauncher />);
    fireEvent.click(screen.getByText('Reading preferences'));
    const fontScaleInput = screen.getByRole('slider', { name: /Text scale/i });
    act(() => {
      fireEvent.change(fontScaleInput, { target: { value: '1.2' } });
    });
    const scale = document.documentElement.style.getPropertyValue('--atlas-reading-font-scale');
    expect(scale).toBe('1.2');
  });
});

describe('ReadingPreferences — hide ruler control', () => {
  it('shows "Hide ruler" button when ruler is enabled', () => {
    renderWithProvider(<ReadingPreferencesLauncher />);
    fireEvent.click(screen.getByText('Reading preferences'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Focus reading mode/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Reading ruler/i }));
    expect(screen.getByText('Hide ruler')).toBeTruthy();
  });

  it('clicking Hide ruler disables the ruler', () => {
    renderWithProvider(<ReadingPreferencesLauncher />);
    fireEvent.click(screen.getByText('Reading preferences'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Focus reading mode/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Reading ruler/i }));
    expect(document.documentElement.getAttribute('data-atlas-reading-ruler-enabled')).toBe('true');
    fireEvent.click(screen.getByText('Hide ruler'));
    expect(document.documentElement.getAttribute('data-atlas-reading-ruler-enabled')).toBe('false');
  });
});


describe('ReadingPreferences — text-anchored overlay', () => {
  it('renders a reading assist overlay for active reading regions when enabled', async () => {
    renderWithProvider(
      <>
        <ReadingPreferencesLauncher />
        <div className="atlas-reading-surface">
          <ReadingAssistOverlay />
          <p data-reading-region="true">Atlas recommendation paragraph</p>
        </div>
      </>,
    );
    fireEvent.click(screen.getByText('Reading preferences'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Focus reading mode/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Reading ruler/i }));
    await waitFor(() => expect(screen.getByTestId('reading-assist-overlay')).toBeTruthy());
  });
});

