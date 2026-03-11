/**
 * LivePhysicsOverlay.tsx
 *
 * A compact, step-gated physics panel that surfaces the most relevant engine
 * outputs for the currently active survey step. It is "dumb" — all values come
 * directly from EngineOutputV1; no physics are computed here.
 *
 * Step key mapping:
 *   'shell'   → Heat loss / fabric (location step)
 *   'supply'  → Mains supply / pressure (pressure step)
 *   'life'    → Lifestyle / occupancy / DHW demand (lifestyle + hot_water steps)
 *   'storage' → Storage / DHW sizing / system suitability (hot_water + commercial)
 *
 * Win condition: changing one input visibly changes one output without any
 * UI-side maths.
 */
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';

// ── Canonical limiter IDs from LimiterV1 contract ────────────────────────────

/** IDs for limiters relevant to the Shell (heat loss / fabric) panel. */
const SHELL_LIMITER_IDS = new Set([
  'radiator-output-insufficient',
  'flow-temp-too-high-for-ashp',
]);

/** IDs for limiters relevant to the Supply (mains / pressure) panel. */
const SUPPLY_LIMITER_IDS = new Set([
  'mains-flow-constraint',
  'combi-concurrency-constraint',
]);

/** IDs for limiters relevant to the Storage (DHW / system) panel. */
const STORAGE_LIMITER_IDS = new Set([
  'combi-concurrency-constraint',
  'cycling-loss-penalty',
]);

export type OverlayStepKey = 'shell' | 'supply' | 'life' | 'storage';

interface Props {
  engineOutput: EngineOutputV1;
  activeStepKey: OverlayStepKey;
}

const PANEL_STYLE: React.CSSProperties = {
  background: '#f7fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 10,
  padding: '12px 16px',
  fontSize: 13,
  color: '#2d3748',
};

const METRIC_ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '4px 0',
  borderBottom: '1px solid #edf2f7',
};

const LABEL_STYLE: React.CSSProperties = { color: '#718096', flex: '0 0 auto', marginRight: 8 };

const VALUE_STYLE: React.CSSProperties = {
  fontWeight: 700,
  color: '#2d3748',
  textAlign: 'right',
};

interface MetricRowProps {
  label: string;
  value: string;
  accent?: string;
}

function MetricRow({ label, value, accent }: MetricRowProps) {
  return (
    <div style={METRIC_ROW_STYLE}>
      <span style={LABEL_STYLE}>{label}</span>
      <span style={{ ...VALUE_STYLE, color: accent ?? '#2d3748' }}>{value}</span>
    </div>
  );
}

// ── Panel: Shell (heat loss / fabric) ─────────────────────────────────────────

function ShellPanel({ engineOutput }: { engineOutput: EngineOutputV1 }) {
  const timeline = engineOutput.behaviourTimeline;
  const peakHeatKw = timeline
    ? Math.max(...timeline.points.map(p => p.heatDemandKw)).toFixed(1)
    : '—';

  const confidence = engineOutput.meta?.confidence;
  const confidenceColour =
    confidence?.level === 'high' ? '#276749'
    : confidence?.level === 'medium' ? '#d69e2e'
    : '#e53e3e';

  // Top heat-loss limiter from the constraints list
  const heatLimiter = engineOutput.limiters?.limiters.find(
    l => SHELL_LIMITER_IDS.has(l.id),
  );

  return (
    <div style={PANEL_STYLE}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: '#4a5568', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        🏠 Shell — Heat Loss
      </div>
      <MetricRow label="Peak heat demand" value={`${peakHeatKw} kW`} />
      {heatLimiter && (
        <MetricRow
          label={heatLimiter.title}
          value={`${heatLimiter.observed.value} ${heatLimiter.observed.unit}`}
          accent={heatLimiter.severity === 'fail' ? '#e53e3e' : heatLimiter.severity === 'warn' ? '#d69e2e' : '#3182ce'}
        />
      )}
      {confidence && (
        <MetricRow
          label="Engine confidence"
          value={confidence.level.charAt(0).toUpperCase() + confidence.level.slice(1)}
          accent={confidenceColour}
        />
      )}
      {(!heatLimiter && !confidence) && (
        <div style={{ color: '#718096', fontSize: 12, paddingTop: 4 }}>
          Complete more steps to surface constraints.
        </div>
      )}
    </div>
  );
}

// ── Panel: Supply (mains / pressure) ─────────────────────────────────────────

function SupplyPanel({ engineOutput }: { engineOutput: EngineOutputV1 }) {
  const mainsLimiter = engineOutput.limiters?.limiters.find(
    l => SUPPLY_LIMITER_IDS.has(l.id) && l.id !== 'combi-concurrency-constraint',
  );
  const combiConcurrency = engineOutput.limiters?.limiters.find(
    l => l.id === 'combi-concurrency-constraint',
  );

  return (
    <div style={PANEL_STYLE}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: '#4a5568', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        💧 Supply — Mains &amp; Pressure
      </div>
      {mainsLimiter ? (
        <>
          <MetricRow label={mainsLimiter.observed.label} value={`${mainsLimiter.observed.value} ${mainsLimiter.observed.unit}`} />
          <MetricRow label="Limit" value={`${mainsLimiter.limit.value} ${mainsLimiter.limit.unit}`} />
          <MetricRow
            label={mainsLimiter.title}
            value={mainsLimiter.severity.toUpperCase()}
            accent={mainsLimiter.severity === 'fail' ? '#e53e3e' : mainsLimiter.severity === 'warn' ? '#d69e2e' : '#3182ce'}
          />
        </>
      ) : (
        <div style={{ color: '#718096', fontSize: 12, paddingTop: 4 }}>
          No mains constraints flagged.
        </div>
      )}
      {combiConcurrency && (
        <MetricRow
          label="Simultaneous outlet demand"
          value={combiConcurrency.severity === 'fail' ? '❌ Exceeds throughput' : '✅ OK'}
          accent={combiConcurrency.severity === 'fail' ? '#e53e3e' : '#276749'}
        />
      )}
    </div>
  );
}

