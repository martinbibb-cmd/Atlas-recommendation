import { describe, it, expect } from 'vitest';
import { buildSpatialTwinCompareSummary } from '../compare/buildSpatialTwinCompareSummary';
import type { SpatialTwinModelV1 } from '../state/spatialTwin.types';

function makeEmptyModel(): SpatialTwinModelV1 {
  return {
    version: '1.0',
    propertyId: 'prop-1',
    spatial: {
      version: '1.0',
      propertyId: 'prop-1',
      rooms: [],
      zones: [],
      emitters: [],
      openings: [],
      boundaries: [],
    },
    heatSources: [],
    stores: [],
    controls: [],
    pipeRuns: [],
    evidenceMarkers: [],
  };
}

describe('buildSpatialTwinCompareSummary', () => {
  it('empty model returns zero changes', () => {
    const summary = buildSpatialTwinCompareSummary(makeEmptyModel());
    expect(summary.totalChanges).toBe(0);
    expect(summary.addedEntities).toHaveLength(0);
    expect(summary.removedEntities).toHaveLength(0);
  });

  it('proposed heat source addition is detected', () => {
    const model: SpatialTwinModelV1 = {
      ...makeEmptyModel(),
      heatSources: [
        {
          heatSourceId: 'hs-new',
          label: 'New Heat Pump',
          type: 'heat_pump',
          status: 'proposed',
          certainty: 'confirmed',
          evidenceIds: [],
        },
      ],
    };
    const summary = buildSpatialTwinCompareSummary(model);
    expect(summary.addedEntities).toHaveLength(1);
    expect(summary.addedEntities[0]?.label).toBe('New Heat Pump');
    expect(summary.totalChanges).toBe(1);
  });

  it('removed entity is detected', () => {
    const model: SpatialTwinModelV1 = {
      ...makeEmptyModel(),
      heatSources: [
        {
          heatSourceId: 'hs-old',
          label: 'Old Combi Boiler',
          type: 'combi_boiler',
          status: 'removed',
          certainty: 'confirmed',
          evidenceIds: [],
        },
      ],
    };
    const summary = buildSpatialTwinCompareSummary(model);
    expect(summary.removedEntities).toHaveLength(1);
    expect(summary.removedEntities[0]?.label).toBe('Old Combi Boiler');
  });
});
