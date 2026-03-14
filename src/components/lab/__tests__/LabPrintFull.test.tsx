/**
 * LabPrintFull.test.tsx
 *
 * Validates that LabPrintFull:
 *   - Renders the document title "Full Output Report"
 *   - Renders the ATLAS brand
 *   - Shows the "Includes all visible result panels" subtitle
 *   - Renders each visible section it receives
 *   - Shows a withheld-recommendation banner when the recommendation is withheld
 *   - Shows missing-data notes for usage model with missing fields
 *   - Renders the toolbar with back and print buttons
 *   - Calls onBack when the back button is clicked
 *   - Shows a "no data" message when sections array is empty
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LabPrintFull from '../LabPrintFull';
import type { OutputHubSection } from '../../../live/printSections.model';

// ─── Minimal section factories ────────────────────────────────────────────────

function makeRecommendationSection(withheld = false): OutputHubSection {
  return {
    id: 'recommendation',
    title: 'Recommendation',
    status: withheld ? 'watch' : 'ok',
    visible: true,
    customerSafe: true,
    content: {
      primary:        withheld ? 'Recommendation withheld — usage model incomplete' : 'Gas Combi is recommended',
      secondary:      'Meets simultaneous demand.',
      isWithheld:     withheld,
      withheldReason: withheld ? 'Occupancy count and bathroom count are not confirmed.' : null,
      verdict:        null,
      options:        [],
    },
  };
}

function makeUsageModelSection(missing = false): OutputHubSection {
  return {
    id: 'usageModel',
    title: 'Usage Model',
    status: missing ? 'missing' : 'ok',
    visible: true,
    customerSafe: true,
    content: {
      occupancyCount: missing ? null : 3,
      bathroomCount:  missing ? null : 1,
      storedRisk:     'pass',
      missingFields:  missing ? ['Occupancy count', 'Bathroom count'] : [],
    },
  };
}

function makeConstraintsSection(): OutputHubSection {
  return {
    id: 'constraints',
    title: 'Constraints',
    status: 'ok',
    visible: true,
    customerSafe: true,
    content: {
      limiters: [],
    },
  };
}

function makeChemistrySection(): OutputHubSection {
  return {
    id: 'chemistry',
    title: 'Chemistry',
    status: 'ok',
    visible: true,
    customerSafe: true,
    content: {
      tenYearDecayPct: 4.5,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LabPrintFull — document structure', () => {
  it('renders the "Full Output Report" document title', () => {
    render(<LabPrintFull sections={[makeRecommendationSection()]} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Full Output Report' })).toBeTruthy();
  });

  it('renders the ATLAS brand', () => {
    render(<LabPrintFull sections={[makeRecommendationSection()]} />);
    expect(screen.getByText('ATLAS')).toBeTruthy();
  });

  it('renders the "all visible result panels" subtitle in the document header', () => {
    render(<LabPrintFull sections={[makeRecommendationSection()]} />);
    // Both the subtitle paragraph and the meta row reference this phrase; at least one must exist
    expect(screen.getAllByText(/all visible result panels/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Includes all visible result panels" in the document meta', () => {
    render(<LabPrintFull sections={[makeRecommendationSection()]} />);
    expect(screen.getByText('Includes all visible result panels')).toBeTruthy();
  });
});

describe('LabPrintFull — recommendation section', () => {
  it('renders the recommendation section heading (h2)', () => {
    render(<LabPrintFull sections={[makeRecommendationSection()]} />);
    expect(screen.getByRole('heading', { level: 2, name: /recommendation/i })).toBeTruthy();
  });

  it('renders the non-withheld recommendation text', () => {
    render(<LabPrintFull sections={[makeRecommendationSection(false)]} />);
    expect(screen.getByText('Gas Combi is recommended')).toBeTruthy();
  });

  it('renders withheld recommendation banner when isWithheld is true', () => {
    render(<LabPrintFull sections={[makeRecommendationSection(true)]} />);
    expect(screen.getByRole('alert', { name: /recommendation withheld/i })).toBeTruthy();
    expect(screen.getByText('Recommendation withheld')).toBeTruthy();
  });

  it('renders withheld reason text', () => {
    render(<LabPrintFull sections={[makeRecommendationSection(true)]} />);
    expect(screen.getByText(/Occupancy count and bathroom count are not confirmed/)).toBeTruthy();
  });

  it('does NOT render withheld banner for a normal recommendation', () => {
    render(<LabPrintFull sections={[makeRecommendationSection(false)]} />);
    expect(screen.queryByRole('alert', { name: /recommendation withheld/i })).toBeNull();
  });
});

describe('LabPrintFull — usage model section', () => {
  it('renders usage model occupancy count when present', () => {
    render(<LabPrintFull sections={[makeUsageModelSection(false)]} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders "Not captured" when occupancy is null', () => {
    render(<LabPrintFull sections={[makeUsageModelSection(true)]} />);
    // There will be two "Not captured" — one for occupancy, one for bathrooms
    expect(screen.getAllByText('Not captured').length).toBeGreaterThanOrEqual(1);
  });

  it('renders missing-data note when usage model has missing fields', () => {
    render(<LabPrintFull sections={[makeUsageModelSection(true)]} />);
    expect(
      screen.getByRole('note', { name: /missing usage model data/i }),
    ).toBeTruthy();
    // Both fields appear in the missing-data note list and in the dl rows
    expect(screen.getAllByText('Occupancy count').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bathroom count').length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT render missing-data note when all usage model fields are present', () => {
    render(<LabPrintFull sections={[makeUsageModelSection(false)]} />);
    expect(screen.queryByRole('note', { name: /missing usage model data/i })).toBeNull();
  });
});

describe('LabPrintFull — multiple sections', () => {
  it('renders all provided sections', () => {
    render(
      <LabPrintFull
        sections={[
          makeRecommendationSection(),
          makeUsageModelSection(),
          makeConstraintsSection(),
          makeChemistrySection(),
        ]}
      />,
    );
    // Use role queries to avoid ambiguity where section titles appear multiple times
    expect(screen.getByRole('heading', { level: 2, name: /recommendation/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /usage model/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /constraints/i })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: /chemistry/i })).toBeTruthy();
  });

  it('renders chemistry decay percentage', () => {
    render(<LabPrintFull sections={[makeChemistrySection()]} />);
    expect(screen.getByText(/4\.5%/)).toBeTruthy();
  });

  it('renders "No physical constraints" when limiters array is empty', () => {
    render(<LabPrintFull sections={[makeConstraintsSection()]} />);
    expect(screen.getByText('No physical constraints identified.')).toBeTruthy();
  });
});

describe('LabPrintFull — empty state', () => {
  it('renders a "No data available" alert when sections array is empty', () => {
    render(<LabPrintFull sections={[]} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('No data available')).toBeTruthy();
  });
});

describe('LabPrintFull — toolbar', () => {
  it('renders the back button', () => {
    render(<LabPrintFull sections={[makeRecommendationSection()]} />);
    expect(screen.getByText('← Back to Lab')).toBeTruthy();
  });

  it('renders the print button', () => {
    render(<LabPrintFull sections={[makeRecommendationSection()]} />);
    expect(screen.getByText(/Print \/ Save PDF/)).toBeTruthy();
  });

  it('shows "Full Output Report" label in toolbar', () => {
    render(<LabPrintFull sections={[makeRecommendationSection()]} />);
    // The toolbar label span and h1 both say "Full Output Report"
    expect(screen.getAllByText('Full Output Report').length).toBeGreaterThanOrEqual(2);
  });

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    render(<LabPrintFull sections={[makeRecommendationSection()]} onBack={onBack} />);
    fireEvent.click(screen.getByText('← Back to Lab'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('LabPrintFull — generatedDate prop', () => {
  it('renders the provided generatedDate', () => {
    render(
      <LabPrintFull
        sections={[makeRecommendationSection()]}
        generatedDate="1 January 2026"
      />,
    );
    expect(screen.getByText(/1 January 2026/)).toBeTruthy();
  });
});
