import type { BomItem } from '../schema/EngineInputV2_3';

/**
 * Mock trade-price catalogue for UK heating wholesalers.
 *
 * In a production environment this would be replaced by live API calls to:
 *   - Wolseley UK Trade API
 *   - City Plumbing Supplies API
 *
 * Prices are indicative ex-VAT trade prices in GBP.
 */
const PRICE_CATALOGUE: Record<string, number> = {
  // Boilers
  'Worcester Bosch Greenstar 15i': 780,
  'Worcester Bosch Greenstar 20i': 820,
  'Worcester Bosch Greenstar 25i': 875,
  'Worcester Bosch Greenstar 30i': 930,
  'Worcester Bosch Greenstar 35i': 1010,
  'Worcester Bosch Greenstar 40i': 1090,
  'Worcester Bosch Greenstar 15i System': 760,
  'Worcester Bosch Greenstar 20i System': 800,
  'Worcester Bosch Greenstar 25i System': 855,
  'Worcester Bosch Greenstar 30i System': 910,
  'Worcester Bosch Greenstar 35i System': 990,
  'Worcester Bosch Greenstar 40i System': 1070,
  // Cylinders
  'Mixergy MX-150-IND': 980,
  'Mixergy MX-195-IND': 1090,
  'Mixergy MX-210-IND': 1150,
  'Mixergy MX-250-IND': 1260,
  'Mixergy MX-300-IND': 1410,
  // Pipework
  '28mm Copper Pipe (per metre)': 4.20,
  // Accessories
  'Fernox TF1 Compact': 62,
  'Fernox DS3 Scale Inhibitor': 28,
  // Buffer vessels
  'Gledhill Buffer Vessel 50L': 195,
  'Gledhill Buffer Vessel 100L': 285,
};

/**
 * Looks up the indicative trade unit price for a BOM item model string.
 * Falls back to a heuristic based on product category if no exact match.
 */
function lookupUnitPrice(model: string): number | undefined {
  // Exact match
  if (model in PRICE_CATALOGUE) return PRICE_CATALOGUE[model];

  // Partial match – iterate catalogue keys
  for (const [key, price] of Object.entries(PRICE_CATALOGUE)) {
    if (model.startsWith(key) || key.startsWith(model)) return price;
  }

  return undefined;
}

/**
 * Enriches a Bill of Materials with indicative trade prices from the
 * wholesaler catalogue.  Items where no price can be determined are
 * returned unchanged (unitPriceGbp remains undefined).
 */
export function applyWholesalerPricing(items: BomItem[]): BomItem[] {
  return items.map(item => {
    const price = lookupUnitPrice(item.model);
    return price !== undefined ? { ...item, unitPriceGbp: price } : item;
  });
}

/**
 * Calculates the total trade cost of a priced BOM.
 * Items without a price are excluded from the total.
 */
export function calculateBomTotal(items: BomItem[]): number {
  return items.reduce((acc, item) => {
    if (item.unitPriceGbp !== undefined) {
      return acc + item.unitPriceGbp * item.quantity;
    }
    return acc;
  }, 0);
}

/**
 * Exports the BOM as a CSV string suitable for download or upload to a
 * purchase order system.
 *
 * Columns: Item, Model, Qty, Unit Price (£), Line Total (£), Notes
 */
export function exportBomToCsv(items: BomItem[]): string {
  const header = 'Item,Model,Qty,Unit Price (£),Line Total (£),Notes';
  const rows = items.map(item => {
    const qty = item.quantity;
    const unit = item.unitPriceGbp !== undefined ? item.unitPriceGbp.toFixed(2) : '';
    const lineTotal =
      item.unitPriceGbp !== undefined ? (item.unitPriceGbp * qty).toFixed(2) : '';
    // Escape commas in text fields
    const name = `"${item.name.replace(/"/g, '""')}"`;
    const model = `"${item.model.replace(/"/g, '""')}"`;
    const notes = `"${item.notes.replace(/"/g, '""')}"`;
    return `${name},${model},${qty},${unit},${lineTotal},${notes}`;
  });
  return [header, ...rows].join('\n');
}
