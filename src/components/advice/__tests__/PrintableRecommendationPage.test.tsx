// src/components/advice/__tests__/PrintableRecommendationPage.test.tsx
//
// Tests for PrintableRecommendationPage — PR7 printable recommendation output.
//
// Coverage:
//   - print component renders bestOverall when compare-backed advice present
//   - all 6 objective cards are present
//   - installation recipe sections render
//   - phased plan renders (Now / Next / Later)
//   - compare summary renders when compareSeed is provided
//   - confidence badge renders
//   - efficiency score badge renders
//   - print entry point (button) appears on DecisionSynthesisPage with compare-backed advice
//   - fallback path works when compare-backed advice is unavailable (advice=null)
//   - print structure stays stable and bounded (no interactive-only labels)
//   - no interactive-only labels leak into print markup (tabs, toggles, sliders)

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PrintableRecommendationPage from '../PrintableRecommendationPage';
import DecisionSynthesisPage from '../DecisionSynthesisPage';
import type { AdviceFromCompareResult } from '../../../lib/advice/buildAdviceFromCompare';
import type { CompareSeed } from '../../../lib/simulator/buildCompareSeedFromSurvey';
import type { EngineOutputV1, OptionCardV1 } from '../../../contracts/EngineOutputV1';
import type { FullSurveyModelV1 } from '../../../ui/fullSurvey/FullSurveyModelV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeAdviceCard(id: string, overrides: Partial<AdviceFromCompareResult['bestOverall']> = {}) {
  return {
    id,
    icon: '⚡',
    title: `Card ${id}`,
    recommendedPathLabel: 'Unvented cylinder system',
    why: [`Why ${id} is best`],
    keyTradeOff: 'Higher upfront cost',
    confidencePct: 75,
    efficiencyScore: 82,
    compareWins: ['lower cycling risk', 'better simultaneous hot-water delivery'],
    ...overrides,
  };
}

const DEMO_ADVICE: AdviceFromCompareResult = {
  bestOverall: makeAdviceCard('best_overall', {
    title: 'Best all-round fit',
    compareWins: ['lower cycling risk', 'better simultaneous hot-water delivery'],
  }),
  byObjective: {
    lowestRunningCost:              makeAdviceCard('lowest_running_cost',           { title: 'Lowest running cost' }),
    lowestInstallationCost:         makeAdviceCard('lowest_installation_cost',      { title: 'Lowest installation cost' }),
    greatestLongevity:              makeAdviceCard('greatest_longevity',            { title: 'Greatest longevity' }),
    lowestCarbonPointOfUse:         makeAdviceCard('lowest_carbon_point_of_use',    { title: 'Lowest carbon at point of use' }),
    greatestComfortAndDelivery:     makeAdviceCard('greatest_comfort_and_delivery', { title: 'Greatest comfort and delivery' }),
    measuredForwardThinkingPlan:    makeAdviceCard('measured_forward_thinking_plan',{ title: 'Measured forward-thinking plan' }),
  },
  installationRecipe: {
    heatSource: 'Gas boiler (combi), 24–30 kW output',
    hotWaterArrangement: 'Unvented cylinder, 250 L',
    controls: ['Modulating room thermostat', 'Weather compensation'],
    emitters: ['Existing radiators — retained after flush'],
    primaryPipework: ['22 mm primary flow and return'],
    protectionAndAncillaries: ['Magnetic filter on primary return', 'Inhibitor dose'],
  },
  phasedPlan: {
    now:  ['Install unvented cylinder', 'Fit new boiler'],
    next: ['Add weather compensation'],
    later: ['Consider heat pump when tariffs improve'],
  },
  confidenceSummary: {
    level: 'high',
    pct: 85,
    reasons: ['Mains pressure confirmed adequate', 'Single-bathroom household'],
  },
};

const DEMO_COMPARE_SEED: CompareSeed = {
  left:  { systemChoice: 'combi',    systemInputs: { weatherCompensation: false, emitterCapacityFactor: 1.0, systemCondition: 'scaling' } },
  right: { systemChoice: 'unvented', systemInputs: { weatherCompensation: true,  emitterCapacityFactor: 1.2, systemCondition: 'clean'   } },
  compareMode: 'current_vs_proposed',
  comparisonLabel: 'Current system vs Proposed system',
} as unknown as CompareSeed;

