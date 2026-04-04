/**
 * PresentationDeck.tsx
 *
 * Swipeable visual story deck. One idea per page, left/right navigation.
 *
 * Each page has:
 *   - one physics visual (via PresentationVisualSlot) or a data card
 *   - one title / core message
 *   - minimal text
 *   - optional "Open explainer" CTA (handled inside PresentationVisualSlot)
 *
 * Navigation:
 *   - touch swipe (left / right)
 *   - keyboard arrow keys
 *   - prev / next buttons
 *   - progress dots (clickable)
 *
 * Rules:
 *   - No Math.random() — all data from CanonicalPresentationModel.
 *   - Reduced-motion preference respected (no slide transition when enabled).
 *   - All copy from engine model — no generic standalone assertions.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { FullEngineResult, EngineInputV2_3 } from '../../engine/schema/EngineInputV2_3';
import type { RecommendationResult } from '../../engine/recommendation/RecommendationModel';
import type { ApplianceFamily } from '../../engine/topology/SystemTopology';
import {
  buildCanonicalPresentation,
  type Page1_5AgeingContext,
  type AvailableOptionExplanation,
  type PhysicsRankingItem,
  type ShortlistedOptionDetail,
  type FinalPageSimulator,
  type UpgradeLayer,
} from './buildCanonicalPresentation';
import { inputToConceptModel } from '../../explainers/lego/autoBuilder/inputToConceptModel';
import { optionToConceptModel, type OptionId } from '../../explainers/lego/autoBuilder/optionToConceptModel';
import SystemArchitectureVisualiser from '../../explainers/lego/autoBuilder/SystemArchitectureVisualiser';
import QuadrantDashboardPage from './QuadrantDashboardPage';
import GeminiAISummary from './GeminiAISummary';
import { computeCurrentEfficiencyPct, DEFAULT_NOMINAL_EFFICIENCY_PCT } from '../../engine/utils/efficiency';
import CylinderComparePanel from '../physics-visuals/CylinderComparePanel';
import ConvectionExplainer from '../visualizers/ConvectionExplainer';
import './PresentationDeck.css';
import type React from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Minimum horizontal swipe distance (px) required to trigger a page change.
 * Filters out incidental horizontal movement during vertical scroll.
 */
const SWIPE_THRESHOLD_PX = 40;

// ─── System conversion data ────────────────────────────────────────────────────

/**
 * Nominal efficiency for thermal store systems (percentage points).
 * Thermal stores have lower efficiency than condensing boilers due to
 * internal coil heat exchange losses (~85–90 % in practice).
 * Defined as a named constant — never use the literal 87 in this file.
 */
const THERMAL_STORE_NOMINAL_EFFICIENCY_PCT = 87;

/**
 * Normalized performance profiles for each system type.
 * Scores are 0–100 (higher = better). Efficiency is normalized:
 *   gas boilers: ~93 → 93 (actual SEDBUK %)
 *   ASHP: COP 3.0–4.0 → 100 (capped to show clear relative advantage)
 */
interface SystemPerfProfile {
  label: string;
  flowRate: number;
  multiOutlet: number;
  heatingSpeed: number;
  efficiencyPct: number;
  efficiencyLabel: string;
  primaryConstraint: string;
}

const SYSTEM_PERF: Record<string, SystemPerfProfile> = {
  combi: {
    label: 'Combi Boiler',
    flowRate: 45,
    multiOutlet: 20,
    heatingSpeed: 95,
    efficiencyPct: DEFAULT_NOMINAL_EFFICIENCY_PCT,
    efficiencyLabel: `~${DEFAULT_NOMINAL_EFFICIENCY_PCT}–${DEFAULT_NOMINAL_EFFICIENCY_PCT + 2}%`,
    primaryConstraint: 'No backup if boiler fails; limited by plate heat exchanger.',
  },
  regular_vented: {
    label: 'Regular / System (Tank-fed)',
    flowRate: 55,
    multiOutlet: 50,
    heatingSpeed: 85,
    efficiencyPct: DEFAULT_NOMINAL_EFFICIENCY_PCT,
    efficiencyLabel: `~${DEFAULT_NOMINAL_EFFICIENCY_PCT}–${DEFAULT_NOMINAL_EFFICIENCY_PCT + 2}%`,
    primaryConstraint: 'Requires loft tanks; limited pressure without a pump.',
  },
  stored_unvented: {
    label: 'Regular / System (Unvented)',
    flowRate: 90,
    multiOutlet: 90,
    heatingSpeed: 85,
    efficiencyPct: DEFAULT_NOMINAL_EFFICIENCY_PCT,
    efficiencyLabel: `~${DEFAULT_NOMINAL_EFFICIENCY_PCT}–${DEFAULT_NOMINAL_EFFICIENCY_PCT + 2}%`,
    primaryConstraint: 'Requires 22mm cold main and G3 safety discharge (D2).',
  },
  thermal_store: {
    label: 'Thermal Store',
    flowRate: 70,
    multiOutlet: 70,
    heatingSpeed: 78,
    efficiencyPct: THERMAL_STORE_NOMINAL_EFFICIENCY_PCT,
    efficiencyLabel: `~${THERMAL_STORE_NOMINAL_EFFICIENCY_PCT - 2}–${THERMAL_STORE_NOMINAL_EFFICIENCY_PCT + 3}%`,
    primaryConstraint: 'Internal coils create flow restriction compared to unvented.',
  },
  ashp: {
    label: 'ASHP (Low Temp)',
    flowRate: 80,
    multiOutlet: 90,
    heatingSpeed: 25,
    efficiencyPct: 100,
    efficiencyLabel: 'COP 3.0–4.0',
    primaryConstraint: 'Requires oversized radiators/UFH to compensate for low flow temps.',
  },
};

/**
 * Maps a current system category + target option key to the work involved.
 * Returns an array of work item strings.
 */
