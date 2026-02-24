import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { EngineOutputV1, EligibilityItem, RedFlagItem, ExplainerItem, VisualSpecV1, EvidenceItemV1 } from '../contracts/EngineOutputV1';
import { ENGINE_VERSION, CONTRACT_VERSION } from '../contracts/versions';
import { buildOptionMatrixV1 } from './OptionMatrixBuilder';
import { buildTimeline24hV1 } from './TimelineBuilder';
import { ageFactor, cyclingFactor, DEFAULT_BOILER_KW, LOW_LOAD_THRESHOLD_RATIO } from './modules/BoilerTailoffModule';
import { buildAssumptionsV1 } from './AssumptionsBuilder';

function buildEligibility(result: FullEngineResultCore, input?: EngineInputV2_3): EligibilityItem[] {
  const { redFlags, hydraulicV1, combiDhwV1, storedDhwV1 } = result;
  const items: EligibilityItem[] = [];

  // On-demand eligibility is driven first by topology (redFlags.rejectCombi),
  // then by CombiDhwModuleV1 physics verdict.
  let onDemandStatus: EligibilityItem['status'];
  let onDemandReason: string | undefined;

  if (redFlags.rejectCombi) {
    onDemandStatus = 'rejected';
    onDemandReason = redFlags.reasons.filter(r => r.includes('Combi')).join(' ') || undefined;
  } else if (combiDhwV1.verdict.combiRisk === 'fail') {
    onDemandStatus = 'rejected';
    const failFlag = combiDhwV1.flags.find(f => f.severity === 'fail');
    onDemandReason = failFlag ? `${failFlag.title}: ${failFlag.detail}` : undefined;
  } else if (combiDhwV1.verdict.combiRisk === 'warn') {
    onDemandStatus = 'caution';
    const warnFlag = combiDhwV1.flags.find(f => f.severity === 'warn');
    onDemandReason = warnFlag ? `${warnFlag.title}: ${warnFlag.detail}` : undefined;
  } else {
    onDemandStatus = 'viable';
  }

  items.push({
    id: 'on_demand',
    label: 'On Demand (Combi)',
    status: onDemandStatus,
    reason: onDemandReason,
  });

  // Stored vented eligibility: loft conversion → caution; storedRisk=warn or tight space → caution; else viable.
  const hasFutureLoftConversion = input?.futureLoftConversion ?? input?.hasLoftConversion ?? false;
  const storedVentedRejected = (redFlags.rejectStored ?? redFlags.rejectVented);
  let storedVentedStatus: EligibilityItem['status'];
  let storedVentedReason: string | undefined;

  if (storedVentedRejected) {
    storedVentedStatus = 'rejected';
    storedVentedReason = result.redFlags.reasons
      .filter(r => r.includes('Stored') || r.includes('Cylinder') || r.includes('Loft'))
      .join(' ') || undefined;
  } else if (hasFutureLoftConversion || storedDhwV1.verdict.storedRisk === 'warn') {
    storedVentedStatus = 'caution';
    const warnFlag = storedDhwV1.flags.find(f => f.severity === 'warn');
    storedVentedReason = hasFutureLoftConversion
      ? 'Loft conversion planned — header tank space at risk.'
      : warnFlag ? `${warnFlag.title}: ${warnFlag.detail}` : undefined;
  } else {
    storedVentedStatus = 'viable';
  }

  items.push({
    id: 'stored_vented',
    label: 'Stored hot water — Vented cylinder',
    status: storedVentedStatus,
    reason: storedVentedReason,
  });

  // Stored unvented eligibility: mains pressure gate → caution/rejected based on cwsSupplyV1.
  const { cwsSupplyV1, pressureAnalysis } = result;
  const dynamicBar = pressureAnalysis.dynamicBar;
  let storedUnventedStatus: EligibilityItem['status'];
  let storedUnventedReason: string | undefined;

  if (dynamicBar < 1.0) {
    storedUnventedStatus = 'rejected';
    storedUnventedReason = `Mains pressure too low (${dynamicBar.toFixed(1)} bar) — minimum 1.0 bar required.`;
  } else if (!cwsSupplyV1.hasMeasurements) {
    storedUnventedStatus = 'caution';
    storedUnventedReason = 'Mains supply not characterised — need L/min @ bar measurement.';
  } else if (cwsSupplyV1.quality === 'weak') {
    storedUnventedStatus = 'caution';
    storedUnventedReason = 'Mains supply is weak — boost pump likely required.';
  } else {
    storedUnventedStatus = 'viable';
  }

  items.push({
    id: 'stored_unvented',
    label: 'Stored hot water — Unvented cylinder',
    status: storedUnventedStatus,
    reason: storedUnventedReason,
  });

  // ASHP eligibility is driven first by hydraulic physics, then by topology hard-fails.
  let ashpStatus: EligibilityItem['status'];
  if (redFlags.rejectAshp) {
    ashpStatus = 'rejected';
  } else if (hydraulicV1.verdict.ashpRisk === 'fail') {
    ashpStatus = 'rejected';
  } else if (hydraulicV1.verdict.ashpRisk === 'warn' || redFlags.flagAshp) {
    ashpStatus = 'caution';
  } else {
    ashpStatus = 'viable';
  }

  const ashpReasons = [
    ...redFlags.reasons.filter(r => r.includes('ASHP')),
    ...hydraulicV1.notes.filter(n => n.includes('ASHP')),
  ].join(' ');

  items.push({
    id: 'ashp',
    label: 'Air Source Heat Pump',
    status: ashpStatus,
    reason: ashpStatus !== 'viable' ? ashpReasons || undefined : undefined,
  });

  return items;
}

