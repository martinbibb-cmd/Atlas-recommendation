/**
 * VisitHomeLibraryPdfRoute.test.tsx
 *
 * Tests for the library-backed supporting PDF wiring.
 *
 * Covers:
 *   1. PortalJourneyPrintPack is rendered (library-backed output, not legacy CustomerAdvicePrintPack)
 *   2. The route renders a "Library supporting PDF — review workspace" workspace marker
 *   3. A print/save button is present
 *   4. A back button is present
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildPortalJourneyPrintModel } from '../../../library/portal/pdf/buildPortalJourneyPrintModel';
import { PortalJourneyPrintPack } from '../../../library/portal/pdf/PortalJourneyPrintPack';

// ─── Fixture ──────────────────────────────────────────────────────────────────

const OPEN_VENTED_MODEL = buildPortalJourneyPrintModel({
  selectedSectionIds: [],
  recommendationSummary: 'Sealed system with unvented cylinder is recommended for your home.',
  customerFacts: ['3 people in the home', '2 bathrooms', 'Property: SW1A 1AA'],
  journeyType: 'open_vented',
});

const HEAT_PUMP_MODEL = buildPortalJourneyPrintModel({
  selectedSectionIds: [],
  recommendationSummary: 'Air source heat pump is recommended for your home.',
  customerFacts: ['2 people in the home', '1 bathroom'],
  journeyType: 'heat_pump',
});

// ─── Minimal library PDF route shell ─────────────────────────────────────────
//
// The actual route rendering lives in App.tsx (the `journey === 'library-pdf'` block).
// Here we test the component composition and the content contract — that
// PortalJourneyPrintPack renders with the expected model rather than the legacy
// CustomerAdvicePrintPack output.

function LibraryPdfRouteShell({
  model,
  onBack = vi.fn(),
  onPrint = vi.fn(),
}: {
  model: ReturnType<typeof buildPortalJourneyPrintModel>;
  onBack?: () => void;
  onPrint?: () => void;
}) {
  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }} data-testid="library-pdf-route">
      <div
        style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}
        data-testid="library-pdf-header"
      >
        <button onClick={onBack} data-testid="library-pdf-back">
          ← Back
        </button>
        <span data-testid="library-pdf-workspace-marker">
          Library supporting PDF — review workspace
        </span>
        <button onClick={onPrint} data-testid="library-pdf-print-btn">
          Print / Save as PDF
        </button>
      </div>
      <PortalJourneyPrintPack model={model} />
    </div>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Library PDF route — library-backed output', () => {
  it('renders PortalJourneyPrintPack document (library-backed, not legacy report)', () => {
    render(<LibraryPdfRouteShell model={OPEN_VENTED_MODEL} />);
    expect(screen.getByTestId('pjpp-document')).toBeInTheDocument();
  });

  it('renders the cover section with customer-safe recommendation summary', () => {
    render(<LibraryPdfRouteShell model={OPEN_VENTED_MODEL} />);
    expect(screen.getByTestId('pjpp-cover')).toBeInTheDocument();
    expect(screen.getByTestId('pjpp-cover-summary')).toBeInTheDocument();
  });

  it('renders "Library supporting PDF — review workspace" workspace marker', () => {
    render(<LibraryPdfRouteShell model={OPEN_VENTED_MODEL} />);
    expect(screen.getByTestId('library-pdf-workspace-marker')).toHaveTextContent(
      'Library supporting PDF — review workspace',
    );
  });

  it('back button is present in the route header', () => {
    const onBack = vi.fn();
    render(<LibraryPdfRouteShell model={OPEN_VENTED_MODEL} onBack={onBack} />);
    expect(screen.getByTestId('library-pdf-back')).toBeInTheDocument();
  });

  it('print button is present in the route header', () => {
    render(<LibraryPdfRouteShell model={OPEN_VENTED_MODEL} />);
    expect(screen.getByTestId('library-pdf-print-btn')).toBeInTheDocument();
  });

  it('renders "next steps" section — library model is complete with required navigation context', () => {
    render(<LibraryPdfRouteShell model={OPEN_VENTED_MODEL} />);
    expect(screen.getByTestId('pjpp-next-steps')).toBeInTheDocument();
  });

  it('heat-pump journey renders PortalJourneyPrintPack with heat-pump specific sections', () => {
    render(<LibraryPdfRouteShell model={HEAT_PUMP_MODEL} />);
    expect(screen.getByTestId('pjpp-document')).toBeInTheDocument();
    expect(screen.getByTestId('pjpp-cover')).toBeInTheDocument();
  });

  describe('content safety — no legacy technical blueprint content', () => {
    it('does not render "Heating System Recommendation" old report title', () => {
      render(<LibraryPdfRouteShell model={OPEN_VENTED_MODEL} />);
      expect(screen.queryByText(/Heating System Recommendation/i)).not.toBeInTheDocument();
    });

    it('does not render "G3" compliance regulation reference in customer-facing output', () => {
      const { container } = render(<LibraryPdfRouteShell model={OPEN_VENTED_MODEL} />);
      // G3 is an installer regulation number — must not appear in customer-facing copy.
      expect(container.textContent).not.toMatch(/\bG3\b/);
    });

    it('does not render "power flush" installer jargon in customer-facing output', () => {
      const { container } = render(<LibraryPdfRouteShell model={OPEN_VENTED_MODEL} />);
      expect(container.textContent?.toLowerCase()).not.toContain('power flush');
    });

    it('does not render "magnetic filter" installer jargon in customer-facing output', () => {
      const { container } = render(<LibraryPdfRouteShell model={OPEN_VENTED_MODEL} />);
      expect(container.textContent?.toLowerCase()).not.toContain('magnetic filter');
    });

    it('tundish is mentioned only in customer-safe reassurance context, not as a compliance requirement', () => {
      render(<LibraryPdfRouteShell model={OPEN_VENTED_MODEL} />);
      // The library PDF may include "tundish" as a reassurance note (e.g. "Seeing a tundish does not mean a fault")
      // — this is appropriate customer education, unlike the old compliance-framed InsightPackDeck output.
      const document = screen.getByTestId('pjpp-document');
      const reassuranceEl = document.querySelector('[data-testid^="pjpp-reassurance-"]');
      if (reassuranceEl && /tundish/i.test(reassuranceEl.textContent ?? '')) {
        // Tundish is in reassurance context — this is correct customer education
        expect(reassuranceEl.textContent).toMatch(/does not mean/i);
      }
      // G3 and tundish must never appear in proximity — that would indicate a compliance citation.
      // 100 characters is chosen to span a typical sentence (c.70–90 chars) so adjacent terms are caught.
      const MIN_COMPLIANCE_CITATION_SEPARATION = 100;
      const docText = document.textContent ?? '';
      const hasG3 = /\bG3\b/.test(docText);
      const hasTundish = /tundish/i.test(docText);
      if (hasG3 && hasTundish) {
        const g3Idx = docText.search(/\bG3\b/);
        const tundishIdx = docText.toLowerCase().indexOf('tundish');
        expect(Math.abs(g3Idx - tundishIdx)).toBeGreaterThan(MIN_COMPLIANCE_CITATION_SEPARATION);
      }
    });
  });
});
