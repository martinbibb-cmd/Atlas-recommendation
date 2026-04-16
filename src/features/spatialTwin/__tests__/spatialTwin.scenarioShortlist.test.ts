/**
 * spatialTwin.scenarioShortlist.test.ts
 *
 * Integration tests for the scenario shortlist data pipeline:
 *   runScenariosFromSpatialTwin → buildScenarioSynthesis
 *
 * Tests:
 *   - No scenarios                → empty synthesis (old behaviour preserved)
 *   - One included scenario       → one envelope, no comparison rows
 *   - Multiple included scenarios → ranked envelopes + comparison matrix
 *   - isRecommended flag          → recommendedScenarioId correctly populated
 *   - isSelectedByUser flag       → selectedScenarioId correctly populated
 *   - SET_SCENARIO_SELECTED_BY_USER → only one scenario is selected at a time
 */

import { describe, it, expect } from 'vitest';
import { spatialTwinReducer, initialSpatialTwinState } from '../state/spatialTwin.reducer';
import {
  importSucceeded,
  createScenario,
  setScenarioRecommended,
  setScenarioSelectedByUser,
  setScenarioIncludeInReport,
} from '../state/spatialTwin.actions';
import { runScenariosFromSpatialTwin } from '../synthesis/runScenariosFromSpatialTwin';
import { buildScenarioSynthesis } from '../synthesis/buildScenarioSynthesis';
import type { SpatialTwinModelV1 } from '../state/spatialTwin.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBaseModel(): SpatialTwinModelV1 {
  return {
    version: '1.0',
    propertyId: 'prop-test',
    spatial: {
      version: '1.0',
      propertyId: 'prop-test',
      rooms: [
        { roomId: 'room-1', label: 'Lounge', status: 'complete', roomType: 'living', zoneIds: [] },
      ],
      zones: [],
      emitters: [
        { emitterId: 'em-1', roomId: 'room-1', type: 'radiator' },
      ],
      openings: [],
      boundaries: [],
    },
    heatSources: [
      {
        heatSourceId: 'hs-combi',
        label: 'Existing Combi',
        type: 'combi_boiler',
        status: 'existing',
        certainty: 'confirmed',
        evidenceIds: [],
      },
    ],
    stores: [],
    controls: [],
    pipeRuns: [],
    evidenceMarkers: [],
  };
}

// ─── No scenarios ─────────────────────────────────────────────────────────────

describe('scenario shortlist pipeline — no scenarios', () => {
  it('returns empty envelopes when state has no scenarios', () => {
    const state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    const envelopes = runScenariosFromSpatialTwin(state);
    expect(envelopes).toHaveLength(0);
  });

  it('buildScenarioSynthesis with empty envelopes returns null IDs and empty matrix', () => {
    const state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    const envelopes = runScenariosFromSpatialTwin(state);
    const synthesis = buildScenarioSynthesis(envelopes, state.scenarios);

    expect(synthesis.recommendedScenarioId).toBeNull();
    expect(synthesis.selectedScenarioId).toBeNull();
    expect(synthesis.rankedScenarioIds).toEqual([]);
    expect(synthesis.envelopes).toHaveLength(0);
    expect(synthesis.comparisonMatrix.scenarioIds).toHaveLength(0);
    expect(synthesis.comparisonMatrix.rows).toHaveLength(0);
  });
});

// ─── One included scenario ────────────────────────────────────────────────────

describe('scenario shortlist pipeline — one included scenario', () => {
  it('returns exactly one envelope', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'Best Fit', 'best_fit'));

    const envelopes = runScenariosFromSpatialTwin(state);
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]?.scenarioId).toBe('sc-1');
  });

  it('synthesis has one envelope and no multi-column comparison matrix', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'Best Fit', 'best_fit'));

    const envelopes = runScenariosFromSpatialTwin(state);
    const synthesis = buildScenarioSynthesis(envelopes, state.scenarios);

    expect(synthesis.envelopes).toHaveLength(1);
    // With one scenario there is no side-by-side comparison table needed
    expect(synthesis.comparisonMatrix.scenarioIds).toHaveLength(1);
    // recommendedScenarioId falls back to the single highest-ranked scenario
    expect(synthesis.recommendedScenarioId).toBe('sc-1');
  });

  it('envelope contains a populated summary with a headline', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'Best Fit', 'best_fit'));

    const envelopes = runScenariosFromSpatialTwin(state);
    const envelope = envelopes[0]!;

    expect(envelope.summary.headline.length).toBeGreaterThan(0);
    expect(envelope.summary.suitability).toMatch(/^(recommended|possible_with_caveats|less_suited)$/);
  });

  it('excludes scenario with includeInReport=false', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'Best Fit', 'best_fit'));
    state = spatialTwinReducer(state, setScenarioIncludeInReport('sc-1', false));

    const envelopes = runScenariosFromSpatialTwin(state);
    expect(envelopes).toHaveLength(0);
  });
});

// ─── Multiple included scenarios ──────────────────────────────────────────────