function buildRedFlags(reasons: string[]): RedFlagItem[] {
  return reasons.map((r, i) => {
    const isFail = r.includes('Rejected') || r.includes('Hard Fail') || r.includes('Cut-off');
    const severity: RedFlagItem['severity'] = isFail ? 'fail' : 'warn';
    const colonIdx = r.indexOf(':');
    const title = colonIdx > -1 ? r.slice(0, colonIdx).replace(/^[🚫⚠️\s]+/, '').trim() : r;
    const detail = colonIdx > -1 ? r.slice(colonIdx + 1).trim() : r;
    return { id: `flag-${i}`, severity, title, detail };
  });
}

function buildExplainers(result: FullEngineResultCore): ExplainerItem[] {
  const items: ExplainerItem[] = [];

  if (result.hydraulic.isBottleneck) {
    items.push({
      id: 'hydraulic-bottleneck',
      title: 'Hydraulic Bottleneck Detected',
      body: `Primary pipework is undersized. Flow rate ${(result.hydraulic.flowRateLs * 1000).toFixed(1)} L/min at ${result.hydraulic.velocityMs.toFixed(2)} m/s exceeds safe limits.${result.hydraulic.ashpRequires28mm ? ' Upgrade to 28mm required for ASHP installation.' : ' Pipe upgrade recommended.'}`,
    });
  }

  if (result.hydraulicV1.verdict.ashpRisk !== 'pass') {
    const { ashp, boiler } = result.hydraulicV1;
    items.push({
      id: 'hydraulic-ashp-flow',
      title: 'ASHP Requires ~4× Boiler Flow Rate',
      body: `Heat pumps operate at ΔT ${ashp.deltaT}°C versus ΔT ${boiler.deltaT}°C for a boiler, ` +
        `requiring ${ashp.flowLpm.toFixed(1)} L/min — ` +
        `approximately ${(ashp.flowLpm / boiler.flowLpm).toFixed(1)}× the boiler demand of ` +
        `${boiler.flowLpm.toFixed(1)} L/min. Primary pipework smaller than 28mm may clip ` +
        `heat pump performance, cause pipe erosion, and increase noise.`,
    });
  }

  if (result.combiStress.isCondensingCompromised) {
    items.push({
      id: 'condensing-compromised',
      title: 'Condensing Mode Compromised',
      body: `Short-draw efficiency at ${result.combiStress.shortDrawEfficiencyPct}% with ${result.combiStress.totalPenaltyKwh.toFixed(0)} kWh/yr total penalty. Frequent short draws prevent return temperature dropping below dew point.`,
    });
  }

  const waterCategory = result.normalizer.waterHardnessCategory;
  if (waterCategory === 'hard' || waterCategory === 'very_hard') {
    items.push({
      id: 'water-hardness',
      title: 'Hard Water Area',
      body: `${waterCategory.replace('_', ' ')} water detected (${result.normalizer.cacO3Level} mg/L CaCO₃). Scale accumulation can reduce DHW heat-exchanger efficiency by up to 8% per mm of deposit.`,
    });
  }

  const shortDrawFlag = result.combiDhwV1.flags.find(f => f.id === 'combi-short-draw-collapse');
  if (shortDrawFlag) {
    items.push({
      id: 'combi-short-draw-collapse',
      title: shortDrawFlag.title,
      body: shortDrawFlag.detail,
    });
  }

  // Stored DHW: Mixergy explainer when recommended (space tight or high demand) or space warn present.
  // Both cases benefit from the Mixergy stratification explanation.
  const storedRec = result.storedDhwV1.recommended;
  const spaceWarnFlag = result.storedDhwV1.flags.find(f =>
    f.id === 'stored-space-tight' || f.id === 'stored-space-unknown',
  );
  if (storedRec.type === 'mixergy' || spaceWarnFlag) {
    items.push({
      id: 'stored-mixergy-suggested',
      title: 'Mixergy Cylinder Suggested',
      body:
        `A Mixergy cylinder heats only the top portion of the tank that is actually ` +
        `needed, providing fast usable hot water with a smaller effective footprint ` +
        `than a conventional cylinder of equal volume. ` +
        (spaceWarnFlag ? `This is especially beneficial given the space constraint identified. ` : '') +
        `Mixergy's stratified heating can reduce standing losses and gas use versus ` +
        `a fully-heated conventional cylinder.`,
    });
  }

  return items;
}

