import { describe, expect, it } from 'vitest';
import type { BrandProfileV1 } from '../../features/branding/brandProfile';
import { buildBrandedCalmWelcomePackViewModel } from '../packRenderer/buildBrandedCalmWelcomePackViewModel';
import type { CalmWelcomePackViewModelV1 } from '../packRenderer/CalmWelcomePackViewModelV1';

const baseCalmViewModel: CalmWelcomePackViewModelV1 = {
  packId: 'welcome-pack:ashp',
  recommendedScenarioId: 'ashp',
  title: 'Welcome pack — Air source heat pump with stored hot water',
  customerFacingSections: [],
  qrDestinations: [],
  internalOmissionLog: [
    {
      reason: 'internal diagnostic note',
    },
  ],
  pageEstimate: {
    usedPages: 1,
    maxPages: 4,
  },
  readiness: {
    safeForCustomer: true,
    blockingReasons: [],
  },
};

const installerBrand: BrandProfileV1 = {
  version: '1.0',
  brandId: 'installer-demo',
  companyName: 'Demo Heating Co',
  logoUrl: 'https://example.com/demo-logo.svg',
  theme: {
    primaryColor: '#16A34A',
  },
  contact: {
    phone: '0800 123 4567',
  },
  outputSettings: {
    showPricing: true,
    showCarbon: true,
    showInstallerContact: true,
    tone: 'friendly',
  },
};

describe('buildBrandedCalmWelcomePackViewModel', () => {
  it('falls back to Atlas defaults when brand input is missing', () => {
    const result = buildBrandedCalmWelcomePackViewModel({
      calmViewModel: baseCalmViewModel,
      generatedAt: '2026-05-10T00:00:00.000Z',
    });

    expect(result.brandName).toBe('Atlas');
    expect(result.brandTone).toBe('technical');
    expect(result.generatedAt).toBe('2026-05-10T00:00:00.000Z');
  });

  it('decorates with brand metadata without changing recommendation, readiness, or content', () => {
    const result = buildBrandedCalmWelcomePackViewModel({
      calmViewModel: baseCalmViewModel,
      brandProfile: installerBrand,
      visitReference: 'VIS-456',
      generatedAt: '2026-05-10T12:00:00.000Z',
    });

    expect(result.recommendedScenarioId).toBe(baseCalmViewModel.recommendedScenarioId);
    expect(result.customerFacingSections).toEqual(baseCalmViewModel.customerFacingSections);
    expect(result.readiness).toEqual(baseCalmViewModel.readiness);

    expect(result.brandName).toBe('Demo Heating Co');
    expect(result.brandLogoUrl).toBe('https://example.com/demo-logo.svg');
    expect(result.brandContactLabel).toBe('0800 123 4567');
    expect(result.brandTone).toBe('friendly');
    expect(result.generatedAt).toBe('2026-05-10T12:00:00.000Z');
    expect(result.visitReference).toBe('VIS-456');
  });

  it('does not expose internal diagnostics via brand fields', () => {
    const result = buildBrandedCalmWelcomePackViewModel({
      calmViewModel: baseCalmViewModel,
      brandProfile: installerBrand,
      generatedAt: '2026-05-10T12:00:00.000Z',
    });

    const safeSurface = JSON.stringify({
      brandName: result.brandName,
      brandLogoUrl: result.brandLogoUrl,
      brandContactLabel: result.brandContactLabel,
      brandTone: result.brandTone,
      generatedAt: result.generatedAt,
      visitReference: result.visitReference,
    }).toLowerCase();

    expect(safeSurface).not.toContain('diagnostic');
    expect(safeSurface).not.toContain('internal');
  });
});
