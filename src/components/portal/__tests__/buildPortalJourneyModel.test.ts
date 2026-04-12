/**
 * buildPortalJourneyModel.test.ts
 *
 * PR10 — Tests for buildPortalJourneyModel().
 *
 * Coverage:
 *   1.  Recommended option present — title/summary/benefits derived from engine
 *   2.  Missing recommended option — falls back gracefully
 *   3.  Alternatives exclude the recommended option
 *   4.  Rejected options excluded from alternatives
 *   5.  WhyFits derived from recommended option planes
 *   6.  Caveat status on dhw/heat caution planes
 *   7.  WhatToExpect includes mustHave requirements
 *   8.  WhatToExpect includes red flag items
 *   9.  Findings: evidence summary populated from evidenceSummary
 *  10.  Findings: propertySummary from propertyTitle
 *  11.  Findings: constraints from red-flag 'fail' items
 *  12.  Findings: priorities from red-flag 'warn' items
 *  13.  Title includes propertyTitle when non-generic
 *  14.  Title fallback when propertyTitle is generic
 *  15.  Four default scenarios always present
 *  16.  ConfidenceLabel from option confidenceBadge
 *  17.  ConfidenceLabel fallback from verdict confidence
 *  18.  AlternativeCard whyNotTopChoice from caution planes
 *  19.  KeyBenefits capped at 3
 *  20.  ChosenOptionId does not affect journey model structure
 */

import { describe, it, expect } from 'vitest';
import { buildPortalJourneyModel } from '../selectors/buildPortalJourneyModel';
import type { PortalDisplayModel } from '../types/portalDisplay.types';
import type { EngineOutputV1 } from '../../../contracts/EngineOutputV1';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeOption(
  id: 'combi' | 'stored_vented' | 'stored_unvented' | 'ashp' | 'regular_vented' | 'system_unvented',
  status: 'viable' | 'caution' | 'rejected',
  overrides?: Partial<import('../../../contracts/EngineOutputV1').OptionCardV1>,
): import('../../../contracts/EngineOutputV1').OptionCardV1 {
  return {
    id,
    label:    id === 'combi' ? 'Combi boiler' : id === 'stored_unvented' ? 'Unvented cylinder' : id,
    status,
    headline: `${id} headline`,
    why: [`Good for ${id}`, `Efficient ${id}`, `Compact ${id}`, `Reliable ${id}`],
    requirements: [],
    heat:        { status: 'ok', headline: `${id} heat headline`, bullets: [`${id} heat bullet 1`] },
    dhw:         { status: 'ok', headline: `${id} dhw headline`, bullets: [`${id} dhw bullet 1`] },
    engineering: { status: 'ok', headline: `${id} eng headline`, bullets: [`${id} eng bullet 1`] },
    sensitivities: [],
    typedRequirements: {
      mustHave:       [`${id} must-have`],
      likelyUpgrades: [`${id} upgrade`],
      niceToHave:     [],
    },
    ...overrides,
  };
}

const STUB_ENGINE_OUTPUT: EngineOutputV1 = {
  eligibility: [],
  redFlags: [],
  recommendation: { primary: 'Combi boiler' },
  explainers: [],
  options: [
    makeOption('combi', 'viable'),
    makeOption('stored_unvented', 'caution'),
    makeOption('stored_vented', 'rejected'),
  ],
  verdict: {
    title:   'Combi boiler recommended',
    status:  'good',
    reasons: ['Adequate mains pressure', 'Household size suitable'],
    confidence: { level: 'high', reasons: [] },
    assumptionsUsed: [],
  },
};

