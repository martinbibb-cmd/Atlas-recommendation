import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveVisitAtomically,
  readPersistedAtlasVisitV2,
} from '../persistedAtlasVisitV2';
import type { PersistedAtlasVisitV2 } from '../persistedAtlasVisitV2';

function makeVisit(visitId = 'visit_test_1'): PersistedAtlasVisitV2 {
  return {
    schemaVersion: 2,
    visitId,
    updatedAt: '2026-05-08T10:00:00.000Z',
    survey: {
      postcode: 'SW1A 1AA',
      dynamicMainsPressure: 2,
      buildingMass: 'medium',
      primaryPipeDiameter: 22,
      heatLossWatts: 8000,
      radiatorCount: 10,
      hasLoftConversion: false,
      returnWaterTemp: 45,
      bathroomCount: 1,
      occupancySignature: 'professional',
      highOccupancy: false,
      preferCombi: true,
    },
  };
}

describe('persistedAtlasVisitV2', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('visit survives reload after survey completion (save then read)', () => {
    const visit = makeVisit('visit_reload_ok');
    saveVisitAtomically(visit);

    const restored = readPersistedAtlasVisitV2('visit_reload_ok');
    expect(restored.visit?.visitId).toBe('visit_reload_ok');
    expect(restored.restoredFromTemp).toBe(false);
    expect(restored.schemaMismatch).toBe(false);
  });

  it('recovers a valid *_tmp envelope on boot and promotes it to main key', () => {
    const visit = makeVisit('visit_tmp_recover');
    localStorage.setItem('atlas_visit_visit_tmp_recover_tmp', JSON.stringify(visit));

    const restored = readPersistedAtlasVisitV2('visit_tmp_recover');
    expect(restored.visit?.visitId).toBe('visit_tmp_recover');
    expect(restored.restoredFromTemp).toBe(true);
    expect(localStorage.getItem('atlas_visit_visit_tmp_recover')).not.toBeNull();
    expect(localStorage.getItem('atlas_visit_visit_tmp_recover_tmp')).toBeNull();
  });

  it('flags schema mismatch instead of silently discarding', () => {
    localStorage.setItem(
      'atlas_visit_visit_schema_warn',
      JSON.stringify({ schemaVersion: 1, visitId: 'visit_schema_warn', updatedAt: '2026-05-08', survey: {} }),
    );

    const restored = readPersistedAtlasVisitV2('visit_schema_warn');
    expect(restored.visit).toBeNull();
    expect(restored.schemaMismatch).toBe(true);
  });
});
