/**
 * buildSurveyEvidenceForCustomerPackV1.ts
 *
 * Adapter: maps raw survey fields into named evidence groups for use in
 * customer-facing packs.
 *
 * Rules:
 *   - Never throws. Missing or null fields produce clean evidence groups with
 *     evidencePresent === false.
 *   - Home-specific facts are derived from actual survey data only.
 *   - Generic fallback copy is a true last resort — only emitted when the
 *     corresponding survey field was not captured.
 *   - Protection and system-condition claims (e.g. "no debris noted") are
 *     gated: only emitted when explicit positive evidence exists.
 *   - Confirmed measured flow readings (mainsDynamicFlowLpmKnown === true)
 *     are the only flow readings promoted to mains supply facts.
 */

import type {
  SurveyEvidenceAdapterInputV1,
  SurveyEvidenceForCustomerPackV1,
  SurveyEvidenceGroupV1,
  SurveyEvidenceSpecificityScoreV1,
} from './SurveyEvidenceForCustomerPackV1';

// ─── Group helpers ────────────────────────────────────────────────────────────

function group(facts: string[], fallback: string): SurveyEvidenceGroupV1 {
  return {
    evidencePresent: facts.length > 0,
    facts,
    genericFallback: fallback,
  };
}

function isKnown<T>(value: T | null | undefined): value is Exclude<T, null | undefined> {
  return value != null;
}

function totalOccupants(input: SurveyEvidenceAdapterInputV1): number | null {
  const comp = input.usage?.composition;
  if (!comp) return null;
  const total =
    (comp.adultCount ?? 0) +
    (comp.youngAdultCount18to25AtHome ?? 0) +
    (comp.childCount0to4 ?? 0) +
    (comp.childCount5to10 ?? 0) +
    (comp.childCount11to17 ?? 0);
  return total > 0 ? total : null;
}

function adultCount(input: SurveyEvidenceAdapterInputV1): number {
  const comp = input.usage?.composition;
  if (!comp) return 0;
  return (comp.adultCount ?? 0) + (comp.youngAdultCount18to25AtHome ?? 0);
}

function childCount(input: SurveyEvidenceAdapterInputV1): number {
  const comp = input.usage?.composition;
  if (!comp) return 0;
  return (comp.childCount0to4 ?? 0) + (comp.childCount5to10 ?? 0) + (comp.childCount11to17 ?? 0);
}

// ─── Evidence group builders ─────────────────────────────────────────────────

function buildOccupancyGroup(input: SurveyEvidenceAdapterInputV1): SurveyEvidenceGroupV1 {
  const facts: string[] = [];
  const usage = input.usage;

  const adults = adultCount(input);
  const children = childCount(input);
  const total = adults + children;

  if (total > 0) {
    if (children === 0 && total === 1) {
      facts.push('This is a single-person home.');
    } else if (children === 0) {
      facts.push(`This home has ${total} adults.`);
    } else {
      facts.push(
        `This home has ${total} occupant${total !== 1 ? 's' : ''} — ` +
          `${adults} adult${adults !== 1 ? 's' : ''} and ` +
          `${children} child${children !== 1 ? 'ren' : ''}.`,
      );
    }
  }

  if (isKnown(usage?.daytimeOccupancy) && usage!.daytimeOccupancy !== 'unknown') {
    switch (usage!.daytimeOccupancy) {
      case 'usually_out':
        facts.push(
          'Occupants are usually out during the day — morning and evening peaks drive demand.',
        );
        break;
      case 'usually_home':
        facts.push(
          'At least one occupant is typically home during the day, spreading demand more evenly.',
        );
        break;
      case 'irregular':
        facts.push('Daytime occupancy is irregular, so demand timing may vary week to week.');
        break;
    }
  }

  if (isKnown(usage?.bathUse) && usage!.bathUse !== 'unknown') {
    switch (usage!.bathUse) {
      case 'rare':
        facts.push('Baths are rarely used — shower demand drives hot water sizing.');
        break;
      case 'sometimes':
        facts.push(
          'Baths are taken occasionally — hot water volume includes allowance for intermittent bath fills.',
        );
        break;
      case 'frequent':
        facts.push(
          'Baths are taken regularly — cylinder volume and recovery time are sized to support frequent full bath fills.',
        );
        break;
    }
  }

  return group(facts, 'Occupancy details were not captured during this survey.');
}

