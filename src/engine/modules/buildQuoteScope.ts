/**
 * buildQuoteScope.ts — Canonical quote scope builder.
 *
 * PR13 — Produces the QuoteScopeItem[] that is the single authoritative source
 * for all scope-related surfaces:
 *   - Customer "What's included" block
 *   - Engineer handoff includedScope
 *   - Portal future upgrades (excludes items already included)
 *
 * Design rules:
 *   - No recommendation logic lives here — only scope assembly.
 *   - All content derives from AtlasDecisionV1 fields.
 *   - Compliance items (G3, discharge route) surface as status='included',
 *     category='compliance' — never as optional upsells.
 *   - Future paths are mapped to status='optional', category='future' so the
 *     portal can filter them away from currently included works.
 *   - Category is inferred from label keywords; callers may override per-item.
 */

import type { QuoteScopeItem, QuoteScopeCategory, QuoteScopeStatus } from '../../contracts/QuoteScope';

// ─── Category inference ───────────────────────────────────────────────────────

/** Keyword patterns mapped to categories — first match wins. */
const CATEGORY_PATTERNS: Array<{ pattern: RegExp; category: QuoteScopeCategory }> = [
  // compliance must be checked before other categories to catch "G3", "discharge", etc.
  { pattern: /g3|discharge|building regs|mcs|part p|compliance|notification|commission/i, category: 'compliance' },
  // future must be checked before heat_source to prevent "heat pump ready" matching heat_source
  { pattern: /solar|heat pump ready|ev ready|pv ready|battery|future|pathway/i,           category: 'future' },
  { pattern: /boiler|heat pump|ashp|gshp|heat source/i,                                   category: 'heat_source' },
  { pattern: /cylinder|dhw|hot water|thermal store|mixergy/i,                             category: 'hot_water' },
  { pattern: /control|thermostat|trv|zone|smart|programmer/i,                             category: 'controls' },
  { pattern: /filter|inhibitor|chemical|scale|sentinel|fernox/i,                          category: 'protection' },
  // flush must be checked before pipework to prevent "Power flush primary circuit" matching pipework
  { pattern: /flush|power flush|clean|drain/i,                                            category: 'flush' },
  { pattern: /pipe|pipework|primary circuit|header|valve/i,                               category: 'pipework' },
];

/**
 * inferCategory — derive a QuoteScopeCategory from a label string.
 * Falls back to 'pipework' when no pattern matches.
 */
export function inferCategory(label: string): QuoteScopeCategory {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(label)) return category;
  }
  return 'pipework';
}

// ─── Public input type ────────────────────────────────────────────────────────

export interface BuildQuoteScopeInput {
  /**
   * Items confirmed in the proposed scope of work, e.g. "210L Mixergy cylinder".
   * Maps to status='included'.
   */
  includedItems: string[];

  /**
   * Works that must be carried out before or during installation,
   * e.g. "G3 commissioning", "Power flush primary circuit".
   * Maps to status='included'; compliance-pattern labels get category='compliance'.
   */
  requiredWorks: string[];

  /**
   * Physics-grounded compatibility warnings.
   * Regulatory warnings (G3, discharge, etc.) surface as compliance items.
   * Non-regulatory warnings are surfaced as recommended items so the engineer
   * is aware, but are not presented to the customer as upsells.
   */
  compatibilityWarnings: string[];

