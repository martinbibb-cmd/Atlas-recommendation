import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { OptionCardV1 } from '../contracts/EngineOutputV1';

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
  });

  // ── Regular Vented / System Unvented (feasibility-only cards) ────────────
  // hasFutureLoftConversion is true if a loft conversion is planned or already
  // completed, since both cases eliminate space for a header tank.
  const hasFutureLoftConversion = input.futureLoftConversion ?? input.hasLoftConversion ?? false;
  const pressure = input.dynamicMainsPressure ?? 2.0;
  const spaceOk = input.availableSpace === 'ok';

  // Regular vented: needs loft space for header tank — rejected if loft conversion planned
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
  });

  return cards;
}
