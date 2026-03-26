// src/components/story/__tests__/PhysicsStoryPanel.test.tsx
//
// Tests for the PhysicsStoryPanel and PhysicsStoryCard components.
//
// Coverage:
//   - PhysicsStoryPanel renders without crashing
//   - Shows "Physics Story Mode" heading
//   - Renders correct number of story cards from engine output
//   - Shows empty state when no signals are triggered
//   - Close button calls onClose
//   - PhysicsStoryCard renders title, summary, and evidence line
//   - PhysicsStoryCard "Open explainer" button fires onOpenExplainer
//   - PhysicsStoryCard "Show simulation" button fires onShowSimulation
//   - Buttons are absent when no handlers are provided

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PhysicsStoryPanel from '../PhysicsStoryPanel';
import PhysicsStoryCard from '../PhysicsStoryCard';
import type { EngineOutputV1, OptionCardV1, LimiterV1 } from '../../../contracts/EngineOutputV1';
import type { PhysicsStoryCard as PhysicsStoryCardData } from '../../../lib/story/buildPhysicsStory';

// ── Fixtures ───────────────────────────────────────────────────────────────────

function makeOption(
  id: OptionCardV1['id'],
  status: OptionCardV1['status'],
): OptionCardV1 {
  return {
    id,
    label: id === 'stored_unvented' ? 'Unvented cylinder system' : id,
    status,
    headline: `${id} headline`,
    why: [],
    requirements: [],
    typedRequirements: { mustHave: [], likelyUpgrades: [], niceToHave: [] },
    heat:        { status: 'ok', headline: '', bullets: [] },
    dhw:         { status: 'ok', headline: '', bullets: [] },
    engineering: { status: 'ok', headline: '', bullets: [] },
  };
}

function makeLimiter(id: LimiterV1['id']): LimiterV1 {
  return {
    id,
    title: `${id} title`,
    severity: 'warn',
    observed: { label: 'Observed', value: '22 mm' },
    limit:    { label: 'Limit',    value: '28 mm' },
    impact: { summary: `${id} impact summary` },
    confidence: 'medium',
    sources: [],
    suggestedFixes: [],
  };
}

const EMPTY_OUTPUT: EngineOutputV1 = {
  eligibility:    [],
  redFlags:       [],
  recommendation: { primary: 'Combi boiler' },
  explainers:     [],
  limiters:       { limiters: [] },
  options:        [],
};

// Engine output that triggers combi + stored signals
const RICH_OUTPUT: EngineOutputV1 = {
  ...EMPTY_OUTPUT,
  options: [
    makeOption('combi', 'caution'),
    makeOption('stored_unvented', 'viable'),
  ],
};

const SAMPLE_CARD: PhysicsStoryCardData = {
  id: 'combi_peak_demand_penalty',
  position: 1,
  title: 'Your peak hot-water demand is the deciding factor',
  summary: 'With multiple bathrooms, outlets can overlap.',
  evidenceLine: '2 bathrooms · 4 occupants',
  visualiserId: 'hot_water_concurrency',
  explainerId: 'combi_flow_limit',
};

// ── PhysicsStoryPanel ─────────────────────────────────────────────────────────

describe('PhysicsStoryPanel — rendering', () => {
  it('renders without crashing', () => {
    expect(() =>
      render(<PhysicsStoryPanel engineOutput={EMPTY_OUTPUT} onClose={() => {}} />),
    ).not.toThrow();
  });

  it('shows "PHYSICS STORY MODE" eyebrow label', () => {
    render(<PhysicsStoryPanel engineOutput={EMPTY_OUTPUT} onClose={() => {}} />);
    expect(screen.getByText(/PHYSICS STORY MODE/i)).toBeTruthy();
  });

  it('shows "Why Atlas recommends this" heading', () => {
    render(<PhysicsStoryPanel engineOutput={EMPTY_OUTPUT} onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: /why atlas recommends this/i })).toBeTruthy();
  });
});

describe('PhysicsStoryPanel — empty state', () => {
  it('renders empty state when no signals are triggered', () => {
    render(<PhysicsStoryPanel engineOutput={EMPTY_OUTPUT} onClose={() => {}} />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByText(/no specific physics signals/i)).toBeTruthy();
  });
});

