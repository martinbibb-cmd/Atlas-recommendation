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
    headline: 'Heating pauses when hot water runs',
    detail: 'Your home switches between heating and hot water — it cannot do both at once.',
  },
  simultaneous_demand_constraint: {
    headline: 'Multiple water uses exceed what the system can deliver at once',
    detail: 'Running a shower and taps at the same time places high demand on the system.',
  },
  stored_volume_shortfall: {
    headline: 'Hot water may run short during busy periods',
    detail: 'The stored volume is sized close to the peak demand in your home.',
  },
  reduced_dhw_service: {
    headline: 'Hot water flow is reduced under heavy use',
    detail: 'When demand is high, the flow rate drops below the comfortable threshold.',
  },
  hp_reheat_latency: {
    headline: 'The heat pump takes longer to reheat after heavy use',
    detail: 'Heat pumps recharge at lower power — recovery time is longer than a gas boiler.',
  },
  mains_flow_constraint: {
    headline: 'Mains flow limits how much hot water can reach your taps',
    detail: 'The incoming mains supply capacity constrains peak hot water delivery.',
  },
  pressure_constraint: {
    headline: 'Mains pressure affects hot water performance in your home',
    detail: 'Low incoming pressure reduces flow at outlets, particularly upstairs.',
  },
  primary_pipe_constraint: {
    headline: 'Pipe size limits future upgrades in your home',
    detail: 'The existing pipework diameter restricts flow and may need upsizing for new systems.',
  },
  open_vented_head_limit: {
    headline: 'Tank height limits water pressure in your home',
    detail: 'Tank-fed hot water relies on gravity — the head of water determines pressure at taps.',
  },
  emitter_temperature_constraint: {
    headline: 'Your radiators need high flow temperatures',
    detail: 'The current emitters require high temperatures to reach comfort — limiting low-temperature systems.',
  },
  cycling_risk: {
    headline: 'Short-cycling increases wear on the boiler',
    detail: 'The boiler fires and stops frequently, which reduces efficiency and longevity.',
  },
  high_return_temp_non_condensing: {
    headline: 'Your boiler is not condensing efficiently',
    detail: 'High return temperatures prevent the boiler from recovering heat from flue gases.',
  },
  hp_high_flow_temp_penalty: {
    headline: 'High flow temperatures reduce heat pump efficiency',
    detail: 'Running at elevated temperatures reduces the coefficient of performance (COP).',
  },
  dhw_storage_required: {
    headline: 'A hot water cylinder is needed for this system',
    detail: 'This type of system requires a cylinder to store and deliver domestic hot water.',
  },
  space_for_cylinder_unavailable: {
    headline: 'There is limited space for a hot water cylinder',
    detail: 'A suitable location for the cylinder has not been identified in your home.',
  },
};

/**
 * Returns human-readable copy for a given limiter ID.
 * Falls back to a generic statement when the ID is not mapped.
 */
export function getLimiterHumanCopy(limiterId: string): LimiterHumanCopy {
  return LIMITER_COPY[limiterId] ?? {
    headline: 'A system constraint was identified in your home',
  };
}
