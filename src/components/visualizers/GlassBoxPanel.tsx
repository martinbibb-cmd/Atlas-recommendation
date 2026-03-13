/**
 * GlassBoxPanel – "Glass Box" Three-Tab Results UI
 *
 * Implements the three-tab "Glass Box" presentation layer as specified in
 * Phase 5 of the Domestic Thermal Physics Simulator V2.3:
 *
 *  Tab 1 – Raw Data:      Normalized postcode geochemical values, hydraulic
 *                          parameters, and confidence indicators.
 *  Tab 2 – Physics Trace: Full calculation log from all engine modules,
 *                          showing every decision point and its physical
 *                          justification (e.g. "Velocity 1.9 m/s = ❌
 *                          Performance Clipping").
 *  Tab 3 – Visual Outcome: Radial comfort clock, proportional 2D tank X-ray,
 *                          and efficiency decay graph rendered together.
 */

import { useState } from 'react';
import type { FullEngineResult, CondensingZone } from '../../engine/schema/EngineInputV2_3';
import InteractiveComfortClock from './InteractiveComfortClock';
import FootprintXRay from './FootprintXRay';
import EfficiencyCurve from './EfficiencyCurve';
import HydraulicVelocityBar from './HydraulicVelocityBar';

// ─── Types ────────────────────────────────────────────────────────────────────

type GlassBoxTab = 'raw_data' | 'physics_trace' | 'visual_outcome';

interface Props {
  results: FullEngineResult;
}

// ─── Tab styles ───────────────────────────────────────────────────────────────

const TAB_LABELS: Record<GlassBoxTab, string> = {
  raw_data: '📊 Raw Data',
  physics_trace: '🔬 Physics Trace',
  visual_outcome: '🎨 Visual Outcome',
};

const TAB_ORDER: GlassBoxTab[] = ['raw_data', 'physics_trace', 'visual_outcome'];

// ─── Helper: confidence indicator ────────────────────────────────────────────

function ConfidenceBadge({ label }: { label: string }) {
  return (
    <span style={{
      display: 'inline-block',
      background: '#ebf8ff',
      border: '1px solid #90cdf4',
      borderRadius: 4,
      padding: '1px 6px',
      fontSize: '0.72rem',
      color: '#2c5282',
      marginLeft: 6,
    }}>
      {label}
    </span>
  );
}

// ─── Helper: metric row ───────────────────────────────────────────────────────

