import type { AtlasVisualTone } from './AtlasVisualTokens';

interface AtlasHeatFlowPhase {
  label: string;
  widthPct: number;
  copy: string;
  tone?: AtlasVisualTone;
}

interface AtlasHeatFlowGraphicProps {
  phases: AtlasHeatFlowPhase[];
  leftLabel: string;
  rightLabel: string;
}

export function AtlasHeatFlowGraphic({ phases, leftLabel, rightLabel }: AtlasHeatFlowGraphicProps) {
  return (
    <div className="atlas-heat-flow-graphic" aria-label="Heat flow graphic">
      <div className="atlas-heat-flow-graphic__lane">
        {phases.map((phase) => (
          <article
            key={phase.label}
            className={`atlas-heat-flow-graphic__phase atlas-heat-flow-graphic__phase--${phase.tone ?? 'neutral'}`}
            style={{ flex: `${Math.max(phase.widthPct, 12)} 1 0` }}
          >
            <p className="atlas-heat-flow-graphic__phase-label">{phase.label}</p>
            <p className="atlas-heat-flow-graphic__phase-copy">{phase.copy}</p>
          </article>
        ))}
      </div>
      <div className="atlas-heat-flow-graphic__footer" aria-hidden="true">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
