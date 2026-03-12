/**
 * VerdictCard.test.tsx
 *
 * Tests verify:
 *   - renders verdict title, status badge, reason, confidence
 *   - renders "No verdict available" when no verdict passed
 *   - does not render delta when baseVerdict is absent
 *   - does not render delta when baseVerdict has same status
 *   - renders delta line when baseVerdict status differs from current verdict
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import VerdictCard from '../VerdictCard';
import type { VerdictV1 } from '../../../contracts/EngineOutputV1';

function makeVerdict(status: VerdictV1['status']): VerdictV1 {
  return {
    title: `${status} system`,
    status,
    reasons: [`Reason for ${status}`],
    confidence: { level: 'medium', reasons: [] },
    assumptionsUsed: [],
  };
}

describe('VerdictCard — basic rendering', () => {
  it('renders "No verdict available" when no verdict passed', () => {
    render(<VerdictCard />);
    expect(screen.getByText('No verdict available')).toBeTruthy();
  });

  it('renders verdict title', () => {
    render(<VerdictCard verdict={makeVerdict('good')} />);
    expect(screen.getByText('good system')).toBeTruthy();
  });

  it('renders first reason', () => {
    render(<VerdictCard verdict={makeVerdict('caution')} />);
    expect(screen.getByText('Reason for caution')).toBeTruthy();
  });

  it('renders confidence label', () => {
    render(<VerdictCard verdict={makeVerdict('good')} />);
    expect(screen.getByText('Medium confidence')).toBeTruthy();
  });
});

describe('VerdictCard — compared with base delta', () => {
  it('does not render delta when baseVerdict is absent', () => {
    render(<VerdictCard verdict={makeVerdict('caution')} />);
    expect(screen.queryByText(/compared with base/i)).toBeNull();
  });

  it('does not render delta when base and current status are the same', () => {
    render(
      <VerdictCard
        verdict={makeVerdict('good')}
        baseVerdict={makeVerdict('good')}
      />,
    );
    expect(screen.queryByText(/compared with base/i)).toBeNull();
  });

  it('renders delta line when status changes from good to caution', () => {
    render(
      <VerdictCard
        verdict={makeVerdict('caution')}
        baseVerdict={makeVerdict('good')}
      />,
    );
    expect(screen.getByText(/compared with base: recommended → caution/i)).toBeTruthy();
  });

  it('renders delta line when status changes from good to fail', () => {
    render(
      <VerdictCard
        verdict={makeVerdict('fail')}
        baseVerdict={makeVerdict('good')}
      />,
    );
    expect(screen.getByText(/compared with base: recommended → not suitable/i)).toBeTruthy();
  });

  it('renders delta line when status improves from fail to good', () => {
    render(
      <VerdictCard
        verdict={makeVerdict('good')}
        baseVerdict={makeVerdict('fail')}
      />,
    );
    expect(screen.getByText(/compared with base: not suitable → recommended/i)).toBeTruthy();
  });
});
