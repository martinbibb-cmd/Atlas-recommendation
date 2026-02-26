/**
 * SystemConditionImpact
 *
 * Step 8 — "System Condition Impact" panel (Results).
 *
 * Calm, clinical comparison of As Found vs After Flush + Filter.
 * All data is sourced from SystemConditionImpactModule — no randomness.
 *
 * Layout:
 *   Header       – "System Condition Impact"
 *   Subtext      – "Same system. Same house. Different internal condition."
 *   Toggle       – 🔴 As Found  /  🟢 After Flush + Filter
 *   Graph 1      – Comfort Stability (24h room temp trace + comfort band)
 *   Graph 2      – Hydraulic Behaviour (velocity trace + safe band)
 *   Graph 3      – DHW Deliverability (combi only)
 *   Graph 4      – System Stress (cycling / run time / purge)
 *   Glass Box    – Collapsed debug panel (derived values)
 *   Footer       – "This difference accumulates gradually over time."
 */
import { useState } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from 'recharts';
import type { ConditionImpactResult } from '../../engine/modules/SystemConditionImpactModule';
import { VELOCITY_LOWER_M_S, VELOCITY_UPPER_M_S } from '../../engine/modules/SystemConditionImpactModule';

interface Props {
  impact: ConditionImpactResult;
}

// ─── Style tokens ─────────────────────────────────────────────────────────────

