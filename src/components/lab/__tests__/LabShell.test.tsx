/**
 * LabShell.test.tsx
 *
 * Validates that LabShell:
 *   - Renders the Simulator, Summary, and What if…? tabs
 *   - Does not render a Floor Plan tab
 *   - Does not render an Engineer/Customer mode toggle
 *   - Does not render a Behaviour Console tab
 *   - Does not render a Physics tab
 *   - Simulator tab is selected by default (simulation-first)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LabShell from '../LabShell';

describe('LabShell — tabs', () => {
  it('renders Simulator, Summary and What if…? tab buttons', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Simulator' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Summary' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'What if…?' })).toBeTruthy();
  });

  it('does not render a Floor Plan tab', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('tab', { name: 'Floor Plan' })).toBeNull();
  });

  it('does not render a Behaviour Console tab', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('tab', { name: 'Behaviour Console' })).toBeNull();
  });

  it('does not render a Physics tab', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('tab', { name: 'Physics' })).toBeNull();
  });

  it('marks Simulator tab as selected on initial render (simulation-first)', () => {
    render(<LabShell onHome={() => {}} />);
    const tab = screen.getByRole('tab', { name: 'Simulator' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });
});

describe('LabShell — no mode toggle', () => {
  it('does not render an Engineer mode button', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Engineer' })).toBeNull();
  });

  it('does not render a Customer mode button', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Customer' })).toBeNull();
  });
});

