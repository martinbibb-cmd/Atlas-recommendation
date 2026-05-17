import type { ReactNode } from 'react';
import type { AtlasVisualTone } from './AtlasVisualTokens';
import './atlasVisualLanguage.css';

interface AtlasPhysicsVisualCardProps {
  title: string;
  statusLabel: string;
  tone?: AtlasVisualTone;
  eyebrow?: string;
  takeaway: string;
  detail?: string;
  children: ReactNode;
  testId?: string;
}

export function AtlasPhysicsVisualCard({
  title,
  statusLabel,
  tone = 'neutral',
  eyebrow = 'Physics storytelling',
  takeaway,
  detail,
  children,
  testId,
}: AtlasPhysicsVisualCardProps) {
  return (
    <article className={`atlas-physics-visual-card atlas-physics-visual-card--${tone}`} data-testid={testId}>
      <div className="atlas-physics-visual-card__header">
        <div>
          <p className="atlas-physics-visual-card__eyebrow">{eyebrow}</p>
          <h3 className="atlas-physics-visual-card__title">{title}</h3>
        </div>
        <span className="atlas-physics-visual-card__status">{statusLabel}</span>
      </div>
      <p className="atlas-physics-visual-card__takeaway">{takeaway}</p>
      {children}
      {detail ? <p className="atlas-physics-visual-card__detail">{detail}</p> : null}
    </article>
  );
}