const RED = '#e53e3e';
const RED_LIGHT = '#fed7d7';
const GREEN = '#38a169';
const GREEN_LIGHT = '#c6f6d5';
const AMBER = '#d69e2e';
const GREY_700 = '#2d3748';
const GREY_500 = '#4a5568';
const GREY_300 = '#e2e8f0';
const GREY_100 = '#f7fafc';
const BLUE_200 = '#bee3f8';
const BLUE_500 = '#3182ce';

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: GREY_500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
      {children}
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: GREY_500, marginBottom: '0.25rem' }}>
      <span>{label}</span>
      <span style={{ fontWeight: 600, color: GREY_700 }}>{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SystemConditionImpact({ impact }: Props) {
  const [activeState, setActiveState] = useState<'asFound' | 'restored'>('asFound');
  const [debugOpen, setDebugOpen] = useState(false);

  const {
    asFound,
    restored,
    chShortfallReductionPct,
    comfortTrace,
    minutesBelowSetpoint,
    dhwTrace,
    dhwPeakShortfallPct,
    stressAsFound,
    stressRestored,
    debugPanel,
    sludgeRiskIn3yrPct,
    estimatedScaleThicknessMm,
    systemAgeYears,
  } = impact;

  const isAsFound = activeState === 'asFound';
  const activeStress = isAsFound ? stressAsFound : stressRestored;

  // ── Stress bar chart data ─────────────────────────────────────────────────
  const stressData = [
    {
      metric: 'Cycling / day',
      'As Found': stressAsFound.cyclingEventsPerDay,
      'After Flush + Filter': stressRestored.cyclingEventsPerDay,
    },
    {
      metric: 'Avg run time (min)',
      'As Found': parseFloat(stressAsFound.avgRunTimeMinutes.toFixed(1)),
      'After Flush + Filter': parseFloat(stressRestored.avgRunTimeMinutes.toFixed(1)),
    },
    {
      metric: 'Purge events / day',
      'As Found': stressAsFound.purgeEvents,
      'After Flush + Filter': stressRestored.purgeEvents,
    },
  ];

  const hasAnyDegradation =
    asFound.chShortfallPct > 0 ||
    asFound.dhwCapacityReductionPct > 0 ||
    asFound.velocityOutsideBandPct > 0 ||
    asFound.efficiencyPct < restored.efficiencyPct;

  return (
    <div data-testid="system-condition-impact">

      {/* ── Section header ─────────────────────────────────────────────────── */}
      <h3 style={{ marginBottom: '0.15rem', color: GREY_700 }}>System Condition Impact</h3>
      <p style={{ fontSize: '0.82rem', color: GREY_500, marginBottom: '0.25rem' }}>
        Same system. Same house. Different internal condition.
      </p>
      <p style={{ fontSize: '0.75rem', color: '#a0aec0', marginBottom: '1.25rem', fontStyle: 'italic' }}>
        This comparison isolates internal system condition only.
        Demand, building fabric and weather are identical.
      </p>

      {/* ── Condition toggle ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveState('asFound')}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: `2px solid ${isAsFound ? RED : GREY_300}`,
            background: isAsFound ? RED_LIGHT : 'white',
            color: isAsFound ? RED : GREY_500,
            fontWeight: isAsFound ? 700 : 400,
            fontSize: '0.82rem',
            cursor: 'pointer',
          }}
        >
          🔴 As Found
        </button>
        <button
          onClick={() => setActiveState('restored')}
          style={{
            padding: '6px 16px',
            borderRadius: 6,
            border: `2px solid ${!isAsFound ? GREEN : GREY_300}`,
            background: !isAsFound ? GREEN_LIGHT : 'white',
            color: !isAsFound ? GREEN : GREY_500,
            fontWeight: !isAsFound ? 700 : 400,
            fontSize: '0.82rem',
            cursor: 'pointer',
          }}
        >
          🟢 After Flush + Filter
        </button>
      </div>

      {/* ── Graph 1 — Comfort Stability ────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <SectionLabel>Graph 1 — Comfort Stability</SectionLabel>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={comfortTrace} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GREY_300} />
              <XAxis
                dataKey="hour"
                tickFormatter={h => `${h}:00`}
                tick={{ fontSize: 10 }}
                interval={3}
              />
              <YAxis
                domain={[14, 24]}
                tick={{ fontSize: 10 }}
                tickFormatter={v => `${v}°`}
                width={30}
              />
              <Tooltip
                formatter={(v: number | undefined, name: string | undefined) => [`${(v ?? 0).toFixed(1)} °C`, name ?? '']}
                labelFormatter={h => `${h}:00`}
              />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              {/* Comfort band shading */}
              <ReferenceArea
                y1={comfortTrace[0]?.bandLowC ?? 20.5}
                y2={comfortTrace[0]?.bandHighC ?? 21.5}
                fill="#ebf8ff"
                fillOpacity={0.6}
                label={{ value: 'Comfort band', position: 'insideTopRight', fontSize: 9, fill: BLUE_500 }}
              />
              <ReferenceLine y={21} stroke={BLUE_500} strokeDasharray="4 2" strokeWidth={1} />
              {/* As Found trace */}
              <Line
                dataKey="asFoundTempC"
                name="As Found"
                stroke={RED}
                strokeWidth={isAsFound ? 2.5 : 1}
                opacity={isAsFound ? 1 : 0.35}
                dot={false}
              />
              {/* Restored trace */}
              <Line
                dataKey="restoredTempC"
                name="After Flush + Filter"
                stroke={GREEN}
                strokeWidth={!isAsFound ? 2.5 : 1}
                opacity={!isAsFound ? 1 : 0.35}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ marginTop: '0.5rem', padding: '8px 12px', background: GREY_100, borderRadius: 6 }}>
          {chShortfallReductionPct > 0 && (
            <MetricLine
              label="Peak morning shortfall reduced by"
              value={`${chShortfallReductionPct.toFixed(0)}%`}
            />
          )}
          <MetricLine
            label="Time below setpoint — As Found"
            value={`${minutesBelowSetpoint.asFound} min/day`}
          />
          <MetricLine
            label="Time below setpoint — After Flush + Filter"
            value={`${minutesBelowSetpoint.restored} min/day`}
          />
        </div>
      </div>

      {/* ── Graph 2 — Hydraulic Behaviour ──────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <SectionLabel>Graph 2 — Hydraulic Behaviour</SectionLabel>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={[
                { label: 'As Found', velocity: asFound.velocityMs },
                { label: 'After Flush + Filter', velocity: restored.velocityMs },
              ]}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GREY_300} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis
                domain={[0, Math.max(2.5, asFound.velocityMs + 0.3)]}
                tick={{ fontSize: 10 }}
                tickFormatter={v => `${v}m/s`}
                width={38}
              />
              <Tooltip formatter={(v: number | undefined) => [`${(v ?? 0).toFixed(2)} m/s`, 'Velocity']} />
              {/* Safe band shading */}
              <ReferenceArea
                y1={VELOCITY_LOWER_M_S}
                y2={VELOCITY_UPPER_M_S}
                fill={GREEN_LIGHT}
                fillOpacity={0.5}
                label={{ value: 'Safe band 0.8–1.5 m/s', position: 'insideTopRight', fontSize: 9, fill: GREEN }}
              />
              <ReferenceLine y={VELOCITY_UPPER_M_S} stroke={AMBER} strokeDasharray="4 2" strokeWidth={1} />
              <Area
                dataKey="velocity"
                name="Circuit velocity"
                stroke={isAsFound ? RED : GREEN}
                fill={isAsFound ? RED_LIGHT : GREEN_LIGHT}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ marginTop: '0.5rem', padding: '8px 12px', background: GREY_100, borderRadius: 6 }}>
          <MetricLine
            label="Operating outside recommended velocity band — As Found"
            value={`${asFound.velocityOutsideBandPct}% of heating hours`}
          />
          <MetricLine
            label="After Flush + Filter"
            value={`${restored.velocityOutsideBandPct}% of heating hours`}
          />
        </div>
      </div>

      {/* ── Graph 3 — DHW Deliverability (combi only) ──────────────────────── */}
      {dhwTrace != null && (
        <div style={{ marginBottom: '1.5rem' }}>
          <SectionLabel>Graph 3 — DHW Deliverability</SectionLabel>
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dhwTrace} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GREY_300} />
                <XAxis
                  dataKey="hour"
                  tickFormatter={h => `${h}:00`}
                  tick={{ fontSize: 10 }}
                  interval={3}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  tickFormatter={v => `${v}L`}
                  width={30}
                />
                <Tooltip
                  formatter={(v: number | undefined, name: string | undefined) => [`${(v ?? 0).toFixed(1)} L/min`, name ?? '']}
                  labelFormatter={h => `${h}:00`}
                />
                <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                {/* Requested demand */}
                <Area
                  dataKey="requestedLpm40"
                  name="Requested"
                  stroke={BLUE_500}
                  fill={BLUE_200}
                  fillOpacity={0.3}
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
                {/* As Found delivered */}
                <Area
                  dataKey="asFoundLpm40"
                  name="As Found (delivered)"
                  stroke={RED}
                  fill={RED_LIGHT}
                  fillOpacity={isAsFound ? 0.5 : 0.15}
                  strokeWidth={isAsFound ? 2.5 : 1}
                  opacity={isAsFound ? 1 : 0.4}
                />
                {/* Restored delivered */}
                <Area
                  dataKey="restoredLpm40"
                  name="After Flush + Filter"
                  stroke={GREEN}
                  fill={GREEN_LIGHT}
                  fillOpacity={!isAsFound ? 0.5 : 0.15}
                  strokeWidth={!isAsFound ? 2.5 : 1}
                  opacity={!isAsFound ? 1 : 0.4}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: '0.5rem', padding: '8px 12px', background: GREY_100, borderRadius: 6 }}>
            {dhwPeakShortfallPct != null && dhwPeakShortfallPct > 0 && (
              <MetricLine
                label="Peak demand unmet under simultaneous draw — As Found"
                value={`${dhwPeakShortfallPct.toFixed(0)}%`}
              />
            )}
            <MetricLine
              label="After Flush + Filter"
              value="Full delivery restored"
            />
          </div>
        </div>
      )}

      {/* ── Graph 4 — System Stress ─────────────────────────────────────────── */}
      <div style={{ marginBottom: '1.5rem' }}>
        <SectionLabel>Graph 4 — System Stress</SectionLabel>
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={stressData}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
              barCategoryGap="30%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={GREY_300} />
              <XAxis dataKey="metric" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 10 }} width={28} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
              <Bar dataKey="As Found" fill={RED} fillOpacity={isAsFound ? 1 : 0.35} radius={[3, 3, 0, 0]} />
              <Bar dataKey="After Flush + Filter" fill={GREEN} fillOpacity={!isAsFound ? 1 : 0.35} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ marginTop: '0.5rem', padding: '8px 12px', background: GREY_100, borderRadius: 6 }}>
          <MetricLine label="Cycling events / day" value={`${activeStress.cyclingEventsPerDay}`} />
          <MetricLine label="Avg burner run time" value={`${activeStress.avgRunTimeMinutes} min`} />
          <MetricLine label="Purge events / day" value={`${activeStress.purgeEvents}`} />
          <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: GREY_500 }}>
            Increased cycling accelerates component wear.
          </div>
        </div>
      </div>

      {/* ── Scale note ─────────────────────────────────────────────────────── */}
      {estimatedScaleThicknessMm > 0 && (
        <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: '#718096' }}>
          Estimated DHW heat-exchanger scale thickness:{' '}
          {estimatedScaleThicknessMm.toFixed(2)} mm
          {systemAgeYears > 0 ? ` (${systemAgeYears}-year accumulation).` : '.'}
        </div>
      )}

      {/* ── Glass Box — collapsed debug panel ──────────────────────────────── */}
      <div style={{ marginBottom: '1rem' }}>
        <button
          onClick={() => setDebugOpen(o => !o)}
          style={{
            background: 'none',
            border: `1px solid ${GREY_300}`,
            borderRadius: 6,
            padding: '4px 12px',
            fontSize: '0.75rem',
            color: GREY_500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <span>{debugOpen ? '▲' : '▼'}</span>
          Derived values
        </button>
        {debugOpen && (
          <div style={{
            marginTop: '0.5rem',
            padding: '10px 14px',
            background: GREY_100,
            border: `1px solid ${GREY_300}`,
            borderRadius: 6,
            fontSize: '0.78rem',
            color: GREY_500,
          }}>
            <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Derived from:</div>
            <div>• Sludge flow derate: {debugPanel.flowDeratePct.toFixed(1)}%</div>
            <div>• Cycling loss: {debugPanel.cyclingLossPct.toFixed(1)}%</div>
            <div>• DHW HX derate: {debugPanel.dhwCapacityDeratePct.toFixed(1)}%</div>
            <div>• Effective COP shift: {debugPanel.effectiveCOPShift.toFixed(2)}</div>
            {hasAnyDegradation && sludgeRiskIn3yrPct > debugPanel.flowDeratePct && (
              <div style={{ marginTop: '0.5rem', color: '#a0aec0', fontStyle: 'italic' }}>
                If untreated, sludge risk projects to {sludgeRiskIn3yrPct.toFixed(1)}% in 3 years.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Footer — quiet urgency ─────────────────────────────────────────── */}
      {hasAnyDegradation && (
        <div style={{
          padding: '10px 14px',
          background: GREY_100,
          border: `1px solid ${GREY_300}`,
          borderLeft: `3px solid #a0aec0`,
          borderRadius: '0 6px 6px 0',
          fontSize: '0.82rem',
          color: GREY_500,
          fontStyle: 'italic',
        }}>
          This difference accumulates gradually over time.
        </div>
      )}
    </div>
  );
}