// ── Evidence items ────────────────────────────────────────────────────────────

function buildEvidence(result: FullEngineResultCore, input?: EngineInputV2_3): EvidenceItemV1[] {
  const items: EvidenceItemV1[] = [];

  // Mains pressure — key gate for combi, unvented, ASHP
  const { pressureAnalysis } = result;
  const pressureSource = input?.dynamicMainsPressure !== undefined ? 'manual' : 'assumed';
  items.push({
    id: 'ev-mains-pressure-dynamic',
    fieldPath: 'dynamicMainsPressure',
    label: 'Mains pressure (dynamic)',
    value: `${pressureAnalysis.dynamicBar.toFixed(1)} bar`,
    source: pressureSource,
    confidence: 'high',
    affectsOptionIds: ['combi', 'system_unvented'],
  });

  if (pressureAnalysis.staticBar !== undefined && pressureAnalysis.dropBar !== undefined) {
    items.push({
      id: 'ev-mains-pressure-drop',
      fieldPath: 'staticMainsPressureBar',
      label: 'Mains pressure drop (static → dynamic)',
      value: `${pressureAnalysis.dropBar.toFixed(1)} bar drop (${pressureAnalysis.quality ?? 'unknown'})`,
      source: 'manual',
      confidence: 'high',
      affectsOptionIds: ['combi', 'system_unvented'],
    });
  }

  // Primary pipe diameter — critical for ASHP
  const { hydraulicV1 } = result;
  const pipeDiameter = input?.primaryPipeDiameter;
  items.push({
    id: 'ev-primary-pipe',
    fieldPath: 'primaryPipeDiameter',
    label: 'Primary pipe diameter',
    value: pipeDiameter !== undefined ? `${pipeDiameter} mm` : 'unknown (assumed 22 mm)',
    source: pipeDiameter !== undefined ? 'manual' : 'assumed',
    confidence: pipeDiameter !== undefined ? 'high' : 'low',
    affectsOptionIds: ['ashp'],
  });

  // ASHP flow requirement — derived from hydraulicV1
  items.push({
    id: 'ev-ashp-flow',
    fieldPath: 'hydraulicV1.ashp.flowLpm',
    label: 'ASHP required flow rate',
    value: `${hydraulicV1.ashp.flowLpm.toFixed(1)} L/min (~${(hydraulicV1.ashp.flowLpm / hydraulicV1.boiler.flowLpm).toFixed(1)}× boiler)`,
    source: 'derived',
    confidence: 'high',
    affectsOptionIds: ['ashp'],
  });

  // Combi DHW verdict — simultaneous demand gate
  const { combiDhwV1 } = result;
  const bathroomCount = input?.bathroomCount;
  items.push({
    id: 'ev-combi-simultaneity',
    fieldPath: 'bathroomCount',
    label: 'Peak simultaneous DHW outlets',
    value: bathroomCount !== undefined ? `${bathroomCount} bathroom${bathroomCount !== 1 ? 's' : ''}` : 'unknown',
    source: bathroomCount !== undefined ? 'manual' : 'assumed',
    confidence: bathroomCount !== undefined ? 'high' : 'low',
    affectsOptionIds: ['combi'],
  });
  items.push({
    id: 'ev-combi-risk',
    fieldPath: 'combiDhwV1.verdict.combiRisk',
    label: 'Combi DHW risk verdict',
    value: combiDhwV1.verdict.combiRisk,
    source: 'derived',
    confidence: 'high',
    affectsOptionIds: ['combi'],
  });

  // Stored DHW verdict
  const { storedDhwV1 } = result;
  const availableSpace = input?.availableSpace;
  items.push({
    id: 'ev-available-space',
    fieldPath: 'availableSpace',
    label: 'Available space for cylinder',
    value: availableSpace ?? 'unknown',
    source: availableSpace !== undefined ? 'manual' : 'placeholder',
    confidence: availableSpace !== undefined && availableSpace !== 'unknown' ? 'high' : 'low',
    affectsOptionIds: ['stored_vented', 'stored_unvented', 'system_unvented'],
  });
  items.push({
    id: 'ev-stored-risk',
    fieldPath: 'storedDhwV1.verdict.storedRisk',
    label: 'Stored DHW risk verdict',
    value: storedDhwV1.verdict.storedRisk,
    source: 'derived',
    confidence: 'high',
    affectsOptionIds: ['stored_vented', 'stored_unvented', 'ashp', 'system_unvented'],
  });

  // Heat loss — drives ASHP sizing and flow requirements
  const heatLossWatts = input?.heatLossWatts;
  items.push({
    id: 'ev-heat-loss',
    fieldPath: 'heatLossWatts',
    label: 'Design heat loss',
    value: heatLossWatts !== undefined ? `${(heatLossWatts / 1000).toFixed(1)} kW` : 'unknown',
    source: heatLossWatts !== undefined ? 'manual' : 'assumed',
    confidence: heatLossWatts !== undefined ? 'high' : 'medium',
    affectsOptionIds: ['ashp', 'combi', 'stored_vented', 'stored_unvented', 'regular_vented', 'system_unvented'],
  });

  return items;
}

