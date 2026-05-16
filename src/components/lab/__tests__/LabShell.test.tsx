/**
 * LabShell.test.tsx
 *
 * Validates that LabShell renders the house-first Real Simulator UI:
 *   - Shows the "System Simulator" heading
 *   - Shows the Setup, Engineering, and Warnings action buttons
 *   - Shows the house simulator surface (house stage)
 *   - Does NOT render old scroll-heavy tab buttons
 *   - Left slide-over opens when Setup button is clicked
 *   - Right slide-over opens when Engineering button is clicked
 *   - Warnings top sheet opens when Warnings button is clicked
 */

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LabShell from '../LabShell';

describe('LabShell — house-first heading and actions', () => {
  it('renders the System Simulator heading', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.getByRole('heading', { name: /system simulator/i })).toBeTruthy();
  });

  it('renders the Setup action button', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.getByRole('button', { name: /setup/i })).toBeTruthy();
  });

  it('renders the Engineering action button', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.getByRole('button', { name: /engineering/i })).toBeTruthy();
  });

  it('renders the Warnings action button', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.getByRole('button', { name: /warnings/i })).toBeTruthy();
  });
});

describe('LabShell — no old tab interface', () => {
  it('does not render a "Behaviour Preview" tab button', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('tab', { name: 'Behaviour Preview' })).toBeNull();
  });

  it('does not render a "Summary" tab button', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('tab', { name: 'Summary' })).toBeNull();
  });

  it('does not render a "What if…?" tab button', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('tab', { name: 'What if…?' })).toBeNull();
  });

  it('does not render a "Physics Explainers" tab button', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('tab', { name: 'Physics Explainers' })).toBeNull();
  });

  it('does not render an Engineer mode button', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Engineer' })).toBeNull();
  });

  it('does not render a Customer mode button', () => {
    render(<LabShell onHome={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Customer' })).toBeNull();
  });
});

describe('LabShell — house simulator surface', () => {
  it('renders the house simulator surface', () => {
    render(<LabShell onHome={() => {}} />);
    const stage = document.querySelector('.lab-house-stage');
    expect(stage).toBeTruthy();
  });

  it('renders the house canvas', () => {
    render(<LabShell onHome={() => {}} />);
    const canvas = document.querySelector('.lab-house-canvas');
    expect(canvas).toBeTruthy();
  });
});

describe('LabShell — slide-overs and sheets', () => {
  it('left slide-over opens when Setup is clicked', () => {
    render(<LabShell onHome={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /setup/i }));
    expect(screen.getByRole('region', { name: /setup and configuration/i })).toBeTruthy();
  });

  it('right slide-over opens when Engineering is clicked', () => {
    render(<LabShell onHome={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /engineering/i }));
    expect(screen.getByRole('region', { name: /engineering and efficiency detail/i })).toBeTruthy();
  });

  it('top sheet opens when Warnings is clicked', () => {
    render(<LabShell onHome={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /warnings/i }));
    expect(screen.getByRole('region', { name: /warnings and physics explainers/i })).toBeTruthy();
  });

  it('Setup slide-over closes when Close is clicked inside it', () => {
    render(<LabShell onHome={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /setup/i }));
    const panel = screen.getByRole('region', { name: /setup and configuration/i });
    const closeBtn = panel.querySelector('button');
    if (closeBtn) fireEvent.click(closeBtn);
    expect(screen.queryByRole('region', { name: /setup and configuration/i })).toBeNull();
  });
});

