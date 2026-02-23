import type { EngineInputV2_3, HeatPumpRegimeModuleV1Result, HeatPumpRegimeFlagItem } from '../schema/EngineInputV2_3';

/**
 * HeatPumpRegimeModuleV1
 *
 * Derives the design flow temperature band and expected SPF band for an ASHP
 * installation based on the installer / homeowner's emitter upgrade appetite.
 *
 * Physics:
 *   - 35°C flow  → high SPF (good). Requires full emitter upgrade (UFH or oversized rads).
 *   - 45°C flow  → moderate SPF (ok). Partial upgrade — some rads replaced / UFH in wet rooms.
 *   - 50°C flow  → poor SPF.  Minimal change — keep existing rads at near-conventional temps.
 *
 * Lower flow temps increase SPF; high flow temps collapse COP.
 */
export function runHeatPumpRegimeModuleV1(input: EngineInputV2_3): HeatPumpRegimeModuleV1Result {
  const appetite = input.retrofit?.emitterUpgradeAppetite ?? 'none';

  let designFlowTempBand: 35 | 45 | 50;
  let spfBand: 'good' | 'ok' | 'poor';

  switch (appetite) {
    case 'full_job':
      designFlowTempBand = 35;
      spfBand = 'good';
      break;
    case 'some':
      designFlowTempBand = 45;
      spfBand = 'ok';
      break;
    case 'none':
    default:
      designFlowTempBand = 50;
      spfBand = 'poor';
      break;
  }

  const flags: HeatPumpRegimeFlagItem[] = [];
  const assumptions: string[] = [
    'Lower flow temps increase SPF; high flow temps collapse COP.',
    'SPF estimated at design conditions — actual performance varies with climate and occupancy.',
  ];

  if (designFlowTempBand === 50) {
    flags.push({
      id: 'regime-flow-temp-elevated',
      severity: 'warn',
      title: 'Elevated flow temperature',
      detail:
        'Operating at 50°C flow significantly reduces heat pump efficiency. ' +
        'Consider upgrading emitters to unlock lower flow temps and higher SPF.',
    });
    flags.push({
      id: 'regime-cop-penalty',
      severity: 'warn',
      title: 'COP penalty at high flow temp',
      detail:
        'Every 1°C rise in flow temperature above 35°C costs approximately 2–3% COP. ' +
        'At 50°C vs 35°C, seasonal SPF can drop from ~3.5 to ~2.5.',
    });
    flags.push({
      id: 'regime-full-job-unlocks-low-temp',
      severity: 'info',
      title: 'Full job unlocks low-temp + higher SPF',
      detail:
        'Upgrading all emitters to low-temperature radiators or underfloor heating ' +
        'enables 35°C design flow, which is the optimal operating point for an ASHP.',
    });
  } else if (designFlowTempBand === 45) {
    flags.push({
      id: 'regime-cop-penalty',
      severity: 'info',
      title: 'Moderate COP at 45°C flow',
      detail:
        'Partial emitter upgrades allow 45°C flow. SPF will be moderate (~3.0–3.2). ' +
        'Full emitter upgrade would unlock 35°C and better SPF.',
    });
    flags.push({
      id: 'regime-full-job-unlocks-low-temp',
      severity: 'info',
      title: 'Full job unlocks low-temp + higher SPF',
      detail:
        'Upgrading all emitters to low-temperature radiators or underfloor heating ' +
        'enables 35°C design flow, which is the optimal operating point for an ASHP.',
    });
  }

  return { designFlowTempBand, spfBand, flags, assumptions };
}