// ── Panel: Life (lifestyle / occupancy / DHW demand) ─────────────────────────

function LifePanel({ engineOutput }: { engineOutput: EngineOutputV1 }) {
  const timeline = engineOutput.behaviourTimeline;
  const peakDhwKw = timeline
    ? Math.max(...timeline.points.map(p => p.dhwDemandKw)).toFixed(1)
    : '—';

  // Find peak DHW time
  const pts = timeline?.points ?? [];
  const peakIdx = pts.reduce((best, p, i) => (p.dhwDemandKw > (pts[best]?.dhwDemandKw ?? 0) ? i : best), 0);
  const peakTime = pts[peakIdx]?.t ?? '—';

  // Count DHW-lockout steps (combi only)
  const lockoutSteps = timeline?.labels.isCombi
    ? pts.filter(p => p.mode === 'dhw' || p.mode === 'mixed').length
    : 0;
  const lockoutMins = lockoutSteps * (timeline?.resolutionMins ?? 15);

  return (
    <div style={PANEL_STYLE}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: '#4a5568', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        👥 Life — Occupancy &amp; DHW
      </div>
      <MetricRow label="Peak DHW demand" value={`${peakDhwKw} kW @ ${peakTime}`} />
      {timeline?.labels.isCombi && (
        <MetricRow
          label="CH lockout duration"
          value={`${lockoutMins} min/day`}
          accent={lockoutMins > 60 ? '#d69e2e' : '#276749'}
        />
      )}
      {timeline?.assumptionsUsed.map(a => (
        <div
          key={a.id}
          style={{
            marginTop: 4,
            padding: '2px 6px',
            borderRadius: 4,
            background: a.severity === 'warn' ? '#fef3c7' : '#ebf8ff',
            fontSize: 11,
            color: a.severity === 'warn' ? '#92400e' : '#2b6cb0',
          }}
        >
          {a.severity === 'warn' ? '⚠ ' : 'ℹ '}{a.label}
        </div>
      ))}
    </div>
  );
}

// ── Panel: Storage (DHW sizing / system suitability) ─────────────────────────

function StoragePanel({ engineOutput }: { engineOutput: EngineOutputV1 }) {
  const topOption = engineOutput.options?.find(o => o.status === 'viable') ?? engineOutput.options?.[0];
  const dhwLimiter = engineOutput.limiters?.limiters.find(
    l => STORAGE_LIMITER_IDS.has(l.id),
  );

  const statusColour: Record<string, string> = {
    viable: '#276749',
    caution: '#d69e2e',
    rejected: '#e53e3e',
  };

  return (
    <div style={PANEL_STYLE}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: '#4a5568', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
        🔥 Storage — DHW &amp; System Fit
      </div>
      {topOption ? (
        <>
          <MetricRow
            label="Top recommendation"
            value={topOption.label}
            accent={statusColour[topOption.status] ?? '#2d3748'}
          />
          <MetricRow
            label="DHW verdict"
            value={topOption.dhw.status === 'ok' ? '✅ OK' : topOption.dhw.status === 'caution' ? '⚠ Caution' : '— N/A'}
            accent={topOption.dhw.status === 'ok' ? '#276749' : topOption.dhw.status === 'caution' ? '#d69e2e' : '#718096'}
          />
        </>
      ) : (
        <div style={{ color: '#718096', fontSize: 12, paddingTop: 4 }}>
          Run full analysis to see system recommendations.
        </div>
      )}
      {dhwLimiter && (
        <MetricRow
          label={dhwLimiter.title}
          value={dhwLimiter.severity.toUpperCase()}
          accent={dhwLimiter.severity === 'fail' ? '#e53e3e' : '#d69e2e'}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LivePhysicsOverlay({ engineOutput, activeStepKey }: Props) {
  return (
    <div
      className="live-physics-overlay"
      style={{
        background: '#fff',
        border: '1px solid #bee3f8',
        borderRadius: 12,
        padding: '12px 14px',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
          paddingBottom: 8,
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#2b6cb0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          ⚡ Live Physics
        </span>
        <span
          style={{
            background: '#ebf8ff',
            border: '1px solid #bee3f8',
            borderRadius: 4,
            padding: '1px 7px',
            fontSize: 10,
            color: '#2b6cb0',
          }}
        >
          {activeStepKey.charAt(0).toUpperCase() + activeStepKey.slice(1)}
        </span>
      </div>

      {activeStepKey === 'shell'   && <ShellPanel   engineOutput={engineOutput} />}
      {activeStepKey === 'supply'  && <SupplyPanel  engineOutput={engineOutput} />}
      {activeStepKey === 'life'    && <LifePanel    engineOutput={engineOutput} />}
      {activeStepKey === 'storage' && <StoragePanel engineOutput={engineOutput} />}
    </div>
  );
}
