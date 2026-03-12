/**
 * LabShell.test.tsx
 *
 * Validates that LabShell:
 *   - Renders the three tabs: Summary, What if…?, Visual
 *   - Does not render a Behaviour Console tab
 *   - Does not render a Physics tab
 *   - Other tabs still function normally
 *   - PR 2: Renders the Engineer/Customer mode toggle
 *   - PR 2: Engineer mode is default; Customer mode toggle updates state
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UiModeContext } from '../../../context/UiModeContext';
import { useState } from 'react';
import type { UiMode } from '../../../context/UiModeContext';
import LabShell from '../LabShell';

/** Wraps LabShell in a real UiModeContext provider so toggle state is reactive. */
function LabShellWithProvider() {
  const [uiMode, setUiMode] = useState<UiMode>('engineer');
  return (
    <UiModeContext.Provider value={{ uiMode, setUiMode }}>
      <LabShell onHome={() => {}} />
    </UiModeContext.Provider>
  );
}

describe('LabShell — tabs', () => {
  it('renders all three tab buttons', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Summary' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'What if…?' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Visual' })).toBeTruthy();
  });

  it('does not render a Behaviour Console tab', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('tab', { name: 'Behaviour Console' })).toBeNull();
  });

  it('does not render a Physics tab', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('tab', { name: 'Physics' })).toBeNull();
  });

  it('marks Summary tab as selected on initial render', () => {
    render(<LabShell onHome={() => {}} />);
    const tab = screen.getByRole('tab', { name: 'Summary' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });
});

describe('LabShell — PR 2 mode toggle', () => {
  it('renders Engineer and Customer mode buttons', () => {
    render(<LabShellWithProvider />);
    expect(screen.getByRole('button', { name: 'Engineer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Customer' })).toBeTruthy();
  });

  it('has Engineer mode active (aria-pressed) by default', () => {
    render(<LabShellWithProvider />);
    const engineerBtn = screen.getByRole('button', { name: 'Engineer' });
    const customerBtn = screen.getByRole('button', { name: 'Customer' });
    expect(engineerBtn.getAttribute('aria-pressed')).toBe('true');
    expect(customerBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('switches to Customer mode when Customer button is clicked', () => {
    render(<LabShellWithProvider />);
    fireEvent.click(screen.getByRole('button', { name: 'Customer' }));
    expect(screen.getByRole('button', { name: 'Customer' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Engineer' }).getAttribute('aria-pressed')).toBe('false');
  });
});

