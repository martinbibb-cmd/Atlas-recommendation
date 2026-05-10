import { describe, expect, it } from 'vitest';
import type { EducationalAssetV1 } from '../../contracts/EducationalAssetV1';
import type { EducationalAssetAccessibilityAuditV1 } from '../../audits/EducationalAssetAccessibilityAuditV1';
import type { EducationalAssetQaV1 } from '../../registry/qa/EducationalAssetQaV1';
import type { PrintEquivalentV1 } from '../../printEquivalents/PrintEquivalentV1';
import { checkWelcomePackAssetEligibility } from '../packComposer/eligibility/checkWelcomePackAssetEligibility';

const baseAsset: EducationalAssetV1 = {
  id: 'TestAsset',
  conceptIds: ['test_concept'],
  title: 'Test asset',
  assetType: 'explainer',
  audience: 'all',
  depth: 'visual',
  cognitiveLoad: 'low',
  textDensity: 'low',
  motionIntensity: 'none',
  hasStaticFallback: true,
  hasPrintEquivalent: true,
  supportsReducedMotion: true,
  analogyFamilies: ['none'],
  accessibilityProfiles: ['reduced_motion'],
  translationRisk: 'low',
  requiredEngineFacts: [],
  triggerTags: [],
};

const passedCustomerPackAudit: EducationalAssetAccessibilityAuditV1 = {
  auditId: 'audit-testasset-v1',
  assetId: 'TestAsset',
  auditedAt: '2026-05-01',
  auditedBy: 'test',
  status: 'passed',
  checks: {
    semanticStructure: true,
    keyboardSafe: true,
    reducedMotionSafe: true,
    staticFallbackAvailable: true,
    printEquivalentAvailable: true,
    colourNotSoleIndicator: true,
    screenReaderSummaryAvailable: true,
    cognitiveLoadAcceptable: true,
    noDecorativeMotion: true,
    noUnsupportedClaims: true,
  },
  notes: [],
  requiredChanges: [],
  approvedFor: ['customer_pack', 'digital', 'print', 'reduced_motion', 'technical_appendix'],
};

const needsChangesAudit: EducationalAssetAccessibilityAuditV1 = {
  ...passedCustomerPackAudit,
  status: 'needs_changes',
  approvedFor: [],
};

const printEquivalent: PrintEquivalentV1 = {
  assetId: 'TestAsset',
  conceptIds: ['test_concept'],
  title: 'Test asset print',
  printTitle: 'Test asset (print)',
  summary: 'Print summary',
  steps: [],
  labels: [],
  accessibilityNotes: '',
};

function runCheck(
  overrides: {
    assets?: EducationalAssetV1[];
    audits?: EducationalAssetAccessibilityAuditV1[];
    qaFindings?: EducationalAssetQaV1[];
    printEquivalents?: PrintEquivalentV1[];
    deliveryMode?: Parameters<typeof checkWelcomePackAssetEligibility>[0]['deliveryMode'];
  } = {},
) {
  return checkWelcomePackAssetEligibility({
    selectedAssetIds: ['TestAsset'],
    deliveryMode: overrides.deliveryMode ?? 'customer_pack',
    assets: overrides.assets ?? [baseAsset],
    audits: overrides.audits ?? [passedCustomerPackAudit],
    qaFindings: overrides.qaFindings ?? [],
    printEquivalents: overrides.printEquivalents ?? [printEquivalent],
    componentRegistry: {},
  });
}