function buildSimultaneousDemandGroup(
  input: SurveyEvidenceAdapterInputV1,
): SurveyEvidenceGroupV1 {
  const facts: string[] = [];
  const bathroomCount = input.usage?.bathroomCount;
  const occupants = totalOccupants(input);

  if (!isKnown(bathroomCount) || bathroomCount <= 0) {
    return group(
      facts,
      'Bathroom count and simultaneous demand were not assessed during this survey.',
    );
  }

  const bathWord = bathroomCount === 1 ? 'one bathroom' : `${bathroomCount} bathrooms`;
  const occupantWord = occupants === null
    ? null
    : occupants === 1
      ? 'one occupant'
      : `${occupants} occupants`;

  // Low demand — supports combi
  if (bathroomCount === 1 && (occupants === null || occupants <= 2)) {
    const prefix = occupantWord
      ? `With ${bathWord} and ${occupantWord}, simultaneous`
      : `With ${bathWord}, simultaneous`;
    facts.push(
      `${prefix} hot water demand is low — this supports a combi boiler without a separate storage cylinder.`,
    );
  // Elevated demand — supports stored hot water
  } else if (bathroomCount >= 2 || (occupants !== null && occupants >= 3)) {
    const prefix = occupantWord
      ? `With ${bathWord} and ${occupantWord}, simultaneous`
      : `With ${bathWord}, simultaneous`;
    facts.push(
      `${prefix} hot water demand is elevated — stored hot water provides more reliable peak-demand cover.`,
    );
  } else {
    facts.push(
      `This home has ${bathWord}${occupantWord ? ` and ${occupantWord}` : ''}.`,
    );
  }

  return group(
    facts,
    'Bathroom count and simultaneous demand were not assessed during this survey.',
  );
}

function buildMainsSupplyGroup(input: SurveyEvidenceAdapterInputV1): SurveyEvidenceGroupV1 {
  const facts: string[] = [];
  const mains = input.mainsSupply;

  if (isKnown(mains?.staticMainsPressureBar) && mains!.staticMainsPressureBar! > 0) {
    facts.push(
      `Static mains pressure measured at ${mains!.staticMainsPressureBar!.toFixed(1)} bar (taps closed).`,
    );
  }

  if (isKnown(mains?.dynamicMainsPressureBar) && mains!.dynamicMainsPressureBar! > 0) {
    facts.push(
      `Dynamic mains pressure measured at ${mains!.dynamicMainsPressureBar!.toFixed(1)} bar.`,
    );
  }

  // Only promote confirmed measured flow readings
  if (
    isKnown(mains?.mainsDynamicFlowLpm) &&
    mains!.mainsDynamicFlowLpm! > 0 &&
    mains!.mainsDynamicFlowLpmKnown === true
  ) {
    facts.push(
      `Mains flow rate confirmed at ${mains!.mainsDynamicFlowLpm!.toFixed(1)} L/min.`,
    );
  }

  return group(
    facts,
    'Mains pressure and flow rate were not recorded during this survey.',
  );
}

function buildExistingHotWaterTypeGroup(
  input: SurveyEvidenceAdapterInputV1,
): SurveyEvidenceGroupV1 {
  const facts: string[] = [];
  const sb = input.systemBuilder;

  const heatSource = sb?.heatSource;
  const dhwType = sb?.dhwType;

  if (!isKnown(heatSource)) {
    return group(facts, 'Existing hot water system type was not captured during this survey.');
  }

  switch (heatSource) {
    case 'combi':
      facts.push(
        'Existing system: combi boiler — hot water is produced on demand with no separate storage cylinder.',
      );
      break;
    case 'regular':
      if (dhwType === 'open_vented') {
        facts.push(
          'Existing system: regular boiler with an open-vented (gravity-fed) hot water cylinder.',
        );
      } else {
        facts.push('Existing system: regular boiler with a separate hot water cylinder.');
      }
      break;
    case 'system':
      if (dhwType === 'unvented') {
        facts.push(
          'Existing system: system boiler with an unvented (mains-pressure) hot water cylinder.',
        );
      } else if (dhwType === 'thermal_store') {
        facts.push('Existing system: system boiler with a thermal store.');
      } else {
        facts.push('Existing system: system boiler with a separate hot water cylinder.');
      }
      break;
    case 'storage_combi':
      facts.push(
        'Existing system: storage combi boiler — combines on-demand and small-volume stored hot water.',
      );
      break;
  }

  return group(facts, 'Existing hot water system type was not captured during this survey.');
}

