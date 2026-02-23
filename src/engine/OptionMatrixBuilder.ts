import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { OptionCardV1, OptionPlane, OptionRequirements } from '../contracts/EngineOutputV1';

/**
 * Builds the Option Matrix V1 — a set of option cards derived from the
 * deterministic physics modules already computed in FullEngineResultCore.
 */
export function buildOptionMatrixV1(
  core: FullEngineResultCore,
  input: EngineInputV2_3,
): OptionCardV1[] {
  const cards: OptionCardV1[] = [];

  // ── Combi (Instantaneous) card ───────────────────────────────────────────
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
    combiWhy.push('Mains pressure is sufficient for instantaneous flow.');
  }

  const combiRequirements: string[] = [
    'Only works well when peak outlets = 1 (single bathroom in use).',
    'Move to stored cylinder if demand grows (second bathroom, higher occupancy).',
  ];
  if ((input.dynamicMainsPressure ?? 2.0) < 1.5) {
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
    'Instantaneous: no stored volume — heat delivery starts on demand.',
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
    likelyUpgrades: (input.dynamicMainsPressure ?? 2.0) < 1.5
      ? ['Mains pressure boost pump (< 1.5 bar detected).']
      : [],
    niceToHave: ['Nest/Hive smart thermostat for occupancy-led control.'],
  };

  cards.push({
    id: 'combi',
    label: 'Instantaneous (Combi)',
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
  });

  // ── Stored Cylinder card ─────────────────────────────────────────────────
  const storedRisk = core.storedDhwV1.verdict.storedRisk;
  const storedRejectedByTopology = (core.redFlags.rejectStored ?? core.redFlags.rejectVented) ?? false;

  let storedStatus: OptionCardV1['status'];
  if (storedRejectedByTopology) {
    storedStatus = 'rejected';
  } else if (storedRisk === 'warn') {
    storedStatus = 'caution';
  } else {
    storedStatus = 'viable';
  }

  const storedWhy: string[] = [
    'Solves simultaneity — hot water ready for multiple outlets at once.',
  ];
  for (const f of core.storedDhwV1.flags) {
    storedWhy.push(`${f.title}: ${f.detail}`);
  }

  const storedRequirements: string[] = [];
  const recType = core.storedDhwV1.recommended.type;
  if (input.availableSpace === 'tight') {
    storedRequirements.push('Space is tight — consider Mixergy cylinder (smaller effective footprint).');
  } else if (input.availableSpace === 'unknown') {
    storedRequirements.push('Confirm airing-cupboard / utility space for cylinder installation.');
  }
  if (recType === 'mixergy') {
    storedRequirements.push('Mixergy recommended: stratified heating reduces gas use and effective tank size needed.');
  }

  const storedEvidenceIds = core.storedDhwV1.flags.map(f => f.id);

  const storedHeat: OptionPlane = {
    status: 'ok',
    headline: 'Boiler wet-side heating. Identical hydraulic physics to combi and regular boiler.',
    bullets: [
      'High flow temperature (60–80°C) — compatible with existing radiators.',
      'Primary circuit fully isolated from DHW — no stop/start cycling impact on heat.',
      'Condensing efficiency preserved: primary return stays below 55°C.',
    ],
    evidenceIds: [],
  };

  const storedDhwBullets: string[] = [
    'Stored volume handles simultaneous draw from multiple outlets.',
    `Recommended cylinder type: ${recType === 'mixergy' ? 'Mixergy (stratified)' : 'standard indirect'}.`,
  ];
  for (const f of core.storedDhwV1.flags) {
    storedDhwBullets.push(`${f.title}: ${f.detail}`);
  }
  const storedDhw: OptionPlane = {
    status: storedRisk === 'warn' ? 'caution' : 'ok',
    headline: storedRisk === 'warn'
      ? 'DHW: caution — space or demand flags require attention.'
      : 'DHW: stored volume suits your demand profile.',
    bullets: storedDhwBullets,
    evidenceIds: storedEvidenceIds,
  };

  const storedEngineering: OptionPlane = {
    status: storedRejectedByTopology ? 'caution' : input.availableSpace === 'tight' ? 'caution' : 'ok',
    headline: storedRejectedByTopology
      ? 'Engineering: loft or structural constraints block standard vented installation.'
      : 'Engineering: cylinder space and gravity/pump requirements.',
    bullets: [
      input.availableSpace === 'tight'
        ? 'Space is tight — Mixergy or slimline cylinder may fit where standard cannot.'
        : input.availableSpace === 'ok'
        ? 'Adequate airing-cupboard or utility space for cylinder.'
        : 'Confirm cylinder space before proceeding.',
      'Indirect cylinder requires primary flow/return connections to boiler.',
      storedRejectedByTopology
        ? 'Loft conversion removes header tank space — sealed system (system boiler) required instead.'
        : 'Loft headspace available for F&E header tank if open-vented system used.',
    ],
    evidenceIds: [],
  };

  const storedTypedReqs: OptionRequirements = {
    mustHave: storedRejectedByTopology
      ? ['Loft constraint must be resolved — consider system boiler + unvented cylinder instead.']
      : ['Confirm cylinder location and space before ordering.'],
    likelyUpgrades: recType === 'mixergy'
      ? ['Mixergy cylinder upgrade — stratified heating for reduced gas use and smaller footprint.']
      : input.availableSpace === 'unknown'
      ? ['Space survey to confirm airing-cupboard / utility room dimensions.']
      : [],
    niceToHave: ['Immersion heater backup for resilience.', 'Solar thermal pre-heat coil (if south-facing roof).'],
  };

  cards.push({
    id: 'stored',
    label: 'Stored Cylinder',
    status: storedStatus,
    headline: storedStatus === 'viable'
      ? 'Stored cylinder is a strong fit for your demand profile.'
      : storedStatus === 'caution'
      ? 'Stored cylinder viable but check space and cylinder sizing.'
      : 'Stored cylinder not suitable (check loft / structural constraints).',
    why: storedWhy,
    requirements: storedRequirements,
    evidenceIds: storedEvidenceIds,
    heat: storedHeat,
    dhw: storedDhw,
    engineering: storedEngineering,
    typedRequirements: storedTypedReqs,
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
    headline: 'DHW: stored cylinder required — ASHP cannot provide instantaneous hot water.',
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
  });

  // ── Regular Vented / System Unvented (feasibility-only cards) ────────────
  const hasFutureLoftConversion = input.futureLoftConversion ?? input.hasLoftConversion ?? false;
  const pressure = input.dynamicMainsPressure ?? 2.0;
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
    'Pressure at taps will be limited by head height — power shower may need pump.',
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
      'No mains pressure at taps — power shower requires dedicated pump.',
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
  });

  return cards;
}
