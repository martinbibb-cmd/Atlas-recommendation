import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { OptionCardV1, OptionPlane, OptionRequirements, SensitivityItem } from '../contracts/EngineOutputV1';
import type { CombiDhwV1Result } from './schema/EngineInputV2_3';
import { buildAssumptionsV1 } from './AssumptionsBuilder';
import { runCombiDhwModuleV1 } from './modules/CombiDhwModule';

/**
 * Flag ID emitted by CombiDhwModule when mains pressure is below the absolute
 * minimum operating condition (< 0.3 bar).  This is the only combi-specific
 * 'fail' flag that warrants 'rejected' status — at this pressure the burner
 * physically cannot fire.  Demand-side 'fail' flags (simultaneous demand,
 * large household) result in 'caution' under the no-hard-stops policy.
 */
const COMBI_MIN_PRESSURE_FLAG_ID = 'combi-pressure-constraint' as const;

/**
 * Minimum measured flow (L/min) that represents a clearly-strong CWS operating point.
 */
const STRONG_FLOW_LPM = 20;

/**
 * Flow threshold (L/min) below which unvented performance is "limited / fair"
 * for simultaneous multi-outlet demand, even when the eligibility gate is met.
 *
 * Gate minimum: 12 L/min (flow-only, no pressure recorded) or 10 L/min @ 1 bar.
 * "Good" threshold: STRONG_FLOW_LPM (20 L/min).
 * "Limited / fair" band: 12–17 L/min — passes the gate but not strong for
 *   simultaneous demand; better than combi for stored scenarios, but
 *   open-vent may be preferable for heavy simultaneous-demand weak-main properties.
 */
const MODERATE_FLOW_LPM = 18;

/**
 * Returns true when the measured CWS operating point is clearly strong:
 *   - hasMeasurements is true
 *   - the unvented eligibility gate is met (≥ 10 L/min @ ≥ 1.0 bar)
 *   - measured flow under load is ≥ STRONG_FLOW_LPM (2× the minimum gate threshold)
 *
 * This is used to suppress misleading "borderline pressure" wording when strong flow
 * evidence offsets dynamic pressure in the 1.0–1.5 bar range.  A 30 L/min @ 1.0 bar
 * operating point is not the same as a 10 L/min @ 1.0 bar one — the copy must reflect
 * the full evidence, not just the pressure number in isolation.
 */
function strongOperatingPoint(cwsSupplyV1: FullEngineResultCore['cwsSupplyV1']): boolean {
  return (
    cwsSupplyV1.hasMeasurements &&
    cwsSupplyV1.meetsUnventedRequirement &&
    (cwsSupplyV1.dynamic?.flowLpm ?? 0) >= STRONG_FLOW_LPM
  );
}

/**
 * Returns true when flow is in the "moderate" band (MODERATE_FLOW_LPM ≤ flow < STRONG_FLOW_LPM).
 * Flow in this band passes the unvented gate but does NOT qualify as "strong".
 * Wording should reflect "adequate / workable" rather than "good" for simultaneous demand.
 */
function moderateFlowOperatingPoint(cwsSupplyV1: FullEngineResultCore['cwsSupplyV1']): boolean {
  const flow = cwsSupplyV1.dynamic?.flowLpm ?? 0;
  return (
    cwsSupplyV1.hasMeasurements &&
    cwsSupplyV1.meetsUnventedRequirement &&
    flow >= MODERATE_FLOW_LPM &&
    flow < STRONG_FLOW_LPM
  );
}

/**
 * Returns true when flow passes the unvented gate but is below MODERATE_FLOW_LPM —
 * the "limited / fair" band.  Usable for stored hot water but not strong for
 * simultaneous multi-outlet demand.
 */
function limitedFlowOperatingPoint(cwsSupplyV1: FullEngineResultCore['cwsSupplyV1']): boolean {
  const flow = cwsSupplyV1.dynamic?.flowLpm ?? 0;
  return (
    cwsSupplyV1.hasMeasurements &&
    cwsSupplyV1.meetsUnventedRequirement &&
    flow < MODERATE_FLOW_LPM
  );
}

/**
 * Flag IDs that are specific to unvented (mains-pressure) cylinder viability.
 * These flags must not influence the status or copy of the stored_vented card:
 * a vented cylinder's viability is independent of mains operating-point data.
 */
const UNVENTED_SPECIFIC_FLAG_IDS: ReadonlySet<string> = new Set([
  'stored-unvented-low-flow',
  'stored-unvented-flow-unknown',
]);

/**
 * Returns a human-readable description of the measured CWS operating point.
 * Prefers the full "X L/min @ Y bar" form when both flow and pressure are available.
 * Falls back to pressure-only when flow is absent.
 */
function operatingPointBullet(cwsSupplyV1: FullEngineResultCore['cwsSupplyV1'], dynamicBar: number): string {
  const flow = cwsSupplyV1.dynamic?.flowLpm;
  if (flow !== undefined && flow > 0) {
    return `Measured operating point: ${flow.toFixed(0)} L/min @ ${dynamicBar.toFixed(1)} bar (dynamic under load).`;
  }
  return `Dynamic mains pressure: ${dynamicBar.toFixed(1)} bar.`;
}

// ── Sensitivities builder ─────────────────────────────────────────────────────

