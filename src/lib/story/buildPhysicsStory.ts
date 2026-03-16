/**
 * buildPhysicsStory.ts
 *
 * Physics Story Mode — story assembly logic.
 *
 * Converts Atlas engine output into an ordered list of story cards that
 * narrate the physical cause-and-effect chain behind a recommendation.
 *
 * Rules:
 *  - Only render signals that are genuinely triggered by engine or input data.
 *  - Never use generic canned text that ignores model output.
 *  - Output is deterministic — no Math.random().
 *  - Top 3–5 signals are selected by priority and severity.
 *  - Card order follows: demand → constraint → behaviour → recommendation → future.
 */

import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import type { EngineInputV2_3, NormalizerOutput } from '../../engine/schema/EngineInputV2_3';
import {
  STORY_SIGNAL_REGISTRY,
  type StorySignalId,
  type StorySignalDefinition,
} from '../../data/story/storySignalRegistry';

/**
 * Extended input type for buildPhysicsStory.
 * Adds the optional normalizer-derived `waterHardnessCategory` field that is
 * not a raw input on EngineInputV2_3 (it is computed from the postcode by the
 * Normalizer) but is useful for story signal detection and evidence lines.
 */
export type PhysicsStoryEngineInput = Partial<EngineInputV2_3> & {
  waterHardnessCategory?: NormalizerOutput['waterHardnessCategory'];
};

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * A single rendered story card — the output unit of buildPhysicsStory.
 * Carries the signal definition plus a resolved evidence line derived
 * from actual engine / input values.
 */
export interface PhysicsStoryCard {
  /** Signal identifier — stable key for React rendering. */
  id: StorySignalId;
  /** Card position in the story (1-based). */
  position: number;
  /** Short headline for the card. */
  title: string;
  /** One- or two-sentence summary. */
  summary: string;
  /**
   * Formatted evidence line shown below the summary.
   * Built from real engine / input values; null when no relevant values exist.
   */
  evidenceLine: string | null;
  /** ID of the linked visualiser panel, or null. */
  visualiserId: string | null;
  /** ID of the linked explainer section, or null. */
  explainerId: string | null;
}

// ── Maximum cards to surface ──────────────────────────────────────────────────

const MAX_STORY_CARDS = 5;

// ── Signal detection ──────────────────────────────────────────────────────────

/**
 * Returns the set of StorySignalIds that are genuinely triggered by
 * the engine output and (optionally) the engine input.
 *
 * Each detector function returns `true` when a signal applies.
 */