function getConversionWork(
  currentHeatSourceType: EngineInputV2_3['currentHeatSourceType'],
  currentDhwType: EngineInputV2_3['dhwStorageType'],
  targetKey: string,
): string[] {
  const isThermalStore = currentDhwType === 'thermal_store';
  const isCombi = currentHeatSourceType === 'combi';
  const isRegular = currentHeatSourceType === 'regular';
  const isSystem = currentHeatSourceType === 'system';

  if (targetKey === 'ashp') {
    return [
      'Full system assessment required — flow temperature compatibility check.',
      'Oversized heat emitters (Type 22/33 radiators or UFH) typically required.',
      'Dedicated heat pump cylinder with large-surface heat exchanger coil.',
      'New electrical supply for heat pump unit (typically 6–10mm² SWA).',
      'External pipework between heat pump and cylinder/header.',
      'New controls: weather compensation, smart thermostat, TRV upgrade.',
      'MCS certification required for any subsidy / grant application.',
      isThermalStore ? 'Remove thermal store and loft tanks.' : 'Remove existing cylinder or reconfigure storage.',
    ].filter(Boolean) as string[];
  }

  if (targetKey === 'combi') {
    if (isThermalStore) {
      return [
        'Complete removal of thermal store and all loft tanks.',
        'Gas: always needs increasing/re-routing for the combi\'s high kW load.',
        'Full flue replacement to current building regulations.',
        'Condensate: upgrade to 21.5mm or 32mm and reroute to suitable drain.',
        'Re-route hot and cold feeds to new boiler location.',
        'Risk — loss of buffer: flow now limited by boiler plate heat exchanger.',
        'Risk — dead legs: must be removed to prevent stagnant water / Legionella.',
        'Risk — pressure: old pipework may fail under 1.5–3 bar operating pressure.',
      ];
    }
    if (isRegular || isSystem) {
      return [
        'Full flue replacement to current building regulations.',
        'Condensate: even when already condensing, often needs replacing/upgrading.',
        'Gas: always needs increasing to handle the high instantaneous demand.',
        'Disconnection and removal of F&E tank, system controls, and hot water cylinder.',
        'Drain down and disconnection of Cold Water Storage (CWS).',
        'Risk — leaks: high risk on old pipework due to mains pressure.',
        'Risk — shower incompatibility: existing tank-fed showers may not handle mains pressure.',
        'Risk — performance: limited water delivery and no way to pump the hot water.',
      ];
    }
    if (isCombi) {
      return [
        'Full flue replacement to current building regulations.',
        'Condensate: replace/upgrade pipework to current standards.',
        'Gas: check supply is adequate for new boiler kW rating.',
        'Direct like-for-like swap; no major pipework changes required.',
      ];
    }
  }

  if (targetKey === 'stored_unvented') {
    if (isThermalStore) {
      return [
        'Removal of the thermal store unit and any associated loft tanks.',
        'Connect 22mm mains cold water directly to new unvented cylinder.',
        'Install Tundish and D2 discharge pipe to safe, visible termination point.',
        'Upgrade to two-port valves and high-limit stats for G3 compliance.',
        'Complete electrical reconfiguration to standard S-Plan/G3 compliance.',
        'Performance benefit: unvented will outperform thermal store (no flow restriction).',
      ];
    }
    if (currentDhwType === 'vented' || (isRegular && !isThermalStore)) {
      return [
        'Remove F&E and Cold Water Storage tanks from loft.',
        'Install unvented cylinder (e.g., Megaflo or equivalent).',
        'Connect 22mm mains cold water directly to the cylinder for best performance.',
        'Install Tundish and D2 discharge pipe — must terminate in safe, visible position.',
        'Upgrade to two-port valves and high-limit stats for G3 compliance.',
        'Full flue replacement to current building regulations.',
        'Condensate: often needs replacing/upgrading.',
        'Gas: sometimes needs increasing depending on boiler kW rating.',
        'Risk — sealing the system: increased pressure can expose leaks in old joints/radiators.',
      ];
    }
    if (isSystem) {
      return [
        'Full flue replacement to current building regulations.',
        'Condensate: often needs replacing/upgrading.',
        'Gas: sometimes needs increasing.',
        'Expansion vessel: check internal vessel is sufficient; additional external vessels may be needed.',
        'D2 discharge: verify Tundish and D2 pipe are correctly installed and terminated safely.',
        'Controls: check S-Plan/Y-Plan configuration is correct for new cylinder.',
      ];
    }
    if (isCombi) {
      return [
        'Full flue replacement to current building regulations.',
        'Condensate: replace/upgrade pipework to current standards.',
        'Gas: check supply is adequate.',
        'Install new cylinder, associated pipework and controls.',
        'Re-route cold and hot water feeds.',
        'Install two-port valves and high-limit stats for G3 compliance.',
        'Risk — significant additional pipework throughout property.',
      ];
    }
  }

  if (targetKey === 'regular_vented') {
    if (isCombi) {
      return [
        'Full flue replacement to current building regulations.',
        'Condensate: replace/upgrade pipework to current standards.',
        'Gas: sometimes needs increasing.',
        'Install F&E tank in loft and Cold Water Storage tank.',
        'Install new vented cylinder and associated pipework.',
        'Install external pump and reconfigure controls.',
        'Risk — significant additional pipework; requires loft space.',
      ];
    }
    if (isSystem) {
      return [
        'Full flue replacement to current building regulations.',
        'Condensate: often needs replacing/upgrading.',
        'Gas: sometimes needs increasing.',
        'Addition of F&E tank and external pump.',
        'Additional pipework to accommodate open vent and cold feed.',
        'Reconfiguration of controls for external pump.',
        'Risk — possible air ingression if pump and cold feed/vent not positioned correctly.',
      ];
    }
    // Regular to Regular (same type)
    return [
      'Full flue replacement to current building regulations.',
      'Condensate: even when already condensing, often needs replacing/upgrading to 21.5mm or 32mm.',
      'Gas: sometimes needs increasing (e.g. 15mm to 22mm) to ensure correct working pressure.',
    ];
  }

  // Fallback
  return [
    'Full flue replacement to current building regulations.',
    'Condensate: pipework upgrade to current standards.',
    'Gas supply: check and upsize if required.',
    'Controls: reconfigure for new system type.',
  ];
}

// ─── System Conversion Modal ──────────────────────────────────────────────────

/**
 * Derives the performance profile key from a SYSTEM_OPTION_DEFS key.
 * The target option keys map to SYSTEM_PERF keys as follows:
 *   regular_vented  → regular_vented
 *   stored_unvented → stored_unvented
 *   ashp            → ashp
 *   combi           → combi
 */
function targetOptionToPerfKey(optionKey: string): string {
  return SYSTEM_PERF[optionKey] ? optionKey : 'combi';
}

/**
 * Derives the performance profile key for the current system from engine input.
 */
function currentSystemToPerfKey(
  currentHeatSourceType: EngineInputV2_3['currentHeatSourceType'],
  dhwStorageType: EngineInputV2_3['dhwStorageType'],
): string {
  if (currentHeatSourceType === 'combi') return 'combi';
  if (currentHeatSourceType === 'ashp') return 'ashp';
  if (dhwStorageType === 'thermal_store') return 'thermal_store';
  if (dhwStorageType === 'unvented') return 'stored_unvented';
  // regular or system with vented/unknown storage
  return 'regular_vented';
}

