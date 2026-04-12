/**
 * ReportView.test.tsx
 *
 * Validates that ReportView:
 *   - Renders the "Heating system assessment" h1 heading
 *   - Shows the recommendation text from engine output
 *   - Shows a "No data available" blocked state when output is null
 *   - Shows a "Report not available" blocked state when essential data is missing
 *   - Shows the completeness banner for partial output
 *   - Does NOT show the banner when output is complete
 *   - Renders the five-page decision document sections
 *   - Renders the toolbar with back and print buttons
 *   - Calls onBack when the back button is clicked
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ReportView from '../ReportView';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../../lib/portal/portalToken', () => ({
  generatePortalToken: vi.fn().mockResolvedValue('mock-token'),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

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

/** Output with options so pages 2–4 are rendered. */
const OUTPUT_WITH_OPTIONS: EngineOutputV1 = {
  ...FULL_OUTPUT,
  options: [
    {
      id: 'system_unvented',
      label: 'System boiler with unvented cylinder',
      status: 'viable',
      headline: 'Stored hot water system',
      why: ['Stored volume removes flow dependency'],
      requirements: [],
      heat: { status: 'ok', headline: 'Good', bullets: ['60°C flow comfortable'] },
      dhw: { status: 'ok', headline: 'Adequate stored volume', bullets: ['150L cylinder needed'] },
      engineering: { status: 'caution', headline: 'Minor installation works', bullets: ['Add cylinder and pipework'] },
      typedRequirements: {
        mustHave: ['Cylinder space required'],
        likelyUpgrades: ['Primary pipework upsize'],
        niceToHave: ['Smart controls'],
      },
      sensitivities: [],
    },
    {
      id: 'ashp',
      label: 'Heat pump',
      status: 'caution',
      headline: 'Heat pump system',
      why: ['Low carbon alternative'],
      requirements: [],
      heat: { status: 'ok', headline: 'Efficient at low flow temp', bullets: [] },
      dhw: { status: 'caution', headline: 'Stored with immersion backup', bullets: [] },
      engineering: { status: 'caution', headline: 'Significant works', bullets: ['Larger emitters likely required'] },
      typedRequirements: {
        mustHave: ['External wall space for heat pump unit', 'Larger emitters or underfloor heating'],
        likelyUpgrades: [],
        niceToHave: [],
      },
      sensitivities: [],
    },
  ],
};

// ─── Document structure ───────────────────────────────────────────────────────

describe('ReportView — document structure', () => {
  it('renders "Heating system assessment" h1', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Heating system assessment' })).toBeTruthy();
  });

  it('renders the subtitle', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Based on your home survey')).toBeTruthy();
  });

  it('renders a generated date in the meta', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText(/Generated:/)).toBeTruthy();
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

// ─── Null output guard ────────────────────────────────────────────────────────

describe('ReportView — null output guard', () => {
  it('renders "No data available" when output is null', () => {
    render(<ReportView output={null} />);
    expect(screen.getByText('No data available')).toBeTruthy();
  });

  it('does not render the print button when output is null', () => {
    render(<ReportView output={null} />);
    expect(screen.queryByText(/Print \/ Save PDF/)).toBeNull();
  });

  it('renders the back button even when output is null', () => {
    render(<ReportView output={null} />);
    expect(screen.getByText('← Back')).toBeTruthy();
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

// ─── Page 1 — Decision ───────────────────────────────────────────────────────

describe('ReportView — page 1: decision section', () => {
  it('renders the recommendation text from engine output', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getAllByText('Unvented cylinder system').length).toBeGreaterThan(0);
  });

  it('renders "Recommended solution" label', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Recommended solution')).toBeTruthy();
  });

  it('renders verdict title as headline when no limiters are present', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getAllByText('Stored hot water recommended').length).toBeGreaterThan(0);
  });

  it('renders "System constraint identified" headline when warn limiter present', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.getByText('System constraint identified')).toBeTruthy();
  });

  it('renders "What we found" label when limiters are present', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.getByText('What we found')).toBeTruthy();
  });

  it('renders limiter observed value in measured facts', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    // "1.2 kPa" should appear in measured facts (may also appear in engineer snapshot constraint)
    expect(screen.getAllByText(/1\.2.*kPa/).length).toBeGreaterThan(0);
  });

  it('renders "What this means" label when consequence is available', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.getByText('What this means')).toBeTruthy();
  });

  it('renders whyRequired reasons from verdict', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    // verdict.reasons appear in whyRequired bullets
    expect(screen.getAllByText('Adequate storage capacity').length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Page 5 — Engineer snapshot ───────────────────────────────────────────────

describe('ReportView — page 5: engineer snapshot', () => {
  it('renders "Engineer snapshot" heading', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Engineer snapshot')).toBeTruthy();
  });

  it('renders "Recommended" label in engineer snapshot', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Recommended')).toBeTruthy();
  });

  it('renders "Confidence" label in engineer snapshot', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Confidence')).toBeTruthy();
  });

  it('renders capitalised confidence level in engineer snapshot', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('renders confidence level in doc header meta', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText(/Confidence: high/)).toBeTruthy();
  });

  it('renders "Key constraint" row when limiter data is present', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.getByText('Key constraint')).toBeTruthy();
  });
});

