/**
 * SystemConditionImpact
 *
 * "System Condition Impact" panel for Step 8 (Results).
 *
 * Shows a side-by-side "As Found" vs "After Flush + Filter" comparison
 * using deterministic physics from SystemConditionImpactModule — no randomness.
 *
 * Layout:
 *   Header   – "System Condition Impact"
 *   Subhead  – "Same house. Same boiler. Different internal condition."
 *   Split graph with before/after bars for CH shortfall, DHW stability, efficiency, velocity
 *   Velocity band metric card
 *   Three calm observations
 *   Drift line – "This difference has been accumulating gradually over time."
 */
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import type { ConditionImpactResult } from '../../engine/modules/SystemConditionImpactModule';
import { VELOCITY_UPPER_M_S } from '../../engine/modules/SystemConditionImpactModule';

interface Props {
  impact: ConditionImpactResult;
}

const METRIC_CARD_BASE: React.CSSProperties = {
  flex: 1,
  minWidth: 120,
  borderRadius: 8,
  padding: '10px 14px',
};

function MetricPair({
  label,
  before,
  after,
  unit,
  lowerIsBetter = true,
}: {
  label: string;
  before: number;
  after: number;
  unit: string;
  lowerIsBetter?: boolean;
}) {
  const improved = lowerIsBetter ? after < before : after > before;
  return (
    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
      <div style={{ width: 140, fontSize: '0.82rem', color: '#4a5568', alignSelf: 'center', fontWeight: 600 }}>
        {label}
      </div>
      <div style={{
        ...METRIC_CARD_BASE,
        background: '#fff5f5',
        border: '1.5px solid #fed7d7',
      }}>
        <div style={{ fontSize: '0.68rem', color: '#9b2c2c', marginBottom: 2 }}>🔴 As Found</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c53030' }}>
          {before.toFixed(unit === 'm/s' ? 2 : 1)}{unit}
        </div>
      </div>
      <div style={{
        ...METRIC_CARD_BASE,
        background: '#f0fff4',
        border: `1.5px solid ${improved ? '#68d391' : '#e2e8f0'}`,
      }}>
        <div style={{ fontSize: '0.68rem', color: '#276749', marginBottom: 2 }}>🟢 Restored</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#276749' }}>
          {after.toFixed(unit === 'm/s' ? 2 : 1)}{unit}
        </div>
      </div>
    </div>
  );
}

function formatBarTooltip(value: number | undefined, name: string | undefined): [string, string] {
  return [`${(value ?? 0).toFixed(1)}%`, name ?? ''];
}

