import type { AdviceFromCompareResult } from '../../lib/advice/buildAdviceFromCompare';
import './AdvicePanel.css';

interface Props { advice: AdviceFromCompareResult; }

function Section({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return <section className="advice-panel__section"><h3>{title}</h3><ul>{items.map((item) => <li key={item}>{item}</li>)}</ul></section>;
}

export default function AdvicePanel({ advice }: Props) {
  const whyThisWorks = [...advice.bestOverall.why, ...advice.bestOverall.compareWins].slice(0, 5);
  const objectiveCards = Object.values(advice.byObjective);
  const tradeOffs = [advice.bestOverall.keyTradeOff, ...objectiveCards.map((card) => card.keyTradeOff)].filter((item): item is string => Boolean(item));
  const futureOptions = advice.recommendationScope.futurePotential?.items.map((item) => item.label) ?? [];
  return (
    <div className="advice-panel" data-testid="advice-panel">
      <div className="advice-panel__intro"><h2>Why this is better</h2><p>Advice is derived from hydraulic, DHW, and occupancy compare truth.</p></div>
      <Section title="Why this system works" items={whyThisWorks} />
      <Section title="Trade-offs" items={tradeOffs.slice(0, 5)} />
      <Section title="Future options" items={futureOptions.slice(0, 5)} />
    </div>
  );
}
