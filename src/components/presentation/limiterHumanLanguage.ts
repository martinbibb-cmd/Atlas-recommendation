/**
 * limiterHumanLanguage.ts — Presentation Layer v1: limiter → human copy.
 *
 * Maps machine-readable limiter IDs to plain-English cause statements
 * suitable for customer-facing use.
 *
 * Rules (from docs/atlas-terminology.md custom instructions):
 *   - Never use: "gravity system", "low pressure system", "high pressure system",
 *     or "instantaneous hot water".
 *   - Use: "tank-fed hot water", "mains-fed supply", "on-demand hot water".
 *   - Language must use "your home" and "how your home is used".
 *   - Never say "this system fails" or "not suitable".
 *   - Be confident, human, and home-focused.
 */

export interface LimiterHumanCopy {
  /** One-sentence headline shown in the CauseCard. */
  readonly headline: string;
  /** Optional short supporting detail (1 sentence, lower contrast). */
  readonly detail?: string;
}

/**
 * Maps each known limiter ID to customer-facing copy.
 *
 * Unknown IDs fall back to a generic summary.
 */
const LIMITER_COPY: Record<string, LimiterHumanCopy> = {
  combi_service_switching: {
    headline: 'Heating pauses every time on-demand hot water runs',
    detail: 'Your boiler can only do one thing at a time — it switches between heating and hot water, never both.',
  },
  simultaneous_demand_constraint: {
    headline: 'Two outlets running at once is more than this system can manage',
    detail: 'Running a shower alongside another tap puts more demand on the system than it was designed for.',
  },
  stored_volume_shortfall: {
    headline: 'Hot water can run short during a busy morning',
    detail: 'The cylinder holds just enough for most days — high demand periods push it close to empty.',
  },
  reduced_dhw_service: {
    headline: 'Flow drops when hot water demand is high',
    detail: 'At peak times, the system cannot sustain a comfortable flow rate to all outlets.',
  },
  hp_reheat_latency: {
    headline: 'Recovery time is longer after a lot of hot water use',
    detail: 'Heat pumps recharge at lower power than a gas boiler — the cylinder takes more time to refill.',
  },
  mains_flow_constraint: {
    headline: 'Incoming mains flow limits how much hot water your home can use at once',
    detail: 'The supply from the street restricts peak delivery — no system can exceed what comes in.',
  },
  pressure_constraint: {
    headline: 'Mains pressure is a factor in how hot water performs upstairs',
    detail: 'Lower incoming pressure means less push at outlets — especially noticeable on upper floors.',
  },
  primary_pipe_constraint: {
    headline: 'Existing pipework may need upsizing for a different system',
    detail: 'The current pipe diameter is fine for now but would limit flow with a new or larger system.',
  },
  open_vented_head_limit: {
    headline: 'Tank-fed supply pressure depends on how high the tank is',
    detail: 'Tank-fed hot water uses gravity — the higher the tank, the better the pressure at taps.',
  },
  emitter_temperature_constraint: {
    headline: 'Your radiators need high temperatures to heat the home well',
    detail: 'Older or undersized radiators require hotter water to reach comfort, which limits low-temperature systems.',
  },
  cycling_risk: {
    headline: 'The boiler fires and stops too often — this wears it down',
    detail: 'Short-cycling happens when the boiler is oversized for the demand. It reduces efficiency and longevity.',
  },
  high_return_temp_non_condensing: {
    headline: 'The boiler is losing heat it could be recovering',
    detail: 'High return temperatures stop the boiler condensing — it misses out on free heat from its own flue gases.',
  },
  hp_high_flow_temp_penalty: {
    headline: 'Running at high temperatures reduces heat pump efficiency',
    detail: 'The hotter the water it makes, the harder the heat pump has to work — and the more energy it uses.',
  },
  dhw_storage_required: {
    headline: 'This system needs a hot water cylinder',
    detail: 'Unlike a combi, it stores hot water rather than delivering on-demand — a cylinder is part of the package.',
  },
  space_for_cylinder_unavailable: {
    headline: 'Finding space for a cylinder is worth discussing',
    detail: 'A suitable location for the hot water storage has not been identified yet — it may be solvable.',
  },
};

/**
 * Returns human-readable copy for a given limiter ID.
 * Falls back to a generic statement when the ID is not mapped.
 */
export function getLimiterHumanCopy(limiterId: string): LimiterHumanCopy {
  return LIMITER_COPY[limiterId] ?? {
    headline: 'A constraint was identified that affects how this system performs in your home',
  };
}
