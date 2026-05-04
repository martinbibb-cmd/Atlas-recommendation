/**
 * buildCurrentInstallationSummaryFromCanonicalSurvey.test.ts
 *
 * Unit tests for buildCurrentInstallationSummaryFromCanonicalSurvey.
 *
 * Acceptance criteria from the problem statement:
 *   1. Completed combi visit hydrates: Heat source + Hot water, not all missing.
 *   2. Completed system boiler + unvented cylinder visit hydrates correctly.
 *   3. Completed regular boiler + vented cylinder visit hydrates correctly.
 *   4. Legacy flat family = combi hydrates at least heat source + hot water.
 *   5. Legacy flat family = system_stored does NOT invent unvented unless data exists.
 *   6. Legacy flat family = regular_stored does NOT invent vented cylinder unless data exists.
 *   7. If only heat source is known: heat source shown; hot water / primary circuit null.
 *   8. No existing wet heating (none) hydrates as none/not_applicable.
 *   9. systemBuilder is preferred over engine-normalised fields.
 *   10. heatingCondition.systemCircuitType takes priority for primary circuit.
 *   11. Cylinder install location is bridged to cylinderLocation.
 */

import { describe, it, expect } from 'vitest';
import { buildCurrentInstallationSummaryFromCanonicalSurvey } from '../buildCurrentInstallationSummaryFromCanonicalSurvey';
import type { CanonicalSurveyAdapterInput } from '../buildCurrentInstallationSummaryFromCanonicalSurvey';

// ─── Test 1: Completed combi visit ────────────────────────────────────────────

describe('Acceptance 1 — completed combi visit', () => {
  it('hydrates heat source as combi_boiler from systemBuilder', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'combi',
          dhwType: null,
          heatingSystemType: null,
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.heatSource).toBe('combi_boiler');
  });

  it('hydrates hot water as no_cylinder for combi', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'combi',
          dhwType: null,
          heatingSystemType: null,
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('no_cylinder');
  });

  it('sets primaryCircuit to not_applicable for combi when circuit type absent', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'combi',
          dhwType: null,
          heatingSystemType: null,
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.primaryCircuit).toBe('not_applicable');
  });

  it('does NOT show all three fields as null/missing for a combi survey', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'combi',
          dhwType: null,
          heatingSystemType: null,
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.heatSource).not.toBeNull();
    expect(summary.hotWater).not.toBeNull();
    expect(summary.primaryCircuit).not.toBeNull();
  });
});

// ─── Test 2: System boiler + unvented cylinder ───────────────────────────────

describe('Acceptance 2 — system boiler + unvented cylinder', () => {
  it('hydrates heat source as system_boiler', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'system',
          dhwType: 'unvented',
          heatingSystemType: 'sealed',
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.heatSource).toBe('system_boiler');
  });

  it('hydrates hot water as unvented_cylinder', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'system',
          dhwType: 'unvented',
          heatingSystemType: 'sealed',
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('unvented_cylinder');
  });

  it('hydrates primary circuit as sealed_primary', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'system',
          dhwType: 'unvented',
          heatingSystemType: 'sealed',
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.primaryCircuit).toBe('sealed_primary');
  });
});

// ─── Test 3: Regular boiler + vented cylinder ────────────────────────────────

describe('Acceptance 3 — regular boiler + vented cylinder', () => {
  it('hydrates heat source as regular_boiler', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'regular',
          dhwType: 'open_vented',
          heatingSystemType: 'open_vented',
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.heatSource).toBe('regular_boiler');
  });

  it('hydrates hot water as vented_cylinder', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'regular',
          dhwType: 'open_vented',
          heatingSystemType: 'open_vented',
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('vented_cylinder');
  });

  it('hydrates primary circuit as open_vented_primary', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'regular',
          dhwType: 'open_vented',
          heatingSystemType: 'open_vented',
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.primaryCircuit).toBe('open_vented_primary');
  });
});

