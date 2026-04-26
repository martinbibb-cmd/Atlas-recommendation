/**
 * ControlsAdviceModule.ts
 *
 * Generates plain-English controls advice for the engine output based on
 * the surveyed current system and target recommendation.
 *
 * Rules:
 *   - Advice is graded: 'recommended' (clear benefit), 'consider' (marginal),
 *     'optional' (nice-to-have).
 *   - Only advice that is relevant to the surveyed system and recommendation
 *     is emitted — no generic boilerplate items that don't apply.
 *   - Expansion vessels are never included here — they are installation
 *     requirements, not controls upgrades.
 */

import type { EngineInputV2_3 } from '../schema/EngineInputV2_3';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ControlsAdviceItem {
  /** Stable identifier for this item. */
  id: string;
  /** Short title for the advice item. */
  title: string;
  /** Plain-English explanation of why this is recommended and what benefit it gives. */
  detail: string;
  /** How strongly this is recommended. */
  priority: 'recommended' | 'consider' | 'optional';
}

export interface ControlsAdviceV1 {
  /** Ordered list of controls advice items, most important first. */
  items: ControlsAdviceItem[];
  /**
   * One-sentence summary of the overall controls upgrade opportunity.
   * Empty string when no upgrades are identified.
   */
  summary: string;
}

// ─── Builder ──────────────────────────────────────────────────────────────────

/**
 * buildControlsAdviceV1
 *
 * Derives a ControlsAdviceV1 from the survey input and primary recommendation.
 *
 * @param input              - Full engine input from the survey.
 * @param primaryRecommendation - The primary recommended system label (e.g. "Combi boiler").
 */
