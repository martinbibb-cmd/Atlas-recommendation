import { describe, it, expect } from 'vitest';
import { spatialTwinReducer, initialSpatialTwinState } from '../state/spatialTwin.reducer';
import {
  importSucceeded,
  createScenario,
  renameScenario,
  duplicateScenario,
  deleteScenario,
  setActiveScenario,
  applyScenarioPatch,
  setScenarioRecommended,
  setScenarioIncludeInReport,
} from '../state/spatialTwin.actions';
import {
  selectScenarioById,
  selectAllScenarios,
  selectRecommendedScenario,
  selectActiveScenarioPatches,
  selectActiveScenarioModel,
  selectScenariosForReport,
} from '../state/spatialTwinScenario.selectors';
import { applyScenarioPatches } from '../patches/applyScenarioPatches';
import { compareScenarios } from '../compare/compareScenarios';
import { projectSpatialTwinToEngineInput } from '../engine/projectSpatialTwinToEngineInput';
import type { SpatialTwinModelV1, AtlasSpatialPatchV1 } from '../state/spatialTwin.types';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeBaseModel(): SpatialTwinModelV1 {
  return {
    version: '1.0',
    propertyId: 'prop-1',
    spatial: {
      version: '1.0',
      propertyId: 'prop-1',
      rooms: [
        { roomId: 'room-1', label: 'Kitchen', status: 'draft', roomType: 'kitchen', zoneIds: [] },
        { roomId: 'room-2', label: 'Lounge', status: 'draft', roomType: 'living', zoneIds: [] },
      ],
      zones: [],
      emitters: [],
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

function makeLabelPatch(
  entityId: string,
  label: string,
  patchId = `patch-${entityId}`,
): AtlasSpatialPatchV1 {
  return {
    patchId,
    entityId,
    entityKind: 'heatSource',
    operation: 'set_label',
    payload: { label },
    appliedAt: '2024-06-01T10:00:00Z',
    sourceMode: 'proposed',
  };
}

function makeStatusPatch(
  entityId: string,
  status: string,
  patchId = `patch-status-${entityId}`,
): AtlasSpatialPatchV1 {
  return {
    patchId,
    entityId,
    entityKind: 'heatSource',
    operation: 'set_status',
    payload: { status },
    appliedAt: '2024-06-01T10:00:00Z',
    sourceMode: 'proposed',
  };
}

// ─── Reducer: scenario lifecycle ──────────────────────────────────────────────

describe('spatialTwinReducer — scenario lifecycle', () => {
  it('initial state has empty scenarios', () => {
    expect(initialSpatialTwinState.scenarios).toEqual([]);
    expect(initialSpatialTwinState.patchesByScenario).toEqual({});
    expect(initialSpatialTwinState.activeScenarioId).toBeNull();
  });

  it('CREATE_SCENARIO adds a scenario with empty patch list', () => {
    const state = spatialTwinReducer(
      initialSpatialTwinState,
      createScenario('sc-1', 'Best Fit', 'best_fit'),
    );
    expect(state.scenarios).toHaveLength(1);
    expect(state.scenarios[0]?.scenarioId).toBe('sc-1');
    expect(state.scenarios[0]?.name).toBe('Best Fit');
    expect(state.scenarios[0]?.intent).toBe('best_fit');
    expect(state.scenarios[0]?.patchIds).toEqual([]);
    expect(state.scenarios[0]?.includeInReport).toBe(true);
    expect(state.patchesByScenario['sc-1']).toEqual([]);
  });

  it('CREATE_SCENARIO with description stores it', () => {
    const state = spatialTwinReducer(
      initialSpatialTwinState,
      createScenario('sc-2', 'Budget Option', 'budget', 'Minimal works path'),
    );
    expect(state.scenarios[0]?.description).toBe('Minimal works path');
  });

  it('RENAME_SCENARIO updates name and sets updatedAt', () => {
    let state = spatialTwinReducer(
      initialSpatialTwinState,
      createScenario('sc-1', 'Best Fit', 'best_fit'),
    );
    state = spatialTwinReducer(state, renameScenario('sc-1', 'Optimal Path'));
    expect(state.scenarios[0]?.name).toBe('Optimal Path');
    expect(state.scenarios[0]?.updatedAt).toBeDefined();
  });

  it('RENAME_SCENARIO is a no-op for unknown scenarioId', () => {
    let state = spatialTwinReducer(
      initialSpatialTwinState,
      createScenario('sc-1', 'Best Fit', 'best_fit'),
    );
    const before = state.scenarios[0]?.name;
    state = spatialTwinReducer(state, renameScenario('sc-UNKNOWN', 'Should not apply'));
    expect(state.scenarios[0]?.name).toBe(before);
  });

  it('DELETE_SCENARIO removes the scenario and its patches', () => {
    let state = spatialTwinReducer(
      initialSpatialTwinState,
      createScenario('sc-1', 'Best Fit', 'best_fit'),
    );
    state = spatialTwinReducer(state, createScenario('sc-2', 'Budget', 'budget'));
    state = spatialTwinReducer(state, deleteScenario('sc-1'));
    expect(state.scenarios).toHaveLength(1);
    expect(state.scenarios[0]?.scenarioId).toBe('sc-2');
    expect(state.patchesByScenario['sc-1']).toBeUndefined();
  });

  it('DELETE_SCENARIO clears activeScenarioId when it matches', () => {
    let state = spatialTwinReducer(
      initialSpatialTwinState,
      createScenario('sc-1', 'Best Fit', 'best_fit'),
    );
    state = spatialTwinReducer(state, setActiveScenario('sc-1'));
    state = spatialTwinReducer(state, deleteScenario('sc-1'));
    expect(state.activeScenarioId).toBeNull();
  });

  it('DELETE_SCENARIO preserves activeScenarioId when another scenario is deleted', () => {
    let state = spatialTwinReducer(
      initialSpatialTwinState,
      createScenario('sc-1', 'Best Fit', 'best_fit'),
    );
    state = spatialTwinReducer(state, createScenario('sc-2', 'Budget', 'budget'));
    state = spatialTwinReducer(state, setActiveScenario('sc-2'));
    state = spatialTwinReducer(state, deleteScenario('sc-1'));
    expect(state.activeScenarioId).toBe('sc-2');
  });

  it('SET_ACTIVE_SCENARIO switches active scenario', () => {
    let state = spatialTwinReducer(
      initialSpatialTwinState,
      createScenario('sc-1', 'Best Fit', 'best_fit'),
    );
    state = spatialTwinReducer(state, setActiveScenario('sc-1'));
    expect(state.activeScenarioId).toBe('sc-1');
    state = spatialTwinReducer(state, setActiveScenario(null));
    expect(state.activeScenarioId).toBeNull();
  });
});

// ─── Reducer: DUPLICATE_SCENARIO ─────────────────────────────────────────────

describe('spatialTwinReducer — DUPLICATE_SCENARIO', () => {
  it('copies patches and metadata from source scenario', () => {
    const model = makeBaseModel();
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(model));
    state = spatialTwinReducer(state, createScenario('sc-1', 'Best Fit', 'best_fit'));
    const patch = makeLabelPatch('hs-combi', 'New Heat Pump');
    state = spatialTwinReducer(state, applyScenarioPatch('sc-1', patch));
    state = spatialTwinReducer(state, duplicateScenario('sc-1', 'sc-copy', 'Best Fit (copy)'));

    expect(state.scenarios).toHaveLength(2);
    const copy = state.scenarios.find((s) => s.scenarioId === 'sc-copy');
    expect(copy).toBeDefined();
    expect(copy?.name).toBe('Best Fit (copy)');
    expect(copy?.patchIds).toHaveLength(1);
    expect(copy?.isRecommended).toBe(false);
    expect(state.patchesByScenario['sc-copy']).toHaveLength(1);
  });

  it('duplicate patches are independent copies (not shared references)', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, createScenario('sc-1', 'A', 'custom'));
    const patch = makeLabelPatch('hs-combi', 'Label');
    state = spatialTwinReducer(state, applyScenarioPatch('sc-1', patch));
    state = spatialTwinReducer(state, duplicateScenario('sc-1', 'sc-2', 'B'));

    // Mutating the copy's patch array should not affect the source
    const copyPatches = state.patchesByScenario['sc-2'] ?? [];
    expect(copyPatches).not.toBe(state.patchesByScenario['sc-1']);
  });

  it('returns state unchanged when source scenarioId does not exist', () => {
    const before = spatialTwinReducer(initialSpatialTwinState, createScenario('sc-1', 'A', 'custom'));
    const after = spatialTwinReducer(before, duplicateScenario('sc-MISSING', 'sc-2', 'B'));
    expect(after.scenarios).toHaveLength(1);
  });
});