function buildExistingHeatingTypeGroup(
  input: SurveyEvidenceAdapterInputV1,
): SurveyEvidenceGroupV1 {
  const facts: string[] = [];
  const sb = input.systemBuilder;

  if (!isKnown(sb?.heatSource)) {
    return group(facts, 'Existing heating type was not captured during this survey.');
  }

  const sourceLabels: Record<string, string> = {
    combi: 'combi boiler',
    regular: 'regular (heat-only) boiler',
    system: 'system boiler',
    storage_combi: 'storage combi boiler',
  };
  const sourceLabel = sourceLabels[sb!.heatSource!] ?? 'heating appliance';
  facts.push(`Current heat source: ${sourceLabel}.`);

  if (isKnown(sb?.heatingSystemType) && sb!.heatingSystemType !== 'unknown') {
    switch (sb!.heatingSystemType) {
      case 'open_vented':
        facts.push(
          'Heating circuit is open-vented — conversion to a sealed system may be required for certain upgrades.',
        );
        break;
      case 'sealed':
        facts.push('Heating circuit is a sealed system.');
        break;
    }
  }

  return group(facts, 'Existing heating type was not captured during this survey.');
}

function buildEmitterSuitabilityGroup(
  input: SurveyEvidenceAdapterInputV1,
): SurveyEvidenceGroupV1 {
  const facts: string[] = [];
  const sb = input.systemBuilder;

  if (!isKnown(sb?.emitters)) {
    return group(facts, 'Emitter type was not assessed during this survey.');
  }

  switch (sb!.emitters) {
    case 'radiators_standard':
      facts.push('Standard radiators are fitted throughout the property.');
      break;
    case 'radiators_designer':
      facts.push('Designer radiators are fitted — flow temperature compatibility to be confirmed during system design.');
      break;
    case 'underfloor':
      facts.push(
        'Underfloor heating is fitted — this requires low flow temperatures and is well suited to heat pump operation.',
      );
      break;
    case 'mixed':
      facts.push(
        'A mix of radiators and underfloor heating is fitted — emitter assessment is required before confirming flow temperature.',
      );
      break;
  }

  if (isKnown(sb?.primarySize) && sb!.primarySize !== 'unknown') {
    facts.push(`Primary pipework is ${sb!.primarySize}mm.`);
  }

  if (isKnown(sb?.layout) && sb!.layout !== 'unknown') {
    const layoutLabels: Record<string, string> = {
      two_pipe: 'two-pipe',
      one_pipe: 'one-pipe',
      manifold: 'manifold',
      microbore: 'microbore',
    };
    const layoutLabel = layoutLabels[sb!.layout as string] ?? sb!.layout;
    facts.push(`Heating circuit layout: ${layoutLabel}.`);
  }

  return group(facts, 'Emitter type and pipework details were not assessed during this survey.');
}

