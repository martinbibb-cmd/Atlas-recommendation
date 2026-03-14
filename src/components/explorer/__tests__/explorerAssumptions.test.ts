/**
 * explorerAssumptions.test.ts
 *
 * Tests for the deriveAssumptions / deriveConstraintLabels logic:
 *
 *  - Explicit visibility of assumed flow temperature (no hidden defaults)
 *  - No hidden punitive default cases
 *  - Correct updates when emitter / pipe / control inputs change
 *  - Constraint labels only appear when conditions are factually met
 */

import { describe, it, expect } from 'vitest';
import { getSystemConfig, deriveAssumptions, deriveConstraintLabels } from '../systemConfigs';
import type { ExplorerAssumptions } from '../explorerTypes';

// ── deriveAssumptions ─────────────────────────────────────────────────────────

describe('deriveAssumptions — gas boiler systems', () => {
  it('uses design flow temp from system config (no silent override)', () => {
    const cfg = getSystemConfig('combi');
    const assumptions = deriveAssumptions(cfg);
    expect(assumptions.assumedFlowTempC).toBe(cfg.designFlowTempC);
  });

  it('uses primary pipe diameter from system config', () => {
    const cfg = getSystemConfig('combi');
    const assumptions = deriveAssumptions(cfg);
    expect(assumptions.primaryPipeMm).toBe(cfg.primaryDiameterMm);
  });

  it('sets emitterState to "existing" for gas boilers (not punitive — simply existing)', () => {
    for (const id of ['combi', 'stored_vented', 'stored_unvented', 'regular_vented', 'system_unvented']) {
      const cfg = getSystemConfig(id);
      const assumptions = deriveAssumptions(cfg);
      expect(assumptions.emitterState).toBe('existing');
    }
  });

  it('does not silently enable compensation for gas boilers', () => {
    const cfg = getSystemConfig('combi');
    const assumptions = deriveAssumptions(cfg);
    expect(assumptions.compensationEnabled).toBe(false);
  });

  it('defaults to "current" operating mode', () => {
    const cfg = getSystemConfig('combi');
    const assumptions = deriveAssumptions(cfg);
    expect(assumptions.operatingMode).toBe('current');
  });

  it('regular_vented uses 70°C design flow temp (not the punitive 75°C default)', () => {
    const cfg = getSystemConfig('regular_vented');
    const assumptions = deriveAssumptions(cfg);
    expect(assumptions.assumedFlowTempC).toBe(70);
  });
});

describe('deriveAssumptions — ASHP', () => {
  it('uses flowTempC from heatSource data (not a hidden high-temp default)', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg);
    // Must equal the value declared in the system config, not some other default
    expect(assumptions.assumedFlowTempC).toBe(cfg.heatSource.flowTempC ?? cfg.designFlowTempC);
  });

  it('derives emitterState "oversized" when flow temp is 45°C', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg);
    expect(assumptions.emitterState).toBe('oversized');
  });

  it('enables compensation for heat pumps by default', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg);
    expect(assumptions.compensationEnabled).toBe(true);
  });

  it('uses 28mm primary pipe from system config', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg);
    expect(assumptions.primaryPipeMm).toBe(28);
  });
});

// ── Emitter state derivation from flow temp ───────────────────────────────────

describe('deriveAssumptions — emitter state follows flow temp', () => {
  it('emitterState is "upgraded" when flow temp ≤ 35°C', () => {
    const cfg = getSystemConfig('ashp');
    // Simulate a 35°C system config
    const modified = { ...cfg, designFlowTempC: 35, heatSource: { ...cfg.heatSource, flowTempC: 35 } };
    const assumptions = deriveAssumptions(modified);
    expect(assumptions.emitterState).toBe('upgraded');
    expect(assumptions.assumedFlowTempC).toBe(35);
  });

  it('emitterState is "oversized" when flow temp is 45°C', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg);
    expect(assumptions.emitterState).toBe('oversized');
  });

  it('emitterState is "existing" when flow temp is > 45°C for a heat pump', () => {
    const cfg = getSystemConfig('ashp');
    const modified = { ...cfg, designFlowTempC: 55, heatSource: { ...cfg.heatSource, flowTempC: 55, flowTempRegime: '50C' as const } };
    const assumptions = deriveAssumptions(modified);
    expect(assumptions.emitterState).toBe('existing');
    expect(assumptions.assumedFlowTempC).toBe(55);
  });
});

// ── deriveConstraintLabels — gas boilers ──────────────────────────────────────

