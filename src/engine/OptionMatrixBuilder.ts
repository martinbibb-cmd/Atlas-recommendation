import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { OptionCardV1, OptionPlane, OptionRequirements, SensitivityItem } from '../contracts/EngineOutputV1';
import { scoreOptionV1 } from './OptionScoringV1';
import { buildAssumptionsV1 } from './AssumptionsBuilder';

// ── Sensitivities builder ─────────────────────────────────────────────────────

function buildSensitivities(
  optionId: OptionCardV1['id'],
  core: FullEngineResultCore,
  input: EngineInputV2_3,
): SensitivityItem[] {
  const items: SensitivityItem[] = [];
  const { hydraulicV1, combiDhwV1, storedDhwV1, pressureAnalysis } = core;
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
    if (combiDhwV1.verdict.combiRisk === 'fail' || combiDhwV1.verdict.combiRisk === 'warn') {
      items.push({
        lever: 'Peak outlets at once',
        effect: 'upgrade',
        note: 'If peak simultaneous outlets were confirmed at 1 (single bathroom in use at a time), combi viability would improve significantly.',
      });
      if (pressure < 1.5) {
        items.push({
          lever: 'Mains pressure',
          effect: 'upgrade',
          note: `If mains pressure were boosted to ≥ 1.5 bar (currently ${pressure.toFixed(1)} bar), combi DHW flow would meet minimum performance threshold.`,
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
    const recType = storedDhwV1.recommended.type;
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
        note: `If mains pressure were boosted to ≥ 1.0 bar (currently ${pressure.toFixed(1)} bar), an unvented cylinder would become viable.`,
      });
    } else if (pressure < 1.5) {
      items.push({
        lever: 'Mains pressure',
        effect: 'upgrade',
        note: `If mains pressure reached ≥ 1.5 bar (currently ${pressure.toFixed(1)} bar), unvented cylinder would move from caution to viable — a boost pump may be sufficient.`,
      });
    } else {
      items.push({
        lever: 'Mains pressure',
        effect: 'downgrade',
        note: `If mains pressure dropped below 1.5 bar, unvented cylinder would require a boost pump. Below 1.0 bar it would be rejected.`,
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
        note: `If mains pressure were boosted to ≥ 1.5 bar (currently ${pressure.toFixed(1)} bar), an unvented cylinder would become viable.`,
      });
    } else if (pressure < 1.5) {
      items.push({
        lever: 'Mains pressure',
        effect: 'upgrade',
        note: `If mains pressure reached ≥ 1.5 bar (currently ${pressure.toFixed(1)} bar), unvented cylinder would move from caution to viable — a boost pump may be sufficient.`,
      });
    } else {
      items.push({
        lever: 'Mains pressure',
        effect: 'downgrade',
        note: `If mains pressure dropped below 1.5 bar, unvented cylinder would require a boost pump. Below 1.0 bar it would be rejected.`,
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
  const combiRisk = core.combiDhwV1.verdict.combiRisk;
  const combiRejectedByTopology = core.redFlags.rejectCombi ?? false;

  let combiStatus: OptionCardV1['status'];
  if (combiRejectedByTopology || combiRisk === 'fail') {
    combiStatus = 'rejected';
  } else if (combiRisk === 'warn') {
    combiStatus = 'caution';
  } else {
    combiStatus = 'viable';
  }

  const combiWhy: string[] = [];
  if (combiRejectedByTopology) {
    combiWhy.push('Topology prevents combi installation (one-pipe or similar).');
  }
  for (const f of core.combiDhwV1.flags) {
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
  if ((core.pressureAnalysis.dynamicBar) < 1.5) {
    combiRequirements.push('Mains pressure boost may be required (< 1.5 bar detected).');
  }

  const combiEvidenceIds = core.combiDhwV1.flags.map(f => f.id);

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
  for (const f of core.combiDhwV1.flags) {
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

  const combiTypedReqs: OptionRequirements = {
    mustHave: combiRisk === 'fail' || combiRejectedByTopology
      ? ['Resolve pressure/topology barrier before installation.']
      : ['Confirm peak simultaneous outlets = 1.'],
    likelyUpgrades: core.pressureAnalysis.dynamicBar < 1.5
      ? ['Mains pressure boost pump (< 1.5 bar detected).']
      : [],
    niceToHave: ['Nest/Hive smart thermostat for occupancy-led control.'],
  };

  cards.push({
    id: 'combi',
    label: 'On Demand (Combi)',
    status: combiStatus,
    headline: combiStatus === 'viable'
      ? 'Combi boiler suits your single-outlet demand.'
      : combiStatus === 'caution'
      ? 'Combi possible but demand is borderline.'
      : 'Combi not suitable — simultaneous demand or pressure issue.',
    why: combiWhy,
    requirements: combiRequirements,
    evidenceIds: combiEvidenceIds,
    heat: combiHeat,
    dhw: combiDhw,
    engineering: combiEngineering,
    typedRequirements: combiTypedReqs,
    sensitivities: buildSensitivities('combi', core, input),
  });

  // ── Stored hot water — Vented cylinder card ─────────────────────────────
  const storedRisk = core.storedDhwV1.verdict.storedRisk;

  let storedVentedStatus: OptionCardV1['status'];
  if (hasFutureLoftConversion) {
    storedVentedStatus = 'caution';
  } else if (storedRisk === 'warn' || input.availableSpace === 'tight') {
    storedVentedStatus = 'caution';
  } else {
    storedVentedStatus = 'viable';
  }

  const storedVentedWhy: string[] = [
    'Solves simultaneity — hot water ready for multiple outlets at once.',
    'Tank-fed / gravity or pumped capable — does not rely on mains pressure.',
  ];
  for (const f of core.storedDhwV1.flags) {
    storedVentedWhy.push(`${f.title}: ${f.detail}`);
  }
  if (hasFutureLoftConversion) {
    storedVentedWhy.push('Loft conversion planned — CWS and F&E header tanks may lose their space.');
  }

  const recType = core.storedDhwV1.recommended.type;
  const storedVentedRequirements: string[] = [
    'Loft tanks required (CWS + F&E) unless converting to sealed/unvented.',
  ];
  if (input.availableSpace === 'tight') {
    storedVentedRequirements.push('Space is tight — consider Mixergy cylinder (smaller effective footprint).');
  } else if (input.availableSpace === 'unknown') {
    storedVentedRequirements.push('Confirm airing-cupboard / utility space for cylinder installation.');
  }
  if (recType === 'mixergy') {
    storedVentedRequirements.push('Mixergy recommended: stratified heating reduces gas use and effective tank size needed.');
  }

  const storedEvidenceIds = core.storedDhwV1.flags.map(f => f.id);

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
  for (const f of core.storedDhwV1.flags) {
    storedVentedDhwBullets.push(`${f.title}: ${f.detail}`);
  }
  const storedVentedDhw: OptionPlane = {
    status: storedRisk === 'warn' ? 'caution' : 'ok',
    headline: storedRisk === 'warn'
      ? 'DHW: caution — space or demand flags require attention.'
      : 'DHW: stored volume suits your demand profile.',
    bullets: storedVentedDhwBullets,
    evidenceIds: storedEvidenceIds,
  };

  const storedVentedEngineering: OptionPlane = {
    status: hasFutureLoftConversion ? 'caution' : input.availableSpace === 'tight' ? 'caution' : 'ok',
    headline: hasFutureLoftConversion
      ? 'Engineering: loft conversion conflicts with CWS/F&E header tanks.'
      : 'Engineering: loft tanks + cylinder space are key constraints.',
    bullets: [
      hasFutureLoftConversion
        ? 'Planned loft conversion removes header tank space — switch to sealed unvented system.'
        : 'Loft headspace required for CWS and F&E header tanks.',
      input.availableSpace === 'tight'
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
      : storedVentedStatus === 'caution'
      ? 'Vented cylinder viable but check loft space and cylinder sizing.'
      : 'Vented cylinder not suitable (loft conversion conflicts with header tanks).',
    why: storedVentedWhy,
    requirements: storedVentedRequirements,
    evidenceIds: storedEvidenceIds,
    heat: storedVentedHeat,
    dhw: storedVentedDhw,
    engineering: storedVentedEngineering,
    typedRequirements: storedVentedTypedReqs,
    sensitivities: buildSensitivities('stored_vented', core, input),
  });

  // ── Stored hot water — Unvented cylinder card ────────────────────────────
  const { cwsSupplyV1 } = core;
  const mainsPressure = core.pressureAnalysis.dynamicBar;

  let storedUnventedStatus: OptionCardV1['status'];
  if (mainsPressure < 1.0) {
    storedUnventedStatus = 'rejected';
  } else if (!cwsSupplyV1.hasMeasurements) {
    storedUnventedStatus = 'caution';
  } else if (cwsSupplyV1.quality === 'weak') {
    storedUnventedStatus = 'caution';
  } else {
    storedUnventedStatus = 'viable';
  }

  const storedUnventedWhy: string[] = [
    'Mains-pressure hot water throughout — no shower pump required.',
    `Sealed circuit. System boiler typical; regular possible with external pump/expansion.`,
    `Detected mains pressure: ${mainsPressure.toFixed(1)} bar.`,
  ];
  if (mainsPressure < 1.0) {
    storedUnventedWhy.push('Mains pressure too low for unvented cylinder (< 1.0 bar).');
  } else if (!cwsSupplyV1.hasMeasurements) {
    storedUnventedWhy.push('Mains supply not fully characterised — need L/min @ bar measurement.');
  } else if (cwsSupplyV1.quality === 'weak') {
    storedUnventedWhy.push('Mains supply is weak — performance may be inadequate for unvented cylinder.');
  }
  for (const f of core.storedDhwV1.flags) {
    storedUnventedWhy.push(`${f.title}: ${f.detail}`);
  }

  const storedUnventedRequirements: string[] = [
    'Mains pressure ≥ 1.0 bar required; ≥ 1.5 bar recommended for reliable performance.',
    'Unvented cylinder requires G3-qualified installer and annual servicing.',
    'Sealed circuit — no loft tanks required.',
  ];
  if (!cwsSupplyV1.hasMeasurements) {
    storedUnventedRequirements.push('Measure mains flow (L/min) and pressure (bar) before specifying cylinder.');
  }
  if (mainsPressure < 1.5 && mainsPressure >= 1.0) {
    storedUnventedRequirements.push('Pressure boost pump may be required before installation.');
  }
  if (recType === 'mixergy') {
    storedUnventedRequirements.push('Mixergy recommended: stratified heating reduces gas use and effective tank size needed.');
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
    `Mains-pressure DHW: ${mainsPressure.toFixed(1)} bar${mainsPressure < 1.5 ? ' (borderline — min 1.5 bar recommended)' : ' (adequate)'}.`,
    `Recommended cylinder type: ${recType === 'mixergy' ? 'Mixergy (stratified)' : 'standard indirect'}.`,
  ];
  if (!cwsSupplyV1.hasMeasurements) {
    storedUnventedDhwBullets.push('Mains supply not fully characterised — measure L/min @ bar before specifying.');
  } else if (cwsSupplyV1.quality === 'weak') {
    storedUnventedDhwBullets.push('Mains supply is weak — consider pressure boost before cylinder.');
  }
  for (const f of core.storedDhwV1.flags) {
    storedUnventedDhwBullets.push(`${f.title}: ${f.detail}`);
  }
  const storedUnventedDhw: OptionPlane = {
    status: mainsPressure < 1.0 ? 'caution' : (!cwsSupplyV1.hasMeasurements || cwsSupplyV1.quality === 'weak') ? 'caution' : 'ok',
    headline: mainsPressure < 1.0
      ? 'DHW: mains pressure too low for unvented cylinder.'
      : !cwsSupplyV1.hasMeasurements
      ? 'DHW: mains supply not characterised — need L/min @ bar measurement.'
      : cwsSupplyV1.quality === 'weak'
      ? 'DHW: weak mains supply — boost pump likely required.'
      : 'DHW: mains-pressure stored hot water — good flow at all outlets.',
    bullets: storedUnventedDhwBullets,
    evidenceIds: storedEvidenceIds,
  };

  const storedUnventedEngineering: OptionPlane = {
    status: mainsPressure < 1.5 ? 'caution' : 'ok',
    headline: 'Engineering: G3 compliance + discharge route are key constraints.',
    bullets: [
      'G3-qualified installer required — regulatory requirement for unvented cylinders.',
      'Tundish and discharge pipe to external drain required (typically 2× pipe size).',
      mainsPressure < 1.5
        ? 'Pressure below 1.5 bar — pressure boost pump likely required before cylinder.'
        : 'Mains pressure adequate — no boost pump needed.',
      'Annual service required by regulation: PRV, expansion vessel, tundish check.',
    ],
    evidenceIds: [],
  };

  const storedUnventedTypedReqs: OptionRequirements = {
    mustHave: [
      'G3-qualified installer.',
      'Tundish and discharge pipe routed to external drain.',
      ...(mainsPressure < 1.0 ? ['Mains pressure must be resolved — too low for unvented cylinder.'] : []),
      ...(!cwsSupplyV1.hasMeasurements ? ['Measure mains flow (L/min) and pressure (bar) before specifying.'] : []),
    ],
    likelyUpgrades: [
      ...(mainsPressure < 1.5 && mainsPressure >= 1.0 ? ['Pressure boost pump before cylinder inlet.'] : []),
      'Expansion vessel sized to cylinder volume.',
    ],
    niceToHave: [
      'Mixergy cylinder for stratified DHW and reduced heat-up time.',
      'Smart immersion control for off-peak electricity pricing.',
    ],
  };

  cards.push({
    id: 'stored_unvented',
    label: 'Stored hot water — Unvented cylinder',
    status: storedUnventedStatus,
    headline: storedUnventedStatus === 'viable'
      ? 'Unvented cylinder suits your mains pressure and demand.'
      : storedUnventedStatus === 'caution'
      ? 'Unvented cylinder possible — confirm mains supply measurements.'
      : 'Unvented cylinder not suitable — mains pressure too low.',
    why: storedUnventedWhy,
    requirements: storedUnventedRequirements,
    evidenceIds: storedEvidenceIds,
    heat: storedUnventedHeat,
    dhw: storedUnventedDhw,
    engineering: storedUnventedEngineering,
    typedRequirements: storedUnventedTypedReqs,
    sensitivities: buildSensitivities('stored_unvented', core, input),
  });

  // ── ASHP card ────────────────────────────────────────────────────────────
  const ashpRisk = core.hydraulicV1.verdict.ashpRisk;
  const ashpRejectedByTopology = core.redFlags.rejectAshp ?? false;

  let ashpStatus: OptionCardV1['status'];
  if (ashpRejectedByTopology || ashpRisk === 'fail') {
    ashpStatus = 'rejected';
  } else if (ashpRisk === 'warn' || (core.redFlags.flagAshp ?? false)) {
    ashpStatus = 'caution';
  } else {
    ashpStatus = 'viable';
  }

  const { ashp, boiler } = core.hydraulicV1;
  const ashpWhy: string[] = [
    `ΔT 5°C requires ~${(ashp.flowLpm / boiler.flowLpm).toFixed(1)}× boiler flow rate (${ashp.flowLpm.toFixed(1)} L/min vs ${boiler.flowLpm.toFixed(1)} L/min).`,
  ];
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
      : 'ASHP not currently feasible — hydraulic or topology barrier.',
    why: ashpWhy,
    requirements: ashpRequirements,
    evidenceIds: ashpEvidenceIds,
    heat: ashpHeat,
    dhw: ashpDhw,
    engineering: ashpEngineering,
    typedRequirements: ashpTypedReqs,
    sensitivities: buildSensitivities('ashp', core, input),
  });

  // ── Regular Vented / System Unvented (feasibility-only cards) ────────────
  const pressure = core.pressureAnalysis.dynamicBar;
  const spaceOk = input.availableSpace === 'ok';

  const regularStatus: OptionCardV1['status'] = hasFutureLoftConversion ? 'rejected' : spaceOk ? 'viable' : 'caution';
  const regularWhy: string[] = [
    'Traditional open-vented system — relies on a header tank in the loft.',
  ];
  if (hasFutureLoftConversion) {
    regularWhy.push('Loft conversion eliminates space for header tank — not feasible.');
  } else {
    regularWhy.push('Low mains pressure environment — gravity-fed system can still work.');
  }
  const regularRequirements: string[] = [
    'Loft must remain accessible and frost-free for header tank.',
    'Pressure at taps will be limited by head height — high-flow showers may need a dedicated pump.',
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
    headline: 'DHW: indirect stored cylinder via primary coil — gravity-fed pressure.',
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
    mustHave: hasFutureLoftConversion
      ? ['Loft conversion conflict: switch to sealed system boiler + unvented cylinder.']
      : ['Loft remains accessible and frost-free for F&E header tank.'],
    likelyUpgrades: [
      'Cylinder thermostat + programmer for independent DHW control.',
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
    sensitivities: buildSensitivities('regular_vented', core, input),
  });

  // System / unvented: needs adequate mains pressure
  const unventedStatus: OptionCardV1['status'] = pressure < 1.0 ? 'rejected' : pressure < 1.5 ? 'caution' : 'viable';
  const unventedWhy: string[] = [
    'Sealed system with unvented cylinder — mains-pressure hot water throughout.',
    `Detected mains pressure: ${pressure.toFixed(1)} bar.`,
  ];
  if (input.futureAddBathroom) {
    unventedWhy.push('Adding a bathroom increases simultaneous demand — cylinder sizing important.');
  }
  const unventedRequirements: string[] = [
    'Mains pressure ≥ 1.5 bar recommended for reliable performance.',
    'Unvented cylinder requires G3-qualified installer and annual servicing.',
  ];
  if (pressure < 1.5) {
    unventedRequirements.push('Pressure boost pump may be required before installation.');
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

  const unventedDhw: OptionPlane = {
    status: pressure < 1.0 ? 'caution' : pressure < 1.5 ? 'caution' : 'ok',
    headline: pressure < 1.0
      ? 'DHW: mains pressure too low for unvented cylinder.'
      : pressure < 1.5
      ? 'DHW: borderline mains pressure — may require boost pump.'
      : 'DHW: mains-pressure hot water — good flow at all outlets.',
    bullets: [
      `Mains pressure: ${pressure.toFixed(1)} bar${pressure < 1.5 ? ' (borderline — min 1.5 bar recommended)' : ' (adequate)'}.`,
      'Unvented cylinder: mains-pressure DHW — eliminates need for shower pump.',
      'G3 regulation: tundish and discharge pipe required by Building Regulations.',
      ...(input.futureAddBathroom ? ['Additional bathroom: confirm cylinder volume meets increased simultaneous demand.'] : []),
    ],
    evidenceIds: [],
  };

  const unventedEngineering: OptionPlane = {
    status: pressure < 1.5 ? 'caution' : 'ok',
    headline: 'Engineering: G3 compliance + discharge route are key constraints.',
    bullets: [
      'G3-qualified installer required — regulatory requirement for unvented cylinders.',
      'Tundish and discharge pipe to external drain required (typically 2× pipe size).',
      pressure < 1.5
        ? 'Pressure below 1.5 bar — pressure boost pump likely required before cylinder.'
        : 'Mains pressure adequate — no boost pump needed.',
      'Annual service required by regulation: PRV, expansion vessel, tundish check.',
    ],
    evidenceIds: [],
  };

  const unventedTypedReqs: OptionRequirements = {
    mustHave: [
      'G3-qualified installer.',
      'Tundish and discharge pipe routed to external drain.',
      ...(pressure < 1.0 ? ['Mains pressure must be resolved — too low for unvented cylinder.'] : []),
    ],
    likelyUpgrades: [
      ...(pressure < 1.5 ? ['Pressure boost pump before cylinder inlet.'] : []),
      'Expansion vessel sized to cylinder volume.',
    ],
    niceToHave: [
      'Mixergy cylinder for stratified DHW and reduced heat-up time.',
      'Smart immersion control for off-peak electricity pricing.',
    ],
  };

  cards.push({
    id: 'system_unvented',
    label: 'System Boiler + Unvented Cylinder',
    status: unventedStatus,
    headline: unventedStatus === 'viable'
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
    sensitivities: buildSensitivities('system_unvented', core, input),
  });

  // ── Score all option cards ────────────────────────────────────────────────
  const { confidence, assumptions } = buildAssumptionsV1(core, input);
  for (const card of cards) {
    card.score = scoreOptionV1(core, input, card, confidence, assumptions);
  }

  return cards;
}