// ─── Reducer: APPLY_SCENARIO_PATCH ───────────────────────────────────────────

describe('spatialTwinReducer — APPLY_SCENARIO_PATCH', () => {
  it('appends patch to scenario patch list and marks dirty', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, createScenario('sc-1', 'A', 'custom'));
    const patch = makeLabelPatch('hs-combi', 'Heat Pump');
    state = spatialTwinReducer(state, applyScenarioPatch('sc-1', patch));

    expect(state.patchesByScenario['sc-1']).toHaveLength(1);
    expect(state.scenarios[0]?.patchIds).toContain(patch.patchId);
    expect(state.dirty).toBe(true);
  });

  it('appends multiple patches in order', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, createScenario('sc-1', 'A', 'custom'));
    const p1 = makeLabelPatch('hs-combi', 'First', 'p1');
    const p2 = makeLabelPatch('hs-combi', 'Second', 'p2');
    state = spatialTwinReducer(state, applyScenarioPatch('sc-1', p1));
    state = spatialTwinReducer(state, applyScenarioPatch('sc-1', p2));

    const patches = state.patchesByScenario['sc-1'] ?? [];
    expect(patches[0]?.patchId).toBe('p1');
    expect(patches[1]?.patchId).toBe('p2');
  });

  it('patches in different scenarios are isolated', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, createScenario('sc-1', 'A', 'custom'));
    state = spatialTwinReducer(state, createScenario('sc-2', 'B', 'custom'));
    const patch = makeLabelPatch('hs-combi', 'Heat Pump', 'p1');
    state = spatialTwinReducer(state, applyScenarioPatch('sc-1', patch));

    expect(state.patchesByScenario['sc-1']).toHaveLength(1);
    expect(state.patchesByScenario['sc-2']).toHaveLength(0);
  });
});

