/**
 * LimitersBuilder.ts
 *
 * Builds a LimitersV1 from FullEngineResultCore + EngineInputV2_3.
 *
 * Limiters are named, human-facing constraints that explain the verdict.
 * They differ from rule flags (internal) — each limiter maps to a physical
 * constraint with observed vs limit metrics and suggested fixes.
 *
 * Rule → Limiter mapping:
 *   combi-flow-inadequate      → mains-flow-constraint
 *   combi-simultaneous-demand  → combi-concurrency-constraint
 *   primary-velocity-high      → primary-pipe-constraint
 *   cycling-penalty            → cycling-loss-penalty
 */
import type { FullEngineResultCore, EngineInputV2_3 } from './schema/EngineInputV2_3';
import type { LimiterV1, LimitersV1, LimiterSeverity } from '../contracts/EngineOutputV1';

/**
 * Sort limiters by severity (fail → warn → info), then by how far past the
 * limit the observation is (larger exceedance first).
 */
function sortLimiters(limiters: LimiterV1[]): LimiterV1[] {
  const severityOrder: Record<LimiterSeverity, number> = { fail: 0, warn: 1, info: 2 };
  return [...limiters].sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    // Within same severity: sort by exceedance margin (observed / limit, desc)
    const aMargin = a.limit.value > 0 ? a.observed.value / a.limit.value : 0;
    const bMargin = b.limit.value > 0 ? b.observed.value / b.limit.value : 0;
    return bMargin - aMargin;
  });
}

