/**
 * BehaviourConsolePage.tsx
 *
 * Behaviour Console — four-layer hierarchy:
 *   1. Page header
 *   2. Primary focus panel (Thermodynamic Timeline)
 *   3. Summary strip — Operating Point · Active Limiters · Verdict
 *   4. Secondary insight row — Cylinder · DHW/events · Domain influence
 *
 * Engineer mode exposes full constraint detail and influence breakdowns
 * via the collapsible EngineerDetails panel.
 *
 * All panels reference engine-output objects directly — no re-derivation.
 */
import { useState } from 'react';
import type { EngineOutputV1 } from '../../contracts/EngineOutputV1';
import { AtlasPanel } from '../ui/AtlasPanel';
import ReportView from '../report/ReportView';
import BehaviourTimelinePanel from './BehaviourTimelinePanel';
import BehaviourSummaryStrip from './BehaviourSummaryStrip';
import EngineerDetails from './EngineerDetails';
import CylinderStatusCard from './CylinderStatusCard';
import WaterPerformanceGauge from './WaterPerformanceGauge';
import {
  FLOW_MARKERS,
  PRESSURE_MARKERS,
  flowTone,
  pressureTone,
} from './waterPerformance.model';

interface Props {
  output: EngineOutputV1;
  onBack?: () => void;
}

type Mode = 'customer' | 'engineer';

