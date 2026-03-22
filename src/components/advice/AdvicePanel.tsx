import type { AdviceFromCompareResult } from '../../lib/advice/buildAdviceFromCompare';
import type { SimulatorSystemChoice } from '../../explainers/lego/simulator/useSystemDiagramPlayback';
import type { DrawOffFlowStability } from '../../engine/modules/StoredDhwModule';
import './AdvicePanel.css';

interface Props {
  advice: AdviceFromCompareResult;
  /** System choice for the current system — used to trigger pipework advisory. */
  systemChoice?: SimulatorSystemChoice;
  /** Flow stability derived from CWS head / branch hydraulics — used to gate advisory. */
  flowStability?: DrawOffFlowStability;
}

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return <section className="advice-panel__section"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>;
}

function PipeworkAdvisory() {
  return (
    <section className="advice-panel__section advice-panel__pipework-advisory" data-testid="pipework-advisory">
      <h3>⚠ Performance depends on pipework layout</h3>
      <p>
        This system is tank-fed, so hot water pressure and flow are influenced by pipe size,
        length, and how the cold supply is arranged.
      </p>
      <details className="advice-panel__pipework-details">
        <summary>What this means and what may help</summary>
        <div className="advice-panel__pipework-details-body">
          <p>In some homes, improving performance may require changes such as:</p>
          <ul>
            <li>Upgrading pipe sizes (e.g. 15 mm → 22 mm) to reduce flow resistance</li>
            <li>Adding a dedicated cold feed to key outlets</li>
            <li>Reducing restrictive fittings or long pipe runs</li>
          </ul>
          <p>
            A qualified installer can assess whether these changes would improve performance.
            Note that where tank height is limited, a pump or a change to a mains-fed supply
            may be the only way to achieve stronger flow.
          </p>
        </div>
      </details>
    </section>
  );
}

export default function AdvicePanel({ advice, systemChoice, flowStability }: Props) {
  const whyThisWorks = [...advice.bestOverall.why, ...advice.bestOverall.compareWins].slice(0, 5);
  const objectiveCards = Object.values(advice.byObjective);
  const tradeOffs = [advice.bestOverall.keyTradeOff, ...objectiveCards.map((card) => card.keyTradeOff)].filter((item): item is string => Boolean(item));
  const futureOptions = advice.recommendationScope.futurePotential?.items.map((item) => item.label) ?? [];
  const showPipeworkAdvisory =
    systemChoice === 'open_vented' &&
    (flowStability === 'marginal' || flowStability === 'limited');
  return (
    <div className="advice-panel" data-testid="advice-panel">
      <div className="advice-panel__intro"><h2>Why this is better</h2><p>Advice is derived from hydraulic, DHW, and occupancy compare truth.</p></div>
      <Section title="Why this system works" items={whyThisWorks} />
      <Section title="Trade-offs" items={tradeOffs.slice(0, 5)} />
      {showPipeworkAdvisory && <PipeworkAdvisory />}
      <Section title="Future options" items={futureOptions.slice(0, 5)} />
    </div>
  );
}
