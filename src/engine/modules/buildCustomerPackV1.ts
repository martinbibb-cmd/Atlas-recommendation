/**
 * buildCustomerPackV1.ts — Decision-first customer pack builder.
 *
 * Mind PR 35 — Render CustomerPackV1 from decision truth.
 *
 * Architecture:
 *   AtlasDecisionV1 + ScenarioResult[] + BuildCustomerPackContext
 *     → [this function] → CustomerPackV1
 *
 * Source of truth rules (see CustomerPackV1.ts):
 *  1. ALL content maps to a named field in AtlasDecisionV1 or the recommended
 *     ScenarioResult — no inference, no copy generation, no new logic.
 *  2. decision.headline is used verbatim — never re-derived.
 *  3. antiDefault evidence comes ONLY from decision.hardConstraints and
 *     decision.performancePenalties — these are pre-aggregated from rejected
 *     scenarios by buildDecisionFromScenarios.  Raw rejected scenario data
 *     must not be read here.
 *  4. Daily use guidance is derived from the recommended system type using a
 *     deterministic lookup table — no Math.random(), no AI copy.
 *  5. The context argument carries presentation metadata (portalUrl, visitDate)
 *     but never changes recommendation content.
 */

import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type {
  CustomerPackV1,
  CustomerPackDecisionSection,
  CustomerPackAntiDefaultSection,
  CustomerPackDailyUseSection,
} from '../../contracts/CustomerPackV1';

// ─── System label map ─────────────────────────────────────────────────────────

const SYSTEM_LABEL: Record<ScenarioResult['system']['type'], string> = {
  combi:   'Combi boiler',
  system:  'System boiler with unvented cylinder',
  regular: 'Regular boiler with vented cylinder',
  ashp:    'Air source heat pump',
};

/**
 * Subtype-aware label overrides for stored-water scenarios.
 * Mirrors the same logic in buildCustomerSummary for consistency.
 */
const STORED_SCENARIO_LABEL: Record<string, string> = {
  stored_unvented: 'System boiler with unvented cylinder',
  system_unvented: 'System boiler with unvented cylinder',
  stored_vented:   'Regular boiler with vented cylinder',
  regular_vented:  'Regular boiler with vented cylinder',
};

function resolveSystemLabel(scenario: ScenarioResult): string {
  return STORED_SCENARIO_LABEL[scenario.scenarioId] ?? SYSTEM_LABEL[scenario.system.type];
}

// ─── Anti-default narrative ───────────────────────────────────────────────────

/**
 * Builds a one-sentence framing of why this is a deliberate physics choice.
 *
 * The narrative reflects the system type and the presence of hard constraints
 * or performance penalties.  It names the physics-based reason, not a commercial
 * preference.
 */
function buildAntiDefaultNarrative(
  scenario: ScenarioResult,
  decision: AtlasDecisionV1,
): string {
  const hasHardConstraints = (decision.hardConstraints?.length ?? 0) > 0;
  const hasPenalties       = (decision.performancePenalties?.length ?? 0) > 0;

  switch (scenario.system.type) {
    case 'ashp':
      if (hasHardConstraints || hasPenalties) {
        return (
          'An air source heat pump was selected because the physics of this home ' +
          'make a gas boiler replacement the wrong long-term choice.'
        );
      }
      return (
        'An air source heat pump was selected because this home meets the ' +
        'thermal and electrical conditions for low-carbon heating.'
      );

    case 'system':
      if (hasHardConstraints || hasPenalties) {
        return (
          'A system boiler with unvented cylinder was selected because the ' +
          'simultaneous hot-water demand and mains pressure conditions of this ' +
          'home make a combi boiler physically unsuitable.'
        );
      }
      return (
        'A system boiler with unvented cylinder was selected because stored ' +
        'hot water is the right architecture for this home\'s demand profile.'
      );

    case 'regular':
      if (hasHardConstraints || hasPenalties) {
        return (
          'A regular boiler with vented cylinder was selected because the ' +
          'mains pressure and flow conditions of this home require a tank-fed ' +
          'hot water arrangement.'
        );
      }
      return (
        'A regular boiler with vented cylinder was selected because the ' +
        'existing tank-fed arrangement is the correct fit for this property.'
      );

    case 'combi':
      return (
        'A combi boiler was selected because this home\'s demand profile, ' +
        'occupancy, and mains supply conditions are well-matched to on-demand ' +
        'hot water delivery.'
      );
  }
}