describe('checkWelcomePackAssetEligibility', () => {
  describe('customer_pack mode', () => {
    it('marks asset eligible when audit is passed and approved for customer_pack', () => {
      const [result] = runCheck();
      expect(result.eligible).toBe(true);
      expect(result.reasons).toHaveLength(0);
      expect(result.severity).toBe('info');
    });

    it('blocks asset when audit is missing', () => {
      const [result] = runCheck({ audits: [] });
      expect(result.eligible).toBe(false);
      expect(result.reasons.some((r) => /no accessibility audit/i.test(r))).toBe(true);
    });

    it('blocks asset when audit status is needs_changes', () => {
      const [result] = runCheck({ audits: [needsChangesAudit] });
      expect(result.eligible).toBe(false);
      expect(result.reasons.some((r) => /needs_changes/i.test(r))).toBe(true);
    });

    it('blocks asset when approvedFor does not include customer_pack', () => {
      const audit = { ...passedCustomerPackAudit, approvedFor: [] as [] };
      const [result] = runCheck({ audits: [audit] });
      expect(result.eligible).toBe(false);
      expect(result.reasons.some((r) => /customer_pack/i.test(r))).toBe(true);
    });

    it('blocks asset when QA errors are present', () => {
      const qaFindings: EducationalAssetQaV1[] = [
        { assetId: 'TestAsset', severity: 'error', ruleId: 'test-rule', message: 'Test error', field: 'title' },
      ];
      const [result] = runCheck({ qaFindings });
      expect(result.eligible).toBe(false);
      expect(result.reasons.some((r) => /QA errors/i.test(r))).toBe(true);
    });

    it('preserves conceptIds from asset', () => {
      const [result] = runCheck();
      expect(result.conceptIds).toEqual(['test_concept']);
    });

    it('sets replacementHint when ineligible', () => {
      const [result] = runCheck({ audits: [] });
      expect(result.replacementHint).toBeTruthy();
    });
  });

  describe('print mode', () => {
    it('marks asset eligible when print equivalent is available', () => {
      const [result] = runCheck({ deliveryMode: 'print' });
      expect(result.eligible).toBe(true);
    });

    it('blocks asset when no print equivalent or static print asset exists', () => {
      const assetWithoutPrint: EducationalAssetV1 = {
        ...baseAsset,
        hasPrintEquivalent: false,
        printComponentPath: undefined,
        assetType: 'animation',
      };
      const [result] = runCheck({
        deliveryMode: 'print',
        assets: [assetWithoutPrint],
        printEquivalents: [],
        audits: [{ ...passedCustomerPackAudit, approvedFor: [] as [] }],
      });
      expect(result.eligible).toBe(false);
      expect(result.reasons.some((r) => /print equivalent/i.test(r))).toBe(true);
    });

    it('marks asset eligible when asset type is print_sheet even without registry entry', () => {
      const printSheet: EducationalAssetV1 = { ...baseAsset, assetType: 'print_sheet' };
      const [result] = runCheck({
        deliveryMode: 'print',
        assets: [printSheet],
        printEquivalents: [],
      });
      expect(result.eligible).toBe(true);
    });
  });

  describe('reduced_motion mode', () => {
    it('marks asset eligible when supportsReducedMotion is true', () => {
      const [result] = runCheck({ deliveryMode: 'reduced_motion' });
      expect(result.eligible).toBe(true);
    });

    it('blocks asset when no reduced motion support or static fallback', () => {
      const asset: EducationalAssetV1 = {
        ...baseAsset,
        supportsReducedMotion: false,
        hasStaticFallback: false,
        motionIntensity: 'high',
      };
      const [result] = runCheck({
        deliveryMode: 'reduced_motion',
        assets: [asset],
        audits: [{ ...passedCustomerPackAudit, approvedFor: [] as [] }],
      });
      expect(result.eligible).toBe(false);
      expect(result.reasons.some((r) => /reduced motion/i.test(r))).toBe(true);
    });

    it('marks asset eligible when motionIntensity is none', () => {
      const asset: EducationalAssetV1 = {
        ...baseAsset,
        supportsReducedMotion: false,
        hasStaticFallback: false,
        motionIntensity: 'none',
      };
      const [result] = runCheck({ deliveryMode: 'reduced_motion', assets: [asset] });
      expect(result.eligible).toBe(true);
    });
  });

  describe('technical_appendix mode', () => {
    it('allows asset approved for technical_appendix even without customer_pack approval', () => {
      const audit = { ...passedCustomerPackAudit, approvedFor: ['technical_appendix'] as ['technical_appendix'] };
      const [result] = runCheck({ deliveryMode: 'technical_appendix', audits: [audit] });
      expect(result.eligible).toBe(true);
    });

    it('allows asset approved for customer_pack in technical_appendix mode', () => {
      const audit = { ...passedCustomerPackAudit, approvedFor: ['customer_pack'] as ['customer_pack'] };
      const [result] = runCheck({ deliveryMode: 'technical_appendix', audits: [audit] });
      expect(result.eligible).toBe(true);
    });

    it('blocks asset with no relevant approvals', () => {
      const audit = { ...passedCustomerPackAudit, approvedFor: [] as [] };
      const [result] = runCheck({ deliveryMode: 'technical_appendix', audits: [audit] });
      expect(result.eligible).toBe(false);
    });
  });

  describe('output shape', () => {
    it('returns one result per selected asset', () => {
      const results = checkWelcomePackAssetEligibility({
        selectedAssetIds: ['TestAsset'],
        deliveryMode: 'customer_pack',
        assets: [baseAsset],
        audits: [passedCustomerPackAudit],
        qaFindings: [],
        printEquivalents: [printEquivalent],
        componentRegistry: {},
      });
      expect(results).toHaveLength(1);
    });

    it('returns assetId, mode, eligible, reasons, severity, conceptIds', () => {
      const [result] = runCheck();
      expect(result.assetId).toBe('TestAsset');
      expect(result.mode).toBe('customer_pack');
      expect(typeof result.eligible).toBe('boolean');
      expect(Array.isArray(result.reasons)).toBe(true);
      expect(['info', 'warning', 'error']).toContain(result.severity);
      expect(Array.isArray(result.conceptIds)).toBe(true);
    });
  });
});