function SystemConversionModal({
  targetOptionKey,
  input,
  onClose,
}: {
  targetOptionKey: string;
  input: EngineInputV2_3;
  onClose: () => void;
}) {
  const currentPerfKey = currentSystemToPerfKey(input.currentHeatSourceType, input.dhwStorageType);
  const targetPerfKey = targetOptionToPerfKey(targetOptionKey);

  const currentProfile = SYSTEM_PERF[currentPerfKey];
  const targetProfile = SYSTEM_PERF[targetPerfKey];

  const workItems = getConversionWork(
    input.currentHeatSourceType,
    input.dhwStorageType,
    targetOptionKey,
  );

  // Build comparison chart data
  const chartData = [
    { metric: 'Flow Rate',    current: currentProfile.flowRate,    target: targetProfile.flowRate },
    { metric: 'Multi-Outlet', current: currentProfile.multiOutlet,  target: targetProfile.multiOutlet },
    { metric: 'Heat Speed',   current: currentProfile.heatingSpeed, target: targetProfile.heatingSpeed },
    { metric: 'Efficiency',   current: currentProfile.efficiencyPct, target: targetProfile.efficiencyPct },
  ];

  const isSameSystem = currentPerfKey === targetPerfKey;

  return (
    <div
      className="sdg-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${currentProfile.label} vs ${targetProfile.label}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="sdg-modal">
        {/* Header */}
        <div className="sdg-modal__header">
          <div>
            <p className="sdg-modal__eyebrow">System comparison</p>
            <h3 className="sdg-modal__title">
              {currentProfile.label} → {targetProfile.label}
            </h3>
          </div>
          <button
            type="button"
            className="sdg-modal__close"
            onClick={onClose}
            aria-label="Close comparison"
          >
            ✕
          </button>
        </div>

        <div className="sdg-modal__body">
          {/* Performance chart */}
          <p className="sdg-modal__section-heading">Performance comparison</p>
          <div className="sdg-modal__chart-wrap">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={chartData}
                margin={{ top: 4, right: 8, left: -16, bottom: 4 }}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="metric" tick={{ fontSize: 9 }} width={72} />
                <Tooltip
                  formatter={(value: number | undefined, name: string | undefined) => {
                    if (value == null) return [`—`, name ?? ''];
                    const nameStr = name ?? '';
                    const label = nameStr === 'current' ? currentProfile.label : targetProfile.label;
                    if (nameStr === 'current' && value === currentProfile.efficiencyPct) {
                      return [`${value} (${currentProfile.efficiencyLabel})`, label];
                    }
                    if (nameStr === 'target' && value === targetProfile.efficiencyPct) {
                      return [`${value} (${targetProfile.efficiencyLabel})`, label];
                    }
                    return [`${value}/100`, label];
                  }}
                />
                <Legend
                  formatter={(value: string) =>
                    value === 'current' ? currentProfile.label : targetProfile.label
                  }
                  wrapperStyle={{ fontSize: '0.7rem' }}
                />
                <Bar dataKey="current" fill="#e53e3e" fillOpacity={0.8} radius={[0, 3, 3, 0]} />
                <Bar dataKey="target"  fill="#3182ce" fillOpacity={0.8} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Key differences table */}
          <p className="sdg-modal__section-heading">Key specifications</p>
          <table className="sdg-modal__table" aria-label="System specifications comparison">
            <thead>
              <tr>
                <th>Metric</th>
                <th>{currentProfile.label}</th>
                <th>{targetProfile.label}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Efficiency / COP</td>
                <td>{currentProfile.efficiencyLabel}</td>
                <td>{targetProfile.efficiencyLabel}</td>
              </tr>
              <tr>
                <td>Primary constraint</td>
                <td>{currentProfile.primaryConstraint}</td>
                <td>{targetProfile.primaryConstraint}</td>
              </tr>
            </tbody>
          </table>

          {/* Work involved */}
          <p className="sdg-modal__section-heading">
            {isSameSystem ? 'Work involved (like-for-like replacement)' : 'Work involved (conversion)'}
          </p>
          <ul className="sdg-modal__work-list" aria-label="Work involved">
            {workItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

// ─── Page 2 — Boiler degradation charts ─────────────────────────────────────

function DegradationChartsPage({
  ctx,
  input,
}: {
  ctx: Page1_5AgeingContext;
  input: EngineInputV2_3;
}) {
  const ageYears = input.currentBoilerAgeYears ?? 8;
  const maxAge = Math.max(ageYears + 5, 15);

  // Efficiency data: use engine-derived nominal SEDBUK % and 10-year decay from
  // the normalizer (water hardness + system volume) — not hardcoded generic values.
  const decayPerYear = ctx.tenYearDecayPct / 10;
  const effData = Array.from({ length: maxAge + 1 }, (_, year) => ({
    year,
    efficiency: computeCurrentEfficiencyPct(ctx.nominalEfficiencyPct, decayPerYear * year),
  }));

  // Scale accumulation: index 0–10, plate HEx faster than cylinder.
  // Rates are proportional to the engine's tenYearDecayPct so soft/hard water
  // areas produce materially different curves.
  const plateHexRatePerYear = (ctx.tenYearDecayPct / 10) * 0.55;
  const cylinderRatePerYear = (ctx.tenYearDecayPct / 10) * 0.28;
  const scaleData = Array.from({ length: maxAge + 1 }, (_, year) => ({
    year,
    'Plate HEx': Math.min(10, Math.round(year * plateHexRatePerYear * 10) / 10),
    'Cylinder': Math.min(10, Math.round(year * cylinderRatePerYear * 10) / 10),
  }));

  const bandClass = ctx.currentEfficiencyBand === 'healthy'
    ? 'atlas-deck-degradation__band--healthy'
    : ctx.currentEfficiencyBand === 'ageing'
    ? 'atlas-deck-degradation__band--ageing'
    : 'atlas-deck-degradation__band--neglected';

  const bandLabel = ctx.currentEfficiencyBand === 'healthy'
    ? '✅ Healthy'
    : ctx.currentEfficiencyBand === 'ageing'
    ? '⚠ Ageing'
    : '🔴 Neglected';

  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">System condition</p>
      <h2 className="atlas-presentation-deck__page-title">
        How boilers like yours age
      </h2>
      <p className="atlas-deck-degradation__subtitle">
        Boilers of this type, at this age, typically degrade like this.
      </p>

      <div className="atlas-deck-degradation__charts">
        {/* Left: efficiency curve */}
        <div className="atlas-deck-degradation__chart-box">
          <p className="atlas-deck-degradation__chart-label">Boiler efficiency (%)</p>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={effData} margin={{ top: 4, right: 8, left: -10, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 9 }}
                label={{ value: 'Years', position: 'insideBottom', offset: -4, fontSize: 9 }}
              />
              <YAxis domain={[Math.max(50, ctx.nominalEfficiencyPct - 40), ctx.nominalEfficiencyPct + 2]} tick={{ fontSize: 9 }} />
              <Tooltip formatter={(v: number | undefined) => [v != null ? `${v}%` : '', 'Efficiency']} />
              {ageYears > 0 && (
                <ReferenceLine
                  x={ageYears}
                  stroke="#e53e3e"
                  strokeDasharray="4 2"
                  label={{ value: `Now`, position: 'top', fontSize: 8, fill: '#e53e3e' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="efficiency"
                stroke="#3182ce"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Right: scale build-up */}
        <div className="atlas-deck-degradation__chart-box">
          <p className="atlas-deck-degradation__chart-label">Scale build-up (0–10)</p>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={scaleData} margin={{ top: 4, right: 8, left: -10, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 9 }}
                label={{ value: 'Years', position: 'insideBottom', offset: -4, fontSize: 9 }}
              />
              <YAxis domain={[0, 10]} tick={{ fontSize: 9 }} />
              <Tooltip />
              <ReferenceLine
                y={7}
                stroke="#fc8181"
                strokeDasharray="3 3"
                label={{ value: 'Action', position: 'right', fontSize: 8, fill: '#e53e3e' }}
              />
              {ageYears > 0 && (
                <ReferenceLine
                  x={ageYears}
                  stroke="#2b6cb0"
                  strokeDasharray="4 2"
                  label={{ value: 'Now', position: 'top', fontSize: 8, fill: '#2b6cb0' }}
                />
              )}
              <Legend iconSize={8} wrapperStyle={{ fontSize: '0.65rem' }} />
              <Line type="monotone" dataKey="Plate HEx" stroke="#e53e3e" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Cylinder" stroke="#ed8936" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="atlas-deck-degradation__footer">
        <span className={`atlas-deck-degradation__band ${bandClass}`}>{bandLabel}</span>
        <span className="atlas-deck-degradation__band-desc">{ctx.efficiencyBandDescription}</span>
      </div>
    </>
  );
}

// ─── Quick-wins tile SVG icons ────────────────────────────────────────────────
// Real SVG illustrations replace the former emoji placeholders.

function IconTRV() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      {/* Thermometer tube */}
      <rect x="14" y="3" width="8" height="20" rx="4" fill="#bee3f8" stroke="#2b6cb0" strokeWidth="1.5"/>
      {/* Mercury fill */}
      <rect x="16" y="12" width="4" height="10" rx="2" fill="#2b6cb0"/>
      {/* Bulb */}
      <circle cx="18" cy="27" r="5" fill="#2b6cb0"/>
      {/* Scale marks */}
      <line x1="22" y1="9"  x2="26" y2="9"  stroke="#2b6cb0" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="22" y1="14" x2="25" y2="14" stroke="#2b6cb0" strokeWidth="1.5" strokeLinecap="round"/>
      {/* TRV head (adjustment knob) */}
      <rect x="12" y="1" width="12" height="5" rx="2" fill="#3182ce" stroke="#2b6cb0" strokeWidth="1"/>
    </svg>
  );
}

function IconBalance() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      {/* Radiator body */}
      <rect x="3" y="11" width="30" height="14" rx="3" fill="#ebf8ff" stroke="#2b6cb0" strokeWidth="1.5"/>
      {/* Vertical fins */}
      <line x1="11" y1="11" x2="11" y2="25" stroke="#2b6cb0" strokeWidth="1.5"/>
      <line x1="18" y1="11" x2="18" y2="25" stroke="#2b6cb0" strokeWidth="1.5"/>
      <line x1="25" y1="11" x2="25" y2="25" stroke="#2b6cb0" strokeWidth="1.5"/>
      {/* Balanced flow arrows */}
      <path d="M6 7.5 L18 5 L30 7.5" stroke="#2b6cb0" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
      <polygon points="5,6 7,8 5,9" fill="#2b6cb0"/>
      <polygon points="31,6 29,8 31,9" fill="#2b6cb0"/>
    </svg>
  );
}

