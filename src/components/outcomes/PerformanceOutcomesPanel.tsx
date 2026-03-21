import type { AdviceFromCompareResult, PerformanceSummary } from '../../lib/advice/buildAdviceFromCompare';
import './PerformanceOutcomesPanel.css';

interface Props { advice: AdviceFromCompareResult; }

function outcomeRows(summary: PerformanceSummary | null) {
  if (!summary) return [['Heat','Awaiting compare evidence'],['Hot water','Awaiting compare evidence'],['Efficiency','Awaiting compare evidence'],['Cost','Awaiting compare evidence']] as const;
  return [
    ['Heat', summary.efficiencyBand === 'optimal' ? 'Stable output with stronger control margin' : 'Usable with some operating limits'],
    ['Hot water', summary.optimisationPotential === 'limited' ? 'Demand-led hot water with limited storage flex' : 'Stored hot water buffers peak demand'],
    ['Efficiency', summary.energyConversion.label],
    ['Cost', `${summary.costPerKwhHeat.toFixed(1)}p/kWh heat · ${summary.localGenerationImpact} local generation impact`],
  ] as const;
}

export default function PerformanceOutcomesPanel({ advice }: Props) {
  const summary = advice.bestOverall.performanceSummary;
  return (
    <div className="performance-outcomes" data-testid="performance-outcomes-panel">
      <div className="performance-outcomes__header"><h2>Performance outcomes</h2><p>Live readout from the simulator-backed recommendation layer.</p></div>
      <dl className="performance-outcomes__grid">{outcomeRows(summary).map(([label, value]) => <div key={label} className="performance-outcomes__card"><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </div>
  );
}
