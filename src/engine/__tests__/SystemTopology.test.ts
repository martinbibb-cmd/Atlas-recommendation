/**
 * SystemTopology.test.ts
 *
 * Tests for the PR1 topology contracts.
 *
 * Focus: hard-rule enforcement via assertTopologyConsistency() and adapter
 * correctness via buildSystemTopologyFromSpec().
 *
 * No physics logic is exercised here — this is pure contract validation.
 */

import { describe, it, expect } from 'vitest';
import {
  assertTopologyConsistency,
  buildSystemTopologyFromSpec,
  type ApplianceModel,
  type CombiApplianceModel,
  type StorageChargingApplianceModel,
  type DrawOffModel,
  type EmitterModel,
  type StorageLoadModel,
  type SystemTopology,
} from '../topology/SystemTopology';
import type { HeatSourceBehaviourInput } from '../modules/HeatSourceBehaviourModel';

// ─── Helper factories ─────────────────────────────────────────────────────────

function makeCombiAppliance(
  overrides?: Partial<CombiApplianceModel>
): CombiApplianceModel {
  return {
    family: 'combi',
    directDrawOffService: true,
    nominalOutputKw: 24,
    condensing: true,
    maxDhwLpm: 12,
    ...overrides,
  };
}

function makeStorageAppliance(
  overrides?: Partial<StorageChargingApplianceModel>
): StorageChargingApplianceModel {
  return {
    family: 'system',
    directDrawOffService: false,
    nominalOutputKw: 18,
    condensing: true,
    ...overrides,
  };
}

function makeEmitter(overrides?: Partial<EmitterModel>): EmitterModel {
  return {
    kind: 'radiator',
    purpose: 'ch_only',
    designFlowTempC: 70,
    count: 10,
    ...overrides,
  };
}

function makeStorage(overrides?: Partial<StorageLoadModel>): StorageLoadModel {
  return {
    kind: 'cylinder_unvented',
    role: 'load',
    volumeLitres: 150,
    primaryCoilKw: 15,
    ...overrides,
  };
}

function makeCombiDrawOff(overrides?: Partial<DrawOffModel>): DrawOffModel {
  return {
    source: 'combi_direct',
    maxFlowLpm: 12,
    ...overrides,
  };
}

function makeStoreDrawOff(overrides?: Partial<DrawOffModel>): DrawOffModel {
  return {
    source: 'store_delivery',
    maxFlowLpm: 10,
    ...overrides,
  };
}

// ─── assertTopologyConsistency ────────────────────────────────────────────────