// ─── Test 4: Legacy flat combi ────────────────────────────────────────────────

describe('Acceptance 4 — legacy flat field currentHeatSourceType = combi', () => {
  it('hydrates heat source from flat currentHeatSourceType = combi', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentHeatSourceType: 'combi',
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.heatSource).toBe('combi_boiler');
  });

  it('hydrates hot water as no_cylinder from flat combi', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentHeatSourceType: 'combi',
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('no_cylinder');
  });

  it('sets primaryCircuit to not_applicable for flat combi', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentHeatSourceType: 'combi',
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.primaryCircuit).toBe('not_applicable');
  });
});

// ─── Test 5: Legacy flat system — does NOT invent unvented ────────────────────

describe('Acceptance 5 — legacy flat system does NOT invent unvented cylinder', () => {
  it('returns null hot water for currentHeatSourceType=system without cylinder data', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentHeatSourceType: 'system',
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBeNull();
  });

  it('uses dhwStorageType when provided alongside system boiler', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentHeatSourceType: 'system',
      dhwStorageType: 'unvented',
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('unvented_cylinder');
  });
});

// ─── Test 6: Legacy flat regular — does NOT invent vented cylinder ─────────────

describe('Acceptance 6 — legacy flat regular does NOT invent vented cylinder', () => {
  it('returns null hot water for currentHeatSourceType=regular without cylinder data', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentHeatSourceType: 'regular',
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBeNull();
  });

  it('uses dhwStorageType=vented when provided alongside regular boiler', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentHeatSourceType: 'regular',
      dhwStorageType: 'vented',
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('vented_cylinder');
  });
});

// ─── Test 7: Only heat source known ──────────────────────────────────────────

describe('Acceptance 7 — only heat source known', () => {
  it('shows heat source when only currentSystem.boiler.type is available', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentSystem: {
        boiler: { type: 'system' },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.heatSource).toBe('system_boiler');
    expect(summary.hotWater).toBeNull();
    expect(summary.primaryCircuit).toBeNull();
  });

  it('shows heat source when only currentHeatSourceType is available', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentHeatSourceType: 'regular',
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.heatSource).toBe('regular_boiler');
    expect(summary.hotWater).toBeNull();
  });
});

// ─── Test 8: No wet heating ───────────────────────────────────────────────────

describe('Acceptance 8 — no existing wet heating', () => {
  it('maps dhwStorageType=none to no_cylinder hot water', () => {
    const input: CanonicalSurveyAdapterInput = {
      dhwStorageType: 'none',
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('no_cylinder');
  });

  it('maps dhw.architecture=on_demand to no_cylinder when no systemBuilder', () => {
    const input: CanonicalSurveyAdapterInput = {
      dhw: { architecture: 'on_demand' },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('no_cylinder');
  });

  it('maps stored_mixergy architecture to mixergy_or_stratified', () => {
    const input: CanonicalSurveyAdapterInput = {
      dhw: { architecture: 'stored_mixergy' },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('mixergy_or_stratified');
  });
});

// ─── Test 9: systemBuilder preferred over engine-normalised ──────────────────

describe('Acceptance 9 — systemBuilder preferred over currentSystem', () => {
  it('uses systemBuilder.heatSource=regular over currentSystem.boiler.type=combi', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentSystem: { boiler: { type: 'combi' } },
      fullSurvey: {
        systemBuilder: {
          heatSource: 'regular',
          dhwType: null,
          heatingSystemType: null,
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.heatSource).toBe('regular_boiler');
  });

  it('uses systemBuilder.dhwType=thermal_store over dhwStorageType=vented', () => {
    const input: CanonicalSurveyAdapterInput = {
      dhwStorageType: 'vented',
      currentHeatSourceType: 'regular',
      fullSurvey: {
        systemBuilder: {
          heatSource: 'regular',
          dhwType: 'thermal_store',
          heatingSystemType: null,
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('thermal_store');
  });
});

// ─── Test 10: heatingCondition.systemCircuitType priority ────────────────────

describe('Acceptance 10 — heatingCondition.systemCircuitType takes priority', () => {
  it('uses heatingCondition.systemCircuitType=sealed over systemBuilder.heatingSystemType=open_vented', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'regular',
          dhwType: 'open_vented',
          heatingSystemType: 'open_vented',
        },
        heatingCondition: {
          systemCircuitType: 'sealed',
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.primaryCircuit).toBe('sealed_primary');
  });

  it('uses currentSystem.heatingSystemType when no systemBuilder or heatingCondition', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentSystem: {
        boiler: { type: 'regular' },
        heatingSystemType: 'sealed',
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.primaryCircuit).toBe('sealed_primary');
  });
});

// ─── Test 11: Cylinder location bridged ──────────────────────────────────────

describe('Acceptance 11 — cylinder install location is bridged', () => {
  it('includes cylinderLocation when dhwCondition.cylinderInstallLocation is set', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'system',
          dhwType: 'unvented',
          heatingSystemType: 'sealed',
        },
        dhwCondition: {
          cylinderInstallLocation: 'airing_cupboard',
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.cylinderLocation).toBe('Airing cupboard');
  });

  it('omits cylinderLocation when location is unknown', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        dhwCondition: {
          cylinderInstallLocation: 'unknown',
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.cylinderLocation).toBeUndefined();
  });
});

