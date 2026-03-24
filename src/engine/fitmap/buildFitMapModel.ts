/**
 * buildFitMapModel.ts — PR9: Derives the service-shape fit map from engine evidence.
 *
 * Takes the full set of structured outputs from PR6–PR8 and returns a
 * `FitMapModel` that describes how well the appliance family matches the
 * property's heating and DHW demands.
 *
 * Design rules:
 *   1. Fit shape must emerge from evidence; no hard-coded "combi = tall narrow".
 *   2. Family-specific contour templates seed the derivation; evidence then
 *      modifies them (so a clean HP run still gets a soft corner, but a clean
 *      combi with zero interruptions gets a fair vertical score).
 *   3. Every `FitEvidence` item must reference a real limiter ID or event type.
 *   4. Output is deterministic: same inputs always yield the same model.
 *   5. Layer is descriptive only — no recommendation ranking.
 *
 * Inputs:
 *   FamilyRunnerResult          — appliance topology, module outputs
 *   SystemStateTimeline         — tick-level service modes (PR6)
 *   DerivedSystemEventSummary   — events and counters (PR7)
 *   LimiterLedger               — structured constraint evidence (PR8)
 *
 * Outputs:
 *   FitMapModel
 *     heatingAxis   — vertical; continuity / stability
 *     dhwAxis       — horizontal; DHW strength / concurrency
 *     efficiencyScore — optional third dimension
 *     contour       — derived shape (verticalShape / horizontalShape / corner / dhwEdge)
 *     evidence      — ordered list of all contributing evidence items
 */

import type { FamilyRunnerResult } from '../runners/types';
import type { SystemStateTimeline } from '../timeline/SystemStateTimeline';
import type { DerivedSystemEventSummary } from '../timeline/DerivedSystemEvent';
import type { LimiterLedger, LimiterLedgerEntry } from '../limiter/LimiterLedger';
import type {
  FitMapModel,
  FitAxisScore,
  FitContourProfile,
  FitEvidence,
} from './FitMapModel';
import type { ApplianceFamily } from '../topology/SystemTopology';

// ─── Scoring constants ────────────────────────────────────────────────────────

/** Axis baseline — all axes start at 100 and are reduced by penalties. */
const AXIS_BASELINE = 100;

/**
 * Penalty table keyed by limiter ID.
 *
 * Each entry specifies:
 *   axis       — which axis (or 'both' / 'efficiency') this limiter affects
 *   magnitude  — score points removed per occurrence
 *   description — why this limiter reduces the score
 *
 * These magnitudes are calibrated so that:
 *   - A combi with repeated service switching will naturally score lower on
 *     DHW than a stored system with healthy volume.
 *   - An HP with slow recovery will have a softer DHW right edge.
 *   - Cross-family limiters are only applied to compatible families.
 */
/**
 * Machine-readable IDs of all limiters that can produce fit-map penalties.
 *
 * Exported so that downstream tests and tracing tools can validate that
 * evidence items reference known sources without duplicating the list.
 */
export const FIT_MAP_LIMITER_IDS: ReadonlySet<string> = new Set([
  // DHW / service
  'combi_service_switching',
  'stored_volume_shortfall',
  'reduced_dhw_service',
  'hp_reheat_latency',
  'simultaneous_demand_constraint',
  // Hydraulic
  'mains_flow_constraint',
  'pressure_constraint',
  'primary_pipe_constraint',
  'open_vented_head_limit',
  // Heating / temperature
  'emitter_temperature_constraint',
  'cycling_risk',
  'high_return_temp_non_condensing',
  'hp_high_flow_temp_penalty',
  // Installability
  'dhw_storage_required',
  'space_for_cylinder_unavailable',
]);

/**
 * Penalty specification table keyed by limiter ID.
 *
 * Every key must appear in `FIT_MAP_LIMITER_IDS`.  The Record is typed with
 * the full penalty spec shape so that adding a new limiter requires updating
 * both this table and `FIT_MAP_LIMITER_IDS`.
 */
