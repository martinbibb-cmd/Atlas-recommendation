/**
 * buildScenarioDisplayIdentity.ts — Single authoritative resolver for
 * customer-facing scenario display copy.
 *
 * This is the only place where system.type and dhwSubtype are mapped to
 * customer-facing strings.  All presentation surfaces (portal, print pack,
 * comparison card, daily-use card, Atlas Pick badge, hero headline) must
 * call this function or read scenario.display — never implement their own
 * local label maps or Mixergy regex checks.
 *
 * Usage:
 *   import { buildScenarioDisplayIdentity } from './buildScenarioDisplayIdentity';
 *   const display = scenario.display ?? buildScenarioDisplayIdentity(scenario);
 *   // use display.title, display.headline, display.atlasPickLabel, etc.
 */

import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type { ScenarioDisplayIdentity } from '../../contracts/ScenarioDisplayIdentity';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Headline shown when the customer has selected a combi boiler despite Atlas
 * recommending a stored-water system (e.g. due to simultaneous demand risk).
 *
 * Exported so that DecisionSynthesisPage and other surfaces can reference the
 * single canonical string without re-declaring it locally.
 */
export const COMBI_SELECTED_COMPROMISE_HEADLINE =
  'Combi selected — acceptable day-to-day compromise, but not ideal for simultaneous outlet use.';

// ─── Canonical identity map ───────────────────────────────────────────────────

/**
 * Canonical display identity per scenarioId.
 *
 * scenarioId is the most precise key because it encodes both the heat source
 * (system/regular) and the DHW arrangement (unvented/vented).  system.type
 * alone is ambiguous for stored-water scenarios.
 */
const SCENARIO_ID_IDENTITY: Record<string, {
  title: string;
  shortTitle: string;
  familyLabel: string;
  headline: string;
}> = {
  combi: {
    title:       'Combi boiler',
    shortTitle:  'Combi',
    familyLabel: 'On-demand hot water',
    headline:    'A combi boiler is the right fit for this home.',
  },
  stored_unvented: {
    title:       'System boiler',
    shortTitle:  'System boiler',
    familyLabel: 'Stored hot water',
    headline:    'A system boiler with unvented cylinder is the right fit for this home.',
  },
  system_unvented: {
    title:       'System boiler',
    shortTitle:  'System boiler',
    familyLabel: 'Stored hot water',
    headline:    'A system boiler with unvented cylinder is the right fit for this home.',
  },
  stored_vented: {
    title:       'Regular boiler',
    shortTitle:  'Regular boiler',
    familyLabel: 'Stored hot water',
    headline:    'A regular boiler with vented cylinder is the right fit for this home.',
  },
  regular_vented: {
    title:       'Regular boiler',
    shortTitle:  'Regular boiler',
    familyLabel: 'Stored hot water',
    headline:    'A regular boiler with vented cylinder is the right fit for this home.',
  },
  ashp: {
    title:       'Air source heat pump',
    shortTitle:  'Heat pump',
    familyLabel: 'Heat pump',
    headline:    'An air source heat pump is the right fit for this home.',
  },
};

/** Fallback identity map keyed by system.type for scenarioIds not listed above. */
const SYSTEM_TYPE_IDENTITY: Record<ScenarioResult['system']['type'], {
  title: string;
  shortTitle: string;
  familyLabel: string;
  headline: string;
}> = {
  combi: {
    title:       'Combi boiler',
    shortTitle:  'Combi',
    familyLabel: 'On-demand hot water',
    headline:    'A combi boiler is the right fit for this home.',
  },
  system: {
    title:       'System boiler',
    shortTitle:  'System boiler',
    familyLabel: 'Stored hot water',
    headline:    'A system boiler is the right fit for this home.',
  },
  regular: {
    title:       'Regular boiler',
    shortTitle:  'Regular boiler',
    familyLabel: 'Stored hot water',
    headline:    'A regular boiler is the right fit for this home.',
  },
  ashp: {
    title:       'Air source heat pump',
    shortTitle:  'Heat pump',
    familyLabel: 'Heat pump',
    headline:    'An air source heat pump is the right fit for this home.',
  },
};

// ─── Public builder ───────────────────────────────────────────────────────────

/**
 * buildScenarioDisplayIdentity
 *
 * Resolves the full customer-facing display identity for a scenario.
 *
 * Priority order:
 *   1. Mixergy override — when dhwSubtype === 'mixergy', always use Mixergy copy.
 *   2. scenarioId canonical map — most precise, encodes DHW arrangement.
 *   3. system.type fallback — for scenarioIds not in the canonical map.
 *
 * The returned object is safe to store on ScenarioResult.display so that
 * downstream surfaces never need to re-derive it.
 */
export function buildScenarioDisplayIdentity(
  scenario: ScenarioResult,
): ScenarioDisplayIdentity {
  // ── 1. Mixergy override ──────────────────────────────────────────────────────
  if (scenario.dhwSubtype === 'mixergy') {
    const boilerLabel = scenario.system.type === 'regular' ? 'Regular boiler' : 'System boiler';
    const fullLabel = `${boilerLabel} with Mixergy cylinder`;
    return {
      title:       fullLabel,
      shortTitle:  'Mixergy',
      familyLabel: 'Stored hot water',
      atlasPickLabel: fullLabel,
      headline:    `A ${boilerLabel.toLowerCase()} with Mixergy cylinder is the right fit for this home.`,
      constraintAwareDescription:
        'Mixergy operates efficiently from tank-fed supply pressures upward — an immediate upgrade for this property. If mains supply pressure improves in future, the system is already mains-pressure ready.',
    };
  }

  // ── 2. ScenarioId canonical map ──────────────────────────────────────────────
  const byId = SCENARIO_ID_IDENTITY[scenario.scenarioId];

  // ── 3. System-type fallback ──────────────────────────────────────────────────
  const base = byId ?? SYSTEM_TYPE_IDENTITY[scenario.system.type];

  const identity: ScenarioDisplayIdentity = {
    title:          base.title,
    shortTitle:     base.shortTitle,
    familyLabel:    base.familyLabel,
    atlasPickLabel: base.title,
    headline:       base.headline,
  };

  // ── Combi compromise headline ────────────────────────────────────────────────
  // Populated for combi scenarios so that surfaces that know the customer chose
  // combi despite a non-viable rating can surface the correct copy.
  if (scenario.system.type === 'combi') {
    identity.compromiseHeadline = COMBI_SELECTED_COMPROMISE_HEADLINE;
  }

  return identity;
}
