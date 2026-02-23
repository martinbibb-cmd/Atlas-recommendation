import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { EngineOutputV1, EligibilityItem, RedFlagItem, ExplainerItem } from '../contracts/EngineOutputV1';
import { ENGINE_VERSION, CONTRACT_VERSION } from '../contracts/versions';
import { buildOptionMatrixV1 } from './OptionMatrixBuilder';

function buildEligibility(result: FullEngineResultCore): EligibilityItem[] {
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

  // Stored eligibility: topology hard-reject → rejected; storedRisk=warn → caution; else viable.
  const storedRejected = (redFlags.rejectStored ?? redFlags.rejectVented);
  const storedReasonBase = redFlags.reasons
    .filter(r => r.includes('Stored') || r.includes('Cylinder') || r.includes('Loft'))
    .join(' ');

  let storedStatus: EligibilityItem['status'];
  let storedReason: string | undefined;

  if (storedRejected) {
    storedStatus = 'rejected';
    storedReason = storedReasonBase || undefined;
  } else if (storedDhwV1.verdict.storedRisk === 'warn') {
    storedStatus = 'caution';
    const warnFlag = storedDhwV1.flags.find(f => f.severity === 'warn');
    storedReason = warnFlag ? `${warnFlag.title}: ${warnFlag.detail}` : undefined;
  } else {
    storedStatus = 'viable';
  }

  items.push({
    id: 'stored',
    label: 'Stored Cylinder',
    status: storedStatus,
    reason: storedReason,
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
    primaryRecommendation = 'Stored (Cylinder)';
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
  }

  return {
    eligibility: buildEligibility(result),
    redFlags: [...buildRedFlags(allReasons), ...combiFlags, ...storedFlags],
    recommendation: { primary: primaryRecommendation },
    explainers: buildExplainers(result),
    contextSummary: contextBullets.length > 0 ? { bullets: contextBullets } : undefined,
    options: input ? buildOptionMatrixV1(result, input) : undefined,
    meta: {
      engineVersion: ENGINE_VERSION,
      contractVersion: CONTRACT_VERSION,
    },
  };
}