function IconInhibitor() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      {/* Flask body */}
      <path d="M13 4h10v10l7 14H6l7-14V4z" fill="#c6f6d5" stroke="#276749" strokeWidth="1.5" strokeLinejoin="round"/>
      {/* Stopper */}
      <line x1="13" y1="4" x2="23" y2="4" stroke="#276749" strokeWidth="2" strokeLinecap="round"/>
      {/* Bubbles (chemical reaction) */}
      <circle cx="13" cy="22" r="1.75" fill="#276749"/>
      <circle cx="19" cy="24" r="1.75" fill="#276749"/>
      <circle cx="23" cy="20" r="1.25" fill="#276749"/>
    </svg>
  );
}

function IconFlush() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      {/* Water droplet */}
      <path d="M18 2 C18 2 9 13 9 20 a9 9 0 0 0 18 0 C27 13 18 2 18 2z"
            fill="#bee3f8" stroke="#2b6cb0" strokeWidth="1.5"/>
      {/* Swirl (flush action) */}
      <path d="M14 17 Q14 23 19 23 Q23 23 23 19 Q23 15 19 15" stroke="#2b6cb0" strokeWidth="1.5"
            fill="none" strokeLinecap="round"/>
      <polygon points="18,14 20,16 16,16" fill="#2b6cb0"/>
    </svg>
  );
}

function IconWeather() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      {/* Sun circle */}
      <circle cx="18" cy="15" r="6" fill="#fefcbf" stroke="#d69e2e" strokeWidth="1.5"/>
      {/* Sun rays */}
      <line x1="18" y1="5"  x2="18" y2="3"  stroke="#d69e2e" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="25" y1="8"  x2="27" y2="6"  stroke="#d69e2e" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="28" y1="15" x2="30" y2="15" stroke="#d69e2e" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8"  y1="15" x2="6"  y2="15" stroke="#d69e2e" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="11" y1="8"  x2="9"  y2="6"  stroke="#d69e2e" strokeWidth="1.5" strokeLinecap="round"/>
      {/* Down-arrow (weather compensation adjusts output temp) */}
      <line x1="18" y1="24" x2="18" y2="32" stroke="#2b6cb0" strokeWidth="2" strokeLinecap="round"/>
      <polygon points="14,29 18,33 22,29" fill="#2b6cb0"/>
    </svg>
  );
}

// ─── Page 2.5 — Low-hanging fruit ────────────────────────────────────────────

const FRUIT_TILES = [
  { Icon: IconTRV,       label: 'TRV upgrade',       desc: 'Precise room-by-room control' },
  { Icon: IconBalance,   label: 'System balance',     desc: 'Even heat, every radiator' },
  { Icon: IconInhibitor, label: 'Inhibitor dose',     desc: 'Corrosion & scale protection' },
  { Icon: IconFlush,     label: 'Power flush',        desc: 'Remove sludge, restore flow' },
  { Icon: IconWeather,   label: 'Weather comp.',      desc: 'Auto-modulate flow temp' },
];

function LowHangingFruitPage({ ctx }: { ctx: Page1_5AgeingContext }) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Quick wins</p>
      <h2 className="atlas-presentation-deck__page-title">
        The low-hanging fruit
      </h2>
      <p className="atlas-deck-fruit__subtitle">
        Before any new system — getting your return temperature to 55°C or below unlocks
        condensing-mode efficiency.
      </p>
      <div className="atlas-deck-fruit__tiles">
        {FRUIT_TILES.map(t => (
          <div key={t.label} className="atlas-deck-fruit__tile">
            <span className="atlas-deck-fruit__icon" aria-hidden="true"><t.Icon /></span>
            <span className="atlas-deck-fruit__label">{t.label}</span>
            <span className="atlas-deck-fruit__desc">{t.desc}</span>
          </div>
        ))}
      </div>
      {ctx.likelyFirstImprovements.length > 0 && (
        <ul className="atlas-deck-fruit__extra">
          {ctx.likelyFirstImprovements.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )}
      <div className="atlas-deck-fruit__heat-explainer">
        <ConvectionExplainer />
      </div>
    </>
  );
}

// ─── Page 2.6 — Performance upgrades ─────────────────────────────────────────

const CATEGORY_META: Record<string, { icon: string; colour: string }> = {
  water:    { icon: '💧', colour: '#ebf8ff' },
  heat:     { icon: '🔥', colour: '#fffaf0' },
  energy:   { icon: '⚡', colour: '#fffff0' },
  controls: { icon: '🎛️', colour: '#f0fff4' },
};

