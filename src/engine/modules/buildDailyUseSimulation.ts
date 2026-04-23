/**
 * buildDailyUseSimulation.ts — Derives a DailyUseSimulation from canonical
 * scenario truth (AtlasDecisionV1 + ScenarioResult[]).
 *
 * Architecture:
 *   AtlasDecisionV1 + ScenarioResult[] → [this module] → DailyUseSimulation
 *
 * Rules (enforced here):
 *   - Scoped to the recommended scenario only (PR5).
 *   - All outputs derived from physicsFlags, system type, dayToDayOutcomes,
 *     and supportingFacts. No new physics invented in UI components.
 *   - No Math.random() — deterministic for a given set of inputs.
 *   - Cylinder charge tracked across steps so numbers are internally consistent.
 *
 * Event set for PR5:
 *   shower → second_shower → bath → sink → heating_boost (conditional)
 */

import type { AtlasDecisionV1 } from '../../contracts/AtlasDecisionV1';
import type { ScenarioResult } from '../../contracts/ScenarioResult';
import type {
  DailyUseSimulation,
  DailyUseSimulationStep,
  DailyUseTopPanel,
  DailyUseReaction,
} from '../../contracts/DailyUseSimulation';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Cylinder charge consumed by each event (percentage points). */
const CYLINDER_DRAW: Record<'shower' | 'second_shower' | 'bath' | 'sink', number> = {
  shower:        15,
  second_shower: 20,
  bath:          25,
  sink:           2,
};

/** Starting cylinder charge for stored-water systems. */
const CYLINDER_INITIAL_PCT = 100;

