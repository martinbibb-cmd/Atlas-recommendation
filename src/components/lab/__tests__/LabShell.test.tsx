/**
 * LabShell.test.tsx
 *
 * Validates that LabShell:
 *   - Renders the Behaviour Preview, Summary, What if…?, and Physics Explainers tabs
 *   - Does not render a Floor Plan tab
 *   - Does not render an Engineer/Customer mode toggle
 *   - Does not render a Behaviour Console tab
 *   - Does not render a Physics tab
 *   - Behaviour Preview tab is selected by default (simulation-first)
 *   - Physics Explainers tab shows the explainer panel heading when clicked
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LabShell from '../LabShell';

describe('LabShell — tabs', () => {
  it('renders Behaviour Preview, Summary, What if…? and Physics Explainers tab buttons', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Behaviour Preview' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Summary' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'What if…?' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Physics Explainers' })).toBeTruthy();
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

  it('does not render a Simulator tab', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('tab', { name: 'Simulator' })).toBeNull();
  });

  it('marks Behaviour Preview tab as selected on initial render (simulation-first)', () => {
    render(<LabShell onHome={() => {}} />);
    const tab = screen.getByRole('tab', { name: 'Behaviour Preview' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });

  it('shows the Physics Explainers heading when the Explainers tab is clicked', () => {
    render(<LabShell onHome={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Physics Explainers' }));
    expect(screen.getByRole('heading', { name: /physics explainers/i })).toBeTruthy();
  });

  it('marks the Physics Explainers tab as selected after clicking it', () => {
    render(<LabShell onHome={() => {}} />);
    const tab = screen.getByRole('tab', { name: 'Physics Explainers' });
    fireEvent.click(tab);
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });

  it('deselects the Behaviour Preview tab when Explainers tab is activated', () => {
    render(<LabShell onHome={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Physics Explainers' }));
    const previewTab = screen.getByRole('tab', { name: 'Behaviour Preview' });
    expect(previewTab.getAttribute('aria-selected')).toBe('false');
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