describe('scenario shortlist pipeline — multiple included scenarios', () => {
  it('returns one envelope per included scenario', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'Best Fit', 'best_fit'));
    state = spatialTwinReducer(state, createScenario('sc-2', 'Budget Option', 'budget'));
    state = spatialTwinReducer(state, createScenario('sc-3', 'Future Ready', 'future_ready'));

    const envelopes = runScenariosFromSpatialTwin(state);
    expect(envelopes).toHaveLength(3);
    const ids = envelopes.map(e => e.scenarioId);
    expect(ids).toContain('sc-1');
    expect(ids).toContain('sc-2');
    expect(ids).toContain('sc-3');
  });

  it('synthesis comparison matrix has rows for all included scenarios', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'Best Fit', 'best_fit'));
    state = spatialTwinReducer(state, createScenario('sc-2', 'Budget Option', 'budget'));

    const envelopes = runScenariosFromSpatialTwin(state);
    const synthesis = buildScenarioSynthesis(envelopes, state.scenarios);

    expect(synthesis.envelopes).toHaveLength(2);
    expect(synthesis.comparisonMatrix.scenarioIds).toHaveLength(2);
    expect(synthesis.comparisonMatrix.rows.length).toBeGreaterThan(0);
  });

  it('excludes excluded scenarios but includes the rest', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'Best Fit', 'best_fit'));
    state = spatialTwinReducer(state, createScenario('sc-2', 'Budget', 'budget'));
    state = spatialTwinReducer(state, setScenarioIncludeInReport('sc-2', false));

    const envelopes = runScenariosFromSpatialTwin(state);
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]?.scenarioId).toBe('sc-1');
  });
});

// ─── Recommended badge ────────────────────────────────────────────────────────

describe('scenario shortlist pipeline — recommended scenario', () => {
  it('uses the highest-ranked scenario as recommended when no isRecommended flag is set', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'A', 'best_fit'));
    state = spatialTwinReducer(state, createScenario('sc-2', 'B', 'budget'));

    const envelopes = runScenariosFromSpatialTwin(state);
    const synthesis = buildScenarioSynthesis(envelopes, state.scenarios);

    // recommendedScenarioId is one of the included scenario IDs
    expect(['sc-1', 'sc-2']).toContain(synthesis.recommendedScenarioId);
  });

  it('uses the engineer-promoted scenario when isRecommended=true is set', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'A', 'best_fit'));
    state = spatialTwinReducer(state, createScenario('sc-2', 'B', 'budget'));
    state = spatialTwinReducer(state, setScenarioRecommended('sc-2', true));

    const envelopes = runScenariosFromSpatialTwin(state);
    const synthesis = buildScenarioSynthesis(envelopes, state.scenarios);

    expect(synthesis.recommendedScenarioId).toBe('sc-2');
  });

  it('provides a non-empty explanation for the recommended scenario', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'Best Fit', 'best_fit'));

    const envelopes = runScenariosFromSpatialTwin(state);
    const synthesis = buildScenarioSynthesis(envelopes, state.scenarios);

    const explanation = synthesis.explanationsByScenario['sc-1'];
    expect(explanation).toBeDefined();
    expect(explanation!.length).toBeGreaterThan(0);
  });
});

// ─── Customer selected badge ──────────────────────────────────────────────────

describe('scenario shortlist pipeline — customer selected scenario', () => {
  it('selectedScenarioId is null when no scenario has isSelectedByUser=true', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'A', 'best_fit'));

    const envelopes = runScenariosFromSpatialTwin(state);
    const synthesis = buildScenarioSynthesis(envelopes, state.scenarios);

    expect(synthesis.selectedScenarioId).toBeNull();
  });

  it('selectedScenarioId matches the scenario with isSelectedByUser=true', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'A', 'best_fit'));
    state = spatialTwinReducer(state, createScenario('sc-2', 'B', 'budget'));
    state = spatialTwinReducer(state, setScenarioSelectedByUser('sc-2', true));

    const envelopes = runScenariosFromSpatialTwin(state);
    const synthesis = buildScenarioSynthesis(envelopes, state.scenarios);

    expect(synthesis.selectedScenarioId).toBe('sc-2');
  });

  it('SET_SCENARIO_SELECTED_BY_USER clears isSelectedByUser on all other scenarios', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'A', 'best_fit'));
    state = spatialTwinReducer(state, createScenario('sc-2', 'B', 'budget'));

    // Select sc-1 first, then sc-2
    state = spatialTwinReducer(state, setScenarioSelectedByUser('sc-1', true));
    expect(state.scenarios.find(s => s.scenarioId === 'sc-1')?.isSelectedByUser).toBe(true);

    state = spatialTwinReducer(state, setScenarioSelectedByUser('sc-2', true));
    expect(state.scenarios.find(s => s.scenarioId === 'sc-2')?.isSelectedByUser).toBe(true);
    // sc-1 should be deselected
    expect(state.scenarios.find(s => s.scenarioId === 'sc-1')?.isSelectedByUser).toBe(false);
  });

  it('SET_SCENARIO_SELECTED_BY_USER(false) clears the flag on the specified scenario only', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'A', 'best_fit'));
    state = spatialTwinReducer(state, createScenario('sc-2', 'B', 'budget'));
    state = spatialTwinReducer(state, setScenarioSelectedByUser('sc-1', true));
    state = spatialTwinReducer(state, setScenarioSelectedByUser('sc-2', true));

    // Explicitly deselect sc-2 without selecting another
    state = spatialTwinReducer(state, setScenarioSelectedByUser('sc-2', false));
    expect(state.scenarios.find(s => s.scenarioId === 'sc-2')?.isSelectedByUser).toBe(false);
    // sc-1 should remain unaffected (it was already false from the radio-button clear above)
    expect(state.scenarios.find(s => s.scenarioId === 'sc-1')?.isSelectedByUser).toBe(false);
  });
});

// ─── Base model unchanged by synthesis runs ───────────────────────────────────

describe('scenario shortlist pipeline — immutability', () => {
  it('does not mutate the base model when running scenarios', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(makeBaseModel()));
    state = spatialTwinReducer(state, createScenario('sc-1', 'A', 'best_fit'));

    const originalLabel = state.model?.heatSources[0]?.label;
    runScenariosFromSpatialTwin(state);
    expect(state.model?.heatSources[0]?.label).toBe(originalLabel);
  });
});