/**
 * Builds the anti-default section from pre-aggregated constraint data only.
 *
 * Evidence comes from AtlasDecisionV1.hardConstraints and
 * AtlasDecisionV1.performancePenalties — these were assembled by
 * buildDecisionFromScenarios from rejected scenarios' physics failures.
 * Raw rejected scenario data is never read here.
 */
function buildAntiDefault(
  scenario: ScenarioResult,
  decision: AtlasDecisionV1,
): CustomerPackAntiDefaultSection {
  const evidencePoints: string[] = [
    ...(decision.hardConstraints ?? []),
    ...(decision.performancePenalties ?? []),
  ];

  return {
    narrative:     buildAntiDefaultNarrative(scenario, decision),
    evidencePoints,
  };
}

// ─── Daily use guidance ───────────────────────────────────────────────────────

/**
 * Deterministic daily use guidance keyed by system type.
 *
 * These are practical operating instructions derived from system physics —
 * not marketing copy.  They are not configurable by brand.
 */
const DAILY_USE_GUIDANCE: Record<ScenarioResult['system']['type'], string[]> = {
  combi: [
    'Hot water is delivered on demand — no pre-heat period needed.',
    'Set your heating schedule using the programmer or smart thermostat.',
    'Check the boiler pressure gauge monthly — the normal operating range is 1–1.5 bar.',
    'If pressure drops below 1 bar, repressurise via the filling loop following the manufacturer\'s instructions.',
  ],
  system: [
    'Hot water is stored in the cylinder — the cylinder thermostat should be set to at least 60 °C to prevent Legionella growth.',
    'Run the hot water once a week if the property is unoccupied to maintain cylinder temperature.',
    'Set your heating schedule using the programmer or smart thermostat.',
    'Check the boiler pressure gauge monthly — the normal operating range is 1–1.5 bar.',
  ],
  regular: [
    'Hot water is stored in the vented cylinder — the cylinder thermostat should be set to at least 60 °C.',
    'Run the hot water once a week if the property is unoccupied to maintain cylinder temperature.',
    'The cold water storage tank in the loft requires periodic visual inspection for debris and sediment.',
    'Set your heating schedule using the programmer or room thermostat.',
  ],
  ashp: [
    'Heat pumps run most efficiently at lower flow temperatures — avoid raising the thermostat suddenly.',
    'Set the heating schedule to run for longer periods at lower temperatures rather than short high-temperature blasts.',
    'The hot water cylinder thermostat should be set to at least 60 °C; the heat pump will manage this automatically.',
    'Keep the external unit clear of leaves, snow, and obstructions to maintain airflow.',
  ],
};

function buildDailyUse(scenario: ScenarioResult): CustomerPackDailyUseSection {
  return { guidance: DAILY_USE_GUIDANCE[scenario.system.type] };
}

// ─── Decision section ─────────────────────────────────────────────────────────

function buildDecisionSection(
  decision: AtlasDecisionV1,
  scenario: ScenarioResult,
): CustomerPackDecisionSection {
  return {
    recommendedScenarioId: decision.recommendedScenarioId,
    recommendedSystemLabel: resolveSystemLabel(scenario),
    headline: decision.headline,
    summary:  decision.summary,
  };
}

// ─── Full system section ──────────────────────────────────────────────────────