const LIMITER_PENALTIES: Record<
  string,
  { axis: FitEvidence['axis']; magnitude: number; description: string }
> = {
  // DHW / service
  combi_service_switching: {
    axis: 'dhw',
    magnitude: 20,
    description:
      'Space heating was interrupted to serve DHW — combi narrows on the DHW concurrency axis.',
  },
  stored_volume_shortfall: {
    axis: 'dhw',
    magnitude: 25,
    description:
      'Cylinder volume was insufficient for demand — DHW axis is reduced by storage shortfall.',
  },
  reduced_dhw_service: {
    axis: 'dhw',
    magnitude: 15,
    description:
      'Partial-store draw reduced DHW service quality — DHW strength is degraded.',
  },
  hp_reheat_latency: {
    axis: 'dhw',
    magnitude: 20,
    description:
      'Heat pump cylinder recovery is slow — consecutive draws may cause DHW shortfalls.',
  },
  simultaneous_demand_constraint: {
    axis: 'both',
    magnitude: 15,
    description:
      'System cannot serve CH and DHW simultaneously — both heating and DHW axes are affected.',
  },

  // Hydraulic
  mains_flow_constraint: {
    axis: 'dhw',
    magnitude: 10,
    description:
      'Mains flow is below the delivery threshold — DHW strength is constrained at the source.',
  },
  pressure_constraint: {
    axis: 'dhw',
    magnitude: 10,
    description:
      'Mains dynamic pressure is too low for reliable DHW delivery — DHW axis is reduced.',
  },
  primary_pipe_constraint: {
    axis: 'heating',
    magnitude: 10,
    description:
      'Pipework cannot carry the flow required for a heat pump — heating capability is limited.',
  },
  open_vented_head_limit: {
    axis: 'dhw',
    magnitude: 10,
    description:
      'Tank-fed supply limits DHW delivery pressure and flow — horizontal axis trimmed.',
  },

  // Heating / temperature
  emitter_temperature_constraint: {
    axis: 'heating',
    magnitude: 10,
    description:
      'Emitters require high flow temperature — heating stability is reduced for HP candidates.',
  },
  cycling_risk: {
    axis: 'heating',
    magnitude: 15,
    description:
      'Sludge-driven boiler cycling degrades heating continuity — vertical axis is reduced.',
  },
  high_return_temp_non_condensing: {
    axis: 'efficiency',
    magnitude: 10,
    description:
      'Non-condensing operation reduces thermodynamic efficiency — efficiency score is affected.',
  },
  hp_high_flow_temp_penalty: {
    axis: 'efficiency',
    magnitude: 20,
    description:
      'High flow temperature degrades heat pump COP — efficiency score is significantly reduced.',
  },

  // Installability (dhw_storage_required is informational, small nudge on DHW axis)
  dhw_storage_required: {
    axis: 'dhw',
    magnitude: 5,
    description:
      'DHW storage is required — the system as-is has structural constraints on DHW delivery.',
  },
  space_for_cylinder_unavailable: {
    axis: 'dhw',
    magnitude: 5,
    description:
      'Limited cylinder space may constrain stored volume — DHW axis slightly reduced.',
  },
};

// ─── Severity scaling ─────────────────────────────────────────────────────────

/**
 * Scale factor applied to the base penalty magnitude based on limiter severity.
 *
 * A 'limit' severity constraint is a hard physics boundary — it is penalised
 * more heavily than a 'warning'.  A 'hard_stop' essentially zeroes the relevant
 * axis.  An 'info' entry carries a small informational nudge only.
 */
const SEVERITY_SCALE: Record<LimiterLedgerEntry['severity'], number> = {
  hard_stop: 2.5,
  limit: 1.5,
  warning: 1.0,
  info: 0.4,
};

// ─── Event-counter penalties ──────────────────────────────────────────────────

/**
 * Additional penalties derived from event counters when no matching limiter
 * entry is present.  These apply proportionally up to the specified cap.
 */