// ─── Page 2 — Daily experience ────────────────────────────────────────────────

describe('ReportView — page 2: daily experience section', () => {
  it('renders "Daily experience" heading when option data is present', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Daily experience')).toBeTruthy();
  });

  it('renders at least one scenario item', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('does not render daily experience when no options', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.queryByText('Daily experience')).toBeNull();
  });
});

// ─── Page 3 — What changes ────────────────────────────────────────────────────

describe('ReportView — page 3: what changes section', () => {
  it('renders "What changes" heading when option data is present', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('What changes')).toBeTruthy();
  });

  it('renders mustHave requirement from recommended option', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getAllByText('Cylinder space required').length).toBeGreaterThan(0);
  });

  it('does not render what changes when no options', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.queryByText('What changes')).toBeNull();
  });
});

// ─── Page 4 — Alternatives ────────────────────────────────────────────────────

describe('ReportView — page 4: alternatives section', () => {
  it('renders "Alternatives" heading when option data is present', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Alternatives')).toBeTruthy();
  });

  it('renders the secondary option label', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Heat pump')).toBeTruthy();
  });

  it('renders trade-offs for the alternative', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText(/External wall space for heat pump unit/)).toBeTruthy();
  });

  it('renders the "Explore in simulator" footnote', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText(/explore.*in the interactive simulator/i)).toBeTruthy();
  });

  it('does not render alternatives when no options', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.queryByText('Alternatives')).toBeNull();
  });
});

// ─── Print support ────────────────────────────────────────────────────────────

describe('ReportView — print support', () => {
  it('renders the print button', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText(/Print \/ Save PDF/)).toBeTruthy();
  });

  it('does not render the print button when essential data is missing', () => {
    render(<ReportView output={BROKEN_OUTPUT} />);
    expect(screen.queryByText(/Print \/ Save PDF/)).toBeNull();
  });

  it('does not render the print button when output is null', () => {
    render(<ReportView output={null} />);
    expect(screen.queryByText(/Print \/ Save PDF/)).toBeNull();
  });
});

// ─── Portal link ──────────────────────────────────────────────────────────────

describe('ReportView — portal link', () => {
  it('renders the portal link when reportReference is provided', async () => {
    render(<ReportView output={MINIMAL_OUTPUT} reportReference="ref-abc-123" />);
    await waitFor(() => {
      expect(screen.getByTestId('portal-link')).toBeTruthy();
    });
  });

  it('portal link has correct text', async () => {
    render(<ReportView output={MINIMAL_OUTPUT} reportReference="ref-abc-123" />);
    await waitFor(() => {
      expect(screen.getByText(/Open interactive home heating plan/)).toBeTruthy();
    });
  });

  it('portal link points to the portal URL', async () => {
    render(<ReportView output={MINIMAL_OUTPUT} reportReference="ref-abc-123" />);
    await waitFor(() => {
      const link = screen.getByTestId('portal-link') as HTMLAnchorElement;
      expect(link.href).toContain('/portal/ref-abc-123');
    });
  });

  it('portal link opens in a new tab', async () => {
    render(<ReportView output={MINIMAL_OUTPUT} reportReference="ref-abc-123" />);
    await waitFor(() => {
      const link = screen.getByTestId('portal-link') as HTMLAnchorElement;
      expect(link.target).toBe('_blank');
      expect(link.rel).toContain('noopener');
    });
  });

  it('does not render the portal link without reportReference', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.queryByTestId('portal-link')).toBeNull();
  });
});
