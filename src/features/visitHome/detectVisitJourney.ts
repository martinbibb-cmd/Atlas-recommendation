/**
 * detectVisitJourney.ts
 *
 * Derives the primary journey archetype for a completed visit from the engine
 * output and survey model.  Used by VisitHomeDashboard to render the Journey
 * card without re-running the engine.
 *
 * Four named archetypes (matching the problem statement):
 *   open_vented_to_sealed_unvented
 *   heat_pump_reality
 *   water_constraint
 *   regular_unvented
 *
 * Detection order matters: if multiple signals fire the first match wins.
 * All logic is read-only over engine output — no side effects.
 */

import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VisitJourneyArchetype =
  | 'open_vented_to_sealed_unvented'
  | 'heat_pump_reality'
  | 'water_constraint'
  | 'regular_unvented'
  | null;

export interface VisitJourneyInfo {
  archetype: VisitJourneyArchetype;
  /** Short display label shown in the Journey card. */
  label: string;
  /** One-line description explaining what this journey means for the customer. */
  description: string;
  /** Emoji or short icon hint for the card. */
  icon: string;
}

// ─── Detection ────────────────────────────────────────────────────────────────

const HEAT_PUMP_PATTERN = /\b(ashp|heat.pump|hp)\b/i;
const WATER_CONSTRAINT_PATTERN = /\b(pressure|flow|hydraulic|mains|pipe)\b/i;
const STORED_UNVENTED_PATTERN = /\b(system_unvented|regular_unvented|unvented)\b/i;
const REGULAR_PATTERN = /\b(regular_unvented|regular)\b/i;

/**
 * Detects the primary journey archetype from engine output and supporting data.
 *
 * @param engineOutput   Engine output from runEngine().
 * @param scenarios      Evaluated scenario results for this visit.
 * @param systemCircuit  The current heating system circuit type from the survey.
 */
export function detectVisitJourney(
  engineOutput: EngineOutputV1 | undefined,
  scenarios: ScenarioResult[] | undefined,
  systemCircuit?: 'open_vented' | 'sealed' | 'unknown',
): VisitJourneyInfo {
  const primary = engineOutput?.recommendation?.primary ?? '';
  const primaryLower = primary.toLowerCase();

  // 1. Heat pump reality — engine recommends ashp
  if (HEAT_PUMP_PATTERN.test(primaryLower)) {
    return {
      archetype: 'heat_pump_reality',
      label: 'Heat pump reality',
      description: 'Heat pump feasibility, emitter sizing, and low-temperature operation.',
      icon: '🌡️',
    };
  }

  // 2. Open-vented → sealed + unvented
  // Current system is open-vented AND recommended option is unvented/system/regular with cylinder.
  if (systemCircuit === 'open_vented' && STORED_UNVENTED_PATTERN.test(primaryLower)) {
    return {
      archetype: 'open_vented_to_sealed_unvented',
      label: 'Open-vented → sealed + unvented',
      description: 'Primary circuit conversion from tank-fed supply to mains-fed supply.',
      icon: '🔄',
    };
  }
  // Also detect via scenario flags when survey circuit is unavailable
  if (
    systemCircuit === 'open_vented' &&
    scenarios?.some((s) => STORED_UNVENTED_PATTERN.test(s.scenarioId) && s.system.type !== 'combi')
  ) {
    return {
      archetype: 'open_vented_to_sealed_unvented',
      label: 'Open-vented → sealed + unvented',
      description: 'Primary circuit conversion from tank-fed supply to mains-fed supply.',
      icon: '🔄',
    };
  }

  // 3. Water constraint — evidence or limiters signal pressure/flow issues
  const hasWaterConstraint =
    engineOutput?.evidence?.some(
      (e) =>
        WATER_CONSTRAINT_PATTERN.test(e.label) &&
        (e.confidence === 'low' || e.confidence === 'medium'),
    ) ||
    engineOutput?.redFlags?.some(
      (f) =>
        WATER_CONSTRAINT_PATTERN.test(f.title + ' ' + (f.detail ?? '')) &&
        f.severity !== 'info',
    ) ||
    scenarios?.some((s) => s.physicsFlags?.pressureConstraint || s.physicsFlags?.hydraulicLimit);

  if (hasWaterConstraint) {
    return {
      archetype: 'water_constraint',
      label: 'Water constraint',
      description: 'Mains pressure or pipe diameter affects hot-water and heating performance.',
      icon: '💧',
    };
  }

  // 4. Regular + unvented — regular system type recommended
  if (REGULAR_PATTERN.test(primaryLower) || STORED_UNVENTED_PATTERN.test(primaryLower)) {
    return {
      archetype: 'regular_unvented',
      label: 'Regular + unvented',
      description: 'Stored mains-fed hot water with regular boiler — high-demand fit.',
      icon: '🛁',
    };
  }

  // Fallback — no journey card detected
  return {
    archetype: null,
    label: '',
    description: '',
    icon: '',
  };
}