function buildCylinderStorageGroup(
  input: SurveyEvidenceAdapterInputV1,
): SurveyEvidenceGroupV1 {
  const facts: string[] = [];
  const sb = input.systemBuilder;
  const dhwCond = input.dhwCondition;

  // Prefer dhwCondition fields when available (more detailed)
  const volumeL =
    (dhwCond?.currentCylinderVolumeLitres !== 'unknown'
      ? dhwCond?.currentCylinderVolumeLitres
      : null) ?? sb?.cylinderVolumeL;

  const ageBand = dhwCond?.currentCylinderAgeBand ?? sb?.cylinderAgeBand;
  const condition = dhwCond?.currentCylinderCondition ?? sb?.cylinderCondition;

  // If combi boiler, no cylinder present
  if (sb?.heatSource === 'combi') {
    facts.push('No hot water cylinder is currently installed — the combi boiler provides hot water on demand.');
    return group(facts, 'Cylinder storage details were not assessed during this survey.');
  }

  // Explicit cylinder-present flag
  if (dhwCond?.currentCylinderPresent === false) {
    facts.push('No hot water cylinder is currently installed.');
    return group(facts, 'Cylinder storage details were not assessed during this survey.');
  }

  if (isKnown(volumeL) && typeof volumeL === 'number' && volumeL > 0) {
    facts.push(`Existing hot water cylinder: ${volumeL} L capacity.`);
  }

  if (isKnown(ageBand) && ageBand !== 'unknown') {
    const ageBandLabels: Record<string, string> = {
      under_5: 'under 5 years old',
      '5_to_10': '5–10 years old',
      '10_to_15': '10–15 years old',
      over_15: 'over 15 years old',
    };
    const ageLabel = ageBandLabels[ageBand] ?? ageBand;
    facts.push(`Cylinder is approximately ${ageLabel}.`);
  }

  if (isKnown(condition) && condition !== 'unknown') {
    const conditionLabels: Record<string, string> = {
      good: 'in good condition',
      average: 'in average condition',
      poor: 'in poor condition',
    };
    const condLabel = conditionLabels[condition] ?? condition;
    facts.push(`Cylinder observed ${condLabel}.`);
  }

  return group(facts, 'Cylinder storage details were not assessed during this survey.');
}

function buildRecoveryAssumptionsGroup(
  input: SurveyEvidenceAdapterInputV1,
): SurveyEvidenceGroupV1 {
  const facts: string[] = [];
  const sb = input.systemBuilder;
  const dhwCond = input.dhwCondition;

  // No recovery for combi systems
  if (sb?.heatSource === 'combi') {
    facts.push(
      'Combi boilers produce hot water on demand — no cylinder recovery time applies.',
    );
    return group(facts, 'Recovery assumptions were not applicable for this survey.');
  }

  const volumeL =
    (dhwCond?.currentCylinderVolumeLitres !== 'unknown'
      ? dhwCond?.currentCylinderVolumeLitres
      : null) ?? sb?.cylinderVolumeL;
  const occupants = totalOccupants(input);

  if (isKnown(volumeL) && typeof volumeL === 'number' && volumeL > 0 && occupants !== null) {
    facts.push(
      `Recovery assumptions are based on a ${volumeL} L cylinder and ${occupants} occupant${occupants !== 1 ? 's' : ''} — ` +
        'peak morning demand is the primary sizing constraint.',
    );
  } else if (isKnown(volumeL) && typeof volumeL === 'number' && volumeL > 0) {
    facts.push(
      `Recovery assumptions are based on a ${volumeL} L cylinder — actual recovery time depends on occupancy and draw-off pattern.`,
    );
  } else if (occupants !== null) {
    facts.push(
      `Recovery assumptions are based on ${occupants} occupant${occupants !== 1 ? 's' : ''} — cylinder sizing will be confirmed during system design.`,
    );
  }

  return group(
    facts,
    'Recovery assumptions could not be derived — cylinder volume and occupancy were not both captured.',
  );
}

