/**
 * ExplainerCard — renders a single educational explainer.
 *
 * Displays: title, one-sentence point, bullet facts, and an optional
 * "see it in simulator" reference.
 */

import type { EducationalExplainer } from './types';
import './ExplainerCard.css';

interface Props {
  explainer: EducationalExplainer;
}

export default function ExplainerCard({ explainer }: Props) {
  return (
    <article className="ec-card" aria-label={explainer.title}>

      {/* ── Title ──────────────────────────────────────────────────────────── */}
      <h3 className="ec-card__title">{explainer.title}</h3>

      {/* ── Core point ─────────────────────────────────────────────────────── */}
      <p className="ec-card__point">{explainer.point}</p>

      {/* ── Bullet facts ───────────────────────────────────────────────────── */}
      <ul className="ec-card__bullets">
        {explainer.bullets.map((bullet, index) => (
          <li key={index} className="ec-card__bullet">
            {bullet}
          </li>
        ))}
      </ul>

      {/* ── Optional simulator reference ───────────────────────────────────── */}
      {explainer.simulatorLabel != null && (
        <p className="ec-card__sim-ref">
          <span className="ec-card__sim-ref-icon" aria-hidden="true">💡</span>
          {' '}See also:{' '}
          <span className="ec-card__sim-ref-label">{explainer.simulatorLabel}</span>
          {' '}in the simulator
        </p>
      )}

    </article>
  );
}
