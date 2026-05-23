import { describe, expect, it } from 'vitest';
import {
  buildDhwRecoveryMetricsV1,
  buildHydraulicConfidenceReportV1,
  buildLegoTechnixExplainabilityReportV1,
  runLegoTechnixScenarioV1,
} from '..';
import { branchingBypassGraph } from '../fixtures/branchingBypassGraph';
import {
  simpleRegularBoilerGraph,
  simpleRegularBoilerInitialStateV1,
} from '../fixtures/simpleRegularBoilerGraph';
import {
  sPlanControlGraph,
  sPlanControlInitialStateV1,
} from '../fixtures/sPlanControlGraph';
import type { LegoTechnixSimulationStateV1 } from '../simulation/LegoTechnixSimulationStateV1';

function cloneState(state: LegoTechnixSimulationStateV1): LegoTechnixSimulationStateV1 {
  return JSON.parse(JSON.stringify(state)) as LegoTechnixSimulationStateV1;
}

function emptyState(): LegoTechnixSimulationStateV1 {
  return {
    schemaVersion: '1.0',
    tickIndex: 0,
    wallClockMs: 0,
    componentStates: [],
    edgeStates: [],
    domainStates: [],
  };
}

describe('buildLegoTechnixExplainabilityReportV1', () => {
  it('builds report from a valid scenario result', () => {
    const scenarioResult = runLegoTechnixScenarioV1({
      graph: sPlanControlGraph,
      initialState: cloneState(sPlanControlInitialStateV1),
      durationSeconds: 1800,
      timestepSeconds: 60,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
    });

    const report = buildLegoTechnixExplainabilityReportV1({
      graph: sPlanControlGraph,
      scenarioResult,
    });

    expect(report.schemaVersion).toBe('1.0');
    expect(report.systemSummary.heading).toBe('System summary');
    expect(report.causalNotes.length).toBeGreaterThan(0);
  });

  it('system summary detects heat source and storage model', () => {
    const initialState = cloneState(simpleRegularBoilerInitialStateV1);
    const storeState = initialState.componentStates.find((state) => state.componentId === 'stored_dhw_volume');
    if (!storeState) {
      throw new Error('Stored DHW state missing');
    }
    storeState.storageModel = 'stratified';

    const scenarioResult = runLegoTechnixScenarioV1({
      graph: simpleRegularBoilerGraph,
      initialState,
      durationSeconds: 1200,
      timestepSeconds: 60,
      sampleSelectors: {
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
    });

    const report = buildLegoTechnixExplainabilityReportV1({
      graph: simpleRegularBoilerGraph,
      scenarioResult,
    });

    expect(report.systemSummary.points.join(' ')).toContain('gas_boiler');
    expect(report.systemSummary.points.join(' ')).toContain('stratified');
  });

  it('active circuit summary includes branch, bypass, and deadhead evidence where present', () => {
    const scenarioResult = runLegoTechnixScenarioV1({
      graph: branchingBypassGraph,
      initialState: emptyState(),
      durationSeconds: 1800,
      timestepSeconds: 300,
      sampleSelectors: {
        sourceComponentId: 'regular_boiler',
      },
      scheduledEvents: [
        {
          type: 'control_override',
          atSecond: 0,
          durationSeconds: 1200,
          componentId: 'zone_valve',
          override: { position: 'closed' },
        },
        {
          type: 'control_override',
          atSecond: 600,
          durationSeconds: 600,
          componentId: 'auto_bypass_valve',
          override: { position: 'closed' },
        },
      ],
    });

    const report = buildLegoTechnixExplainabilityReportV1({
      graph: branchingBypassGraph,
      scenarioResult,
    });

    const summaryText = report.activeCircuitSummary.points.join(' ');
    expect(summaryText).toContain('Bypass events:');
    expect(summaryText).not.toContain('Bypass events: none observed.');
    expect(summaryText).toContain('Deadhead events:');
    expect(summaryText).not.toContain('Deadhead events: none observed.');
  });

  it('controls summary explains thermostat-driven demand', () => {
    const scenarioResult = runLegoTechnixScenarioV1({
      graph: sPlanControlGraph,
      initialState: cloneState(sPlanControlInitialStateV1),
      durationSeconds: 1200,
      timestepSeconds: 60,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
    });

    const report = buildLegoTechnixExplainabilityReportV1({
      graph: sPlanControlGraph,
      scenarioResult,
    });

    expect(report.controlDecisionSummary.points.join(' ')).toContain('Room thermostat demand calls:');
  });

  it('heat source summary distinguishes firing vs held-off periods', () => {
    const scenarioResult = runLegoTechnixScenarioV1({
      graph: sPlanControlGraph,
      initialState: cloneState(sPlanControlInitialStateV1),
      durationSeconds: 1800,
      timestepSeconds: 60,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
      scheduledEvents: [
        {
          type: 'control_override',
          atSecond: 0,
          durationSeconds: 600,
          componentId: 'heating_zone_valve',
          override: { position: 'closed' },
        },
        {
          type: 'control_override',
          atSecond: 0,
          durationSeconds: 600,
          componentId: 'cylinder_zone_valve',
          override: { position: 'closed' },
        },
      ],
    });

    const report = buildLegoTechnixExplainabilityReportV1({
      graph: sPlanControlGraph,
      scenarioResult,
    });

    const summaryText = report.heatSourceSummary.points.join(' ');
    expect(summaryText).toContain('Heat source fired:');
    expect(summaryText).toContain('Heat source held off:');
    expect(summaryText).not.toContain('Heat source fired: none observed.');
    expect(summaryText).not.toContain('Heat source held off: none observed.');
  });

  it('room summary reports start/end temperature', () => {
    const scenarioResult = runLegoTechnixScenarioV1({
      graph: sPlanControlGraph,
      initialState: cloneState(sPlanControlInitialStateV1),
      durationSeconds: 1200,
      timestepSeconds: 60,
      sampleSelectors: {
        roomComponentId: 'living_room',
        sourceComponentId: 'regular_boiler',
      },
    });

    const report = buildLegoTechnixExplainabilityReportV1({
      graph: sPlanControlGraph,
      scenarioResult,
    });

    expect(report.roomHeatingSummary.points.join(' ')).toContain('Room temperature start/end:');
    expect(report.roomHeatingSummary.points.join(' ')).toContain('->');
  });

  it('DHW summary includes draw-off and recovery evidence', () => {
    const scenarioResult = runLegoTechnixScenarioV1({
      graph: simpleRegularBoilerGraph,
      initialState: cloneState(simpleRegularBoilerInitialStateV1),
      durationSeconds: 3600,
      timestepSeconds: 60,
      sampleSelectors: {
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
      scheduledEvents: [
        {
          type: 'dhw_draw_off',
          atSecond: 600,
          durationSeconds: 900,
          drawOffComponentId: 'domestic_hot_draw_off',
          drawOffFlowLpm: 12,
          mixedOutletTargetTemperatureC: 40,
          coldInletTemperatureC: 10,
        },
      ],
    });
    const dhwRecoveryMetrics = buildDhwRecoveryMetricsV1(scenarioResult);

    const report = buildLegoTechnixExplainabilityReportV1({
      graph: simpleRegularBoilerGraph,
      scenarioResult,
      dhwRecoveryMetrics,
    });

    const summaryText = report.dhwSummary.points.join(' ');
    expect(summaryText).toContain('Draw-off events:');
    expect(summaryText).toContain('Recovery after draw-off:');
    expect(report.dhwSummary.evidenceIds.some((evidenceId) => evidenceId.includes('dhw_draw_off'))).toBe(true);
  });

  it('condensing summary uses runtime return evidence when present', () => {
    const scenarioResult = runLegoTechnixScenarioV1({
      graph: sPlanControlGraph,
      initialState: cloneState(sPlanControlInitialStateV1),
      durationSeconds: 1800,
      timestepSeconds: 60,
      sampleSelectors: {
        sourceComponentId: 'regular_boiler',
      },
    });

    const report = buildLegoTechnixExplainabilityReportV1({
      graph: sPlanControlGraph,
      scenarioResult,
    });

    expect(report.returnTemperatureSummary.points.join(' ')).toContain('Runtime return telemetry available: yes.');
    expect(report.condensingSummary.evidenceIds.some((evidenceId) => evidenceId.includes('condensing'))).toBe(true);
  });

  it('confidence summary incorporates hydraulic confidence report', () => {
    const scenarioResult = runLegoTechnixScenarioV1({
      graph: sPlanControlGraph,
      initialState: cloneState(sPlanControlInitialStateV1),
      durationSeconds: 1200,
      timestepSeconds: 60,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
    });
    const dhwRecoveryMetrics = buildDhwRecoveryMetricsV1(scenarioResult);
    const hydraulicConfidenceReport = buildHydraulicConfidenceReportV1(
      sPlanControlGraph,
      { ...scenarioResult, dhwRecoveryMetrics },
    );

    const report = buildLegoTechnixExplainabilityReportV1({
      graph: sPlanControlGraph,
      scenarioResult,
      dhwRecoveryMetrics,
      hydraulicConfidenceReport,
    });

    expect(report.confidenceSummary.points.join(' ')).toContain(`Overall confidence: ${hydraulicConfidenceReport.overallConfidence}.`);
    expect(report.confidenceSummary.points.join(' ')).toContain('Hydraulic confidence report linked: yes.');
  });

  it('causal notes are stable and evidence-backed', () => {
    const scenarioResult = runLegoTechnixScenarioV1({
      graph: sPlanControlGraph,
      initialState: cloneState(sPlanControlInitialStateV1),
      durationSeconds: 1800,
      timestepSeconds: 60,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
      scheduledEvents: [
        {
          type: 'dhw_draw_off',
          atSecond: 600,
          durationSeconds: 300,
          drawOffComponentId: 'domestic_hot_draw_off',
          drawOffFlowLpm: 10,
          mixedOutletTargetTemperatureC: 40,
          coldInletTemperatureC: 10,
        },
      ],
    });
    const dhwRecoveryMetrics = buildDhwRecoveryMetricsV1(scenarioResult);

    const first = buildLegoTechnixExplainabilityReportV1({
      graph: sPlanControlGraph,
      scenarioResult,
      dhwRecoveryMetrics,
    });
    const second = buildLegoTechnixExplainabilityReportV1({
      graph: sPlanControlGraph,
      scenarioResult,
      dhwRecoveryMetrics,
    });

    expect(first.causalNotes).toEqual(second.causalNotes);
    expect(first.causalNotes.length).toBeGreaterThan(0);
    expect(first.causalNotes.every((note) => note.evidenceIds.length > 0)).toBe(true);
  });

  it('emits no recommendation language', () => {
    const scenarioResult = runLegoTechnixScenarioV1({
      graph: sPlanControlGraph,
      initialState: cloneState(sPlanControlInitialStateV1),
      durationSeconds: 1200,
      timestepSeconds: 60,
      sampleSelectors: {
        roomComponentId: 'living_room',
        storedDhwComponentId: 'stored_dhw_volume',
        sourceComponentId: 'regular_boiler',
      },
    });

    const report = buildLegoTechnixExplainabilityReportV1({
      graph: sPlanControlGraph,
      scenarioResult,
    });

    const reportText = [
      ...report.systemSummary.points,
      ...report.activeCircuitSummary.points,
      ...report.controlDecisionSummary.points,
      ...report.heatSourceSummary.points,
      ...report.roomHeatingSummary.points,
      ...report.dhwSummary.points,
      ...report.returnTemperatureSummary.points,
      ...report.condensingSummary.points,
      ...report.warningsSummary.points,
      ...report.confidenceSummary.points,
      ...report.causalNotes.map((note) => note.message),
    ].join(' ');

    expect(reportText).not.toMatch(/\brecommend(?:ation|ed)?\b/i);
    expect(reportText).not.toMatch(/\bsuggest(?:ion|ed)?\b/i);
    expect(reportText).not.toMatch(/\bshould\b/i);
  });

  it('works without optional DHW and confidence inputs', () => {
    const scenarioResult = runLegoTechnixScenarioV1({
      graph: sPlanControlGraph,
      initialState: cloneState(sPlanControlInitialStateV1),
      durationSeconds: 600,
      timestepSeconds: 60,
      sampleSelectors: {
        sourceComponentId: 'regular_boiler',
      },
    });

    const report = buildLegoTechnixExplainabilityReportV1({
      graph: sPlanControlGraph,
      scenarioResult,
    });

    expect(report.dhwSummary.points.join(' ')).toContain('Recovery confidence: not provided.');
    expect(report.confidenceSummary.points.join(' ')).toContain('Hydraulic confidence report linked: no.');
  });
});
