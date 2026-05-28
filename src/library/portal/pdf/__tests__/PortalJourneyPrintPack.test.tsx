import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PortalJourneyPrintPack } from '../PortalJourneyPrintPack';
import { buildPortalJourneyPrintModel } from '../buildPortalJourneyPrintModel';
import * as visualAssetManifest from '../visualAssetManifest';

const BASE_MODEL = buildPortalJourneyPrintModel({
  journeyType: 'open_vented',
  selectedSectionIds: ['CON_A01', 'CON_C02', 'CON_C01'],
  recommendationSummary: 'Sealed system with unvented cylinder — the right fit for this home.',
  customerFacts: ['4-person household', '2 bathrooms', 'Regular boiler, open-vented circuit'],
  brandProfile: { name: 'Atlas Heating' },
});

const HEAT_PUMP_MODEL = buildPortalJourneyPrintModel({
  journeyType: 'heat_pump',
  selectedSectionIds: ['CON_E02', 'CON_H01', 'CON_H04', 'CON_G01'],
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

  it('first page starts at cover title cleanly', () => {
    const { container } = render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    const firstPage = container.querySelector('.pjpp-page[data-page="1"]');
    expect(firstPage).not.toBeNull();
    expect(within(firstPage as HTMLElement).getByTestId('pjpp-cover-title')).toBeInTheDocument();
  });

  it('renders next-steps section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-next-steps')).toBeInTheDocument();
  });

  it('renders technical hand-off section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-technical-handoff')).toBeInTheDocument();
    expect(screen.getByTestId('pjpp-technical-handoff-physical')).toBeInTheDocument();
    expect(screen.getByTestId('pjpp-technical-handoff-planned')).toBeInTheDocument();
  });

  it('renders recommendation reason cards section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-recommendation-reasons')).toBeInTheDocument();
    expect(screen.getByTestId('pjpp-reason-list')).toBeInTheDocument();
    expect(screen.getByTestId('pjpp-visual-grammar')).toHaveTextContent(
      'Fact → Why it matters → Atlas chose → What you will notice',
    );
  });

  it('renders story pages via CustomerScenePrint', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('customer-scene-print')).toBeInTheDocument();
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
      journeyType: 'open_vented',
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
    const demographicsGrid = within(factsEl).getByTestId('pjpp-demographics-grid');
    expect(within(demographicsGrid).getByText('Occupants')).toBeInTheDocument();
    expect(within(demographicsGrid).getByText('Bathrooms')).toBeInTheDocument();
    expect(within(demographicsGrid).getByText('Peak Heat Loss (kW)')).toBeInTheDocument();
    expect(within(demographicsGrid).getByText('Hot Water Demand')).toBeInTheDocument();
    expect(within(demographicsGrid).getAllByText('4-person household').length).toBeGreaterThan(0);
    expect(within(demographicsGrid).getAllByText('2 bathrooms').length).toBeGreaterThan(0);
    expect(screen.getByTestId('pjpp-cover-confidence')).toBeInTheDocument();
    expect(screen.getByTestId('pjpp-cover-fact-chips')).toBeInTheDocument();
  });

  it('renders the dev-only content source line in development mode', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    if (import.meta.env.DEV) {
      expect(screen.getByTestId('pjpp-cover-content-source')).toBeInTheDocument();
    } else {
      expect(screen.queryByTestId('pjpp-cover-content-source')).toBeNull();
    }
  });
});

// ─── Content sections ─────────────────────────────────────────────────────────

describe('PortalJourneyPrintPack — content sections', () => {
  it('renders practical_outcomes section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-section-practical_outcomes')).toBeInTheDocument();
  });

  it('renders pressure_vs_storage section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-section-pressure_vs_storage')).toBeInTheDocument();
  });

  it('renders unvented_safety section', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getByTestId('pjpp-section-unvented_safety')).toBeInTheDocument();
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
      if (section.sectionId.startsWith('quiet_scene')) continue;
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
  it('prefers native diagram renderer when manifest supports it', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.getAllByTestId('diagram-renderer-open_vented_to_unvented').length).toBeGreaterThan(0);
  });

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

  it('renders heading and takeaway outside the visual container', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    const section = BASE_MODEL.sections.find((entry) => entry.sectionId === 'system_fit_decision_map');
    expect(section).toBeDefined();
    const diagram = screen.getByTestId('pjpp-diagram-system_fit_decision_map');
    const heading = screen.getByRole('heading', { name: section!.storyScene?.title ?? section!.heading });
    const takeaway = screen.getByTestId('pjpp-takeaway-system_fit_decision_map');
    expect(heading).toBeInTheDocument();
    expect(takeaway).toBeInTheDocument();
    expect(within(diagram).queryByText(section!.storyScene?.title ?? section!.heading)).toBeNull();
    expect(within(diagram).queryByText(section!.storyScene?.customerTakeaway ?? section!.keyTakeaway)).toBeNull();
  });

  it('falls back to a clean text card when an approved visual asset is unavailable', () => {
    const originalManifestResolver = visualAssetManifest.getVisualAssetManifestEntry;
    const originalAvailabilityResolver = visualAssetManifest.getVisualAssetRendererAvailability;
    const manifestSpy = vi
      .spyOn(visualAssetManifest, 'getVisualAssetManifestEntry')
      .mockImplementation((assetId) =>
        assetId === 'system_fit_decision_map' ? undefined : originalManifestResolver(assetId));
    const availabilitySpy = vi
      .spyOn(visualAssetManifest, 'getVisualAssetRendererAvailability')
      .mockImplementation((assetId) =>
        assetId === 'system_fit_decision_map'
          ? { hasDiagramRenderer: false, hasPrintFallback: false }
          : originalAvailabilityResolver(assetId));

    try {
      render(<PortalJourneyPrintPack model={BASE_MODEL} />);
      expect(screen.getByTestId('pjpp-visual-fallback-system_fit_decision_map')).toBeInTheDocument();
      expect(screen.queryByTestId('pjpp-diagram-system_fit_decision_map')).toBeNull();
    } finally {
      manifestSpy.mockRestore();
      availabilitySpy.mockRestore();
    }
  });
});

