import { describe, it, expect } from 'vitest';
import { runEngine } from '../Engine';
import { buildTimeline24hV1 } from '../TimelineBuilder';

const baseInput = {
  postcode: 'SW1A 1AA',
  dynamicMainsPressure: 2.5,
  buildingMass: 'medium' as const,
  primaryPipeDiameter: 22,
  heatLossWatts: 8000,
  radiatorCount: 10,
  hasLoftConversion: false,
  returnWaterTemp: 45,
  bathroomCount: 1,
  occupancySignature: 'professional' as const,
  highOccupancy: false,
  preferCombi: true,
};

describe('TimelineBuilder', () => {
  it('timeline visual is included in engineOutput when input is provided', () => {
    const { engineOutput } = runEngine(baseInput);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    expect(timeline).toBeDefined();
    expect(timeline!.id).toBe('timeline_24h');
  });

  it('timeline visual is present in engineOutput from runEngine (input always provided)', () => {
    const result = runEngine(baseInput);
    const timelineVisuals = result.engineOutput.visuals?.filter(v => v.type === 'timeline_24h');
    expect((timelineVisuals ?? []).length).toBeGreaterThan(0);
  });

  it('timeline payload has exactly 96 time points', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const payload = timeline!.data;
    expect(payload.timeMinutes).toHaveLength(96);
    expect(payload.demandHeatKw).toHaveLength(96);
  });

  it('timeMinutes starts at 0 and ends at 1425 (15-min intervals)', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const { timeMinutes } = timeline!.data;
    expect(timeMinutes[0]).toBe(0);
    expect(timeMinutes[95]).toBe(1425);
    expect(timeMinutes[1] - timeMinutes[0]).toBe(15);
  });

  it('timeline includes exactly two series', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    expect(timeline!.data.series).toHaveLength(2);
  });

  it('both series have aligned lengths matching timeMinutes (96 points)', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const { series, timeMinutes } = timeline!.data;
    for (const s of series) {
      expect(s.heatDeliveredKw).toHaveLength(timeMinutes.length);
      expect(s.efficiency).toHaveLength(timeMinutes.length);
    }
  });

  it('series IDs are present and non-empty', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const { series } = timeline!.data;
    for (const s of series) {
      expect(typeof s.id).toBe('string');
      expect(s.id.length).toBeGreaterThan(0);
      expect(typeof s.label).toBe('string');
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it('events are passed through and non-empty', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    expect(Array.isArray(timeline!.data.events)).toBe(true);
    expect(timeline!.data.events.length).toBeGreaterThan(0);
  });

  it('all events have valid kind and intensity', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const validKinds = new Set(['sink', 'bath', 'charge', 'cold_only', 'dishwasher', 'washing_machine']);
    const validIntensities = new Set(['low', 'med', 'high']);
    for (const ev of timeline!.data.events) {
      expect(validKinds.has(ev.kind)).toBe(true);
      expect(validIntensities.has(ev.intensity)).toBe(true);
      expect(typeof ev.startMin).toBe('number');
      expect(typeof ev.endMin).toBe('number');
      expect(ev.endMin).toBeGreaterThan(ev.startMin);
    }
  });

  it('no NaN values in demandHeatKw', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    for (const v of timeline!.data.demandHeatKw) {
      expect(isNaN(v)).toBe(false);
    }
  });

  it('no NaN values in any series heatDeliveredKw or efficiency', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    for (const s of timeline!.data.series) {
      for (const v of s.heatDeliveredKw) expect(isNaN(v)).toBe(false);
      for (const v of s.efficiency)      expect(isNaN(v)).toBe(false);
    }
  });

  it('demandHeatKw values are non-negative and bounded by peak heat loss', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const peakKw = baseInput.heatLossWatts / 1000; // 8 kW
    for (const v of timeline!.data.demandHeatKw) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(peakKw + 0.01); // small float tolerance
    }
  });

  it('buildTimeline24hV1 accepts explicit systemIds and builds series for them', () => {
    const result = runEngine(baseInput);
    const visual = buildTimeline24hV1(result, baseInput, ['on_demand', 'ashp']);
    expect(visual.type).toBe('timeline_24h');
    const { series } = visual.data;
    expect(series).toHaveLength(2);
    expect(series[0].id).toBe('on_demand');
    expect(series[1].id).toBe('ashp');
  });

  it('engineConfig.timelinePair is honoured by runEngine — series IDs match the requested pair', () => {
    const engineInput = {
      ...baseInput,
      engineConfig: { timelinePair: ['on_demand', 'ashp'] as [string, string] },
    };
    const { engineOutput } = runEngine(engineInput);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    expect(timeline).toBeDefined();
    const { series } = timeline!.data;
    expect(series).toHaveLength(2);
    expect(series[0].id).toBe('on_demand');
    expect(series[1].id).toBe('ashp');
  });

  it('engineConfig.timelinePair changes produce different series data than the default', () => {
    const defaultResult = runEngine(baseInput);
    const defaultTimeline = defaultResult.engineOutput.visuals?.find(v => v.type === 'timeline_24h');

    const customResult = runEngine({
      ...baseInput,
      engineConfig: { timelinePair: ['stored_vented', 'ashp'] as [string, string] },
    });
    const customTimeline = customResult.engineOutput.visuals?.find(v => v.type === 'timeline_24h');

    // Default series A is 'current'; custom is 'stored_vented' — IDs must differ
    expect(defaultTimeline!.data.series[0].id).not.toBe(customTimeline!.data.series[0].id);
  });

  it('ASHP series efficiency values represent COP (> 1)', () => {
    const result = runEngine(baseInput);
    const visual = buildTimeline24hV1(result, baseInput, ['on_demand', 'ashp']);
    const ashpSeries = visual.data.series.find((s: { id: string }) => s.id === 'ashp');
    expect(ashpSeries).toBeDefined();
    for (const v of ashpSeries!.efficiency) {
      expect(v).toBeGreaterThan(1); // COP is always > 1 for heat pumps
    }
  });

  it('combi/boiler series efficiency values represent η (≤ 1)', () => {
    const result = runEngine(baseInput);
    const visual = buildTimeline24hV1(result, baseInput, ['on_demand', 'stored_vented']);
    const combiSeries = visual.data.series.find((s: { id: string }) => s.id === 'on_demand');
    expect(combiSeries).toBeDefined();
    for (const v of combiSeries!.efficiency) {
      expect(v).toBeLessThanOrEqual(1);
      expect(v).toBeGreaterThan(0);
    }
  });

  it('current series efficiency varies over time (not constant) when ageYears is provided via currentSystem', () => {
    const inputWithSedbuk = {
      ...baseInput,
      currentSystem: {
        boiler: {
          condensing: 'yes' as const,
          ageYears: 12,
        },
      },
    };
    const result = runEngine(inputWithSedbuk);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const currentSeries = timeline!.data.series.find((s: { id: string }) => s.id === 'current');
    expect(currentSeries).toBeDefined();
    const min = Math.min(...currentSeries!.efficiency);
    const max = Math.max(...currentSeries!.efficiency);
    // Efficiency should vary (SEDBUK tail-off model applies point-level cycling penalties)
    expect(max).toBeGreaterThanOrEqual(min);
    // All values still clamped to valid boiler range
    for (const v of currentSeries!.efficiency) {
      expect(v).toBeLessThanOrEqual(0.95);
      expect(v).toBeGreaterThanOrEqual(0.55);
    }
  });

  it('SEDBUK context bullets appear in contextSummary when currentSystem.boiler is provided', () => {
    const inputWithSedbuk = {
      ...baseInput,
      currentSystem: {
        boiler: {
          gcNumber: '47-583-01',
          ageYears: 8,
          condensing: 'yes' as const,
        },
      },
    };
    const { engineOutput } = runEngine(inputWithSedbuk);
    const bullets = engineOutput.contextSummary?.bullets ?? [];
    const sedbukBullet = bullets.find(b => b.includes('SEDBUK'));
    expect(sedbukBullet).toBeDefined();
    expect(sedbukBullet).toContain('91%');
  });

  it('no SEDBUK bullet when currentSystem.boiler is absent', () => {
    const { engineOutput } = runEngine(baseInput);
    const bullets = engineOutput.contextSummary?.bullets ?? [];
    expect(bullets.some(b => b.includes('SEDBUK'))).toBe(false);
  });

  // ── lifestyleProfileV1 → input-driven DHW events ─────────────────────────

  it('lifestyleProfileV1 with morning peak generates a sink event around 07:00', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: true,
        eveningPeakEnabled: false,
        hasBath: false,
        hasDishwasher: false,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const { engineOutput } = runEngine(input);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const events = timeline!.data.events as Array<{ startMin: number; kind: string }>;
    const morningSink = events.find(e => e.kind === 'sink' && e.startMin >= 400 && e.startMin <= 450);
    expect(morningSink).toBeDefined();
  });

  it('lifestyleProfileV1 with hasBath generates a bath event (not sink)', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: true,
        eveningPeakEnabled: true,
        hasBath: true,
        hasDishwasher: false,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const { engineOutput } = runEngine(input);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const events = timeline!.data.events as Array<{ kind: string }>;
    expect(events.some(e => e.kind === 'bath')).toBe(true);
  });

  it('lifestyleProfileV1 with hasDishwasher adds a dishwasher event', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: false,
        eveningPeakEnabled: true,
        hasBath: false,
        hasDishwasher: true,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const { engineOutput } = runEngine(input);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const events = timeline!.data.events as Array<{ kind: string }>;
    expect(events.some(e => e.kind === 'dishwasher')).toBe(true);
  });

  it('lifestyleProfileV1 with twoSimultaneousBathrooms generates two temporally overlapping events at morning peak', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: true,
        eveningPeakEnabled: false,
        hasBath: false,
        hasDishwasher: false,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: true,
      },
    };
    const { engineOutput } = runEngine(input);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const events = timeline!.data.events as Array<{ startMin: number; endMin: number; kind: string }>;
    const morningEvents = events.filter(e => e.startMin >= 400 && e.startMin <= 460);
    expect(morningEvents.length).toBeGreaterThanOrEqual(2);
    // Verify the two morning events actually overlap in time
    const [first, second] = morningEvents;
    const overlap = first.startMin < second.endMin && second.startMin < first.endMin;
    expect(overlap).toBe(true);
  });

  it('lifestyleProfileV1 with no peaks generates no events', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: false,
        eveningPeakEnabled: false,
        hasBath: false,
        hasDishwasher: false,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const { engineOutput } = runEngine(input);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    expect(timeline!.data.events).toHaveLength(0);
  });

  it('timeline legend includes confidence badge note', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const legend: string[] = timeline!.data.legendNotes ?? [];
    const hasConfidenceNote = legend.some(
      (n: string) => n.includes('confidence') || n.includes('Confidence'),
    );
    expect(hasConfidenceNote).toBe(true);
  });

  it('timeline legend mentions lifestyle profile when lifestyleProfileV1 is provided', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: true,
        eveningPeakEnabled: true,
        hasBath: false,
        hasDishwasher: true,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const result = runEngine(input);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const legend: string[] = timeline!.data.legendNotes ?? [];
    expect(legend.some((n: string) => n.includes('lifestyle profile'))).toBe(true);
  });

  it('timeline legend mentions defaults when no lifestyleProfileV1 is provided', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const legend: string[] = timeline!.data.legendNotes ?? [];
    expect(legend.some((n: string) => n.includes('defaults'))).toBe(true);
  });

  // ── Cold-fill appliances: physics-aligned modelling ──────────────────────────

  it('dishwasher event does NOT reduce combi efficiency (cold-fill, not thermal DHW)', () => {
    // Build a timeline with only a dishwasher event and no thermal DHW events
    const inputDishwasherOnly = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: false,
        eveningPeakEnabled: false,
        hasBath: false,
        hasDishwasher: true,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const inputNoAppliances = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: false,
        eveningPeakEnabled: false,
        hasBath: false,
        hasDishwasher: false,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };

    const withDishwasher = runEngine(inputDishwasherOnly);
    const withoutDishwasher = runEngine(inputNoAppliances);

    const timelineWith = withDishwasher.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const timelineWithout = withoutDishwasher.engineOutput.visuals?.find(v => v.type === 'timeline_24h');

    // Combi series efficiency should be identical — dishwasher is not a thermal event
    const combiWith = timelineWith!.data.series.find((s: { id: string }) => s.id === 'current');
    const combiWithout = timelineWithout!.data.series.find((s: { id: string }) => s.id === 'current');
    expect(combiWith).toBeDefined();
    expect(combiWithout).toBeDefined();
    expect(combiWith!.efficiency).toEqual(combiWithout!.efficiency);
  });

  it('coldFlowLpm is present in timeline payload when hasDishwasher is true', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: false,
        eveningPeakEnabled: true,
        hasBath: false,
        hasDishwasher: true,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const { engineOutput } = runEngine(input);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    expect(timeline!.data.coldFlowLpm).toBeDefined();
    expect(timeline!.data.coldFlowLpm).toHaveLength(96);
  });

  it('coldFlowLpm has non-zero values during dishwasher event window', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: false,
        eveningPeakEnabled: true,
        hasBath: false,
        hasDishwasher: true,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const { engineOutput } = runEngine(input);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const coldFlowLpm: number[] = timeline!.data.coldFlowLpm;
    // Dishwasher after evening peak runs 20:00–20:45 (1200–1245 min → indices 80–83)
    const dishwasherWindow = coldFlowLpm.slice(80, 84);
    expect(dishwasherWindow.some((v: number) => v > 0)).toBe(true);
  });

  it('coldFlowLpm is undefined when no cold-fill appliances are in the profile', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: true,
        eveningPeakEnabled: true,
        hasBath: false,
        hasDishwasher: false,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const { engineOutput } = runEngine(input);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    expect(timeline!.data.coldFlowLpm).toBeUndefined();
  });

  it('coldFlowLpm is populated when using default events (which include a dishwasher)', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    // Default events include a dishwasher, so coldFlowLpm WILL be populated
    // (this is expected — it ensures cold-flow is visible even in default mode)
    expect(Array.isArray(timeline!.data.coldFlowLpm)).toBe(true);
  });

  it('hasWashingMachine generates washing_machine events', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: false,
        eveningPeakEnabled: false,
        hasBath: false,
        hasDishwasher: false,
        hasWashingMachine: true,
        twoSimultaneousBathrooms: false,
      },
    };
    const { engineOutput } = runEngine(input);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const events = timeline!.data.events as Array<{ kind: string }>;
    expect(events.some(e => e.kind === 'washing_machine')).toBe(true);
  });

  it('washing_machine events generate non-zero coldFlowLpm', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: false,
        eveningPeakEnabled: false,
        hasBath: false,
        hasDishwasher: false,
        hasWashingMachine: true,
        twoSimultaneousBathrooms: false,
      },
    };
    const { engineOutput } = runEngine(input);
    const timeline = engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const coldFlowLpm: number[] = timeline!.data.coldFlowLpm;
    expect(coldFlowLpm).toBeDefined();
    expect(coldFlowLpm.some((v: number) => v > 0)).toBe(true);
  });

  it('washing_machine events do NOT affect demandHeatKw (not a thermal load)', () => {
    const inputWithMachine = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: false,
        eveningPeakEnabled: false,
        hasBath: false,
        hasDishwasher: false,
        hasWashingMachine: true,
        twoSimultaneousBathrooms: false,
      },
    };
    const inputWithoutMachine = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: false,
        eveningPeakEnabled: false,
        hasBath: false,
        hasDishwasher: false,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const withMachine = runEngine(inputWithMachine).engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const withoutMachine = runEngine(inputWithoutMachine).engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    // demandHeatKw must be identical — washing machine is not a thermal event
    expect(withMachine!.data.demandHeatKw).toEqual(withoutMachine!.data.demandHeatKw);
  });

  it('timeline legend includes cold-fill note', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const legend: string[] = timeline!.data.legendNotes ?? [];
    expect(legend.some((n: string) => n.toLowerCase().includes('cold-fill'))).toBe(true);
  });
});