describe('assertTopologyConsistency', () => {
  describe('valid topologies — should not throw', () => {
    it('accepts a well-formed combi topology', () => {
      const topology: SystemTopology = {
        appliance: makeCombiAppliance(),
        emitters: [makeEmitter()],
        drawOff: makeCombiDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).not.toThrow();
    });

    it('accepts a combi with no emitters', () => {
      const topology: SystemTopology = {
        appliance: makeCombiAppliance(),
        emitters: [],
        drawOff: makeCombiDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).not.toThrow();
    });

    it('accepts a stored-water (system boiler + cylinder) topology', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'system' }),
        emitters: [makeEmitter()],
        storage: makeStorage({ kind: 'cylinder_unvented' }),
        drawOff: makeStoreDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).not.toThrow();
    });

    it('accepts a regular boiler + vented cylinder topology', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'regular' }),
        emitters: [makeEmitter()],
        storage: makeStorage({ kind: 'cylinder_vented' }),
        drawOff: makeStoreDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).not.toThrow();
    });

    it('accepts a heat pump + cylinder topology', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'heat_pump', condensing: false }),
        emitters: [makeEmitter({ designFlowTempC: 45 })],
        storage: makeStorage({ kind: 'cylinder_unvented', primaryCoilKw: undefined }),
        drawOff: makeStoreDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).not.toThrow();
    });

    it('accepts an open-vented boiler + vented cylinder topology', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'open_vented', condensing: false }),
        emitters: [makeEmitter()],
        storage: makeStorage({ kind: 'cylinder_vented' }),
        drawOff: makeStoreDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).not.toThrow();
    });

    it('accepts a Mixergy cylinder with a system boiler', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'system' }),
        emitters: [makeEmitter()],
        storage: makeStorage({ kind: 'mixergy' }),
        drawOff: makeStoreDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).not.toThrow();
    });

    it('accepts multiple emitter circuits', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'system' }),
        emitters: [
          makeEmitter({ kind: 'radiator', count: 8 }),
          makeEmitter({ kind: 'underfloor', designFlowTempC: 40, count: 2 }),
        ],
        storage: makeStorage(),
        drawOff: makeStoreDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).not.toThrow();
    });
  });

  // ── Rule 1: only combi may serve combi_direct ─────────────────────────────

  describe('Rule 1 — only combi can serve draw-off directly', () => {
    it('throws when a system boiler is paired with combi_direct draw-off', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'system' }),
        emitters: [makeEmitter()],
        storage: makeStorage(),
        drawOff: makeCombiDrawOff(), // ← illegal
      };
      expect(() => assertTopologyConsistency(topology)).toThrow(
        /only a combi appliance may serve draw-offs directly/i
      );
    });

    it('throws when a heat pump is paired with combi_direct draw-off', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'heat_pump', condensing: false }),
        emitters: [],
        storage: makeStorage(),
        drawOff: makeCombiDrawOff(), // ← illegal
      };
      expect(() => assertTopologyConsistency(topology)).toThrow(
        /only a combi appliance may serve draw-offs directly/i
      );
    });

    it('throws when a regular boiler is paired with combi_direct draw-off', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'regular' }),
        emitters: [],
        storage: makeStorage(),
        drawOff: makeCombiDrawOff(), // ← illegal
      };
      expect(() => assertTopologyConsistency(topology)).toThrow(
        /only a combi appliance may serve draw-offs directly/i
      );
    });

    it('throws when an open-vented appliance is paired with combi_direct draw-off', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'open_vented', condensing: false }),
        emitters: [],
        storage: makeStorage(),
        drawOff: makeCombiDrawOff(), // ← illegal
      };
      expect(() => assertTopologyConsistency(topology)).toThrow(
        /only a combi appliance may serve draw-offs directly/i
      );
    });
  });

  // ── Rule 2: non-combi appliances must have storage ────────────────────────

  describe('Rule 2 — non-combi appliances require associated storage', () => {
    it('throws when a system boiler has no storage', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'system' }),
        emitters: [makeEmitter()],
        // no storage
        drawOff: makeStoreDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).toThrow(
        /must have associated storage for DHW/i
      );
    });

    it('throws when a heat pump has no storage', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'heat_pump', condensing: false }),
        emitters: [],
        // no storage
        drawOff: makeStoreDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).toThrow(
        /must have associated storage for DHW/i
      );
    });

    it('throws when a regular boiler has no storage', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'regular' }),
        emitters: [],
        // no storage
        drawOff: makeStoreDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).toThrow(
        /must have associated storage for DHW/i
      );
    });
  });

  // ── Rule 3: storage role must be 'load' ───────────────────────────────────

  describe('Rule 3 — storage vessels must declare role === "load"', () => {
    it('throws when storage has a non-load role', () => {
      const illegalStorage = {
        kind: 'cylinder_unvented',
        role: 'source', // ← impossible at type level but guards against JS abuse
        volumeLitres: 150,
      } as unknown as StorageLoadModel;

      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'system' }),
        emitters: [],
        storage: illegalStorage,
        drawOff: makeStoreDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).toThrow(
        /storage vessel role must be 'load'/i
      );
    });
  });

  // ── Rule 4: emitters must be CH-only ─────────────────────────────────────

  describe('Rule 4 — emitters must be CH-only consumers', () => {
    it('throws when an emitter declares a non-ch_only purpose', () => {
      const illegalEmitter = {
        kind: 'radiator',
        purpose: 'dhw', // ← impossible at type level but guards against JS abuse
        designFlowTempC: 70,
        count: 10,
      } as unknown as EmitterModel;

      const topology: SystemTopology = {
        appliance: makeCombiAppliance(),
        emitters: [illegalEmitter],
        drawOff: makeCombiDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).toThrow(
        /emitters must be CH-only consumers/i
      );
    });

    it('throws when any one emitter in a mixed list has an illegal purpose', () => {
      const topology: SystemTopology = {
        appliance: makeStorageAppliance({ family: 'system' }),
        emitters: [
          makeEmitter({ kind: 'radiator' }),
          {
            kind: 'underfloor',
            purpose: 'dhw_and_ch', // ← illegal
            designFlowTempC: 40,
            count: 2,
          } as unknown as EmitterModel,
        ],
        storage: makeStorage(),
        drawOff: makeStoreDrawOff(),
      };
      expect(() => assertTopologyConsistency(topology)).toThrow(
        /emitters must be CH-only consumers/i
      );
    });
  });
});

