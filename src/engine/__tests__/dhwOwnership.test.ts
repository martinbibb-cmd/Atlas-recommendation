/**
 * dhwOwnership.test.ts — PR3: Tests for the assertValidDhwOwnership helper.
 *
 * These tests verify that:
 *   1. Valid combi envelopes pass without throwing.
 *   2. Valid stored envelopes pass without throwing.
 *   3. Forbidden fields (cross-family contamination) always throw.
 *   4. Missing required fields throw.
 */

import { describe, it, expect } from 'vitest';
import { assertValidDhwOwnership } from '../runners/dhwOwnership';
import type { DhwResultEnvelope } from '../runners/types';
import {
  buildSystemTopologyFromSpec,
} from '../topology/SystemTopology';

// ─── Topology stubs ───────────────────────────────────────────────────────────

const combiTopology = buildSystemTopologyFromSpec({ systemType: 'combi' });
const systemTopology = buildSystemTopologyFromSpec({ systemType: 'stored_water' });

// ─── Minimal stub objects ─────────────────────────────────────────────────────

const stubCombiDhwV1 = { verdict: { combiRisk: 'pass' }, flags: [], maxQtoDhwKwDerated: 30 } as unknown as DhwResultEnvelope['combiDhwV1'];
const stubStoredDhwV1 = { verdict: { storedRisk: 'pass' }, flags: [], recommended: { type: 'standard', volumeBand: 'medium' } } as unknown as DhwResultEnvelope['storedDhwV1'];
const stubMixergy = { mixergyLitres: 150 } as unknown as DhwResultEnvelope['mixergy'];
const stubMixergyLegacy = { notes: [] } as unknown as DhwResultEnvelope['mixergyLegacy'];

// ─── Combi ownership tests ────────────────────────────────────────────────────

describe('assertValidDhwOwnership — combi topology', () => {
  it('passes when dhw.kind is "direct_combi" and combiDhwV1 is present', () => {
    const dhw: DhwResultEnvelope = {
      kind: 'direct_combi',
      sourcePath: 'combi_runner',
      combiDhwV1: stubCombiDhwV1,
    };
    expect(() => assertValidDhwOwnership(dhw, combiTopology)).not.toThrow();
  });

  it('throws when dhw.kind is "stored" for a combi topology', () => {
    const dhw: DhwResultEnvelope = {
      kind: 'stored',
      sourcePath: 'wrong_runner',
      combiDhwV1: stubCombiDhwV1,
    };
    expect(() => assertValidDhwOwnership(dhw, combiTopology)).toThrow(
      /dhw\.kind === 'direct_combi'/,
    );
  });

  it('throws when combiDhwV1 is absent for a combi topology', () => {
    const dhw: DhwResultEnvelope = {
      kind: 'direct_combi',
      sourcePath: 'combi_runner',
    };
    expect(() => assertValidDhwOwnership(dhw, combiTopology)).toThrow(
      /combiDhwV1 to be present/,
    );
  });

  it('throws when storedDhwV1 is present for a combi topology (forbidden field)', () => {
    const dhw: DhwResultEnvelope = {
      kind: 'direct_combi',
      sourcePath: 'combi_runner',
      combiDhwV1: stubCombiDhwV1,
      storedDhwV1: stubStoredDhwV1,
    };
    expect(() => assertValidDhwOwnership(dhw, combiTopology)).toThrow(
      /forbids dhw\.storedDhwV1/,
    );
  });

  it('throws when mixergy is present for a combi topology (forbidden field)', () => {
    const dhw: DhwResultEnvelope = {
      kind: 'direct_combi',
      sourcePath: 'combi_runner',
      combiDhwV1: stubCombiDhwV1,
      mixergy: stubMixergy,
    };
    expect(() => assertValidDhwOwnership(dhw, combiTopology)).toThrow(
      /forbids dhw\.mixergy/,
    );
  });

  it('throws when mixergyLegacy is present for a combi topology (forbidden field)', () => {
    const dhw: DhwResultEnvelope = {
      kind: 'direct_combi',
      sourcePath: 'combi_runner',
      combiDhwV1: stubCombiDhwV1,
      mixergyLegacy: stubMixergyLegacy,
    };
    expect(() => assertValidDhwOwnership(dhw, combiTopology)).toThrow(
      /forbids dhw\.mixergyLegacy/,
    );
  });
});

// ─── Hydronic ownership tests ─────────────────────────────────────────────────

describe('assertValidDhwOwnership — hydronic topology (system)', () => {
  it('passes when dhw.kind is "stored" and storedDhwV1 is present', () => {
    const dhw: DhwResultEnvelope = {
      kind: 'stored',
      sourcePath: 'system_runner',
      storedDhwV1: stubStoredDhwV1,
      mixergy: stubMixergy,
      mixergyLegacy: stubMixergyLegacy,
    };
    expect(() => assertValidDhwOwnership(dhw, systemTopology)).not.toThrow();
  });

  it('throws when dhw.kind is "direct_combi" for a hydronic topology', () => {
    const dhw: DhwResultEnvelope = {
      kind: 'direct_combi',
      sourcePath: 'wrong_runner',
      storedDhwV1: stubStoredDhwV1,
    };
    expect(() => assertValidDhwOwnership(dhw, systemTopology)).toThrow(
      /dhw\.kind === 'stored'/,
    );
  });

  it('throws when storedDhwV1 is absent for a hydronic topology', () => {
    const dhw: DhwResultEnvelope = {
      kind: 'stored',
      sourcePath: 'system_runner',
    };
    expect(() => assertValidDhwOwnership(dhw, systemTopology)).toThrow(
      /storedDhwV1 to be present/,
    );
  });

  it('throws when combiDhwV1 is present for a hydronic topology (forbidden field)', () => {
    const dhw: DhwResultEnvelope = {
      kind: 'stored',
      sourcePath: 'system_runner',
      storedDhwV1: stubStoredDhwV1,
      combiDhwV1: stubCombiDhwV1,
    };
    expect(() => assertValidDhwOwnership(dhw, systemTopology)).toThrow(
      /forbids dhw\.combiDhwV1/,
    );
  });
});

// ─── Ownership assertion in runner results ────────────────────────────────────

/** Minimal valid input that exercises all runner modules without errors. */
const fullInput = {
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

describe('assertValidDhwOwnership — called on real runner outputs', () => {
  it('does not throw for the combi runner output', async () => {
    const { runCombiSystemModel } = await import('../runners/runCombiSystemModel');
    const input = { ...fullInput, currentHeatSourceType: 'combi' as const };
    const result = runCombiSystemModel(input, combiTopology);
    expect(() => assertValidDhwOwnership(result.dhw, result.topology)).not.toThrow();
  });

  it('does not throw for the system runner output', async () => {
    const { runSystemStoredSystemModel } = await import('../runners/runSystemStoredSystemModel');
    const input = { ...fullInput, currentHeatSourceType: 'stored_water' as const };
    const result = runSystemStoredSystemModel(input, systemTopology);
    expect(() => assertValidDhwOwnership(result.dhw, result.topology)).not.toThrow();
  });
});
