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

// ─── Empty scope sentinel ─────────────────────────────────────────────────────

/**
 * Message shown in the "What is included" section when no scope items have
 * been captured yet.  Advisor-facing: prompts confirmation before pack is
 * presented to the customer.
 */
export const EMPTY_SCOPE_MESSAGE =
  'Scope not fully captured yet — confirm quote inclusions before presenting this pack.';

// ─── Label normalisation ──────────────────────────────────────────────────────

/**
 * Maps common label variants to a single canonical label.
 * Case-insensitive key matching is applied by normalizeLabel().
 *
 * Covers the most frequent field-capture variants so that a quoted item
 * labelled "powerflush", "system flush", or "power flush primary circuit"
 * all resolve to the same canonical scope item.
 */
const LABEL_NORMALIZE_MAP: Array<{
  pattern: RegExp;
  /**
   * Canonical replacement.
   * - string → replace label with this value
   * - undefined → recognised but preserve original wording
   *
   * Three distinct states arise from this:
   *   1. pattern matches + canonical string  → normalise to canonical
   *   2. pattern matches + undefined         → recognised; keep original label
   *   3. no pattern match                    → keep original label
   *
   * Guard: always use `canonical ?? trimmed` (never `canonical || trimmed`)
   * so that an empty string canonical is honoured and undefined falls through.
   */
  canonical: string | undefined;
}> = [
  { pattern: /^power.?flush|system.?flush|flush.?primary|circuit.?flush|power.?clean/i, canonical: 'Power flush' },
  { pattern: /^(system\s+)?clean$|system clean/i, canonical: 'Power flush' },
  { pattern: /^magnetic.?filter|mag.?filter|filter$/i, canonical: 'Magnetic filter' },
  // TRVs must appear before the generic thermostat/controls pattern to avoid
  // "thermostatic radiator valves" being swallowed by the thermostat rule.
  { pattern: /^(smart\s+)?trvs?$|thermostatic.?radiator/i, canonical: 'TRVs' },
  { pattern: /^(smart\s+)?controls?$|^thermostat$|^programmer$|weather.?comp/i, canonical: 'Heating controls' },
  { pattern: /^radiator.?(upgrade|replacement)|replace.?radiator/i, canonical: 'Radiator upgrade' },
  { pattern: /^pipework.?(upgrade|replacement)|primary.?pipework|pipe.?upgrade/i, canonical: 'Pipework upgrade' },
  // Cylinder variants: preserve original label (e.g. "Mixergy cylinder", "unvented cylinder")
  // so the actual product name is visible to the customer rather than a generic label.
  { pattern: /^mixergy.?cylinder|unvented.?cylinder|vented.?cylinder|dhw.?cylinder/i, canonical: undefined },
  // Compliance items: preserve original label for regulatory clarity
  // (e.g. "G3 notification" must appear verbatim, not genericised).
  { pattern: /^g3|discharge.?route|tundish|condensate.?(route|drain)|flue.?(route|check)/i, canonical: undefined },
];

/**
 * normalizeLabel — maps a raw label string to its canonical form.
 *
 * Returns the canonical label when a known variant is matched, or the
 * original label (trimmed) when no mapping exists.
 *
 * Exported so callers can apply normalisation before constructing
 * BuildQuoteScopeInput.includedItems.
 */
export function normalizeLabel(label: string): string {
  const trimmed = label.trim();
  for (const { pattern, canonical } of LABEL_NORMALIZE_MAP) {
    if (pattern.test(trimmed)) {
      return canonical ?? trimmed;
    }
  }
  return trimmed;
}

// ─── Verification item detection ─────────────────────────────────────────────

/**
 * VERIFICATION_PATTERNS — phrases that identify pre-installation checks and
 * confirmation notes rather than actual work items.
 *
 * These are things the engineer must verify or confirm before ordering or
 * installing — not deliverables that belong in the customer "included" scope.
 *
 * Any label matching these patterns is reclassified to:
 *   status: 'required'   (or 'recommended' when non-regulatory)
 *   category: 'compliance'
 * and never receives a customerBenefit or whatItDoes description.
 */
const VERIFICATION_PATTERNS: RegExp[] = [
  /\bconfirm/i,
  /\bcheck\b/i,
  /\bverif(y|ication)\b/i,
  /\bremains accessible\b/i,
  /\bbefore ordering\b/i,
];

/**
 * isVerificationItem — returns true when a label describes a pre-install
 * check or confirmation note rather than an actual deliverable work item.
 *
 * Exported so callers (e.g. buildVisualBlocks) can apply the same gate.
 */
export function isVerificationItem(label: string): boolean {
  return VERIFICATION_PATTERNS.some((p) => p.test(label));
}



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

// ─── Customer benefit lookup ──────────────────────────────────────────────────

/**
 * Default customer-facing benefit sentences by category.
 *
 * These are shown in the "Included now" section of the advice pack next to
 * each scope item label, so the customer understands why each piece of work
 * matters to them. Compliance items never carry a benefit (they are requirements).
 */