function PerformanceUpgradesPage({ layer }: { layer: UpgradeLayer }) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Go further</p>
      <h2 className="atlas-presentation-deck__page-title">
        {layer.title}
      </h2>

      {/* ── Cylinder type comparison — visual-first so it is always on-screen ── */}
      <div className="atlas-deck-perf__section">
        <p className="atlas-deck-perf__section-eyebrow">Cylinder physics</p>
        <CylinderComparePanel />
      </div>

      {/* ── Upgrade items — compact scrollable list below the visual ── */}
      <p className="atlas-deck-perf__bridge">
        You can stop here — or go further and unlock better performance.
      </p>
      <p className="atlas-deck-perf__description">{layer.description}</p>
      <div className="atlas-deck-perf__items">
        {layer.items.map(item => {
          const meta = CATEGORY_META[item.category] ?? { icon: '✦', colour: '#f7fafc' };
          return (
            <div
              key={item.title}
              className="atlas-deck-perf__item"
              style={{ background: meta.colour }}
              aria-label={`${item.category}: ${item.title}`}
            >
              <span className="atlas-deck-perf__item-icon" aria-hidden="true">{meta.icon}</span>
              <div className="atlas-deck-perf__item-body">
                <span className="atlas-deck-perf__item-title">{item.title}</span>
                <span className="atlas-deck-perf__item-desc">{item.description}</span>
                {item.impactTags.length > 0 && (
                  <div className="atlas-deck-perf__item-tags">
                    {item.impactTags.map(tag => (
                      <span key={tag} className="atlas-deck-perf__item-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </>
  );
}

// ─── Page 3 — 4-quadrant system options grid ─────────────────────────────────

const SYSTEM_OPTION_DEFS: ReadonlyArray<{
  key: string;
  heading: string;
  sub: string;
  imageId: string;
  matchIds: ReadonlyArray<string>;
}> = [
  {
    key: 'regular_vented',
    heading: 'Regular / System boiler',
    sub: '+ Open vented stored hot water',
    imageId: 'regular_vented',
    matchIds: ['regular_vented', 'stored_vented'],
  },
  {
    key: 'stored_unvented',
    heading: 'Regular / System boiler',
    sub: '+ Unvented stored hot water',
    imageId: 'stored_unvented',
    matchIds: ['stored_unvented', 'system_unvented'],
  },
  {
    key: 'ashp',
    heading: 'Air source heat pump',
    sub: '+ Stored hot water',
    imageId: 'ashp',
    matchIds: ['ashp', 'gshp'],
  },
  {
    key: 'combi',
    heading: 'Combination boiler',
    sub: 'On-demand hot water',
    imageId: 'combi',
    matchIds: ['combi'],
  },
];

function SystemOptionsGridPage({
  options,
  onOptionSelect,
}: {
  options: AvailableOptionExplanation[];
  onOptionSelect: (key: string) => void;
}) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Available systems</p>
      <h2 className="atlas-presentation-deck__page-title">
        The systems available to you
      </h2>
      <p className="atlas-deck-sys-grid__hint">Tap any option to compare with your current system</p>
      <div className="atlas-deck-sys-grid">
        {SYSTEM_OPTION_DEFS.map(def => {
          const concept = optionToConceptModel(def.imageId as OptionId);
          // Match this cell to an available option using the canonical matchIds list
          const opt = options.find(o => def.matchIds.includes(o.id));
          const bullets = opt
            ? [
                ...opt.throughHouseNotes.slice(0, 1),
                ...opt.throughHomeNotes.slice(0, 1),
              ].filter(Boolean)
            : [];
          const status = opt?.status ?? 'viable';
          const cellLabel = `${def.heading} ${def.sub}`;

          return (
            <button
              key={def.key}
              type="button"
              className={`atlas-deck-sys-grid__cell atlas-deck-sys-grid__cell--${status} atlas-deck-sys-grid__cell--tappable`}
              onClick={() => onOptionSelect(def.key)}
              aria-label={`Compare ${cellLabel}`}
            >
              <p className="atlas-deck-sys-grid__heading">{def.heading}</p>
              <p className="atlas-deck-sys-grid__sub">{def.sub}</p>
              <div className="atlas-deck-sys-grid__diagram">
                <SystemArchitectureVisualiser
                  mode="recommendation"
                  recommendedSystem={concept}
                />
              </div>
              {bullets.length > 0 && (
                <ul className="atlas-deck-sys-grid__bullets">
                  {bullets.map((b, i) => <li key={i}>{b}</li>)}
                </ul>
              )}
              <span className="atlas-deck-sys-grid__tap-hint" aria-hidden="true">Tap to compare →</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── Page 4 — Physics ranking (star ratings + pick 1 or 2) ──────────────────

/**
 * Single source of truth mapping each ApplianceFamily to:
 *   - `imageId`   — the key accepted by `imageForOptionId`
 *   - `optionIds` — the OptionCardV1 IDs that represent this family in page4Plus.options
 *
 * Using a `Record<ApplianceFamily, …>` ensures the compiler reports any
 * missing or misspelled family key at build time.
 */
const RANKING_FAMILY_MAP: Record<ApplianceFamily, { imageId: string; optionIds: string[] }> = {
  combi:       { imageId: 'combi',          optionIds: ['combi'] },
  system:      { imageId: 'stored_unvented', optionIds: ['stored_unvented', 'system_unvented'] },
  heat_pump:   { imageId: 'ashp',           optionIds: ['ashp', 'gshp'] },
  regular:     { imageId: 'regular_vented', optionIds: ['regular_vented', 'stored_vented'] },
  open_vented: { imageId: 'regular_vented', optionIds: ['regular_vented', 'stored_vented'] },
};

function RankingPage({
  items,
  selectedOption1Family,
  selectedOption2Family,
  disabledFamilies,
  hasOption2,
  onSetAsOption1,
  onSetAsOption2,
  onSelectOption1,
  onSelectOption2,
}: {
  items: PhysicsRankingItem[];
  selectedOption1Family: string | null;
  selectedOption2Family: string | null;
  /** Families that cannot be selected (score = 0 or no corresponding option page). */
  disabledFamilies: ReadonlySet<string>;
  /** Whether a second viable option page exists — controls "Explore option 2" CTA. */
  hasOption2: boolean;
  onSetAsOption1: (family: ApplianceFamily) => void;
  onSetAsOption2: (family: ApplianceFamily) => void;
  onSelectOption1: () => void;
  onSelectOption2: () => void;
}) {
  const maxScore = Math.max(...items.map(i => i.overallScore), 1);
  const RANK_COLOURS = ['#b7791f', '#718096', '#744210', '#a0aec0'];

  function starRating(score: number): string {
    const filled = Math.round((score / maxScore) * 4);
    return Array.from({ length: 4 }, (_, i) => (i < filled ? '★' : '☆')).join('');
  }

  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Physics ranking</p>
      <h2 className="atlas-presentation-deck__page-title">
        From pure physics, these systems rank for your home
      </h2>
      <div className="atlas-deck-ranking__list">
        {items.map((item, i) => {
          const concept = optionToConceptModel(RANKING_FAMILY_MAP[item.family].imageId as OptionId);
          const isOpt1 = item.family === selectedOption1Family;
          const isOpt2 = item.family === selectedOption2Family;
          const isDisabled = disabledFamilies.has(item.family);
          return (
            <div
              key={item.family}
              className={[
                'atlas-deck-ranking__row',
                item.rank === 1 ? 'atlas-deck-ranking__row--rank-1' : '',
                isOpt1 ? 'atlas-deck-ranking__row--option-1' : '',
                isOpt2 ? 'atlas-deck-ranking__row--option-2' : '',
                isDisabled ? 'atlas-deck-ranking__row--disabled' : '',
              ].filter(Boolean).join(' ')}
              aria-label={`Rank ${item.rank}: ${item.label}`}
            >
              <span
                className="atlas-deck-ranking__num"
                aria-hidden="true"
                style={{ background: RANK_COLOURS[i] ?? '#a0aec0' }}
              >
                {item.rank}
              </span>
              <div className="atlas-deck-ranking__body">
                <div className="atlas-deck-ranking__diagram">
                  <SystemArchitectureVisualiser mode="recommendation" recommendedSystem={concept} />
                </div>
                <span className="atlas-deck-ranking__label">{item.label}</span>
                {item.overallScore > 0 && (
                  <span className="atlas-deck-ranking__stars" aria-label={`${Math.round((item.overallScore / maxScore) * 4)} out of 4 stars`}>
                    {starRating(item.overallScore)}
                  </span>
                )}
                <span className="atlas-deck-ranking__reason">{item.reasonLine}</span>
                <div className="atlas-deck-ranking__item-btns">
                  {isDisabled ? (
                    <span className="atlas-deck-ranking__item-btn atlas-deck-ranking__item-btn--unavailable">
                      Not available
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`atlas-deck-ranking__item-btn atlas-deck-ranking__item-btn--1${isOpt1 ? ' atlas-deck-ranking__item-btn--active' : ''}`}
                        onClick={() => onSetAsOption1(item.family)}
                        aria-pressed={isOpt1}
                      >
                        {isOpt1 ? '✓ Option 1' : 'Option 1'}
                      </button>
                      <button
                        type="button"
                        className={`atlas-deck-ranking__item-btn atlas-deck-ranking__item-btn--2${isOpt2 ? ' atlas-deck-ranking__item-btn--active' : ''}`}
                        onClick={() => onSetAsOption2(item.family)}
                        aria-pressed={isOpt2}
                      >
                        {isOpt2 ? '✓ Option 2' : 'Option 2'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <p style={{ fontSize: '0.85rem', color: '#a0aec0', fontStyle: 'italic' }}>
            No ranking available — run the engine with recommendation output.
          </p>
        )}
      </div>
      {(selectedOption1Family || selectedOption2Family) && (
        <div className="atlas-deck-ranking__cta-row">
          {selectedOption1Family && (
            <button
              type="button"
              className="atlas-deck-ranking__cta-btn atlas-deck-ranking__cta-btn--1"
              onClick={onSelectOption1}
            >
              Explore option 1 →
            </button>
          )}
          {selectedOption2Family && hasOption2 && (
            <button
              type="button"
              className="atlas-deck-ranking__cta-btn atlas-deck-ranking__cta-btn--2"
              onClick={onSelectOption2}
            >
              Explore option 2 →
            </button>
          )}
        </div>
      )}
    </>
  );
}

function ShortlistPage({ option, index }: { option: ShortlistedOptionDetail; index: number }) {
  const concept = optionToConceptModel(option.family as OptionId);
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Option {index + 1}</p>
      <h2 className="atlas-presentation-deck__page-title">{option.label}</h2>
      <div className="atlas-presentation-deck__visual">
        <div className="atlas-presentation-deck__system-image">
          <SystemArchitectureVisualiser mode="recommendation" recommendedSystem={concept} />
        </div>
      </div>
      <div className="atlas-presentation-deck__shortlist-body">
        {option.complianceItems.length > 0 && (
          <div className="atlas-presentation-deck__shortlist-section atlas-presentation-deck__shortlist-section--compliance">
            <p className="atlas-presentation-deck__shortlist-section-heading">🔒 Required safety &amp; compliance</p>
            <ul className="atlas-presentation-deck__shortlist-list">
              {option.complianceItems.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
        <div className="atlas-presentation-deck__shortlist-section atlas-presentation-deck__shortlist-section--required">
          <p className="atlas-presentation-deck__shortlist-section-heading">🔨 Required work</p>
          {option.requiredWork.length > 0 ? (
            <ul className="atlas-presentation-deck__shortlist-list">
              {option.requiredWork.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          ) : (
            <p className="atlas-presentation-deck__shortlist-empty">No enabling works recorded.</p>
          )}
        </div>
        <div className="atlas-presentation-deck__shortlist-section atlas-presentation-deck__shortlist-section--best">
          <p className="atlas-presentation-deck__shortlist-section-heading">✨ To get the most from it</p>
          {option.bestPerformanceUpgrades.length > 0 ? (
            <ul className="atlas-presentation-deck__shortlist-list">
              {option.bestPerformanceUpgrades.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          ) : (
            <p className="atlas-presentation-deck__shortlist-empty">No additional upgrades identified.</p>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Page 7 — Simulator + print handoff ─────────────────────────────────────

function SimulatorPage({
  sim,
  onOpenSimulator,
  onPrint,
}: {
  sim: FinalPageSimulator;
  onOpenSimulator?: () => void;
  onPrint?: () => void;
}) {
  return (
    <>
      <p className="atlas-presentation-deck__page-eyebrow">Proof</p>
      <h2 className="atlas-presentation-deck__page-title">
        See how this will actually work in your home
      </h2>
      <div className="atlas-deck-simulator__tiles">
        {/* Simulator tile */}
        <div className="atlas-deck-simulator__tile atlas-deck-simulator__tile--sim">
          <p className="atlas-deck-simulator__tile-icon" aria-hidden="true">⚡</p>
          <p className="atlas-deck-simulator__tile-heading">System Simulator</p>
          <p className="atlas-deck-simulator__tile-desc">
            Live taps, heating and full system diagram. See exactly how your system performs.
          </p>
          {sim.simulatorCapabilities.length > 0 && (
            <ul className="atlas-deck-simulator__caps">
              {sim.simulatorCapabilities.map((cap, i) => <li key={i}>{cap}</li>)}
            </ul>
          )}
          {onOpenSimulator && (
            <button
              type="button"
              className="atlas-deck-simulator__tile-btn"
              onClick={onOpenSimulator}
            >
              Open simulator →
            </button>
          )}
        </div>

        {/* Print tile */}
        <div className="atlas-deck-simulator__tile atlas-deck-simulator__tile--print">
          <p className="atlas-deck-simulator__tile-icon" aria-hidden="true">📄</p>
          <p className="atlas-deck-simulator__tile-heading">Take this away</p>
          <p className="atlas-deck-simulator__tile-desc">
            We'll print a summary for you to review at home — everything in one place.
          </p>
          {onPrint && (
            <button
              type="button"
              className="atlas-deck-simulator__tile-btn atlas-deck-simulator__tile-btn--print"
              onClick={onPrint}
            >
              Print summary →
            </button>
          )}
        </div>
      </div>
      {sim.homeScenarioDescription && (
        <p className="atlas-deck-simulator__scenario">{sim.homeScenarioDescription}</p>
      )}
    </>
  );
}

// ─── Deck page descriptor ──────────────────────────────────────────────────────

interface DeckPageDescriptor {
  id: string;
  label: string;
  content: React.ReactNode;
  /**
   * Canonical source descriptor — lists the component name and the canonical
   * model fields that power this slide.  Used for automated tracing and the
   * dev-only provenance badge.
   */
  canonicalSource: {
    component: string;
    fields: string[];
  };
}

// ─── Dev-only provenance badge ────────────────────────────────────────────────

/**
 * DevProvenanceBadge — dev-only overlay showing which canonical fields
 * drive this slide.  Rendered only when import.meta.env.DEV is true.
 * Removed from production builds.
 */
function DevProvenanceBadge({
  component,
  fields,
}: {
  component: string;
  fields: string[];
}) {
  if (!import.meta.env.DEV) return null;
  return (
    <div
      className="atlas-deck-provenance"
      aria-hidden="true"
    >
      <span className="atlas-deck-provenance__label">
        🔬 {component}
      </span>
      <span className="atlas-deck-provenance__fields">
        {fields.join(' · ')}
      </span>
    </div>
  );
}

// ─── Main component props ─────────────────────────────────────────────────────

export interface PresentationDeckProps {
  result: FullEngineResult;
  input: EngineInputV2_3;
  recommendationResult?: RecommendationResult;
  onOpenSimulator?: () => void;
  /** Optional callback to open the print/PDF view. */
  onPrint?: () => void;
  /**
   * Optional heat-loss survey state.
   * When provided, the quadrant dashboard uses the shell perimeter snapshot
   * (shellSnapshotUrl) in the Your House tile and shows the roof orientation.
   */
  heatLossState?: import('../../features/survey/heatLoss/heatLossTypes').HeatLossState;
  /**
   * Optional chip-style priorities from the Priorities step.
   * When provided, the Your Objectives tile shows the selected chips.
   */
  prioritiesState?: import('../../features/survey/priorities/prioritiesTypes').PrioritiesState;
}

/**
 * PresentationDeck — horizontally swipeable visual story deck.
 *
 * Wraps CanonicalPresentationPage content as one-idea-per-page cards.
 * Navigate with swipe, arrow keys, or prev/next buttons.
 */
export default function PresentationDeck({
  result,
  input,
  recommendationResult,
  onOpenSimulator,
  onPrint,
  heatLossState,
  prioritiesState,
}: PresentationDeckProps) {
  const reducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  // Tracks which system option the user tapped on the Options page.
  // Rendered at this level so the modal can escape the transformed slide track.
  const [comparisonOptionKey, setComparisonOptionKey] = useState<string | null>(null);

  // Touch tracking refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Ref to the slide viewport DOM node.
  // Used to imperatively reset scrollLeft after each slide change.
  // Even with overflow: clip the browser may set scrollLeft when focus moves
  // into a newly-visible slide (e.g. ConvectionExplainer's interactive slider),
  // causing the wrong slide to be shown offset by one page width.
  const viewportRef = useRef<HTMLDivElement>(null);
  // Ref to the track so we can reset the active page's vertical scroll on slide change.
  const trackRef = useRef<HTMLDivElement>(null);

  const model = buildCanonicalPresentation(result, input, recommendationResult, prioritiesState);
  const { page1, page1_5, page2, page3, page4Plus, finalPage } = model;

  // Derive the current system concept model once — used for architecture slides.
  const currentSystemConcept = inputToConceptModel(input);

  // ─── Option selection — which ranked families are designated Option 1 / 2 ──
  //
  // Defaults to the top-2 ranked families so following pages are pre-populated.
  // The user can override by tapping "Option 1" / "Option 2" on the ranking row.
  const [selectedOption1Family, setSelectedOption1Family] = useState<ApplianceFamily | null>(
    () => page3.items[0]?.family ?? null,
  );
  const [selectedOption2Family, setSelectedOption2Family] = useState<ApplianceFamily | null>(
    () => page3.items[1]?.family ?? null,
  );

  // Re-seed selections when the ranked family list changes (e.g. when the model
  // is updated while the deck stays mounted). If the previously selected family
  // is still present in the new ranking, the user's choice is preserved; otherwise
  // fall back to the new top-2 families so the option pages are never stale.
  const rankingFamilyKey = page3.items.map(i => i.family).join(',');
  useEffect(() => {
    const families = page3.items.map(item => item.family);
    setSelectedOption1Family(prev => {
      if (families.length === 0) return null;
      if (prev && families.includes(prev)) return prev;
      return families[0] ?? null;
    });
    setSelectedOption2Family(prev => {
      if (families.length === 0) return null;
      if (prev && families.includes(prev)) return prev;
      // Do not fall back to families[0]: if only one family is available, having
      // both slots point at the same family would violate mutual exclusivity.
      return families[1] ?? null;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankingFamilyKey]);

  /**
   * Resolve the ShortlistedOptionDetail for a selected ranking family.
   * Uses RANKING_FAMILY_MAP to translate from appliance-family key to option-card IDs.
   * Falls back to null when the family has no corresponding viable option.
   */
  function resolveOptionDetail(family: ApplianceFamily | null): ShortlistedOptionDetail | null {
    if (!family) return null;
    const ids = RANKING_FAMILY_MAP[family].optionIds;
    return page4Plus.options.find(o => ids.includes(o.family)) ?? null;
  }

  // Compute the ordered pair of options that the following pages will display.
  // If a selection has no corresponding viable option (e.g. disqualified), fall
  // back to the first two viable options so pages are never empty.
  const opt1Detail = resolveOptionDetail(selectedOption1Family) ?? page4Plus.options[0] ?? null;
  const opt2Detail = resolveOptionDetail(selectedOption2Family) ?? page4Plus.options[1] ?? null;
  const selectedShortlistOptions = [opt1Detail, opt2Detail].filter(
    (o): o is ShortlistedOptionDetail => o !== null,
  );

  // Pre-compute the set of option-card IDs that have a viable entry in page4Plus.
  // Used to determine which ranking families map to a real option page without
  // repeatedly calling resolveOptionDetail inside the filter below.
  const viableOptionIdSet = new Set(page4Plus.options.map(o => o.family));

  // Families that cannot be selected: score = 0 or no corresponding option page.
  const disabledFamilies: ReadonlySet<string> = new Set(
    page3.items
      .filter(item =>
        item.overallScore === 0 ||
        !RANKING_FAMILY_MAP[item.family].optionIds.some(id => viableOptionIdSet.has(id)),
      )
      .map(item => item.family),
  );

  // ─── Pre-compute page indices for ranking → option navigation ────────────
  //
  // Pages are always in this order:
  //   0: quadrant_overview
  //   1: degradation_charts    (conditional on page1_5.hasRealEvidence)
  //   2: low_hanging_fruit     (conditional on page1_5.hasRealEvidence)
  //   3: performance_upgrades  (conditional on page1_5.hasRealEvidence)
  //   1|4: system_options_grid
  //   2|5: ranking
  //   3|6: option_1
  //   4|7: option_2
  //   last: simulator
  //
  const rankingIdx = 1 + (page1_5.hasRealEvidence ? 3 : 0) + 1;
  const opt1Idx    = rankingIdx + 1;
  const opt2Idx    = rankingIdx + 2;

  // ─── Build page list ───────────────────────────────────────────────────────

  const pages: DeckPageDescriptor[] = [
    // ── 1. Quadrant overview — house / home / system / objectives ─────────────
    {
      id:    'quadrant_overview',
      label: 'Overview',
      canonicalSource: {
        component: 'QuadrantDashboardPage',
        fields: [
          'page1.house', 'page1.home', 'page1.energy', 'page1.currentSystem', 'page1.objectives',
          'heatLossState', 'prioritiesState', 'input.bedrooms/bathroomCount/householdComposition',
        ],
      },
      content: (
        <div className="atlas-presentation-deck__quadrant-wrapper">
          <p className="atlas-presentation-deck__page-eyebrow">What we know</p>
          <DevProvenanceBadge
            component="QuadrantDashboardPage"
            fields={['page1.house', 'page1.home', 'page1.energy', 'page1.currentSystem', 'page1.objectives']}
          />
          <QuadrantDashboardPage
            house={page1.house}
            home={page1.home}
            energy={page1.energy}
            currentSystem={page1.currentSystem}
            currentSystemConcept={currentSystemConcept}
            heatLossState={heatLossState}
            prioritiesState={prioritiesState}
            objectives={page1.objectives}
            input={input}
          />
          <GeminiAISummary
            model={model}
            input={input}
            result={result}
            recommendationResult={recommendationResult}
          />
        </div>
      ),
    },

    // ── 2. Degradation charts — boiler efficiency + scale build-up ────────────
    //    Only shown when backed by real survey evidence.
    ...(page1_5.hasRealEvidence
      ? [{
          id: 'degradation_charts',
          label: 'Condition',
          canonicalSource: {
            component: 'DegradationChartsPage',
            fields: [
              'page1_5.currentEfficiencyBand', 'page1_5.efficiencyBandDescription',
              'input.currentBoilerAgeYears',
            ],
          },
          content: (
            <>
              <DevProvenanceBadge
                component="DegradationChartsPage"
                fields={['page1_5.efficiencyBand', 'input.currentBoilerAgeYears']}
              />
              <DegradationChartsPage ctx={page1_5} input={input} />
            </>
          ),
        }]
      : []),

    // ── 2.5. Low-hanging fruit — quick wins before committing to a new system ──
    //    Only shown when backed by real survey evidence.
    ...(page1_5.hasRealEvidence
      ? [{
          id: 'low_hanging_fruit',
          label: 'Quick wins',
          canonicalSource: {
            component: 'LowHangingFruitPage',
            fields: [
              'page1_5.likelyFirstImprovements',
            ],
          },
          content: (
            <>
              <DevProvenanceBadge
                component="LowHangingFruitPage"
                fields={['page1_5.likelyFirstImprovements']}
              />
              <LowHangingFruitPage ctx={page1_5} />
            </>
          ),
        }]
      : []),

    // ── 2.6. Performance upgrades — "go further" higher-impact improvements ───
    //    Only shown when backed by real survey evidence (same gate as quick wins).
    ...(page1_5.hasRealEvidence
      ? [{
          id: 'performance_upgrades',
          label: 'Go further',
          canonicalSource: {
            component: 'PerformanceUpgradesPage',
            fields: [
              'page1_5.performanceLayer',
            ],
          },
          content: (
            <>
              <DevProvenanceBadge
                component="PerformanceUpgradesPage"
                fields={['page1_5.performanceLayer']}
              />
              <PerformanceUpgradesPage layer={page1_5.performanceLayer} />
            </>
          ),
        }]
      : []),

    // ── 3. System options grid — 4-quadrant images with bullet points ─────────
    {
      id:    'system_options_grid',
      label: 'Options',
      canonicalSource: {
        component: 'SystemOptionsGridPage',
        fields: ['page2.options ← result.engineOutput.options'],
      },
      content: (
        <>
          <DevProvenanceBadge
            component="SystemOptionsGridPage"
            fields={['page2.options ← engineOutput.options']}
          />
          <SystemOptionsGridPage options={page2.options} onOptionSelect={setComparisonOptionKey} />
        </>
      ),
    },

    // ── 4. Physics ranking — star ratings + pick 1 or 2 ──────────────────────
    {
      id:    'ranking',
      label: 'Best fit',
      canonicalSource: {
        component: 'RankingPage',
        fields: [
          'page3.items ← recommendation.bestOverall/bestByObjective',
          'item.reasonLine ← demographicOutputs/pvAssessment',
        ],
      },
      content: (
        <>
          <DevProvenanceBadge
            component="RankingPage"
            fields={['page3.items', 'item.reasonLine']}
          />
          <RankingPage
            items={page3.items}
            selectedOption1Family={selectedOption1Family}
            selectedOption2Family={selectedOption2Family}
            disabledFamilies={disabledFamilies}
            hasOption2={selectedShortlistOptions.length >= 2}
            onSetAsOption1={(family) => {
              setSelectedOption1Family(family);
              // Enforce mutual exclusivity: clear Option 2 if it used the same family.
              setSelectedOption2Family(prev => prev === family ? null : prev);
            }}
            onSetAsOption2={(family) => {
              setSelectedOption2Family(family);
              // Enforce mutual exclusivity: clear Option 1 if it used the same family.
              setSelectedOption1Family(prev => prev === family ? null : prev);
            }}
            onSelectOption1={() => goTo(opt1Idx)}
            onSelectOption2={() => {
              if (selectedShortlistOptions.length >= 2) {
                goTo(opt2Idx);
              }
            }}
          />
        </>
      ),
    },

    // ── 5 / 6. Shortlisted option detail (no compare-architecture slides) ─────
    ...selectedShortlistOptions.map((opt, i) => ({
      id:    `option_${i + 1}`,
      label: `Option ${i + 1}`,
      canonicalSource: {
        component: 'ShortlistPage',
        fields: [
          `page4Plus.options[${i}] ← recommendation shortlist`,
          'complianceItems', 'requiredWork', 'bestPerformanceUpgrades',
        ],
      },
      content: (
        <>
          <DevProvenanceBadge
            component="ShortlistPage"
            fields={[`page4Plus.options[${i}]`, 'requiredWork', 'bestPerformanceUpgrades']}
          />
          <ShortlistPage option={opt} index={i} />
        </>
      ),
    })),

    // ── 7. Simulator + print handoff ─────────────────────────────────────────
    {
      id:    'simulator',
      label: 'Proof',
      canonicalSource: {
        component: 'SimulatorPage',
        fields: [
          'finalPage.homeScenarioDescription',
          'finalPage.simulatorCapabilities',
          'finalPage.dhwArchitectureNote',
        ],
      },
      content: (
        <>
          <DevProvenanceBadge
            component="SimulatorPage"
            fields={['finalPage.homeScenarioDescription', 'finalPage.simulatorCapabilities']}
          />
          <SimulatorPage
            sim={finalPage}
            onOpenSimulator={onOpenSimulator}
            onPrint={onPrint}
          />
        </>
      ),
    },
  ];

  const total = pages.length;

  // ─── Navigation ───────────────────────────────────────────────────────────

  const goTo = useCallback((index: number) => {
    setCurrentIndex(Math.max(0, Math.min(index, total - 1)));
  }, [total]);

  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);
  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft')  goPrev();
      if (e.key === 'ArrowRight') goNext();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext]);

  // Reset viewport scrollLeft after every slide change.
  // The CSS `overflow: clip` on the viewport prevents the *user* from scrolling
  // horizontally, but some browsers (Safari/Chrome) still set scrollLeft via
  // focus management when an interactive element inside the newly-visible slide
  // gains focus (e.g. the ConvectionExplainer slider).  That shifts the
  // viewport's scroll origin by one page width making it appear as if the
  // wrong slide is showing even though the CSS transform is correct.
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollLeft = 0;
    }
    // Reset the vertical scroll of the newly active slide page.
    if (trackRef.current) {
      const pageEl = trackRef.current.children[currentIndex] as HTMLElement | undefined;
      if (pageEl) pageEl.scrollTop = 0;
    }
  }, [currentIndex]);

  // ─── Touch handlers ────────────────────────────────────────────────────────

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // Only register horizontal swipe if horizontal delta exceeds vertical delta
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return;

    if (dx < 0) goNext();
    else        goPrev();
  }

  // ─── Slide transform ───────────────────────────────────────────────────────

  const trackStyle = reducedMotion
    ? { transform: `translateX(-${currentIndex * 100}%)`, transition: 'none' }
    : { transform: `translateX(-${currentIndex * 100}%)` };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="atlas-presentation-deck"
      data-testid="presentation-deck"
      aria-roledescription="carousel"
      aria-label="Recommendation story deck"
    >

      {/* ── Progress dots ───────────────────────────────────────── */}
      <nav className="atlas-presentation-deck__progress" aria-label="Deck navigation">
        {pages.map((page, i) => (
          <button
            key={page.id}
            type="button"
            className={`atlas-presentation-deck__dot${i === currentIndex ? ' atlas-presentation-deck__dot--active' : ''}`}
            aria-label={`Go to page: ${page.label}`}
            aria-current={i === currentIndex ? 'true' : undefined}
            onClick={() => goTo(i)}
          />
        ))}
        <span className="atlas-presentation-deck__progress-label" aria-live="polite">
          {currentIndex + 1} / {total}
        </span>
      </nav>

      {/* ── Slide viewport ──────────────────────────────────────── */}
      <div
        ref={viewportRef}
        className="atlas-presentation-deck__viewport"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-live="polite"
        aria-atomic="true"
      >
        <div
          ref={trackRef}
          className="atlas-presentation-deck__track"
          style={trackStyle}
        >
          {pages.map((page, i) => (
            <div
              key={page.id}
              className="atlas-presentation-deck__page"
              role="group"
              aria-roledescription="slide"
              aria-label={`${page.label} (${i + 1} of ${total})`}
              aria-hidden={i !== currentIndex}
              data-canonical-source={page.id}
              data-canonical-component={page.canonicalSource.component}
            >
              {page.content}
            </div>
          ))}
        </div>
      </div>

      {/* ── Navigation buttons ───────────────────────────────────── */}
      <div className="atlas-presentation-deck__nav" aria-label="Deck controls">
        <button
          type="button"
          className="atlas-presentation-deck__nav-btn"
          onClick={goPrev}
          disabled={currentIndex === 0}
          aria-label="Previous page"
        >
          ← Back
        </button>

        <span className="atlas-presentation-deck__nav-counter" aria-hidden="true">
          {pages[currentIndex]?.label ?? ''}
        </span>

        <button
          type="button"
          className="atlas-presentation-deck__nav-btn"
          onClick={goNext}
          disabled={currentIndex === total - 1}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>

      {/* System conversion modal — rendered here (outside the transformed track)
          so position: fixed is relative to the viewport, not the slide container. */}
      {comparisonOptionKey && (
        <SystemConversionModal
          targetOptionKey={comparisonOptionKey}
          input={input}
          onClose={() => setComparisonOptionKey(null)}
        />
      )}

    </div>
  );
}