function MetricRow({ label, value, unit, highlight }: {
  label: string;
  value: string | number;
  unit?: string;
  highlight?: 'ok' | 'warn' | 'neutral';
}) {
  const valueColor = highlight === 'ok' ? '#276749' : highlight === 'warn' ? '#c05621' : '#2d3748';
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.85rem',
    }}>
      <span style={{ color: '#718096' }}>{label}</span>
      <span style={{ fontWeight: 600, color: valueColor }}>
        {value}{unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

// ─── Helper: condensing state indicator (lab diagnostic) ─────────────────────

const ZONE_COLOURS: Record<CondensingZone, { bg: string; border: string; text: string; dot: string }> = {
  condensing:     { bg: '#f0fff4', border: '#9ae6b4', text: '#276749', dot: '#38a169' },
  borderline:     { bg: '#fffbeb', border: '#fbd38d', text: '#92400e', dot: '#d97706' },
  non_condensing: { bg: '#fff5f5', border: '#fed7d7', text: '#9b2c2c', dot: '#e53e3e' },
};

const ZONE_LABELS: Record<CondensingZone, string> = {
  condensing:     'Condensing',
  borderline:     'Borderline',
  non_condensing: 'Outside condensing range',
};

function CondensingStateIndicator({ results }: { results: FullEngineResult }) {
  const cs = results.condensingState;
  const colours = ZONE_COLOURS[cs.zone];

  return (
    <div style={{
      marginTop: 12,
      padding: '10px 12px',
      borderRadius: 8,
      background: colours.bg,
      border: `1px solid ${colours.border}`,
    }}>
      {/* Zone badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          display: 'inline-block',
          width: 10, height: 10,
          borderRadius: '50%',
          background: colours.dot,
          flexShrink: 0,
        }} />
        <span style={{ fontWeight: 700, fontSize: '0.88rem', color: colours.text }}>
          {ZONE_LABELS[cs.zone]}
        </span>
        <span style={{
          fontSize: '0.7rem',
          background: '#ebf8ff',
          border: '1px solid #90cdf4',
          borderRadius: 4,
          padding: '1px 5px',
          color: '#2c5282',
          marginLeft: 'auto',
        }}>
          lab diagnostic
        </span>
      </div>

      {/* Key metrics */}
      <div style={{ fontSize: '0.8rem', color: '#4a5568', lineHeight: 1.7 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Flow temp</span>
          <span style={{ fontWeight: 600 }}>{cs.flowTempC} °C</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Full-load return</span>
          <span style={{ fontWeight: 600, color: cs.fullLoadReturnC >= cs.condensingThresholdC ? colours.text : '#276749' }}>
            {cs.fullLoadReturnC.toFixed(1)} °C
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Condensing threshold</span>
          <span style={{ fontWeight: 600 }}>{cs.condensingThresholdC} °C</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Est. condensing hours</span>
          <span style={{ fontWeight: 600 }}>{cs.estimatedCondensingFractionPct} %</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Return temp source</span>
          <span style={{ fontWeight: 600, fontStyle: 'italic' }}>{cs.returnTempSource}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Tab 1: Raw Data ──────────────────────────────────────────────────────────

function RawDataTab({ results }: { results: FullEngineResult }) {
  const { normalizer, hydraulic } = results;

  return (
    <div>
      <section style={{ marginBottom: 20 }}>
        <h4 style={sectionHeadStyle}>🧪 Geochemical Normalizer Output</h4>
        <ConfidenceBadge label="High confidence – postcode-derived" />
        <div style={{ marginTop: 10 }}>
          <MetricRow label="Water Hardness" value={normalizer.waterHardnessCategory.replace('_', ' ').toUpperCase()} highlight={normalizer.waterHardnessCategory === 'soft' ? 'ok' : 'warn'} />
          <MetricRow label="CaCO₃ Level" value={normalizer.cacO3Level} unit="mg/L" highlight={normalizer.cacO3Level > 200 ? 'warn' : 'ok'} />
          <MetricRow label="Silica Level" value={normalizer.silicaLevel} unit="mg/L" />
          <MetricRow label="Silicate Scaffold Coefficient" value={normalizer.scalingScaffoldCoefficient.toFixed(1)} highlight={normalizer.scalingScaffoldCoefficient > 1 ? 'warn' : 'ok'} />
          <MetricRow label="Thermal Resistance Factor (Rf)" value={normalizer.scaleRf.toFixed(6)} unit="m²K/W" />
          <MetricRow label="System Volume (proxy)" value={normalizer.systemVolumeL.toFixed(1)} unit="L" />
          <MetricRow label="10-Year Efficiency Decay" value={normalizer.tenYearEfficiencyDecayPct.toFixed(1)} unit="%" highlight={normalizer.tenYearEfficiencyDecayPct > 8 ? 'warn' : 'ok'} />
          <MetricRow label="Sludge Potential (primary loop)" value={normalizer.sludgePotential.toFixed(3)} highlight={normalizer.sludgePotential > 0.5 ? 'warn' : 'ok'} />
          <MetricRow label="Scaling Potential (DHW loop)" value={normalizer.scalingPotential.toFixed(3)} highlight={normalizer.scalingPotential > 0.5 ? 'warn' : 'ok'} />
          <MetricRow label="Can Use Vented System" value={normalizer.canUseVentedSystem ? 'Yes' : 'No'} highlight={normalizer.canUseVentedSystem ? 'ok' : 'warn'} />
        </div>
      </section>

      <section style={{ marginBottom: 20 }}>
        <h4 style={sectionHeadStyle}>🔧 Hydraulic Parameters</h4>
        <ConfidenceBadge label="Calculated – pipe diameter & heat loss" />
        <div style={{ marginTop: 10 }}>
          <MetricRow label="Flow Rate" value={(hydraulic.flowRateLs * 1000).toFixed(2)} unit="L/min" />
          <div style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
            <span style={{ fontSize: '0.85rem', color: '#718096' }}>Pipe Velocity</span>
            <div style={{ marginTop: 6 }}>
              <HydraulicVelocityBar velocityMs={hydraulic.velocityMs} />
            </div>
          </div>
          <MetricRow label="Hydraulic Bottleneck" value={hydraulic.isBottleneck ? '⚠️ YES' : '✅ No'} highlight={hydraulic.isBottleneck ? 'warn' : 'ok'} />
          <MetricRow label="Safety Cut-off Risk" value={hydraulic.isSafetyCutoffRisk ? '🚨 YES' : '✅ No'} highlight={hydraulic.isSafetyCutoffRisk ? 'warn' : 'ok'} />
          <MetricRow label="ASHP Requires 28mm Primary" value={hydraulic.ashpRequires28mm ? 'Yes – upgrade required' : 'No'} highlight={hydraulic.ashpRequires28mm ? 'warn' : 'ok'} />
        </div>
      </section>

      <section>
        <h4 style={sectionHeadStyle}>⚙️ System Optimization Output</h4>
        <ConfidenceBadge label="Derived – installation policy" />
        <div style={{ marginTop: 10 }}>
          <MetricRow label="Installation Policy" value={results.systemOptimization.installationPolicy.replace('_', ' ')} />
          <MetricRow label="Design Flow Temperature" value={results.systemOptimization.designFlowTempC} unit="°C" highlight={results.systemOptimization.designFlowTempC <= 40 ? 'ok' : 'warn'} />
          <MetricRow label="SPF Range" value={`${results.systemOptimization.spfRange[0]}–${results.systemOptimization.spfRange[1]}`} highlight={results.systemOptimization.spfMidpoint >= 3.8 ? 'ok' : 'warn'} />
          <MetricRow label="SPF Midpoint" value={results.systemOptimization.spfMidpoint.toFixed(2)} highlight={results.systemOptimization.spfMidpoint >= 3.8 ? 'ok' : 'warn'} />
          <MetricRow label="Condensing Mode Available" value={results.systemOptimization.condensingModeAvailable ? 'Yes' : 'No'} highlight={results.systemOptimization.condensingModeAvailable ? 'ok' : 'warn'} />
        </div>
        <CondensingStateIndicator results={results} />
      </section>
    </div>
  );
}

// ─── Tab 2: Physics Trace ─────────────────────────────────────────────────────

function PhysicsTraceTab({ results }: { results: FullEngineResult }) {
  const sections: { title: string; notes: string[] }[] = [
    { title: '🔧 Hydraulic Safety Module', notes: results.hydraulic.notes },
    { title: '🌊 Sludge vs Scale (Two-Water)', notes: results.sludgeVsScale.notes },
    { title: '⚙️ System Optimization', notes: results.systemOptimization.notes },
    { title: '🔩 Metallurgy Edge', notes: results.metallurgyEdge.notes },
    { title: '🏗️ Legacy Infrastructure', notes: results.legacyInfrastructure.notes },
    { title: '📊 Spec Edge (Full Analysis)', notes: results.specEdge.notes },
    { title: '💧 Mixergy Legacy', notes: results.mixergyLegacy.notes },
    { title: '📉 Combi Stress', notes: results.combiStress.notes },
    { title: '👥 Lifestyle Simulation', notes: results.lifestyle.notes },
    { title: '🔬 Condensing State (lab)', notes: results.condensingState.notes },
    { title: '🚩 Red Flags', notes: results.redFlags.reasons },
  ];

  return (
    <div>
      <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: 14 }}>
        Complete calculation log from all physics modules. Every decision point shows
        the physical constraint that determined the outcome.
      </p>
      {sections.map(({ title, notes }) =>
        notes.length > 0 ? (
          <section key={title} style={{ marginBottom: 18 }}>
            <h4 style={{ ...sectionHeadStyle, marginBottom: 8 }}>{title}</h4>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {notes.map((note, i) => (
                <li
                  key={i}
                  style={{
                    fontSize: '0.82rem',
                    color: '#4a5568',
                    padding: '5px 10px',
                    background: i % 2 === 0 ? '#f7fafc' : '#fff',
                    borderRadius: 4,
                    marginBottom: 2,
                    borderLeft: `3px solid ${noteColor(note)}`,
                  }}
                >
                  {note}
                </li>
              ))}
            </ul>
          </section>
        ) : null
      )}
    </div>
  );
}

/** Returns a left-border accent colour based on the note content. */
function noteColor(note: string): string {
  if (note.startsWith('✅')) return '#48bb78';
  if (note.startsWith('⚠️') || note.startsWith('🔴')) return '#ed8936';
  if (note.startsWith('🚫') || note.startsWith('❌')) return '#e53e3e';
  if (note.startsWith('💡') || note.startsWith('ℹ️')) return '#4299e1';
  return '#a0aec0';
}

// ─── Tab 3: Visual Outcome ────────────────────────────────────────────────────

function VisualOutcomeTab({ results }: { results: FullEngineResult }) {
  const heatLossKw = results.hydraulic.flowRateLs * 1000 / 100 || 8;

  return (
    <div>
      {/* Comfort Clock */}
      <section style={{ marginBottom: 24 }}>
        <h4 style={sectionHeadStyle}>🕐 Comfort Clock – Radial 24-Hour View</h4>
        <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: 10 }}>
          Paint your daily routine to see how heating demand changes hour by hour.
          The clock updates in real-time to reflect your occupancy pattern.
        </p>
        <InteractiveComfortClock heatLossKw={heatLossKw} />
      </section>

      {/* Tank X-Ray */}
      <section style={{ marginBottom: 24 }}>
        <h4 style={sectionHeadStyle}>🛢️ Proportional Tank X-Ray</h4>
        <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: 10 }}>
          Proportional 2D comparison: a {results.mixergy.mixergyLitres}L Mixergy delivers
          the same usable hot water as a {results.mixergy.equivalentConventionalLitres}L
          conventional cylinder — {results.mixergy.footprintSavingPct}% less floor space,
          {' '}{results.mixergy.gasSavingPct}% less gas.
        </p>
        <FootprintXRay
          mixergyLitres={results.mixergy.mixergyLitres}
          conventionalLitres={results.mixergy.equivalentConventionalLitres}
        />
      </section>

      {/* Efficiency Decay */}
      <section>
        <h4 style={sectionHeadStyle}>📉 Efficiency Decay vs Draw Frequency</h4>
        <p style={{ fontSize: '0.82rem', color: '#718096', marginBottom: 10 }}>
          Combi boiler efficiency collapses for short draws. Stored hot water
          solutions maintain consistent efficiency regardless of draw duration.
        </p>
        <EfficiencyCurve />
      </section>
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const sectionHeadStyle: React.CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 700,
  color: '#2d3748',
  margin: '0 0 4px 0',
};

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * GlassBoxPanel
 *
 * Renders the three-tab "Glass Box" UI:
 *  • Raw Data      – postcode normalizer outputs and hydraulic parameters
 *  • Physics Trace – full calculation log from every engine module
 *  • Visual Outcome – comfort clock, tank X-ray, efficiency decay graph
 */
export default function GlassBoxPanel({ results }: Props) {
  const [activeTab, setActiveTab] = useState<GlassBoxTab>('raw_data');

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
      {/* ── Tab Bar ──────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#f7fafc' }}>
        {TAB_ORDER.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            aria-selected={activeTab === tab}
            role="tab"
            style={{
              flex: 1,
              padding: '10px 6px',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #3182ce' : '2px solid transparent',
              background: activeTab === tab ? '#fff' : 'transparent',
              color: activeTab === tab ? '#2c5282' : '#718096',
              fontWeight: activeTab === tab ? 700 : 400,
              fontSize: '0.82rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* ── Tab Content ──────────────────────────────────────────────────────── */}
      <div style={{ padding: 16 }}>
        {activeTab === 'raw_data' && <RawDataTab results={results} />}
        {activeTab === 'physics_trace' && <PhysicsTraceTab results={results} />}
        {activeTab === 'visual_outcome' && <VisualOutcomeTab results={results} />}
      </div>
    </div>
  );
}