function buildSensitivities(
  optionId: OptionCardV1['id'],
  core: FullEngineResultCore,
  input: EngineInputV2_3,
  resolvedCombiDhw: CombiDhwV1Result,
): SensitivityItem[] {
  const items: SensitivityItem[] = [];
  const { hydraulicV1, storedDhwV1, pressureAnalysis } = core;
  const pressure = pressureAnalysis.dynamicBar;
  const pipeDiameter = input.primaryPipeDiameter;

  if (optionId === 'ashp') {
    if (hydraulicV1.verdict.ashpRisk === 'fail' || hydraulicV1.verdict.ashpRisk === 'warn') {
      // Pipe upgrade would change ASHP status
      if (!pipeDiameter || pipeDiameter < 28) {
        items.push({
          lever: 'Primary pipe size',
          effect: 'upgrade',
          note: `If primaries were upgraded to 28mm${pipeDiameter ? ` (currently ${pipeDiameter}mm)` : ''}, ASHP hydraulic risk would be resolved — flow rate supported without erosion risk.`,
        });
      }
    } else {
      // Already viable — what would downgrade it?
      items.push({
        lever: 'Primary pipe size',
        effect: 'downgrade',
        note: `Downgrading to 22mm primaries would push ASHP into caution territory for heat loads above ~10 kW.`,
      });
    }
    // Emitter upgrade note
    items.push({
      lever: 'Emitter upgrade appetite',
      effect: 'upgrade',
      note: 'Upgrading to low-temperature emitters (UFH or oversized radiators) would improve ASHP SPF from the current band, reducing running costs.',
    });
  }

  if (optionId === 'combi') {
    if (resolvedCombiDhw.verdict.combiRisk === 'fail' || resolvedCombiDhw.verdict.combiRisk === 'warn') {
      items.push({
        lever: 'Peak outlets at once',
        effect: 'upgrade',
        note: 'If peak simultaneous outlets were confirmed at 1 (single bathroom in use at a time), combi viability would improve significantly.',
      });
      if (pressure < 1.5) {
        items.push({
          lever: 'Mains pressure',
          effect: 'upgrade',
          note: `Mains pressure is ${pressure.toFixed(1)} bar — below the 1.5 bar recommended for a combi. A stored cylinder (vented or Mixergy) removes this pressure dependency entirely.`,
        });
      }
    } else {
      items.push({
        lever: 'Peak outlets at once',
        effect: 'downgrade',
        note: 'Adding a second bathroom in use simultaneously would push combi into caution or rejected territory.',
      });
    }
  }

  if (optionId === 'stored_vented' || optionId === 'stored_unvented') {
    const recType = storedDhwV1?.recommended.type;
    if (input.availableSpace === 'tight') {
      items.push({
        lever: 'Available space',
        effect: 'upgrade',
        note: 'If more cylinder space were available (upgrade from tight to ok), a standard cylinder could be installed — Mixergy may still be preferred for efficiency.',
      });
    } else if (input.availableSpace !== 'ok') {
      items.push({
        lever: 'Available space',
        effect: 'upgrade',
        note: 'Confirming adequate cylinder space would remove the space-unknown caution and allow a standard indirect cylinder.',
      });
    }
    if (recType === 'mixergy') {
      items.push({
        lever: 'Cylinder type',
        effect: 'upgrade',
        note: 'Switching to a Mixergy cylinder would resolve the space constraint — Mixergy heats only the top portion, providing equivalent usable hot water in a smaller effective footprint.',
      });
    }
  }

  if (optionId === 'stored_unvented') {
    if (pressure < 1.0) {
      items.push({
        lever: 'Mains pressure',
        effect: 'upgrade',
        note: `Mains pressure is ${pressure.toFixed(1)} bar — too low for a standard unvented cylinder. 💧 A Mixergy cylinder removes this pressure requirement and remains usable on weaker supplies where a standard unvented cylinder would not.`,
      });
    } else if (pressure < 1.5) {
      items.push({
        lever: 'Mains pressure',
        effect: 'upgrade',
        note: `Mains pressure is ${pressure.toFixed(1)} bar — borderline for an unvented cylinder. Confirm measured flow under load. 💧 A Mixergy cylinder is more tolerant of weak mains supplies and avoids this concern.`,
      });
    } else {
      items.push({
        lever: 'Mains pressure',
        effect: 'downgrade',
        note: `If mains pressure dropped significantly, a vented (tank-fed) or Mixergy cylinder would be the safer choice as neither depends on mains pressure.`,
      });
    }
  }

  if (optionId === 'stored_vented') {
    const hasFutureLoftConversion = input.futureLoftConversion ?? input.hasLoftConversion ?? false;
    if (hasFutureLoftConversion) {
      items.push({
        lever: 'Loft conversion plan',
        effect: 'upgrade',
        note: 'If the loft conversion plan were cancelled, the vented cylinder with loft tank would become feasible again.',
      });
    } else {
      items.push({
        lever: 'Loft conversion plan',
        effect: 'downgrade',
        note: 'Proceeding with a loft conversion would remove the CWS/F&E header tank space, blocking a vented cylinder.',
      });
    }
  }

  if (optionId === 'system_unvented') {
    if (pressure < 1.0) {
      items.push({
        lever: 'Mains pressure',
        effect: 'upgrade',
        note: `Mains pressure is ${pressure.toFixed(1)} bar — too low for a standard unvented cylinder. 💧 A Mixergy cylinder removes this pressure requirement and remains usable on weaker supplies where a standard unvented cylinder would not.`,
      });
    } else if (pressure < 1.5) {
      items.push({
        lever: 'Mains pressure',
        effect: 'upgrade',
        note: `Mains pressure is ${pressure.toFixed(1)} bar — borderline for an unvented cylinder. Confirm measured flow under load. 💧 A Mixergy cylinder is more tolerant of weak mains supplies and avoids this concern.`,
      });
    } else {
      items.push({
        lever: 'Mains pressure',
        effect: 'downgrade',
        note: `If mains pressure dropped significantly, a vented (tank-fed) or Mixergy cylinder would be the safer choice as neither depends on mains pressure.`,
      });
    }
  }

  if (optionId === 'regular_vented') {
    const hasFutureLoftConversion = input.futureLoftConversion ?? input.hasLoftConversion ?? false;
    if (hasFutureLoftConversion) {
      items.push({
        lever: 'Loft conversion plan',
        effect: 'upgrade',
        note: 'If the loft conversion plan were cancelled, the open-vented system with F&E header tank would become feasible again.',
      });
    } else {
      items.push({
        lever: 'Loft conversion plan',
        effect: 'downgrade',
        note: 'Proceeding with a loft conversion would remove the header tank space, rejecting the regular vented system option.',
      });
    }
  }

  return items;
}

/**
 * Builds the Option Matrix V1 — a set of option cards derived from the
 * deterministic physics modules already computed in FullEngineResultCore.
 */
