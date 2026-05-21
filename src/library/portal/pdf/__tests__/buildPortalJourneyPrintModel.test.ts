import { describe, expect, it } from 'vitest';
import {
  buildCustomerJourneyPack,
  buildCustomerJourneyPackGeneratedOutput,
  buildPortalJourneyPrintModel,
  CUSTOMER_JOURNEY_PACK_SCHEMA,
  CUSTOMER_JOURNEY_PACK_VERSION,
  type BuildPortalJourneyPrintModelInputV1,
} from '../buildPortalJourneyPrintModel';
import { buildCanonicalVisitPackage } from '../../../../features/visitPackage';

const BASE_INPUT: BuildPortalJourneyPrintModelInputV1 = {
  journeyType: 'open_vented',
  selectedSectionIds: ['CON_A01', 'CON_C02', 'CON_C01'],
  recommendationSummary: 'Sealed system with unvented cylinder — the right fit for this home.',
  customerFacts: ['4-person household', '2 bathrooms', 'Regular boiler, open-vented circuit'],
  brandProfile: { name: 'Atlas Heating' },
};

const HEAT_PUMP_INPUT: BuildPortalJourneyPrintModelInputV1 = {
  journeyType: 'heat_pump',
  selectedSectionIds: ['CON_E02', 'CON_H01', 'CON_H04', 'CON_G01', 'CON_I01_DAY_TO_DAY'],
  recommendationSummary: 'Heat pump with low-temperature radiators — a steady comfort fit for this home.',
  customerFacts: ['3-person household', '2 bathrooms', 'Heat pump with low-temperature radiators'],
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
  it('pageEstimate.maxPages is 7', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.pageEstimate.maxPages).toBe(7);
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

  it('keeps address summary out of print by default', () => {
    const model = buildPortalJourneyPrintModel({
      ...BASE_INPUT,
      visitContext: {
        addressSummary: '3-bed semi in Portsmouth',
        personalDataMode: 'address_summary',
      },
    });
    expect(model.cover.addressSummary).toBeUndefined();
  });

  it('model with empty selectedSectionIds still includes all core sections', () => {
    const model = buildPortalJourneyPrintModel({ ...BASE_INPUT, selectedSectionIds: [] });
    expect(model.sections.map((s) => s.sectionId)).toEqual([
      'what_changes',
      'pressure_vs_storage',
      'what_stays_familiar',
      'unvented_safety',
      'living_with_your_system',
    ]);
  });
});

describe('buildPortalJourneyPrintModel — customer layout constraints', () => {
  it('uses customer-friendly section titles in stable order', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.cover.title).toBe('Your recommendation');
    expect(model.sections.map((s) => s.heading)).toEqual([
      'What changes in your home',
      'Why stored hot water helps',
      'What stays familiar',
      'How the cylinder keeps itself safe',
      'Living with the system',
    ]);
  });

  it('keeps page content density low', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    for (const section of model.sections) {
      expect(section.items.length).toBeLessThanOrEqual(3);
    }
    expect(model.nextSteps.length).toBeLessThanOrEqual(3);
    expect(model.qrDestinations.length).toBeLessThanOrEqual(3);
  });
});

describe('buildPortalJourneyPrintModel — heat-pump journey', () => {
  it('builds heat-pump model pages in customer-facing order', () => {
    const model = buildPortalJourneyPrintModel(HEAT_PUMP_INPUT);
    expect(model.cover.title).toBe('Your recommendation');
    expect(model.sections.map((section) => section.heading)).toEqual([
      'Why radiators may feel warm, not hot',
      'How steady running works',
      'What happens in winter',
      'Living with the system',
    ]);
  });

  it('uses expected concept IDs for heat-pump supporting pages', () => {
    const model = buildPortalJourneyPrintModel(HEAT_PUMP_INPUT);
    expect(model.sections.map((section) => section.contentId)).toEqual([
      'CON_E02',
      'CON_H04',
      'CON_H01',
      'CON_I01_DAY_TO_DAY',
    ]);
  });

  it('does not expose pending or raw concept ID text in heat-pump copy', () => {
    const model = buildPortalJourneyPrintModel(HEAT_PUMP_INPUT);
    const customerFacingText = [
      model.cover.title,
      model.cover.summary,
      ...model.cover.customerFacts,
      ...model.sections.flatMap((section) => [section.heading, section.summary, section.keyTakeaway, section.reassurance, ...section.items]),
      ...model.nextSteps.flatMap((step) => [step.label, step.body]),
      ...model.qrDestinations.flatMap((dest) => [dest.heading, dest.note]),
    ].join(' ');

    expect(customerFacingText).not.toMatch(/content pending|debug|diagnostic|CON_[A-Z0-9_]+/i);
  });
});