function detectTriggeredSignals(
  engineOutput: EngineOutputV1,
  input: PhysicsStoryEngineInput | undefined,
): Set<StorySignalId> {
  const triggered = new Set<StorySignalId>();
  const limiters  = engineOutput.limiters?.limiters ?? [];
  const redFlags  = engineOutput.redFlags ?? [];
  const options   = engineOutput.options  ?? [];

  // ── combi_peak_demand_penalty ─────────────────────────────────────────────
  // Triggered when:
  //  • combi DHW red flag with warn/fail severity
  //  • OR bathroomCount >= 2
  //  • OR occupancyCount >= 4
  //  • OR a combi option card is in caution/rejected status
  {
    const hasCombiDhwFlag = redFlags.some(
      f => (f.id.startsWith('combi') || f.id.includes('concurrency') || f.id.includes('flow')) &&
           (f.severity === 'warn' || f.severity === 'fail'),
    );
    const hasCombiConcurrencyLimiter = limiters.some(
      l => l.id === 'combi-concurrency-constraint' || l.id === 'mains-flow-constraint',
    );
    const combiOption = options.find(o => o.id === 'combi');
    const combiFlagged =
      combiOption?.status === 'caution' || combiOption?.status === 'rejected';
    const highBathroomCount = (input?.bathroomCount ?? 0) >= 2;
    const highOccupancy     = (input?.occupancyCount ?? 0) >= 4;

    if (
      hasCombiDhwFlag ||
      hasCombiConcurrencyLimiter ||
      combiFlagged ||
      highBathroomCount ||
      highOccupancy
    ) {
      triggered.add('combi_peak_demand_penalty');
    }
  }

  // ── stored_peak_demand_advantage ──────────────────────────────────────────
  // Triggered when:
  //  • A stored option (stored_unvented, stored_vented) is viable
  //  • AND combi is caution/rejected OR combi_peak_demand_penalty is also triggered
  {
    const storedViable = options.some(
      o => (o.id === 'stored_unvented' || o.id === 'stored_vented') && o.status === 'viable',
    );
    const combiNotViable = options.some(
      o => o.id === 'combi' && o.status !== 'viable',
    );
    if (storedViable && (combiNotViable || triggered.has('combi_peak_demand_penalty'))) {
      triggered.add('stored_peak_demand_advantage');
    }
  }

  // ── ashp_flow_requirement_limit ───────────────────────────────────────────
  // Triggered when:
  //  • primary-pipe-constraint limiter present
  //  • OR ASHP option is rejected/caution with pipe-related reason
  //  • OR ASHP_PIPE_UPGRADE_REQUIRED penalty is in score breakdown
  {
    const hasPipeLimiter = limiters.some(l => l.id === 'primary-pipe-constraint');
    const ashpOption     = options.find(o => o.id === 'ashp');
    const ashpPipeFlag   = ashpOption?.score?.breakdown.some(
      b => b.id === 'ashp.pipe_upgrade_required',
    ) ?? false;
    const ashpFlowFlag = ashpOption?.score?.breakdown.some(
      b => b.id === 'ashp.hydraulics_warn',
    ) ?? false;
    const ashpRejectedOrCaution =
      ashpOption?.status === 'rejected' || ashpOption?.status === 'caution';

    if (hasPipeLimiter || (ashpRejectedOrCaution && (ashpPipeFlag || ashpFlowFlag))) {
      triggered.add('ashp_flow_requirement_limit');
    }
  }

  // ── high_return_temp_condensing_penalty ───────────────────────────────────
  // Triggered when:
  //  • cycling-loss-penalty limiter present
  //  • OR flow-temp-too-high-for-ashp limiter present
  //  • OR radiator-output-insufficient limiter present
  //  • OR boiler oversize penalty in any option's score
  {
    const hasCyclingLimiter = limiters.some(
      l => l.id === 'cycling-loss-penalty' || l.id === 'flow-temp-too-high-for-ashp' ||
           l.id === 'radiator-output-insufficient',
    );
    const hasOversizePenalty = options.some(o =>
      o.score?.breakdown.some(b =>
        b.id === 'boiler.oversize_moderate' ||
        b.id === 'boiler.oversize_aggressive' ||
        b.id === 'boiler.oversize_mild',
      ),
    );

    if (hasCyclingLimiter || hasOversizePenalty) {
      triggered.add('high_return_temp_condensing_penalty');
    }
  }

  // ── thermal_mass_supports_continuous_heat ─────────────────────────────────
  // Triggered when:
  //  • buildingMass === 'heavy'
  //  • OR occupancySignature indicates steady/professional presence
  {
    const heavyMass     = input?.buildingMass === 'heavy';
    const steadyOccupancy =
      input?.occupancySignature === 'steady_home' ||
      input?.occupancySignature === 'professional' ||
      input?.occupancySignature === 'steady';

    if (heavyMass || steadyOccupancy) {
      triggered.add('thermal_mass_supports_continuous_heat');
    }
  }

  // ── water_quality_scale_risk ─────────────────────────────────────────────
  // Triggered when:
  //  • waterHardnessCategory is 'hard' or 'very_hard'
  {
    const hardWater =
      input?.waterHardnessCategory === 'hard' ||
      input?.waterHardnessCategory === 'very_hard';

    if (hardWater) {
      triggered.add('water_quality_scale_risk');
    }
  }

  return triggered;
}

// ── Evidence line builder ─────────────────────────────────────────────────────

