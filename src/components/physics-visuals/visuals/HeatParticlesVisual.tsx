/**
 * HeatParticlesVisual.tsx
 *
 * Illustrates heat movement through a wall cross-section:
 *   - Conduction: orange particles travel directly through the wall layers
 *   - Convection: warm air particles rise on the interior side, forming a loop
 *
 * wallType affects how quickly conduction particles move:
 *   solid_masonry    — fastest conduction (no cavity barrier), high heat loss
 *   cavity_insulated — slowest conduction (insulation blocks both pathways)
 *
 * cavity_uninsulated is not a valid option: it shares the same high heat-loss
 * band as solid_masonry (per physics rules) — use solid_masonry for unfilled
 * cavity walls.
 *
 * reducedMotion: all particles become static; arrows show direction only.
 * displayMode:  preview and focus show layer labels; inline hides them to stay compact.
 *               Legend is hidden in inline mode.
 */

import type { HeatParticlesVisualProps } from '../physicsVisualTypes';
import './HeatParticlesVisual.css';

// ─── Wall configuration ────────────────────────────────────────────────────────

interface WallConfig {
  label: string;
  conductionSpeedClass: string;
  convectionSpeedClass: string;
  layers: { label: string; className: string }[];
  lossLabel: string;
  lossLevel: 'high' | 'medium' | 'low';
}

const WALL_CONFIG: Record<NonNullable<HeatParticlesVisualProps['wallType']>, WallConfig> = {
  solid_masonry: {
    label: 'Solid masonry wall',
    conductionSpeedClass: 'hpv__particle--fast',
    convectionSpeedClass: 'hpv__air-particle--fast',
    layers: [
      { label: 'Plaster', className: 'hpv__layer--plaster' },
      { label: 'Solid brick', className: 'hpv__layer--brick-solid' },
      { label: 'Outer render', className: 'hpv__layer--render' },
    ],
    lossLabel: 'High heat loss',
    lossLevel: 'high',
  },
  cavity_insulated: {
    label: 'Insulated cavity wall',
    conductionSpeedClass: 'hpv__particle--slow',
    convectionSpeedClass: 'hpv__air-particle--slow',
    layers: [
      { label: 'Plaster', className: 'hpv__layer--plaster' },
      { label: 'Inner leaf', className: 'hpv__layer--brick-inner' },
      { label: 'Insulation', className: 'hpv__layer--insulation' },
      { label: 'Outer leaf', className: 'hpv__layer--brick-outer' },
    ],
    lossLabel: 'Lower heat loss',
    lossLevel: 'low',
  },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function HeatParticlesVisual({
  wallType = 'solid_masonry',
  reducedMotion = false,
  emphasis = 'medium',
  displayMode = 'preview',
  caption,
}: HeatParticlesVisualProps) {
  const config = WALL_CONFIG[wallType];
  const showLabels = displayMode !== 'inline';
  const showLegend = displayMode !== 'inline';

  return (
    <div
      className={[
        'hpv',
        `hpv--${wallType}`,
        `hpv--emphasis-${emphasis}`,
        `hpv--mode-${displayMode}`,
        reducedMotion ? 'hpv--reduced-motion' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="img"
      aria-label={`Heat transfer through a ${config.label}: ${config.lossLabel}`}
    >
      {/* Scene: interior room + wall cross-section + exterior */}
      <div className="hpv__scene" aria-hidden="true">
        {/* Interior side — warm room with convection loop */}
        <div className="hpv__interior">
          <div className="hpv__room-label">Inside</div>

          {/* Convection air particles — rising warm air loop */}
          <div className="hpv__convection-track">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={[
                  'hpv__air-particle',
                  config.convectionSpeedClass,
                  `hpv__air-particle--offset-${i}`,
                  reducedMotion ? 'hpv__air-particle--static' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ))}
            {/* Static arrow shown in reduced motion / inline */}
            {(reducedMotion || displayMode === 'inline') && (
              <div className="hpv__convection-arrow" aria-label="Convection loop direction" />
            )}
          </div>

          <div className="hpv__interior-label">Warm air rises</div>
        </div>

        {/* Wall cross-section layers */}
        <div className="hpv__wall">
          {config.layers.map((layer, i) => (
            <div key={i} className={`hpv__layer ${layer.className}`}>
              {showLabels && (
                <span className="hpv__layer-label">{layer.label}</span>
              )}
            </div>
          ))}

          {/* Conduction particles — travelling from warm side to cold side */}
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={[
                'hpv__particle',
                config.conductionSpeedClass,
                `hpv__particle--row-${i}`,
                reducedMotion ? 'hpv__particle--static' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          ))}
        </div>

        {/* Exterior side — cold outside */}
        <div className="hpv__exterior">
          <div className="hpv__room-label">Outside</div>
          <div className="hpv__exterior-label">Heat escapes</div>
        </div>
      </div>

      {/* Heat loss badge */}
      <div
        className={`hpv__loss-badge hpv__loss-badge--${config.lossLevel}`}
        aria-label={config.lossLabel}
      >
        {config.lossLabel}
      </div>

      {/* Legend — hidden in inline mode to reduce noise */}
      {showLegend && (
        <div className="hpv__legend" aria-hidden="true">
          <span className="hpv__legend-item hpv__legend-item--conduction">
            <span className="hpv__legend-dot" />
            Conduction
          </span>
          <span className="hpv__legend-item hpv__legend-item--convection">
            <span className="hpv__legend-dot" />
            Convection
          </span>
        </div>
      )}

      {caption && <p className="hpv__caption">{caption}</p>}
    </div>
  );
}