function buildProtectionSludgeFilterGroup(
  input: SurveyEvidenceAdapterInputV1,
): SurveyEvidenceGroupV1 {
  const facts: string[] = [];
  const sb = input.systemBuilder;
  const hc = input.heatingCondition;

  // Bleed water colour — prefer heatingCondition (more granular) over systemBuilder
  const bleedColourHc = hc?.bleedWaterColour;
  const bleedColourSb = sb?.bleedWaterColour;

  if (isKnown(bleedColourHc) && bleedColourHc !== 'unknown') {
    switch (bleedColourHc) {
      case 'clear':
        facts.push('Radiator bleed water observed as clear — low sludge indication.');
        break;
      case 'brown':
        facts.push('Radiator bleed water observed as brown — moderate contamination noted.');
        break;
      case 'black':
        facts.push('Radiator bleed water observed as black — significant magnetite sludge present.');
        break;
    }
  } else if (isKnown(bleedColourSb) && bleedColourSb !== 'unknown') {
    switch (bleedColourSb) {
      case 'clear':
        facts.push('Bleed water observed as clear — low sludge indication.');
        break;
      case 'slightly_discoloured':
        facts.push('Bleed water slightly discoloured — mild contamination noted.');
        break;
      case 'dark':
        facts.push('Bleed water dark — elevated contamination noted.');
        break;
      case 'sludge':
        facts.push('Bleed water showed sludge — significant contamination present.');
        break;
    }
  }

  // Magnetic debris evidence from heatingCondition
  if (hc?.magneticDebrisEvidence === true) {
    facts.push('Magnetic debris found in the system filter — elevated contamination confirmed.');
  } else if (hc?.magneticDebrisEvidence === false) {
    facts.push('No magnetic debris found in the system filter during this visit.');
  }

  // Pumping over — separate hydraulic fault
  if (hc?.pumpingOverObserved === true) {
    facts.push(
      'Pumping over was observed on the heating circuit — a hydraulic fault requiring investigation.',
    );
  }

  // Magnetic filter status
  if (isKnown(sb?.magneticFilter) && sb!.magneticFilter !== 'unknown') {
    switch (sb!.magneticFilter) {
      case 'fitted':
        facts.push('A magnetic system filter is currently fitted.');
        break;
      case 'not_fitted':
        facts.push('No magnetic filter is currently fitted — one will be required.');
        break;
    }
  }

  // Cleaning history
  if (isKnown(sb?.cleaningHistory) && sb!.cleaningHistory !== 'unknown') {
    switch (sb!.cleaningHistory) {
      case 'never_cleaned':
        facts.push('No system clean or power flush on record — condition assessment relied on indirect indicators.');
        break;
      case 'cleaned_over_5_years_ago':
        facts.push('System was cleaned or power-flushed more than 5 years ago.');
        break;
      case 'recently_cleaned':
        facts.push('System was recently cleaned or power-flushed.');
        break;
    }
  }

  return group(
    facts,
    'System protection and condition data were not recorded during this survey.',
  );
}

function buildHeatLossStoreyGroup(
  input: SurveyEvidenceAdapterInputV1,
): SurveyEvidenceGroupV1 {
  const facts: string[] = [];
  const hl = input.heatLoss;

  if (isKnown(hl?.estimatedPeakHeatLossW) && hl!.estimatedPeakHeatLossW! > 0) {
    const kw = (hl!.estimatedPeakHeatLossW! / 1000).toFixed(1);
    const confidenceLabel =
      hl?.heatLossConfidence === 'measured'
        ? 'measured'
        : hl?.heatLossConfidence === 'estimated'
          ? 'estimated'
          : 'assessed';
    facts.push(`Peak design heat loss ${confidenceLabel} at ${kw} kW.`);
  }

  if (isKnown(hl?.storeys) && hl!.storeys! > 0) {
    facts.push(
      `Property has ${hl!.storeys} storey${hl!.storeys !== 1 ? 's' : ''}.`,
    );
  }

  if (isKnown(hl?.dwellingType) && hl!.dwellingType!.trim()) {
    const dwellingLabels: Record<string, string> = {
      detached: 'detached house',
      semi: 'semi-detached house',
      endTerrace: 'end-of-terrace house',
      midTerrace: 'mid-terrace house',
      flatGround: 'ground-floor flat',
      flatMid: 'mid-floor flat',
      flatPenthouse: 'top-floor flat',
    };
    const label = dwellingLabels[hl!.dwellingType!] ?? hl!.dwellingType;
    facts.push(`Dwelling type: ${label}.`);
  }

  return group(
    facts,
    'Heat loss and storey data were not captured during this survey.',
  );
}

