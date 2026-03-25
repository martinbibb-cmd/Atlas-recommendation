/**
 * SelectedFamilyDashboard.tsx — PR10: Family-bound presentation layer.
 *
 * The central view for PR10.  Renders:
 *   1. A top summary strip — selected system name, fit-map axis scores, limiter count badge.
 *   2. A tabbed main view — Heating | Hot Water | Efficiency | Constraints tabs.
 *   3. Expandable detail sections — fit map, limiter ledger, evidence.
 *
 * All data comes exclusively from the selected family's runner result, timeline,
 * events, limiter ledger, and fit map.  No cross-family fallback is used.
 *
 * Family-specific visibility:
 *   combi        → Heating tab shows CH interruption events; no recharge panels.
 *   stored_water → Hot Water tab shows recharge events; no purge/ignition panels.
 *   open_vented  → Hot Water tab shows gravity-fed draw events; no purge panels.
 *   heat_pump    → Hot Water tab shows slow-recovery evidence; no gas events.
 *
 * Layout:
 *   Mobile  → stacked sections
 *   Desktop → summary strip across top + two-column (main content | details sidebar)
 */

import { useState } from 'react';
import type { SelectedFamilyData, SelectableFamily } from './useSelectedFamilyData';
import { FAMILY_LABELS } from './useSelectedFamilyData';
import type { CondensingStateResult } from '../../engine/schema/EngineInputV2_3';
import FitMapAxisDisplay from './FitMapAxisDisplay';
import LimiterLedgerPanel from './LimiterLedgerPanel';
import FamilyEventList from './FamilyEventList';
import './SelectedFamilyDashboard.css';

// ─── Tab types ────────────────────────────────────────────────────────────────

type DashboardTab = 'heating' | 'hot_water' | 'efficiency' | 'constraints';

const TABS: { id: DashboardTab; label: string }[] = [
  { id: 'heating',     label: 'Heating' },
  { id: 'hot_water',   label: 'Hot Water' },
  { id: 'efficiency',  label: 'Efficiency' },
  { id: 'constraints', label: 'Constraints' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreBand(score: number): 'high' | 'mid' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 45) return 'mid';
  return 'low';
}

const FAMILIES: SelectableFamily[] = ['combi', 'stored_water', 'open_vented', 'heat_pump'];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SummaryStripProps {
  data: SelectedFamilyData;
  onSelectFamily: (family: SelectableFamily) => void;
}