const SYSTEM_TYPE_LABEL: Record<ScenarioResult['system']['type'], string> = {
  combi:   'Combi boiler',
  system:  'System boiler',
  regular: 'Regular boiler',
  ashp:    'Heat pump',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True when the scenario uses a stored hot-water cylinder. */
function hasStoredCylinder(type: ScenarioResult['system']['type']): boolean {
  return type === 'system' || type === 'regular' || type === 'ashp';
}

/**
 * Derive a representative flow temperature from scenario flags.
 * Only used when the value can be grounded in scenario physics.
 */
function deriveFlowTempC(scenario: ScenarioResult): number | undefined {
  if (scenario.system.type === 'ashp') return 50;
  if (scenario.physicsFlags.highTempRequired) return 75;
  return 65;
}

/** Draw down cylinder charge, clamping at zero. */
function drawCylinder(current: number, draw: number): number {
  return Math.max(0, current - draw);
}

// ─── Step builders ────────────────────────────────────────────────────────────

function buildShowerStep(
  scenario: ScenarioResult,
  cylinderCharge: number,
): { step: DailyUseSimulationStep; cylinderAfter: number } {
  const { type } = scenario.system;
  const { pressureConstraint, hydraulicLimit } = scenario.physicsFlags;
  const stored = hasStoredCylinder(type);
  const chargeAfter = stored
    ? drawCylinder(cylinderCharge, CYLINDER_DRAW.shower)
    : cylinderCharge;

  const reactions: DailyUseReaction[] = [];

  if (type === 'combi') {
    reactions.push({
      title: 'Shower runs',
      outcome: pressureConstraint
        ? 'Shower runs — flow may be slightly reduced at this supply pressure'
        : 'Shower runs well at full flow',
      severity: pressureConstraint ? 'mixed' : 'good',
    });
    reactions.push({
      title: 'Boiler state',
      outcome: 'Boiler fires on demand — no warm-up wait',
      severity: 'good',
    });
  } else if (type === 'ashp') {
    reactions.push({
      title: 'Shower runs',
      outcome: 'Hot water delivered from pre-heated cylinder',
      severity: 'good',
    });
    reactions.push({
      title: 'Cylinder charge',
      outcome: `Stored charge available — cylinder at ${chargeAfter}%`,
      severity: 'good',
    });
  } else {
    // system / regular
    reactions.push({
      title: 'Shower runs',
      outcome: 'Stored hot water delivers at full pressure',
      severity: 'good',
    });
    if (hydraulicLimit) {
      reactions.push({
        title: 'Flow note',
        outcome: 'Pipe diameter may cap peak flow — acceptable for a single outlet',
        severity: 'mixed',
      });
    } else {
      reactions.push({
        title: 'Cylinder charge',
        outcome: `No simultaneous demand risk at this stage — cylinder at ${chargeAfter}%`,
        severity: 'good',
      });
    }
  }

  const topPanel: DailyUseTopPanel = {
    heatSourceState:      'hot_water',
    flowTempC:            deriveFlowTempC(scenario),
    coldMainsStatus:      pressureConstraint ? 'reduced' : 'strong',
    cylinderChargePercent: stored ? chargeAfter : undefined,
  };

  return {
    step: { eventType: 'shower', label: 'Shower', reactions, topPanel },
    cylinderAfter: chargeAfter,
  };
}

function buildSecondShowerStep(
  scenario: ScenarioResult,
  cylinderCharge: number,
): { step: DailyUseSimulationStep; cylinderAfter: number } {
  const { type } = scenario.system;
  const { pressureConstraint, combiFlowRisk, hydraulicLimit } = scenario.physicsFlags;
  const stored = hasStoredCylinder(type);
  const chargeAfter = stored
    ? drawCylinder(cylinderCharge, CYLINDER_DRAW.second_shower)
    : cylinderCharge;

  const reactions: DailyUseReaction[] = [];

  if (type === 'combi') {
    if (combiFlowRisk) {
      reactions.push({
        title: 'Simultaneous demand',
        outcome: 'Simultaneous demand may exceed on-demand DHW capacity',
        severity: 'warning',
        supportingPoints: [
          'Flow to both outlets may reduce while both run simultaneously',
          'A stored-water system would buffer this demand',
        ],
      });
    } else {
      reactions.push({
        title: 'Second shower',
        outcome: 'Both outlets run from on-demand supply',
        severity: 'good',
      });
      reactions.push({
        title: pressureConstraint ? 'Pressure note' : 'Mains supply',
        outcome: pressureConstraint
          ? 'Cold mains pressure may feel reduced with two draws running'
          : 'No stored buffer needed at this occupancy level',
        severity: pressureConstraint ? 'mixed' : 'good',
      });
    }
  } else if (type === 'ashp') {
    if (hydraulicLimit || pressureConstraint) {
      reactions.push({
        title: 'Second shower',
        outcome: 'Both showers usable — cylinder provides buffer',
        severity: 'mixed',
        supportingPoints: [
          'Recovery rate may be slower than a gas-fired system',
          `Cylinder charge reduces to ${chargeAfter}%`,
        ],
      });
    } else {
      reactions.push({
        title: 'Second shower',
        outcome: 'Stored cylinder buffers simultaneous demand — both showers usable',
        severity: 'good',
      });
      reactions.push({
        title: 'Cylinder charge',
        outcome: `Cylinder charge drawn down to ${chargeAfter}%`,
        severity: 'good',
      });
    }
  } else {
    // system / regular
    reactions.push({
      title: 'Second shower',
      outcome: 'Stored cylinder buffers simultaneous demand — both showers remain usable',
      severity: 'good',
    });
    reactions.push({
      title: 'Cylinder charge',
      outcome: `Cylinder charge drawn down to ${chargeAfter}%`,
      severity: chargeAfter >= 40 ? 'good' : 'mixed',
    });
  }

  const coldMainsStatus =
    type === 'combi' && combiFlowRisk ? 'limited'
    : pressureConstraint              ? 'reduced'
    : stored                          ? 'strong'
    : 'reduced';

  const topPanel: DailyUseTopPanel = {
    heatSourceState:       'hot_water',
    flowTempC:             deriveFlowTempC(scenario),
    coldMainsStatus,
    cylinderChargePercent: stored ? chargeAfter : undefined,
  };

  return {
    step: { eventType: 'second_shower', label: 'Second shower', reactions, topPanel },
    cylinderAfter: chargeAfter,
  };
}

function buildBathStep(
  scenario: ScenarioResult,
  cylinderCharge: number,
): { step: DailyUseSimulationStep; cylinderAfter: number } {
  const { type } = scenario.system;
  const { pressureConstraint } = scenario.physicsFlags;
  const stored = hasStoredCylinder(type);
  const chargeAfter = stored
    ? drawCylinder(cylinderCharge, CYLINDER_DRAW.bath)
    : cylinderCharge;

  const reactions: DailyUseReaction[] = [];

  if (type === 'combi') {
    reactions.push({
      title: 'Bath fills',
      outcome: pressureConstraint
        ? 'Fill time slightly longer than with a stored-water option'
        : 'Bath fills at a comfortable rate',
      severity: pressureConstraint ? 'mixed' : 'good',
    });
    if (pressureConstraint) {
      reactions.push({
        title: 'Supply note',
        outcome: 'Mains pressure constrains maximum fill rate — expected at this property',
        severity: 'mixed',
      });
    }
  } else if (type === 'ashp') {
    const chargeOk = chargeAfter > 20;
    reactions.push({
      title: 'Bath fills',
      outcome: chargeOk
        ? 'Bath fills from stored cylinder at full pressure'
        : 'Cylinder charge is low — bath fill may be slower toward the end',
      severity: chargeOk ? 'good' : 'mixed',
    });
    reactions.push({
      title: 'Cylinder charge',
      outcome: `Cylinder charge at ${chargeAfter}% after bath fill`,
      severity: chargeAfter > 30 ? 'good' : 'mixed',
    });
  } else {
    // system / regular
    reactions.push({
      title: 'Bath fills',
      outcome: 'Bath fills quickly from stored cylinder at full pressure',
      severity: 'good',
    });
    reactions.push({
      title: 'Cylinder charge',
      outcome: `Cylinder charge reduces to ${chargeAfter}% — reheats automatically`,
      severity: chargeAfter > 20 ? 'good' : 'mixed',
    });
  }

  const topPanel: DailyUseTopPanel = {
    heatSourceState:       'hot_water',
    flowTempC:             deriveFlowTempC(scenario),
    coldMainsStatus:       pressureConstraint ? 'reduced' : 'strong',
    cylinderChargePercent: stored ? chargeAfter : undefined,
  };

  return {
    step: { eventType: 'bath', label: 'Bath', reactions, topPanel },
    cylinderAfter: chargeAfter,
  };
}

function buildSinkStep(
  scenario: ScenarioResult,
  cylinderCharge: number,
): { step: DailyUseSimulationStep; cylinderAfter: number } {
  const { type } = scenario.system;
  const { pressureConstraint, hydraulicLimit } = scenario.physicsFlags;
  const stored = hasStoredCylinder(type);
  const chargeAfter = stored
    ? drawCylinder(cylinderCharge, CYLINDER_DRAW.sink)
    : cylinderCharge;

  const reactions: DailyUseReaction[] = [];

  if (hydraulicLimit || pressureConstraint) {
    reactions.push({
      title: 'Cold tap',
      outcome: 'Cold tap may feel slightly weaker while hot water is running',
      severity: 'mixed',
    });
  } else {
    reactions.push({
      title: 'Cold tap',
      outcome: 'Cold tap pressure unaffected',
      severity: 'good',
    });
  }

  reactions.push({
    title: 'Hot tap',
    outcome:
      type === 'combi'
        ? 'Hot water available immediately on demand'
        : 'Hot water drawn from stored cylinder — immediate delivery',
    severity: 'good',
  });

  const topPanel: DailyUseTopPanel = {
    heatSourceState:       'hot_water',
    coldMainsStatus:       hydraulicLimit || pressureConstraint ? 'reduced' : 'strong',
    cylinderChargePercent: stored ? chargeAfter : undefined,
  };

  return {
    step: { eventType: 'sink', label: 'Sink', reactions, topPanel },
    cylinderAfter: chargeAfter,
  };
}

function buildHeatingBoostStep(
  scenario: ScenarioResult,
  cylinderCharge: number,
): { step: DailyUseSimulationStep; cylinderAfter: number } {
  const { type } = scenario.system;
  const { highTempRequired } = scenario.physicsFlags;
  const stored = hasStoredCylinder(type);

  const reactions: DailyUseReaction[] = [
    {
      title: 'Heating boost',
      outcome: 'Heating circuit activated — room temperature rises gradually',
      severity: 'good',
    },
  ];

  if (type === 'ashp') {
    reactions.push({
      title: 'Heat pump',
      outcome: 'Heat pump ramps up — expect a gentle, steady rise rather than a sharp spike',
      severity: 'good',
    });
  } else if (highTempRequired) {
    reactions.push({
      title: 'Flow temperature',
      outcome: 'High flow temperature required for existing emitters — boiler runs at design point',
      severity: 'mixed',
    });
  }

  const topPanel: DailyUseTopPanel = {
    heatSourceState:       'heating',
    flowTempC:             deriveFlowTempC(scenario),
    coldMainsStatus:       'strong',
    cylinderChargePercent: stored ? cylinderCharge : undefined,
  };

  return {
    step: { eventType: 'heating_boost', label: 'Heating boost', reactions, topPanel },
    cylinderAfter: cylinderCharge,
  };
}

// ─── Public builder ───────────────────────────────────────────────────────────

/**
 * buildDailyUseSimulation
 *
 * Derives a DailyUseSimulation for the recommended scenario from canonical
 * decision and scenario data.
 *
 * Returns null if the recommended scenario cannot be found in the scenarios
 * array (defensive — callers should always pass a consistent pair).
 */
export function buildDailyUseSimulation(
  decision: AtlasDecisionV1,
  scenarios: ScenarioResult[],
): DailyUseSimulation | null {
  const recommended = scenarios.find(
    (s) => s.scenarioId === decision.recommendedScenarioId,
  );
  if (!recommended) return null;

  const title = `${SYSTEM_TYPE_LABEL[recommended.system.type] ?? recommended.system.type} — daily use`;
  const steps: DailyUseSimulationStep[] = [];

  let cylinderCharge = hasStoredCylinder(recommended.system.type)
    ? CYLINDER_INITIAL_PCT
    : 0;

  const r1 = buildShowerStep(recommended, cylinderCharge);
  steps.push(r1.step);
  cylinderCharge = r1.cylinderAfter;

  const r2 = buildSecondShowerStep(recommended, cylinderCharge);
  steps.push(r2.step);
  cylinderCharge = r2.cylinderAfter;

  const r3 = buildBathStep(recommended, cylinderCharge);
  steps.push(r3.step);
  cylinderCharge = r3.cylinderAfter;

  const r4 = buildSinkStep(recommended, cylinderCharge);
  steps.push(r4.step);
  cylinderCharge = r4.cylinderAfter;

  // Include heating_boost when high-temp or heat-pump context is relevant
  if (
    recommended.physicsFlags.highTempRequired ||
    recommended.system.type === 'ashp'
  ) {
    const r5 = buildHeatingBoostStep(recommended, cylinderCharge);
    steps.push(r5.step);
  }

  return {
    scenarioId: recommended.scenarioId,
    title,
    steps,
  };
}