/**
 * Builds a short evidence line string from real engine / input values.
 * Returns null when no relevant values can be resolved.
 */
function buildEvidenceLine(
  signal: StorySignalDefinition,
  engineOutput: EngineOutputV1,
  input: PhysicsStoryEngineInput | undefined,
): string | null {
  switch (signal.id) {
    case 'combi_peak_demand_penalty': {
      const parts: string[] = [];
      if (input?.bathroomCount != null)  parts.push(`${input.bathroomCount} bathroom${input.bathroomCount > 1 ? 's' : ''}`);
      if (input?.occupancyCount != null) parts.push(`${input.occupancyCount} occupant${input.occupancyCount > 1 ? 's' : ''}`);
      if (input?.mainsDynamicFlowLpm != null)
        parts.push(`${input.mainsDynamicFlowLpm} L/min mains flow`);
      else if (input?.dynamicMainsPressureBar != null)
        parts.push(`${input.dynamicMainsPressureBar} bar mains pressure`);
      else if (input?.dynamicMainsPressure != null)
        parts.push(`${input.dynamicMainsPressure} bar mains pressure`);
      return parts.length > 0 ? parts.join(' · ') : null;
    }

    case 'stored_peak_demand_advantage': {
      const storedOption = engineOutput.options?.find(
        o => o.id === 'stored_unvented' || o.id === 'stored_vented',
      );
      if (storedOption?.status === 'viable') {
        return `${storedOption.label} viable — separates generation from peak delivery`;
      }
      return null;
    }

    case 'ashp_flow_requirement_limit': {
      const pipeLimiter = engineOutput.limiters?.limiters.find(
        l => l.id === 'primary-pipe-constraint',
      );
      if (pipeLimiter) {
        return `${pipeLimiter.observed.label}: ${pipeLimiter.observed.value} · limit: ${pipeLimiter.limit.value}`;
      }
      return null;
    }

    case 'high_return_temp_condensing_penalty': {
      const cyclingLimiter = engineOutput.limiters?.limiters.find(
        l => l.id === 'cycling-loss-penalty',
      );
      if (cyclingLimiter) {
        return cyclingLimiter.impact.summary;
      }
      return null;
    }

    case 'thermal_mass_supports_continuous_heat': {
      const parts: string[] = [];
      if (input?.buildingMass)        parts.push(`Building mass: ${input.buildingMass}`);
      if (input?.occupancySignature)  parts.push(`Occupancy: ${input.occupancySignature.replace(/_/g, ' ')}`);
      return parts.length > 0 ? parts.join(' · ') : null;
    }

    case 'water_quality_scale_risk': {
      if (input?.waterHardnessCategory) {
        const label = {
          soft:      'soft',
          moderate:  'moderate hardness',
          hard:      'hard water',
          very_hard: 'very hard water',
        }[input.waterHardnessCategory] ?? input.waterHardnessCategory;
        return `Water hardness: ${label}`;
      }
      return null;
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Assembles the Physics Story for a given engine output.
 *
 * @param engineOutput  The full EngineOutputV1 from the Atlas engine.
 * @param input         Optional engine input used to detect demand/fabric signals.
 * @returns             Ordered list of story cards (max MAX_STORY_CARDS).
 */
export function buildPhysicsStory(
  engineOutput: EngineOutputV1,
  input?: PhysicsStoryEngineInput,
): PhysicsStoryCard[] {
  const triggered = detectTriggeredSignals(engineOutput, input);

  if (triggered.size === 0) return [];

  // Filter registry to only triggered signals, sorted by priority.
  const ordered: StorySignalDefinition[] = STORY_SIGNAL_REGISTRY
    .filter(s => triggered.has(s.id))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_STORY_CARDS);

  return ordered.map((signal, index) => ({
    id:           signal.id,
    position:     index + 1,
    title:        signal.title,
    summary:      signal.summary,
    evidenceLine: buildEvidenceLine(signal, engineOutput, input),
    visualiserId: signal.visualiserId ?? null,
    explainerId:  signal.explainerId  ?? null,
  }));
}