describe('buildPortalJourneyPrintModel — generic recommendation fallback journey', () => {
  it('does not default fallback journey to open-vented conversion copy', () => {
    const model = buildPortalJourneyPrintModel({
      selectedSectionIds: [],
      recommendationSummary: 'Generic recommendation summary for your home.',
      customerFacts: ['2-person household'],
      journeyType: 'generic_recommendation_summary',
    });
    const headings = model.sections.map((section) => section.heading);
    expect(headings).toContain('What this recommendation means');
    expect(headings).not.toContain('What changes in your home');
  });

  it('supports non-open-vented generic family journey types', () => {
    const model = buildPortalJourneyPrintModel({
      selectedSectionIds: [],
      recommendationSummary: 'Stored hot water recommendation.',
      customerFacts: ['3-person household'],
      journeyType: 'stored_hot_water',
    });
    expect(model.sections.map((section) => section.heading)).toContain('What this recommendation means');
  });
});

describe('buildCustomerJourneyPack — shared journey model', () => {
  it('builds a versioned customer journey pack with static PDF and portal deep-dive variants', () => {
    const pack = buildCustomerJourneyPack(BASE_INPUT);
    expect(pack.schema).toBe(CUSTOMER_JOURNEY_PACK_SCHEMA);
    expect(pack.version).toBe(CUSTOMER_JOURNEY_PACK_VERSION);
    expect(pack.staticPdf.cover.summary).toBe(BASE_INPUT.recommendationSummary);
    expect(pack.portalDeepDive.recommendationSummary).toBe(BASE_INPUT.recommendationSummary);
    expect(pack.portalDeepDive.nextSteps.length).toBeGreaterThan(0);
  });

  it('keeps portal library explainers aligned to the same section content IDs as static PDF output', () => {
    const pack = buildCustomerJourneyPack(BASE_INPUT);
    const sectionIds = new Set(pack.staticPdf.sections.map((section) => section.contentId));
    for (const explainer of pack.portalDeepDive.librarySupportedExplainers) {
      expect(sectionIds.has(explainer.contentId)).toBe(true);
    }
  });

  it('prefers an explicitly packaged customer journey pack for PDF output', () => {
    const packaged = buildCustomerJourneyPack(BASE_INPUT);
    const model = buildPortalJourneyPrintModel({
      ...HEAT_PUMP_INPUT,
      customerJourneyPack: packaged,
    });
    expect(model).toEqual(packaged.staticPdf);
  });

  it('reuses packaged customer journey pack from canonical visit package before rebuilding', () => {
    const packaged = buildCustomerJourneyPack(BASE_INPUT);
    const canonicalVisitPackage = buildCanonicalVisitPackage({
      packageData: {
        visitIdentity: {
          visitId: 'visit-001',
          updatedAt: '2026-05-20T10:00:00.000Z',
        },
        workspaceBrandReference: {},
        customerPropertyDetails: {},
        surveyDraft: {
          postcode: 'SW1A 1AA',
          occupancyCount: 4,
          bathroomCount: 2,
        } as never,
        generatedOutputStatus: {
          generatedOutputs: {
            portal: { generated: false },
            pdf: { generated: false },
            customerJourneyPack: buildCustomerJourneyPackGeneratedOutput({
              customerJourneyPack: packaged,
              generatedAt: '2026-05-20T10:01:00.000Z',
            }),
            simulatorReview: { generated: false },
            handoff: { generated: false },
          },
        },
        importExportMetadata: {
          exportedAt: '2026-05-20T10:02:00.000Z',
          source: {
            target: 'local_only',
            surface: 'visit_home_export',
          },
        },
      },
    });

    const pack = buildCustomerJourneyPack({
      ...HEAT_PUMP_INPUT,
      canonicalVisitPackage,
    });

    expect(pack).toEqual(packaged);
  });
});

