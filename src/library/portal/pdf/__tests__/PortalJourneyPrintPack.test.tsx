import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PortalJourneyPrintPack } from '../PortalJourneyPrintPack';
import { buildPortalJourneyPrintModel } from '../buildPortalJourneyPrintModel';

const BASE_MODEL = buildPortalJourneyPrintModel({
  selectedSectionIds: ['CON_A01', 'CON_C02', 'CON_C01'],
  recommendationSummary: 'Sealed system with unvented cylinder — the right fit for this home.',
  customerFacts: ['4-person household', '2 bathrooms', 'Regular boiler, open-vented circuit'],
  brandProfile: { name: 'Atlas Heating' },
});

const HEAT_PUMP_MODEL = buildPortalJourneyPrintModel({
  journeyType: 'heat_pump',
  selectedSectionIds: ['CON_E02', 'CON_H01', 'CON_H04', 'CON_G01', 'CON_I01_DAY_TO_DAY'],
  recommendationSummary: 'Heat pump with low-temperature radiators — a steady comfort fit for this home.',
  customerFacts: ['3-person household', '2 bathrooms', 'Heat pump with low-temperature radiators'],
});

// ─── Document structure ───────────────────────────────────────────────────────

describe('PortalJourneyPrintPack — document structure', () => {
  it('renders the document wrapper', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-document')).toBeInTheDocument();
  });

  it('document is marked print-safe', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-document')).toHaveAttribute('data-print-safe', 'true');
  });

  it('renders the cover page', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-cover')).toBeInTheDocument();
  });

  it('renders next-steps section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-next-steps')).toBeInTheDocument();
  });

  it('renders QR destinations section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-qr-list')).toBeInTheDocument();
  });
});

// ─── Cover page ───────────────────────────────────────────────────────────────

describe('PortalJourneyPrintPack — cover page', () => {
  it('renders the cover title', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-cover-title')).toHaveTextContent(BASE_MODEL.cover.title);
  });

  it('renders the cover summary', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-cover-summary')).toHaveTextContent(BASE_MODEL.cover.summary);
  });

  it('renders the brand name when present', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-cover-brand')).toHaveTextContent('Atlas Heating');
  });

  it('does not render brand name element when brandName is absent', () => {
    const modelNoBrand = buildPortalJourneyPrintModel({
      selectedSectionIds: ['CON_A01'],
      recommendationSummary: 'Test',
      customerFacts: [],
    });
    render(<PortalJourneyPrintPack model={modelNoBrand} />);
    expect(screen.queryByTestId('pjpp-cover-brand')).toBeNull();
  });

  it('renders the customer facts', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    const factsEl = screen.getByTestId('pjpp-cover-facts');
    expect(within(factsEl).getByText('4-person household')).toBeInTheDocument();
    expect(within(factsEl).getByText('2 bathrooms')).toBeInTheDocument();
  });
});

// ─── Content sections ─────────────────────────────────────────────────────────

describe('PortalJourneyPrintPack — content sections', () => {
  it('renders what_changes section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-section-what_changes')).toBeInTheDocument();
  });

  it('renders what_stays_familiar section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-section-what_stays_familiar')).toBeInTheDocument();
  });

  it('renders pressure_vs_storage section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-section-pressure_vs_storage')).toBeInTheDocument();
  });

  it('renders unvented_safety section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-section-unvented_safety')).toBeInTheDocument();
  });

  it('renders living_with_your_system section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-section-living_with_your_system')).toBeInTheDocument();
  });

  it('each section has a heading', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    for (const section of BASE_MODEL.sections) {
      const el = screen.getByTestId(`pjpp-section-${section.sectionId}`);
      const heading = within(el).getByRole('heading');
      expect(heading).toBeInTheDocument();
      expect(heading.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('each section renders its items list', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    for (const section of BASE_MODEL.sections) {
      expect(screen.getByTestId(`pjpp-items-${section.sectionId}`)).toBeInTheDocument();
    }
  });
});

// ─── No interactive controls ──────────────────────────────────────────────────

describe('PortalJourneyPrintPack — no interactive controls', () => {
  it('renders no button elements', () => {
    const { container } = render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('renders no input elements', () => {
    const { container } = render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(container.querySelectorAll('input')).toHaveLength(0);
  });

  it('renders no select elements', () => {
    const { container } = render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(container.querySelectorAll('select')).toHaveLength(0);
  });
});

// ─── No dev labels ────────────────────────────────────────────────────────────

describe('PortalJourneyPrintPack — no dev labels', () => {
  it('does not render raw CON_ content IDs', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.queryByText(/CON_A01/)).toBeNull();
    expect(screen.queryByText(/CON_C01/)).toBeNull();
    expect(screen.queryByText(/CON_C02/)).toBeNull();
  });

  it('does not render raw taxonomy concept IDs', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.queryByText(/sealed_system_conversion/)).toBeNull();
    expect(screen.queryByText(/unvented_safety_reassurance/)).toBeNull();
    expect(screen.queryByText(/pressure_vs_storage/)).toBeNull();
  });

  it('does not render "content pending" placeholder text', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.queryByText(/content pending/i)).toBeNull();
  });
});

// ─── No raw engine terms ──────────────────────────────────────────────────────

