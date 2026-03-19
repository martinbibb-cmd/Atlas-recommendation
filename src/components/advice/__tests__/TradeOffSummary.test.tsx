// src/components/advice/__tests__/TradeOffSummary.test.tsx
//
// Tests for the TradeOffSummary component — recommendation trade-off summary.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TradeOffSummary from '../TradeOffSummary';
import type { TradeOffSummaryData } from '../../../lib/advice/buildTradeOffSummary';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SUMMARY_COMBI_TO_ASHP: TradeOffSummaryData = {
  currentSystemLabel:     'Combi boiler',
  recommendedSystemLabel: 'Air source heat pump',
  dimensions: [
    { label: 'Efficiency',       current: 'medium', recommended: 'high'   },
    { label: 'Upfront cost',     current: 'low',    recommended: 'high'   },
    { label: 'Disruption',       current: 'low',    recommended: 'high'   },
    { label: 'Space impact',     current: 'low',    recommended: 'medium' },
    { label: 'Hot water',        current: 'medium', recommended: 'high'   },
    { label: 'Future-readiness', current: 'low',    recommended: 'high'   },
  ],
};

const SUMMARY_SAME_SYSTEM: TradeOffSummaryData = {
  currentSystemLabel:     'Combi boiler',
  recommendedSystemLabel: 'Combi boiler',
  dimensions: [
    { label: 'Efficiency',       current: 'medium', recommended: 'medium' },
    { label: 'Upfront cost',     current: 'low',    recommended: 'low'    },
    { label: 'Disruption',       current: 'low',    recommended: 'low'    },
    { label: 'Space impact',     current: 'low',    recommended: 'low'    },
    { label: 'Hot water',        current: 'medium', recommended: 'medium' },
    { label: 'Future-readiness', current: 'low',    recommended: 'low'    },
  ],
};

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('TradeOffSummary — rendering', () => {
  it('renders without crashing', () => {
    expect(() => render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />)).not.toThrow();
  });

  it('renders the accessible container label', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    expect(screen.getByLabelText(/recommendation trade-off summary/i)).toBeTruthy();
  });

  it('renders the current system label in the header', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    expect(screen.getByText('Combi boiler')).toBeTruthy();
  });

  it('renders the recommended system label in the header', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    expect(screen.getByText('Air source heat pump')).toBeTruthy();
  });

  it('has the data-testid attribute', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    expect(document.querySelector('[data-testid="trade-off-summary"]')).not.toBeNull();
  });
});

// ─── Dimension labels ─────────────────────────────────────────────────────────

describe('TradeOffSummary — dimension labels', () => {
  it('renders the Efficiency dimension label', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    expect(screen.getByText('Efficiency')).toBeTruthy();
  });

  it('renders the Upfront cost dimension label', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    expect(screen.getByText('Upfront cost')).toBeTruthy();
  });

  it('renders the Disruption dimension label', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    expect(screen.getByText('Disruption')).toBeTruthy();
  });

  it('renders the Space impact dimension label', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    expect(screen.getByText('Space impact')).toBeTruthy();
  });

  it('renders the Hot water dimension label', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    expect(screen.getByText('Hot water')).toBeTruthy();
  });

  it('renders the Future-readiness dimension label', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    expect(screen.getByText('Future-readiness')).toBeTruthy();
  });

  it('renders all 6 dimension rows', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    const rows = document.querySelectorAll('[role="row"]');
    expect(rows.length).toBe(6);
  });
});

// ─── Band chips ───────────────────────────────────────────────────────────────

describe('TradeOffSummary — band chips', () => {
  it('renders "Higher" chip for high band', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    const higherChips = screen.getAllByText('Higher');
    expect(higherChips.length).toBeGreaterThan(0);
  });

  it('renders "Medium" chip for medium band', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    const mediumChips = screen.getAllByText('Medium');
    expect(mediumChips.length).toBeGreaterThan(0);
  });

  it('renders "Lower" chip for low band', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    const lowerChips = screen.getAllByText('Lower');
    expect(lowerChips.length).toBeGreaterThan(0);
  });
});

// ─── Accessible row labels ────────────────────────────────────────────────────

describe('TradeOffSummary — accessibility', () => {
  it('Efficiency row has descriptive aria-label', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    const effRow = screen.getByRole('row', { name: /efficiency/i });
    expect(effRow).toBeTruthy();
    expect(effRow.getAttribute('aria-label')).toMatch(/current medium/i);
    expect(effRow.getAttribute('aria-label')).toMatch(/recommended higher/i);
  });

  it('Upfront cost row has descriptive aria-label', () => {
    render(<TradeOffSummary summary={SUMMARY_COMBI_TO_ASHP} />);
    const row = screen.getByRole('row', { name: /upfront cost/i });
    expect(row.getAttribute('aria-label')).toMatch(/current lower/i);
    expect(row.getAttribute('aria-label')).toMatch(/recommended higher/i);
  });
});

// ─── Same-system rendering ────────────────────────────────────────────────────

describe('TradeOffSummary — same-system edge case', () => {
  it('renders without crashing when current and recommended are the same system', () => {
    expect(() => render(<TradeOffSummary summary={SUMMARY_SAME_SYSTEM} />)).not.toThrow();
  });

  it('renders both column headers with the same system name', () => {
    render(<TradeOffSummary summary={SUMMARY_SAME_SYSTEM} />);
    const combiMatches = screen.getAllByText('Combi boiler');
    expect(combiMatches.length).toBe(2);
  });
});
