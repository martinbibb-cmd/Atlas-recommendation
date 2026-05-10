import { describe, expect, it } from 'vitest';
import { educationalAssetRegistry } from '../registry/educationalAssetRegistry';
import { educationalComponentRegistry } from '../registry/educationalComponentRegistry';
import {
  getAssetQaErrors,
  getAssetQaWarnings,
  runEducationalAssetQa,
} from '../registry/qa/runEducationalAssetQa';
import { educationalConceptTaxonomy } from '../taxonomy/educationalConceptTaxonomy';

describe('runEducationalAssetQa', () => {
  it('produces no errors for the current registered asset registry', () => {
    const findings = runEducationalAssetQa(
      educationalAssetRegistry,
      educationalComponentRegistry,
      educationalConceptTaxonomy,
    );
    expect(getAssetQaErrors(findings)).toEqual([]);
  });

  it('does not report missing_print_equivalent warnings for core animation assets with static equivalents', () => {
    const findings = runEducationalAssetQa(
      educationalAssetRegistry,
      educationalComponentRegistry,
      educationalConceptTaxonomy,
    );
    const warnings = getAssetQaWarnings(findings);
    const missingPrintWarnings = warnings.filter((w) => w.ruleId === 'missing_print_equivalent');
    expect(missingPrintWarnings.map((w) => w.assetId)).not.toEqual(
      expect.arrayContaining(['WhatIfLab', 'BoilerCyclingAnimation', 'FlowRestrictionAnimation', 'RadiatorUpgradeAnimation']),
    );
  });

  it('getAssetQaErrors filters findings to errors only', () => {
    const findings = runEducationalAssetQa(
      [
        {
          ...educationalAssetRegistry[1], // BoilerCyclingAnimation
          id: 'TestAnimation',
          supportsReducedMotion: false,
          hasStaticFallback: false,
        },
      ],
      educationalComponentRegistry,
      educationalConceptTaxonomy,
    );
    const errors = getAssetQaErrors(findings);
    expect(errors.every((f) => f.severity === 'error')).toBe(true);
    expect(errors.some((f) => f.ruleId === 'animation_missing_reduced_motion_support')).toBe(true);
    expect(errors.some((f) => f.ruleId === 'animation_missing_static_fallback')).toBe(true);
  });

  it('getAssetQaWarnings filters findings to warnings only', () => {
    const findings = runEducationalAssetQa(
      educationalAssetRegistry,
      educationalComponentRegistry,
      educationalConceptTaxonomy,
    );
    const warnings = getAssetQaWarnings(findings);
    expect(warnings.every((f) => f.severity === 'warning')).toBe(true);
  });

  it('errors for an animation asset without static fallback', () => {
    const findings = runEducationalAssetQa(
      [
        {
          ...educationalAssetRegistry[1], // BoilerCyclingAnimation base
          id: 'BadAnimation',
          assetType: 'animation',
          hasStaticFallback: false,
          supportsReducedMotion: true,
        },
      ],
      educationalComponentRegistry,
      educationalConceptTaxonomy,
    );
    expect(getAssetQaErrors(findings).some((f) => f.ruleId === 'animation_missing_static_fallback')).toBe(true);
  });

  it('errors for an asset with an unknown conceptId', () => {
    const findings = runEducationalAssetQa(
      [
        {
          ...educationalAssetRegistry[0],
          id: 'UnknownConceptAsset',
          conceptIds: ['nonexistent_concept_xyz'],
        },
      ],
      educationalComponentRegistry,
      educationalConceptTaxonomy,
    );
    expect(getAssetQaErrors(findings).some((f) => f.ruleId === 'unknown_concept_id')).toBe(true);
  });

  it('errors when library_ready asset has not passed accessibility audit', () => {
    const findings = runEducationalAssetQa(
      [
        {
          ...educationalAssetRegistry[4], // ControlsVisual — print_ready
          id: 'NotReadyYet',
          lifecycleStatus: 'library_ready',
          accessibilityAuditStatus: 'partial',
        },
      ],
      educationalComponentRegistry,
      educationalConceptTaxonomy,
    );
    expect(getAssetQaErrors(findings).some((f) => f.ruleId === 'library_ready_audit_not_passed')).toBe(true);
  });

  it('getAssetQaErrors and getAssetQaWarnings accept undefined gracefully', () => {
    expect(getAssetQaErrors(undefined)).toEqual([]);
    expect(getAssetQaWarnings(undefined)).toEqual([]);
  });
});