const DEFAULT_CATEGORY_BENEFITS: Partial<Record<QuoteScopeCategory, string>> = {
  heat_source: 'Delivers reliable heat and hot water for your home',
  hot_water:   'Stores enough hot water for everyone even when used simultaneously',
  controls:    'Improves comfort and reduces wasted energy',
  protection:  'Captures debris and sludge, protecting the new boiler and keeping it efficient',
  flush:       'Removes sludge and scale, improving heat output and extending system life',
  pipework:    'Ensures proper flow throughout the system, preventing bottlenecks',
};

/**
 * Plain-English "what it does" descriptions by category.
 *
 * Explains the work in simple terms, without jargon.  Shown alongside
 * the customer benefit so a customer can understand both what each item
 * is and why it matters before seeing the benefit framing.
 */
const DEFAULT_WHAT_IT_DOES: Partial<Record<QuoteScopeCategory, string>> = {
  heat_source: 'Replaces or upgrades your main boiler or heat pump — the heart of your heating system.',
  hot_water:   'Stores pre-heated hot water so multiple outlets can run simultaneously without any wait.',
  controls:    'Manages when and how your heating and hot water runs, reducing waste and improving comfort.',
  protection:  'Catches magnetite particles and debris circulating inside the heating system before they cause damage.',
  flush:       'Clears accumulated sludge and scale from the pipework and radiators before the new system is fitted.',
  pipework:    'Upgrades or replaces sections of pipe to ensure hot water flows freely around the entire system.',
};

/**
 * Look up a default customer benefit for a scope item.
 * Returns undefined for compliance and future items — they carry no benefit framing.
 */
function defaultBenefit(category: QuoteScopeCategory): string | undefined {
  return DEFAULT_CATEGORY_BENEFITS[category];
}

/**
 * Look up a default "what it does" description for a scope item.
 * Returns undefined for compliance and future items.
 */
function defaultWhatItDoes(category: QuoteScopeCategory): string | undefined {
  return DEFAULT_WHAT_IT_DOES[category];
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
 *
 * Labels are normalised before deduplication so common variants
 * ("powerflush", "system flush", "power flush primary circuit") are treated
 * as the same item.
 *
 * customerBenefit and whatItDoes are populated from DEFAULT_CATEGORY_BENEFITS
 * and DEFAULT_WHAT_IT_DOES for non-compliance, non-future items so the
 * "Included now" section in the advice pack can explain why each piece of
 * work matters to the customer.
 */
export function buildQuoteScope(input: BuildQuoteScopeInput): QuoteScopeItem[] {
  const items: QuoteScopeItem[] = [];
  const seenLabels = new Set<string>();

  function addItem(
    rawLabel: string,
    status: QuoteScopeStatus,
    categoryOverride?: QuoteScopeCategory,
    engineerNote?: string,
  ) {
    const label = normalizeLabel(rawLabel);
    const key = label.toLowerCase().trim();
    if (seenLabels.has(key)) return;
    seenLabels.add(key);

    // Verification / pre-install check items must never appear as included
    // deliverables. Reclassify them to compliance/required so they surface
    // as engineer notes only, without customer benefit framing.
    const verification = isVerificationItem(label);
    const resolvedStatus: QuoteScopeStatus = verification ? 'required' : status;
    const resolvedCategory: QuoteScopeCategory = verification
      ? 'compliance'
      : (categoryOverride ?? inferCategory(label));
    const id = `scope-${resolvedStatus}-${resolvedCategory}-${items.length}`;

    const item: QuoteScopeItem = {
      id,
      label,
      category: resolvedCategory,
      status: resolvedStatus,
    };

    if (engineerNote) item.engineerNote = engineerNote;

    // Attach whatItDoes and customerBenefit for real, non-compliance, non-future items.
    // Compliance, future, and verification items must not carry a benefit description.
    const isRealWork =
      resolvedStatus !== 'excluded' &&
      resolvedCategory !== 'compliance' &&
      resolvedCategory !== 'future' &&
      !verification;
    if (isRealWork) {
      const whatItDoes = defaultWhatItDoes(resolvedCategory);
      if (whatItDoes) item.whatItDoes = whatItDoes;
      const benefit = defaultBenefit(resolvedCategory);
      if (benefit) item.customerBenefit = benefit;
    }

    items.push(item);
  }

  // 1. Included items — products and services in the quote
  for (const label of input.includedItems) {
    addItem(label, 'included');
  }

  // 2. Required works — mandatory pre-works and compliance actions
  for (const label of input.requiredWorks) {
    const category = inferCategory(normalizeLabel(label));
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
 * synthesizeLegacyScope — synthesises QuoteScopeItem[] from a flat string list.
 *
 * Used as a fallback when a decision was built before PR13 introduced quoteScope,
 * so the engine modules that need QuoteScopeItem[] can still operate correctly.
 */
export function synthesizeLegacyScope(includedItems: string[]): QuoteScopeItem[] {
  return includedItems.map((label, i) => ({
    id: `included-legacy-${i}`,
    label,
    category: inferCategory(label),
    status: 'included' as const,
  }));
}

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
