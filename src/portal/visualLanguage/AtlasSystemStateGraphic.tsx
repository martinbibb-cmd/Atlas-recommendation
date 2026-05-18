import type { AtlasVisualTone } from './AtlasVisualTokens';

interface AtlasSystemStateNode {
  label: string;
  value: string;
  detail: string;
  tone?: AtlasVisualTone;
  active?: boolean;
}

interface AtlasSystemStateGraphicProps {
  nodes: AtlasSystemStateNode[];
}

export function AtlasSystemStateGraphic({ nodes }: AtlasSystemStateGraphicProps) {
  return (
    <div className="atlas-system-state-graphic" aria-label="System state graphic">
      <div className="atlas-system-state-graphic__rail">
        {nodes.map((node) => (
          <article
            key={node.label}
            className={`atlas-system-state-graphic__node${node.active ? ' atlas-system-state-graphic__node--active' : ''}`}
          >
            <p className="atlas-system-state-graphic__label">{node.label}</p>
            <strong className="atlas-system-state-graphic__value">{node.value}</strong>
            <p className="atlas-system-state-graphic__detail">{node.detail}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
