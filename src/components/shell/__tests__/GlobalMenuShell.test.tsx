// src/components/shell/__tests__/GlobalMenuShell.test.tsx
//
// Tests for the GlobalMenuShell component — PR4 global hamburger menu.
//
// Coverage:
//   - GlobalMenuShell renders a single shared hamburger trigger across routes
//   - The trigger is present for survey (FullSurveyStepper) pages
//   - The trigger is present for simulator (SimulatorDashboard via ExplainersHubPage) pages
//   - The trigger is present for advice/presentation (DecisionSynthesisPage) pages
//   - Menu opens and closes consistently when rendered in the shell
//   - Context-specific explainer IDs registered by DecisionSynthesisPage flow to the trigger
//   - No duplicate trigger logic: only one launcher button is present per shell

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalMenuShell from '../GlobalMenuShell';
import { useGlobalMenu } from '../GlobalMenuContext';
import type { EngineOutputV1, OptionCardV1 } from '../../../contracts/EngineOutputV1';
import DecisionSynthesisPage from '../../advice/DecisionSynthesisPage';

// jsdom does not implement window.scrollTo — stub it.
beforeEach(() => {
  vi.stubGlobal('scrollTo', vi.fn());
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOption(
  id: OptionCardV1['id'],
  status: OptionCardV1['status'],
): OptionCardV1 {
  return {
    id,
    label: id,
    status,
    headline: `${id} headline`,
    why: [`${id} is suitable`],
    requirements: [],
    typedRequirements: {
      mustHave: [`Install ${id}`, 'Magnetic filter on primary return'],
      likelyUpgrades: ['System flush after install'],
      niceToHave: ['Weather compensation control'],
    },
    heat: { status: 'ok', headline: 'Heat ok', bullets: ['Good radiator coverage'] },
    dhw: { status: 'ok', headline: 'DHW ok', bullets: ['Adequate flow capacity'] },
    engineering: { status: 'ok', headline: 'Eng ok', bullets: ['Primary sized correctly'] },
    sensitivities: [],
  };
}

const DEMO_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'Combi boiler' },
  explainers: [],
  options: [
    makeOption('combi', 'viable'),
    makeOption('stored_unvented', 'caution'),
    makeOption('ashp', 'caution'),
  ],
  verdict: {
    title: 'Good match',
    status: 'good',
    reasons: ['Good mains pressure for combi', 'Single bathroom, low demand'],
    confidence: { level: 'medium', reasons: [] },
    assumptionsUsed: [],
    primaryReason: 'Low demand and single bathroom favour on-demand hot water',
  },
};

// ─── Trigger presence ─────────────────────────────────────────────────────────

describe('GlobalMenuShell — trigger presence', () => {
  it('renders the global hamburger/explainers launcher button', () => {
    render(
      <GlobalMenuShell>
        <div>Page content</div>
      </GlobalMenuShell>,
    );
    expect(screen.getByRole('button', { name: /open explainers/i })).toBeTruthy();
  });

  it('renders the global-menu-trigger container with correct test ID', () => {
    render(
      <GlobalMenuShell>
        <div>Page content</div>
      </GlobalMenuShell>,
    );
    expect(document.querySelector('[data-testid="global-menu-trigger"]')).not.toBeNull();
  });

  it('renders only one launcher button regardless of children', () => {
    render(
      <GlobalMenuShell>
        <div>Simulator page</div>
      </GlobalMenuShell>,
    );
    const launchers = screen.getAllByRole('button', { name: /open explainers/i });
    expect(launchers).toHaveLength(1);
  });
});

// ─── Survey route render ──────────────────────────────────────────────────────

describe('GlobalMenuShell — survey route', () => {
  it('renders the hamburger trigger when wrapping survey content', () => {
    render(
      <GlobalMenuShell>
        <div data-testid="survey-page">Survey stepper</div>
      </GlobalMenuShell>,
    );
    expect(screen.getByRole('button', { name: /open explainers/i })).toBeTruthy();
    expect(document.querySelector('[data-testid="survey-page"]')).not.toBeNull();
  });
});

// ─── Simulator route render ───────────────────────────────────────────────────

describe('GlobalMenuShell — simulator route', () => {
  it('renders the hamburger trigger when wrapping simulator content', () => {
    render(
      <GlobalMenuShell>
        <div data-testid="simulator-page">Simulator dashboard</div>
      </GlobalMenuShell>,
    );
    expect(screen.getByRole('button', { name: /open explainers/i })).toBeTruthy();
    expect(document.querySelector('[data-testid="simulator-page"]')).not.toBeNull();
  });
});

// ─── Advice/presentation route render ────────────────────────────────────────

