/**
 * QuoteScope.ts — Canonical quote scope contract.
 *
 * PR13 — Defines the single canonical scope model shared by:
 *   - Customer "What's included" deck block
 *   - Engineer handoff includedScope
 *   - Portal future upgrades tab
 *
 * All three surfaces derive their scope content from QuoteScopeItem[] — no
 * duplicate lists and no customer/engineer mismatch.
 *
 * Design rules:
 *   - Status separates included works from optional upsells and future paths.
 *   - Compliance items (G3, discharge route, etc.) are category='compliance',
 *     status='included' — they are requirements, not benefits.
 *   - customerBenefit is only present when the item has a meaningful end-user
 *     outcome; compliance items must not carry a benefit description.
 *   - engineerNote carries install-time operational detail for the handoff.
 */

// ─── Category ─────────────────────────────────────────────────────────────────

/**
 * Scope category — describes what kind of work or equipment this item represents.
 *
 * heat_source  — the primary heat generator (boiler, heat pump)
 * hot_water    — cylinder, thermal store, or DHW strategy
 * controls     — thermostats, TRVs, zoning, smart controls
 * protection   — inhibitor, filter, scale prevention, surge protection
 * pipework     — primary circuit, zone valves, header changes
 * flush        — power flush, chemical clean, system drain
 * compliance   — regulatory requirements (G3, Building Regs, MCS, discharge route)
 * future       — items for future installation readiness (EV, ASHP, PV)
 */
export type QuoteScopeCategory =
  | 'heat_source'
  | 'hot_water'
  | 'controls'
  | 'protection'
  | 'pipework'
  | 'flush'
  | 'compliance'
  | 'future';

// ─── Status ───────────────────────────────────────────────────────────────────

/**
 * Scope status — describes whether the item is covered in the current quote.
 *
 * included     — confirmed in the current scope of work / quotation
 * recommended  — advised but not yet committed (upgrade opportunity)
 * optional     — customer choice, not required for the system to function
 * excluded     — out of scope; present to avoid ambiguity when relevant to decision
 */
export type QuoteScopeStatus =
  | 'included'
  | 'recommended'
  | 'optional'
  | 'excluded';

// ─── Item ─────────────────────────────────────────────────────────────────────

/**
 * QuoteScopeItem — one unit of scope in the canonical quote model.
 *
 * Used by:
 *   - IncludedScopeBlock.items (customer deck)
 *   - EngineerHandoff.includedScope
 *   - AtlasDecisionV1.quoteScope (canonical store)
 */
export interface QuoteScopeItem {
  /** Stable identifier for this scope item, e.g. "gas_system_boiler". */
  id: string;
  /** Short human-readable label, e.g. "210L Mixergy cylinder". */
  label: string;
  /** Category of work or equipment. */
  category: QuoteScopeCategory;
  /** Scope status in this quotation. */
  status: QuoteScopeStatus;
  /**
   * Customer-facing benefit sentence.
   * Only present for non-compliance items where there is a meaningful
   * end-user outcome to communicate.
   */
  customerBenefit?: string;
  /**
   * Engineer-facing operational note.
   * Install-time reminder, e.g. "G3 installer required — commission and notified".
   */
  engineerNote?: string;
}
