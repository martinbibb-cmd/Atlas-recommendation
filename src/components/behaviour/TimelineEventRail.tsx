/**
 * TimelineEventRail.tsx
 *
 * Lightweight bottom rail for the BehaviourTimelinePanel instrument stage.
 * Derives compact coloured markers from the `mode` field in TimelineSeriesPoint[]:
 *   - 'space'  → heating call (amber)
 *   - 'dhw'    → DHW draw (blue)
 *   - 'mixed'  → simultaneous demand (purple)
 *   - 'idle'   → no fill (transparent)
 *
 * The track is padded to align with the main chart's Y-axis gutter so all
 * three layers (main, strip, rail) read as one horizontal instrument.
 */
import type { TimelineSeriesPoint } from '../../contracts/EngineOutputV1';

// ── Mode constants ────────────────────────────────────────────────────────────

const MODE_SPACE = 'space' as const;
const MODE_DHW   = 'dhw'   as const;
const MODE_MIXED = 'mixed' as const;

type EventMode = typeof MODE_SPACE | typeof MODE_DHW | typeof MODE_MIXED;

interface Props {
  points: TimelineSeriesPoint[];
}

interface Segment {
  mode: EventMode;
  startHour: number;
  endHour: number;
  startLabel: string;
  endLabel: string;
}

/** Background colour per mode — muted so the rail stays subordinate. */
const MODE_COLOUR: Record<EventMode, string> = {
  [MODE_SPACE]: 'rgba(237,137,54,0.55)',
  [MODE_DHW]:   'rgba(49,130,206,0.55)',
  [MODE_MIXED]: 'rgba(128,90,213,0.55)',
};

/** Human-readable tooltip label per mode. */
const MODE_LABEL: Record<EventMode, string> = {
  [MODE_SPACE]: 'Heating call',
  [MODE_DHW]:   'DHW draw',
  [MODE_MIXED]: 'Mixed (CH + DHW)',
};

/** Active event modes in display order. */
const EVENT_MODES: EventMode[] = [MODE_SPACE, MODE_DHW, MODE_MIXED];

/** Collapse consecutive same-mode timesteps into segments. */
function buildSegments(points: TimelineSeriesPoint[]): Segment[] {
  if (points.length === 0) return [];
  const segments: Segment[] = [];
  let current: Segment | null = null;

  for (const pt of points) {
    const raw = pt.mode ?? 'idle';
    // Only track the three event modes — skip 'idle' and any unexpected values
    if (raw !== MODE_SPACE && raw !== MODE_DHW && raw !== MODE_MIXED) {
      if (current) {
        segments.push(current);
        current = null;
      }
      continue;
    }
    const mode: EventMode = raw;
    if (current && current.mode === mode) {
      current.endHour = pt.tHour;
      current.endLabel = pt.t;
    } else {
      if (current) segments.push(current);
      current = { mode, startHour: pt.tHour, endHour: pt.tHour, startLabel: pt.t, endLabel: pt.t };
    }
  }
  if (current) segments.push(current);
  return segments;
}

/**
 * Y-axis gutter width used by all Recharts charts in BehaviourTimelinePanel.
 * Must stay in sync with the YAxis `width` prop in the main chart.
 */
const Y_AXIS_GUTTER = 32;
/** Right chart margin — keeps right edge of rail flush with chart plot area. */
const CHART_RIGHT_MARGIN = 16;

export default function TimelineEventRail({ points }: Props) {
  const hasModes = points.some(p => p.mode && (p.mode === MODE_SPACE || p.mode === MODE_DHW || p.mode === MODE_MIXED));
  if (!hasModes) return null;

  const segments = buildSegments(points);

  return (
    <div className="btp-event-rail" aria-label="Event rail">
      <span className="btp-strip-label">Events</span>
      {/* Track: left padding matches Y-axis gutter so segments align with chart bars */}
      <div
        className="btp-event-rail__track"
        style={{ paddingLeft: Y_AXIS_GUTTER, paddingRight: CHART_RIGHT_MARGIN }}
      >
        {segments.map((seg, i) => {
          const leftPct  = (seg.startHour / 24) * 100;
          const widthPct = Math.max(((seg.endHour - seg.startHour) / 24) * 100, 0.4);
          return (
            <div
              key={i}
              className="btp-event-pill"
              title={`${MODE_LABEL[seg.mode] ?? seg.mode}  ${seg.startLabel}–${seg.endLabel}`}
              style={{
                left:            `${leftPct}%`,
                width:           `${widthPct}%`,
                backgroundColor: MODE_COLOUR[seg.mode] ?? 'rgba(160,174,192,0.4)',
              }}
            />
          );
        })}
      </div>
      {/* Compact legend below the track */}
      <div className="btp-event-rail__legend">
        {EVENT_MODES.map(mode => {
          const active = segments.some(s => s.mode === mode);
          if (!active) return null;
          return (
            <span key={mode} className="btp-event-rail__legend-item">
              <span
                className="btp-event-rail__legend-swatch"
                style={{ background: MODE_COLOUR[mode] }}
              />
              {MODE_LABEL[mode]}
            </span>
          );
        })}
      </div>
    </div>
  );
}
