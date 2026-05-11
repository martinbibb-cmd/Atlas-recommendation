import { describe, expect, it } from 'vitest';
import {
  buildPortalJourneyPrintModel,
  type BuildPortalJourneyPrintModelInputV1,
} from '../buildPortalJourneyPrintModel';

const BASE_INPUT: BuildPortalJourneyPrintModelInputV1 = {
  selectedSectionIds: ['CON_A01', 'CON_C02', 'CON_C01'],
  recommendationSummary: 'Sealed system with unvented cylinder — the right fit for this home.',
  customerFacts: ['4-person household', '2 bathrooms', 'Regular boiler, open-vented circuit'],
  brandProfile: { name: 'Atlas Heating' },
};

// ─── Content identity ─────────────────────────────────────────────────────────

describe('buildPortalJourneyPrintModel — content identity', () => {
  it('returns a print model without throwing', () => {
    expect(() => buildPortalJourneyPrintModel(BASE_INPUT)).not.toThrow();
  });

  it('cover title is customer-safe and non-empty', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.cover.title).toBeTruthy();
    expect(model.cover.title.length).toBeGreaterThan(0);
  });

  it('cover summary matches the provided recommendationSummary', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.cover.summary).toBe(BASE_INPUT.recommendationSummary);
  });

  it('cover customerFacts match the provided array', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.cover.customerFacts).toEqual(BASE_INPUT.customerFacts);
  });

  it('cover brandName matches brandProfile.name', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.cover.brandName).toBe('Atlas Heating');
  });

  it('includes a section for each selected content ID', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    const contentIds = model.sections.map((s) => s.contentId);
    // CON_A01 produces two sections (what_changes + what_stays_familiar)
    expect(contentIds).toContain('CON_A01');
    expect(contentIds).toContain('CON_C02');
    expect(contentIds).toContain('CON_C01');
  });

  it('always includes living_with_your_system section', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    const sectionIds = model.sections.map((s) => s.sectionId);
    expect(sectionIds).toContain('living_with_your_system');
  });

  it('uses the same content IDs as the portal journey sections', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    const uniqueContentIds = [...new Set(model.sections.map((s) => s.contentId))];
    // Must only reference content we know the portal journey uses
    const knownPortalContentIds = ['CON_A01', 'CON_C01', 'CON_C02', 'living_with_your_system'];
    for (const id of uniqueContentIds) {
      expect(knownPortalContentIds).toContain(id);
    }
  });
});

// ─── No content pending ───────────────────────────────────────────────────────

describe('buildPortalJourneyPrintModel — no content pending', () => {
  it('all sections have a non-empty heading', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    for (const section of model.sections) {
      expect(section.heading.trim().length).toBeGreaterThan(0);
    }
  });

  it('all sections have a non-empty summary', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    for (const section of model.sections) {
      expect(section.summary.trim().length).toBeGreaterThan(0);
    }
  });

  it('all sections have at least one item', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    for (const section of model.sections) {
      expect(section.items.length).toBeGreaterThan(0);
    }
  });

  it('all items are non-empty strings', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    for (const section of model.sections) {
      for (const item of section.items) {
        expect(item.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('nextSteps is non-empty', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.nextSteps.length).toBeGreaterThan(0);
  });

  it('qrDestinations is non-empty', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.qrDestinations.length).toBeGreaterThan(0);
  });
});

// ─── No raw concept IDs ───────────────────────────────────────────────────────

describe('buildPortalJourneyPrintModel — no raw concept IDs', () => {
  it('section headings do not contain raw CON_ identifiers', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    for (const section of model.sections) {
      expect(section.heading).not.toMatch(/CON_[A-Z0-9]+/);
    }
  });

  it('section summaries do not contain raw CON_ identifiers', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    for (const section of model.sections) {
      expect(section.summary).not.toMatch(/CON_[A-Z0-9]+/);
    }
  });

  it('section items do not contain raw CON_ identifiers', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    for (const section of model.sections) {
      for (const item of section.items) {
        expect(item).not.toMatch(/CON_[A-Z0-9]+/);
      }
    }
  });

  it('cover title and summary do not contain raw concept IDs', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.cover.title).not.toMatch(/CON_[A-Z0-9]+/);
    expect(model.cover.summary).not.toMatch(/CON_[A-Z0-9]+/);
  });

  it('section items do not contain raw taxonomy concept IDs', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    const rawTaxonomyPattern = /\bsealed_system_conversion\b|\bunvented_safety_reassurance\b|\bpressure_vs_storage\b/;
    for (const section of model.sections) {
      for (const item of section.items) {
        expect(item).not.toMatch(rawTaxonomyPattern);
      }
    }
  });
});

// ─── No diagnostics ───────────────────────────────────────────────────────────

describe('buildPortalJourneyPrintModel — no diagnostics', () => {
  it('does not include a diagnostics field', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT) as unknown as Record<string, unknown>;
    expect(model.diagnostics).toBeUndefined();
  });

  it('cover does not include dev or diagnostic fields', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    const cover = model.cover as unknown as Record<string, unknown>;
    expect(cover.debug).toBeUndefined();
    expect(cover.trace).toBeUndefined();
  });
});

// ─── Page budget ──────────────────────────────────────────────────────────────

describe('buildPortalJourneyPrintModel — page budget', () => {
  it('pageEstimate.maxPages is 6', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.pageEstimate.maxPages).toBe(6);
  });

  it('pageEstimate.usedPages does not exceed maxPages', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.pageEstimate.usedPages).toBeLessThanOrEqual(model.pageEstimate.maxPages);
  });

  it('pageEstimate.usedPages is at least 1', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.pageEstimate.usedPages).toBeGreaterThanOrEqual(1);
  });
});

// ─── Recommendation identity ──────────────────────────────────────────────────

describe('buildPortalJourneyPrintModel — recommendation identity unchanged', () => {
  it('model built from different recommendations produces different cover summaries', () => {
    const model1 = buildPortalJourneyPrintModel({
      ...BASE_INPUT,
      recommendationSummary: 'Sealed system with unvented cylinder.',
    });
    const model2 = buildPortalJourneyPrintModel({
      ...BASE_INPUT,
      recommendationSummary: 'Different recommendation for comparison.',
    });
    expect(model1.cover.summary).not.toBe(model2.cover.summary);
  });

  it('model with no brand profile has undefined brandName', () => {
    const model = buildPortalJourneyPrintModel({ ...BASE_INPUT, brandProfile: undefined });
    expect(model.cover.brandName).toBeUndefined();
  });

  it('model with empty selectedSectionIds still includes all core sections', () => {
    const model = buildPortalJourneyPrintModel({ ...BASE_INPUT, selectedSectionIds: [] });
    const sectionIds = model.sections.map((s) => s.sectionId);
    expect(sectionIds).toContain('what_changes');
    expect(sectionIds).toContain('pressure_vs_storage');
    expect(sectionIds).toContain('unvented_safety');
    expect(sectionIds).toContain('living_with_your_system');
  });
});
