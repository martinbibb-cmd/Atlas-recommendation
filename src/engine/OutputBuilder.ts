import type { FullEngineResultCore } from './schema/EngineInputV2_3';
import type { EngineOutputV1, EligibilityItem, RedFlagItem, ExplainerItem } from '../contracts/EngineOutputV1';
import { ENGINE_VERSION, CONTRACT_VERSION } from '../contracts/versions';

function buildEligibility(result: FullEngineResultCore): EligibilityItem[] {
  const { redFlags, hydraulicV1, combiDhwV1 } = result;
  const items: EligibilityItem[] = [];

  // Instant eligibility is driven first by topology (redFlags.rejectCombi),
  // then by CombiDhwModuleV1 physics verdict.
  let instantStatus: EligibilityItem['status'];
  let instantReason: string | undefined;

  if (redFlags.rejectCombi) {
    instantStatus = 'rejected';
    instantReason = redFlags.reasons.filter(r => r.includes('Combi')).join(' ') || undefined;
  } else if (combiDhwV1.verdict.combiRisk === 'fail') {
    instantStatus = 'rejected';
    const failFlag = combiDhwV1.flags.find(f => f.severity === 'fail');
    instantReason = failFlag ? `${failFlag.title}: ${failFlag.detail}` : undefined;
  } else if (combiDhwV1.verdict.combiRisk === 'warn') {
    instantStatus = 'caution';
    const warnFlag = combiDhwV1.flags.find(f => f.severity === 'warn');
    instantReason = warnFlag ? `${warnFlag.title}: ${warnFlag.detail}` : undefined;
  } else {
    instantStatus = 'viable';
  }

  items.push({
    id: 'instant',
    label: 'Instantaneous (Combi)',
    status: instantStatus,
    reason: instantReason,
  });

  const storedReason = redFlags.reasons
    .filter(r => r.includes('Stored') || r.includes('Cylinder') || r.includes('Loft'))
    .join(' ');

  items.push({
    id: 'stored',
    label: 'Stored Cylinder',
    status: (redFlags.rejectStored ?? redFlags.rejectVented) ? 'rejected' : 'viable',
    reason: (redFlags.rejectStored ?? redFlags.rejectVented) ? storedReason || undefined : undefined,
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

  return items;
}

export function buildEngineOutputV1(result: FullEngineResultCore): EngineOutputV1 {
  const primary = result.lifestyle.notes[0] ?? result.lifestyle.recommendedSystem;
  const allReasons = [...result.redFlags.reasons, ...result.hydraulicV1.notes];

  // Merge combiDhwV1 flags into redFlags output
  const combiFlags: RedFlagItem[] = result.combiDhwV1.flags.map(f => ({
    id: f.id,
    severity: f.severity,
    title: f.title,
    detail: f.detail,
  }));

  return {
    eligibility: buildEligibility(result),
    redFlags: [...buildRedFlags(allReasons), ...combiFlags],
    recommendation: { primary },
    explainers: buildExplainers(result),
    meta: {
      engineVersion: ENGINE_VERSION,
      contractVersion: CONTRACT_VERSION,
    },
  };
}
