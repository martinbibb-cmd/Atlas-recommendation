// src/components/simulator/UpgradeListPanel.tsx
//
// Renders the suggested upgrades grouped by category.
// Sits visually between the simple install and best-fit install cards.

import type { RecommendedUpgradePackage, UpgradeCategory } from '../../logic/upgrades/types';

interface UpgradeListPanelProps {
  upgradePackage: RecommendedUpgradePackage;
}

const CATEGORY_LABELS: Record<UpgradeCategory, string> = {
  water:          'Water',
  protection:     'Protection',
  controls:       'Controls',
  infrastructure: 'Infrastructure',
};

const PRIORITY_BADGE: Record<'essential' | 'recommended' | 'best_fit', string> = {
  essential:   'Essential',
  recommended: 'Recommended',
  best_fit:    'Best fit',
};

const PRIORITY_CLASS: Record<'essential' | 'recommended' | 'best_fit', string> = {
  essential:   'upgrade-list-panel__priority--essential',
  recommended: 'upgrade-list-panel__priority--recommended',
  best_fit:    'upgrade-list-panel__priority--best-fit',
};

// Ordered display categories
const CATEGORY_ORDER: UpgradeCategory[] = [
  'water',
  'protection',
  'controls',
  'infrastructure',
];

export default function UpgradeListPanel({ upgradePackage }: UpgradeListPanelProps) {
  const { upgrades } = upgradePackage;

  if (upgrades.length === 0) {
    return (
      <div className="upgrade-list-panel upgrade-list-panel--empty" data-testid="upgrade-list-panel">
        <div className="upgrade-list-panel__empty-message">
          No upgrades required — system is already well-matched to this household.
        </div>
      </div>
    );
  }

  // Group upgrades by category, preserving display order.
  const grouped = CATEGORY_ORDER.reduce<Record<UpgradeCategory, typeof upgrades>>(
    (acc, cat) => {
      acc[cat] = upgrades.filter((u) => u.category === cat);
      return acc;
    },
    { water: [], protection: [], controls: [], infrastructure: [] },
  );

  return (
    <div className="upgrade-list-panel" data-testid="upgrade-list-panel">
      <div className="upgrade-list-panel__header">Suggested upgrades</div>
      <div className="upgrade-list-panel__groups">
        {CATEGORY_ORDER.map((cat) => {
          const group = grouped[cat];
          if (group.length === 0) return null;
          return (
            <div key={cat} className="upgrade-list-panel__group">
              <div className="upgrade-list-panel__group-label">
                {CATEGORY_LABELS[cat]}
              </div>
              <ul className="upgrade-list-panel__items">
                {group.map((upgrade, idx) => (
                  <li key={idx} className="upgrade-list-panel__item">
                    <div className="upgrade-list-panel__item-header">
                      <span className="upgrade-list-panel__item-label">{upgrade.label}</span>
                      <span className={`upgrade-list-panel__priority ${PRIORITY_CLASS[upgrade.priority]}`}>
                        {PRIORITY_BADGE[upgrade.priority]}
                      </span>
                    </div>
                    <p className="upgrade-list-panel__item-reason">{upgrade.reason}</p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