describe('deriveConstraintLabels — gas boiler', () => {
  it('emits flow-temperature-limited when return temp ≥ 55°C', () => {
    // combi return temp is 63°C — above condensing threshold
    const cfg = getSystemConfig('combi');
    const assumptions = deriveAssumptions(cfg);
    const labels = deriveConstraintLabels(cfg, assumptions);
    expect(labels).toContain('flow-temperature-limited');
  });

  it('does NOT emit flow-temperature-limited when return temp < 55°C', () => {
    // stored_unvented return temp is 52°C — below condensing threshold
    const cfg = getSystemConfig('stored_unvented');
    const assumptions = deriveAssumptions(cfg);
    const labels = deriveConstraintLabels(cfg, assumptions);
    expect(labels).not.toContain('flow-temperature-limited');
  });

  it('emits cycling-risk only when load fraction < 30%', () => {
    const cfg = getSystemConfig('combi');
    const assumptions = deriveAssumptions(cfg);
    // combi currentLoadKw=14 / outputKw=24 = 58% — no cycling risk
    const labels = deriveConstraintLabels(cfg, assumptions);
    expect(labels).not.toContain('cycling-risk');
  });

  it('emits cycling-risk when boiler is heavily oversized at current load', () => {
    const cfg = getSystemConfig('combi');
    const oversized = { ...cfg, heatSource: { ...cfg.heatSource, outputKw: 60, currentLoadKw: 5 } };
    const assumptions = deriveAssumptions(oversized);
    const labels = deriveConstraintLabels(oversized, assumptions);
    expect(labels).toContain('cycling-risk');
  });

  it('never emits HP-specific labels for gas boilers', () => {
    const cfg = getSystemConfig('combi');
    const assumptions = deriveAssumptions(cfg);
    const labels = deriveConstraintLabels(cfg, assumptions);
    const hpOnlyLabels = ['emitter-limited', 'primary-flow-limited', 'no-compensation', 'reduced-efficiency-hot-water-mode'];
    for (const label of hpOnlyLabels) {
      expect(labels).not.toContain(label);
    }
  });
});

// ── deriveConstraintLabels — ASHP ─────────────────────────────────────────────

describe('deriveConstraintLabels — ASHP', () => {
  it('emits flow-temperature-limited at 45°C (default fast-fit)', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg);
    const labels = deriveConstraintLabels(cfg, assumptions);
    expect(labels).toContain('flow-temperature-limited');
  });

  it('does NOT emit flow-temperature-limited when upgraded to 35°C', () => {
    const cfg = getSystemConfig('ashp');
    const upgraded: ExplorerAssumptions = { ...deriveAssumptions(cfg), assumedFlowTempC: 35, emitterState: 'upgraded' };
    const labels = deriveConstraintLabels(cfg, upgraded);
    expect(labels).not.toContain('flow-temperature-limited');
  });

  it('emits emitter-limited when emitterState is "existing"', () => {
    const cfg = getSystemConfig('ashp');
    const withExisting: ExplorerAssumptions = { ...deriveAssumptions(cfg), emitterState: 'existing' };
    const labels = deriveConstraintLabels(cfg, withExisting);
    expect(labels).toContain('emitter-limited');
  });

  it('does NOT emit emitter-limited when emitterState is "oversized" or "upgraded"', () => {
    const cfg = getSystemConfig('ashp');
    for (const state of ['oversized', 'upgraded'] as const) {
      const assumptions: ExplorerAssumptions = { ...deriveAssumptions(cfg), emitterState: state };
      const labels = deriveConstraintLabels(cfg, assumptions);
      expect(labels).not.toContain('emitter-limited');
    }
  });

  it('emits primary-flow-limited when primary pipe < 28mm', () => {
    const cfg = getSystemConfig('ashp');
    const narrowPipe: ExplorerAssumptions = { ...deriveAssumptions(cfg), primaryPipeMm: 22 };
    const labels = deriveConstraintLabels(cfg, narrowPipe);
    expect(labels).toContain('primary-flow-limited');
  });

  it('does NOT emit primary-flow-limited when primary pipe = 28mm', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg); // 28mm
    const labels = deriveConstraintLabels(cfg, assumptions);
    expect(labels).not.toContain('primary-flow-limited');
  });

  it('emits no-compensation when compensationEnabled is false', () => {
    const cfg = getSystemConfig('ashp');
    const noComp: ExplorerAssumptions = { ...deriveAssumptions(cfg), compensationEnabled: false };
    const labels = deriveConstraintLabels(cfg, noComp);
    expect(labels).toContain('no-compensation');
  });

  it('does NOT emit no-compensation when compensationEnabled is true', () => {
    const cfg = getSystemConfig('ashp');
    const assumptions = deriveAssumptions(cfg); // compensationEnabled = true
    const labels = deriveConstraintLabels(cfg, assumptions);
    expect(labels).not.toContain('no-compensation');
  });

  it('emits reduced-efficiency-hot-water-mode only at ≥ 55°C', () => {
    const cfg = getSystemConfig('ashp');
    const at55: ExplorerAssumptions = { ...deriveAssumptions(cfg), assumedFlowTempC: 55, emitterState: 'existing' };
    const labels55 = deriveConstraintLabels(cfg, at55);
    expect(labels55).toContain('reduced-efficiency-hot-water-mode');

    const at45: ExplorerAssumptions = { ...deriveAssumptions(cfg), assumedFlowTempC: 45 };
    const labels45 = deriveConstraintLabels(cfg, at45);
    expect(labels45).not.toContain('reduced-efficiency-hot-water-mode');
  });
});