// ─── Reducer: SET_SCENARIO_RECOMMENDED / SET_SCENARIO_INCLUDE_IN_REPORT ──────

describe('spatialTwinReducer — scenario flags', () => {
  it('SET_SCENARIO_RECOMMENDED marks a scenario as recommended', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, createScenario('sc-1', 'A', 'best_fit'));
    state = spatialTwinReducer(state, setScenarioRecommended('sc-1', true));
    expect(state.scenarios[0]?.isRecommended).toBe(true);
  });

  it('SET_SCENARIO_INCLUDE_IN_REPORT excludes scenario from report', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, createScenario('sc-1', 'A', 'budget'));
    state = spatialTwinReducer(state, setScenarioIncludeInReport('sc-1', false));
    expect(state.scenarios[0]?.includeInReport).toBe(false);
  });
});

// ─── applyScenarioPatches ─────────────────────────────────────────────────────

describe('applyScenarioPatches', () => {
  it('returns base model unchanged when patch list is empty', () => {
    const base = makeBaseModel();
    const result = applyScenarioPatches(base, []);
    expect(result).toBe(base);
  });

  it('applies a label patch to a heat source', () => {
    const base = makeBaseModel();
    const patch = makeLabelPatch('hs-combi', 'Upgraded Boiler');
    const result = applyScenarioPatches(base, [patch]);
    expect(result.heatSources[0]?.label).toBe('Upgraded Boiler');
  });

  it('applies a status patch to a heat source', () => {
    const base = makeBaseModel();
    const patch = makeStatusPatch('hs-combi', 'proposed');
    const result = applyScenarioPatches(base, [patch]);
    expect(result.heatSources[0]?.status).toBe('proposed');
  });

  it('applies patches in order', () => {
    const base = makeBaseModel();
    const p1 = makeLabelPatch('hs-combi', 'First Label', 'p1');
    const p2 = makeLabelPatch('hs-combi', 'Second Label', 'p2');
    const result = applyScenarioPatches(base, [p1, p2]);
    expect(result.heatSources[0]?.label).toBe('Second Label');
  });

  it('does not mutate the base model', () => {
    const base = makeBaseModel();
    const originalLabel = base.heatSources[0]?.label;
    applyScenarioPatches(base, [makeLabelPatch('hs-combi', 'Changed')]);
    expect(base.heatSources[0]?.label).toBe(originalLabel);
  });
});

