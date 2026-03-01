export type HeatLevel = 'off' | 'setback' | 'comfort';
export type DayEventType = 'shower' | 'bath' | 'handwash' | 'coldFillAppliance' | 'otherDraw';

export interface DayEvent {
  type: DayEventType;
  startMin: number;
  durationMin: number;
  flowLpm?: number;
  litres?: number;
  applianceType?: 'dishwasher' | 'washing_machine';
}

export interface DayModelV1 {
  heatProgram: HeatLevel[];
  dhwSetpointWindow: Array<{ startHour: number; endHour: number }>;
  dhwBoostWindow: Array<{ startHour: number; endHour: number }>;
  events: DayEvent[];
  dhwMixedLpmByStep: number[];
}

const STEPS_PER_DAY = 288;
const STEP_MINS = 5;

function createDefaultHeatProgram(): HeatLevel[] {
  return Array.from({ length: 24 }, (_, h) => {
    if (h >= 6 && h < 9) return 'comfort';
    if (h >= 17 && h < 22) return 'comfort';
    if (h >= 22 || h < 6) return 'off';
    return 'setback';
  });
}

function eventFlowLpm(event: DayEvent): number {
  if (event.type === 'bath') {
    const litres = event.litres ?? 80;
    return litres / Math.max(event.durationMin, 1);
  }
  return event.flowLpm ?? 0;
}

/**
 * Build a DayModelV1 from an arbitrary list of DayEvent objects.
 *
 * Cold-fill appliance events (dishwasher / washing machine) are excluded from
 * the dhwMixedLpmByStep array — they draw cold mains directly and do not
 * create a DHW heat load on the boiler or cylinder.
 */
export function buildDayModelFromEvents(events: DayEvent[]): DayModelV1 {
  const dhwMixedLpmByStep = Array.from({ length: STEPS_PER_DAY }, (_, step) => {
    const minute = step * STEP_MINS;
    return events.reduce((sum, event) => {
      const end = event.startMin + event.durationMin;
      if (minute < event.startMin || minute >= end) return sum;
      if (event.type === 'coldFillAppliance') return sum;
      return sum + eventFlowLpm(event);
    }, 0);
  });

  return {
    heatProgram: createDefaultHeatProgram(),
    dhwSetpointWindow: [{ startHour: 5, endHour: 23 }],
    dhwBoostWindow: [{ startHour: 6, endHour: 8 }, { startHour: 18, endHour: 21 }],
    events,
    dhwMixedLpmByStep,
  };
}

export function buildDefaultDayModel(): DayModelV1 {
  const events: DayEvent[] = [
    { type: 'shower', startMin: 7 * 60 + 10, durationMin: 10, flowLpm: 10 },
    { type: 'handwash', startMin: 8 * 60 + 10, durationMin: 2, flowLpm: 2 },
    { type: 'coldFillAppliance', startMin: 13 * 60, durationMin: 10, flowLpm: 2, applianceType: 'dishwasher' },
    { type: 'shower', startMin: 19 * 60 + 20, durationMin: 8, flowLpm: 9 },
    { type: 'bath', startMin: 21 * 60, durationMin: 12, litres: 90 },
  ];
  return buildDayModelFromEvents(events);
}
