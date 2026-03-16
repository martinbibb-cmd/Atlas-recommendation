/**
 * SourceEmissionsTable.tsx
 *
 * Data-driven table: lifecycle CO₂ g/kWh by energy source.
 * All data from energySourceFacts.ts — no literals in component.
 */

import EnergyExplainerCard from './EnergyExplainerCard';
import { ENERGY_SOURCE_FACTS } from '../data/energySourceFacts';
import { formatCo2Intensity } from '../lib/energyFormatting';
import { ENERGY_COPY } from '../data/energyExplainerCopy';
import './SourceTable.css';

export default function SourceEmissionsTable() {
  const rows = ENERGY_SOURCE_FACTS.filter(
    (f) => f.typicalLifecycleCo2gPerKwh != null,
  ).sort(
    (a, b) => (a.typicalLifecycleCo2gPerKwh ?? 0) - (b.typicalLifecycleCo2gPerKwh ?? 0),
  );

  return (
    <EnergyExplainerCard
      title={ENERGY_COPY.sourceTable.emissionsTitle}
      badge="Data"
      className="src-table"
    >
      <p className="src-table__subtitle">{ENERGY_COPY.sourceTable.emissionsSubtitle}</p>

      <div className="src-table__scroll">
        <table className="src-table__table">
          <thead>
            <tr>
              <th scope="col" className="src-table__th">{ENERGY_COPY.sourceTable.sourceHeader}</th>
              <th scope="col" className="src-table__th src-table__th--number">CO₂ g/kWh</th>
              <th scope="col" className="src-table__th">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((fact) => (
              <tr key={fact.id} className="src-table__tr">
                <td className="src-table__td src-table__td--source">
                  <span className="src-table__category-dot" data-category={fact.category} />
                  {fact.label}
                </td>
                <td className="src-table__td src-table__td--number">
                  {formatCo2Intensity(fact.typicalLifecycleCo2gPerKwh!)}
                </td>
                <td className="src-table__td src-table__td--note">{fact.explainer}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="src-table__disclaimer">{ENERGY_COPY.sourceTable.dataDisclaimer}</p>
    </EnergyExplainerCard>
  );
}
