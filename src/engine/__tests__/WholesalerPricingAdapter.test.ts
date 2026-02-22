import { describe, it, expect } from 'vitest';
import {
  applyWholesalerPricing,
  calculateBomTotal,
  exportBomToCsv,
} from '../modules/WholesalerPricingAdapter';
import type { BomItem } from '../schema/EngineInputV2_3';

const sampleBom: BomItem[] = [
  {
    name: 'System Boiler',
    model: 'Worcester Bosch Greenstar 25i System',
    quantity: 1,
    notes: '25kW output',
  },
  {
    name: 'Hot Water Cylinder (Mixergy)',
    model: 'Mixergy MX-150-IND',
    quantity: 1,
    notes: '150L Mixergy smart cylinder',
  },
  {
    name: 'Magnetic System Filter',
    model: 'Fernox TF1 Compact',
    quantity: 1,
    notes: 'Removes magnetite',
  },
  {
    name: 'Scale Inhibitor Dosing Unit',
    model: 'Fernox DS3 Scale Inhibitor',
    quantity: 1,
    notes: 'Annual dosing',
  },
];

describe('WholesalerPricingAdapter', () => {
  it('applies prices to known models', () => {
    const priced = applyWholesalerPricing(sampleBom);
    expect(priced[0].unitPriceGbp).toBeGreaterThan(0);
    expect(priced[1].unitPriceGbp).toBeGreaterThan(0);
  });

  it('does not mutate original BOM items', () => {
    const original = sampleBom.map(i => ({ ...i }));
    applyWholesalerPricing(sampleBom);
    expect(sampleBom[0].unitPriceGbp).toBeUndefined();
    expect(sampleBom).toEqual(original);
  });

  it('leaves unitPriceGbp undefined for unknown models', () => {
    const unknownItem: BomItem = {
      name: 'Exotic Gizmo',
      model: 'NoNameBrand XYZ-9000',
      quantity: 1,
      notes: '',
    };
    const priced = applyWholesalerPricing([unknownItem]);
    expect(priced[0].unitPriceGbp).toBeUndefined();
  });

  it('calculates correct BOM total', () => {
    const priced = applyWholesalerPricing(sampleBom);
    const total = calculateBomTotal(priced);
    expect(total).toBeGreaterThan(0);
    // Manual check: 855 + 980 + 62 + 28 = 1925
    expect(total).toBeCloseTo(855 + 980 + 62 + 28, 0);
  });

  it('excludes unpriced items from total', () => {
    const mixed: BomItem[] = [
      { name: 'Known', model: 'Fernox TF1 Compact', quantity: 2, notes: '' },
      { name: 'Unknown', model: 'Mystery Widget', quantity: 1, notes: '' },
    ];
    const priced = applyWholesalerPricing(mixed);
    const total = calculateBomTotal(priced);
    // 62 * 2 = 124
    expect(total).toBeCloseTo(124, 0);
  });

  it('exports valid CSV with header row', () => {
    const priced = applyWholesalerPricing(sampleBom);
    const csv = exportBomToCsv(priced);
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Item');
    expect(lines[0]).toContain('Unit Price');
    expect(lines.length).toBe(sampleBom.length + 1); // header + one row per item
  });

  it('CSV contains model name for each item', () => {
    const priced = applyWholesalerPricing(sampleBom);
    const csv = exportBomToCsv(priced);
    expect(csv).toContain('Fernox TF1 Compact');
    expect(csv).toContain('Mixergy MX-150-IND');
  });

  it('handles multi-quantity items in total correctly', () => {
    const multiQty: BomItem[] = [
      { name: 'Pipe', model: '28mm Copper Pipe (per metre)', quantity: 10, notes: '' },
    ];
    const priced = applyWholesalerPricing(multiQty);
    const total = calculateBomTotal(priced);
    expect(total).toBeCloseTo(4.2 * 10, 1);
  });
});