// ── No hidden punitive defaults ───────────────────────────────────────────────

describe('no hidden punitive defaults', () => {
  it('deriveAssumptions never silently sets a higher flow temp than the system config states', () => {
    for (const id of ['combi', 'stored_vented', 'stored_unvented', 'regular_vented', 'system_unvented', 'ashp']) {
      const cfg = getSystemConfig(id);
      const assumptions = deriveAssumptions(cfg);
      const configFlowTemp = cfg.heatSource.isHeatPump
        ? (cfg.heatSource.flowTempC ?? cfg.designFlowTempC)
        : cfg.designFlowTempC;
      expect(assumptions.assumedFlowTempC).toBe(configFlowTemp);
    }
  });

  it('constraint labels are empty for a well-configured system with upgraded emitters at 35°C', () => {
    const cfg = getSystemConfig('ashp');
    const ideal: ExplorerAssumptions = {
      assumedFlowTempC: 35,
      emitterState: 'upgraded',
      primaryPipeMm: 28,
      compensationEnabled: true,
      operatingMode: 'current',
    };
    const labels = deriveConstraintLabels(cfg, ideal);
    expect(labels).toHaveLength(0);
  });

  it('gas boiler with low return temp has no punitive constraint labels', () => {
    // stored_unvented: returnTempC=52 (condensing), well-sized
    const cfg = getSystemConfig('stored_unvented');
    const assumptions = deriveAssumptions(cfg);
    const labels = deriveConstraintLabels(cfg, assumptions);
    // Only flow-temperature-limited can appear, but returnTempC=52 < 55 so none
    expect(labels).toHaveLength(0);
  });
});

// ── Correct updates when inputs change ───────────────────────────────────────

describe('correct updates when assumptions inputs change', () => {
  it('flow-temperature-limited clears when flow temp drops to 35°C', () => {
    const cfg = getSystemConfig('ashp');
    const before: ExplorerAssumptions = { ...deriveAssumptions(cfg), assumedFlowTempC: 45 };
    const after: ExplorerAssumptions  = { ...before, assumedFlowTempC: 35, emitterState: 'upgraded' };

    const labelsBefore = deriveConstraintLabels(cfg, before);
    const labelsAfter  = deriveConstraintLabels(cfg, after);

    expect(labelsBefore).toContain('flow-temperature-limited');
    expect(labelsAfter).not.toContain('flow-temperature-limited');
  });

  it('emitter-limited clears when emitter is upgraded', () => {
    const cfg = getSystemConfig('ashp');
    const before: ExplorerAssumptions = { ...deriveAssumptions(cfg), emitterState: 'existing' };
    const after: ExplorerAssumptions  = { ...before, emitterState: 'upgraded' };

    expect(deriveConstraintLabels(cfg, before)).toContain('emitter-limited');
    expect(deriveConstraintLabels(cfg, after)).not.toContain('emitter-limited');
  });

  it('primary-flow-limited clears when pipe is upgraded to 28mm', () => {
    const cfg = getSystemConfig('ashp');
    const before: ExplorerAssumptions = { ...deriveAssumptions(cfg), primaryPipeMm: 22 };
    const after: ExplorerAssumptions  = { ...before, primaryPipeMm: 28 };

    expect(deriveConstraintLabels(cfg, before)).toContain('primary-flow-limited');
    expect(deriveConstraintLabels(cfg, after)).not.toContain('primary-flow-limited');
  });

  it('no-compensation clears when compensation is enabled', () => {
    const cfg = getSystemConfig('ashp');
    const before: ExplorerAssumptions = { ...deriveAssumptions(cfg), compensationEnabled: false };
    const after: ExplorerAssumptions  = { ...before, compensationEnabled: true };

    expect(deriveConstraintLabels(cfg, before)).toContain('no-compensation');
    expect(deriveConstraintLabels(cfg, after)).not.toContain('no-compensation');
  });
});
