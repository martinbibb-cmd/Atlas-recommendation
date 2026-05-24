import { describe, expect, it } from 'vitest';
import { resolveCustomerPdfDownloadBaseName } from '../resolveCustomerPdfDownloadBaseName';

describe('resolveCustomerPdfDownloadBaseName', () => {
  it('prefers the visit reference when a named visit exists', () => {
    expect(
      resolveCustomerPdfDownloadBaseName(
        {
          visit_reference: 'Smith Kitchen Upgrade',
          address_line_1: '10 Downing St',
          customer_name: 'Jane Smith',
        },
        'VISIT1234',
        'visit_1234',
      ),
    ).toBe('Smith_Kitchen_Upgrade');
  });

  it('falls back to the exported visit reference when no visit/customer/project name exists', () => {
    expect(
      resolveCustomerPdfDownloadBaseName(
        {
          visit_reference: null,
          address_line_1: null,
          customer_name: null,
        },
        'VISIT1234',
        'visit_1234',
      ),
    ).toBe('VISIT1234');
  });
});
