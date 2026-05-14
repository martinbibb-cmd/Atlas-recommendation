import { describe, expect, it } from 'vitest';
import {
  PORTAL_HOME_FALLBACK,
  resolvePortalAddressSummary,
  resolvePortalHomeLabel,
  sanitizePortalVisitContextForExport,
} from '../portalVisitContext';

describe('portalVisitContext helpers', () => {
  it('falls back to generic home copy when personal data is absent', () => {
    expect(resolvePortalHomeLabel()).toBe(PORTAL_HOME_FALLBACK);
    expect(resolvePortalHomeLabel({ personalDataMode: 'none' })).toBe(PORTAL_HOME_FALLBACK);
  });

  it('renders an optional display label only when the mode allows it', () => {
    expect(resolvePortalHomeLabel({
      customerDisplayLabel: 'The Smith household',
      personalDataMode: 'display_label_only',
    })).toBe('The Smith household');
    expect(resolvePortalHomeLabel({
      customerDisplayLabel: 'The Smith household',
      personalDataMode: 'none',
    })).toBe(PORTAL_HOME_FALLBACK);
  });

  it('hides address summary from print by default', () => {
    expect(resolvePortalAddressSummary({
      addressSummary: '3-bed semi in Portsmouth',
      personalDataMode: 'address_summary',
    })).toBeUndefined();
  });

  it('strips address summary when export mode is display-label-only', () => {
    const sanitized = sanitizePortalVisitContextForExport({
      portalReference: 'portal-ref',
      workspaceId: 'workspace-1',
      brandId: 'atlas-default',
      visitReference: 'visit-1',
      customerDisplayLabel: 'The Smith household',
      addressSummary: '3-bed semi in Portsmouth',
      propertyFacts: ['2 bathrooms'],
      usageFacts: ['3-person household'],
      recommendationSummary: 'Hot water setup ready for busy mornings.',
      selectedScenarioId: 'system_unvented_cylinder',
      accessMode: 'token_link',
      personalDataMode: 'display_label_only',
    });

    expect(sanitized.customerDisplayLabel).toBe('The Smith household');
    expect(sanitized.addressSummary).toBeUndefined();
  });

  it('downgrades full-customer-record export mode unless explicitly allowed', () => {
    const sanitized = sanitizePortalVisitContextForExport({
      portalReference: 'portal-ref',
      workspaceId: 'workspace-1',
      brandId: 'atlas-default',
      visitReference: 'visit-1',
      customerDisplayLabel: 'The Smith household',
      addressSummary: '3-bed semi in Portsmouth',
      propertyFacts: ['2 bathrooms'],
      usageFacts: ['3-person household'],
      recommendationSummary: 'Hot water setup ready for busy mornings.',
      selectedScenarioId: 'system_unvented_cylinder',
      accessMode: 'token_link',
      personalDataMode: 'full_customer_record',
    });

    expect(sanitized.personalDataMode).toBe('address_summary');
    expect(sanitized.addressSummary).toBe('3-bed semi in Portsmouth');
  });
});
