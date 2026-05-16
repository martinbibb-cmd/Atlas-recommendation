/**
 * importVisitWorkflowPackage.test.ts
 *
 * Tests for the workflow export package import helper.
 */

import { describe, it, expect } from 'vitest';
import { parseWorkflowPackageJson } from '../importVisitWorkflowPackage';

const VALID_PACKAGE = {
  visitId: 'visit-abc12345',
  visitReference: 'ABC12345',
  exportedAt: '2025-01-15T10:00:00.000Z',
  engineInput: {
    postcode: 'SW1A 1AA',
    heatLossWatts: 8000,
    bathroomCount: 1,
    occupancyCount: 3,
    dynamicMainsPressure: 2.0,
    mainsDynamicFlowLpm: 14,
  },
  surveyModel: {
    postcode: 'SW1A 1AA',
    heatLossWatts: 8000,
    bathroomCount: 1,
    occupancyCount: 3,
    dynamicMainsPressure: 2.0,
    mainsDynamicFlowLpm: 14,
  },
};

describe('parseWorkflowPackageJson', () => {
  describe('valid JSON string input', () => {
    it('parses a valid package JSON string and returns imported status', () => {
      const result = parseWorkflowPackageJson(JSON.stringify(VALID_PACKAGE));
      expect(result.status).toBe('imported');
    });

    it('extracts visitId, visitReference, and exportedAt from a valid package', () => {
      const result = parseWorkflowPackageJson(JSON.stringify(VALID_PACKAGE));
      if (result.status !== 'imported') throw new Error('Expected imported');
      expect(result.visitId).toBe('visit-abc12345');
      expect(result.visitReference).toBe('ABC12345');
      expect(result.exportedAt).toBe('2025-01-15T10:00:00.000Z');
    });

    it('extracts engineInput when present', () => {
      const result = parseWorkflowPackageJson(JSON.stringify(VALID_PACKAGE));
      if (result.status !== 'imported') throw new Error('Expected imported');
      expect(result.engineInput).toBeDefined();
      expect(result.engineInput?.postcode).toBe('SW1A 1AA');
    });

    it('extracts surveyModel when present', () => {
      const result = parseWorkflowPackageJson(JSON.stringify(VALID_PACKAGE));
      if (result.status !== 'imported') throw new Error('Expected imported');
      expect(result.surveyModel).toBeDefined();
    });
  });

  describe('valid plain object input', () => {
    it('accepts a pre-parsed plain object', () => {
      const result = parseWorkflowPackageJson(VALID_PACKAGE);
      expect(result.status).toBe('imported');
    });

    it('returns imported with optional fields as undefined when absent', () => {
      const minimalPkg = {
        visitId: 'visit-min',
        visitReference: 'MIN00001',
        exportedAt: '2025-01-15T10:00:00.000Z',
      };
      const result = parseWorkflowPackageJson(minimalPkg);
      if (result.status !== 'imported') throw new Error('Expected imported');
      expect(result.engineInput).toBeUndefined();
      expect(result.surveyModel).toBeUndefined();
    });
  });

  describe('invalid input', () => {
    it('returns failed when JSON string is not valid JSON', () => {
      const result = parseWorkflowPackageJson('not valid json {{{');
      expect(result.status).toBe('failed');
      if (result.status !== 'failed') throw new Error('Expected failed');
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns failed when visitId is missing', () => {
      const pkg = { visitReference: 'REF001', exportedAt: '2025-01-15T10:00:00.000Z' };
      const result = parseWorkflowPackageJson(pkg);
      expect(result.status).toBe('failed');
    });

    it('returns failed when visitReference is missing', () => {
      const pkg = { visitId: 'visit-1', exportedAt: '2025-01-15T10:00:00.000Z' };
      const result = parseWorkflowPackageJson(pkg);
      expect(result.status).toBe('failed');
    });

    it('returns failed when exportedAt is missing', () => {
      const pkg = { visitId: 'visit-1', visitReference: 'REF001' };
      const result = parseWorkflowPackageJson(pkg);
      expect(result.status).toBe('failed');
    });

    it('returns failed when input is null', () => {
      const result = parseWorkflowPackageJson(null);
      expect(result.status).toBe('failed');
    });

    it('returns failed when input is an empty object', () => {
      const result = parseWorkflowPackageJson({});
      expect(result.status).toBe('failed');
    });

    it('returns failed for empty JSON string input', () => {
      const result = parseWorkflowPackageJson('{}');
      expect(result.status).toBe('failed');
    });

    it('includes descriptive error messages', () => {
      const result = parseWorkflowPackageJson('{}');
      if (result.status !== 'failed') throw new Error('Expected failed');
      expect(result.errors[0]).toMatch(/visitId|structure|invalid/i);
    });
  });
});