export function buildOptionMatrixV1(
  core: FullEngineResultCore,
  input: EngineInputV2_3,
): OptionCardV1[] {
  const cards: OptionCardV1[] = [];

  // ── Shared inputs ────────────────────────────────────────────────────────
  const hasFutureLoftConversion = input.futureLoftConversion ?? input.hasLoftConversion ?? false;

  // ── On Demand (Combi) card ───────────────────────────────────────────────
  // core.combiDhwV1 is only populated when the primary (current) system is a
  // combi. When the current system is a system or regular boiler, it is
  // undefined.  In that case we run the module directly so the option card
  // always reflects the correct DHW physics for this household — occupancy,
  // bathroom count, and mains supply — regardless of what the existing system
  // happens to be.
  const combiDhwResult: CombiDhwV1Result =
    core.combiDhwV1 ?? runCombiDhwModuleV1(input);
  const combiRisk = combiDhwResult.verdict.combiRisk;
  const combiRejectedByTopology = core.redFlags.rejectCombi ?? false;

  // COMBI_MIN_PRESSURE_FLAG_ID at 'fail' severity means pressure is below the
  // absolute minimum operating condition (< 0.3 bar) — the burner physically
  // cannot fire.  This is a genuine physical impossibility → 'rejected'.
  // All other 'fail' flags (simultaneous demand, large household) are advisory
  // under the no-hard-stops policy → 'caution' so combi remains selectable.
  const combiBelowMinPressure = combiDhwResult.flags.some(
    f => f.id === COMBI_MIN_PRESSURE_FLAG_ID && f.severity === 'fail',
  );

  let combiStatus: OptionCardV1['status'];
  if (combiRejectedByTopology || combiBelowMinPressure) {
    // Never block/reject a system — downgrade to caution so combi remains selectable
    // even when topology or pressure constraints apply.
    combiStatus = 'caution';
  } else if (combiRisk === 'fail' || combiRisk === 'warn') {
    // combiRisk === 'fail' from demand-side flags (bathroomCount >= 2, occupancyCount >= 4)
    // is advisory — combi is heavily penalised in the recommendation ranking but must remain
    // selectable when it is still the best available option for the household.
    combiStatus = 'caution';
  } else {
    combiStatus = 'viable';
  }

  const combiWhy: string[] = [];
  if (combiRejectedByTopology) {
    combiWhy.push('Topology prevents combi installation (one-pipe or similar).');
  }
  for (const f of combiDhwResult.flags) {
    combiWhy.push(`${f.title}: ${f.detail}`);
  }
  if (combiWhy.length === 0) {
    combiWhy.push('No simultaneous DHW demand detected.');
    combiWhy.push('Mains pressure is sufficient for on-demand flow.');
  }

  const combiRequirements: string[] = [
    'Only works well when peak outlets = 1 (single bathroom in use).',
    'Move to stored cylinder if demand grows (second bathroom, higher occupancy).',
  ];
  if (core.pressureAnalysis.staticBar !== undefined && core.pressureAnalysis.staticBar < 1.5) {
    combiRequirements.push('⚠️ Standing mains pressure is low — a stored cylinder (vented or Mixergy) would be more reliable here.');
  }

  const combiEvidenceIds = combiDhwResult.flags.map(f => f.id);

  // Combi heat plane: boiler wet-side — same physics as system/regular
  const combiHeat: OptionPlane = {
    status: 'ok',
    headline: 'Boiler wet-side heating. Same hydraulic physics as system and regular boiler.',
    bullets: [
      'High flow temperature (60–80°C) — compatible with existing radiators.',
      'ΔT 20°C design — low flow rate requirement; existing pipework is adequate.',
      'Cycling risk: short draws may suppress condensing return temp.',
    ],
    evidenceIds: [],
  };

  // Combi DHW plane: where combi diverges hard
  const combiDhwBullets: string[] = [
    'On demand: no stored volume — heat delivery starts on demand.',
    'Stop/start draws cause purge loss and cold-water sandwich effect.',
  ];
  for (const f of combiDhwResult.flags) {
    combiDhwBullets.push(`${f.title}: ${f.detail}`);
  }
  const combiDhw: OptionPlane = {
    status: combiRisk === 'fail' ? 'caution' : combiRisk === 'warn' ? 'caution' : 'ok',
    headline: combiRisk === 'fail'
      ? 'DHW: simultaneous demand or pressure issue makes combi unsuitable.'
      : combiRisk === 'warn'
      ? 'DHW: borderline — short draws and pressure margin are risks.'
      : 'DHW: single-outlet demand is within combi capability.',
    bullets: combiDhwBullets,
    evidenceIds: combiEvidenceIds,
  };

  // Combi engineering plane
  const combiEngineering: OptionPlane = {
    status: combiRejectedByTopology ? 'caution' : 'ok',
    headline: 'Engineering: compact installation — no cylinder space needed.',
    bullets: [
      'No cylinder or header tank required — minimal space footprint.',
      'Single appliance supplies both heating and DHW.',
      combiRejectedByTopology
        ? 'One-pipe topology blocks standard combi installation.'
        : 'Two-pipe topology confirmed — combi installation straightforward.',
    ],
    evidenceIds: [],
  };

  // Determine whether the fail is specifically from concurrent/simultaneous demand
  // (bathroomCount >= 2 or peakConcurrentOutlets >= 2), not from large-household
  // volume demand or pressure alone. When peakConcurrentOutlets is explicitly 1,
  // do not emit a simultaneous-demand narrative even if bathroomCount >= 2 also
  // triggered the fail — the two conditions are independent physics dimensions.
  const peakOutletsExplicit = input.peakConcurrentOutlets ?? null;
  const hasSimultaneousDemandFlag =
    combiDhwResult.flags.some(f => f.id === 'combi-simultaneous-demand');
  const simultaneousDemandNarrativeActive =
    hasSimultaneousDemandFlag && (peakOutletsExplicit === null || peakOutletsExplicit >= 2);

  const combiTypedReqs: OptionRequirements = {
    mustHave: combiRejectedByTopology
      ? [
          'Pipework review required — the current one-pipe layout is not compatible with a standard combi installation.',
        ]
      : combiRisk === 'fail'
      ? [
          simultaneousDemandNarrativeActive
            ? 'Simultaneous hot-water demand is high for this household — a stored hot water option is usually a better fit.'
            : 'High daily hot-water demand for this household — a stored hot water option handles recovery and volume demands better.',
        ]
      : [
          'Confirm mains flow rate and pressure performance before finalising combi specification.',
        ],
    likelyUpgrades: (core.pressureAnalysis.staticBar !== undefined && core.pressureAnalysis.staticBar < 1.5)
      ? ['⚠️ Low standing pressure — consider a stored cylinder (vented or Mixergy) instead of a combi.']
      : [],
    niceToHave: ['Smart thermostat for occupancy-led control.'],
  };

  cards.push({
    id: 'combi',
    label: 'On Demand (Combi)',
    status: combiStatus,
    headline: combiStatus === 'viable'
      ? 'Combi boiler suits your single-outlet demand.'
      : combiStatus === 'caution'
      ? combiRisk === 'fail'
        ? 'Combi not advisable — simultaneous demand risk is high. Consider stored options.'
        : 'Combi possible but demand is borderline.'
      : combiRejectedByTopology
      ? 'Combi not suitable — topology barrier.'
      : 'Combi not suitable — mains pressure below minimum operating condition.',
    why: combiWhy,
    requirements: combiRequirements,
    evidenceIds: combiEvidenceIds,
    heat: combiHeat,
    dhw: combiDhw,
    engineering: combiEngineering,
    typedRequirements: combiTypedReqs,
    sensitivities: buildSensitivities('combi', core, input, combiDhwResult),
  });

  // ── Stored hot water — Vented cylinder card ─────────────────────────────
  // ventedRelevantRisk excludes unvented-specific flags so that a missing
  // mains-flow measurement (which is only relevant for mains-pressure / unvented
  // cylinders) does not cascade into a caution state for the vented card.
  const ventedRelevantRisk: 'warn' | 'pass' = (core.storedDhwV1?.flags ?? []).some(
    f => f.severity === 'warn' && !UNVENTED_SPECIFIC_FLAG_IDS.has(f.id),
  ) ? 'warn' : 'pass';

  let storedVentedStatus: OptionCardV1['status'];
  if (hasFutureLoftConversion) {
    storedVentedStatus = 'caution';
  } else if (input.availableSpace === 'none') {
    storedVentedStatus = 'caution';
  } else if (input.loftTankSpace === 'none') {
    storedVentedStatus = 'caution';
  } else if (ventedRelevantRisk === 'warn' || input.availableSpace === 'tight') {
    storedVentedStatus = 'caution';
  } else {
    storedVentedStatus = 'viable';
  }

  const storedVentedWhy: string[] = [
    'Solves simultaneity — hot water ready for multiple outlets at once.',
    'Tank-fed / gravity or pumped capable — does not rely on mains pressure.',
  ];
  // Only include flags that are relevant to vented cylinders — unvented-specific
  // mains-supply flags are not applicable to a tank-fed (loft-tank) supply.
  for (const f of (core.storedDhwV1?.flags ?? []).filter(f => !UNVENTED_SPECIFIC_FLAG_IDS.has(f.id))) {
    storedVentedWhy.push(`${f.title}: ${f.detail}`);
  }
  if (hasFutureLoftConversion) {
    storedVentedWhy.push('Loft conversion planned — CWS and F&E header tanks may lose their space.');
  }
  if (input.loftTankSpace === 'none') {
    storedVentedWhy.push('No loft tank space — CWS and F&E cisterns cannot be accommodated.');
  }

  const recType = core.storedDhwV1?.recommended.type;
  const storedVentedRequirements: string[] = [
    'Loft tanks required (CWS + F&E) unless converting to sealed/unvented.',
  ];
  if (input.availableSpace === 'none') {
    storedVentedRequirements.push('No cylinder space confirmed — this option is not feasible without creating additional space.');
  } else if (input.loftTankSpace === 'none') {
    storedVentedRequirements.push('No loft tank space — switch to sealed/unvented system (no CWS or F&E tanks required).');
  } else if (input.availableSpace === 'tight') {
    storedVentedRequirements.push('Space is tight — consider Mixergy cylinder (smaller effective footprint).');
  } else if (input.availableSpace === 'unknown') {
    storedVentedRequirements.push('Confirm airing-cupboard / utility space for cylinder installation.');
  }
  if (recType === 'mixergy') {
    storedVentedRequirements.push('Mixergy recommended: stratified heating reduces gas use and effective tank size needed.');
  }

  const storedEvidenceIds = (core.storedDhwV1?.flags ?? []).map(f => f.id);

  const storedVentedHeat: OptionPlane = {
    status: 'ok',
    headline: 'Boiler wet-side heating. Identical hydraulic physics to combi and regular boiler.',
    bullets: [
      'High flow temperature (60–80°C) — compatible with existing radiators.',
      'Primary circuit fully isolated from DHW — no stop/start cycling impact on heat.',
      'Condensing efficiency preserved: primary return stays below 55°C.',
    ],
    evidenceIds: [],
  };

  const storedVentedDhwBullets: string[] = [
    'Stored volume handles simultaneous draw from multiple outlets.',
    'Gravity-fed pressure — no mains pressure required at cylinder.',
    `Recommended cylinder type: ${recType === 'mixergy' ? 'Mixergy (stratified)' : 'standard indirect'}.`,
  ];
  // Filter unvented-specific flags — they are not applicable to tank-fed supply.
  for (const f of (core.storedDhwV1?.flags ?? []).filter(f => !UNVENTED_SPECIFIC_FLAG_IDS.has(f.id))) {
    storedVentedDhwBullets.push(`${f.title}: ${f.detail}`);
  }
  const storedVentedDhw: OptionPlane = {
    status: ventedRelevantRisk === 'warn' ? 'caution' : 'ok',
    headline: ventedRelevantRisk === 'warn'
      ? 'DHW: caution — space or cylinder condition flags require attention.'
      : 'DHW: stored volume suits your demand profile.',
    bullets: storedVentedDhwBullets,
    evidenceIds: storedEvidenceIds,
  };

  const storedVentedEngineering: OptionPlane = {
    status: hasFutureLoftConversion ? 'caution'
      : (input.availableSpace === 'none' || input.loftTankSpace === 'none') ? 'caution'
      : input.availableSpace === 'tight' ? 'caution'
      : 'ok',
    headline: hasFutureLoftConversion
      ? 'Engineering: loft conversion conflicts with CWS/F&E header tanks.'
      : (input.availableSpace === 'none')
        ? 'Engineering: no cylinder space — stored hot water is not feasible.'
        : (input.loftTankSpace === 'none')
          ? 'Engineering: no loft tank space — switch to sealed/unvented system.'
          : 'Engineering: loft tanks + cylinder space are key constraints.',
    bullets: [
      hasFutureLoftConversion
        ? 'Planned loft conversion removes header tank space — switch to sealed unvented system.'
        : (input.loftTankSpace === 'none')
          ? 'No loft tank space — CWS and F&E cisterns cannot be accommodated; use sealed system instead.'
          : 'Loft headspace required for CWS and F&E header tanks.',
      input.availableSpace === 'none'
        ? 'No cylinder space — installation is not feasible without creating a suitable cupboard or utility space.'
        : input.availableSpace === 'tight'
        ? 'Space is tight — Mixergy or slimline cylinder may fit where standard cannot.'
        : input.availableSpace === 'ok'
        ? 'Adequate airing-cupboard or utility space for cylinder.'
        : 'Confirm cylinder space before proceeding.',
      'Indirect cylinder requires primary flow/return connections to boiler.',
    ],
    evidenceIds: [],
  };

  const storedVentedTypedReqs: OptionRequirements = {
    mustHave: hasFutureLoftConversion
      ? ['Loft conflict: switch to sealed system boiler + unvented cylinder instead.']
      : input.availableSpace === 'none'
        ? ['No cylinder space — option not feasible without creating suitable installation space.']
        : input.loftTankSpace === 'none'
          ? ['No loft tank space — switch to sealed system boiler + unvented cylinder (no CWS/F&E tanks required).']
          : ['Loft remains accessible for CWS and F&E header tanks.', 'Confirm cylinder location and space before ordering.'],
    likelyUpgrades: recType === 'mixergy'
      ? ['Mixergy cylinder upgrade — stratified heating for reduced gas use and smaller footprint.']
      : input.availableSpace === 'unknown'
      ? ['Space survey to confirm airing-cupboard / utility room dimensions.']
      : [],
    niceToHave: ['Immersion heater backup for resilience.', 'Solar thermal pre-heat coil (if south-facing roof).'],
  };

  cards.push({
    id: 'stored_vented',
    label: 'Stored hot water — Vented cylinder',
    status: storedVentedStatus,
    headline: storedVentedStatus === 'viable'
      ? 'Vented cylinder is a strong fit — no mains pressure dependency.'
      : 'Vented cylinder viable with constraints — check loft space and cylinder sizing.',
    why: storedVentedWhy,
    requirements: storedVentedRequirements,
    evidenceIds: storedEvidenceIds,
    heat: storedVentedHeat,
    dhw: storedVentedDhw,
    engineering: storedVentedEngineering,
    typedRequirements: storedVentedTypedReqs,
    sensitivities: buildSensitivities('stored_vented', core, input, combiDhwResult),
  });

  // ── Stored hot water — Unvented cylinder card ────────────────────────────
  const { cwsSupplyV1 } = core;
  const mainsPressure = core.pressureAnalysis.dynamicBar;
  const mainsStaticPressure = core.pressureAnalysis.staticBar;

  let storedUnventedStatus: OptionCardV1['status'];
  if (input.availableSpace === 'none') {
    storedUnventedStatus = 'caution';
  } else if (cwsSupplyV1.inconsistent) {
    storedUnventedStatus = 'caution';
  } else if (!cwsSupplyV1.hasMeasurements) {
    storedUnventedStatus = 'caution';
  } else if (cwsSupplyV1.meetsUnventedRequirement) {
    storedUnventedStatus = 'viable';
  } else {
    storedUnventedStatus = 'caution';
  }

  const storedUnventedWhy: string[] = [
    'Mains-pressure hot water throughout — no shower pump required.',
    `Sealed circuit. System boiler typical; regular possible with external pump/expansion.`,
    operatingPointBullet(cwsSupplyV1, mainsPressure),
  ];
  if (cwsSupplyV1.inconsistent) {
    storedUnventedWhy.push('Pressure readings inconsistent — recheck static and dynamic measurements.');
  } else if (!cwsSupplyV1.hasMeasurements) {
    storedUnventedWhy.push('Mains supply not fully characterised — need L/min @ bar measurement.');
  } else if (!cwsSupplyV1.meetsUnventedRequirement) {
    storedUnventedWhy.push('Mains supply does not meet unvented requirement (10 L/min @ 1 bar, or 12 L/min @ any recorded pressure including 0 bar).');
  }
  // Include non-unvented-specific flags (e.g. stored-high-demand, stored-space-tight,
  // stored-cylinder-condition) to give relevant demand and space context.
  // Unvented-specific mains-flow flags are excluded here because they are already
  // surfaced by the CWS supply check above — duplicating them would repeat the same
  // constraint in consecutive bullets and confuse the installer.
  for (const f of (core.storedDhwV1?.flags ?? []).filter(f => !UNVENTED_SPECIFIC_FLAG_IDS.has(f.id))) {
    storedUnventedWhy.push(`${f.title}: ${f.detail}`);
  }

  const storedUnventedRequirements: string[] = [
    'Unvented requirement: ≥ 10 L/min @ ≥ 1.0 bar, or ≥ 12 L/min @ any recorded pressure (including 0 bar).',
    'Unvented cylinder requires G3-qualified installer and annual servicing.',
    'Sealed circuit — no loft tanks required.',
  ];
  if (!cwsSupplyV1.hasMeasurements) {
    storedUnventedRequirements.push('Measure mains flow (L/min) and pressure (bar) before specifying cylinder.');
  }
  if (mainsStaticPressure !== undefined && mainsStaticPressure < 1.5 && mainsStaticPressure >= 1.0 && !strongOperatingPoint(cwsSupplyV1)) {
    storedUnventedRequirements.push('💧 Standing pressure is low — a Mixergy cylinder is a good choice here, as it remains usable on weaker supplies where a standard unvented cylinder struggles.');
  }
  if (recType === 'mixergy') {
    storedUnventedRequirements.push('💧 Mixergy recommended: heats only the water you need, more tolerant of weak mains supply than a standard unvented, and reduces energy use.');
  }

  const storedUnventedHeat: OptionPlane = {
    status: 'ok',
    headline: 'Boiler wet-side heating. Sealed system — no F&E header tank needed.',
    bullets: [
      'High flow temperature (60–80°C) — compatible with existing radiators.',
      'Sealed primary circuit: expansion vessel replaces header tank.',
      'Suitable for loft conversion properties where open-vented is blocked.',
    ],
    evidenceIds: [],
  };

  const storedUnventedDhwBullets: string[] = [
    'Stored volume handles simultaneous draw from multiple outlets.',
    mainsPressure < 1.5 && strongOperatingPoint(cwsSupplyV1)
      ? `Mains-pressure DHW: ${mainsPressure.toFixed(1)} bar dynamic — strong measured flow under load; stored delivery is well supported.`
      : `Mains-pressure DHW: ${mainsPressure.toFixed(1)} bar${mainsPressure < 1.5 ? ' (borderline — min 1.5 bar recommended for a standard unvented cylinder)' : ' (adequate)'}.`,
    `Recommended cylinder type: ${recType === 'mixergy' ? '💧 Mixergy (stratified — more tolerant of weak mains supply)' : 'standard indirect'}.`,
  ];
  if (limitedFlowOperatingPoint(cwsSupplyV1)) {
    const flowLpm = cwsSupplyV1.dynamic?.flowLpm ?? 0;
    storedUnventedDhwBullets.push(
      `Measured flow (${flowLpm} L/min) is workable for stored hot water but limited for strong simultaneous outlet demand. ` +
      `A tank-fed (vented) system may suit better where simultaneous demand is heavy and mains supply is weak.`,
    );
  }
  if (cwsSupplyV1.inconsistent) {
    storedUnventedDhwBullets.push('⚠️ Pressure readings look inconsistent — recheck measurements before proceeding.');
  } else if (!cwsSupplyV1.hasMeasurements) {
    storedUnventedDhwBullets.push('Mains supply not fully characterised — measure L/min @ bar before specifying.');
  } else if (!cwsSupplyV1.meetsUnventedRequirement) {
    storedUnventedDhwBullets.push('💧 Supply does not meet unvented requirement — consider a Mixergy or vented cylinder instead, as neither requires high mains pressure.');
  }
  // Only include non-unvented-specific flags — unvented mains-flow flags are already
  // captured by the CWS supply bullets above and must not be repeated.
  for (const f of (core.storedDhwV1?.flags ?? []).filter(f => !UNVENTED_SPECIFIC_FLAG_IDS.has(f.id))) {
    storedUnventedDhwBullets.push(`${f.title}: ${f.detail}`);
  }
  const cwsIssue = cwsSupplyV1.inconsistent || !cwsSupplyV1.hasMeasurements || !cwsSupplyV1.meetsUnventedRequirement;
  const storedUnventedDhwStatus: OptionPlane['status'] = cwsIssue ? 'caution' : 'ok';
  const storedUnventedDhwHeadline =
    cwsSupplyV1.inconsistent
      ? '⚠️ DHW: pressure readings inconsistent — recheck measurements.'
      : !cwsSupplyV1.hasMeasurements
      ? 'DHW: mains supply not characterised — need L/min @ bar measurement.'
      : !cwsSupplyV1.meetsUnventedRequirement
      ? '💧 DHW: mains supply below unvented requirement — Mixergy or vented cylinder recommended instead.'
      : limitedFlowOperatingPoint(cwsSupplyV1)
      ? 'DHW: mains-pressure stored hot water — usable but limited for simultaneous multi-outlet demand.'
      : moderateFlowOperatingPoint(cwsSupplyV1)
      ? 'DHW: mains-pressure stored hot water — adequate flow; better than on-demand for stored scenarios.'
      : 'DHW: mains-pressure stored hot water — strong flow supports simultaneous outlet delivery.';
  const storedUnventedDhw: OptionPlane = {
    status: storedUnventedDhwStatus,
    headline: storedUnventedDhwHeadline,
    bullets: storedUnventedDhwBullets,
    evidenceIds: storedEvidenceIds,
  };

  const storedUnventedEngineering: OptionPlane = {
    status: (mainsStaticPressure !== undefined && mainsStaticPressure < 1.5 && !strongOperatingPoint(cwsSupplyV1)) ? 'caution' : 'ok',
    headline: 'Engineering: G3 compliance + discharge route are key constraints.',
    bullets: [
      'G3-qualified installer required — regulatory requirement for unvented cylinders.',
      'Tundish and discharge pipe to external drain required (typically 2× pipe size).',
      mainsStaticPressure !== undefined && mainsStaticPressure < 1.5 && strongOperatingPoint(cwsSupplyV1)
        ? `Measured flow under load is strong — mains-fed stored hot water appears supportive despite low standing pressure.`
        : mainsStaticPressure !== undefined && mainsStaticPressure < 1.5
        ? '💧 Standing pressure below 1.5 bar — a Mixergy cylinder is more tolerant of weak supplies and can remain viable where a standard unvented would be borderline.'
        : '✅ Mains pressure is adequate for a standard unvented cylinder.',
      'Annual service required by regulation: PRV, expansion vessel, tundish check.',
    ],
    evidenceIds: [],
  };

  const storedUnventedTypedReqs: OptionRequirements = {
    mustHave: [
      'G3-qualified installer.',
      'Tundish and discharge pipe routed to external drain.',
      ...(mainsPressure < 1.0 ? ['⚠️ Mains pressure is very low — a Mixergy or vented cylinder is recommended instead.'] : []),
      ...(!cwsSupplyV1.hasMeasurements ? ['Measure mains flow (L/min) and pressure (bar) before specifying.'] : []),
    ],
    likelyUpgrades: [
      ...(mainsStaticPressure !== undefined && mainsStaticPressure < 1.5 && mainsStaticPressure >= 1.0 && !strongOperatingPoint(cwsSupplyV1) ? ['💧 Consider a Mixergy cylinder — more tolerant of weak mains supply than a standard unvented; no minimum pressure gate in Atlas.'] : []),
      'Expansion vessel sized to cylinder volume.',
    ],
    niceToHave: [
      '💧 Mixergy cylinder for stratified DHW — more tolerant of weak mains supply, and reduces energy use.',
      'Smart immersion control for off-peak electricity pricing.',
    ],
  };

  // Determine whether demand profile is high (large household / multiple bathrooms).
  // This is used to make the headline positive about demand fit even when a mains
  // measurement is still needed — demand suitability and installation constraints
  // are separate concerns.
  const isHighDemandHousehold = (core.storedDhwV1?.flags ?? []).some(f => f.id === 'stored-high-demand');

  cards.push({
    id: 'stored_unvented',
    label: 'Stored hot water — Unvented cylinder',
    status: storedUnventedStatus,
    headline: storedUnventedStatus === 'viable'
      ? isHighDemandHousehold
        ? 'Unvented cylinder is a strong fit — mains-fed stored hot water suits high household demand.'
        : 'Unvented cylinder suits your mains pressure and demand.'
      : storedUnventedStatus === 'caution' && cwsSupplyV1.hasMeasurements && !cwsSupplyV1.meetsUnventedRequirement
      ? '💧 Mains supply below unvented requirement — Mixergy or vented cylinder is the better choice here.'
      : storedUnventedStatus === 'caution'
      ? isHighDemandHousehold
        ? 'Unvented cylinder suits your demand profile — confirm mains supply before proceeding.'
        : 'Unvented cylinder possible — confirm mains supply measurements.'
      : 'Unvented cylinder not suitable — mains pressure too low.',
    why: storedUnventedWhy,
    requirements: storedUnventedRequirements,
    evidenceIds: storedEvidenceIds,
    heat: storedUnventedHeat,
    dhw: storedUnventedDhw,
    engineering: storedUnventedEngineering,
    typedRequirements: storedUnventedTypedReqs,
    sensitivities: buildSensitivities('stored_unvented', core, input, combiDhwResult),
  });

  // ── ASHP card ────────────────────────────────────────────────────────────
  const ashpRisk = core.hydraulicV1.verdict.ashpRisk;
  const ashpRejectedByTopology = core.redFlags.rejectAshp ?? false;

  let ashpStatus: OptionCardV1['status'];
  if (ashpRejectedByTopology || input.hasOutdoorSpaceForHeatPump === false || input.availableSpace === 'none') {
    // Physical impossibility — one-pipe topology, no outdoor space, or no cylinder space.
    ashpStatus = 'rejected';
  } else if (ashpRisk === 'fail' || ashpRisk === 'warn' || (core.redFlags.flagAshp ?? false)) {
    // Hydraulic or performance constraint — advisory under no-hard-stops policy.
    ashpStatus = 'caution';
  } else {
    ashpStatus = 'viable';
  }

  const { ashp, boiler } = core.hydraulicV1;
  const ashpWhy: string[] = [
    `ΔT 5°C requires ~${(ashp.flowLpm / boiler.flowLpm).toFixed(1)}× boiler flow rate (${ashp.flowLpm.toFixed(1)} L/min vs ${boiler.flowLpm.toFixed(1)} L/min).`,
  ];
  if (input.availableSpace === 'none') {
    ashpWhy.push('No cylinder space confirmed — ASHP requires a hot water cylinder and cannot be installed without one.');
  }
  if (input.hasOutdoorSpaceForHeatPump === false) {
    ashpWhy.push('No adequate outdoor space for an ASHP unit — installation not feasible at this property.');
  }
  for (const note of core.hydraulicV1.notes) {
    if (note.includes('ASHP')) {
      ashpWhy.push(note);
    }
  }
  for (const reason of core.redFlags.reasons) {
    if (reason.includes('ASHP')) {
      ashpWhy.push(reason);
    }
  }

  const ashpRequirements: string[] = [
    '28mm primaries required for adequate flow without erosion risk.',
    'Emitters (radiators/UFH) sized for low-temperature operation.',
  ];
  if (ashpRisk === 'warn' || ashpRisk === 'fail') {
    ashpRequirements.push('Buffer vessel may be needed if system water volume is low.');
  }
  ashpRequirements.push('Outside unit space required (min. 1m clearance recommended).');

  const ashpEvidenceIds = [
    ...core.hydraulicV1.notes.filter(n => n.includes('ASHP')).map((_, i) => `hydraulic-note-${i}`),
    ...core.redFlags.reasons.filter(r => r.includes('ASHP')).map((_, i) => `redflag-ashp-${i}`),
  ];

  const regime = core.heatPumpRegime;
  const ashpHeatBullets: string[] = [
    `Same wet-side circuit as boiler — but operating at ΔT 5°C vs 20°C.`,
    `Required primary flow: ${ashp.flowLpm.toFixed(1)} L/min (~${(ashp.flowLpm / boiler.flowLpm).toFixed(1)}× boiler rate).`,
    `Design flow temperature: ${regime.designFlowTempBand}°C — SPF band: ${regime.spfBand.toUpperCase()}.`,
  ];
  for (const f of regime.flags) {
    ashpHeatBullets.push(`${f.title}: ${f.detail}`);
  }
  const ashpHeat: OptionPlane = {
    status: ashpRisk === 'fail' ? 'caution' : ashpRisk === 'warn' ? 'caution' : 'ok',
    headline: ashpRisk === 'fail'
      ? 'Heat: hydraulic barrier — pipe upgrade required before ASHP is feasible.'
      : ashpRisk === 'warn'
      ? 'Heat: marginal hydraulics — pipe upgrade strongly recommended.'
      : `Heat: hydraulically feasible at ${regime.designFlowTempBand}°C design flow (SPF: ${regime.spfBand}).`,
    bullets: ashpHeatBullets,
    evidenceIds: ashpEvidenceIds,
  };

  const ashpDhw: OptionPlane = {
    status: 'ok',
    headline: 'DHW: stored cylinder required — ASHP cannot provide on-demand hot water.',
    bullets: [
      'Indirect cylinder with immersion backup is standard for ASHP installations.',
      'Legionella cycle: weekly 60°C pasteurisation via immersion (small COP penalty).',
      'DHW temperature lift (55–60°C) is less efficient than space heating at 35–45°C.',
      'Mixergy cylinder improves DHW efficiency via top-down stratification.',
    ],
    evidenceIds: [],
  };

  const ashpEngineering: OptionPlane = {
    status: ashpRejectedByTopology ? 'caution' : 'ok',
    headline: ashpRejectedByTopology
      ? 'Engineering: topology barrier (one-pipe system).'
      : 'Engineering: outside unit + emitter and pipework upgrades.',
    bullets: [
      'Outside unit: min. 1m clearance, no enclosed spaces, noise consideration for neighbours.',
      '28mm primary pipework required to support high flow rates.',
      regime.designFlowTempBand === 35
        ? 'Full emitter upgrade required: UFH or low-temperature oversized radiators.'
        : regime.designFlowTempBand === 45
        ? 'Partial emitter upgrade expected: replace undersized radiators in key rooms.'
        : 'Existing radiators retained — higher flow temp, lower efficiency (50°C design).',
      ashpRisk === 'warn' || ashpRisk === 'fail'
        ? 'Buffer vessel likely required — low system water volume detected.'
        : 'Buffer vessel may not be required — confirm with heat pump sizing survey.',
    ],
    evidenceIds: [],
  };

  const ashpTypedReqs: OptionRequirements = {
    mustHave: [
      ...(ashpRejectedByTopology || ashpRisk === 'fail'
        ? ['Resolve hydraulic/topology barrier — pipe or system upgrade required.']
        : []),
      ...(input.hasOutdoorSpaceForHeatPump === false
        ? ['Outdoor space for ASHP unit not confirmed — installation not feasible until space is verified.']
        : []),
      'MCS-certified heat pump installer and sizing survey.',
      '28mm primary pipework (upgrade from 22mm if required).',
      'Stored DHW cylinder with immersion backup.',
    ],
    likelyUpgrades: [
      ...(regime.designFlowTempBand === 50
        ? ['Emitter upgrade to unlock lower flow temperatures and better SPF.']
        : regime.designFlowTempBand === 45
        ? ['Partial emitter upgrade (key rooms) for 45°C design flow.']
        : ['Full emitter upgrade (all rooms) for 35°C low-temp design.']),
      ...(ashpRisk === 'warn' || ashpRisk === 'fail'
        ? ['Buffer vessel to protect compressor from short-cycling.']
        : []),
    ],
    niceToHave: [
      'Mixergy cylinder for improved DHW stratification and legionella compliance.',
      'Smart tariff (Octopus Agile / Cosy) to reduce running cost.',
      'Solar PV to offset daytime running cost.',
    ],
  };

  cards.push({
    id: 'ashp',
    label: 'Air Source Heat Pump',
    status: ashpStatus,
    headline: ashpStatus === 'viable'
      ? 'ASHP is hydraulically feasible — good pipe sizing for heat pump flow.'
      : ashpStatus === 'caution'
      ? 'ASHP possible but pipe sizing or topology needs checking.'
      : input.hasOutdoorSpaceForHeatPump === false
      ? 'ASHP not feasible — no confirmed outdoor space for the unit.'
      : 'ASHP not currently feasible — hydraulic or topology barrier.',
    why: ashpWhy,
    requirements: ashpRequirements,
    evidenceIds: ashpEvidenceIds,
    heat: ashpHeat,
    dhw: ashpDhw,
    engineering: ashpEngineering,
    typedRequirements: ashpTypedReqs,
    sensitivities: buildSensitivities('ashp', core, input, combiDhwResult),
  });

  // ── Regular Vented / System Unvented (feasibility-only cards) ────────────
  const pressure = core.pressureAnalysis.dynamicBar;
  const staticPressure = core.pressureAnalysis.staticBar;
  const spaceOk = input.availableSpace === 'ok';
  const noSpaceForCylinder = input.availableSpace === 'none';
  const noLoftTankSpace = input.loftTankSpace === 'none';

  const regularStatus: OptionCardV1['status'] = hasFutureLoftConversion
    ? 'rejected'
    : (noSpaceForCylinder || noLoftTankSpace) ? 'rejected'
    : spaceOk ? 'viable'
    : 'caution';
  const regularWhy: string[] = [
    'Traditional open-vented system — relies on a header tank in the loft.',
  ];
  if (hasFutureLoftConversion) {
    regularWhy.push('Loft conversion eliminates space for header tank — not feasible.');
  } else if (noLoftTankSpace) {
    regularWhy.push('No loft tank space confirmed — CWS and F&E cisterns cannot be accommodated.');
  } else if (noSpaceForCylinder) {
    regularWhy.push('No cylinder space confirmed — hot water cylinder cannot be installed.');
  } else {
    regularWhy.push('Low mains pressure environment — tank-fed supply can still work.');
  }
  const regularRequirements: string[] = [
    'Loft must remain accessible and frost-free for header tank.',
    'Pressure at taps will be limited by head height — high-flow showers are designed with a dedicated pump.',
  ];
  if (input.futureAddBathroom) {
    regularRequirements.push('Adding a bathroom will increase demand — confirm vented system can meet peak flow.');
  }

  const regularHeat: OptionPlane = {
    status: 'ok',
    headline: 'Boiler wet-side heating. Same hydraulic physics as combi and system boiler.',
    bullets: [
      'High flow temperature (60–80°C) — compatible with existing radiators.',
      'Open-vented primary circuit: F&E header tank provides system headspace.',
      'Gravity-fed or pumped return — two-pipe configuration assumed.',
    ],
    evidenceIds: [],
  };

  const regularDhw: OptionPlane = {
    status: 'ok',
    headline: 'DHW: indirect stored cylinder via primary coil — tank-fed supply.',
    bullets: [
      'Hot water pressure limited by header tank head height (typically 1–2 bar).',
      'No mains pressure at taps — high-flow showers require a dedicated pump.',
      'Cylinder sizing is the primary control over DHW capacity.',
    ],
    evidenceIds: [],
  };

  const regularEngineering: OptionPlane = {
    status: hasFutureLoftConversion ? 'caution' : 'ok',
    headline: hasFutureLoftConversion
      ? 'Engineering: loft conversion blocks header tank — switch to sealed system.'
      : 'Engineering: loft space for F&E header tank is the key constraint.',
    bullets: [
      hasFutureLoftConversion
        ? 'F&E header tank cannot be accommodated — loft conversion conflict.'
        : 'F&E header tank required in loft: frost protection and access needed.',
      'Cylinder in airing cupboard or utility room — gravity head from loft.',
      input.futureAddBathroom
        ? 'Adding a bathroom will increase peak demand — confirm vented system can meet flow.'
        : 'No planned bathroom additions noted.',
    ],
    evidenceIds: [],
  };

  const regularTypedReqs: OptionRequirements = {
    complianceRequired: [
      'Cylinder thermostat for independent DHW temperature control.',
      'Programmer or timer for separate heating and hot water scheduling.',
    ],
    mustHave: hasFutureLoftConversion
      ? ['Loft conversion conflict: switch to sealed system boiler + unvented cylinder.']
      : ['Loft remains accessible and frost-free for F&E header tank.'],
    likelyUpgrades: [
      ...(input.futureAddBathroom ? ['Pump for shower pressure if adding bathroom.'] : []),
    ],
    niceToHave: ['Magnetic filter on primary return.', 'Smart programmer with weather compensation.'],
  };

  cards.push({
    id: 'regular_vented',
    label: 'Regular Boiler (Open Vented)',
    status: regularStatus,
    headline: regularStatus === 'viable'
      ? 'Regular vented system is feasible for your setup.'
      : regularStatus === 'caution'
      ? 'Regular vented system possible — confirm loft and space requirements.'
      : 'Regular vented system not suitable (loft conversion conflicts with header tank).',
    why: regularWhy,
    requirements: regularRequirements,
    evidenceIds: [],
    heat: regularHeat,
    dhw: regularDhw,
    engineering: regularEngineering,
    typedRequirements: regularTypedReqs,
    sensitivities: buildSensitivities('regular_vented', core, input, combiDhwResult),
  });

  // System / unvented: needs adequate mains pressure.
  // Status mirrors stored_unvented: use the full CWS operating-point gate (hasMeasurements +
  // meetsUnventedRequirement) when measurements are available, rather than dynamic pressure alone.
  // A 30 L/min @ 1.0 bar operating point meets the gate and should not be flagged as 'caution'.
  const sysUnventedCws = core.cwsSupplyV1;
  const unventedStatus: OptionCardV1['status'] =
    pressure < 1.0 ? 'rejected'
    : (sysUnventedCws.hasMeasurements && sysUnventedCws.meetsUnventedRequirement) ? 'viable'
    : pressure < 1.5 ? 'caution'
    : 'viable';
  const unventedWhy: string[] = [
    'Sealed system with unvented cylinder — mains-pressure hot water throughout.',
    operatingPointBullet(sysUnventedCws, pressure),
  ];
  if (sysUnventedCws.hasMeasurements && sysUnventedCws.meetsUnventedRequirement && pressure < 1.5) {
    if (strongOperatingPoint(sysUnventedCws)) {
      unventedWhy.push('Strong measured flow under load — mains-fed stored hot water is well supported.');
    } else if (limitedFlowOperatingPoint(sysUnventedCws)) {
      const flowLpm = sysUnventedCws.dynamic?.flowLpm ?? 0;
      unventedWhy.push(
        `Measured flow (${flowLpm} L/min) is workable for stored hot water ` +
        `but limited for simultaneous multi-outlet demand.`,
      );
    }
  }
  if (input.futureAddBathroom) {
    unventedWhy.push('Adding a bathroom increases simultaneous demand — cylinder sizing important.');
  }
  const unventedRequirements: string[] = [
    'Mains pressure ≥ 1.5 bar recommended for reliable performance.',
    'Unvented cylinder requires G3-qualified installer and annual servicing.',
  ];
  if (staticPressure !== undefined && staticPressure < 1.5 && !strongOperatingPoint(sysUnventedCws)) {
    unventedRequirements.push('💧 Standing pressure is low — a Mixergy cylinder is a better choice here, as it remains usable on weaker supplies where combi hot water can become unreliable or cut out.');
  }

  const unventedHeat: OptionPlane = {
    status: 'ok',
    headline: 'Boiler wet-side heating. Sealed system — no F&E header tank needed.',
    bullets: [
      'High flow temperature (60–80°C) — compatible with existing radiators.',
      'Sealed primary circuit: expansion vessel replaces header tank.',
      'Suitable for loft conversion properties where open-vented is blocked.',
    ],
    evidenceIds: [],
  };

  const unventedDhwIsStrong = pressure < 1.5 && strongOperatingPoint(sysUnventedCws);
  const unventedDhwIsLimited = limitedFlowOperatingPoint(sysUnventedCws);
  const unventedDhw: OptionPlane = {
    status: pressure < 1.0 ? 'caution' : (pressure < 1.5 && !unventedDhwIsStrong) ? 'caution' : 'ok',
    headline: pressure < 1.0
      ? '💧 DHW: mains pressure too low for a standard unvented cylinder — Mixergy or vented cylinder recommended.'
      : unventedDhwIsStrong
      ? 'DHW: mains-pressure stored hot water — strong measured flow supports delivery.'
      : pressure < 1.5
      ? 'DHW: borderline working pressure — verify mains standing pressure before specifying.'
      : unventedDhwIsLimited
      ? 'DHW: mains-pressure hot water — usable but limited for simultaneous multi-outlet demand.'
      : 'DHW: mains-pressure hot water — adequate flow for stored delivery.',
    bullets: [
      unventedDhwIsStrong
        ? `Measured operating point: ${(sysUnventedCws.dynamic?.flowLpm ?? 0).toFixed(0)} L/min @ ${pressure.toFixed(1)} bar — strong flow under load.`
        : unventedDhwIsLimited
        ? `Measured flow: ${(sysUnventedCws.dynamic?.flowLpm ?? 0).toFixed(0)} L/min — workable for stored hot water, but not strong for simultaneous high-demand draws.`
        : `Mains pressure: ${pressure.toFixed(1)} bar${pressure < 1.5 ? ' (borderline — min 1.5 bar recommended for standard unvented)' : ' (adequate)'}.`,
      'Unvented cylinder: mains-pressure hot water throughout — no shower pump needed.',
      'G3 regulation: tundish and discharge pipe required by Building Regulations.',
      ...(input.futureAddBathroom ? ['Adding a bathroom: confirm cylinder volume meets increased demand.'] : []),
      ...(unventedDhwIsLimited ? ['For heavy simultaneous demand, a tank-fed (vented) system may deliver more consistent flow.'] : []),
    ],
    evidenceIds: [],
  };

  const unventedEngineering: OptionPlane = {
    status: (staticPressure !== undefined && staticPressure < 1.5 && !strongOperatingPoint(sysUnventedCws)) ? 'caution' : 'ok',
    headline: 'Engineering: G3 compliance + discharge route are key constraints.',
    bullets: [
      'G3-qualified installer required — regulatory requirement for unvented cylinders.',
      'Tundish and discharge pipe to external drain required (typically 2× pipe size).',
      staticPressure !== undefined && staticPressure < 1.5 && strongOperatingPoint(sysUnventedCws)
        ? `Measured flow under load is strong — mains-fed stored hot water appears supportive despite low standing pressure.`
        : staticPressure !== undefined && staticPressure < 1.5
        ? '💧 Standing pressure below 1.5 bar — a Mixergy cylinder is more tolerant of weak supplies and can remain viable where a standard unvented would be borderline.'
        : '✅ Mains pressure is adequate for a standard unvented cylinder.',
      'Annual service required by regulation: PRV, expansion vessel, tundish check.',
    ],
    evidenceIds: [],
  };

  const unventedTypedReqs: OptionRequirements = {
    mustHave: [
      'G3-qualified installer.',
      'Tundish and discharge pipe routed to external drain.',
      ...(pressure < 1.0 ? ['⚠️ Mains pressure is very low — a Mixergy or vented cylinder is recommended instead.'] : []),
    ],
    likelyUpgrades: [
      ...(staticPressure !== undefined && staticPressure < 1.5 && !strongOperatingPoint(sysUnventedCws) ? ['💧 Consider a Mixergy cylinder — more tolerant of weak mains supply than a standard unvented; no minimum pressure gate in Atlas.'] : []),
      'Expansion vessel sized to cylinder volume.',
    ],
    niceToHave: [
      '💧 Mixergy cylinder for stratified DHW — more tolerant of weak mains supply, and reduces energy use.',
      'Smart immersion control for off-peak electricity pricing.',
    ],
  };

  cards.push({
    id: 'system_unvented',
    label: 'System Boiler + Unvented Cylinder',
    status: unventedStatus,
    headline: unventedStatus === 'viable' && pressure < 1.5
      ? 'System boiler + unvented cylinder suits your operating point — strong measured flow supports delivery.'
      : unventedStatus === 'viable'
      ? 'System boiler + unvented cylinder suits your pressure and demand.'
      : unventedStatus === 'caution'
      ? 'System + unvented possible but mains pressure is borderline.'
      : 'Unvented cylinder not suitable — mains pressure too low.',
    why: unventedWhy,
    requirements: unventedRequirements,
    evidenceIds: [],
    heat: unventedHeat,
    dhw: unventedDhw,
    engineering: unventedEngineering,
    typedRequirements: unventedTypedReqs,
    sensitivities: buildSensitivities('system_unvented', core, input, combiDhwResult),
  });

  // ── Attach confidence badges and delivery-mode requirements ─────────────
  const { confidence } = buildAssumptionsV1(core, input);

  // Derive the confidence badge label from the engine-level confidence level
  const confidenceBadgeLabel: Record<'high' | 'medium' | 'low', string> = {
    high:   'High confidence (measured)',
    medium: 'Medium confidence (assumed mains stability)',
    low:    'Low confidence (no flow test)',
  };

  for (const card of cards) {
    // ── Confidence badge — shown at top of every option card ──────────────
    card.confidenceBadge = {
      level: confidence.level,
      label: confidenceBadgeLabel[confidence.level],
    };

    // ── Inject delivery-mode requirements ─────────────────────────────────
    // Normalise legacy aliases before checking (matches CwsSupplyModule logic).
    const rawMode = input.dhwDeliveryMode ?? 'unknown';
    const deliveryMode =
      rawMode === 'tank_pumped' || rawMode === 'pumped' ? 'pumped_from_tank' : rawMode;

    if (deliveryMode === 'accumulator_supported') {
      const req = 'Accumulator vessel required; performance limited to stored volume during peaks.';
      if (!card.requirements.includes(req)) {
        card.requirements.push(req);
      }
    } else if (deliveryMode === 'break_tank_booster') {
      const req = 'Break tank + booster set required; space + overflow + controls + install complexity.';
      if (!card.requirements.includes(req)) {
        card.requirements.push(req);
      }
    }
  }

  return cards;
}
