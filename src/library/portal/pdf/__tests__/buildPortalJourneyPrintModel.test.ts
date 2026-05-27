import { describe, expect, it } from 'vitest';
import {
  buildCustomerJourneyPack,
  buildCustomerJourneyPackGeneratedOutput,
  buildPortalJourneyPrintModel,
  CUSTOMER_JOURNEY_PACK_SCHEMA,
  CUSTOMER_JOURNEY_PACK_VERSION,
  isFallbackOnlyCustomerPdf,
  resolveRecommendationConceptSelection,
  validateCustomerStoryScene,
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
  selectedSectionIds: ['CON_E02', 'CON_H01', 'CON_H04', 'CON_G01'],
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
    expect(contentIds).toContain('CON_A01');
    expect(contentIds.filter((id) => id === 'CON_A01')).toHaveLength(1);
    expect(contentIds).toContain('CON_C02');
    expect(contentIds).toContain('CON_C01');
  });

  it('includes practical_outcomes section', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    const sectionIds = model.sections.map((s) => s.sectionId);
    expect(sectionIds).toContain('practical_outcomes');
  });

  it('uses the same content IDs as the portal journey sections', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    const uniqueContentIds = [...new Set(model.sections.map((s) => s.contentId))];
    // Must only reference content we know the portal journey uses
    const knownPortalContentIds = ['CON_A01', 'CON_C01', 'CON_C02'];
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
  it('pageEstimate.maxPages is 9', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.pageEstimate.maxPages).toBe(9);
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
      'practical_outcomes',
      'pressure_vs_storage',
      'unvented_safety',
      'stored_hot_water_recovery_timeline',
      'sealed_system_pressure_window',
      'system_fit_decision_map',
    ]);
  });
});