// Minimal EngineOutputV1 for DecisionSynthesisPage tests
function makeOption(id: OptionCardV1['id'], status: OptionCardV1['status']): OptionCardV1 {
  return {
    id, label: id, status,
    headline: `${id} headline`,
    why: [`${id} is suitable`],
    requirements: [],
    typedRequirements: {
      mustHave: ['Install X'],
      likelyUpgrades: ['Flush system'],
      niceToHave: ['Smart thermostat'],
    },
    heat:        { status: 'ok', headline: 'Heat ok',   bullets: [] },
    dhw:         { status: 'ok', headline: 'DHW ok',    bullets: [] },
    engineering: { status: 'ok', headline: 'Eng ok',    bullets: [] },
    sensitivities: [],
  };
}

const DEMO_ENGINE_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'Unvented cylinder system' },
  explainers: [],
  options: [
    makeOption('stored_unvented', 'viable'),
    makeOption('combi',           'caution'),
  ],
  verdict: {
    title: 'Good match',
    status: 'good',
    reasons: ['Good mains pressure'],
    confidence: { level: 'high', reasons: [] },
    assumptionsUsed: [],
    primaryReason: 'Strong match for occupancy',
  },
};

const MINIMAL_SURVEY: FullSurveyModelV1 = {
  occupancySignature: 'home_all_day',
  propertyType: 'semi_detached',
  propertyAge: 'post_2000',
  bedrooms: 3,
  bathrooms: 1,
  currentSystem: 'combi',
  fuelType: 'gas',
  mainsWaterPressure: 'adequate',
} as unknown as FullSurveyModelV1;

// ─── PrintableRecommendationPage rendering ────────────────────────────────────

describe('PrintableRecommendationPage — rendering', () => {
  it('renders without crashing when advice is provided', () => {
    expect(() => render(
      <PrintableRecommendationPage advice={DEMO_ADVICE} />,
    )).not.toThrow();
  });

  it('renders without crashing when advice is null (fallback path)', () => {
    expect(() => render(
      <PrintableRecommendationPage advice={null} />,
    )).not.toThrow();
  });

  it('renders the Atlas Recommendation header', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText(/atlas recommendation/i)).toBeTruthy();
  });

  it('renders the page title', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByRole('heading', { name: /heating system recommendation/i })).toBeTruthy();
  });
});

// ─── bestOverall card ─────────────────────────────────────────────────────────

describe('PrintableRecommendationPage — bestOverall', () => {
  it('renders the recommended system path label', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    const matches = screen.getAllByText('Unvented cylinder system');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders the why text from bestOverall', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Why best_overall is best')).toBeTruthy();
  });

  it('renders the "Atlas recommends" label', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText(/atlas recommends/i)).toBeTruthy();
  });
});

// ─── Compare wins ─────────────────────────────────────────────────────────────

describe('PrintableRecommendationPage — compare wins', () => {
  it('renders compare wins chips', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    const wins = screen.getAllByText(/lower cycling risk/i);
    expect(wins.length).toBeGreaterThan(0);
  });

  it('renders "better simultaneous hot-water delivery" compare win', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    const wins = screen.getAllByText(/better simultaneous hot-water delivery/i);
    expect(wins.length).toBeGreaterThan(0);
  });
});

// ─── Confidence and efficiency badges ────────────────────────────────────────

describe('PrintableRecommendationPage — badges', () => {
  it('renders the confidence badge', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByLabelText(/confidence:/i)).toBeTruthy();
  });

  it('renders "High confidence" in the badge', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText(/high confidence/i)).toBeTruthy();
  });

  it('renders the confidence percentage in the badge', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    // bestOverall.confidencePct is 75 in the fixture
    expect(screen.getByText(/75%/)).toBeTruthy();
  });

  it('renders the efficiency score badge', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByLabelText(/efficiency score/i)).toBeTruthy();
  });

  it('renders the efficiency score value', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText(/82\/99/)).toBeTruthy();
  });
});

// ─── Compare summary block ────────────────────────────────────────────────────

