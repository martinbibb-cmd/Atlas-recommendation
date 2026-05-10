import { describe, expect, it } from 'vitest';
import type { EducationalAssetV1 } from '../contracts/EducationalAssetV1';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalComponentRegistry } from '../registry/educationalComponentRegistry';
import { validateEducationalAsset } from '../registry/qa/validateEducationalAsset';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';

function buildValidAsset(overrides: Partial<EducationalAssetV1> = {}): EducationalAssetV1 {
  return {
    ...educationalAssetRegistry[4], // ControlsVisual — hasPrintEquivalent, print_ready, no motion, in component registry
    ...overrides,
  };
}

describe('validateEducationalAsset', () => {
  it('passes a fully valid asset with no findings', () => {
    const findings = validateEducationalAsset(
      buildValidAsset(),
      educationalConceptTaxonomy,
      educationalComponentRegistry,
    );
    expect(findings).toEqual([]);
  });

  it('errors when conceptIds is empty', () => {
    const findings = validateEducationalAsset(
      buildValidAsset({ conceptIds: [] }),
      educationalConceptTaxonomy,
      educationalComponentRegistry,
    );
    expect(findings.some((f) => f.ruleId === 'missing_concept_ids')).toBe(true);
  });

  it('errors when a conceptId does not exist in taxonomy', () => {
    const findings = validateEducationalAsset(
      buildValidAsset({ conceptIds: ['does_not_exist_in_taxonomy'] }),
      educationalConceptTaxonomy,
      educationalComponentRegistry,
    );
    expect(findings.some((f) => f.ruleId === 'unknown_concept_id')).toBe(true);
    const finding = findings.find((f) => f.ruleId === 'unknown_concept_id');
    expect(finding?.severity).toBe('error');
  });

  it('errors when animation asset is missing supportsReducedMotion', () => {
    const findings = validateEducationalAsset(
      buildValidAsset({
        assetType: 'animation',
        motionIntensity: 'high',
        supportsReducedMotion: false,
        hasStaticFallback: true,
      }),
      educationalConceptTaxonomy,
      educationalComponentRegistry,
    );
    expect(findings.some((f) => f.ruleId === 'animation_missing_reduced_motion_support')).toBe(true);
  });

  it('errors when animation asset is missing hasStaticFallback', () => {
    const findings = validateEducationalAsset(
      buildValidAsset({
        assetType: 'animation',
        motionIntensity: 'high',
        supportsReducedMotion: true,
        hasStaticFallback: false,
      }),
      educationalConceptTaxonomy,
      educationalComponentRegistry,
    );
    expect(findings.some((f) => f.ruleId === 'animation_missing_static_fallback')).toBe(true);
  });

  it('errors when library_ready asset has not passed accessibility audit', () => {
    const findings = validateEducationalAsset(
      buildValidAsset({
        lifecycleStatus: 'library_ready',
        accessibilityAuditStatus: 'partial',
        printStatus: 'print_ready',
        hasPrintEquivalent: true,
      }),
      educationalConceptTaxonomy,
      educationalComponentRegistry,
    );
    expect(findings.some((f) => f.ruleId === 'library_ready_audit_not_passed')).toBe(true);
    expect(findings.find((f) => f.ruleId === 'library_ready_audit_not_passed')?.severity).toBe('error');
  });

  it('errors when library_ready asset has printStatus needs_static_equivalent', () => {
    const findings = validateEducationalAsset(
      buildValidAsset({
        lifecycleStatus: 'library_ready',
        accessibilityAuditStatus: 'passed',
        printStatus: 'needs_static_equivalent',
        hasPrintEquivalent: false,
      }),
      educationalConceptTaxonomy,
      educationalComponentRegistry,
    );
    expect(findings.some((f) => f.ruleId === 'library_ready_needs_static_equivalent')).toBe(true);
    expect(findings.find((f) => f.ruleId === 'library_ready_needs_static_equivalent')?.severity).toBe('error');
  });

  it('errors when print_ready asset lacks hasPrintEquivalent', () => {
    const findings = validateEducationalAsset(
      buildValidAsset({
        printStatus: 'print_ready',
        hasPrintEquivalent: false,
      }),
      educationalConceptTaxonomy,
      educationalComponentRegistry,
    );
    expect(findings.some((f) => f.ruleId === 'print_ready_missing_print_equivalent')).toBe(true);
    expect(findings.find((f) => f.ruleId === 'print_ready_missing_print_equivalent')?.severity).toBe('error');
  });

  it('warns when asset has no entry in component registry', () => {
    const findings = validateEducationalAsset(
      buildValidAsset({ id: 'AssetNotInRegistry' }),
      educationalConceptTaxonomy,
      educationalComponentRegistry,
    );
    expect(findings.some((f) => f.ruleId === 'missing_component_mapping')).toBe(true);
    expect(findings.find((f) => f.ruleId === 'missing_component_mapping')?.severity).toBe('warning');
  });

  it('warns when asset lacks a print equivalent', () => {
    const findings = validateEducationalAsset(
      buildValidAsset({
        hasPrintEquivalent: false,
        printStatus: 'needs_static_equivalent',
      }),
      educationalConceptTaxonomy,
      educationalComponentRegistry,
    );
    expect(findings.some((f) => f.ruleId === 'missing_print_equivalent')).toBe(true);
    expect(findings.find((f) => f.ruleId === 'missing_print_equivalent')?.severity).toBe('warning');
  });

  it('does not warn about missing_print_equivalent when asset is print_ready with hasPrintEquivalent', () => {
    const findings = validateEducationalAsset(
      buildValidAsset({
        hasPrintEquivalent: true,
        printStatus: 'print_ready',
      }),
      educationalConceptTaxonomy,
      educationalComponentRegistry,
    );
    expect(findings.some((f) => f.ruleId === 'missing_print_equivalent')).toBe(false);
  });
});