describe('buildPortalJourneyPrintModel — customer layout constraints', () => {
  it('uses customer-friendly section titles in stable order', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.cover.title).toBe('Your recommendation');
    expect(model.sections.map((s) => s.heading)).toEqual([
      'Practical outcomes',
      'Why stored hot water helps',
      'How the cylinder keeps itself safe',
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
    ]);
  });

  it('uses expected concept IDs for heat-pump supporting pages', () => {
    const model = buildPortalJourneyPrintModel(HEAT_PUMP_INPUT);
    expect(model.sections.map((section) => section.contentId)).toEqual([
      'CON_E02',
      'CON_H04',
      'CON_H01',
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
  it('routes generic journey to educational evidence sections (not filler practical-outcomes copy)', () => {
    const model = buildPortalJourneyPrintModel({
      selectedSectionIds: [],
      recommendationSummary: 'Generic recommendation summary for your home.',
      customerFacts: ['2-person household'],
      journeyType: 'generic_recommendation_summary',
    });
    const headings = model.sections.map((section) => section.heading);
    expect(headings).toContain('System fit decision map');
    expect(headings).not.toContain('What changes in your home');
  });

  it('supports non-open-vented generic family journey types', () => {
    const model = buildPortalJourneyPrintModel({
      selectedSectionIds: [],
      recommendationSummary: 'Stored hot water recommendation.',
      customerFacts: ['3-person household'],
      journeyType: 'stored_hot_water',
    });
    expect(model.sections.map((section) => section.sectionId)).toContain('stored_hot_water_recovery_timeline');
  });
});

describe('buildPortalJourneyPrintModel — content-source trace', () => {
  it('includes content-source metadata on the static PDF model', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    expect(model.contentSource).toBeDefined();
    expect(model.contentSource?.selectedStorySceneCount).toBeGreaterThan(0);
    expect(model.contentSource?.visualAssetIds.length).toBeGreaterThan(0);
    expect(model.contentSource?.audienceProjectionPresent).toBe(false);
    expect(model.contentSource?.storySceneValidation.blockingErrorCount).toBe(0);
    expect(model.contentSource?.storySceneValidation.compositionErrorCount).toBe(0);
  });

  it('hydrates authored story scenes for each PDF section', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    for (const section of model.sections) {
      expect(section.storyScene?.title.length).toBeGreaterThan(0);
      expect(section.storyScene?.sceneKind).toBeDefined();
      expect(section.storyScene?.customerTakeaway.length).toBeGreaterThan(0);
      expect(section.storyScene?.whyItMatters.length).toBeGreaterThan(0);
      expect(section.storyScene?.whatYouWillNotice.length).toBeGreaterThan(0);
      if (section.sectionId !== 'quiet_scene') {
        expect(section.storyScene?.visualAssetId?.length).toBeGreaterThan(0);
      }
      expect(section.storyScene?.composition).toBeDefined();
      const validation = validateCustomerStoryScene(section.storyScene!);
      expect(validation.errors).toHaveLength(0);
    }
  });

  it('uses deterministic authored narrative copy for regular_vented route scenes', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    const practicalOutcomes = model.sections.find((section) => section.sectionId === 'practical_outcomes');
    expect(practicalOutcomes?.storyScene?.title).toBe('From vented layout to sealed comfort');
    expect(practicalOutcomes?.storyScene?.visualAssetId).toBe('open_vented_to_unvented');
    expect(practicalOutcomes?.storyScene?.composition?.pageArchetype).toBe('hero');
  });

  it('inserts quiet pages after dense technical sections', () => {
    const model = buildPortalJourneyPrintModel(BASE_INPUT);
    const quietPages = model.sections.filter((section) => section.sectionId === 'quiet_scene');
    expect(quietPages.length).toBeGreaterThan(0);
    for (const quietPage of quietPages) {
      expect(quietPage.storyScene?.composition?.pageArchetype).toBe('quiet');
      expect(quietPage.storyScene?.composition?.focalVisualPriority).toBe('none');
    }
  });

  it('flags thin generic fallback packs as fallbackOnly when projection is absent', () => {
    const model = buildPortalJourneyPrintModel({
      selectedSectionIds: [],
      recommendationSummary: 'Generic recommendation summary for your home.',
      customerFacts: ['Home constraints reviewed'],
      journeyType: 'generic_recommendation_summary',
    });
    expect(model.contentSource?.fallbackOnly).toBe(true);
    expect(isFallbackOnlyCustomerPdf(model)).toBe(true);
  });

  it('does not mark fallbackOnly when audience projection is present', () => {
    const model = buildPortalJourneyPrintModel({
      selectedSectionIds: [],
      recommendationSummary: 'Generic recommendation summary for your home.',
      customerFacts: ['Home constraints reviewed'],
      journeyType: 'generic_recommendation_summary',
      audienceProjection: {
        audience: 'customer',
        visibleConcepts: ['CON_A01'],
        visibleCards: [],
        visibleDiagrams: [],
        hiddenReasonLog: [],
        auditTrace: [],
      },
    });
    expect(model.contentSource?.audienceProjectionPresent).toBe(true);
    expect(model.contentSource?.fallbackOnly).toBe(false);
  });

  it('marks fallbackOnly when no concept tags are selected even with audience projection', () => {
    const model = buildPortalJourneyPrintModel({
      selectedSectionIds: ['UNKNOWN_SECTION'],
      educationalConceptTags: [],
      recommendationSummary: 'Generic recommendation summary for your home.',
      customerFacts: ['Home constraints reviewed'],
      journeyType: 'generic_recommendation_summary',
      audienceProjection: {
        audience: 'customer',
        visibleConcepts: ['CON_A01'],
        visibleCards: [],
        visibleDiagrams: [],
        hiddenReasonLog: [],
        auditTrace: [],
      },
    });
    expect(model.contentSource?.selectedConceptCount).toBe(0);
    expect(model.contentSource?.fallbackOnly).toBe(true);
  });

  it('flags story scenes with banned internal language', () => {
    const result = validateCustomerStoryScene({
      title: 'Hot water reliability',
      customerTakeaway: 'Showers stay consistent.',
      whyItMatters: 'Atlas mapped this route from taxonomy digest.',
      whatYouWillNotice: 'Steadier shower temperature at peak times.',
      visualAssetId: 'pressure_vs_storage',
    });
    expect(result.errors.map((issue) => issue.code)).toContain('banned_internal_language');
    expect(result.errors.map((issue) => issue.code)).toContain('internal_why_it_matters_language');
  });

  it('flags missing visual asset IDs when a visual is required', () => {
    const result = validateCustomerStoryScene(
      {
        title: 'Hot water reliability',
        customerTakeaway: 'Stored hot water supports two showers at once.',
        whyItMatters: 'This keeps shower temperature stable when taps open together.',
        whatYouWillNotice: 'Less temperature swing in upstairs showers at busy times.',
      },
      { visualAssetRequired: true },
    );
    expect(result.errors.map((issue) => issue.code)).toContain('missing_required_visual_asset');
  });

  it('requires visual assets for physics_explainer scenes', () => {
    const result = validateCustomerStoryScene({
      sceneKind: 'physics_explainer',
      title: 'Pressure and storage',
      customerTakeaway: 'Pressure and storage are separate system limits.',
      whyItMatters: 'Separating these ideas prevents unrealistic hot-water expectations.',
      whatYouWillNotice: 'Shower force can stay strong while stored volume still follows recovery.',
    });
    expect(result.errors.map((issue) => issue.code)).toContain('missing_required_visual_asset');
  });

  it('rejects scenes that carry multiple core messages in one field', () => {
    const result = validateCustomerStoryScene({
      title: 'Comfort profile',
      customerTakeaway: 'Warm operation keeps comfort steady. It also lowers bills every day.',
      whyItMatters: 'This supports predictable comfort at normal demand windows.',
      whatYouWillNotice: 'Rooms warm gradually and remain steady once they reach target.',
      visualAssetId: 'weather_compensation_curve',
    });
    expect(result.errors.map((issue) => issue.code)).toContain('multiple_core_messages');
  });

  it('rejects non-canonical visual IDs in story scenes', () => {
    const result = validateCustomerStoryScene({
      title: 'Hot water reliability',
      customerTakeaway: 'Stored hot water supports overlap use in busy homes.',
      whyItMatters: 'This route gives clearer reserve behaviour during peak demand.',
      whatYouWillNotice: 'Recovery periods are expected after heavy simultaneous draw.',
      visualAssetId: 'generated_blob_card',
    });
    expect(result.errors.map((issue) => issue.code)).toContain('non_canonical_visual_asset');
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
        proposalTruth: {
          visitEnvelope: {
            recommendation: {
              hotWaterArrangement: 'stored_unvented',
              heatSource: 'gas_system',
              reasons: [],
              evidence: [],
              requiredWork: [],
              futureReady: [],
              emitters: { existingRadiatorsCompatible: true, requiredFlowTempC: 55, note: '' },
            },
          },
        },
      },
    });

    expect(pack.staticPdf.recommendationReasons.some((reason) =>
      reason.category === 'bathroom_count' && /stored hot water/i.test(reason.atlasRecommendationOutcome),
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
      reason.category === 'mains_flow_pressure' && /mains-fed stored hot water confidence/i.test(reason.atlasRecommendationOutcome),
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
      reason.category === 'loft_cylinder_location_constraint' && /open-vented routes depend on loft tank capacity/i.test(reason.whyItMatters),
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
      reason.category === 'protection_system_condition' && /protection/i.test(reason.homeFact),
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
      .flatMap((reason) => [
        reason.homeFact,
        reason.whyItMatters,
        reason.atlasRecommendationOutcome,
        reason.practicalEffect,
        reason.detail ?? '',
      ])
      .join(' ')
      .toLowerCase();
    expect(text).not.toContain('0 bathrooms');
    expect(text).not.toContain('0 people');
  });

  it('adds a combi on-demand reason when hotWaterArrangement is on_demand', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Combi boiler — on-demand hot water.',
      customerFacts: [],
      visitEnvelope: {
        recommendation: {
          hotWaterArrangement: 'on_demand',
          heatSource: 'gas_combi',
          reasons: [{ id: 'r1', text: 'Combi suits this property.' }],
          evidence: [],
          requiredWork: [],
          futureReady: [],
          emitters: { existingRadiatorsCompatible: true, requiredFlowTempC: 65, note: '' },
        },
      } as never,
    });

    expect(pack.staticPdf.recommendationReasons.some((reason) =>
      reason.category === 'hot_water_system_type'
      && /on.demand/i.test(reason.homeFact)
      && /no storage cylinder/i.test(reason.homeFact),
    )).toBe(true);
  });

  it('combi reason does not mention cylinder storage', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Combi boiler — on-demand hot water.',
      customerFacts: [],
      visitEnvelope: {
        recommendation: {
          hotWaterArrangement: 'on_demand',
          heatSource: 'gas_combi',
          reasons: [{ id: 'r1', text: 'Combi suits this property.' }],
          evidence: [],
          requiredWork: [],
          futureReady: [],
          emitters: { existingRadiatorsCompatible: true, requiredFlowTempC: 65, note: '' },
        },
      } as never,
    });

    const combiReason = pack.staticPdf.recommendationReasons.find((r) => r.category === 'hot_water_system_type');
    expect(combiReason).toBeDefined();
    // Combi wording must not contradict itself with stored-cylinder language
    const text = [combiReason!.whyItMatters, combiReason!.atlasRecommendationOutcome, combiReason!.practicalEffect].join(' ');
    expect(text).not.toMatch(/unvented cylinder|stored cylinder|cylinder stores/i);
  });

  it('adds an unvented cylinder reason when hotWaterArrangement is stored_unvented', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'System boiler with unvented cylinder.',
      customerFacts: [],
      visitEnvelope: {
        recommendation: {
          hotWaterArrangement: 'stored_unvented',
          heatSource: 'gas_system',
          reasons: [{ id: 'r1', text: 'Unvented cylinder suits this home.' }],
          evidence: [],
          requiredWork: [],
          futureReady: [],
          emitters: { existingRadiatorsCompatible: true, requiredFlowTempC: 65, note: '' },
        },
      } as never,
    });

    expect(pack.staticPdf.recommendationReasons.some((reason) =>
      reason.category === 'hot_water_system_type'
      && /unvented cylinder/i.test(reason.homeFact)
      && /mains pressure/i.test(reason.homeFact),
    )).toBe(true);
  });

  it('uses peak-window/recovery evidence wording for unvented cylinder guidance', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'System boiler with unvented cylinder.',
      customerFacts: [],
      visitEnvelope: {
        recommendation: {
          hotWaterArrangement: 'stored_unvented',
          heatSource: 'gas_system',
          reasons: [],
          evidence: [
            { id: 'e1', fieldPath: 'peakConcurrentOutlets', label: 'Peak concurrent outlets', value: '3 outlets', source: 'derived', confidence: 'high' },
            { id: 'e2', fieldPath: 'recoveryWindowMinutes', label: 'Recovery window', value: '35 min', source: 'derived', confidence: 'high' },
          ],
          requiredWork: [],
          futureReady: [],
          emitters: { existingRadiatorsCompatible: true, requiredFlowTempC: 65, note: '' },
        },
      } as never,
    });
    const reason = pack.staticPdf.recommendationReasons.find((entry) => entry.id === 'unvented-cylinder');
    expect(reason).toBeDefined();
    expect(reason?.whyItMatters).toMatch(/peak-window|recovery evidence/i);
    expect(reason?.atlasRecommendationOutcome).toMatch(/recommendation evidence/i);
    expect(reason?.atlasRecommendationOutcome).not.toMatch(/occupancy|bathroom demand/i);
  });

  it('adds a Mixergy stratified cylinder reason when hotWaterArrangement is mixergy', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'System boiler with Mixergy cylinder.',
      customerFacts: [],
      visitEnvelope: {
        recommendation: {
          hotWaterArrangement: 'mixergy',
          heatSource: 'gas_system',
          reasons: [{ id: 'r1', text: 'Mixergy suits this home.' }],
          evidence: [],
          requiredWork: [],
          futureReady: [],
          emitters: { existingRadiatorsCompatible: true, requiredFlowTempC: 65, note: '' },
        },
      } as never,
    });

    expect(pack.staticPdf.recommendationReasons.some((reason) =>
      reason.category === 'hot_water_system_type'
      && /stratified/i.test(reason.homeFact)
      && /mixergy/i.test(reason.homeFact),
    )).toBe(true);
  });

  it('adds a thermal store reason when hotWaterArrangement is thermal_store', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'System boiler with thermal store.',
      customerFacts: [],
      visitEnvelope: {
        recommendation: {
          hotWaterArrangement: 'thermal_store',
          heatSource: 'gas_system',
          reasons: [{ id: 'r1', text: 'Thermal store suits this home.' }],
          evidence: [],
          requiredWork: [],
          futureReady: [],
          emitters: { existingRadiatorsCompatible: true, requiredFlowTempC: 65, note: '' },
        },
      } as never,
    });

    expect(pack.staticPdf.recommendationReasons.some((reason) =>
      reason.category === 'hot_water_system_type'
      && /thermal store/i.test(reason.homeFact)
      && /primary.circuit/i.test(reason.homeFact),
    )).toBe(true);
  });

  it('adds an emitter upgrade reason when existing radiators are not compatible with heat-pump flow temperature', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Air source heat pump.',
      customerFacts: [],
      visitEnvelope: {
        recommendation: {
          hotWaterArrangement: 'stored_unvented',
          heatSource: 'ashp',
          reasons: [{ id: 'r1', text: 'Heat pump suits this home.' }],
          evidence: [],
          requiredWork: [],
          futureReady: [],
          emitters: {
            existingRadiatorsCompatible: false,
            requiredFlowTempC: 45,
            note: 'Radiators sized for 70 °C — may need upsizing for 45 °C flow.',
          },
        },
      } as never,
    });

    expect(pack.staticPdf.recommendationReasons.some((reason) =>
      reason.category === 'emitter_upgrade_required'
      && /radiator/i.test(reason.homeFact)
      && /45/i.test(reason.homeFact),
    )).toBe(true);
  });

  it('does not add an emitter upgrade reason when existing radiators are compatible', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Air source heat pump — radiators retained.',
      customerFacts: [],
      visitEnvelope: {
        recommendation: {
          hotWaterArrangement: 'stored_unvented',
          heatSource: 'ashp',
          reasons: [{ id: 'r1', text: 'Heat pump suits this home.' }],
          evidence: [],
          requiredWork: [],
          futureReady: [],
          emitters: { existingRadiatorsCompatible: true, requiredFlowTempC: 50, note: 'Radiators adequate at 50 °C.' },
        },
      } as never,
    });

    expect(pack.staticPdf.recommendationReasons.some((r) => r.category === 'emitter_upgrade_required')).toBe(false);
  });

  it('does not use "sized the route around your household usage level" in occupancy reason blocks', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'System boiler.',
      customerFacts: [],
      canonicalVisitPackage: {
        schema: 'atlas.canonical-visit-package',
        version: '1.0',
        visitIdentity: {},
        workspaceBrandReference: {},
        customerPropertyDetails: {},
        surveyDraft: {
          occupancyCount: 4,
          bathroomCount: 1,
          dynamicMainsPressure: 2.0,
          mainsDynamicFlowLpm: 14,
        } as never,
        importExportMetadata: {
          exportedAt: '2026-05-21T12:10:00.000Z',
          source: { target: 'local_only', surface: 'test' },
        },
      },
    });

    const text = pack.staticPdf.recommendationReasons
      .flatMap((r) => [r.atlasRecommendationOutcome, r.practicalEffect])
      .join(' ');
    expect(text).not.toMatch(/sized the route around your household usage level/i);
  });
});

