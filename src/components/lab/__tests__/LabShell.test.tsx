/**
 * LabShell.test.tsx
 *
 * Validates that LabShell renders the house-first simulator UI:
 *   - Shows the house simulator canvas as the primary interaction surface
 *   - No tab bar rendered (house-first removes the tab navigation)
 *   - Setup, Engineering, and Warnings action buttons exist
 *   - No Engineer/Customer mode toggle
 *   - No Floor Plan, Behaviour Console, or Physics tabs
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LabShell from '../LabShell';

describe('LabShell — house-first canvas', () => {
  it('renders the house simulator canvas as the primary surface', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.getByTestId('house-simulator-canvas')).toBeTruthy();
  });

  it('renders Setup, Engineering, and Warnings action buttons', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.getByRole('button', { name: /setup/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /engineering/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /warnings/i })).toBeTruthy();
  });

  it('does not render a tab bar (tabs removed in house-first refactor)', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('tab')).toBeNull();
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

  it('opens the Engineering slide-over when Engineering button is clicked', () => {
    render(<LabShell onHome={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /engineering/i }));
    expect(screen.getByRole('region', { name: /engineering and efficiency detail/i })).toBeTruthy();
  });

  it('opens the Warnings top sheet when Warnings button is clicked', () => {
    render(<LabShell onHome={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /warnings/i }));
    expect(screen.getByRole('region', { name: /warnings and explainers/i })).toBeTruthy();
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

