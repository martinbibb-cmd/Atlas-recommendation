import type { PenaltyId } from '../../contracts/scoring.penaltyIds';

export type NarrativeGroup =
  | 'water_supply'
  | 'boiler_efficiency'
  | 'ashp_hydraulics'
  | 'space'
  | 'future_works'
  | 'controls';

export interface PenaltyNarrative {
  why?: string;
  requirement?: string;
  explainerId?: string;
  /** Grouping key: at most one narrative per group is injected per option card. */
  group?: NarrativeGroup;
}

/**
 * Maps each meaningful PenaltyId to an optional human-readable why bullet
 * and/or a requirement bullet.  Confidence and assumption penalties are
 * intentionally omitted — they are excluded from narrative injection.
 */
export const PENALTY_NARRATIVES: Partial<Record<PenaltyId, PenaltyNarrative>> = {
  // Cold-water supply
  'cws.measurements_missing': {
    why: 'Supply stability cannot be confirmed without flow @ pressure measurement.',
    group: 'water_supply',
  },
  'cws.quality_weak': {
    why: 'Mains supply quality is weak — adequate performance for unvented cylinder cannot be guaranteed.',
    group: 'water_supply',
  },

  // Boiler sizing / cycling
  'boiler.oversize_aggressive': {
    why: 'Boiler is ~3× larger than peak demand — it will short-cycle, increasing wear and reducing efficiency.',
    group: 'boiler_efficiency',
  },
  'boiler.oversize_moderate': {
    why: 'Boiler is notably oversized for peak demand — increased cycling losses expected.',
    group: 'boiler_efficiency',
  },
  'boiler.oversize_mild': {
    why: 'Boiler is mildly oversized — minor cycling losses at part load.',
    group: 'boiler_efficiency',
  },

  // ASHP
  'ashp.hydraulics_warn': {
    why: 'ASHP hydraulic risk: marginal pipe sizing may restrict flow at peak demand.',
    group: 'ashp_hydraulics',
  },
  'ashp.pipe_upgrade_required': {
    requirement: 'Primary pipework upgrade likely required (≥ 28mm recommended).',
    group: 'ashp_hydraulics',
  },
  'ashp.flowtemp_full_job': {
    requirement: 'Full emitter replacement required to achieve 35°C design flow temperature.',
    group: 'ashp_hydraulics',
  },
  'ashp.flowtemp_partial': {
    requirement: 'Partial emitter upgrade likely required for 45°C design flow temperature.',
    group: 'ashp_hydraulics',
  },

  // DHW
  'dhw.short_draw_warn': {
    why: 'Short hot-water draws cause cold-water sandwich effect and purge losses.',
  },

  // Space
  'space.tight': {
    requirement: 'Cylinder space is tight — a compact or slimline cylinder will be needed.',
    group: 'space',
  },

  // Future works
  'future.loft_conflict': {
    requirement: 'Loft conversion conflicts with tank space for vented supply.',
    group: 'future_works',
  },

  // Mains pressure
  'pressure.borderline_unvented': {
    why: 'Mains pressure is borderline for unvented cylinder — a boost pump may be required.',
    requirement: 'Confirm mains pressure ≥ 1.5 bar or install a boost pump.',
    group: 'water_supply',
    explainerId: 'pressure-borderline-unvented',
  },
};

/** Penalty IDs that should never be injected as narrative bullets. */
export const NARRATIVE_EXCLUDED_IDS: ReadonlySet<PenaltyId> = new Set<PenaltyId>([
  'confidence.medium',
  'confidence.low',
  'assumption.warn_count',
  'option.rejected',
  'status.caution',
]);

/**
 * Select up to `limit` narrative-eligible penalties, sorted by penalty desc,
 * skipping any penalty whose group has already been represented.
 * This prevents spam from multiple penalties sharing the same root cause.
 */
export function selectTopNarrativePenalties(
  breakdown: ReadonlyArray<{ id: string; penalty: number }>,
  limit = 3,
): Array<{ id: string; penalty: number }> {
  const sorted = [...breakdown]
    .filter(b => !NARRATIVE_EXCLUDED_IDS.has(b.id as PenaltyId))
    .sort((a, b) => b.penalty - a.penalty);

  const selected: Array<{ id: string; penalty: number }> = [];
  const usedGroups = new Set<string>();

  for (const item of sorted) {
    const narrative = PENALTY_NARRATIVES[item.id as PenaltyId];
    const group = narrative?.group;
    if (group && usedGroups.has(group)) continue;
    if (group) usedGroups.add(group);
    selected.push(item);
    if (selected.length >= limit) break;
  }

  return selected;
}