// ─── Selectors ────────────────────────────────────────────────────────────────

describe('spatialTwinScenario.selectors', () => {
  it('selectScenarioById returns null for unknown ID', () => {
    expect(selectScenarioById(initialSpatialTwinState, 'sc-unknown')).toBeNull();
  });

  it('selectScenarioById returns correct scenario', () => {
    const state = spatialTwinReducer(
      initialSpatialTwinState,
      createScenario('sc-1', 'Best Fit', 'best_fit'),
    );
    const found = selectScenarioById(state, 'sc-1');
    expect(found?.name).toBe('Best Fit');
  });

  it('selectAllScenarios returns empty array initially', () => {
    expect(selectAllScenarios(initialSpatialTwinState)).toEqual([]);
  });

  it('selectRecommendedScenario returns null when none is recommended', () => {
    const state = spatialTwinReducer(
      initialSpatialTwinState,
      createScenario('sc-1', 'A', 'custom'),
    );
    expect(selectRecommendedScenario(state)).toBeNull();
  });

  it('selectRecommendedScenario returns the recommended scenario', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, createScenario('sc-1', 'A', 'best_fit'));
    state = spatialTwinReducer(state, setScenarioRecommended('sc-1', true));
    expect(selectRecommendedScenario(state)?.scenarioId).toBe('sc-1');
  });

  it('selectActiveScenarioPatches returns empty when no active scenario', () => {
    expect(selectActiveScenarioPatches(initialSpatialTwinState)).toEqual([]);
  });

  it('selectActiveScenarioPatches returns patches for active scenario', () => {
    const model = makeBaseModel();
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(model));
    state = spatialTwinReducer(state, createScenario('sc-1', 'A', 'custom'));
    const patch = makeLabelPatch('hs-combi', 'HP');
    state = spatialTwinReducer(state, applyScenarioPatch('sc-1', patch));
    state = spatialTwinReducer(state, setActiveScenario('sc-1'));
    expect(selectActiveScenarioPatches(state)).toHaveLength(1);
  });

  it('selectActiveScenarioModel returns null when no model loaded', () => {
    const state = spatialTwinReducer(
      initialSpatialTwinState,
      createScenario('sc-1', 'A', 'custom'),
    );
    expect(selectActiveScenarioModel(state)).toBeNull();
  });

  it('selectActiveScenarioModel returns base model when no active scenario', () => {
    const model = makeBaseModel();
    const state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(model));
    expect(selectActiveScenarioModel(state)).toBe(model);
  });

  it('selectActiveScenarioModel projects scenario patches onto base model', () => {
    const model = makeBaseModel();
    let state = spatialTwinReducer(initialSpatialTwinState, importSucceeded(model));
    state = spatialTwinReducer(state, createScenario('sc-1', 'A', 'custom'));
    const patch = makeLabelPatch('hs-combi', 'Projected Heat Pump');
    state = spatialTwinReducer(state, applyScenarioPatch('sc-1', patch));
    state = spatialTwinReducer(state, setActiveScenario('sc-1'));

    const projected = selectActiveScenarioModel(state);
    expect(projected?.heatSources[0]?.label).toBe('Projected Heat Pump');
    // Base model must be unchanged
    expect(state.model?.heatSources[0]?.label).toBe('Existing Combi');
  });

  it('selectScenariosForReport omits scenarios with includeInReport=false', () => {
    let state = spatialTwinReducer(initialSpatialTwinState, createScenario('sc-1', 'A', 'best_fit'));
    state = spatialTwinReducer(state, createScenario('sc-2', 'B', 'budget'));
    state = spatialTwinReducer(state, setScenarioIncludeInReport('sc-2', false));
    const forReport = selectScenariosForReport(state);
    expect(forReport.map((s) => s.scenarioId)).toEqual(['sc-1']);
  });
});