export default function BehaviourConsolePage({ output, onBack }: Props) {
  const [mode, setMode] = useState<Mode>('customer');
  const [reportOpen, setReportOpen] = useState(false);

  const { verdict, behaviourTimeline, limiters, influenceSummary } = output;

  // Derived timeline values for the secondary row — presentational only.
  // Use reduce rather than Math.max(...spread) to avoid stack overflow on
  // high-resolution timelines (e.g. 5-min resolution = 288 points).
  const pts = behaviourTimeline?.points ?? [];
  const peakDhwKw = pts.reduce(
    (max, p) => Math.max(max, p.dhwApplianceOutKw ?? p.dhwDemandKw),
    0,
  );
  const peakDhwIdx = pts.findIndex(
    p => (p.dhwApplianceOutKw ?? p.dhwDemandKw) === peakDhwKw,
  );
  const peakDhwTime = pts[peakDhwIdx]?.t ?? '—';
  const dhwEventSteps = pts.filter(p => (p.dhwApplianceOutKw ?? 0) > 0).length;

  const applianceName = behaviourTimeline?.labels.applianceName ?? '';
  const isCombi = behaviourTimeline?.labels.isCombi ?? false;

  // Water performance values — derived from DHW timeline when available.
  // peakFlowLpm is estimated from peak kW appliance output using the
  // standard domestic flow relationship; pressureBar is provided by the
  // timeline labels when present, or uses a conservative default.
  const dhwPeakFlowLpm: number | null = behaviourTimeline
    ? peakDhwKw > 0
      ? Math.round((peakDhwKw / 2.4) * 10) / 10   // ~2.4 kW per L/min at 35°C rise
      : null
    : null;
  const dhwPressureBar: number | null =
    (behaviourTimeline as { labels: { dynamicPressureBar?: number } } | null)
      ?.labels?.dynamicPressureBar ?? (behaviourTimeline ? 1.1 : null);

  return (
    <div className="behaviour-console bcp-page">

      {/* ── Report view (full-screen overlay when open) ───────────────────── */}
      {reportOpen && (
        <ReportView output={output} onBack={() => setReportOpen(false)} />
      )}

      {!reportOpen && (
        <>

      {/* ── 1. Header ────────────────────────────────────────────────── */}
      <div className="behaviour-console__header bcp-header">
        <div className="bcp-header__left">
          {onBack && (
            <button className="bcp-back-btn" onClick={onBack}>
              ← Back
            </button>
          )}
          <div>
            <h1 className="bcp-header__title">Behaviour Console</h1>
            {applianceName && (
              <div className="behaviour-console__subtitle">
                {applianceName}
                {behaviourTimeline
                  ? ` · ${behaviourTimeline.resolutionMins} min resolution`
                  : ''}
              </div>
            )}
          </div>
        </div>

        <div className="bcp-header__right">
          {/* Report actions */}
          <div className="bcp-report-actions">
            <button
              className="bcp-report-btn"
              onClick={() => setReportOpen(true)}
            >
              View report
            </button>
            <button
              className="bcp-report-btn bcp-report-btn--print"
              onClick={() => {
                setReportOpen(true);
                // Allow the report to render before printing
                setTimeout(() => window.print(), 150);
              }}
            >
              🖨 Print report
            </button>
          </div>

          {/* Customer / Engineer mode toggle */}
          <div className="bcp-mode-toggle">
            {(['customer', 'engineer'] as const).map(m => (
              <button
                key={m}
                className={`bcp-mode-toggle__btn${mode === m ? ' bcp-mode-toggle__btn--active' : ''}`}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Primary focus panel — Thermodynamic Timeline ─────────── */}
      <AtlasPanel variant="focus" className="behaviour-console__focus-panel">
        {behaviourTimeline ? (
          <BehaviourTimelinePanel timeline={behaviourTimeline} />
        ) : (
          <div className="bcp-placeholder">
            ⚠ Behaviour timeline not available — provide lifestyle and
            heat-loss data for a full simulation.
          </div>
        )}
      </AtlasPanel>

      {/* ── 3. Summary strip — 3 compact cards ──────────────────────── */}
      <BehaviourSummaryStrip verdict={verdict} limiters={limiters} />

      {/* ── 4. Secondary insight row ─────────────────────────────────── */}
      <div className="behaviour-console__secondary-grid">

        {/* Cylinder / supply slot */}
        <AtlasPanel className="behaviour-console__kpi">
          <CylinderStatusCard isCombi={isCombi} />
        </AtlasPanel>

        {/* DHW / events slot — now includes instrument-style water performance gauges */}
        <AtlasPanel className="behaviour-console__kpi">
          <div className="panel-title">DHW / water performance</div>
          {behaviourTimeline ? (
            <>
              <div className="atlas-mono">
                Peak {peakDhwKw > 0 ? `${peakDhwKw.toFixed(1)} kW` : '—'} @ {peakDhwTime}
              </div>
              <div className="atlas-mono">
                {dhwEventSteps} active step{dhwEventSteps !== 1 ? 's' : ''}
              </div>
              <div className="behaviour-console__subtle">
                {behaviourTimeline.assumptionsUsed.length > 0
                  ? `${behaviourTimeline.assumptionsUsed.length} assumption${behaviourTimeline.assumptionsUsed.length !== 1 ? 's' : ''} applied`
                  : 'No assumptions'}
              </div>
              <div className="water-performance-card__grid">
                <WaterPerformanceGauge
                  label="Estimated flow"
                  value={dhwPeakFlowLpm}
                  min={0}
                  max={25}
                  unit="L/min"
                  markers={FLOW_MARKERS}
                  tone={flowTone(dhwPeakFlowLpm)}
                />
                <WaterPerformanceGauge
                  label="Assumed pressure"
                  value={dhwPressureBar}
                  min={0}
                  max={3}
                  unit="bar"
                  markers={PRESSURE_MARKERS}
                  tone={pressureTone(dhwPressureBar)}
                />
              </div>
            </>
          ) : (
            <div className="behaviour-console__subtle">No DHW data</div>
          )}
        </AtlasPanel>

        {/* Domain influence slot */}
        <AtlasPanel className="behaviour-console__kpi">
          <div className="panel-title">Domain influence</div>
          {influenceSummary ? (
            <>
              {(
                [
                  { key: 'heat' as const, label: 'Heat' },
                  { key: 'dhw' as const, label: 'DHW' },
                  { key: 'hydraulics' as const, label: 'Hydraulics' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="influence-compact-row">
                  <span className="behaviour-console__subtle">{label}</span>
                  <span className="atlas-mono">
                    {influenceSummary[key].influencePct}%
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div className="behaviour-console__subtle">No influence data</div>
          )}
        </AtlasPanel>
      </div>

      {/* ── 5. Engineer details (engineer mode only) ─────────────────── */}
      {mode === 'engineer' && <EngineerDetails output={output} />}

        </>
      )}
    </div>
  );
}