// ─── Page budget ──────────────────────────────────────────────────────────────

describe('PortalJourneyPrintPack — page budget', () => {
  it('model page budget does not exceed 12', () => {
    expect(BASE_MODEL.pageEstimate.usedPages).toBeLessThanOrEqual(12);
    expect(BASE_MODEL.pageEstimate.maxPages).toBe(12);
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

  it('renders timeline cards for next steps', () => {
    const { container } = render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(container.querySelectorAll('.pjpp-next-steps__card').length).toBeGreaterThan(0);
  });
});

describe('PortalJourneyPrintPack — customer page titles and hierarchy', () => {
  it('renders customer page titles in order', () => {
    const { container } = render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    const titles = Array.from(container.querySelectorAll('.pjpp-page h1, .pjpp-page h2')).map((el) =>
      el.textContent?.trim(),
    );
    expect(titles).toContain('Your recommendation');
    expect(titles).toContain('From vented layout to sealed comfort');
    expect(titles).toContain('What happens next');
    expect(titles).toContain('Technical site hand-off');
    expect(titles).toContain('Good to know');
  });

  it('renders one key takeaway and one reassurance block per content page', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    for (const section of BASE_MODEL.sections) {
      if (!section.sectionId.startsWith('quiet_scene')) {
        expect(screen.getByTestId(`pjpp-takeaway-${section.sectionId}`)).toBeInTheDocument();
        expect(screen.getByTestId(`pjpp-reassurance-${section.sectionId}`)).toBeInTheDocument();
      } else {
        expect(screen.queryByTestId(`pjpp-takeaway-${section.sectionId}`)).toBeNull();
      }
    }
  });
});

describe('PortalJourneyPrintPack — page density and language checks', () => {
  it('does not render more than three cards per page', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    for (const section of BASE_MODEL.sections) {
      if (section.sectionId.startsWith('quiet_scene')) continue;
      const list = screen.getByTestId(`pjpp-items-${section.sectionId}`);
      expect(within(list).getAllByRole('listitem').length).toBeLessThanOrEqual(3);
    }
    expect(within(screen.getByTestId('pjpp-next-steps-list')).getAllByRole('listitem').length).toBeLessThanOrEqual(3);
    expect(within(screen.getByTestId('pjpp-qr-list')).getAllByRole('listitem').length).toBeLessThanOrEqual(3);
  });

  it('renders deterministic composition archetype classes', () => {
    const { container } = render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(container.querySelectorAll('[data-archetype="hero"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-archetype="quiet"]').length).toBeGreaterThan(0);
  });

  it('does not render debug markers or raw technical IDs', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    expect(screen.queryByText(/🔬/)).toBeNull();
    expect(screen.queryByText(/not customer data/i)).toBeNull();
    expect(screen.queryByText(/content pending/i)).toBeNull();
    expect(screen.getAllByText(/Your home moves away from loft-tank dependence/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Visible cylinder safety components are expected/i).length).toBeGreaterThan(0);
  });

  it('quiet scene output does not leak implementation wording', () => {
    render(<PortalJourneyPrintPack model={BASE_MODEL} />);
    const quietBlocks = screen.getAllByTestId(/pjpp-quiet-/);
    const text = quietBlocks.map((node) => node.textContent ?? '').join(' ').toLowerCase();
    expect(text).not.toMatch(/cognitive load|dense technical|story scene|composition|archetype|projection|taxonomy|route|routed evidence|breather page/);
    expect(text).not.toContain('the recommendation has not changed');
    expect(text).not.toContain('room to breathe');
  });
});

describe('PortalJourneyPrintPack — heat-pump supporting PDF', () => {
  it('renders expected heat-pump section headings', () => {
    render(<PortalJourneyPrintPack model={HEAT_PUMP_MODEL} />);
    expect(screen.getByRole('heading', { name: 'Why this heat-pump recommendation fits' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What improves in daily operation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Winter behaviour and protection quality' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'What happens next' })).toBeInTheDocument();
  });

  it('keeps customer copy free of pending/debug/raw IDs', () => {
    const { container } = render(<PortalJourneyPrintPack model={HEAT_PUMP_MODEL} />);
    expect(container.textContent).not.toMatch(/content pending|debug|CON_[A-Z0-9_]+/i);
  });

  it('renders heat-pump protection pages without fallback blockers', () => {
    render(<PortalJourneyPrintPack model={HEAT_PUMP_MODEL} />);
    expect(screen.queryByTestId('pjpp-diagram-fallback-winter_behaviour')).toBeNull();
    expect(screen.getByTestId('pjpp-missing-visual-winter_behaviour')).toHaveTextContent(/No visual asset declared/i);
    expect(screen.queryByTestId('pjpp-diagram-winter_behaviour')).toBeNull();
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
