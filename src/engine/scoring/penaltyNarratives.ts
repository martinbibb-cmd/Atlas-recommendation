import type { PenaltyId } from '../../contracts/scoring.penaltyIds';

export interface PenaltyNarrative {
  why?: string;
  requirement?: string;
  explainerId?: string;
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
  },
  'cws.quality_weak': {
    why: 'Mains supply quality is weak — adequate performance for unvented cylinder cannot be guaranteed.',
  },

  // Boiler sizing / cycling
  'boiler.oversize_aggressive': {
    why: 'Boiler is ~3× larger than peak demand — it will short-cycle, increasing wear and reducing efficiency.',
  },
  'boiler.oversize_moderate': {
    why: 'Boiler is notably oversized for peak demand — increased cycling losses expected.',
  },
  'boiler.oversize_mild': {
    why: 'Boiler is mildly oversized — minor cycling losses at part load.',
  },

  // ASHP
  'ashp.hydraulics_warn': {
    why: 'ASHP hydraulic risk: marginal pipe sizing may restrict flow at peak demand.',
  },
  'ashp.pipe_upgrade_required': {
    requirement: 'Primary pipework upgrade likely required (≥ 28mm recommended).',
  },
  'ashp.flowtemp_full_job': {
    requirement: 'Full emitter replacement required to achieve 35°C design flow temperature.',
  },
  'ashp.flowtemp_partial': {
    requirement: 'Partial emitter upgrade likely required for 45°C design flow temperature.',
  },

  // DHW
  'dhw.short_draw_warn': {
    why: 'Short hot-water draws cause cold-water sandwich effect and purge losses.',
  },

  // Space
  'space.tight': {
    requirement: 'Cylinder space is tight — a compact or slimline cylinder will be needed.',
  },

  // Future works
  'future.loft_conflict': {
    requirement: 'Loft conversion conflicts with tank space for vented supply.',
  },

  // Mains pressure
  'pressure.borderline_unvented': {
    why: 'Mains pressure is borderline for unvented cylinder — a boost pump may be required.',
    requirement: 'Confirm mains pressure ≥ 1.5 bar or install a boost pump.',
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