function makeDisplayModel(overrides?: Partial<PortalDisplayModel>): PortalDisplayModel {
  return {
    propertyTitle:       '5 Example Road, Bristol',
    recommendationReady: true,
    recommendedOptionId: 'combi',
    engineOutput:        STUB_ENGINE_OUTPUT,
    presentationState:   null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildPortalJourneyModel', () => {

  describe('recommendation section', () => {
    it('sets title from recommended option label', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      expect(model.recommendation.title).toBe('Combi boiler');
    });

    it('sets recommendedOptionId from displayModel', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      expect(model.recommendation.recommendedOptionId).toBe('combi');
    });

    it('derives summary from first why[] item', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      expect(model.recommendation.summary).toBe('Good for combi');
    });

    it('caps keyBenefits at 3', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      expect(model.recommendation.keyBenefits.length).toBeLessThanOrEqual(3);
    });

    it('uses option confidenceBadge label when present', () => {
      const engineOutput: EngineOutputV1 = {
        ...STUB_ENGINE_OUTPUT,
        options: [
          {
            ...makeOption('combi', 'viable'),
            confidenceBadge: { level: 'high', label: 'High confidence (measured)' },
          },
          makeOption('stored_unvented', 'caution'),
        ],
      };
      const model = buildPortalJourneyModel(makeDisplayModel({ engineOutput }));
      expect(model.recommendation.confidenceLabel).toBe('High confidence (measured)');
    });

    it('falls back to verdict confidence level for confidenceLabel', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      expect(model.recommendation.confidenceLabel).toBe('High confidence — based on measured inputs');
    });

    it('falls back gracefully when no recommended option exists', () => {
      const dm = makeDisplayModel({
        recommendedOptionId: undefined,
        engineOutput: {
          ...STUB_ENGINE_OUTPUT,
          options: [],
        },
      });
      const model = buildPortalJourneyModel(dm);
      expect(model.recommendation.title).toBeTruthy();
      expect(model.recommendation.keyBenefits).toEqual([]);
    });
  });

  describe('alternatives section', () => {
    it('excludes the recommended option', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      const ids = model.alternatives.map((a) => a.optionId);
      expect(ids).not.toContain('combi');
    });

    it('excludes rejected options', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      const ids = model.alternatives.map((a) => a.optionId);
      expect(ids).not.toContain('stored_vented');
    });

    it('includes caution-status options as alternatives', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      const ids = model.alternatives.map((a) => a.optionId);
      expect(ids).toContain('stored_unvented');
    });

    it('sets whyNotTopChoice from caution planes', () => {
      const engineOutput: EngineOutputV1 = {
        ...STUB_ENGINE_OUTPUT,
        options: [
          makeOption('combi', 'viable'),
          makeOption('stored_unvented', 'caution', {
            dhw: { status: 'caution', headline: 'Higher upfront cost', bullets: [] },
          }),
        ],
      };
      const model = buildPortalJourneyModel(makeDisplayModel({ engineOutput }));
      const alt = model.alternatives.find((a) => a.optionId === 'stored_unvented');
      expect(alt?.whyNotTopChoice).toContain('Higher upfront cost');
    });
  });

  describe('whyFits section', () => {
    it('includes hot water fit from dhw plane', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      const item = model.whyFits.find((w) => w.title === 'Hot water supply');
      expect(item).toBeDefined();
      expect(item?.status).toBe('positive');
    });

    it('includes heating fit from heat plane', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      const item = model.whyFits.find((w) => w.title === 'Heating performance');
      expect(item).toBeDefined();
    });

    it('marks dhw caution as caveat status', () => {
      const engineOutput: EngineOutputV1 = {
        ...STUB_ENGINE_OUTPUT,
        options: [
          makeOption('combi', 'viable', {
            dhw: { status: 'caution', headline: 'Flow rate at upper limit', bullets: [] },
          }),
        ],
      };
      const model = buildPortalJourneyModel(makeDisplayModel({ engineOutput }));
      const item = model.whyFits.find((w) => w.title === 'Hot water supply');
      expect(item?.status).toBe('caveat');
    });

    it('returns empty array when no option found', () => {
      const dm = makeDisplayModel({
        recommendedOptionId: 'ashp',
        engineOutput: { ...STUB_ENGINE_OUTPUT, options: [] },
      });
      const model = buildPortalJourneyModel(dm);
      expect(model.whyFits).toEqual([]);
    });
  });

  describe('whatToExpect section', () => {
    it('includes mustHave requirements from the recommended option', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      expect(model.whatToExpect).toContain('combi must-have');
    });

    it('includes likelyUpgrades from the recommended option', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      expect(model.whatToExpect).toContain('combi upgrade');
    });

    it('includes red flag warn items', () => {
      const engineOutput: EngineOutputV1 = {
        ...STUB_ENGINE_OUTPUT,
        redFlags: [
          { id: 'rf1', severity: 'warn', title: 'Pipe diameter at lower limit', detail: 'Check with engineer' },
        ],
      };
      const model = buildPortalJourneyModel(makeDisplayModel({ engineOutput }));
      expect(model.whatToExpect.some((e) => e.includes('Pipe diameter at lower limit'))).toBe(true);
    });
  });

  describe('findings section', () => {
    it('populates evidenceSummary from evidenceSummary counts', () => {
      const model = buildPortalJourneyModel(makeDisplayModel({
        evidenceSummary: { photoCount: 3, voiceNoteCount: 2, textNoteCount: 1, extractedFactCount: 8 },
      }));
      const evidence = model.findings.evidenceSummary;
      expect(evidence.some((e) => e.includes('3 photos'))).toBe(true);
      expect(evidence.some((e) => e.includes('2 voice notes'))).toBe(true);
      expect(evidence.some((e) => e.includes('8 measured'))).toBe(true);
    });

    it('sets propertySummary from propertyTitle', () => {
      const model = buildPortalJourneyModel(makeDisplayModel({ propertyTitle: '10 Park Lane, London' }));
      expect(model.findings.propertySummary).toBe('10 Park Lane, London');
    });

    it('omits propertySummary when title is generic', () => {
      const model = buildPortalJourneyModel(makeDisplayModel({ propertyTitle: 'Your recommendation' }));
      expect(model.findings.propertySummary).toBeUndefined();
    });

    it('populates constraints from red-flag fail items', () => {
      const engineOutput: EngineOutputV1 = {
        ...STUB_ENGINE_OUTPUT,
        redFlags: [
          { id: 'rf1', severity: 'fail', title: 'Insufficient mains pressure', detail: '' },
        ],
      };
      const model = buildPortalJourneyModel(makeDisplayModel({ engineOutput }));
      expect(model.findings.constraints).toContain('Insufficient mains pressure');
    });

    it('populates priorities from red-flag warn items', () => {
      const engineOutput: EngineOutputV1 = {
        ...STUB_ENGINE_OUTPUT,
        redFlags: [
          { id: 'rf2', severity: 'warn', title: 'Pipe size worth reviewing', detail: '' },
        ],
      };
      const model = buildPortalJourneyModel(makeDisplayModel({ engineOutput }));
      expect(model.findings.priorities).toContain('Pipe size worth reviewing');
    });

    it('includes high-confidence observation in evidenceSummary', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      expect(model.findings.evidenceSummary.some((e) => e.toLowerCase().includes('high-confidence'))).toBe(true);
    });
  });

  describe('title', () => {
    it('includes propertyTitle when non-generic', () => {
      const model = buildPortalJourneyModel(makeDisplayModel({ propertyTitle: '5 Example Road, Bristol' }));
      expect(model.title).toContain('5 Example Road, Bristol');
    });

    it('falls back to generic title when propertyTitle is generic', () => {
      const model = buildPortalJourneyModel(makeDisplayModel({ propertyTitle: 'Your recommendation' }));
      expect(model.title).toBe('Your home recommendation');
    });
  });

  describe('scenarios', () => {
    it('always returns four default scenarios', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      expect(model.scenarios).toHaveLength(4);
    });

    it('scenario ids are stable', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      const ids = model.scenarios.map((s) => s.id);
      expect(ids).toContain('more_hot_water');
      expect(ids).toContain('lower_disruption');
      expect(ids).toContain('future_bathroom');
      expect(ids).toContain('system_preference');
    });

    it('each scenario has a title and description', () => {
      const model = buildPortalJourneyModel(makeDisplayModel());
      for (const s of model.scenarios) {
        expect(s.title).toBeTruthy();
        expect(s.description).toBeTruthy();
      }
    });
  });
});
