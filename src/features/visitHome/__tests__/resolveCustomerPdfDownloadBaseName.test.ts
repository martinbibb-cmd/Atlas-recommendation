import { describe, expect, it } from 'vitest';
import { resolveCustomerPdfDownloadBaseName } from '../resolveCustomerPdfDownloadBaseName';

describe('resolveCustomerPdfDownloadBaseName', () => {
  it('prefers canonical visit reference over mutable visit metadata', () => {
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
    ).toBe('VISIT1234');
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

  it('prefers customer name over address when no visit reference exists', () => {
    expect(
      resolveCustomerPdfDownloadBaseName(
        {
          visit_reference: null,
          address_line_1: '10 Downing St',
          customer_name: 'Jane Smith',
        },
        'VISIT1234',
        'visit_1234',
      ),
    ).toBe('Jane_Smith');
  });
});