// ─── Recommendation intent filtering ─────────────────────────────────────────

import {
  resolveRecommendationIntentCategory,
  inferCustomerJourneyTypeFromSystemContext,
  type RecommendationIntentContextV1,
} from '../buildPortalJourneyPrintModel';

describe('resolveRecommendationIntentCategory', () => {
  it('returns heat_pump_transition when recommendedScenarioType is ashp', () => {
    const ctx: RecommendationIntentContextV1 = { recommendedScenarioType: 'ashp' };
    expect(resolveRecommendationIntentCategory(ctx)).toBe('heat_pump_transition');
  });

  it('returns heat_pump_transition when recommendedHeatSource is ashp', () => {
    const ctx: RecommendationIntentContextV1 = { recommendedHeatSource: 'ashp' };
    expect(resolveRecommendationIntentCategory(ctx)).toBe('heat_pump_transition');
  });

  it('returns heat_pump_transition when recommendedScenarioId contains ashp', () => {
    const ctx: RecommendationIntentContextV1 = { recommendedScenarioId: 'ashp-r290-standard' };
    expect(resolveRecommendationIntentCategory(ctx)).toBe('heat_pump_transition');
  });

  it('returns combi_replacement when recommendedScenarioType is combi', () => {
    const ctx: RecommendationIntentContextV1 = { recommendedScenarioType: 'combi' };
    expect(resolveRecommendationIntentCategory(ctx)).toBe('combi_replacement');
  });

  it('returns combi_replacement when hotWaterArrangement is on_demand', () => {
    const ctx: RecommendationIntentContextV1 = { hotWaterArrangement: 'on_demand' };
    expect(resolveRecommendationIntentCategory(ctx)).toBe('combi_replacement');
  });

  it('returns vented_to_unvented when current system is open-vented and recommended is stored', () => {
    const ctx: RecommendationIntentContextV1 = {
      dhwStorageType: 'vented',
      hotWaterArrangement: 'stored_unvented',
    };
    expect(resolveRecommendationIntentCategory(ctx)).toBe('vented_to_unvented');
  });

  it('returns stored_hot_water when hotWaterArrangement is stored_unvented (no vented current)', () => {
    const ctx: RecommendationIntentContextV1 = { hotWaterArrangement: 'stored_unvented' };
    expect(resolveRecommendationIntentCategory(ctx)).toBe('stored_hot_water');
  });

  it('returns sealed_system_conversion when recommendedScenarioType is system', () => {
    const ctx: RecommendationIntentContextV1 = { recommendedScenarioType: 'system' };
    expect(resolveRecommendationIntentCategory(ctx)).toBe('sealed_system_conversion');
  });

  // Current-system fallback (no recommended-system signals)
  it('returns vented_to_unvented from current system when dhwStorageType is vented and no recommendation present', () => {
    const ctx: RecommendationIntentContextV1 = {
      currentHeatSourceType: 'regular',
      dhwStorageType: 'vented',
    };
    expect(resolveRecommendationIntentCategory(ctx)).toBe('vented_to_unvented');
  });

  it('returns heat_pump_transition from current system when currentHeatSourceType is ashp and no recommendation present', () => {
    const ctx: RecommendationIntentContextV1 = { currentHeatSourceType: 'ashp' };
    expect(resolveRecommendationIntentCategory(ctx)).toBe('heat_pump_transition');
  });

  it('preferred recommended signals override current-system fallback', () => {
    // Even though current system is vented, a combi recommendation overrides
    const ctx: RecommendationIntentContextV1 = {
      currentHeatSourceType: 'regular',
      dhwStorageType: 'vented',
      hotWaterArrangement: 'on_demand',
    };
    expect(resolveRecommendationIntentCategory(ctx)).toBe('combi_replacement');
  });
});