// ── Visual specs ──────────────────────────────────────────────────────────────

function buildVisuals(result: FullEngineResultCore, input?: EngineInputV2_3): VisualSpecV1[] {
  const visuals: VisualSpecV1[] = [];

  // pressure_drop — static→dynamic arrow + drop classification
  const { pressureAnalysis } = result;
  visuals.push({
    id: 'pressure_drop',
    type: 'pressure_drop',
    title: 'Mains Pressure',
    data: {
      staticBar: pressureAnalysis.staticBar,
      dynamicBar: pressureAnalysis.dynamicBar,
      dropBar: pressureAnalysis.dropBar,
      quality: pressureAnalysis.quality,
    },
    affectsOptionIds: ['combi', 'system_unvented'],
  });

  // ashp_flow — boiler flow vs ASHP flow multiplier
  const { hydraulicV1 } = result;
  visuals.push({
    id: 'ashp_flow',
    type: 'ashp_flow',
    title: 'ASHP vs Boiler Flow Rate',
    data: {
      boilerFlowLpm: hydraulicV1.boiler.flowLpm,
      ashpFlowLpm: hydraulicV1.ashp.flowLpm,
      multiplier: Number((hydraulicV1.ashp.flowLpm / hydraulicV1.boiler.flowLpm).toFixed(1)),
      ashpRisk: hydraulicV1.verdict.ashpRisk,
    },
    affectsOptionIds: ['ashp'],
  });

  // dhw_outlets — combi simultaneous demand: outlets vs capacity
  const { combiDhwV1 } = result;
  const simultaneousFlag = combiDhwV1.flags.find(f => f.id === 'combi-simultaneous-demand');
  visuals.push({
    id: 'dhw_outlets',
    type: 'dhw_outlets',
    title: 'DHW Simultaneous Demand',
    data: {
      combiRisk: combiDhwV1.verdict.combiRisk,
      simultaneousFail: !!simultaneousFlag,
    },
    affectsOptionIds: ['combi'],
  });

  // space_footprint — cylinder / buffer space from storedDhwV1
  const { storedDhwV1, mixergy } = result;
  visuals.push({
    id: 'space_footprint',
    type: 'space_footprint',
    title: 'Cylinder Space Footprint',
    data: {
      storedRisk: storedDhwV1.verdict.storedRisk,
      recommendedType: storedDhwV1.recommended.type,
      mixergyLitres: mixergy.mixergyLitres,
      conventionalLitres: mixergy.equivalentConventionalLitres,
      footprintSavingPct: mixergy.footprintSavingPct,
    },
    affectsOptionIds: ['stored_vented', 'stored_unvented', 'ashp', 'system_unvented'],
  });

  // timeline_24h — 24-hour A/B comparison timeline (current vs primary recommendation)
  if (input) {
    visuals.unshift(buildTimeline24hV1(result, input));
  }

  return visuals;
}

