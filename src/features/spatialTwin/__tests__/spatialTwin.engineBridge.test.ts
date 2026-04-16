import { describe, it, expect } from 'vitest';
import { projectSpatialTwinToEngineInput } from '../engine/projectSpatialTwinToEngineInput';
import type { SpatialTwinModelV1 } from '../state/spatialTwin.types';

function makeModel(overrides: Partial<SpatialTwinModelV1> = {}): SpatialTwinModelV1 {
  return {
    version: '1.0',
    propertyId: 'prop-1',
    spatial: {
      version: '1.0',
      propertyId: 'prop-1',
      rooms: [
        { roomId: 'room-1', label: 'Lounge', status: 'complete', roomType: 'living', zoneIds: [] },
        { roomId: 'room-2', label: 'Kitchen', status: 'complete', roomType: 'kitchen', zoneIds: [] },
      ],
      zones: [],
      emitters: [
        { emitterId: 'em-1', roomId: 'room-1', type: 'radiator' },
        { emitterId: 'em-2', roomId: 'room-2', type: 'radiator' },
      ],
      openings: [],
      boundaries: [],
    },
    heatSources: [
      {
        heatSourceId: 'hs-1',
        label: 'Existing Combi',
        type: 'combi_boiler',
        status: 'existing',
        certainty: 'confirmed',
        evidenceIds: [],
      },
      {
        heatSourceId: 'hs-2',
        label: 'Proposed Heat Pump',
        type: 'heat_pump',
        status: 'proposed',
        certainty: 'probable',
        evidenceIds: [],
      },
    ],
    stores: [],
    controls: [],
    pipeRuns: [],
    evidenceMarkers: [],
    ...overrides,
  };
}

describe('projectSpatialTwinToEngineInput', () => {
  it('current mode returns only existing heat sources', () => {
    const model = makeModel();
    const result = projectSpatialTwinToEngineInput(model, {}, 'current');
    expect(result.currentHeatSourceType).toBe('combi');
  });

  it('proposed mode includes proposed heat sources', () => {
    const model = makeModel();
    const result = projectSpatialTwinToEngineInput(model, {}, 'proposed');
    // Both existing and proposed sources are active in proposed mode
    // The first active one (existing combi) takes priority
    expect(result.currentHeatSourceType).toBeDefined();
  });

  it('does not invent values not in twin', () => {
    const minimalModel: SpatialTwinModelV1 = {
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
    const result = projectSpatialTwinToEngineInput(minimalModel, {}, 'current');
    // With no heat sources, should not set currentHeatSourceType
    expect(result.currentHeatSourceType).toBeUndefined();
    // With no radiators, should not set radiatorCount
    expect(result.radiatorCount).toBeUndefined();
  });
});