// ─── compareScenarios ─────────────────────────────────────────────────────────

describe('compareScenarios', () => {
  it('returns projections and delta summaries for both scenarios', () => {
    const base = makeBaseModel();
    const patchA = makeStatusPatch('hs-combi', 'proposed', 'pA');
    const patchB = makeStatusPatch('hs-combi', 'removed', 'pB');

    const diff = compareScenarios(
      base,
      { scenarioId: 'sc-a', name: 'Scenario A', patches: [patchA] },
      { scenarioId: 'sc-b', name: 'Scenario B', patches: [patchB] },
    );

    expect(diff.scenarioA.scenarioId).toBe('sc-a');
    expect(diff.scenarioB.scenarioId).toBe('sc-b');
    expect(diff.deltaA).toBeDefined();
    expect(diff.deltaB).toBeDefined();
  });

  it('delta for scenario with no patches has zero total changes', () => {
    const base = makeBaseModel();
    const diff = compareScenarios(
      base,
      { scenarioId: 'sc-a', name: 'Empty A', patches: [] },
      { scenarioId: 'sc-b', name: 'Empty B', patches: [] },
    );
    expect(diff.deltaA.totalChanges).toBe(0);
    expect(diff.deltaB.totalChanges).toBe(0);
  });

  it('base model is not mutated by comparison', () => {
    const base = makeBaseModel();
    const originalLabel = base.heatSources[0]?.label;
    compareScenarios(
      base,
      { scenarioId: 'sc-a', name: 'A', patches: [makeLabelPatch('hs-combi', 'Changed', 'pA')] },
      { scenarioId: 'sc-b', name: 'B', patches: [] },
    );
    expect(base.heatSources[0]?.label).toBe(originalLabel);
  });
});

// ─── projectSpatialTwinToEngineInput — scenario projection ────────────────────

describe('projectSpatialTwinToEngineInput with scenarioPatches', () => {
  it('uses base model when no patches provided', () => {
    const base = makeBaseModel();
    const result = projectSpatialTwinToEngineInput(base, {}, 'proposed');
    expect(result.currentHeatSourceType).toBe('combi');
  });

  it('applies scenario patches before projecting to engine input', () => {
    const base = makeBaseModel();
    // Scenario patches: remove the combi, add a heat pump
    const removeCombi: AtlasSpatialPatchV1 = {
      patchId: 'p-remove',
      entityId: 'hs-combi',
      entityKind: 'heatSource',
      operation: 'soft_remove',
      payload: {},
      appliedAt: '2024-06-01T10:00:00Z',
      sourceMode: 'proposed',
    };

    const result = projectSpatialTwinToEngineInput(base, {}, 'proposed', [removeCombi]);
    // After soft_remove the heat source has status 'removed', so it is filtered
    // out in 'proposed' mode → no primarySource → currentHeatSourceType stays as
    // the survey default (undefined from empty survey object).
    expect(result.currentHeatSourceType).toBeUndefined();
  });

  it('does not mutate the original model', () => {
    const base = makeBaseModel();
    const patch = makeLabelPatch('hs-combi', 'New Label', 'p1');
    projectSpatialTwinToEngineInput(base, {}, 'proposed', [patch]);
    expect(base.heatSources[0]?.label).toBe('Existing Combi');
  });
});
