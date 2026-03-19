/**
 * ReportView.test.tsx
 *
 * Validates that ReportView:
 *   - Renders the ATLAS brand and "Atlas Heating System Assessment" heading
 *   - Shows the recommendation text from engine output
 *   - Shows a "No data available" blocked state when output is null
 *   - Shows a "Report not available" blocked state when essential data is missing
 *   - Shows the completeness banner for partial output
 *   - Does NOT show the banner when output is complete
 *   - Renders the verdict section with correct status and reasons
 *   - Renders key limiters when present
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

// ─── Document structure ───────────────────────────────────────────────────────

describe('ReportView — document structure', () => {
  it('renders "Atlas Heating System Assessment" h1', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Atlas Heating System Assessment' })).toBeTruthy();
  });

  it('renders the ATLAS brand', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('ATLAS')).toBeTruthy();
  });

  it('renders the subtitle', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Generated from system model')).toBeTruthy();
  });

  it('renders a generated date in the meta', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText(/Generated:/)).toBeTruthy();
  });

  it('renders the model version in the meta', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Model version: EngineOutputV1')).toBeTruthy();
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
    // Confidence level appears in doc header meta
    expect(screen.getByText(/Confidence: high/)).toBeTruthy();
  });

  it('renders "Confidence" label and capitalised level in the verdict block', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.getByText('Confidence')).toBeTruthy();
    expect(screen.getByText('High')).toBeTruthy();
  });

  it('renders verdict reasons', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    // Reasons appear in both the decision rationale and verdict sections.
    expect(screen.getAllByText('Adequate storage capacity').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Low simultaneous demand risk').length).toBeGreaterThanOrEqual(1);
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
    // Limiter impact summary appears in both decision rationale constraints and key limiters section.
    expect(screen.getAllByText(/Dynamic pressure is below optimal/).length).toBeGreaterThanOrEqual(1);
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

// ─── New section renderers ────────────────────────────────────────────────────

/** Output with a full option card including sensitivities and plans. */
const OUTPUT_WITH_OPTIONS: EngineOutputV1 = {
  ...FULL_OUTPUT,
  options: [
    {
      id: 'ashp',
      label: 'ASHP with unvented cylinder',
      status: 'viable',
      headline: 'Heat pump system',
      why: ['Low carbon'],
      requirements: [],
      heat: { status: 'ok', headline: 'Good at low flow temp', bullets: ['45°C flow comfortable'] },
      dhw: { status: 'ok', headline: 'Stored supply with stratification', bullets: ['210L cylinder needed', 'Immersion back-up included'] },
      engineering: { status: 'caution', headline: 'Moderate installation works', bullets: ['External unit space needed', 'Primary pipe upsize likely'] },
      typedRequirements: {
        mustHave: ['External wall space for heat pump unit'],
        likelyUpgrades: ['Primary pipework 22→28mm upgrade'],
        niceToHave: ['Smart controls'],
      },
      sensitivities: [
        { lever: 'Primary pipe size', effect: 'upgrade', note: 'Upsize to 28mm removes hydraulic barrier.' },
        { lever: 'Loft headroom', effect: 'downgrade', note: 'Low loft restricts cylinder siting.' },
      ],
    },
  ],
  plans: {
    pathways: [
      {
        id: 'path_1',
        title: 'Install ASHP now',
        rationale: 'Best carbon outcome under current constraints.',
        outcomeToday: 'Low-carbon heat and hot water',
        prerequisites: [],
        confidence: { level: 'medium', reasons: [] },
        rank: 1,
      },
    ],
    sharedConstraints: [],
  },
};

describe('ReportView — key trade-off section', () => {
  it('renders key trade-off section heading when options are present', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Key trade-off')).toBeTruthy();
  });

  it('renders likely upgrades label', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Likely upgrades required')).toBeTruthy();
  });

  it('renders likely upgrade items', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Primary pipework 22→28mm upgrade')).toBeTruthy();
  });

  it('renders engineering considerations label', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Engineering considerations')).toBeTruthy();
  });

  it('does not render key trade-off section when no options', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.queryByText('Key trade-off')).toBeNull();
  });
});

describe('ReportView — future path section', () => {
  it('renders next step / future path heading when sensitivities present', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Next step / future path')).toBeTruthy();
  });

  it('renders enablers section label', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText(/What would improve the outcome/)).toBeTruthy();
  });

  it('renders risks section label', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText(/What would reduce the outcome/)).toBeTruthy();
  });

  it('renders pathway options section when plans are present', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Pathway options')).toBeTruthy();
    expect(screen.getByText('Install ASHP now')).toBeTruthy();
  });
});

describe('ReportView — system architecture section', () => {
  it('renders system architecture heading when options present', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('System architecture')).toBeTruthy();
  });

  it('renders installation requirements label', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Installation requirements')).toBeTruthy();
  });

  it('renders engineering bullets', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getAllByText('Primary pipe upsize likely').length).toBeGreaterThan(0);
  });

  it('does not render system architecture when no options', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.queryByText('System architecture')).toBeNull();
  });
});

describe('ReportView — stored hot water section', () => {
  it('renders stored hot water heading for a stored system option', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Stored hot water')).toBeTruthy();
  });

  it('renders stored hot water bullets', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('210L cylinder needed')).toBeTruthy();
  });
});

describe('ReportView — risks and enablers section', () => {
  it('renders risks and enablers heading when sensitivities present', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Risks and enablers')).toBeTruthy();
  });

  it('renders risks label', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText(/Risks — inputs that could reduce suitability/)).toBeTruthy();
  });

  it('renders enablers label', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText(/Enablers — inputs that could improve suitability/)).toBeTruthy();
  });
});

describe('ReportView — physics trace section (appendix)', () => {
  it('renders physics trace section heading when behaviourTimeline present', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.getByText('Physics trace (appendix)')).toBeTruthy();
  });

  it('renders the appendix group header', () => {
    render(<ReportView output={FULL_OUTPUT} />);
    expect(screen.getByText('Appendix')).toBeTruthy();
  });

  it('does not render physics trace when behaviourTimeline absent', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.queryByText('Physics trace (appendix)')).toBeNull();
  });
});

describe('ReportView — engineering notes section (appendix)', () => {
  it('renders engineering notes heading when options have requirements', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Engineering notes (appendix)')).toBeTruthy();
  });

  it('renders must-have requirements', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getAllByText('External wall space for heat pump unit').length).toBeGreaterThan(0);
  });

  it('renders nice-to-have items', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Smart controls')).toBeTruthy();
  });

  it('does not render engineering notes when no options', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.queryByText('Engineering notes (appendix)')).toBeNull();
  });
});

describe('ReportView — section group headers', () => {
  it('renders "Technical summary" group header when technical sections are present', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Technical summary')).toBeTruthy();
  });

  it('renders "Appendix" group header when appendix sections are present', () => {
    render(<ReportView output={OUTPUT_WITH_OPTIONS} />);
    expect(screen.getByText('Appendix')).toBeTruthy();
  });

  it('does not render "Technical summary" header when no technical sections present', () => {
    render(<ReportView output={MINIMAL_OUTPUT} />);
    expect(screen.queryByText('Technical summary')).toBeNull();
  });
});

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