// ─── Additional: engine-normalised currentSystem.boiler.type ─────────────────

describe('Engine-normalised boiler type mapping', () => {
  it('maps back_boiler to back_boiler label', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentSystem: { boiler: { type: 'back_boiler' } },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.heatSource).toBe('back_boiler');
  });

  it('maps ashp currentHeatSourceType to heat_pump', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentHeatSourceType: 'ashp',
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.heatSource).toBe('heat_pump');
  });
});

// ─── Additional: storage_combi ────────────────────────────────────────────────

describe('storage_combi handling', () => {
  it('maps storage_combi heatSource to storage_combi label', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'storage_combi',
          dhwType: null,
          heatingSystemType: null,
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.heatSource).toBe('storage_combi');
  });

  it('sets hot water to no_cylinder for storage_combi (no separate cylinder)', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'storage_combi',
          dhwType: null,
          heatingSystemType: null,
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('no_cylinder');
  });

  it('sets primaryCircuit to not_applicable for storage_combi', () => {
    const input: CanonicalSurveyAdapterInput = {
      fullSurvey: {
        systemBuilder: {
          heatSource: 'storage_combi',
          dhwType: 'small_store',
          heatingSystemType: null,
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.primaryCircuit).toBe('not_applicable');
  });
});

// ─── Additional: empty input returns all-null summary ────────────────────────

describe('Empty input', () => {
  it('returns all-null summary when input is empty', () => {
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey({});
    expect(summary.heatSource).toBeNull();
    expect(summary.hotWater).toBeNull();
    expect(summary.primaryCircuit).toBeNull();
    expect(summary.boilerLocation).toBeUndefined();
    expect(summary.cylinderLocation).toBeUndefined();
  });
});

// ─── Additional: dhwCondition.currentCylinderType mapping ────────────────────

describe('dhwCondition.currentCylinderType fallback', () => {
  it('uses currentCylinderType=mixergy when systemBuilder.dhwType is null', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentSystem: { boiler: { type: 'system' } },
      fullSurvey: {
        dhwCondition: {
          currentCylinderType: 'mixergy',
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('mixergy_or_stratified');
  });

  it('uses currentCylinderType=vented when systemBuilder.dhwType is null', () => {
    const input: CanonicalSurveyAdapterInput = {
      currentSystem: { boiler: { type: 'regular' } },
      fullSurvey: {
        dhwCondition: {
          currentCylinderType: 'vented',
        },
      },
    };
    const summary = buildCurrentInstallationSummaryFromCanonicalSurvey(input);
    expect(summary.hotWater).toBe('vented_cylinder');
  });
});