describe('PortalJourneyPrintPack — no raw engine terms', () => {
  it('does not use forbidden terminology in cover', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    const cover = screen.getByTestId('pjpp-cover');
    expect(within(cover).queryByText(/gravity system/i)).toBeNull();
    expect(within(cover).queryByText(/low pressure system/i)).toBeNull();
    expect(within(cover).queryByText(/high pressure system/i)).toBeNull();
    expect(within(cover).queryByText(/instantaneous hot water/i)).toBeNull();
  });
});

// ─── Print-safe diagrams ──────────────────────────────────────────────────────

describe('PortalJourneyPrintPack — print-safe diagrams', () => {
  it('diagram containers are marked data-print-safe', () => {
    const { container } = render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    const diagramContainers = container.querySelectorAll('[data-print-safe="true"]');
    // document root + QR placeholders + any diagram figures
    expect(diagramContainers.length).toBeGreaterThan(0);
  });

  it('diagram figures render within section containers', () => {
    const { container } = render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    const diagrams = container.querySelectorAll('[data-testid^="pjpp-diagram-"]');
    // At least one diagram should be present (what_changes or pressure_vs_storage)
    expect(diagrams.length).toBeGreaterThan(0);
  });
});

// ─── Page budget ──────────────────────────────────────────────────────────────

describe('PortalJourneyPrintPack — page budget', () => {
  it('model page budget does not exceed 7', () => {
    expect(BASE_MODEL.pageEstimate.usedPages).toBeLessThanOrEqual(7);
    expect(BASE_MODEL.pageEstimate.maxPages).toBe(7);
  });
});

// ─── QR / next steps ──────────────────────────────────────────────────────────

describe('PortalJourneyPrintPack — next steps and QR', () => {
  it('renders at least one next step', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    const list = screen.getByTestId('pjpp-next-steps-list');
    const items = within(list).getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
  });

  it('renders at least one QR destination', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    const list = screen.getByTestId('pjpp-qr-list');
    const items = within(list).getAllByRole('listitem');
    expect(items.length).toBeGreaterThan(0);
  });
});

describe('PortalJourneyPrintPack — customer page titles and hierarchy', () => {
  it('renders customer page titles in order', () => {
    const { container } = render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    const titles = Array.from(container.querySelectorAll('.pjpp-page h1, .pjpp-page h2')).map((el) =>
      el.textContent?.trim(),
    );
    expect(titles).toEqual([
      'Your recommendation',
      'What changes in your home',
      'Why stored hot water helps',
      'What stays familiar',
      'How the cylinder keeps itself safe',
      'Living with the system',
      'What happens next',
    ]);
  });

  it('renders one key takeaway and one reassurance block per content page', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    for (const section of BASE_MODEL.sections) {
      expect(screen.getByTestId(`pjpp-takeaway-${section.sectionId}`)).toBeInTheDocument();
      expect(screen.getByTestId(`pjpp-reassurance-${section.sectionId}`)).toBeInTheDocument();
    }
  });
});

describe('PortalJourneyPrintPack — page density and language checks', () => {
  it('does not render more than three cards per page', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    for (const section of BASE_MODEL.sections) {
      const list = screen.getByTestId(`pjpp-items-${section.sectionId}`);
      expect(within(list).getAllByRole('listitem').length).toBeLessThanOrEqual(3);
    }
    expect(within(screen.getByTestId('pjpp-next-steps-list')).getAllByRole('listitem').length).toBeLessThanOrEqual(3);
    expect(within(screen.getByTestId('pjpp-qr-list')).getAllByRole('listitem').length).toBeLessThanOrEqual(3);
  });

  it('does not render debug markers or raw technical IDs', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.queryByText(/🔬/)).toBeNull();
    expect(screen.queryByText(/not customer data/i)).toBeNull();
    expect(screen.queryByText(/content pending/i)).toBeNull();
    expect(screen.getByText(/The loft tank is no longer needed\./i)).toBeInTheDocument();
    expect(screen.getByText(/Visible safety parts are expected in a compliant setup\./i)).toBeInTheDocument();
  });
});

describe('PortalJourneyPrintPack — heat-pump supporting PDF', () => {
  it('renders expected heat-pump section headings', () => {
    render(<PortalJourneyPrintPack model={HEAT_PUMP_MODEL} />);
    expect(screen.getByRole('heading', { name: 'Why radiators may feel warm, not hot' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How steady running works' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What happens in winter' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Living with the system' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What happens next' })).toBeInTheDocument();
  });

  it('keeps customer copy free of pending/debug/raw IDs', () => {
    const { container } = render(<PortalJourneyPrintPack model={HEAT_PUMP_MODEL} />);
    expect(container.textContent).not.toMatch(/content pending|debug|CON_[A-Z0-9_]+/i);
  });
});

// ─── No guessed CWS tank capacity ─────────────────────────────────────────────

describe('PortalJourneyPrintPack — no guessed CWS tank capacity', () => {
  it('does not render the generic "100–150 L" guessed CWS tank label', () => {
    const { container } = render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(container.textContent).not.toContain('100–150 L');
    expect(container.textContent).not.toContain('100-150 L');
  });

  it('does not render any guessed litre ranges for loft cold-water storage tanks', () => {
    const { container } = render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    // The CWS (cold-water storage) loft tank must not show a guessed range.
    // "150–250 L" in PressureVsStorageDiagram is legitimate educational content
    // for the proposed new unvented cylinder and is intentionally excluded from this check.
    expect(container.textContent).not.toContain('100–150 L');
    expect(container.textContent).not.toContain('110–140 L');
  });
});