describe('PhysicsStoryPanel — story cards', () => {
  it('renders story cards when signals are triggered by engine output', () => {
    render(<PhysicsStoryPanel engineOutput={RICH_OUTPUT} onClose={() => {}} />);
    // The combi caution + stored viable should trigger at least one card
    const articles = screen.getAllByRole('article');
    expect(articles.length).toBeGreaterThan(0);
  });

  it('renders pipe constraint card when limiter is present', () => {
    const output: EngineOutputV1 = {
      ...EMPTY_OUTPUT,
      limiters: { limiters: [makeLimiter('primary-pipe-constraint')] },
    };
    render(<PhysicsStoryPanel engineOutput={output} onClose={() => {}} />);
    expect(screen.getByText(/existing pipework limits heat pump flow/i)).toBeTruthy();
  });
});

describe('PhysicsStoryPanel — close button', () => {
  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    render(<PhysicsStoryPanel engineOutput={EMPTY_OUTPUT} onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: /close physics story mode/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── PhysicsStoryCard ──────────────────────────────────────────────────────────

describe('PhysicsStoryCard — rendering', () => {
  it('renders without crashing', () => {
    expect(() =>
      render(<PhysicsStoryCard card={SAMPLE_CARD} />),
    ).not.toThrow();
  });

  it('renders the card title', () => {
    render(<PhysicsStoryCard card={SAMPLE_CARD} />);
    expect(screen.getByRole('heading', { name: /your peak hot-water demand is the deciding factor/i })).toBeTruthy();
  });

  it('renders the card summary', () => {
    render(<PhysicsStoryCard card={SAMPLE_CARD} />);
    expect(screen.getByText(/with multiple bathrooms, outlets can overlap/i)).toBeTruthy();
  });

  it('renders the evidence line', () => {
    render(<PhysicsStoryCard card={SAMPLE_CARD} />);
    expect(screen.getByText(/2 bathrooms · 4 occupants/i)).toBeTruthy();
  });

  it('does not render evidence section when evidenceLine is null', () => {
    const card: PhysicsStoryCardData = { ...SAMPLE_CARD, evidenceLine: null };
    render(<PhysicsStoryCard card={card} />);
    expect(screen.queryByLabelText(/supporting evidence/i)).toBeNull();
  });

  it('renders position badge', () => {
    render(<PhysicsStoryCard card={SAMPLE_CARD} />);
    expect(screen.getByText('1')).toBeTruthy();
  });
});

describe('PhysicsStoryCard — action buttons', () => {
  it('renders "Open explainer" button when handler is provided', () => {
    render(<PhysicsStoryCard card={SAMPLE_CARD} onOpenExplainer={() => {}} />);
    expect(
      screen.getByRole('button', { name: /open explainer for:/i }),
    ).toBeTruthy();
  });

  it('calls onOpenExplainer with the explainerId when clicked', () => {
    const onOpenExplainer = vi.fn();
    render(<PhysicsStoryCard card={SAMPLE_CARD} onOpenExplainer={onOpenExplainer} />);
    fireEvent.click(screen.getByRole('button', { name: /open explainer for:/i }));
    expect(onOpenExplainer).toHaveBeenCalledWith('combi_flow_limit');
  });

  it('renders "Open visualiser" button when handler is provided', () => {
    render(<PhysicsStoryCard card={SAMPLE_CARD} onShowSimulation={() => {}} />);
    expect(
      screen.getByRole('button', { name: /open visualiser for:/i }),
    ).toBeTruthy();
  });

  it('calls onShowSimulation with the visualiserId when clicked', () => {
    const onShowSimulation = vi.fn();
    render(<PhysicsStoryCard card={SAMPLE_CARD} onShowSimulation={onShowSimulation} />);
    fireEvent.click(screen.getByRole('button', { name: /open visualiser for:/i }));
    expect(onShowSimulation).toHaveBeenCalledWith('hot_water_concurrency');
  });

  it('does not render action buttons when handlers are absent', () => {
    render(<PhysicsStoryCard card={SAMPLE_CARD} />);
    expect(screen.queryByRole('button', { name: /open explainer/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /open visualiser/i })).toBeNull();
  });

  it('does not render action buttons when visualiserId and explainerId are null', () => {
    const card: PhysicsStoryCardData = {
      ...SAMPLE_CARD,
      visualiserId: null,
      explainerId: null,
    };
    render(
      <PhysicsStoryCard
        card={card}
        onOpenExplainer={() => {}}
        onShowSimulation={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /open explainer/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /open visualiser/i })).toBeNull();
  });
});