// ─── buildSystemTopologyFromSpec ──────────────────────────────────────────────

describe('buildSystemTopologyFromSpec', () => {
  // ── combi ─────────────────────────────────────────────────────────────────

  describe('combi system', () => {
    const combiSpec: HeatSourceBehaviourInput = {
      systemType: 'combi',
      peakHotWaterCapacityLpm: 14,
      mainsDynamicPressureBar: 2.5,
    };

    it('returns a combi appliance with directDrawOffService: true', () => {
      const topology = buildSystemTopologyFromSpec(combiSpec);
      expect(topology.appliance.family).toBe('combi');
      expect(topology.appliance.directDrawOffService).toBe(true);
    });

    it('returns combi_direct draw-off', () => {
      const topology = buildSystemTopologyFromSpec(combiSpec);
      expect(topology.drawOff.source).toBe('combi_direct');
    });

    it('honours peakHotWaterCapacityLpm for maxDhwLpm and drawOff.maxFlowLpm', () => {
      const topology = buildSystemTopologyFromSpec(combiSpec);
      expect((topology.appliance as CombiApplianceModel).maxDhwLpm).toBe(14);
      expect(topology.drawOff.maxFlowLpm).toBe(14);
    });

    it('does not create storage for a pure combi', () => {
      const topology = buildSystemTopologyFromSpec({
        systemType: 'combi',
      });
      expect(topology.storage).toBeUndefined();
    });

    it('passes assertTopologyConsistency without throwing', () => {
      const topology = buildSystemTopologyFromSpec(combiSpec);
      expect(() => assertTopologyConsistency(topology)).not.toThrow();
    });
  });

  // ── stored water (system boiler) ──────────────────────────────────────────

  describe('stored_water (system boiler) system', () => {
    const storedSpec: HeatSourceBehaviourInput = {
      systemType: 'stored_water',
      hotWaterStorageLitres: 150,
      recoveryRateLitresPerHour: 120,
    };

    it('returns a system appliance with directDrawOffService: false', () => {
      const topology = buildSystemTopologyFromSpec(storedSpec);
      expect(topology.appliance.family).toBe('system');
      expect(topology.appliance.directDrawOffService).toBe(false);
    });

    it('returns store_delivery draw-off', () => {
      const topology = buildSystemTopologyFromSpec(storedSpec);
      expect(topology.drawOff.source).toBe('store_delivery');
    });

    it('creates a storage vessel with role === "load"', () => {
      const topology = buildSystemTopologyFromSpec(storedSpec);
      expect(topology.storage).toBeDefined();
      expect(topology.storage!.role).toBe('load');
      expect(topology.storage!.volumeLitres).toBe(150);
    });

    it('uses cylinder_unvented for stored_water', () => {
      const topology = buildSystemTopologyFromSpec(storedSpec);
      expect(topology.storage!.kind).toBe('cylinder_unvented');
    });

    it('passes assertTopologyConsistency without throwing', () => {
      const topology = buildSystemTopologyFromSpec(storedSpec);
      expect(() => assertTopologyConsistency(topology)).not.toThrow();
    });
  });

  // ── heat pump ─────────────────────────────────────────────────────────────

  describe('heat_pump system', () => {
    const hpSpec: HeatSourceBehaviourInput = {
      systemType: 'heat_pump',
      hotWaterStorageLitres: 200,
      lowTempSuitability: 'high',
    };

    it('returns a heat_pump appliance', () => {
      const topology = buildSystemTopologyFromSpec(hpSpec);
      expect(topology.appliance.family).toBe('heat_pump');
      expect(topology.appliance.directDrawOffService).toBe(false);
    });

    it('emitter uses low flow temperature for heat pump', () => {
      const topology = buildSystemTopologyFromSpec(hpSpec);
      expect(topology.emitters[0].designFlowTempC).toBe(45);
    });

    it('storage has no primaryCoilKw (HP uses direct immersion / integrated coil)', () => {
      const topology = buildSystemTopologyFromSpec(hpSpec);
      expect(topology.storage!.primaryCoilKw).toBeUndefined();
    });

    it('passes assertTopologyConsistency without throwing', () => {
      const topology = buildSystemTopologyFromSpec(hpSpec);
      expect(() => assertTopologyConsistency(topology)).not.toThrow();
    });
  });

  // ── open vented ───────────────────────────────────────────────────────────

  describe('open_vented system', () => {
    const ovenSpec: HeatSourceBehaviourInput = {
      systemType: 'open_vented',
      hotWaterStorageLitres: 115,
    };

    it('returns an open_vented appliance', () => {
      const topology = buildSystemTopologyFromSpec(ovenSpec);
      expect(topology.appliance.family).toBe('open_vented');
    });

    it('uses cylinder_vented for open_vented systems', () => {
      const topology = buildSystemTopologyFromSpec(ovenSpec);
      expect(topology.storage!.kind).toBe('cylinder_vented');
    });

    it('passes assertTopologyConsistency without throwing', () => {
      const topology = buildSystemTopologyFromSpec(ovenSpec);
      expect(() => assertTopologyConsistency(topology)).not.toThrow();
    });
  });

  // ── default / missing optional fields ────────────────────────────────────

  describe('defaults applied when optional fields are absent', () => {
    it('combi without peakHotWaterCapacityLpm defaults maxDhwLpm to 10', () => {
      const topology = buildSystemTopologyFromSpec({ systemType: 'combi' });
      expect((topology.appliance as CombiApplianceModel).maxDhwLpm).toBe(10);
      expect(topology.drawOff.maxFlowLpm).toBe(10);
    });

    it('stored system without hotWaterStorageLitres still creates placeholder storage', () => {
      const topology = buildSystemTopologyFromSpec({ systemType: 'stored_water' });
      expect(topology.storage).toBeDefined();
      expect(topology.storage!.role).toBe('load');
    });

    it('always attaches at least one emitter', () => {
      const topology = buildSystemTopologyFromSpec({ systemType: 'combi' });
      expect(topology.emitters.length).toBeGreaterThanOrEqual(1);
      expect(topology.emitters[0].purpose).toBe('ch_only');
    });
  });

  // ── TypeScript type narrowing ─────────────────────────────────────────────

  describe('type narrowing via discriminated union', () => {
    it('correctly narrows combi appliance to CombiApplianceModel', () => {
      const topology = buildSystemTopologyFromSpec({ systemType: 'combi' });
      const appliance: ApplianceModel = topology.appliance;
      if (appliance.family === 'combi') {
        // If TypeScript narrowing works, this field is available only here.
        expect(appliance.maxDhwLpm).toBeGreaterThan(0);
        expect(appliance.directDrawOffService).toBe(true);
      } else {
        throw new Error('Expected combi family');
      }
    });

    it('correctly narrows stored appliance to StorageChargingApplianceModel', () => {
      const topology = buildSystemTopologyFromSpec({
        systemType: 'stored_water',
        hotWaterStorageLitres: 150,
      });
      const appliance: ApplianceModel = topology.appliance;
      if (appliance.family !== 'combi') {
        expect(appliance.directDrawOffService).toBe(false);
      } else {
        throw new Error('Expected non-combi family');
      }
    });
  });
});