describe('inferCustomerJourneyTypeFromSystemContext', () => {
  it('returns heat_pump when recommended heat source is ashp', () => {
    expect(inferCustomerJourneyTypeFromSystemContext({
      currentHeatSourceType: 'regular',
      dhwStorageType: 'vented',
      recommendedHeatSource: 'ashp',
    })).toBe('heat_pump');
  });

  it('returns heat_pump when open-vented home gets ASHP (scenario ID signal)', () => {
    expect(inferCustomerJourneyTypeFromSystemContext({
      currentHeatSourceType: 'regular',
      dhwStorageType: 'vented',
      recommendedScenarioId: 'ashp-low-temp',
    })).toBe('heat_pump');
  });

  it('returns generic_recommendation_summary for combi replacement', () => {
    expect(inferCustomerJourneyTypeFromSystemContext({
      currentHeatSourceType: 'combi',
      recommendedScenarioType: 'combi',
    })).toBe('generic_recommendation_summary');
  });

  it('returns open_vented for vented-to-unvented transition', () => {
    expect(inferCustomerJourneyTypeFromSystemContext({
      currentHeatSourceType: 'regular',
      dhwStorageType: 'vented',
      hotWaterArrangement: 'stored_unvented',
    })).toBe('open_vented');
  });

  it('falls back to open_vented for legacy open-vented inputs with no recommendation signals', () => {
    expect(inferCustomerJourneyTypeFromSystemContext({
      currentHeatSourceType: 'regular',
      dhwStorageType: 'vented',
    })).toBe('open_vented');
  });
});

