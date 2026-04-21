/**
 * CustomerSummaryPrintPage.test.tsx
 *
 * PR12 — Component tests for the customer share / print summary page.
 *
 * Tests
 * ─────
 *   - Renders all four customer-facing sections
 *   - No engineer-only sections leak onto the page
 *   - Empty/sparse states appear correctly
 *   - Print and Share action buttons render when a pack is loaded
 *   - Error / missing-pack state renders when no valid pack is provided
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CustomerSummaryPrintPage from '../components/CustomerSummaryPrintPage';
import type { VisitHandoffPack } from '../types/visitHandoffPack';
import { SAMPLE_VISIT_HANDOFF_PACK } from '../fixtures/sampleVisitHandoffPack';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FULL_PACK: VisitHandoffPack = {
  ...SAMPLE_VISIT_HANDOFF_PACK,
  customerSummary: {
    address: '14 Acacia Road, London, SW1A 1AA',
    currentSystemDescription:
      'You currently have a combination boiler providing central heating and on-demand hot water.',
    findings: [
      'The boiler is over 15 years old.',
      'One radiator in the kitchen is not heating correctly.',
    ],
    plannedWork: [
      'Replace existing boiler with a new high-efficiency model.',
      'Balance radiators throughout.',
    ],
    nextSteps: 'Your engineer will be in touch within two working days.',
  },
};

const SPARSE_PACK: VisitHandoffPack = {
  ...SAMPLE_VISIT_HANDOFF_PACK,
  customerSummary: {
    address: '1 Test Street',
    findings: [],
    plannedWork: [],
  },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CustomerSummaryPrintPage', () => {

  // ── Section rendering with a full pack ────────────────────────────────────

  describe('renders customer-facing sections', () => {
    it('renders the survey complete banner', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Survey complete')).toBeTruthy();
    });

    it('renders the address in the page header', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('14 Acacia Road, London, SW1A 1AA')).toBeTruthy();
    });

    it('renders all findings', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('The boiler is over 15 years old.')).toBeTruthy();
      expect(screen.getByText('One radiator in the kitchen is not heating correctly.')).toBeTruthy();
    });

    it('renders all planned work items', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Replace existing boiler with a new high-efficiency model.')).toBeTruthy();
      expect(screen.getByText('Balance radiators throughout.')).toBeTruthy();
    });

    it('renders next steps', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Your engineer will be in touch within two working days.')).toBeTruthy();
    });

    it('renders the current system description', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(
        screen.getByText(
          'You currently have a combination boiler providing central heating and on-demand hot water.',
        ),
      ).toBeTruthy();
    });

    it('renders the "What we found" section heading', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('csp-section-findings')).toBeTruthy();
    });

    it('renders the "What\'s planned" section heading', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('csp-section-planned')).toBeTruthy();
    });

    it('renders the "What happens next" section heading', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('csp-section-next-steps')).toBeTruthy();
    });
  });

  // ── Engineer-only data must not appear ────────────────────────────────────

  describe('no engineer-only data leaks', () => {
    it('does not render room names', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      // Engineer section contains room names — must not appear on customer page
      expect(screen.queryByText('Living Room')).toBeNull();
    });

    it('does not render key object types', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      // "Worcester Bosch Greenstar 28i" is an engineer field
      expect(screen.queryByText(/Worcester Bosch/)).toBeNull();
    });

    it('does not render access notes', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      // Access note from the fixture
      expect(screen.queryByText(/Narrow cupboard/)).toBeNull();
    });

    it('does not render room plan notes', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText(/two-storey semi-detached/i)).toBeNull();
    });

    it('does not render spec notes', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText(/22 mm primary/)).toBeNull();
    });

    it('does not render field notes summary', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText(/Asbestos survey/)).toBeNull();
    });

    it('does not render an engineer tab or engineer view heading', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText('Engineer view')).toBeNull();
    });

    it('does not render raw JSON controls', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText(/Show raw JSON/)).toBeNull();
    });
  });

  // ── Empty / sparse states ─────────────────────────────────────────────────

  describe('empty state messages', () => {
    it('shows "No additional findings recorded." when findings is empty', () => {
      render(<CustomerSummaryPrintPage initialPack={SPARSE_PACK} />);
      expect(screen.getByText('No additional findings recorded.')).toBeTruthy();
    });

    it('shows "No planned work recorded." when plannedWork is empty', () => {
      render(<CustomerSummaryPrintPage initialPack={SPARSE_PACK} />);
      expect(screen.getByText('No planned work recorded.')).toBeTruthy();
    });

    it('shows installer confirmation message when nextSteps is absent', () => {
      render(<CustomerSummaryPrintPage initialPack={SPARSE_PACK} />);
      expect(
        screen.getByText('Next steps will be confirmed by your installer.'),
      ).toBeTruthy();
    });

    it('does not show currentSystemDescription when absent', () => {
      render(<CustomerSummaryPrintPage initialPack={SPARSE_PACK} />);
      expect(screen.queryByText(/combination boiler/)).toBeNull();
    });
  });

  // ── Print and Share action buttons ────────────────────────────────────────

  describe('action buttons', () => {
    it('renders the Print summary button when a pack is loaded', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('csp-print-button')).toBeTruthy();
    });

    it('renders the Share summary button when a pack is loaded', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('csp-share-button')).toBeTruthy();
    });

    it('does not render Print or Share buttons when no pack is available', () => {
      render(<CustomerSummaryPrintPage initialPack={null} />);
      expect(screen.queryByTestId('csp-print-button')).toBeNull();
      expect(screen.queryByTestId('csp-share-button')).toBeNull();
    });
  });

  // ── Back button ───────────────────────────────────────────────────────────

  describe('back button', () => {
    it('renders back button when onBack is provided', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} onBack={() => {}} />);
      expect(screen.getByText('← Back')).toBeTruthy();
    });

    it('does not render back button when onBack is absent', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.queryByText('← Back')).toBeNull();
    });
  });

  // ── Error / missing-pack state ────────────────────────────────────────────

  describe('missing or invalid pack', () => {
    it('shows missing-pack message when initialPack is null', () => {
      render(<CustomerSummaryPrintPage initialPack={null} />);
      expect(screen.getByTestId('csp-missing-pack')).toBeTruthy();
      expect(screen.getByText('No summary available')).toBeTruthy();
    });

    it('shows missing-pack message when no initialPack is provided', () => {
      render(<CustomerSummaryPrintPage />);
      expect(screen.getByTestId('csp-missing-pack')).toBeTruthy();
    });

    it('does not show the survey complete banner on missing-pack state', () => {
      render(<CustomerSummaryPrintPage initialPack={null} />);
      expect(screen.queryByText('Survey complete')).toBeNull();
    });
  });

  // ── Print-related class/container structure ───────────────────────────────

  describe('print container structure', () => {
    it('renders the csp-page container', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('csp-page')).toBeTruthy();
    });

    it('renders the csp-toolbar container', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByTestId('csp-toolbar')).toBeTruthy();
    });

    it('renders the csp-wrap outer element with correct class', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      const toolbar = screen.getByTestId('csp-toolbar');
      const wrap = toolbar.parentElement;
      expect(wrap?.className).toContain('csp-wrap');
    });

    it('renders the "Generated from Atlas visit handoff" footer', () => {
      render(<CustomerSummaryPrintPage initialPack={FULL_PACK} />);
      expect(screen.getByText('Generated from Atlas visit handoff')).toBeTruthy();
    });
  });
});