export function buildEngineOutputV1(result: FullEngineResultCore, input?: EngineInputV2_3): EngineOutputV1 {
  // ── Recommendation resolver V1 ────────────────────────────────────────────
  // Deterministic: survive physics best.
  const onDemandRejected =
    result.redFlags.rejectCombi ||
    result.combiDhwV1.verdict.combiRisk === 'fail';
  const ashpViable =
    !result.redFlags.rejectAshp &&
    result.hydraulicV1.verdict.ashpRisk !== 'fail';
  const steadySignatures = new Set(['steady_home', 'steady']);
  const isSteadyHome = steadySignatures.has(result.lifestyle.signature);

  let primaryRecommendation: string;
  if (onDemandRejected) {
    primaryRecommendation = 'Stored hot water — unvented cylinder';
  } else if (ashpViable && isSteadyHome) {
    primaryRecommendation = 'Air Source Heat Pump';
  } else {
    // Fallback to lifestyle module output; recommendedSystem is always populated.
    primaryRecommendation = result.lifestyle.notes[0] ?? result.lifestyle.recommendedSystem;
  }

  const allReasons = [...result.redFlags.reasons, ...result.hydraulicV1.notes];

  // Merge combiDhwV1 flags into redFlags output
  const combiFlags: RedFlagItem[] = result.combiDhwV1.flags.map(f => ({
    id: f.id,
    severity: f.severity,
    title: f.title,
    detail: f.detail,
  }));

  // Merge storedDhwV1 flags into redFlags output
  const storedFlags: RedFlagItem[] = result.storedDhwV1.flags.map(f => ({
    id: f.id,
    severity: f.severity,
    title: f.title,
    detail: f.detail,
  }));

  // ── Context Summary ───────────────────────────────────────────────────────
  // Priority: when both occupancyCount and bedrooms are available, combine
  // them in a single narrative bullet; otherwise show whichever is present.
  const contextBullets: string[] = [];
  if (input) {
    const { occupancyCount, bedrooms, bathroomCount,
            currentHeatSourceType, futureLoftConversion, futureAddBathroom,
            availableSpace } = input;

    if (occupancyCount !== undefined && bedrooms !== undefined) {
      contextBullets.push(`${occupancyCount} ${occupancyCount === 1 ? 'person' : 'people'} in a ${bedrooms}-bed property.`);
    } else if (occupancyCount !== undefined) {
      contextBullets.push(`${occupancyCount} ${occupancyCount === 1 ? 'person' : 'people'} in the household.`);
    } else if (bedrooms !== undefined) {
      contextBullets.push(`${bedrooms}-bedroom property.`);
    }

    if (bathroomCount >= 2) {
      contextBullets.push(`${bathroomCount} bathrooms — simultaneous DHW demand is a factor.`);
    } else {
      contextBullets.push('Single bathroom — simultaneous demand is low.');
    }

    contextBullets.push(result.pressureAnalysis.formattedBullet);

    // CWS supply notes from cwsSupplyV1 — notes are already customer-safe.
    // When only dynamic pressure is known (no flow, no static), the CWS module
    // emits a "Mains supply: X bar (dynamic only)" note that duplicates the
    // pressureAnalysis.formattedBullet already pushed above — skip it.
    const suppressDynamicOnlyDuplicate =
      !result.cwsSupplyV1.hasMeasurements && result.pressureAnalysis.staticBar === undefined;
    for (const note of result.cwsSupplyV1.notes) {
      if (suppressDynamicOnlyDuplicate && note.startsWith('Mains supply:')) continue;
      contextBullets.push(note);
    }

    if (currentHeatSourceType) {
      const systemLabels: Record<string, string> = {
        combi: 'Combi boiler',
        system: 'System boiler',
        regular: 'Regular (heat-only) boiler',
        ashp: 'Air source heat pump',
        other: 'Other heat source',
      };
      contextBullets.push(`Current system: ${systemLabels[currentHeatSourceType] ?? currentHeatSourceType}.`);
    }

    if (futureLoftConversion) {
      contextBullets.push('Loft conversion planned — affects tank/cylinder placement options.');
    }
    if (futureAddBathroom) {
      contextBullets.push('Additional bathroom planned — increases future DHW demand.');
    }
    if (availableSpace === 'tight') {
      contextBullets.push('Limited space for a cylinder — compact or Mixergy option preferred.');
    } else if (availableSpace === 'ok') {
      contextBullets.push('Adequate space available for a standard cylinder.');
    }

    // SEDBUK boiler efficiency context bullets
    const sedbuk = result.sedbukV1;
    if (sedbuk && sedbuk.seasonalEfficiency != null) {
      const basePct = Math.round(sedbuk.seasonalEfficiency * 100);
      contextBullets.push(
        `Current boiler baseline seasonal efficiency (SEDBUK): ${basePct}% (source: ${sedbuk.label}).`,
      );
      const boilerAgeYears = input.currentSystem?.boiler?.ageYears ?? input.currentBoilerAgeYears ?? 0;
      if (boilerAgeYears > 0) {
        const af = ageFactor(boilerAgeYears);
        // cycling penalty range: 0% (no cycling) to max 9% (high cycling)
        const lowLoadKw = DEFAULT_BOILER_KW * LOW_LOAD_THRESHOLD_RATIO;
        const cfLow = cyclingFactor(new Array(96).fill(0.1), lowLoadKw); // high cycling
        const adjustedLow = Math.round(sedbuk.seasonalEfficiency * af * cfLow * 100);
        const adjustedHigh = Math.round(sedbuk.seasonalEfficiency * af * 100);
        contextBullets.push(
          `Modelled in-home estimate (age + cycling): ~${adjustedLow}–${adjustedHigh}% across your day.`,
        );
      }
    }

    // Boiler sizing context bullets
    const sizing = result.sizingV1;
    if (sizing) {
      contextBullets.push(`Boiler nominal output: ${sizing.nominalKw} kW.`);
      if (sizing.peakHeatLossKw != null) {
        contextBullets.push(`Estimated peak heat loss: ${sizing.peakHeatLossKw.toFixed(1)} kW.`);
      }
      if (sizing.oversizeRatio != null) {
        const bandDescriptions: Record<string, string> = {
          well_matched:  'well matched',
          mild_oversize: 'mildly oversized — some cycling losses',
          oversized:     'oversized — increased cycling losses',
          aggressive:    'aggressive oversizing — increased cycling losses',
        };
        const desc = bandDescriptions[sizing.sizingBand] ?? sizing.sizingBand;
        contextBullets.push(
          `Oversize ratio: ${sizing.oversizeRatio.toFixed(1)}× (${desc}).`,
        );
      }
    }
  }

  return {
    eligibility: buildEligibility(result, input),
    redFlags: [...buildRedFlags(allReasons), ...combiFlags, ...storedFlags],
    recommendation: { primary: primaryRecommendation },
    explainers: buildExplainers(result),
    contextSummary: contextBullets.length > 0 ? { bullets: contextBullets } : undefined,
    options: input ? buildOptionMatrixV1(result, input) : undefined,
    evidence: buildEvidence(result, input),
    visuals: buildVisuals(result, input),
    meta: (() => {
      const base = { engineVersion: ENGINE_VERSION, contractVersion: CONTRACT_VERSION };
      if (!input) return base;
      const { confidence, assumptions } = buildAssumptionsV1(result, input);
      return { ...base, confidence, assumptions };
    })(),
  };
}
