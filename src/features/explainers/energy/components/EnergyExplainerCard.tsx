/**
 * EnergyExplainerCard.tsx — shared wrapper card for energy literacy explainers.
 *
 * Provides consistent visual treatment: heading, optional badge, children.
 * Import this in every explainer component so the panel looks unified.
 */

import './EnergyExplainerCard.css';

interface Props {
  title: string;
  badge?: string;
  children: React.ReactNode;
  /** Extra CSS class for the root element. */
  className?: string;
}

export default function EnergyExplainerCard({
  title,
  badge,
  children,
  className,
}: Props) {
  return (
    <article className={`eec-card${className != null ? ` ${className}` : ''}`}>
      <div className="eec-card__header">
        <h3 className="eec-card__title">{title}</h3>
        {badge != null && <span className="eec-card__badge">{badge}</span>}
      </div>
      <div className="eec-card__body">{children}</div>
    </article>
  );
}
