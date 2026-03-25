/**
 * DrivingStyleVisual.tsx
 *
 * Illustrates three heating behaviour modes:
 *   combi       — short sharp bursts with pause (stop/start driving style)
 *   stored      — smooth, steady motion
 *   heat_pump   — slow, sustained steady motion
 *
 * The animation is CSS-driven. When reducedMotion is true, all motion is
 * replaced by a clear static state diagram.
 */

import type { DrivingStyleVisualProps, DrivingStyleMode } from '../physicsVisualTypes';
import './DrivingStyleVisual.css';

// ─── Mode metadata ─────────────────────────────────────────────────────────────

interface ModeConfig {
  label: string;
  description: string;
  indicatorClass: string;
  pulseClass: string;
  barCount: number;
  energyLabel: string;
}

const MODE_CONFIG: Record<DrivingStyleMode, ModeConfig> = {
  combi: {
    label: 'On-demand hot water',
    description: 'Fires hard, heats fast, cuts out',
    indicatorClass: 'dsv__indicator--combi',
    pulseClass: 'dsv__pulse--burst',
    barCount: 3,
    energyLabel: 'Burst firing',
  },
  stored: {
    label: 'Stored-water system',
    description: 'Builds heat steadily, stores it',
    indicatorClass: 'dsv__indicator--stored',
    pulseClass: 'dsv__pulse--smooth',
    barCount: 3,
    energyLabel: 'Steady output',
  },
  heat_pump: {
    label: 'Heat pump',
    description: 'Slow, sustained — runs for long periods',
    indicatorClass: 'dsv__indicator--hp',
    pulseClass: 'dsv__pulse--slow',
    barCount: 3,
    energyLabel: 'Continuous low output',
  },
};

// ─── Component ─────────────────────────────────────────────────────────────────

export default function DrivingStyleVisual({
  mode,
  reducedMotion = false,
  emphasis = 'medium',
  caption,
}: DrivingStyleVisualProps) {
  const config = MODE_CONFIG[mode];

  return (
    <div
      className={`dsv dsv--${mode} dsv--emphasis-${emphasis}${reducedMotion ? ' dsv--reduced-motion' : ''}`}
      role="img"
      aria-label={`${config.label}: ${config.description}`}
    >
      {/* Energy flow track */}
      <div className="dsv__track" aria-hidden="true">
        <div className={`dsv__pulse ${config.pulseClass}`} />
        <div className={`dsv__pulse ${config.pulseClass} dsv__pulse--delay-1`} />
        <div className={`dsv__pulse ${config.pulseClass} dsv__pulse--delay-2`} />
      </div>

      {/* Mode indicator with bars */}
      <div className={`dsv__indicator ${config.indicatorClass}`} aria-hidden="true">
        {Array.from({ length: config.barCount }, (_, i) => (
          <div
            key={i}
            className={`dsv__bar dsv__bar--${i + 1} dsv__bar--${mode}`}
          />
        ))}
      </div>

      {/* Labels */}
      <div className="dsv__labels">
        <span className="dsv__mode-name">{config.label}</span>
        <span className="dsv__mode-desc">{config.description}</span>
        <span className="dsv__energy-label">{config.energyLabel}</span>
      </div>

      {caption && <p className="dsv__caption">{caption}</p>}
    </div>
  );
}