export function buildLimitersV1(
  result: FullEngineResultCore,
  input: EngineInputV2_3,
): LimitersV1 {
  const limiters: LimiterV1[] = [];

  const { combiDhwV1, hydraulicV1, sludgeVsScale, cwsSupplyV1 } = result;

  // ── 1. Mains flow constraint ───────────────────────────────────────────────
  // Triggered when combi is limited by mains flow rate.
  const mainsFlowLpm = input.mainsDynamicFlowLpm ?? cwsSupplyV1.dynamic?.flowLpm;
  const combiFlowLimitLpm = 13; // typical UK combi DHW limit at ΔT 25°C, 30 kW
  if (mainsFlowLpm != null && mainsFlowLpm < combiFlowLimitLpm) {
    const severity: LimiterSeverity = mainsFlowLpm < 10 ? 'fail' : 'warn';
    limiters.push({
      id: 'mains-flow-constraint',
      title: 'Mains flow constraint',
      severity,
      observed: { label: 'Measured mains flow', value: mainsFlowLpm, unit: 'L/min' },
      limit:    { label: 'Min for combi DHW', value: combiFlowLimitLpm, unit: 'L/min' },
      impact: {
        summary: `Mains flow of ${mainsFlowLpm} L/min is below the ${combiFlowLimitLpm} L/min minimum for comfortable combi DHW delivery.`,
        detail: 'Low mains flow causes temperature collapse during showers and prevents simultaneous DHW draws.',
      },
      confidence: input.mainsDynamicFlowLpm != null ? 'high' : 'low',
      sources: [
        input.mainsDynamicFlowLpm != null
          ? { kind: 'measured', note: 'Flow measured during survey.' }
          : { kind: 'assumed', id: 'mains-flow-assumed', note: 'Flow estimated from occupancy heuristics.' },
      ],
      suggestedFixes: [
        { id: 'switch-to-stored', label: 'Switch to stored DHW system', deltaHint: 'Stores heat independently of mains pressure.' },
        { id: 'pressure-booster', label: 'Install pressure booster pump', deltaHint: 'Raises effective flow to ~18+ L/min.' },
      ],
    });
  }

  // ── 2. Combi concurrency constraint ───────────────────────────────────────
  // Triggered by combi simultaneous demand flag (combi family only).
  const simultaneousFlag = combiDhwV1?.flags.find(f => f.id === 'combi-simultaneous-demand');
  if (simultaneousFlag) {
    const bathroomCount = input.bathroomCount ?? 1;
    const peakOutlets = input.peakConcurrentOutlets ?? bathroomCount;
    const severity: LimiterSeverity = simultaneousFlag.severity === 'fail' ? 'fail' : 'warn';
    limiters.push({
      id: 'combi-concurrency-constraint',
      title: 'DHW throughput limit: simultaneous outlet demand',
      severity,
      observed: { label: 'Peak concurrent outlets', value: peakOutlets, unit: 'L/min' },
      limit:    { label: 'Max concurrent outlets', value: 1, unit: 'L/min' },
      impact: {
        summary: `${peakOutlets} simultaneous hot-water draws exceed a combi boiler's throughput capacity.`,
        detail: 'A combi is throughput-limited — it can serve one DHW outlet at full flow. Concurrent draws cause temperature drop or flow reduction at one or more outlets.',
      },
      confidence: input.bathroomCount != null ? 'high' : 'medium',
      sources: [
        input.bathroomCount != null
          ? { kind: 'measured', note: `${bathroomCount} bathrooms confirmed in survey.` }
          : { kind: 'assumed', note: 'Bathroom count estimated from occupancy.' },
      ],
      suggestedFixes: [
        { id: 'switch-to-unvented', label: 'Switch to unvented cylinder', deltaHint: 'Serves multiple outlets simultaneously at mains pressure.' },
        { id: 'switch-to-stored-vented', label: 'Switch to stored vented cylinder', deltaHint: 'Gravity-fed, stable simultaneous delivery.' },
      ],
    });
  }

  // ── 3. Primary pipe constraint ─────────────────────────────────────────────
  // Triggered when primary pipe velocity is high (warn/fail for ASHP).
  if (hydraulicV1.verdict.ashpRisk !== 'pass') {
    const pipeDiameter = input.primaryPipeDiameter ?? 22;
    const ashpFlowLpm = hydraulicV1.ashp.flowLpm;
    const safeFlowLpm = hydraulicV1.boiler.flowLpm * 1.5; // approximate safe limit at 28mm
    const severity: LimiterSeverity = hydraulicV1.verdict.ashpRisk === 'fail' ? 'fail' : 'warn';
    limiters.push({
      id: 'primary-pipe-constraint',
      title: 'Primary pipe constraint',
      severity,
      observed: { label: 'Required ASHP flow', value: parseFloat(ashpFlowLpm.toFixed(1)), unit: 'L/min' },
      limit:    { label: 'Safe flow for pipe', value: parseFloat(safeFlowLpm.toFixed(1)), unit: 'L/min' },
      impact: {
        summary: `${pipeDiameter}mm primary pipework cannot safely carry the ${ashpFlowLpm.toFixed(1)} L/min flow required by a heat pump.`,
        detail: 'High pipe velocity causes erosion, noise, and reduced heat transfer efficiency. Heat pump operation requires larger primary circuits.',
      },
      confidence: input.primaryPipeDiameter != null ? 'high' : 'medium',
      sources: [
        { kind: 'derived', note: 'Required ASHP flow derived from heat loss and design ΔT assumption.' },
        input.primaryPipeDiameter != null
          ? { kind: 'measured', note: `Primary pipe diameter confirmed as ${pipeDiameter}mm.` }
          : { kind: 'assumed', note: 'Primary pipe assumed 22mm (UK default).' },
      ],
      suggestedFixes: [
        { id: 'upgrade-primary-28mm', label: 'Upgrade primary circuit to 28mm', deltaHint: 'Raises safe flow capacity to ~22 L/min.' },
        { id: 'upgrade-primary-35mm', label: 'Upgrade primary circuit to 35mm', deltaHint: 'Raises safe flow capacity to ~35 L/min.' },
      ],
    });
  }

  // ── 4. Cycling loss penalty ────────────────────────────────────────────────
  // Triggered by sludge-related cycling losses above a threshold.
  const cyclingLossPct = sludgeVsScale.cyclingLossPct ?? 0;
  if (cyclingLossPct > 0.05) {
    const observedLoss = parseFloat((cyclingLossPct * 100).toFixed(1));
    const severity: LimiterSeverity = cyclingLossPct >= 0.15 ? 'fail' : 'warn';
    limiters.push({
      id: 'cycling-loss-penalty',
      title: 'Cycling loss penalty',
      severity,
      observed: { label: 'Cycling loss', value: observedLoss, unit: '%' },
      limit:    { label: 'Acceptable cycling loss', value: 5, unit: '%' },
      impact: {
        summary: `Sludge-restricted circuit causes ${observedLoss}% additional fuel consumption from short-cycling.`,
        detail: 'A dirty primary circuit restricts flow and causes the boiler to overshoot setpoint quickly, firing on/off more frequently at low loads.',
      },
      confidence: 'medium',
      sources: [
        { kind: 'derived', note: 'Derived from system age, water hardness, and filter/service history.' },
      ],
      suggestedFixes: [
        { id: 'powerflush', label: 'Powerflush primary circuit', deltaHint: 'Removes sludge, restores designed flow rates.' },
        { id: 'fit-magnetic-filter', label: 'Fit magnetic filter', deltaHint: 'Prevents future sludge accumulation.' },
      ],
    });
  }

  return { limiters: sortLimiters(limiters) };
}