function SummaryStrip({ data, onSelectFamily }: SummaryStripProps) {
  const { selectedFamily, fitMap, limiterLedger } = data;
  const heatingScore = fitMap.heatingAxis.score;
  const dhwScore = fitMap.dhwAxis.score;
  const limiterCount = limiterLedger.entries.length;
  const hardStopCount = limiterLedger.entries.filter((e) => e.severity === 'hard_stop').length;
  const warningCount = limiterLedger.entries.filter(
    (e) => e.severity === 'warning' || e.severity === 'limit',
  ).length;

  return (
    <div
      className="selected-family-dashboard__summary-strip"
      data-testid="summary-strip"
    >
      {/* Family selector pills */}
      <div
        className="selected-family-dashboard__family-pills"
        role="group"
        aria-label="Select system family"
      >
        {FAMILIES.map((family) => (
          <button
            key={family}
            className={`selected-family-dashboard__family-pill${selectedFamily === family ? ' selected-family-dashboard__family-pill--active' : ''}`}
            onClick={() => onSelectFamily(family)}
            aria-pressed={selectedFamily === family}
            data-testid={`family-pill-${family}`}
          >
            {FAMILY_LABELS[family]}
          </button>
        ))}
      </div>

      {/* Key scores */}
      <div className="selected-family-dashboard__scores" data-testid="key-scores">
        <div
          className={`selected-family-dashboard__score selected-family-dashboard__score--${scoreBand(heatingScore)}`}
          data-testid="heating-score-badge"
          aria-label={`Heating stability score: ${heatingScore}`}
        >
          <span className="selected-family-dashboard__score-value">{heatingScore}</span>
          <span className="selected-family-dashboard__score-label">Heating</span>
        </div>
        <div
          className={`selected-family-dashboard__score selected-family-dashboard__score--${scoreBand(dhwScore)}`}
          data-testid="dhw-score-badge"
          aria-label={`Hot water strength score: ${dhwScore}`}
        >
          <span className="selected-family-dashboard__score-value">{dhwScore}</span>
          <span className="selected-family-dashboard__score-label">Hot Water</span>
        </div>
      </div>

      {/* Badges */}
      <div className="selected-family-dashboard__badges" data-testid="quick-badges">
        {limiterCount > 0 && (
          <span
            className="selected-family-dashboard__badge selected-family-dashboard__badge--limiters"
            data-testid="limiter-count-badge"
            aria-label={`${limiterCount} constraint${limiterCount !== 1 ? 's' : ''} detected`}
          >
            {limiterCount} {limiterCount === 1 ? 'constraint' : 'constraints'}
          </span>
        )}
        {hardStopCount > 0 && (
          <span
            className="selected-family-dashboard__badge selected-family-dashboard__badge--hard-stop"
            data-testid="hard-stop-badge"
            aria-label={`${hardStopCount} hard stop${hardStopCount !== 1 ? 's' : ''}`}
          >
            {hardStopCount} hard stop
          </span>
        )}
        {warningCount > 0 && (
          <span
            className="selected-family-dashboard__badge selected-family-dashboard__badge--warning"
            data-testid="warning-badge"
            aria-label={`${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
          >
            {warningCount} {warningCount === 1 ? 'warning' : 'warnings'}
          </span>
        )}
        {limiterCount === 0 && (
          <span
            className="selected-family-dashboard__badge selected-family-dashboard__badge--ok"
            data-testid="no-constraints-badge"
          >
            No constraints
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Tab content ──────────────────────────────────────────────────────────────

interface HeatingTabProps {
  data: SelectedFamilyData;
}

function HeatingTab({ data }: HeatingTabProps) {
  const { events } = data;
  const isCombi = data.selectedFamily === 'combi';
  const heatingScore = data.fitMap.heatingAxis.score;
  const heatingEvidence = data.fitMap.heatingAxis.evidence;

  return (
    <div className="selected-family-dashboard__tab-content" data-testid="heating-tab-content">
      <div className="selected-family-dashboard__section">
        <div className="selected-family-dashboard__metric-row">
          <span className="selected-family-dashboard__metric-label">Heating stability score</span>
          <span
            className={`selected-family-dashboard__metric-value selected-family-dashboard__metric-value--${scoreBand(heatingScore)}`}
            data-testid="heating-stability-score"
          >
            {heatingScore} / 100
          </span>
        </div>
        {isCombi && events.counters.heatingInterruptions > 0 && (
          <div
            className="selected-family-dashboard__alert selected-family-dashboard__alert--warning"
            data-testid="heating-interruption-alert"
          >
            Heating interrupted {events.counters.heatingInterruptions} time
            {events.counters.heatingInterruptions !== 1 ? 's' : ''} during hot water use.
          </div>
        )}
        {heatingEvidence.length > 0 && (
          <ul className="selected-family-dashboard__evidence-list">
            {heatingEvidence.map((e) => (
              <li
                key={e.id}
                className={`selected-family-dashboard__evidence-item selected-family-dashboard__evidence-item--${e.effect}`}
                data-evidence-id={e.id}
              >
                {e.description}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface HotWaterTabProps {
  data: SelectedFamilyData;
}

function HotWaterTab({ data }: HotWaterTabProps) {
  const isCombi = data.selectedFamily === 'combi';
  const isStored = data.selectedFamily !== 'combi';
  const dhwScore = data.fitMap.dhwAxis.score;
  const dhwEvidence = data.fitMap.dhwAxis.evidence;
  const { counters } = data.events;

  return (
    <div className="selected-family-dashboard__tab-content" data-testid="hot-water-tab-content">
      <div className="selected-family-dashboard__section">
        <div className="selected-family-dashboard__metric-row">
          <span className="selected-family-dashboard__metric-label">Hot water strength score</span>
          <span
            className={`selected-family-dashboard__metric-value selected-family-dashboard__metric-value--${scoreBand(dhwScore)}`}
            data-testid="dhw-strength-score"
          >
            {dhwScore} / 100
          </span>
        </div>

        {/* Combi-specific: purge/ignition — always visible for combi runs */}
        {isCombi && (
          <div
            className="selected-family-dashboard__family-section"
            data-testid="combi-purge-ignition-section"
          >
            <div className="selected-family-dashboard__section-heading">
              On-demand hot water service
            </div>
            <div className="selected-family-dashboard__metric-row">
              <span className="selected-family-dashboard__metric-label">Purge cycles</span>
              <span className="selected-family-dashboard__metric-value" data-testid="purge-cycles-value">
                {counters.purgeCycles}
              </span>
            </div>
            <div className="selected-family-dashboard__metric-row">
              <span className="selected-family-dashboard__metric-label">Hot water requests</span>
              <span className="selected-family-dashboard__metric-value">{counters.dhwRequests}</span>
            </div>
          </div>
        )}

        {/* Stored/HP: recharge — always visible for stored/HP runs */}
        {isStored && (
          <div
            className="selected-family-dashboard__family-section"
            data-testid="stored-recharge-section"
          >
            <div className="selected-family-dashboard__section-heading">
              {data.selectedFamily === 'heat_pump'
                ? 'Cylinder recovery (heat pump)'
                : 'Cylinder recharge'}
            </div>
            <div className="selected-family-dashboard__metric-row">
              <span className="selected-family-dashboard__metric-label">Recharge cycles</span>
              <span className="selected-family-dashboard__metric-value" data-testid="recharge-cycles-value">
                {counters.rechargeCycles}
              </span>
            </div>
            {counters.reducedDhwEvents > 0 && (
              <div
                className="selected-family-dashboard__alert selected-family-dashboard__alert--warning"
                data-testid="reduced-dhw-alert"
              >
                Hot water delivered from a partial store {counters.reducedDhwEvents} time
                {counters.reducedDhwEvents !== 1 ? 's' : ''} — shortfall risk.
              </div>
            )}
          </div>
        )}

        {dhwEvidence.length > 0 && (
          <ul className="selected-family-dashboard__evidence-list">
            {dhwEvidence.map((e) => (
              <li
                key={e.id}
                className={`selected-family-dashboard__evidence-item selected-family-dashboard__evidence-item--${e.effect}`}
                data-evidence-id={e.id}
              >
                {e.description}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface EfficiencyTabProps {
  data: SelectedFamilyData;
}

function EfficiencyTab({ data }: EfficiencyTabProps) {
  const efficiencyScore = data.fitMap.efficiencyScore;
  const efficiencyEvidence = data.fitMap.evidence.filter((e) => e.axis === 'efficiency');
  const condensingState: CondensingStateResult = data.runnerResult.efficiency.condensingState;

  return (
    <div className="selected-family-dashboard__tab-content" data-testid="efficiency-tab-content">
      <div className="selected-family-dashboard__section">
        {efficiencyScore != null && (
          <div className="selected-family-dashboard__metric-row">
            <span className="selected-family-dashboard__metric-label">Efficiency score</span>
            <span
              className={`selected-family-dashboard__metric-value selected-family-dashboard__metric-value--${scoreBand(efficiencyScore)}`}
              data-testid="efficiency-score-value"
            >
              {efficiencyScore} / 100
            </span>
          </div>
        )}
        {condensingState != null && (
          <div className="selected-family-dashboard__metric-row" data-testid="condensing-state-row">
            <span className="selected-family-dashboard__metric-label">Condensing operation</span>
            <span className="selected-family-dashboard__metric-value">
              {condensingState.zone === 'condensing' ? 'Condensing' : 'Non-condensing'}
            </span>
          </div>
        )}
        {efficiencyEvidence.length > 0 && (
          <ul className="selected-family-dashboard__evidence-list">
            {efficiencyEvidence.map((e) => (
              <li
                key={e.id}
                className={`selected-family-dashboard__evidence-item selected-family-dashboard__evidence-item--${e.effect}`}
                data-evidence-id={e.id}
              >
                {e.description}
              </li>
            ))}
          </ul>
        )}
        {efficiencyScore == null && efficiencyEvidence.length === 0 && (
          <p className="selected-family-dashboard__no-data">
            No efficiency evidence available for this run.
          </p>
        )}
      </div>
    </div>
  );
}

interface ConstraintsTabProps {
  data: SelectedFamilyData;
}

function ConstraintsTab({ data }: ConstraintsTabProps) {
  return (
    <div className="selected-family-dashboard__tab-content" data-testid="constraints-tab-content">
      <LimiterLedgerPanel limiterLedger={data.limiterLedger} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SelectedFamilyDashboardProps {
  /** All data for the currently selected family (from useSelectedFamilyData). */
  data: SelectedFamilyData;
  /** Callback to change the selected family. */
  onSelectFamily: (family: SelectableFamily) => void;
}

/**
 * Renders the full PR10 family-bound dashboard.
 *
 * Binds all panels to the `data` prop — which is always the selected family's
 * runner result, timeline, events, limiter ledger, and fit map.  No cross-family
 * data is ever used here.
 */
export default function SelectedFamilyDashboard({
  data,
  onSelectFamily,
}: SelectedFamilyDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('heating');
  const [fitMapExpanded, setFitMapExpanded] = useState(false);
  const [eventsExpanded, setEventsExpanded] = useState(false);

  return (
    <div
      className="selected-family-dashboard"
      data-testid="selected-family-dashboard"
      data-selected-family={data.selectedFamily}
    >
      {/* ── 1. Summary strip ─────────────────────────────────────────── */}
      <SummaryStrip data={data} onSelectFamily={onSelectFamily} />

      {/* ── 2. Tabbed main view ───────────────────────────────────────── */}
      <div className="selected-family-dashboard__main" data-testid="main-view">
        <div
          className="selected-family-dashboard__tabs"
          role="tablist"
          aria-label="System analysis tabs"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`tab-panel-${tab.id}`}
              className={`selected-family-dashboard__tab${activeTab === tab.id ? ' selected-family-dashboard__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          id={`tab-panel-${activeTab}`}
          role="tabpanel"
          className="selected-family-dashboard__tab-panel"
          aria-label={TABS.find((t) => t.id === activeTab)?.label}
          data-testid="active-tab-panel"
        >
          {activeTab === 'heating'     && <HeatingTab data={data} />}
          {activeTab === 'hot_water'   && <HotWaterTab data={data} />}
          {activeTab === 'efficiency'  && <EfficiencyTab data={data} />}
          {activeTab === 'constraints' && <ConstraintsTab data={data} />}
        </div>
      </div>

      {/* ── 3. Expandable detail sections ────────────────────────────── */}
      <div className="selected-family-dashboard__details" data-testid="detail-sections">
        {/* Fit map */}
        <div className="selected-family-dashboard__detail-section">
          <button
            className="selected-family-dashboard__detail-toggle"
            onClick={() => setFitMapExpanded((v) => !v)}
            aria-expanded={fitMapExpanded}
            aria-controls="fit-map-detail"
            data-testid="fit-map-toggle"
          >
            {fitMapExpanded ? '▲' : '▼'} Service shape (fit map)
          </button>
          {fitMapExpanded && (
            <div id="fit-map-detail" data-testid="fit-map-detail">
              <FitMapAxisDisplay fitMap={data.fitMap} />
            </div>
          )}
        </div>

        {/* Events timeline */}
        <div className="selected-family-dashboard__detail-section">
          <button
            className="selected-family-dashboard__detail-toggle"
            onClick={() => setEventsExpanded((v) => !v)}
            aria-expanded={eventsExpanded}
            aria-controls="events-detail"
            data-testid="events-toggle"
          >
            {eventsExpanded ? '▲' : '▼'} Event timeline
          </button>
          {eventsExpanded && (
            <div id="events-detail" data-testid="events-detail">
              <FamilyEventList events={data.events} family={data.selectedFamily} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