describe('buildPortalJourneyPrintModel — ASHP intent prioritises heat-pump sections', () => {
  it('ASHP recommendation produces heat-pump section IDs (warm_not_hot_radiators, steady_running, winter_behaviour)', () => {
    const model = buildPortalJourneyPrintModel({
      journeyType: 'heat_pump',
      selectedSectionIds: [],
      recommendationSummary: 'Air source heat pump — the right fit for this home.',
      customerFacts: ['3-person household', '2 bathrooms'],
    });
    const sectionIds = model.sections.map((s) => s.sectionId);
    expect(sectionIds).toContain('warm_not_hot_radiators');
    expect(sectionIds).toContain('steady_running');
    expect(sectionIds).toContain('winter_behaviour');
  });

  it('ASHP recommendation does not include cylinder-only sections', () => {
    const model = buildPortalJourneyPrintModel({
      journeyType: 'heat_pump',
      selectedSectionIds: [],
      recommendationSummary: 'Air source heat pump — the right fit for this home.',
      customerFacts: [],
    });
    const sectionIds = model.sections.map((s) => s.sectionId);
    expect(sectionIds).not.toContain('pressure_vs_storage');
    expect(sectionIds).not.toContain('unvented_safety');
  });
});

describe('buildCustomerJourneyPack — recommendation intent via canonicalVisitPackage', () => {
  it('ASHP scenario ID drives heat_pump journey type and excludes cylinder sections', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Air source heat pump.',
      canonicalVisitPackage: {
        visitIdentity: { visitId: 'v1', updatedAt: '2026-01-01T00:00:00.000Z' },
        workspaceBrandReference: {},
        customerPropertyDetails: {},
        surveyDraft: {} as never,
        proposalTruth: {
          selectedScenarioId: 'ashp-r290',
          decision: { recommendedScenarioId: 'ashp-r290', decidedAt: '2026-01-01T00:00:00.000Z' },
        },
      } as never,
    });
    const sectionIds = pack.staticPdf.sections.map((s) => s.sectionId);
    expect(sectionIds).toContain('warm_not_hot_radiators');
    expect(sectionIds).not.toContain('pressure_vs_storage');
    expect(sectionIds).not.toContain('unvented_safety');
  });

  it('combi recommendation excludes cylinder-only sections', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Combi boiler.',
      canonicalVisitPackage: {
        visitIdentity: { visitId: 'v2', updatedAt: '2026-01-01T00:00:00.000Z' },
        workspaceBrandReference: {},
        customerPropertyDetails: {},
        surveyDraft: {} as never,
        proposalTruth: {
          selectedScenarioId: 'combi-high-output',
          decision: { recommendedScenarioId: 'combi-high-output', decidedAt: '2026-01-01T00:00:00.000Z' },
        },
      } as never,
    });
    const sectionIds = pack.staticPdf.sections.map((s) => s.sectionId);
    expect(sectionIds).not.toContain('pressure_vs_storage');
    expect(sectionIds).not.toContain('unvented_safety');
  });

  it('vented-to-unvented recommendation includes pressure/storage sections', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'System boiler with unvented cylinder.',
      canonicalVisitPackage: {
        visitIdentity: { visitId: 'v3', updatedAt: '2026-01-01T00:00:00.000Z' },
        workspaceBrandReference: {},
        customerPropertyDetails: {},
        surveyDraft: {
          postcode: 'SW1A 1AA',
          dhwStorageType: 'vented',
          currentHeatSourceType: 'regular',
        } as never,
      } as never,
    });
    const sectionIds = pack.staticPdf.sections.map((s) => s.sectionId);
    expect(sectionIds).toContain('pressure_vs_storage');
    expect(sectionIds).toContain('unvented_safety');
  });
});

