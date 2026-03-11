/**
 * LabConfidenceStrip.test.tsx
 *
 * Validates that LabConfidenceStrip:
 *   - Renders the "Confidence drivers" heading
 *   - Shows all four group labels when all groups have content
 *   - Renders each item in the measured, inferred, and missing lists
 *   - Renders the next-step text when provided
 *   - Omits a group entirely when its array is empty
 *   - Omits the "Next best step" group when nextStep is undefined
 *   - Applies the correct aria-label to the container
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LabConfidenceStrip from '../LabConfidenceStrip';
import type { ConfidenceStripData } from '../LabConfidenceStrip';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeData(overrides: Partial<ConfidenceStripData> = {}): ConfidenceStripData {
  return {
    measured: ['Current system type', 'Occupancy count'],
    inferred: ['DHW demand (from occupancy pattern)', 'Cylinder suitability baseline'],
    missing:  ['Emitter output verification', 'Flow temperature confirmation'],
    nextStep: 'Complete a Full Survey to confirm compatibility.',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('LabConfidenceStrip — structure', () => {
  it('renders the "Confidence drivers" heading', () => {
    render(<LabConfidenceStrip data={makeData()} />);
    expect(screen.getByText('Confidence drivers')).toBeTruthy();
  });

  it('has the correct aria-label on the container', () => {
    const { container } = render(<LabConfidenceStrip data={makeData()} />);
    const el = container.querySelector('[aria-label="Confidence drivers"]');
    expect(el).toBeTruthy();
  });

  it('renders all four group labels when all groups are populated', () => {
    render(<LabConfidenceStrip data={makeData()} />);
    expect(screen.getByText('Measured')).toBeTruthy();
    expect(screen.getByText('Inferred')).toBeTruthy();
    expect(screen.getByText('Missing')).toBeTruthy();
    expect(screen.getByText('Next best step')).toBeTruthy();
  });
});

describe('LabConfidenceStrip — measured group', () => {
  it('renders each measured item', () => {
    render(<LabConfidenceStrip data={makeData()} />);
    expect(screen.getByText('Current system type')).toBeTruthy();
    expect(screen.getByText('Occupancy count')).toBeTruthy();
  });

  it('omits the Measured group when measured array is empty', () => {
    render(<LabConfidenceStrip data={makeData({ measured: [] })} />);
    expect(screen.queryByText('Measured')).toBeNull();
  });
});

describe('LabConfidenceStrip — inferred group', () => {
  it('renders each inferred item', () => {
    render(<LabConfidenceStrip data={makeData()} />);
    expect(screen.getByText('DHW demand (from occupancy pattern)')).toBeTruthy();
    expect(screen.getByText('Cylinder suitability baseline')).toBeTruthy();
  });

  it('omits the Inferred group when inferred array is empty', () => {
    render(<LabConfidenceStrip data={makeData({ inferred: [] })} />);
    expect(screen.queryByText('Inferred')).toBeNull();
  });
});

describe('LabConfidenceStrip — missing group', () => {
  it('renders each missing item', () => {
    render(<LabConfidenceStrip data={makeData()} />);
    expect(screen.getByText('Emitter output verification')).toBeTruthy();
    expect(screen.getByText('Flow temperature confirmation')).toBeTruthy();
  });

  it('omits the Missing group when missing array is empty', () => {
    render(<LabConfidenceStrip data={makeData({ missing: [] })} />);
    expect(screen.queryByText('Missing')).toBeNull();
  });
});

describe('LabConfidenceStrip — next best step', () => {
  it('renders the next-step text when provided', () => {
    render(<LabConfidenceStrip data={makeData()} />);
    expect(screen.getByText('Complete a Full Survey to confirm compatibility.')).toBeTruthy();
  });

  it('omits the "Next best step" group when nextStep is undefined', () => {
    render(<LabConfidenceStrip data={makeData({ nextStep: undefined })} />);
    expect(screen.queryByText('Next best step')).toBeNull();
  });
});
