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
 *   - Where possible, phrase copy around how the household actually uses the home.
 */

export interface LimiterHumanCopy {
  /** One-sentence headline shown in the CauseCard. */
  readonly headline: string;
  /** Optional short supporting detail (1 sentence, lower contrast). */
  readonly detail?: string;
}

/**
 * Household context used to tailor copy to how this home is actually used.
 * All fields are optional — generic copy is used when context is absent.
 */
export interface HouseholdContext {
  /** Total number of regular occupants. */
  occupancyCount?: number;
  /** Number of bathrooms (including en-suites). */
  bathroomCount?: number;
}

/**
 * Maps each known limiter ID to customer-facing copy.
 *
 * Unknown IDs fall back to a generic summary.
 */
const LIMITER_COPY: Record<string, LimiterHumanCopy> = {
  combi_dhw_demand_risk: {
    headline: 'Your home has too many hot-water outlets for on-demand heating',
    detail: 'With multiple bathrooms, running hot water in two places at once will cause reduced temperature or pressure at one or both outlets.',
  },
  combi_service_switching: {
    headline: 'Your heating pauses every time on-demand hot water runs',
    detail: 'Your boiler can only do one thing at a time — it switches between heating and hot water, never both.',
  },
  simultaneous_demand_constraint: {
    headline: 'Running two outlets at once stretches what your system can manage',
    detail: 'Running a shower alongside another tap puts more demand on the system than it was designed for.',
  },
  stored_volume_shortfall: {
    headline: 'Your hot water can run short during a busy morning',
    detail: 'The cylinder holds just enough for most days — high demand periods push it close to empty.',
  },
  reduced_dhw_service: {
    headline: 'Your flow rate drops when hot water demand is high',
    detail: 'At peak times, the system cannot sustain a comfortable flow rate to all outlets.',
  },
  hp_reheat_latency: {
    headline: 'Your cylinder takes longer to recover after heavy hot water use',
    detail: 'Heat pumps recharge at lower power than a gas boiler — the cylinder takes more time to refill.',
  },
  mains_flow_constraint: {
    headline: 'Incoming mains flow limits how much hot water your home can use at once',
    detail: 'The supply from the street restricts peak delivery — no system can exceed what comes in.',
  },
  pressure_constraint: {
    headline: 'Mains pressure affects how hot water performs at your upstairs outlets',
    detail: 'Lower incoming pressure means less push at outlets — especially noticeable on upper floors.',
  },
  primary_pipe_constraint: {
    headline: 'Pipework will be configured to deliver adequate flow for the new system',
    detail: 'The current pipe diameter is fine for now but would limit flow with a new or larger system.',
  },
  open_vented_head_limit: {
    headline: 'Your tank-fed supply pressure depends on how high the tank is installed',
    detail: 'Tank-fed hot water uses gravity — the higher the tank, the better the pressure at taps.',
  },
  emitter_temperature_constraint: {
    headline: 'Your radiators need high temperatures to heat the home well',
    detail: 'Older or undersized radiators require hotter water to reach comfort, which limits low-temperature systems.',
  },
  cycling_risk: {
    headline: 'Your boiler fires and stops too often — this wears it down over time',
    detail: 'Short-cycling happens when the boiler is oversized for the demand. It reduces efficiency and longevity.',
  },
  high_return_temp_non_condensing: {
    headline: 'Your boiler is losing heat it could be recovering',
    detail: 'High return temperatures stop the boiler condensing — it misses out on free heat from its own flue gases.',
  },
  hp_high_flow_temp_penalty: {
    headline: 'Running at high temperatures reduces your heat pump efficiency',
    detail: 'The hotter the water it makes, the harder the heat pump has to work — and the more energy it uses.',
  },
  dhw_storage_required: {
    headline: 'This system stores hot water in a cylinder — it becomes part of your home',
    detail: 'Unlike a combi, it stores hot water rather than delivering on-demand — a cylinder is part of the package.',
  },
  space_for_cylinder_unavailable: {
    headline: 'Finding space for a cylinder in your home is worth discussing',
    detail: 'A suitable location for the hot water storage has not been identified yet — it may be solvable.',
  },
};

// ─── Context-aware overrides ──────────────────────────────────────────────────

/**
 * Returns a household-tailored headline for `combi_dhw_demand_risk`.
 * With 2+ bathrooms the headline names the specific count for clarity.
 */
function combiDhwDemandRiskHeadline(ctx: HouseholdContext | undefined): string {
  const baths = ctx?.bathroomCount ?? 0;
  if (baths >= 2) {
    return `Your home has ${baths} bathrooms — on-demand heating cannot serve two outlets at once`;
  }
  return LIMITER_COPY.combi_dhw_demand_risk.headline;
}

/**
 * Returns a household-tailored headline for `combi_service_switching`.
 * With 2+ occupants the impact is personal: "when two people use hot water
 * at the same time, your heating pauses".
 */
function combiSwitchingHeadline(ctx: HouseholdContext | undefined): string {
  const occ = ctx?.occupancyCount ?? 1;
  if (occ >= 2) {
    return 'When two people use hot water at the same time, your heating pauses';
  }
  return LIMITER_COPY.combi_service_switching.headline;
}

/**
 * Returns a household-tailored headline for `simultaneous_demand_constraint`.
 * With 2+ bathrooms or 3+ occupants the busy-morning framing is specific
 * enough to feel like it is describing this household.
 */
function simultaneousHeadline(ctx: HouseholdContext | undefined): string {
  const baths = ctx?.bathroomCount ?? 1;
  const occ   = ctx?.occupancyCount ?? 1;
  if (baths >= 2 || occ >= 3) {
    return 'In a busy morning, your hot water gets shared between taps';
  }
  return LIMITER_COPY.simultaneous_demand_constraint.headline;
}

/**
 * Returns a household-tailored headline for `stored_volume_shortfall`.
 * With 3+ occupants the shortfall is a daily reality, not just a risk.
 */
function storedVolumeHeadline(ctx: HouseholdContext | undefined): string {
  const occ = ctx?.occupancyCount ?? 1;
  if (occ >= 3) {
    return 'With several people showering in the morning, hot water can run short';
  }
  return LIMITER_COPY.stored_volume_shortfall.headline;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns human-readable copy for a given limiter ID.
 * Accepts an optional HouseholdContext to tailor the headline to how this
 * home is actually used.  Falls back to a generic statement when the ID is
 * not mapped.
 */
export function getLimiterHumanCopy(
  limiterId: string,
  ctx?: HouseholdContext,
): LimiterHumanCopy {
  const base = LIMITER_COPY[limiterId];
  if (base == null) {
    return {
      headline: 'A constraint was identified that affects how this system performs in your home',
    };
  }

  switch (limiterId) {
    case 'combi_dhw_demand_risk':
      return { ...base, headline: combiDhwDemandRiskHeadline(ctx) };
    case 'combi_service_switching':
      return { ...base, headline: combiSwitchingHeadline(ctx) };
    case 'simultaneous_demand_constraint':
      return { ...base, headline: simultaneousHeadline(ctx) };
    case 'stored_volume_shortfall':
      return { ...base, headline: storedVolumeHeadline(ctx) };
    default:
      return base;
  }
}
