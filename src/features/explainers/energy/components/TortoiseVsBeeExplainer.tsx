/**
 * TortoiseVsBeeExplainer.tsx
 *
 * Side-by-side comparison:
 *   Boiler (bee) — fast, high-power, reactive
 *   Heat pump (tortoise) — slow, efficient, steady
 *
 * Static visual only. No interactivity needed.
 */

import EnergyExplainerCard from './EnergyExplainerCard';
import { ENERGY_COPY } from '../data/energyExplainerCopy';
import './TortoiseVsBeeExplainer.css';

export default function TortoiseVsBeeExplainer() {
  const { tortoiseBee: copy } = ENERGY_COPY;

  return (
    <EnergyExplainerCard title={copy.title} badge="Phase 1" className="tvb">
      <p className="tvb__subtitle">{copy.subtitle}</p>

      <div className="tvb__columns">

        {/* ── Boiler / bee ───────────────────────────────────────────────── */}
        <div className="tvb__col tvb__col--bee">
          <div className="tvb__icon" aria-hidden="true">🐝</div>
          <div className="tvb__col-label">{copy.beeLabel}</div>
          <ul className="tvb__traits" aria-label={`${copy.beeLabel} traits`}>
            {copy.beeTraits.map((trait) => (
              <li key={trait} className="tvb__trait">{trait}</li>
            ))}
          </ul>
        </div>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="tvb__divider" aria-hidden="true">vs</div>

        {/* ── Heat pump / tortoise ──────────────────────────────────────── */}
        <div className="tvb__col tvb__col--tortoise">
          <div className="tvb__icon" aria-hidden="true">🐢</div>
          <div className="tvb__col-label">{copy.tortoiseLabel}</div>
          <ul className="tvb__traits" aria-label={`${copy.tortoiseLabel} traits`}>
            {copy.tortoiseTraits.map((trait) => (
              <li key={trait} className="tvb__trait">{trait}</li>
            ))}
          </ul>
        </div>

      </div>

      <p className="tvb__message">{copy.message}</p>
    </EnergyExplainerCard>
  );
}
