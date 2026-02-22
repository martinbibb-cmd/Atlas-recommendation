/**
 * OccupancyClock
 *
 * Interactive 24-hour occupancy painter.  Users click or drag across the
 * hourly cells to toggle "occupied" / "away" states.  As they paint,
 * the component re-emits the updated occupancy map so the parent can
 * recalculate the comfort simulation in real-time.
 */
import { useCallback, useRef, useState } from 'react';

export type OccupancyState = 'away' | 'home' | 'sleep';

export interface HourOccupancy {
  hour: number;  // 0-23
  state: OccupancyState;
}

interface Props {
  /** Initial occupancy map; defaults to a "professional" pattern */
  initialOccupancy?: HourOccupancy[];
  onChange?: (occupancy: HourOccupancy[]) => void;
}

const STATE_COLOURS: Record<OccupancyState, string> = {
  away: '#bee3f8',
  home: '#9ae6b4',
  sleep: '#d6bcfa',
};

const STATE_LABELS: Record<OccupancyState, string> = {
  away: 'Away',
  home: 'Home',
  sleep: 'Sleep',
};

const STATE_CYCLE: OccupancyState[] = ['away', 'home', 'sleep'];

function defaultOccupancy(): HourOccupancy[] {
  return Array.from({ length: 24 }, (_, h) => {
    let state: OccupancyState = 'away';
    if (h >= 0 && h < 7) state = 'sleep';
    else if (h >= 7 && h < 9) state = 'home';
    else if (h >= 9 && h < 17) state = 'away';
    else if (h >= 17 && h < 22) state = 'home';
    else state = 'sleep';
    return { hour: h, state };
  });
}

function nextState(current: OccupancyState): OccupancyState {
  const idx = STATE_CYCLE.indexOf(current);
  return STATE_CYCLE[(idx + 1) % STATE_CYCLE.length];
}

export default function OccupancyClock({ initialOccupancy, onChange }: Props) {
  const [occupancy, setOccupancy] = useState<HourOccupancy[]>(
    initialOccupancy ?? defaultOccupancy(),
  );
  const isDragging = useRef(false);
  const dragTarget = useRef<OccupancyState | null>(null);

  const applyState = useCallback(
    (hour: number, state: OccupancyState) => {
      setOccupancy(prev => {
        const next = prev.map(o => (o.hour === hour ? { ...o, state } : o));
        onChange?.(next);
        return next;
      });
    },
    [onChange],
  );

  const handleMouseDown = (hour: number) => {
    isDragging.current = true;
    const current = occupancy[hour].state;
    const target = nextState(current);
    dragTarget.current = target;
    applyState(hour, target);
  };

  const handleMouseEnter = (hour: number) => {
    if (isDragging.current && dragTarget.current !== null) {
      applyState(hour, dragTarget.current);
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    dragTarget.current = null;
  };

  return (
    <div
      style={{ userSelect: 'none' }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <p style={{ fontSize: '0.78rem', color: '#718096', marginBottom: 8 }}>
        Click or drag to paint your daily routine. The engine recalculates instantly.
      </p>

      {/* Hour grid */}
      <div style={{ display: 'flex', gap: 2 }}>
        {occupancy.map(({ hour, state }) => (
          <div
            key={hour}
            title={`${String(hour).padStart(2, '0')}:00 – ${STATE_LABELS[state]}`}
            onMouseDown={() => handleMouseDown(hour)}
            onMouseEnter={() => handleMouseEnter(hour)}
            style={{
              width: 24,
              height: 48,
              borderRadius: 4,
              background: STATE_COLOURS[state],
              border: '1.5px solid #e2e8f0',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 2,
              fontSize: 9,
              color: '#4a5568',
              transition: 'background 0.1s',
            }}
          >
            {hour % 6 === 0 ? `${hour}h` : ''}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: 10, flexWrap: 'wrap' }}>
        {STATE_CYCLE.map(s => (
          <span
            key={s}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.75rem',
              color: '#4a5568',
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                background: STATE_COLOURS[s],
                border: '1px solid #a0aec0',
                display: 'inline-block',
              }}
            />
            {STATE_LABELS[s]}
          </span>
        ))}
        <span style={{ fontSize: '0.75rem', color: '#a0aec0' }}>← drag to paint →</span>
      </div>
    </div>
  );
}
