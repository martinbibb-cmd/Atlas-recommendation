/**
 * YouWeGetTriple.test.tsx
 *
 * Verifies:
 *   - Renders the three column headers correctly.
 *   - Renders each row's three cells.
 *   - Alt-row class applied to odd rows.
 *   - Empty rows array renders only headers.
 *   - No technical jargon (ΔT, L/min, etc.) in rendered output.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import YouWeGetTriple from '../YouWeGetTriple';
import type { YouWeGetTripleData } from '../insightPack.types';

const SAMPLE_DATA: YouWeGetTripleData = {
  rows: [
    {
      youToldUs: 'Your boiler is 14 years old.',
      wereDoing: 'Replacing it with a high-efficiency condensing boiler.',
      soYouGet:  'Lower energy bills and a more reliable heating system.',
    },
    {
      youToldUs: '4 people live in your home.',
      wereDoing: "Sizing the system to match your household's peak demand.",
      soYouGet:  'Enough hot water and heating for everyone.',
    },
  ],
};

describe('YouWeGetTriple', () => {
  it('renders the three column headers', () => {
    render(<YouWeGetTriple data={SAMPLE_DATA} />);
    expect(screen.getByText('You told us')).toBeTruthy();
    expect(screen.getByText("We're doing")).toBeTruthy();
    expect(screen.getByText('So you get')).toBeTruthy();
  });

  it('renders all row cells', () => {
    render(<YouWeGetTriple data={SAMPLE_DATA} />);
    expect(screen.getByText('Your boiler is 14 years old.')).toBeTruthy();
    expect(screen.getByText('Replacing it with a high-efficiency condensing boiler.')).toBeTruthy();
    expect(screen.getByText('Lower energy bills and a more reliable heating system.')).toBeTruthy();
    expect(screen.getByText('4 people live in your home.')).toBeTruthy();
  });

  it('renders data-testid="you-we-get-triple"', () => {
    render(<YouWeGetTriple data={SAMPLE_DATA} />);
    expect(screen.getByTestId('you-we-get-triple')).toBeTruthy();
  });

  it('applies alt-row class to odd index rows', () => {
    render(<YouWeGetTriple data={SAMPLE_DATA} />);
    const rows = screen.getByTestId('you-we-get-triple').querySelectorAll('.ywg-triple__row');
    expect(rows.length).toBe(2);
    expect(rows[0].classList.contains('ywg-triple__row--alt')).toBe(false);
    expect(rows[1].classList.contains('ywg-triple__row--alt')).toBe(true);
  });

  it('renders nothing problematic for empty rows', () => {
    render(<YouWeGetTriple data={{ rows: [] }} />);
    const triple = screen.getByTestId('you-we-get-triple');
    const rows = triple.querySelectorAll('.ywg-triple__row');
    expect(rows.length).toBe(0);
  });

  it('contains no technical jargon in rendered output', () => {
    render(<YouWeGetTriple data={SAMPLE_DATA} />);
    const text = screen.getByTestId('you-we-get-triple').textContent ?? '';
    expect(text).not.toContain('ΔT');
    expect(text.toLowerCase()).not.toContain('l/min');
    expect(text.toLowerCase()).not.toContain('throughput-limited');
    expect(text.toLowerCase()).not.toContain('dynamic under load');
  });
});