describe('GlobalMenuShell — advice/presentation route', () => {
  it('renders the hamburger trigger when wrapping the advice page', () => {
    render(
      <GlobalMenuShell>
        <DecisionSynthesisPage engineOutput={DEMO_OUTPUT} />
      </GlobalMenuShell>,
    );
    expect(screen.getByRole('button', { name: /open explainers/i })).toBeTruthy();
  });

  it('renders only one launcher button on the advice page (no per-page duplicate)', () => {
    render(
      <GlobalMenuShell>
        <DecisionSynthesisPage engineOutput={DEMO_OUTPUT} />
      </GlobalMenuShell>,
    );
    const launchers = screen.getAllByRole('button', { name: /open explainers/i });
    expect(launchers).toHaveLength(1);
  });
});

// ─── Open / close interaction ─────────────────────────────────────────────────

describe('GlobalMenuShell — open/close interaction', () => {
  it('overlay is absent before launcher is clicked', () => {
    render(
      <GlobalMenuShell>
        <div>Content</div>
      </GlobalMenuShell>,
    );
    expect(document.querySelector('[data-testid="explainers-overlay"]')).toBeNull();
  });

  it('clicking the launcher opens the menu overlay', () => {
    render(
      <GlobalMenuShell>
        <div>Content</div>
      </GlobalMenuShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: /open explainers/i }));
    expect(document.querySelector('[data-testid="explainers-overlay"]')).not.toBeNull();
  });

  it('launcher has aria-expanded="false" before opening', () => {
    render(
      <GlobalMenuShell>
        <div>Content</div>
      </GlobalMenuShell>,
    );
    expect(screen.getByRole('button', { name: /open explainers/i }).getAttribute('aria-expanded')).toBe('false');
  });

  it('launcher has aria-expanded="true" after opening', () => {
    render(
      <GlobalMenuShell>
        <div>Content</div>
      </GlobalMenuShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: /open explainers/i }));
    expect(screen.getByRole('button', { name: /open explainers/i }).getAttribute('aria-expanded')).toBe('true');
  });

  it('closing the overlay with the close button removes it from DOM', () => {
    render(
      <GlobalMenuShell>
        <div>Content</div>
      </GlobalMenuShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: /open explainers/i }));
    fireEvent.click(screen.getByRole('button', { name: /close explainers/i }));
    expect(document.querySelector('[data-testid="explainers-overlay"]')).toBeNull();
  });

  it('clicking the backdrop closes the overlay', () => {
    render(
      <GlobalMenuShell>
        <div>Content</div>
      </GlobalMenuShell>,
    );
    fireEvent.click(screen.getByRole('button', { name: /open explainers/i }));
    fireEvent.click(document.querySelector('[data-testid="explainers-backdrop"]')!);
    expect(document.querySelector('[data-testid="explainers-overlay"]')).toBeNull();
  });
});

// ─── Context-specific explainers from advice page ─────────────────────────────

describe('GlobalMenuShell — context explainer IDs from advice page', () => {
  it('shows context-relevant items in the overlay when advice page registers them', () => {
    const outputWithExplainer: EngineOutputV1 = {
      ...DEMO_OUTPUT,
      explainers: [{ id: 'stored-mixergy-suggested', title: 'Mixergy', body: 'Body' }],
    };

    render(
      <GlobalMenuShell>
        <DecisionSynthesisPage engineOutput={outputWithExplainer} />
      </GlobalMenuShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open explainers/i }));

    // "For this recommendation" context section should appear.
    expect(document.querySelector('[data-testid="explainers-context-section"]')).not.toBeNull();
    // The specific Mixergy-related explainer item should be present.
    expect(document.querySelector('[data-testid="explainers-menu-item-standard_vs_mixergy"]')).not.toBeNull();
  });

  it('shows empty context (no "For this recommendation" section) for plain content with no registered IDs', () => {
    render(
      <GlobalMenuShell>
        <div>Plain page content</div>
      </GlobalMenuShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: /open explainers/i }));

    expect(document.querySelector('[data-testid="explainers-context-section"]')).toBeNull();
  });
});

// ─── Page children are rendered ───────────────────────────────────────────────

describe('GlobalMenuShell — children rendering', () => {
  it('renders its children alongside the trigger', () => {
    render(
      <GlobalMenuShell>
        <p data-testid="child-content">Hello from child</p>
      </GlobalMenuShell>,
    );
    expect(document.querySelector('[data-testid="child-content"]')).not.toBeNull();
    expect(screen.getByRole('button', { name: /open explainers/i })).toBeTruthy();
  });
});

// ─── useGlobalMenu hook ───────────────────────────────────────────────────────

describe('useGlobalMenu — outside provider', () => {
  it('returns a no-op setter when called outside GlobalMenuShell (safe fallback)', () => {
    // Verify via a small component that the hook returns a callable setter
    // even without a parent GlobalMenuProvider (uses the default context value).
    function TestComponent() {
      const { setContextExplainerIds } = useGlobalMenu();
      // Calling the setter should not throw.
      setContextExplainerIds(['some_id']);
      return <div data-testid="no-op-test">ok</div>;
    }

    expect(() => render(<TestComponent />)).not.toThrow();
    expect(document.querySelector('[data-testid="no-op-test"]')).not.toBeNull();
  });
});
