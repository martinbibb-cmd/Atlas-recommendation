/**
 * WhatIfImprovements
 *
 * "If you improve your home" section — shows actionable improvement messages
 * based on the current building fabric inputs.
 *
 * Rules:
 *   - Only shown when there is at least one relevant improvement message.
 *   - cavity_unfilled (engine type) and cavity_uninsulated (UI type) both
 *     trigger the cavity wall fill suggestion (same high heat-loss physics).
 *   - No % savings or £ values (compliance rule).
 *   - Physics-first causality: explains heat demand reduction, not financial gain.
 */

import './WhatIfImprovements.css';

interface Props {
  /**
   * Wall type from the building fabric survey — uses both engine (cavity_unfilled)
   * and UI (cavity_uninsulated) variants.
   */
  wallType?: string;
}

interface ImprovementItem {
  id: string;
  heading: string;
  bullets: string[];
}

/** Derive improvement items based on building fabric context. */
function buildImprovements(wallType: string | undefined): ImprovementItem[] {
  const items: ImprovementItem[] = [];

  if (wallType === 'cavity_unfilled' || wallType === 'cavity_uninsulated') {
    items.push({
      id: 'cavity_fill',
      heading: 'Cavity wall insulation',
      bullets: [
        'Filling cavity walls could reduce heat loss.',
        'This may improve efficiency and may make lower-temperature systems like heat pumps more suitable.',
      ],
    });
  }

  return items;
}

export default function WhatIfImprovements({ wallType }: Props) {
  const improvements = buildImprovements(wallType);

  if (improvements.length === 0) return null;

  return (
    <div className="wii" aria-label="If you improve your home">
      <h3 className="wii__title">If you improve your home</h3>
      <ul className="wii__list" aria-label="Potential improvements">
        {improvements.map(item => (
          <li key={item.id} className="wii__item">
            <p className="wii__item-heading">{item.heading}</p>
            <ul className="wii__bullets" aria-label={`${item.heading} details`}>
              {item.bullets.map((b, i) => (
                <li key={i} className="wii__bullet">{b}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
