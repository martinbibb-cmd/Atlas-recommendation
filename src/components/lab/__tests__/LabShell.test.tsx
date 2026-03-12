/**
 * LabShell.test.tsx
 *
 * Validates that LabShell:
 *   - Renders the three tabs: Summary, Physics, Visual
 *   - Does not render a Behaviour Console tab
 *   - Other tabs still function normally
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LabShell from '../LabShell';

describe('LabShell — tabs', () => {
  it('renders all three tab buttons', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.getByRole('tab', { name: 'Summary' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Physics' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Visual' })).toBeTruthy();
  });

  it('does not render a Behaviour Console tab', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('tab', { name: 'Behaviour Console' })).toBeNull();
  });

  it('marks Summary tab as selected on initial render', () => {
    render(<LabShell onHome={() => {}} />);
    const tab = screen.getByRole('tab', { name: 'Summary' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });
});