const EVENT_COUNTER_PENALTIES: Array<{
  counterKey: keyof import('../timeline/DerivedSystemEvent').SystemEventCounters;
  axis: FitEvidence['axis'];
  perEventMagnitude: number;
  maxEvents: number;
  description: string;
}> = [
  {
    counterKey: 'heatingInterruptions',
    axis: 'heating',
    perEventMagnitude: 5,
    maxEvents: 4,
    description:
      'Each space heating interruption by DHW demand reduces heating continuity.',
  },
  {
    counterKey: 'reducedDhwEvents',
    axis: 'dhw',
    perEventMagnitude: 5,
    maxEvents: 3,
    description:
      'Each reduced-DHW service event degrades the DHW strength score.',
  },
  {
    counterKey: 'simultaneousDemandConstraints',
    axis: 'both',
    perEventMagnitude: 5,
    maxEvents: 3,
    description:
      'Each simultaneous demand constraint reduces both heating and DHW axes.',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildAxisScore(
  penalties: FitEvidence[],
  boosts: FitEvidence[],
): FitAxisScore {
  const totalPenalty = penalties.reduce((sum, p) => sum + p.magnitude, 0);
  const totalBoost = boosts.reduce((sum, b) => sum + b.magnitude, 0);
  const raw = AXIS_BASELINE - totalPenalty + totalBoost;
  const score = clamp(raw, 0, 100);

  // Deterministic ordering: penalties first (magnitude desc, id asc), then boosts
  const sortedPenalties = [...penalties].sort(
    (a, b) => b.magnitude - a.magnitude || a.id.localeCompare(b.id),
  );
  const sortedBoosts = [...boosts].sort(
    (a, b) => b.magnitude - a.magnitude || a.id.localeCompare(b.id),
  );

  return {
    raw,
    score,
    evidence: [...sortedPenalties, ...sortedBoosts],
  };
}

function deriveContourProfile(
  family: ApplianceFamily,
  heatingScore: number,
  dhwScore: number,
  allEvidence: FitEvidence[],
): FitContourProfile {
  // Vertical shape: derived from heatingScore
  const verticalShape: FitContourProfile['verticalShape'] =
    heatingScore >= 70 ? 'tall' : heatingScore >= 45 ? 'mid' : 'low';

  // Horizontal shape: derived from dhwScore
  const horizontalShape: FitContourProfile['horizontalShape'] =
    dhwScore >= 70 ? 'broad' : dhwScore >= 45 ? 'mid' : 'narrow';

  // Corner rounding: seeded by family default, not hard-coded as the only factor.
  //   combi       → sharp  (direct draw-off; no thermal buffering)
  //   system/regular → moderate (cylinder provides some decoupling)
  //   heat_pump   → soft   (large cylinder + slow recovery = maximum buffering)
  //   open_vented → moderate (gravity-fed but still cylinder-backed)
  const familyCornerDefault: Record<ApplianceFamily, FitContourProfile['cornerRounding']> = {
    combi: 'sharp',
    system: 'moderate',
    regular: 'moderate',
    heat_pump: 'soft',
    open_vented: 'moderate',
  };
  // Evidence can sharpen a stored system (e.g. rapid cycling with volume shortfall)
  // or soften a combi if it has a large run and no interruptions — but for now
  // the family seed is the primary driver and evidence nudges via score shape.
  const cornerRounding = familyCornerDefault[family];

  // DHW edge softness: 'soft' if HP reheat latency, 'medium' if reduced service, else 'hard'
  const hasHpReheatPenalty = allEvidence.some(e => e.id === 'hp_reheat_latency');
  const hasReducedDhw = allEvidence.some(
    e => e.id === 'reduced_dhw_service' || e.id === 'stored_volume_shortfall',
  );
  const dhwEdgeSoftness: FitContourProfile['dhwEdgeSoftness'] = hasHpReheatPenalty
    ? 'soft'
    : hasReducedDhw
      ? 'medium'
      : 'hard';

  // Evidence notes — one sentence per significant evidence item
  const evidenceNotes: string[] = [];
  for (const item of allEvidence) {
    if (item.effect === 'penalty' && item.magnitude >= 5) {
      evidenceNotes.push(`[${item.id}] ${item.description}`);
    }
  }
  // Deduplicate (same id may appear from both limiter and counter path)
  const seen = new Set<string>();
  const uniqueNotes = evidenceNotes.filter(n => {
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  });

  return {
    family,
    verticalShape,
    horizontalShape,
    cornerRounding,
    dhwEdgeSoftness,
    evidenceNotes: uniqueNotes,
  };
}

function deriveEfficiencyScore(efficiencyPenalties: FitEvidence[]): number | undefined {
  if (efficiencyPenalties.length === 0) return undefined;
  const totalPenalty = efficiencyPenalties.reduce((sum, p) => sum + p.magnitude, 0);
  return clamp(AXIS_BASELINE - totalPenalty, 0, 100);
}

// ─── Public builder ───────────────────────────────────────────────────────────

/**
 * Build a `FitMapModel` from the four structured evidence sources.
 *
 * This function is the single entry point for PR9 fit-map derivation.
 * It accepts any valid family runner result (combi or hydronic) and returns
 * a deterministic, evidence-driven service-shape fit map.
 *
 * The function is evidence-gated: if a run has no constraints (empty ledger,
 * zero adverse event counters, no physics flags), both axes will score near
 * 100 and the contour will reflect the family's default shape.
 *
 * @param runnerResult   Full result from one of the four family runners (PR2+).
 * @param timeline       Canonical internal state timeline (PR6).
 * @param eventSummary   Derived events and counters (PR7).
 * @param ledger         Limiter ledger explaining why the run struggled (PR8).
 * @returns              Deterministic `FitMapModel` for this run.
 */
export function buildFitMapModel(
  runnerResult: FamilyRunnerResult,
  timeline: SystemStateTimeline,
  eventSummary: DerivedSystemEventSummary,
  ledger: LimiterLedger,
): FitMapModel {
  const family: ApplianceFamily = runnerResult.topology.appliance.family;
  const { counters } = eventSummary;

  const heatingPenalties: FitEvidence[] = [];
  const dhwPenalties: FitEvidence[] = [];
  const efficiencyPenalties: FitEvidence[] = [];

  // ── 1. Limiter-derived penalties ───────────────────────────────────────────

  // Track which limiter IDs have already contributed so that event-counter
  // penalties below do not double-count the same signal.
  const limiterIdsApplied = new Set<string>();

  for (const entry of ledger.entries) {
    const penaltySpec = LIMITER_PENALTIES[entry.id];
    if (penaltySpec === undefined) continue;

    const scaledMagnitude =
      Math.round(penaltySpec.magnitude * SEVERITY_SCALE[entry.severity]);

    const ev: FitEvidence = {
      id: entry.id,
      sourceType: 'limiter',
      effect: 'penalty',
      axis: penaltySpec.axis,
      magnitude: scaledMagnitude,
      description: penaltySpec.description,
    };

    if (penaltySpec.axis === 'heating') {
      heatingPenalties.push(ev);
    } else if (penaltySpec.axis === 'dhw') {
      dhwPenalties.push(ev);
    } else if (penaltySpec.axis === 'both') {
      // Apply to both axes (same magnitude on each)
      heatingPenalties.push(ev);
      dhwPenalties.push({ ...ev });
    } else if (penaltySpec.axis === 'efficiency') {
      efficiencyPenalties.push(ev);
    }

    limiterIdsApplied.add(entry.id);
  }

  // ── 2. Event-counter penalties (additive when no matching limiter present) ──

  for (const spec of EVENT_COUNTER_PENALTIES) {
    const count: number = counters[spec.counterKey] as number;
    if (count === 0) continue;

    // Derive the limiter ID that would cover this counter signal.
    // If that limiter was already applied from the ledger, skip to avoid double-count.
    const coveredByLimiterId = COUNTER_TO_LIMITER_ID[spec.counterKey];
    if (coveredByLimiterId !== undefined && limiterIdsApplied.has(coveredByLimiterId)) {
      continue;
    }

    const effectiveCount = Math.min(count, spec.maxEvents);
    const magnitude = effectiveCount * spec.perEventMagnitude;

    const ev: FitEvidence = {
      id: `event:${spec.counterKey}`,
      sourceType: 'event_counter',
      effect: 'penalty',
      axis: spec.axis,
      magnitude,
      description: spec.description,
    };

    if (spec.axis === 'heating') {
      heatingPenalties.push(ev);
    } else if (spec.axis === 'dhw') {
      dhwPenalties.push(ev);
    } else if (spec.axis === 'both') {
      heatingPenalties.push(ev);
      dhwPenalties.push({ ...ev });
    }
  }

  // ── 3. Timeline-mode penalties ─────────────────────────────────────────────

  // Count ticks where CH was unavailable (combi DHW in progress).
  const chUnavailableTicks = timeline.filter(t => !t.chAvailable).length;
  if (
    chUnavailableTicks > 0 &&
    !limiterIdsApplied.has('combi_service_switching') &&
    !limiterIdsApplied.has('simultaneous_demand_constraint')
  ) {
    heatingPenalties.push({
      id: 'timeline:ch_unavailable',
      sourceType: 'timeline_mode',
      effect: 'penalty',
      axis: 'heating',
      magnitude: Math.min(chUnavailableTicks * 3, 15),
      description:
        'CH was unavailable for one or more timeline ticks — heating continuity is mildly reduced.',
    });
  }

  // ── 4. Build axis scores ───────────────────────────────────────────────────

  const heatingAxis = buildAxisScore(heatingPenalties, []);
  const dhwAxis = buildAxisScore(dhwPenalties, []);
  const efficiencyScore = deriveEfficiencyScore(efficiencyPenalties);

  // ── 5. Combine all evidence for contour and top-level list ─────────────────

  const allEvidence: FitEvidence[] = [
    ...heatingAxis.evidence,
    ...dhwAxis.evidence,
    ...efficiencyPenalties,
  ];

  // Deduplicate by id+axis — the same limiter may have been added to both heating
  // and dhw axes (for 'both' penalties); keep the first occurrence per axis.
  const allEvidenceSorted = deduplicateAndSort(allEvidence);

  // ── 6. Derive contour profile ──────────────────────────────────────────────

  const contour = deriveContourProfile(
    family,
    heatingAxis.score,
    dhwAxis.score,
    allEvidenceSorted,
  );

  return {
    family,
    heatingAxis,
    dhwAxis,
    efficiencyScore,
    contour,
    evidence: allEvidenceSorted,
  };
}

// ─── Counter → limiter ID mapping ────────────────────────────────────────────

/**
 * Maps a `SystemEventCounters` key to the limiter ID that covers the same signal.
 *
 * When both the limiter-derived penalty and the event-counter penalty would fire
 * for the same underlying constraint, only the limiter entry is applied.
 */
const COUNTER_TO_LIMITER_ID: Partial<
  Record<keyof import('../timeline/DerivedSystemEvent').SystemEventCounters, string>
> = {
  heatingInterruptions: 'combi_service_switching',
  reducedDhwEvents: 'reduced_dhw_service',
  simultaneousDemandConstraints: 'simultaneous_demand_constraint',
};

// ─── Deduplication + sort ─────────────────────────────────────────────────────

function deduplicateAndSort(evidence: FitEvidence[]): FitEvidence[] {
  // Deduplicate by (id, axis) — keep one entry per (id, axis) pair.
  const seen = new Set<string>();
  const unique = evidence.filter(e => {
    const key = `${e.id}::${e.axis}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: penalties before boosts; within group: magnitude desc, id asc.
  return unique.sort((a, b) => {
    if (a.effect !== b.effect) return a.effect === 'penalty' ? -1 : 1;
    if (b.magnitude !== a.magnitude) return b.magnitude - a.magnitude;
    return a.id.localeCompare(b.id);
  });
}
