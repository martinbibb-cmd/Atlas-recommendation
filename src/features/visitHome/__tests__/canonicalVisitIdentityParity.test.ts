import { describe, expect, it } from 'vitest';
import { resolveCanonicalVisitExportState } from '../resolveCanonicalVisitExportState';
import { resolveCustomerPdfDownloadBaseName } from '../resolveCustomerPdfDownloadBaseName';

describe('canonical visit identity parity', () => {
  it('reuses one canonical reference for export state and customer PDF filename', () => {
    const state = resolveCanonicalVisitExportState({
      activeVisitId: 'visit_1234',
      activeVisitMeta: {
        visit_reference: 'Mutable label',
        customer_name: 'Jane Smith',
        address_line_1: '10 High Street',
      },
      activeCanonicalPackage: {
        visitIdentity: {
          visitId: 'visit_1234',
          visitReference: 'REF-CANONICAL-1234',
        },
        surveyDraft: { postcode: 'SW1A 1AA' } as never,
        customerPropertyDetails: {},
        workspaceBrandReference: {},
        importExportMetadata: {
          exportedAt: '2026-05-20T00:00:00.000Z',
          source: { target: 'local_only', surface: 'visit_home_export' },
        },
      } as never,
    });

    expect(state).toBeDefined();
    if (!state) return;

    expect(state.visitReference).toBe('REF-CANONICAL-1234');
    expect(
      resolveCustomerPdfDownloadBaseName(
        {
          visit_reference: 'Mutable label',
          customer_name: 'Jane Smith',
          address_line_1: '10 High Street',
        },
        state.visitReference,
        state.exportVisitId,
      ),
    ).toBe('REF-CANONICAL-1234');
  });
});