describe('buildCustomerJourneyPack — recommendation reason blocks', () => {
  it('adds a stored hot-water reason when two bathrooms and suitable mains supply are present', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'System boiler with mains-fed cylinder.',
      customerFacts: [],
      canonicalVisitPackage: {
        schema: 'atlas.canonical-visit-package',
        version: '1.0',
        visitIdentity: {},
        workspaceBrandReference: {},
        customerPropertyDetails: {},
        surveyDraft: {
          bathroomCount: 2,
          occupancySignature: 'steady',
          highOccupancy: false,
          dynamicMainsPressure: 2.4,
          mainsDynamicFlowLpm: 16,
          dhwStorageType: 'unvented',
        } as never,
        importExportMetadata: {
          exportedAt: '2026-05-21T12:00:00.000Z',
          source: { target: 'local_only', surface: 'test' },
        },
      },
    });

    expect(pack.staticPdf.recommendationReasons.some((reason) =>
      reason.category === 'bathroom_count' && /stored hot water/i.test(reason.summary),
    )).toBe(true);
  });

  it('adds a mains constraint reason when pressure is too low for unvented confidence', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Stored route with measured supply constraints.',
      customerFacts: [],
      canonicalVisitPackage: {
        schema: 'atlas.canonical-visit-package',
        version: '1.0',
        visitIdentity: {},
        workspaceBrandReference: {},
        customerPropertyDetails: {},
        surveyDraft: {
          bathroomCount: 2,
          occupancySignature: 'steady',
          highOccupancy: false,
          dynamicMainsPressure: 1.2,
          mainsDynamicFlowLpm: 9,
          dhwStorageType: 'unvented',
        } as never,
        importExportMetadata: {
          exportedAt: '2026-05-21T12:01:00.000Z',
          source: { target: 'local_only', surface: 'test' },
        },
      },
    });

    expect(pack.staticPdf.recommendationReasons.some((reason) =>
      reason.category === 'mains_flow_pressure' && /unvented hot-water confidence/i.test(reason.summary),
    )).toBe(true);
  });

  it('adds a loft tank space limitation reason when open-vented tanks are not feasible', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Route selected with loft constraints in mind.',
      customerFacts: [],
      canonicalVisitPackage: {
        schema: 'atlas.canonical-visit-package',
        version: '1.0',
        visitIdentity: {},
        workspaceBrandReference: {},
        customerPropertyDetails: {},
        surveyDraft: {
          bathroomCount: 1,
          occupancySignature: 'steady',
          highOccupancy: false,
          loftTankSpace: 'none',
        } as never,
        importExportMetadata: {
          exportedAt: '2026-05-21T12:02:00.000Z',
          source: { target: 'local_only', surface: 'test' },
        },
      },
    });

    expect(pack.staticPdf.recommendationReasons.some((reason) =>
      reason.category === 'loft_cylinder_location_constraint' && /open-vented hot-water routes are limited/i.test(reason.summary),
    )).toBe(true);
  });

  it('adds a protection reason when sludge signals are present', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Route selected with protection works included.',
      customerFacts: [],
      canonicalVisitPackage: {
        schema: 'atlas.canonical-visit-package',
        version: '1.0',
        visitIdentity: {},
        workspaceBrandReference: {},
        customerPropertyDetails: {},
        surveyDraft: {
          bathroomCount: 1,
          occupancySignature: 'steady',
          highOccupancy: false,
          fullSurvey: {
            heatingCondition: {
              bleedWaterColour: 'black',
              radiatorsColdAtBottom: true,
              magneticDebrisEvidence: true,
            },
          },
        } as never,
        importExportMetadata: {
          exportedAt: '2026-05-21T12:03:00.000Z',
          source: { target: 'local_only', surface: 'test' },
        },
      },
    });

    expect(pack.staticPdf.recommendationReasons.some((reason) =>
      reason.category === 'protection_system_condition' && /protection/i.test(reason.title),
    )).toBe(true);
  });

  it('does not emit zero-value survey facts as recommendation reasons', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Baseline recommendation summary.',
      customerFacts: ['0 bathrooms', '0 people'],
      journeyType: 'generic_recommendation_summary',
    });

    const text = pack.staticPdf.recommendationReasons
      .flatMap((reason) => [reason.title, reason.summary, reason.detail ?? ''])
      .join(' ')
      .toLowerCase();
    expect(text).not.toContain('0 bathrooms');
    expect(text).not.toContain('0 people');
  });
});