describe('resolveRecommendationConceptSelection — educational evidence routing', () => {
  it('routes heat-pump + emitter mismatch to warm-radiator and emitter-fit educational concepts', () => {
    const routed = resolveRecommendationConceptSelection({
      selectedSectionIds: [],
      recommendationSummary: 'ASHP recommendation.',
      customerFacts: [],
      recommendationIntent: 'heat_pump_transition',
      visitEnvelope: {
        recommendation: {
          hotWaterArrangement: 'stored_unvented',
          heatSource: 'ashp',
          reasons: [],
          evidence: [],
          requiredWork: [],
          futureReady: [],
          emitters: { existingRadiatorsCompatible: false, requiredFlowTempC: 45, note: 'Emitter review required.' },
        },
      } as never,
    });
    expect(routed.conceptTags).toContain('warm_vs_hot_radiators');
    expect(routed.selectedSectionIds).toContain('CON_E01');
    expect(routed.selectedSectionIds).toContain('CON_E02');
  });

  it('routes low mains constraints to bottleneck education', () => {
    const routed = resolveRecommendationConceptSelection({
      selectedSectionIds: [],
      recommendationSummary: 'Stored hot water recommendation.',
      customerFacts: [],
      canonicalVisitPackage: {
        visitIdentity: {},
        workspaceBrandReference: {},
        customerPropertyDetails: {},
        surveyDraft: {
          dynamicMainsPressure: 1.1,
          mainsDynamicFlowLpm: 8,
        } as never,
      } as never,
    });
    expect(routed.conceptTags).toContain('flow_restriction_bottleneck');
    expect(routed.selectedSectionIds).toContain('CON_D01');
  });

  it('routes system-condition debris signals to magnetic filter education', () => {
    const routed = resolveRecommendationConceptSelection({
      selectedSectionIds: [],
      recommendationSummary: 'Protection upgrade.',
      customerFacts: [],
      surveyCondition: {
        magneticDebrisEvidence: true,
        bleedWaterColour: 'black',
      },
    });
    expect(routed.conceptTags).toContain('magnetic_filter_capture');
    expect(routed.selectedSectionIds).toContain('CON_F04');
  });
});

