import type { DayModelV1, HeatLevel } from './BuildDayModel';

export type DaySystemType = 'combi' | 'stored' | 'mixergy' | 'ashp';

export interface SimSlice {
  idx: number;
  timeLabel: string;
  internalTempC: number;
  chDemandKw: number;
  dhwTapDemandKw: number;
  plantOutputKw: number;
  chDeliveredKw: number;
  dhwDeliveredKw: number;
  cylinderTempC?: number;
  cylinderReheatKw?: number;
  cylinderLossKw?: number;
  flueLossKw: number;
  dumpToChKw: number;
}

const STEP_MINS = 5;
const STEP_HOURS = STEP_MINS / 60;
const WATER_KW_PER_LPM_40C = 2.44;

function heatDemandFactor(level: HeatLevel): number {
  if (level === 'comfort') return 1;
  if (level === 'setback') return 0.45;
  return 0;
}

export function simulateSystemDay(params: {
  dayModel: DayModelV1;
  systemType: DaySystemType;
  heatLossWatts: number;
  tauHours: number;
}): SimSlice[] {
  const { dayModel, systemType, heatLossWatts, tauHours } = params;
  const hlcKwPerK = heatLossWatts / 1000 / 20;
  const outdoorC = 6;
  let indoorC = 19;
  let cylinderC = 55;
  const targetComfortC = 20.5;
  const tankCapKwhPerC = systemType === 'mixergy' ? 0.2 : 0.28;

  return Array.from({ length: 288 }, (_, idx) => {
    const minute = idx * STEP_MINS;
    const hour = Math.floor(minute / 60);
    const heatLevel = dayModel.heatProgram[Math.min(hour, 23)] ?? 'off';
    const dhwTapDemandKw = dayModel.dhwMixedLpmByStep[idx] * WATER_KW_PER_LPM_40C;
    const deltaT = indoorC - outdoorC;
    const passiveLossKw = Math.max(0, hlcKwPerK * deltaT);
    const scheduledDemandKw = (heatLossWatts / 1000) * heatDemandFactor(heatLevel);
    const tempRecoveryKw = Math.max(0, (targetComfortC - indoorC) * (heatLossWatts / 1000) * 0.8);
    const chDemandKw = Math.max(0, scheduledDemandKw + tempRecoveryKw);

    let plantOutputKw = 0;
    let chDeliveredKw = 0;
    let dhwDeliveredKw = 0;
    let cylinderReheatKw = 0;
    let cylinderLossKw = 0.08;
    let flueLossKw = 0;
    let dumpToChKw = 0;

    const dhwActive = dhwTapDemandKw > 0.2;

    if (systemType === 'combi') {
      if (dhwActive) {
        plantOutputKw = Math.min(34, Math.max(12, dhwTapDemandKw));
        dhwDeliveredKw = Math.min(dhwTapDemandKw, plantOutputKw);
        chDeliveredKw = 0;
        flueLossKw = plantOutputKw * 0.12;
      } else {
        plantOutputKw = Math.min(28, chDemandKw);
        chDeliveredKw = plantOutputKw;
        const prevHadDhw = idx > 0 && dayModel.dhwMixedLpmByStep[idx - 1] > 0.2;
        if (prevHadDhw) {
          dumpToChKw = 1.8;
          chDeliveredKw += dumpToChKw;
        }
        flueLossKw = plantOutputKw * 0.07;
      }
    } else {
      const tankTarget = systemType === 'mixergy' ? 52 : 55;
      const tankMin = systemType === 'mixergy' ? 43 : 46;
      const drawnKwh = dhwTapDemandKw * STEP_HOURS;
      cylinderC -= drawnKwh / tankCapKwhPerC;
      cylinderC = Math.max(35, cylinderC);
      const needsReheat = cylinderC < tankTarget - 1 || (dhwActive && cylinderC < tankMin);
      if (needsReheat) {
        cylinderReheatKw = systemType === 'ashp' ? 4 : systemType === 'mixergy' ? 8 : 10;
      }
      plantOutputKw = Math.min(systemType === 'ashp' ? 12 : 30, chDemandKw + cylinderReheatKw);
      chDeliveredKw = Math.min(chDemandKw, plantOutputKw);
      dhwDeliveredKw = dhwTapDemandKw;
      if (cylinderReheatKw > 0) {
        cylinderC += (cylinderReheatKw * STEP_HOURS) / tankCapKwhPerC;
      }
      cylinderC -= cylinderLossKw * STEP_HOURS / tankCapKwhPerC;
      flueLossKw = systemType === 'ashp' ? 0 : plantOutputKw * 0.06;
    }

    const netHeatToBuildingKw = chDeliveredKw + dumpToChKw - passiveLossKw;
    const tempDriftPerHour = netHeatToBuildingKw / Math.max(0.1, heatLossWatts / 1000);
    indoorC += (tempDriftPerHour * STEP_HOURS) * (24 / Math.max(8, tauHours));
    indoorC = Math.max(10, Math.min(24, indoorC));

    return {
      idx,
      timeLabel: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
      internalTempC: Number(indoorC.toFixed(2)),
      chDemandKw: Number(chDemandKw.toFixed(2)),
      dhwTapDemandKw: Number(dhwTapDemandKw.toFixed(2)),
      plantOutputKw: Number(plantOutputKw.toFixed(2)),
      chDeliveredKw: Number(chDeliveredKw.toFixed(2)),
      dhwDeliveredKw: Number(dhwDeliveredKw.toFixed(2)),
      cylinderTempC: systemType === 'combi' ? undefined : Number(cylinderC.toFixed(2)),
      cylinderReheatKw: systemType === 'combi' ? undefined : Number(cylinderReheatKw.toFixed(2)),
      cylinderLossKw: systemType === 'combi' ? undefined : Number(cylinderLossKw.toFixed(2)),
      flueLossKw: Number(flueLossKw.toFixed(2)),
      dumpToChKw: Number(dumpToChKw.toFixed(2)),
    };
  });
}
