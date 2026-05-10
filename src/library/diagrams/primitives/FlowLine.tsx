import '../diagrams.css';

export interface FlowLineProps {
  label: string;
  direction?: 'right' | 'left' | 'down' | 'up';
  length?: number;
  strokeWidth?: number;
}

function getArrowPoints(direction: 'right' | 'left' | 'down' | 'up', length: number) {
  switch (direction) {
    case 'right':
      return {
        line: { x1: 0, y1: 12, x2: length - 10, y2: 12 },
        arrow: `${length - 10},6 ${length},12 ${length - 10},18`,
      };
    case 'left':
      return {
        line: { x1: length, y1: 12, x2: 10, y2: 12 },
        arrow: `10,6 0,12 10,18`,
      };
    case 'down':
      return {
        line: { x1: 12, y1: 0, x2: 12, y2: length - 10 },
        arrow: `6,${length - 10} 12,${length} 18,${length - 10}`,
      };
    case 'up':
      return {
        line: { x1: 12, y1: length, x2: 12, y2: 10 },
        arrow: `6,10 12,0 18,10`,
      };
  }
}

function getSvgDimensions(direction: 'right' | 'left' | 'down' | 'up', length: number) {
  if (direction === 'down' || direction === 'up') {
    return { width: 24, height: length };
  }
  return { width: length, height: 24 };
}

export function FlowLine({ label, direction = 'right', length = 80, strokeWidth = 2 }: FlowLineProps) {
  const points = getArrowPoints(direction, length);
  const dims = getSvgDimensions(direction, length);

  return (
    <div aria-label={label} className="atlas-edu-diagram__wrapper">
      <svg
        width={dims.width}
        height={dims.height}
        viewBox={`0 0 ${dims.width} ${dims.height}`}
        aria-hidden="true"
        focusable="false"
      >
        <title>{label}</title>
        <line
          x1={points.line.x1}
          y1={points.line.y1}
          x2={points.line.x2}
          y2={points.line.y2}
          stroke="currentColor"
          strokeWidth={strokeWidth}
        />
        <polygon points={points.arrow} fill="currentColor" />
      </svg>
      <p className="atlas-edu-diagram__label">{label}</p>
    </div>
  );
}