function buildFutureUpgradeConstraintsGroup(
  input: SurveyEvidenceAdapterInputV1,
): SurveyEvidenceGroupV1 {
  const facts: string[] = [];
  const sb = input.systemBuilder;

  // Emitter suitability for heat pump
  if (isKnown(sb?.emitters)) {
    switch (sb!.emitters) {
      case 'underfloor':
        facts.push(
          'Underfloor heating is already installed — heat pump compatible without emitter changes.',
        );
        break;
      case 'radiators_standard':
        facts.push(
          'Standard radiators are fitted — radiator sizing assessment required before confirming heat pump compatibility.',
        );
        break;
      case 'radiators_designer':
        facts.push(
          'Designer radiators are fitted — heat pump compatibility requires individual output assessment.',
        );
        break;
      case 'mixed':
        facts.push(
          'Mixed emitters (radiators and underfloor) — compatibility assessment required before confirming heat pump readiness.',
        );
        break;
    }
  }

  // Pipework access
  if (isKnown(sb?.pipeworkAccess) && sb!.pipeworkAccess !== 'unknown') {
    switch (sb!.pipeworkAccess) {
      case 'accessible':
        facts.push('Primary pipework is accessible — replacement or modification is straightforward.');
        break;
      case 'buried':
        facts.push(
          'Primary pipework is buried or concealed — pipework replacement would involve additional access work.',
        );
        break;
    }
  }

  // Heating system type (open-vented requires conversion)
  if (isKnown(sb?.heatingSystemType) && sb!.heatingSystemType !== 'unknown') {
    if (sb!.heatingSystemType === 'open_vented') {
      facts.push(
        'Heating circuit is currently open-vented — conversion to a sealed pressurised system is required for a heat pump installation.',
      );
    }
  }

  return group(
    facts,
    'Future upgrade constraints were not assessed during this survey.',
  );
}

// ─── Specificity score ────────────────────────────────────────────────────────

const EVIDENCE_GROUP_IDS = [
  'occupancy',
  'simultaneousDemand',
  'mainsSupply',
  'existingHotWaterType',
  'existingHeatingType',
  'emitterSuitability',
  'cylinderStorage',
  'recoveryAssumptions',
  'protectionSludgeFilter',
  'heatLossStorey',
  'futureUpgradeConstraints',
] as const;

type EvidenceGroupId = (typeof EVIDENCE_GROUP_IDS)[number];

function buildSpecificityScore(
  groups: Record<EvidenceGroupId, SurveyEvidenceGroupV1>,
): SurveyEvidenceSpecificityScoreV1 {
  const emptyOrGenericGroupIds: string[] = [];
  let homeSpecificFactCount = 0;
  let genericFallbackCount = 0;

  for (const id of EVIDENCE_GROUP_IDS) {
    if (groups[id].evidencePresent) {
      homeSpecificFactCount += groups[id].facts.length;
    } else {
      genericFallbackCount += 1;
      emptyOrGenericGroupIds.push(id);
    }
  }

  return { homeSpecificFactCount, genericFallbackCount, emptyOrGenericGroupIds };
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Maps raw survey fields into named evidence groups for use in customer-facing
 * packs.
 *
 * Outputs a SurveyEvidenceForCustomerPackV1 that the customer pack builder
 * (buildCustomerEvidencePackV1) can consume to produce home-specific copy.
 *
 * All fields in the input are optional — passing an empty object produces
 * a valid result with all groups in fallback mode.
 */
export function buildSurveyEvidenceForCustomerPackV1(
  input: SurveyEvidenceAdapterInputV1,
): SurveyEvidenceForCustomerPackV1 {
  const groups = {
    occupancy: buildOccupancyGroup(input),
    simultaneousDemand: buildSimultaneousDemandGroup(input),
    mainsSupply: buildMainsSupplyGroup(input),
    existingHotWaterType: buildExistingHotWaterTypeGroup(input),
    existingHeatingType: buildExistingHeatingTypeGroup(input),
    emitterSuitability: buildEmitterSuitabilityGroup(input),
    cylinderStorage: buildCylinderStorageGroup(input),
    recoveryAssumptions: buildRecoveryAssumptionsGroup(input),
    protectionSludgeFilter: buildProtectionSludgeFilterGroup(input),
    heatLossStorey: buildHeatLossStoreyGroup(input),
    futureUpgradeConstraints: buildFutureUpgradeConstraintsGroup(input),
  } satisfies Record<EvidenceGroupId, SurveyEvidenceGroupV1>;

  return {
    schemaVersion: '1.0',
    ...groups,
    specificity: buildSpecificityScore(groups),
  };
}
