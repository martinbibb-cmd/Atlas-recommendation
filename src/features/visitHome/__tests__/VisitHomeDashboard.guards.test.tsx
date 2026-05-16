/**
 * VisitHomeDashboard.guards.test.tsx
 *
 * Tests for the Visit Home Dashboard promotion to default visit entry.
 *
 * Covers:
 *   1. default visit opens dashboard — VisitHomeDashboard renders with visitId + engine data
 *   2. dashboard home button returns from child surfaces — onBack fires correctly
 *   3. unsafe library blocks customer PDF/portal card — libraryUnsafe prop
 *   4. simulator still launches existing path — onOpenSimulator called (preserved)
 *   5. continue-where-you-left-off banner shown and dismissable
 *   6. direct dev routes still work — visit-home does not affect URL-param routes
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VisitHomeDashboard } from '../VisitHomeDashboard';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';
import type { EngineInputV2_3 } from '../../../engine/schema/EngineInputV2_3';

// ─── Minimal fixtures ─────────────────────────────────────────────────────────

const ENGINE_INPUT: EngineInputV2_3 = {
  postcode: 'SW1A 1AA',
  heatLossWatts: 8000,
  bathroomCount: 1,
  occupancyCount: 3,
  dynamicMainsPressure: 2.0,
  mainsDynamicFlowLpm: 14,
};

const ENGINE_OUTPUT: Partial<EngineOutputV1> = {
  recommendation: { primary: 'combi' },
  eligibility: [],
  redFlags: [],
  explainers: [],
};

// ─── Default props factory ────────────────────────────────────────────────────

function makeProps(
  overrides: Partial<React.ComponentProps<typeof VisitHomeDashboard>> = {},
) {
  return {
    visitId: 'visit-abc123',
    engineInput: ENGINE_INPUT,
    engineOutput: ENGINE_OUTPUT as EngineOutputV1,
    scenarios: [],
    workspaceRole: 'admin',
    onOpenSimulator: vi.fn(),
    onOpenPresentation: vi.fn(),
    onPrintSummary: vi.fn(),
    onOpenInstallationSpecification: vi.fn(),
    onBack: vi.fn(),
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VisitHomeDashboard — promoted to default visit entry', () => {

  // ── 1. Default visit opens dashboard ─────────────────────────────────────

  describe('default visit opens dashboard', () => {
    it('renders the review title when visitId and engine data are provided', () => {
      render(<VisitHomeDashboard {...makeProps()} />);
      expect(screen.getByText('Review this visit')).toBeInTheDocument();
    });

    it('shows the postcode as the property title when engineInput has postcode', () => {
      render(<VisitHomeDashboard {...makeProps()} />);
      expect(screen.getByText('SW1A 1AA')).toBeInTheDocument();
    });

    it('all seven cards are rendered — full output overview available', () => {
      render(<VisitHomeDashboard {...makeProps()} />);
      expect(screen.getByTestId('card-recommendation')).toBeInTheDocument();
      expect(screen.getByTestId('card-portal')).toBeInTheDocument();
      expect(screen.getByTestId('card-simulator')).toBeInTheDocument();
      expect(screen.getByTestId('card-pdf')).toBeInTheDocument();
      expect(screen.getByTestId('card-implementation')).toBeInTheDocument();
      expect(screen.getByTestId('card-handoff')).toBeInTheDocument();
      expect(screen.getByTestId('card-export')).toBeInTheDocument();
    });

    it('recommendation card is ready when engine data is present', () => {
      render(<VisitHomeDashboard {...makeProps()} />);
      expect(screen.getByTestId('card-recommendation')).toHaveAttribute('data-status', 'ready');
    });

    it('shows visit not ready state — recommendation card is needs-review when only visitId set', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ engineInput: undefined, engineOutput: undefined })}
        />,
      );
      const card = screen.getByTestId('card-recommendation');
      expect(card).toHaveAttribute('data-status', 'needs-review');
    });

    it('shows visit not ready state — recommendation card is blocked when no visit and no engine', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ visitId: undefined, engineInput: undefined, engineOutput: undefined })}
        />,
      );
      const card = screen.getByTestId('card-recommendation');
      expect(card).toHaveAttribute('data-status', 'blocked');
    });
  });

  // ── 2. Dashboard home button returns from child surfaces ──────────────────

  describe('dashboard home button returns from child surfaces', () => {
    it('back button is present on the dashboard', () => {
      render(<VisitHomeDashboard {...makeProps()} />);
      expect(screen.getByTestId('visit-home-back')).toBeInTheDocument();
    });

    it('back button calls onBack — returns engineer to the workspace dashboard', () => {
      const onBack = vi.fn();
      render(<VisitHomeDashboard {...makeProps({ onBack })} />);
      fireEvent.click(screen.getByTestId('visit-home-back'));
      expect(onBack).toHaveBeenCalledOnce();
    });

    it('simulator CTA returns control to the parent via onOpenSimulator handler', () => {
      const onOpenSimulator = vi.fn();
      render(<VisitHomeDashboard {...makeProps({ onOpenSimulator })} />);
      const cta = screen.getByTestId('card-simulator-cta');
      fireEvent.click(cta);
      // Parent (App.tsx) is responsible for setting simulatorFromJourney='visit-home'
      // so that the Back button in the simulator returns here.
      expect(onOpenSimulator).toHaveBeenCalledOnce();
    });

    it('presentation CTA calls onOpenPresentation handler', () => {
      const onOpenPresentation = vi.fn();
      render(<VisitHomeDashboard {...makeProps({ onOpenPresentation })} />);
      const cta = screen.getByTestId('card-recommendation-cta');
      fireEvent.click(cta);
      expect(onOpenPresentation).toHaveBeenCalledOnce();
    });
  });

  // ── 3. Unsafe library blocks customer PDF/portal card ─────────────────────

  describe('unsafe library blocks customer PDF/portal card', () => {
    it('PDF card shows blocked status when libraryUnsafe is true', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ libraryUnsafe: true })}
        />,
      );
      const card = screen.getByTestId('card-pdf');
      expect(card).toHaveAttribute('data-status', 'blocked');
    });

    it('PDF card CTA is disabled when libraryUnsafe is true', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ libraryUnsafe: true })}
        />,
      );
      const cta = screen.getByTestId('card-pdf-cta');
      expect(cta).toBeDisabled();
    });

    it('portal card shows blocked status when libraryUnsafe is true', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ libraryUnsafe: true })}
        />,
      );
      const card = screen.getByTestId('card-portal');
      expect(card).toHaveAttribute('data-status', 'blocked');
    });

    it('portal card CTA is disabled when libraryUnsafe is true', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ libraryUnsafe: true })}
        />,
      );
      const cta = screen.getByTestId('card-portal-cta');
      expect(cta).toBeDisabled();
    });

    it('shows the first block reason in the PDF card description', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({
            libraryUnsafe: true,
            libraryBlockReasons: ['Projection safety: leakage term found in visible content'],
          })}
        />,
      );
      const card = screen.getByTestId('card-pdf');
      expect(card).toHaveTextContent('Projection safety: leakage term found in visible content');
    });

    it('shows the first block reason in the portal card description', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({
            libraryUnsafe: true,
            libraryBlockReasons: ['Missing required content: diagrams'],
          })}
        />,
      );
      const card = screen.getByTestId('card-portal');
      expect(card).toHaveTextContent('Missing required content: diagrams');
    });

    it('PDF card is ready (not blocked) when libraryUnsafe is false', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ libraryUnsafe: false })}
        />,
      );
      expect(screen.getByTestId('card-pdf')).toHaveAttribute('data-status', 'ready');
    });

    it('non-library cards are unaffected by libraryUnsafe', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ libraryUnsafe: true })}
        />,
      );
      // Simulator and recommendation are not library-gated
      expect(screen.getByTestId('card-simulator')).toHaveAttribute('data-status', 'ready');
      expect(screen.getByTestId('card-recommendation')).toHaveAttribute('data-status', 'ready');
    });
  });

  // ── 4. Simulator still launches existing path ─────────────────────────────

  describe('simulator still launches existing path', () => {
    it('simulator CTA calls onOpenSimulator when engine data is present', () => {
      const onOpenSimulator = vi.fn();
      render(<VisitHomeDashboard {...makeProps({ onOpenSimulator })} />);
      const cta = screen.getByTestId('card-simulator-cta');
      expect(cta).not.toBeDisabled();
      fireEvent.click(cta);
      expect(onOpenSimulator).toHaveBeenCalledOnce();
    });

    it('simulator CTA is enabled even when engine data is absent (needs-review state)', () => {
      const onOpenSimulator = vi.fn();
      render(
        <VisitHomeDashboard
          {...makeProps({ engineInput: undefined, engineOutput: undefined, onOpenSimulator })}
        />,
      );
      // Simulator is always accessible — shows needs-review but CTA is enabled
      const cta = screen.getByTestId('card-simulator-cta');
      expect(cta).not.toBeDisabled();
    });

    it('simulator card status is ready when engine data is available', () => {
      render(<VisitHomeDashboard {...makeProps()} />);
      expect(screen.getByTestId('card-simulator')).toHaveAttribute('data-status', 'ready');
    });
  });

  // ── 5. Continue-where-you-left-off banner ─────────────────────────────────

  describe('continue-where-you-left-off banner', () => {
    it('banner is NOT shown when lastSurface is absent', () => {
      render(<VisitHomeDashboard {...makeProps()} />);
      expect(screen.queryByTestId('visit-home-continue-banner')).not.toBeInTheDocument();
    });

    it('banner is shown when lastSurface and onContinueLastSurface are provided', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({
            lastSurface: 'Simulator',
            onContinueLastSurface: vi.fn(),
          })}
        />,
      );
      expect(screen.getByTestId('visit-home-continue-banner')).toBeInTheDocument();
    });

    it('banner shows the lastSurface label', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({
            lastSurface: 'Supporting PDF',
            onContinueLastSurface: vi.fn(),
          })}
        />,
      );
      expect(screen.getByTestId('visit-home-continue-banner')).toHaveTextContent('Supporting PDF');
    });

    it('banner continue button calls onContinueLastSurface', () => {
      const onContinueLastSurface = vi.fn();
      render(
        <VisitHomeDashboard
          {...makeProps({
            lastSurface: 'Simulator',
            onContinueLastSurface,
          })}
        />,
      );
      fireEvent.click(screen.getByTestId('visit-home-continue-btn'));
      expect(onContinueLastSurface).toHaveBeenCalledOnce();
    });

    it('banner is NOT shown when lastSurface is set but onContinueLastSurface is absent', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ lastSurface: 'Simulator' })}
        />,
      );
      expect(screen.queryByTestId('visit-home-continue-banner')).not.toBeInTheDocument();
    });
  });

  // ── 6. Direct dev routes still work ──────────────────────────────────────

  describe('direct dev routes still work', () => {
    it('renders without crashing when no visitId is present (dev/demo mode)', () => {
      render(
        <VisitHomeDashboard
          {...makeProps({ visitId: undefined })}
        />,
      );
      expect(screen.getByText('Review this visit')).toBeInTheDocument();
    });

    it('visit-home dashboard does not affect URL-param routes — component has no location side-effects', () => {
      // VisitHomeDashboard is a pure UI component with no URL manipulation.
      // Direct URL routes (?devmenu=1, ?simulator=1, etc.) bypass the visit-home
      // journey entirely and are handled by App.tsx before rendering this component.
      // This test confirms the component itself makes no location changes.
      const originalHref = window.location.href;
      render(<VisitHomeDashboard {...makeProps()} />);
      expect(window.location.href).toBe(originalHref);
    });
  });

});