export function buildControlsAdviceV1(
  input: EngineInputV2_3,
  primaryRecommendation: string,
): ControlsAdviceV1 {
  const items: ControlsAdviceItem[] = [];

  const controls = input.currentSystem;
  const thermostatStyle = controls?.thermostatStyle;
  const programmerType  = controls?.programmerType;
  const controlFamily   = controls?.controlFamily;
  const hasWeatherComp  = input.hasWeatherCompensation ?? false;
  const isAshp          = primaryRecommendation.toLowerCase().includes('heat pump');
  const isCombi         = primaryRecommendation.toLowerCase().includes('combi');
  const isStoredSystem  = !isCombi && !isAshp;
  const bathroomCount   = input.bathroomCount ?? 1;
  const occupancyCount  = input.occupancyCount ?? 1;

  // ── 1. Smart thermostat ────────────────────────────────────────────────────
  // Recommend when thermostat is basic, programmable (non-smart), or unknown.
  if (
    thermostatStyle === 'basic' ||
    thermostatStyle === 'programmable' ||
    thermostatStyle === 'unknown' ||
    thermostatStyle === undefined
  ) {
    const isClearlyMissing = thermostatStyle === 'basic' || thermostatStyle === undefined;
    items.push({
      id: 'smart-thermostat',
      title: 'Smart thermostat',
      detail:
        isClearlyMissing
          ? 'A smart thermostat lets you control your heating remotely, ' +
            'set schedules, and see usage data — typically saving 15–25% on heating bills ' +
            'by reducing unnecessary run time.'
          : 'Upgrading to a smart thermostat adds remote control, usage insight, and ' +
            'app-based scheduling — a worthwhile step alongside a new boiler.',
      priority: isClearlyMissing ? 'recommended' : 'consider',
    });
  }

  // ── 2. TRVs (thermostatic radiator valves) ─────────────────────────────────
  // Recommend for properties with multiple rooms where individual room control adds value.
  // Not applicable to underfloor heating systems (no radiators).
  const hasRadiators =
    controls?.emittersType !== 'underfloor' &&
    controls?.emittersType !== undefined
      ? controls.emittersType === 'radiators_standard' ||
        controls.emittersType === 'radiators_designer' ||
        controls.emittersType === 'mixed'
      : true; // assume radiators when emitter type is unknown

  if (hasRadiators) {
    items.push({
      id: 'trvs',
      title: 'Thermostatic radiator valves (TRVs)',
      detail:
        'Fitting TRVs to each radiator (except the one in the room with the main thermostat) ' +
        'allows individual room temperature control — reducing heat in unused rooms and ' +
        'avoiding simultaneous demand conflicts. Required in all rooms under Part L of the Building Regulations for new boilers.',
      priority: 'recommended',
    });
  }

  // ── 3. Zone control — S-plan (two-port valves for heating + DHW) ───────────
  // Recommend when the system has stored hot water AND the current controls are
  // Y-plan or unknown — S-plan gives better independent control of each circuit.
  if (
    isStoredSystem &&
    (controlFamily === 'y_plan' || controlFamily === 'combi_integral' || controlFamily === 'unknown' || controlFamily === undefined)
  ) {
    items.push({
      id: 'zone-control-s-plan',
      title: 'S-plan zone control (two-port valves)',
      detail:
        controlFamily === 'y_plan'
          ? 'Your current Y-plan mid-position valve controls heating and hot water from a single valve. ' +
            'Upgrading to S-plan (independent two-port valves) gives fully separate circuit control, ' +
            'reduces valve wear, and is the standard wiring for a new system boiler installation.'
          : 'S-plan zone control uses separate two-port valves for the heating and hot water circuits, ' +
            'allowing each to operate independently. This is the recommended wiring arrangement for a ' +
            'system boiler with a cylinder and significantly reduces wasted heat.',
      priority: isStoredSystem ? 'recommended' : 'consider',
    });
  }

  // ── 4. Weather compensation ────────────────────────────────────────────────
  // Recommend for any new condensing boiler or ASHP where it is not already fitted.
  if (!hasWeatherComp) {
    if (isAshp) {
      items.push({
        id: 'weather-compensation-ashp',
        title: 'Weather compensation',
        detail:
          'Weather compensation is standard on heat pumps — it automatically lowers the flow ' +
          'temperature in mild weather, maximising COP and reducing running costs. ' +
          'Ensure your heat pump is configured with an outdoor sensor at commissioning.',
        priority: 'recommended',
      });
    } else {
      items.push({
        id: 'weather-compensation-boiler',
        title: 'Weather compensation',
        detail:
          'Weather compensation reduces your boiler flow temperature in milder weather, ' +
          'keeping the boiler in condensing mode for more of the heating season. ' +
          'On a mid-sized semi-detached home this can add 3–8% to seasonal efficiency with no change in comfort.',
        priority: 'consider',
      });
    }
  }

  // ── 5. Smart programmer / scheduling ──────────────────────────────────────
  // Only if programmer is electromechanical or none — digital is acceptable.
  if (programmerType === 'electromechanical' || programmerType === 'none') {
    items.push({
      id: 'smart-programmer',
      title: 'Smart programmer / schedule',
      detail:
        programmerType === 'none'
          ? 'No heating programmer is currently recorded. Adding a programmer or smart thermostat ' +
            'with scheduling allows the heating to run only when needed, which is the single ' +
            'largest controllable contributor to heating bill reduction.'
          : 'An electromechanical programmer has limited flexibility. Replacing it with a digital ' +
            'or smart programmer allows more precise scheduling and is a low-cost improvement ' +
            'when replacing a boiler.',
      priority: programmerType === 'none' ? 'recommended' : 'consider',
    });
  }

  // ── 6. Multi-zone control for larger homes ─────────────────────────────────
  // For homes with many bathrooms or high occupancy, suggest separate zone control.
  if (bathroomCount >= 3 || occupancyCount >= 5) {
    items.push({
      id: 'multi-zone-control',
      title: 'Multi-zone heating control',
      detail:
        'With multiple bathrooms and a large household, dividing the heating into two or more ' +
        'independent zones (e.g., ground floor and first floor) reduces unnecessary heat in ' +
        'unoccupied areas. Each zone has its own thermostat and two-port valve.',
      priority: 'consider',
    });
  }

  // ── 7. Load compensation ────────────────────────────────────────────────────
  // Relevant for high-efficiency condensing boilers when weather comp is not present.
  if (!hasWeatherComp && !isAshp && items.length > 0) {
    items.push({
      id: 'load-compensation',
      title: 'Load compensation (modulating control)',
      detail:
        'Load compensation modulates the boiler output to match actual heat demand rather than ' +
        'firing at full output. At mid-season partial loads (typically 30–60% of design day), ' +
        'this extends the condensing fraction and reduces cycling losses.',
      priority: 'optional',
    });
  }

  // ── Build summary ──────────────────────────────────────────────────────────
  const recommended = items.filter(i => i.priority === 'recommended');
  let summary = '';
  if (items.length === 0) {
    summary = 'Controls are adequate for this system — no additional upgrades identified.';
  } else if (recommended.length >= 2) {
    summary =
      `${recommended.length} controls upgrades are recommended alongside this installation: ` +
      recommended.map(i => i.title).join(', ') + '.';
  } else if (recommended.length === 1) {
    summary = `${recommended[0].title} is recommended alongside this installation.`;
  } else {
    summary = `${items.length} optional controls upgrade${items.length !== 1 ? 's' : ''} identified — none are required but each adds comfort or efficiency.`;
  }

  return { items, summary };
}
