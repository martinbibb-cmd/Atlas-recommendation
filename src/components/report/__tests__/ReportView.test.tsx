/**
 * ReportView.test.tsx
 *
 * Validates that ReportView:
 *   - Renders the ATLAS brand and "System Report" heading
 *   - Shows the recommendation text from engine output
 *   - Shows a "Report not available" blocked state when essential data is missing
 *   - Shows the completeness banner for partial output
 *   - Does NOT show the banner when output is complete
 *   - Renders the verdict section with correct status and reasons
 *   - Renders key limiters when present
 *   - Renders the toolbar with back and print buttons
 *   - Calls onBack when the back button is clicked
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReportView from '../ReportView';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';

// ─── Stubs ────────────────────────────────────────────────────────────────────

const MINIMAL_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'Unvented cylinder system', secondary: 'With regular boiler' },
  explainers: [],
  verdict: {
    title: 'Stored hot water recommended',
    status: 'good',
    reasons: ['Adequate storage capacity', 'Low simultaneous demand risk'],
    confidence: { level: 'high', reasons: [] },
    assumptionsUsed: [],
  },
};

const FULL_OUTPUT: EngineOutputV1 = {
  ...MINIMAL_OUTPUT,
  behaviourTimeline: {
    resolutionMins: 30,
    labels: {
      applianceName: 'Regular boiler with cylinder',
      isCombi: false,
    },
    points: [
      { t: '08:00', spaceHeatDemandKw: 6, dhwDemandKw: 4, dhwApplianceOutKw: 4, applianceOutKw: 10, efficiencyPct: 85, deliveredHeatKw: 6, deliveredDhwKw: 4, mode: 'combined', unmetHeatKw: 0 },
    ],
    assumptionsUsed: [],
  },
  limiters: {
    limiters: [
      {
        id: 'pressure_marginal',
        title: 'Mains pressure marginal',
        severity: 'warn' as const,
        observed: { label: 'Dynamic pressure', value: 1.2, unit: 'kPa' as const },
        limit: { label: 'Min pressure', value: 1.5, unit: 'kPa' as const },
        impact: { summary: 'Dynamic pressure is below optimal for unvented operation.' },
        confidence: 'medium' as const,
        sources: [],
        suggestedFixes: [{ id: 'fix1', label: 'Install a pump if pressure is consistently low.' }],
      },
    ],
  },
  influenceSummary: {
    heat: { influencePct: 45, drivers: [] },
    dhw: { influencePct: 30, drivers: [] },
    hydraulics: { influencePct: 25, drivers: [] },
  },
  meta: {
    engineVersion: '1' as never,
    contractVersion: '1' as never,
    assumptions: [
      { id: 'occ', title: 'Occupancy assumed', detail: 'Derived from household profile.', affects: ['timeline_24h'], severity: 'info' },
    ],
  },
};

const BROKEN_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: '' },
  explainers: [],
};

// ─── Document structure ───────────────────────────────────────────────────────

describe('ReportView — document structure', () => {
  it('renders "System Report" h1', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByRole('heading', { level: 1, name: 'System Report' })).toBeTruthy();
  });

  it('renders the ATLAS brand', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('ATLAS')).toBeTruthy();
  });

  it('renders the subtitle', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText(/Heating system assessment/)).toBeTruthy();
  });
});

// ─── Toolbar ─────────────────────────────────────────────────────────────────

describe('ReportView — toolbar', () => {
  it('renders the back button', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('← Back')).toBeTruthy();
  });

  it('renders the print button', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText(/Print \/ Save PDF/)).toBeTruthy();
  });

  it('calls onBack when the back button is clicked', () => {
    const onBack = vi.fn();
    render(<ReportView output={MINIMAL_OUTPUT} onBack={onBack} />);
    fireEvent.click(screen.getByText('← Back'));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// ─── Blocked state ────────────────────────────────────────────────────────────

describe('ReportView — blocked when essential data is missing', () => {
  it('renders "Report not available" for broken output', () => {
    render(<ReportView output={BROKEN_OUTPUT} />);
    expect(screen.getByText('Report not available')).toBeTruthy();
  });

  it('does not render the print button when blocked', () => {
    render(<ReportView output={BROKEN_OUTPUT} />);
    expect(screen.queryByText(/Print \/ Save PDF/)).toBeNull();
  });
});

// ─── Completeness banner ──────────────────────────────────────────────────────

describe('ReportView — completeness banner', () => {
  it('shows the completeness banner for partial output', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Partial report')).toBeTruthy();
  });

  it('does not show the completeness banner for full output', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.queryByText('Partial report')).toBeNull();
  });
});

// ─── System summary section ───────────────────────────────────────────────────

describe('ReportView — system summary section', () => {
  it('renders the primary recommendation text', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Unvented cylinder system')).toBeTruthy();
  });

  it('renders the secondary recommendation text when present', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('With regular boiler')).toBeTruthy();
  });

  it('renders the "System summary" section heading', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('System summary')).toBeTruthy();
  });
});

// ─── Verdict section ──────────────────────────────────────────────────────────

describe('ReportView — verdict section', () => {
  it('renders the verdict title', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    // Title appears in both system-summary assessment dd and verdict p — check at least one
    expect(screen.getAllByText('Stored hot water recommended').length).toBeGreaterThan(0);
  });

  it('renders the "Recommended" label for a good verdict', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Recommended')).toBeTruthy();
  });

  it('renders the confidence badge', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    // Confidence level appears in doc header meta and verdict badge
    expect(screen.getAllByText(/Confidence: high/).length).toBeGreaterThan(0);
  });

  it('renders verdict reasons', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Adequate storage capacity')).toBeTruthy();
    expect(screen.getByText('Low simultaneous demand risk')).toBeTruthy();
  });

  it('renders the verdict section heading', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Verdict / recommendation')).toBeTruthy();
  });
});

// ─── Limiters section ─────────────────────────────────────────────────────────

describe('ReportView — key limiters section', () => {
  it('renders limiters section heading when limiters are present', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.getByText('Key limiters / constraints')).toBeTruthy();
  });

  it('renders limiter title', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.getByText('Mains pressure marginal')).toBeTruthy();
  });

  it('renders limiter detail', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.getByText(/Dynamic pressure is below optimal/)).toBeTruthy();
  });

  it('renders suggested fix', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.getByText(/Install a pump/)).toBeTruthy();
  });

  it('does not render limiters section when no limiters', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.queryByText('Key limiters / constraints')).toBeNull();
  });
});

// ─── Behaviour summary ────────────────────────────────────────────────────────

describe('ReportView — behaviour summary section', () => {
  it('renders behaviour timeline summary heading when timeline is present', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.getByText('Behaviour timeline summary')).toBeTruthy();
  });

  it('renders the appliance name', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.getByText('Regular boiler with cylinder')).toBeTruthy();
  });

  it('does not render behaviour summary when timeline is absent', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.queryByText('Behaviour timeline summary')).toBeNull();
  });
});
