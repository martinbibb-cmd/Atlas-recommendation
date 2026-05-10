import '../diagrams.css';

export interface HeatGradientBarProps {
  label: string;
  lowLabel: string;
  highLabel: string;
  orientation?: 'horizontal' | 'vertical';
}

export function HeatGradientBar({ label, lowLabel, highLabel, orientation = 'horizontal' }: HeatGradientBarProps) {
  const isVertical = orientation === 'vertical';

  return (
    <div
      className="atlas-edu-diagram__wrapper"
      aria-label={`${label}: from ${lowLabel} to ${highLabel}`}
    >
      <p className="atlas-edu-diagram__label">{label}</p>
      <div
        style={{
          display: 'flex',
          flexDirection: isVertical ? 'column-reverse' : 'row',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <p className="atlas-edu-diagram__label">{lowLabel}</p>
        <svg
          width={isVertical ? 24 : 120}
          height={isVertical ? 80 : 24}
          viewBox={isVertical ? '0 0 24 80' : '0 0 120 24'}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient
              id={`heat-gradient-${label.replace(/\s+/g, '-')}`}
              x1={isVertical ? '0' : '0%'}
              y1={isVertical ? '100%' : '0'}
              x2={isVertical ? '0' : '100%'}
              y2={isVertical ? '0%' : '0'}
            >
              <stop offset="0%" stopColor="#aac4e0" />
              <stop offset="100%" stopColor="#8b1a1a" />
            </linearGradient>
          </defs>
          <rect
            x={0}
            y={0}
            width={isVertical ? 24 : 120}
            height={isVertical ? 80 : 24}
            rx={4}
            fill={`url(#heat-gradient-${label.replace(/\s+/g, '-')})`}
            stroke="#c5cfdb"
            strokeWidth={1}
          />
        </svg>
        <p className="atlas-edu-diagram__label">{highLabel}</p>
      </div>
    </div>
  );
}