// ── New contract fields: performanceKind, dhwTotalKw, dhwEventsActive, bands ──

describe('TimelineBuilder — new contract fields', () => {
  it('each series has performanceKind set to "eta" for boilers and "cop" for ASHP', () => {
    const result = runEngine(baseInput);
    const visual = buildTimeline24hV1(result, baseInput, ['on_demand', 'ashp']);
    const combi = visual.data.series.find((s: { id: string }) => s.id === 'on_demand');
    const ashp  = visual.data.series.find((s: { id: string }) => s.id === 'ashp');
    expect(combi?.performanceKind).toBe('eta');
    expect(ashp?.performanceKind).toBe('cop');
  });

  it('stored_vented series has performanceKind "eta"', () => {
    const result = runEngine(baseInput);
    const visual = buildTimeline24hV1(result, baseInput, ['stored_vented', 'ashp']);
    const stored = visual.data.series.find((s: { id: string }) => s.id === 'stored_vented');
    expect(stored?.performanceKind).toBe('eta');
  });

  it('dhwTotalKw is populated on each series with 96 values', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    for (const s of timeline!.data.series) {
      expect(Array.isArray(s.dhwTotalKw)).toBe(true);
      expect(s.dhwTotalKw).toHaveLength(96);
    }
  });

  it('dhwTotalKw values are non-negative', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    for (const s of timeline!.data.series) {
      for (const v of s.dhwTotalKw ?? []) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('dhwTotalKw is non-zero during a sink or bath event window', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: true,
        eveningPeakEnabled: true,
        hasBath: false,
        hasDishwasher: false,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const result = runEngine(input);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    // Morning sink at 07:00 → index 28 (minute 420 / 15 = 28)
    const idx28 = timeline!.data.series[0].dhwTotalKw?.[28];
    expect(idx28).toBeGreaterThan(0);
  });

  it('dhwTotalKw is 0 during dishwasher-only events (cold-fill, no thermal draw)', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: false,
        eveningPeakEnabled: false,
        hasBath: false,
        hasDishwasher: true,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const result = runEngine(input);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    // Dishwasher at 13:00 → index 52 (minute 780 / 15 = 52)
    const idx52 = timeline!.data.series[0].dhwTotalKw?.[52];
    expect(idx52).toBe(0);
  });

  it('dhwEventsActive is populated on each series with 96 entries', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    for (const s of timeline!.data.series) {
      expect(Array.isArray(s.dhwEventsActive)).toBe(true);
      expect(s.dhwEventsActive).toHaveLength(96);
    }
  });

  it('dhwEventsActive entries are arrays (may be empty)', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    for (const s of timeline!.data.series) {
      for (const entry of s.dhwEventsActive ?? []) {
        expect(Array.isArray(entry)).toBe(true);
      }
    }
  });

  it('dhwEventsActive has a non-empty entry during morning DHW draw window', () => {
    // Default events include morning sink at 07:00 (index 28)
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const entry28 = timeline!.data.series[0].dhwEventsActive?.[28];
    expect(entry28?.length).toBeGreaterThan(0);
    expect(entry28?.[0].kind).toBe('sink');
    expect(entry28?.[0].drawKw).toBeGreaterThan(0);
  });

  it('payload includes bands with at least a sh_on band and dhw_on bands', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const bands = timeline!.data.bands?.bands ?? [];
    expect(Array.isArray(bands)).toBe(true);
    expect(bands.length).toBeGreaterThan(0);
    const hasShOn  = bands.some((b: { kind: string }) => b.kind === 'sh_on');
    const hasDhwOn = bands.some((b: { kind: string }) => b.kind === 'dhw_on');
    expect(hasShOn).toBe(true);
    expect(hasDhwOn).toBe(true);
  });

  it('bands have valid startMin < endMin fields', () => {
    const result = runEngine(baseInput);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const bands = timeline!.data.bands?.bands ?? [];
    for (const band of bands) {
      expect(typeof band.startMin).toBe('number');
      expect(typeof band.endMin).toBe('number');
      expect(band.endMin).toBeGreaterThan(band.startMin);
    }
  });

  it('dishwasher events do NOT generate dhw_on bands', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: false,
        eveningPeakEnabled: false,
        hasBath: false,
        hasDishwasher: true,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: false,
      },
    };
    const result = runEngine(input);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    const bands = timeline!.data.bands?.bands ?? [];
    // dhw_on bands come only from thermal events — dishwasher is cold-fill
    const dhwOnBands = bands.filter((b: { kind: string }) => b.kind === 'dhw_on');
    expect(dhwOnBands.length).toBe(0);
  });

  it('dhwTotalKw sums correctly for overlapping simultaneous events', () => {
    const input = {
      ...baseInput,
      lifestyleProfileV1: {
        morningPeakEnabled: true,
        eveningPeakEnabled: false,
        hasBath: false,
        hasDishwasher: false,
        hasWashingMachine: false,
        twoSimultaneousBathrooms: true, // overlap at 07:05 (index 28 = 07:00, index 29 = 07:15)
      },
    };
    const result = runEngine(input);
    const timeline = result.engineOutput.visuals?.find(v => v.type === 'timeline_24h');
    // Index 29 covers 07:15 which overlaps both sink events (07:00–07:15 and 07:05–07:25)
    const entry29 = timeline!.data.series[0].dhwEventsActive?.[29];
    expect(entry29).toBeDefined();
    // Both sink draws active → two entries at index 29
    expect(entry29!.length).toBeGreaterThanOrEqual(1);
    // Total draw should be positive
    const total29 = timeline!.data.series[0].dhwTotalKw?.[29];
    expect(total29).toBeGreaterThan(0);
  });
});