export default function SystemConditionImpact({ impact }: Props) {
  const { asFound, restored, chShortfallReductionPct, systemAgeYears, estimatedScaleThicknessMm } = impact;

  // Build bar-chart data: four metrics, each with before/after value
  const chartData = [
    {
      metric: 'CH Shortfall',
      'As Found': parseFloat(asFound.chShortfallPct.toFixed(1)),
      Restored: parseFloat(restored.chShortfallPct.toFixed(1)),
      unit: '%',
    },
    {
      metric: 'DHW Reduction',
      'As Found': parseFloat(asFound.dhwCapacityReductionPct.toFixed(1)),
      Restored: parseFloat(restored.dhwCapacityReductionPct.toFixed(1)),
      unit: '%',
    },
    {
      metric: 'Efficiency Loss',
      'As Found': parseFloat((restored.efficiencyPct - asFound.efficiencyPct).toFixed(1)),
      Restored: 0,
      unit: '%',
    },
    {
      metric: 'Velocity %OOB',
      'As Found': asFound.velocityOutsideBandPct,
      Restored: restored.velocityOutsideBandPct,
      unit: '%',
    },
  ];

  // Three calm observations — derived deterministically from impact data
  const efficiencyGainPct = parseFloat((restored.efficiencyPct - asFound.efficiencyPct).toFixed(1));
  const observations: string[] = [];

  if (chShortfallReductionPct > 0) {
    observations.push(
      `Peak morning heat shortfall reduced by ${chShortfallReductionPct.toFixed(0)}%`
    );
  } else {
    observations.push('Peak morning heat supply restored to design capacity');
  }

  if (asFound.dhwCapacityReductionPct > 0) {
    observations.push('DHW stability restored under simultaneous draw');
  } else {
    observations.push('DHW heat-exchanger operating within capacity');
  }

  if (asFound.velocityOutsideBandPct > restored.velocityOutsideBandPct) {
    observations.push(
      `Velocity returned to recommended operating band (was outside ${asFound.velocityOutsideBandPct}% of heating hours)`
    );
  } else if (efficiencyGainPct > 0) {
    observations.push(`System efficiency restored by ${efficiencyGainPct.toFixed(1)} percentage points`);
  } else {
    observations.push('Velocity within recommended operating band');
  }

  const hasAnyDegradation =
    asFound.chShortfallPct > 0 ||
    asFound.dhwCapacityReductionPct > 0 ||
    asFound.velocityOutsideBandPct > 0 ||
    efficiencyGainPct > 0;

  return (
    <div>
      {/* Section header */}
      <h3 style={{ marginBottom: '0.25rem' }}>🔬 System Condition Impact</h3>
      <p style={{ fontSize: '0.85rem', color: '#718096', marginBottom: '1.25rem' }}>
        Same house. Same boiler. Different internal condition.
      </p>

      {/* Metric pair cards */}
      <MetricPair
        label="CH Peak Shortfall"
        before={asFound.chShortfallPct}
        after={restored.chShortfallPct}
        unit="%"
      />
      <MetricPair
        label="DHW Capacity Loss"
        before={asFound.dhwCapacityReductionPct}
        after={restored.dhwCapacityReductionPct}
        unit="%"
      />
      <MetricPair
        label="System Efficiency"
        before={asFound.efficiencyPct}
        after={restored.efficiencyPct}
        unit="%"
        lowerIsBetter={false}
      />
      <MetricPair
        label="Circuit Velocity"
        before={asFound.velocityMs}
        after={restored.velocityMs}
        unit=" m/s"
      />

      {/* Before vs After bar chart */}
      <div style={{ marginTop: '1.25rem', marginBottom: '0.5rem' }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#2d3748', marginBottom: '0.5rem' }}>
          Before vs After — Degradation Indicators
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#edf2f7" />
              <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} domain={[0, 'auto']} />
              <Tooltip formatter={formatBarTooltip} />
              <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
              <ReferenceLine y={0} stroke="#e2e8f0" />
              <Bar dataKey="As Found" fill="#fc8181" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Restored" fill="#68d391" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Hydraulic velocity band metric card */}
      {asFound.velocityMs > VELOCITY_UPPER_M_S && (
        <div style={{
          marginTop: '1rem',
          padding: '10px 14px',
          background: '#fffaf0',
          border: '1.5px solid #fbd38d',
          borderRadius: 8,
          fontSize: '0.82rem',
          color: '#744210',
        }}>
          <span style={{ fontWeight: 700 }}>
            Operating outside recommended hydraulic velocity band:{' '}
            {asFound.velocityOutsideBandPct}% of heating hours.
          </span>
          {' '}After restoration: {restored.velocityOutsideBandPct}% of heating hours.
        </div>
      )}

      {/* Three calm observations */}
      {hasAnyDegradation && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#2d3748', marginBottom: '0.5rem' }}>
            Current condition findings:
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 1.25rem', fontSize: '0.85rem', lineHeight: 1.8, color: '#4a5568' }}>
            {observations.map((obs, i) => (
              <li key={i}>{obs}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Scale note */}
      {estimatedScaleThicknessMm > 0 && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#718096' }}>
          Estimated DHW heat-exchanger scale thickness: {estimatedScaleThicknessMm.toFixed(2)} mm
          {systemAgeYears > 0 ? ` (${systemAgeYears}-year accumulation).` : '.'}
        </div>
      )}

      {/* Drift line — subtle urgency through evidence */}
      {hasAnyDegradation && (
        <div style={{
          marginTop: '1rem',
          padding: '10px 14px',
          background: '#f7fafc',
          border: '1px solid #e2e8f0',
          borderLeft: '3px solid #a0aec0',
          borderRadius: '0 6px 6px 0',
          fontSize: '0.82rem',
          color: '#4a5568',
          fontStyle: 'italic',
        }}>
          This difference has been accumulating gradually over time.
        </div>
      )}
    </div>
  );
}
