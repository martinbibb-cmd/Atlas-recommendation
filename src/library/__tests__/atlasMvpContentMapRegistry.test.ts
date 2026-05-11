import { describe, expect, it } from 'vitest';
import {
  atlasMvpContentMapRegistry,
  toEducationalContentFromAtlasMvp,
} from '../content/atlasMvpContentMapRegistry';
import { runEducationalContentQa } from '../content/qa/runEducationalContentQa';
import { getConceptById } from '../taxonomy/conceptGraph';
import { educationalRoutingRules } from '../routing/educationalRoutingRules';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';

const REQUIRED_IDS = [
  'CON_F01',
  'CON_F02',
  'CON_F03',
  'CON_F04',
  'CON_B01',
  'CON_B02',
  'CON_B03',
  'CON_A01',
  'CON_C01',
  'CON_C02',
  'CON_D01',
  'CON_D02',
  'CON_D03',
  'CON_D04',
  'CON_A02',
  'CON_E01',
  'CON_E02',
  'CON_G01',
  'CON_H01',
  'CON_H04',
  'CON_C03',
  'CON_I01_DAY_TO_DAY',
] as const;

const RAW_ENGINE_TERMS = [
  'engineoutputv1',
  'timelinebuilder',
  'lifestylesimulationmodule',
  'hydraulic_constraint_present',
  'day_to_day_outcomes_present',
  'emitter_upgrade_or_high_temp_note',
  'recommended_scenario_available',
];

const SCARE_WORDS = ['dangerous', 'catastrophic', 'fatal'];

describe('atlasMvpContentMapRegistry', () => {
  it('contains the exact 22 requested MVP content IDs', () => {
    const ids = atlasMvpContentMapRegistry.map((entry) => entry.id);
    expect(ids).toEqual(REQUIRED_IDS);
  });

  it('all 22 entries pass content QA as transformed EducationalContentV1 entries', () => {
    const findings = runEducationalContentQa(
      atlasMvpContentMapRegistry.map((entry) => toEducationalContentFromAtlasMvp(entry)),
    );
    const errors = findings.filter((finding) => finding.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('maps all entry taxonomy concept IDs to known taxonomy concepts', () => {
    for (const entry of atlasMvpContentMapRegistry) {
      for (const conceptId of entry.taxonomyConceptIds) {
        expect(getConceptById(conceptId)).toBeDefined();
      }
    }
  });

  it('maps all entries to known routing trigger tags in routing or asset registries', () => {
    const routingTagSet = new Set(educationalRoutingRules.flatMap((rule) => rule.triggerTags));
    const assetTagSet = new Set(educationalAssetRegistry.flatMap((asset) => asset.triggerTags));
    for (const entry of atlasMvpContentMapRegistry) {
      expect(entry.routingTriggerTags.length).toBeGreaterThan(0);
      expect(
        entry.routingTriggerTags.some((tag) => routingTagSet.has(tag) || assetTagSet.has(tag)),
      ).toBe(true);
    }
  });

  it('ensures each entry has portal, PDF, and engineer handover variants and appendix hidden in portal by default', () => {
    for (const entry of atlasMvpContentMapRegistry) {
      expect(entry.portalTreatment.customerCopy.trim().length).toBeGreaterThan(0);
      expect(entry.portalTreatment.includeTechnicalAppendixByDefault).toBe(false);

      expect(entry.pdfTreatment.summary.trim().length).toBeGreaterThan(0);
      expect(typeof entry.pdfTreatment.includeTechnicalAppendix).toBe('boolean');

      expect(entry.engineerHandoverTreatment.trim().length).toBeGreaterThan(0);
      expect(entry.technicalAppendixSummary.trim().length).toBeGreaterThan(0);

      expect(entry.suggestedDiagramIds.length).toBeGreaterThan(0);
      expect(entry.suggestedAnimationIds.length).toBeGreaterThan(0);
      expect(entry.suggestedPrintCardIds.length).toBeGreaterThan(0);
    }
  });

  it('does not leak raw engine terms in customer wording surfaces', () => {
    for (const entry of atlasMvpContentMapRegistry) {
      const customerFacingText = [
        entry.oneLineSummary,
        entry.customerWording,
        entry.whatYouMayNotice,
        entry.whatStaysFamiliar,
        entry.whatNotToWorryAbout,
        entry.misconception,
        entry.reality,
        entry.analogy,
        entry.whereItWorks,
        entry.whereItBreaks,
        entry.portalTreatment.customerCopy,
        entry.pdfTreatment.summary,
      ].join(' ').toLowerCase();

      for (const term of RAW_ENGINE_TERMS) {
        expect(customerFacingText.includes(term)).toBe(false);
      }
    }
  });

  it('does not use guaranteed-savings language', () => {
    for (const entry of atlasMvpContentMapRegistry) {
      const text = [
        entry.oneLineSummary,
        entry.customerWording,
        entry.portalTreatment.customerCopy,
        entry.pdfTreatment.summary,
      ].join(' ').toLowerCase();

      expect(text.includes('guaranteed savings')).toBe(false);
      expect(text.includes('always cheaper')).toBe(false);
    }
  });

  it('does not use scare language on customer surfaces', () => {
    for (const entry of atlasMvpContentMapRegistry) {
      const text = [
        entry.oneLineSummary,
        entry.customerWording,
        entry.whatYouMayNotice,
        entry.whatStaysFamiliar,
        entry.whatNotToWorryAbout,
        entry.portalTreatment.customerCopy,
        entry.pdfTreatment.summary,
      ].join(' ').toLowerCase();

      for (const scareWord of SCARE_WORDS) {
        expect(text.includes(scareWord)).toBe(false);
      }
    }
  });
});