function buildFullSystemSection(decision: AtlasDecisionV1) {
  // includedItems: quoteScope status === 'included', excluding verification items
  const includedItems = decision.quoteScope
    .filter(
      (item) =>
        item.status === 'included' &&
        item.category !== 'compliance' &&
        !item.label.toLowerCase().startsWith('confirm ') &&
        !item.label.toLowerCase().startsWith('verify '),
    )
    .map((item) => item.label);

  // Fall back to includedItems array when quoteScope is empty
  const resolvedIncluded =
    includedItems.length > 0 ? includedItems : [...decision.includedItems];

  // compatibilityNotes: compatibilityWarnings + required quoteScope items
  const notesSet = new Set<string>(decision.compatibilityWarnings);
  for (const item of decision.quoteScope) {
    if (item.status === 'required') {
      notesSet.add(item.label);
    }
  }

  return {
    includedItems:      resolvedIncluded,
    requiredWorks:      [...decision.requiredWorks],
    compatibilityNotes: Array.from(notesSet),
  };
}

// ─── Public context type ──────────────────────────────────────────────────────

/**
 * Presentation context that can influence pack rendering but must not change
 * recommendation content.
 */
export interface BuildCustomerPackContext {
  /**
   * Signed portal URL for the CTA section.
   * When provided the close section shows a link and QR placeholder.
   */
  portalUrl?: string;
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * buildCustomerPackV1
 *
 * Builds the 8-section CustomerPackV1 from locked decision and scenario truth.
 *
 * Invariants (enforced by this function):
 *  1. pack.decision.recommendedScenarioId === decision.recommendedScenarioId
 *  2. pack.decision.headline === decision.headline (verbatim, engine-derived)
 *  3. pack.antiDefault.evidencePoints come only from decision.hardConstraints
 *     and decision.performancePenalties — never from raw scan evidence
 *  4. No alternative recommendation appears in any section
 *  5. Brand does not affect content — brand is applied by the view layer only
 *
 * @throws {Error} when the recommended scenario cannot be found in scenarios[].
 */
export function buildCustomerPackV1(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
  context?: BuildCustomerPackContext,
): CustomerPackV1 {
  // Resolve recommended scenario strictly by recommendedScenarioId — no scoring
  const recommended = scenarios.find(
    (s) => s.scenarioId === decision.recommendedScenarioId,
  );
  if (!recommended) {
    throw new Error(
      `buildCustomerPackV1: scenario "${decision.recommendedScenarioId}" not found in scenarios array`,
    );
  }

  // Future paths: union of decision futureUpgradePaths and quoteScope future items
  const futureSet = new Set<string>(decision.futureUpgradePaths);
  for (const item of decision.quoteScope) {
    if (item.category === 'future') {
      futureSet.add(item.label);
    }
  }

  return {
    // Section 1 — locked recommendation identity
    decision: buildDecisionSection(decision, recommended),

    // Section 2 — physics reasons (from keyReasons only, not from rejected scenarios)
    whyThisWorks: {
      reasons: [...decision.keyReasons],
    },

    // Section 3 — anti-default evidence (from pre-aggregated hard constraints only)
    antiDefault: buildAntiDefault(recommended, decision),

    // Section 4 — day-to-day outcomes from recommended scenario
    dailyBenefits: {
      outcomes: [...decision.dayToDayOutcomes],
    },

    // Section 5 — full scope of work
    fullSystem: buildFullSystemSection(decision),

    // Section 6 — deterministic daily use guidance by system type
    dailyUse: buildDailyUse(recommended),

    // Section 7 — future upgrade paths
    futurePath: {
      upgradePaths: Array.from(futureSet),
    },

    // Section 8 — CTA, portal link from context only
    close: {
      nextStep:
        'Your installer will confirm the installation date and arrange any ' +
        'pre-installation checks required.',
      portalUrl: context?.portalUrl,
    },
  };
}