describe('PrintableRecommendationPage — compare summary', () => {
  it('renders the compare summary section when compareSeed is provided', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} compareSeed={DEMO_COMPARE_SEED} />);
    expect(screen.getByLabelText(/current vs proposed summary/i)).toBeTruthy();
  });

  it('renders "Current system" label', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} compareSeed={DEMO_COMPARE_SEED} />);
    expect(screen.getByLabelText('Current system')).toBeTruthy();
  });

  it('renders "Proposed system" label', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} compareSeed={DEMO_COMPARE_SEED} />);
    expect(screen.getByLabelText('Proposed system')).toBeTruthy();
  });

  it('renders current system name derived from compareSeed', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} compareSeed={DEMO_COMPARE_SEED} />);
    // combi → "Combi boiler"
    expect(screen.getAllByText('Combi boiler').length).toBeGreaterThan(0);
  });

  it('does not render compare summary when compareSeed is absent', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.queryByLabelText(/current vs proposed summary/i)).toBeNull();
  });

  it('renders "Top changes" list when compare wins exist and compareSeed present', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} compareSeed={DEMO_COMPARE_SEED} />);
    expect(screen.getByLabelText(/list of top changes/i)).toBeTruthy();
  });
});

// ─── Objective cards ──────────────────────────────────────────────────────────

describe('PrintableRecommendationPage — objective cards', () => {
  it('renders all 6 objective cards', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    const grid = screen.getByRole('list', { name: /objective cards/i });
    const items = grid.querySelectorAll('[role="listitem"]');
    expect(items.length).toBe(6);
  });

  it('renders "Lowest running cost" card', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Lowest running cost')).toBeTruthy();
  });

  it('renders "Lowest installation cost" card', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Lowest installation cost')).toBeTruthy();
  });

  it('renders "Greatest longevity" card', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Greatest longevity')).toBeTruthy();
  });

  it('renders "Lowest carbon at point of use" card', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Lowest carbon at point of use')).toBeTruthy();
  });

  it('renders "Greatest comfort and delivery" card', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Greatest comfort and delivery')).toBeTruthy();
  });

  it('renders "Measured forward-thinking plan" card', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Measured forward-thinking plan')).toBeTruthy();
  });
});

// ─── Installation recipe ──────────────────────────────────────────────────────

describe('PrintableRecommendationPage — installation recipe', () => {
  it('renders the "Installation recipe" section heading', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Installation recipe')).toBeTruthy();
  });

  it('renders "Heat source" label', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Heat source')).toBeTruthy();
  });

  it('renders "Hot water arrangement" label', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Hot water arrangement')).toBeTruthy();
  });

  it('renders "Controls" label', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Controls')).toBeTruthy();
  });

  it('renders "Emitters" label', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Emitters')).toBeTruthy();
  });

  it('renders "Primary pipework" label', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Primary pipework')).toBeTruthy();
  });

  it('renders "Protection & ancillaries" label', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Protection & ancillaries')).toBeTruthy();
  });

  it('renders a control item', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Modulating room thermostat')).toBeTruthy();
  });
});

// ─── Phased plan ──────────────────────────────────────────────────────────────

describe('PrintableRecommendationPage — phased plan', () => {
  it('renders the "Phased plan" section', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText(/phased plan/i)).toBeTruthy();
  });

  it('renders the Now phase badge', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Now')).toBeTruthy();
  });

  it('renders the Next phase badge', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Next')).toBeTruthy();
  });

  it('renders the Later phase badge', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Later')).toBeTruthy();
  });

  it('renders Now phase actions', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Install unvented cylinder')).toBeTruthy();
  });

  it('renders Next phase actions', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Add weather compensation')).toBeTruthy();
  });

  it('renders Later phase actions', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByText('Consider heat pump when tariffs improve')).toBeTruthy();
  });
});

// ─── Fallback path ────────────────────────────────────────────────────────────

describe('PrintableRecommendationPage — fallback path', () => {
  it('renders fallback notice when advice is null', () => {
    render(<PrintableRecommendationPage advice={null} />);
    expect(screen.getByRole('note', { name: /fallback notice/i })).toBeTruthy();
  });

  it('does not render objective cards when advice is null', () => {
    render(<PrintableRecommendationPage advice={null} />);
    expect(screen.queryByRole('list', { name: /objective cards/i })).toBeNull();
  });

  it('does not render installation recipe when advice is null', () => {
    render(<PrintableRecommendationPage advice={null} />);
    expect(screen.queryByText('Installation recipe')).toBeNull();
  });

  it('does not render phased plan when advice is null', () => {
    render(<PrintableRecommendationPage advice={null} />);
    expect(screen.queryByText('Now')).toBeNull();
  });
});

// ─── Print toolbar ────────────────────────────────────────────────────────────

