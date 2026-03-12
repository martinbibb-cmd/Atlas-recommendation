/**
 * ControlsVisual.test.tsx
 *
 * Tests verify:
 *   - The ControlsVisual renders without errors
 *   - It contains the expected section labels
 *   - It has an accessible aria-label
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ControlsVisual from '../visuals/ControlsVisual';

describe('ControlsVisual — rendering', () => {
  it('renders without errors', () => {
    render(<ControlsVisual />);
    expect(screen.getByLabelText(/Fixed higher flow vs lower steadier running/i)).toBeTruthy();
  });

  it('shows the before (fixed higher flow) section label', () => {
    render(<ControlsVisual />);
    expect(screen.getByText(/Fixed higher flow/)).toBeTruthy();
  });

  it('shows the after (lower, steadier flow) section label', () => {
    render(<ControlsVisual />);
    expect(screen.getByText(/Lower, steadier flow/)).toBeTruthy();
  });

  it('shows the condensing badge', () => {
    render(<ControlsVisual />);
    expect(screen.getByText(/Less cycling/)).toBeTruthy();
  });

  it('shows the caption', () => {
    render(<ControlsVisual />);
    expect(screen.getByText(/Correct boiler control setup/)).toBeTruthy();
  });
});
