/**
 * SavingsPanel.tsx — Section 7: How to maximise savings.
 * Split into Behaviour / Settings / Future Upgrades.
 * Pure presentation — data from SavingsPlan.
 */

import type { SavingsPlan } from './insightPack.types';
import './SavingsPanel.css';

interface Props {
  savingsPlan: SavingsPlan;
}

interface SectionProps {
  title: string;
  icon: string;
  items: string[];
}

function SaveSection({ title, icon, items }: SectionProps) {
  return (
    <div className="savings__section">
      <p className="savings__section-title">{icon} {title}</p>
      <ul className="savings__list">
        {items.map((item, i) => (
          <li key={i} className="savings__list-item">
            <span>→</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SavingsPanel({ savingsPlan }: Props) {
  return (
    <div className="savings" data-testid="savings-panel">
      <h2 className="savings__heading">How to maximise savings</h2>
      <p className="savings__sub">
        Practical steps to get the most from whichever system is installed.
      </p>

      <SaveSection
        title="Behaviour"
        icon="🏠"
        items={savingsPlan.behaviour}
      />
      <SaveSection
        title="Settings"
        icon="⚙️"
        items={savingsPlan.settings}
      />
      <SaveSection
        title="Future upgrades"
        icon="🚀"
        items={savingsPlan.futureUpgrades}
      />
    </div>
  );
}