describe('buildCustomerJourneyPack — educational evidence acceptance routing', () => {
  it('stored hot water routes pressure/storage and recovery timeline sections', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Stored hot water route.',
      customerFacts: [],
      recommendationIntent: 'stored_hot_water',
      visitEnvelope: {
        recommendation: {
          hotWaterArrangement: 'stored_unvented',
          heatSource: 'gas_system',
          reasons: [],
          evidence: [],
          requiredWork: [],
          futureReady: [],
          emitters: { existingRadiatorsCompatible: true, requiredFlowTempC: 55, note: '' },
        },
      } as never,
    });
    const sectionIds = pack.staticPdf.sections.map((s) => s.sectionId);
    expect(sectionIds).toContain('pressure_vs_storage');
    expect(sectionIds).toContain('stored_hot_water_recovery_timeline');
  });

  it('renders warm-radiator and emitter-fit education when routed concept tags request it', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      educationalConceptTags: ['warm_vs_hot_radiators'],
      recommendationSummary: 'Heat pump route.',
      customerFacts: [],
      journeyType: 'generic_recommendation_summary',
    });
    const sectionIds = pack.staticPdf.sections.map((s) => s.sectionId);
    expect(sectionIds).toContain('warm_not_hot_radiators');
  });

  it('removes the legacy generic filler phrase from recommendation reasons', () => {
    const pack = buildCustomerJourneyPack({
      selectedSectionIds: [],
      recommendationSummary: 'Baseline recommendation summary.',
      customerFacts: ['Unknown planning constraint'],
      journeyType: 'generic_recommendation_summary',
    });
    const text = pack.staticPdf.recommendationReasons
      .flatMap((reason) => [reason.homeFact, reason.whyItMatters, reason.atlasRecommendationOutcome, reason.practicalEffect])
      .join(' ');
    expect(text).not.toContain('Atlas used this fact directly in route and sizing checks.');
  });
});
