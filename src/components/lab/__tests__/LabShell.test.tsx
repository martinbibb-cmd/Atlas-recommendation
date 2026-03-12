/**
 * LabShell.test.tsx
 *
 * Validates that LabShell:
 *   - Renders the four tabs: Summary, Physics, Visual, Behaviour Console
 *   - Activates the "Behaviour Console" tab on click
 *   - The "Behaviour Console" tab exposes the "What if…?" ScenarioControls panel
 *   - The "What if…?" heading is visible after switching to the console tab
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LabShell from '../LabShell';

describe('LabShell — tabs', () => {
  it('renders all four tab buttons', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Summary' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Physics' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Visual' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Behaviour Console' })).toBeTruthy();
  });

  it('does not show Behaviour Console content on initial render (Summary is default)', () => {
    render(<LabShell onHome={() => {}} />);
    // "What if…?" heading should not be present until the console tab is selected
    expect(screen.queryByText('What if…?')).toBeNull();
  });

  it('shows the "What if…?" controls after clicking the Behaviour Console tab', () => {
    render(<LabShell onHome={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Behaviour Console' }));
    expect(screen.getByText('What if…?')).toBeTruthy();
  });

  it('marks Behaviour Console tab as selected after click', () => {
    render(<LabShell onHome={() => {}} />);
    const tab = screen.getByRole('tab', { name: 'Behaviour Console' });
    fireEvent.click(tab);
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });
});