  /**
   * Future upgrade paths this installation enables.
   * Maps to status='optional', category='future'.
   */
  futureUpgradePaths: string[];
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * buildQuoteScope
 *
 * Assembles a QuoteScopeItem[] from the flattened string lists in
 * AtlasDecisionV1. Returns items in a stable order:
 *   1. Included works (heat_source, hot_water, controls, protection, pipework, flush)
 *   2. Compliance requirements (category='compliance', status='included')
 *   3. Recommended upgrades (status='recommended')
 *   4. Future paths (status='optional', category='future')
 *
 * Deduplication: items with identical labels (case-insensitive) are collapsed
 * so the same work cannot appear in both includedItems and requiredWorks.
 */
export function buildQuoteScope(input: BuildQuoteScopeInput): QuoteScopeItem[] {
  const items: QuoteScopeItem[] = [];
  const seenLabels = new Set<string>();

  function addItem(
    label: string,
    status: QuoteScopeStatus,
    categoryOverride?: QuoteScopeCategory,
    engineerNote?: string,
  ) {
    const key = label.toLowerCase().trim();
    if (seenLabels.has(key)) return;
    seenLabels.add(key);

    const category = categoryOverride ?? inferCategory(label);
    const id = `scope-${status}-${category}-${items.length}`;

    const item: QuoteScopeItem = { id, label, category, status };

    if (engineerNote) item.engineerNote = engineerNote;

    // Compliance items must not carry a customerBenefit
    if (category !== 'compliance' && category !== 'future') {
      item.customerBenefit = undefined; // populated by callers who have richer context
    }

    items.push(item);
  }

  // 1. Included items — products and services in the quote
  for (const label of input.includedItems) {
    addItem(label, 'included');
  }

  // 2. Required works — mandatory pre-works and compliance actions
  for (const label of input.requiredWorks) {
    const category = inferCategory(label);
    // Compliance-flavoured required works surface explicitly as compliance items
    const engineerNote = category === 'compliance'
      ? `Required: ${label}`
      : undefined;
    addItem(label, 'included', category, engineerNote);
  }

  // 3. Compatibility warnings — surface regulatory ones as compliance items
  for (const warning of input.compatibilityWarnings) {
    const category = inferCategory(warning);
    if (category === 'compliance') {
      addItem(warning, 'included', 'compliance', `Compliance: ${warning}`);
    }
    // Non-regulatory warnings are informational only; not added to scope list
    // to avoid presenting warnings as deliverables
  }

  // 4. Future paths — optional, category='future'
  for (const path of input.futureUpgradePaths) {
    addItem(path, 'optional', 'future');
  }

  return items;
}

// ─── Scope selectors ──────────────────────────────────────────────────────────

/**
 * scopeIncluded — items confirmed in the current scope of work.
 * Used by customer "What's included" and engineer handoff includedScope.
 */
export function scopeIncluded(scope: QuoteScopeItem[]): QuoteScopeItem[] {
  return scope.filter((s) => s.status === 'included' && s.category !== 'future');
}

/**
 * scopeCompliance — compliance requirements within included scope.
 * Surfaced separately in the engineer handoff as non-benefit requirements.
 */
export function scopeCompliance(scope: QuoteScopeItem[]): QuoteScopeItem[] {
  return scope.filter((s) => s.status === 'included' && s.category === 'compliance');
}

/**
 * scopeRecommended — advised upgrades not yet committed.
 * Surfaced in the portal as separate from included works.
 */
export function scopeRecommended(scope: QuoteScopeItem[]): QuoteScopeItem[] {
  return scope.filter((s) => s.status === 'recommended');
}

/**
 * scopeFuture — future-path items.
 * Used by the portal "Future upgrades" tab after excluding currently included works.
 */
export function scopeFuture(scope: QuoteScopeItem[]): QuoteScopeItem[] {
  return scope.filter((s) => s.status === 'optional' && s.category === 'future');
}

/**
 * scopeFuturePaths — labels of future-path items, for use in FutureUpgradeBlock.paths.
 * Excludes anything already in the included scope to avoid duplication.
 */
export function scopeFuturePaths(scope: QuoteScopeItem[]): string[] {
  const includedLabels = new Set(
    scopeIncluded(scope).map((s) => s.label.toLowerCase().trim()),
  );
  return scopeFuture(scope)
    .map((s) => s.label)
    .filter((label) => !includedLabels.has(label.toLowerCase().trim()));
}