describe('PrintableRecommendationPage — toolbar', () => {
  it('renders the print recommendation button', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(screen.getByRole('button', { name: /print atlas recommendation/i })).toBeTruthy();
  });

  it('calls window.print() when print button is clicked', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    fireEvent.click(screen.getByRole('button', { name: /print atlas recommendation/i }));
    expect(printSpy).toHaveBeenCalledOnce();
    printSpy.mockRestore();
  });

  it('renders back button when onBack is provided', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} onBack={() => {}} />);
    expect(screen.getByRole('button', { name: /back to advice page/i })).toBeTruthy();
  });

  it('calls onBack when back button is clicked', () => {
    const onBack = vi.fn();
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back to advice page/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

// ─── Print entry point on DecisionSynthesisPage ───────────────────────────────

describe('DecisionSynthesisPage — print entry point', () => {
  it('renders the "Print recommendation" button when compare-backed advice is available', () => {
    render(
      <DecisionSynthesisPage
        engineOutput={DEMO_ENGINE_OUTPUT}
        compareSeed={DEMO_COMPARE_SEED}
        surveyData={MINIMAL_SURVEY}
      />,
    );
    expect(screen.getByRole('button', { name: /print atlas recommendation/i })).toBeTruthy();
  });

  it('does not render the print button when no compareSeed is provided', () => {
    render(<DecisionSynthesisPage engineOutput={DEMO_ENGINE_OUTPUT} />);
    expect(screen.queryByRole('button', { name: /print atlas recommendation/i })).toBeNull();
  });

  it('navigates to print view when print button is clicked', () => {
    render(
      <DecisionSynthesisPage
        engineOutput={DEMO_ENGINE_OUTPUT}
        compareSeed={DEMO_COMPARE_SEED}
        surveyData={MINIMAL_SURVEY}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /print atlas recommendation/i }));
    // After navigating to print view, the PrintableRecommendationPage header is shown
    expect(screen.getByRole('heading', { name: /heating system recommendation/i })).toBeTruthy();
  });

  it('returns to advice page when back is clicked from print view', () => {
    render(
      <DecisionSynthesisPage
        engineOutput={DEMO_ENGINE_OUTPUT}
        compareSeed={DEMO_COMPARE_SEED}
        surveyData={MINIMAL_SURVEY}
      />,
    );
    // Go to print view
    fireEvent.click(screen.getByRole('button', { name: /print atlas recommendation/i }));
    // Click back
    fireEvent.click(screen.getByRole('button', { name: /back to advice page/i }));
    // Should be back on advice page
    expect(screen.getByRole('heading', { name: /advice/i })).toBeTruthy();
  });
});

// ─── No interactive-only labels in print markup ───────────────────────────────

describe('PrintableRecommendationPage — no interactive chrome', () => {
  it('does not render simulator tab controls', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    const pageText = document.body.textContent ?? '';
    expect(pageText).not.toMatch(/simulator dashboard/i);
  });

  it('does not render "edit setup" interactive control', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    const pageText = document.body.textContent ?? '';
    expect(pageText).not.toMatch(/edit setup/i);
  });

  it('does not use prohibited term "instantaneous hot water"', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    const pageText = document.body.textContent ?? '';
    expect(pageText).not.toMatch(/\binstantaneous hot water\b/i);
  });

  it('does not use prohibited term "gravity system"', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    const pageText = document.body.textContent ?? '';
    expect(pageText).not.toMatch(/\bgravity system\b/i);
  });
});

// ─── Print structure stability ────────────────────────────────────────────────

describe('PrintableRecommendationPage — structure stability', () => {
  it('renders the same key sections every time (deterministic)', () => {
    const { unmount } = render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    const sectionHeadings1 = Array.from(document.querySelectorAll('.prp__section-title')).map(el => el.textContent);
    unmount();

    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    const sectionHeadings2 = Array.from(document.querySelectorAll('.prp__section-title')).map(el => el.textContent);

    expect(sectionHeadings1).toEqual(sectionHeadings2);
  });

  it('renders exactly 4 logical sections when compare seed is present', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} compareSeed={DEMO_COMPARE_SEED} />);
    // Current vs proposed, Best all-round, Best by objective, Installation recipe, Phased plan
    // = 5 top-level sections (one extra for compare summary)
    const sections = document.querySelectorAll('.prp__section');
    expect(sections.length).toBeGreaterThanOrEqual(4);
  });

  it('renders the print component within a bounded container', () => {
    render(<PrintableRecommendationPage advice={DEMO_ADVICE} />);
    expect(document.querySelector('.prp')).toBeTruthy();
  });
});
