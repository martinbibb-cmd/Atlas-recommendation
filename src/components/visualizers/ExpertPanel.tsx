/**
 * ExpertPanel.tsx
 *
 * Expert-first pathway planning panel.
 *
 * Renders:
 *  - 5 dropdowns for ExpertAssumptionsV1 (writes to engine input via callback)
 *  - Expandable pathway cards from engineOutput.plans.pathways
 *  - Pathway selection (writes selectedPathwayId to parent state)
 *
 * RULES
 * - Physics is unchanged; only ranking and messaging respond to expertAssumptions.
 * - Experts select the plan; the engine documents consequences.
 * - No hard "No" — use "not advisable under current constraints" language.
 */

import { useState } from 'react';
import type { ExpertAssumptionsV1 } from '../../engine/schema/EngineInputV2_3';
import type { PlanV1, PathwayOptionV1 } from '../../contracts/EngineOutputV1';
import {
  CONFIDENCE_COLOUR,
  CONFIDENCE_BG,
  CONFIDENCE_BORDER,
  CONFIDENCE_LABEL,
  formatRankLabel,
} from './panelConstants';

interface Props {
  plan: PlanV1;
  expertAssumptions: ExpertAssumptionsV1;
  selectedPathwayId?: string;
  onAssumptionsChange: (assumptions: ExpertAssumptionsV1) => void;
  onSelectPathway: (id: string) => void;
}

// ── Assumption dropdown options ───────────────────────────────────────────────

const DISRUPTION_OPTIONS: { value: NonNullable<ExpertAssumptionsV1['disruptionTolerance']>; label: string }[] = [
  { value: 'low',  label: 'Low — minimal upheaval' },
  { value: 'med',  label: 'Medium — some works acceptable' },
  { value: 'high', label: 'High — full renovation possible' },
];

const SCREED_OPTIONS: { value: NonNullable<ExpertAssumptionsV1['screedLeakRiskTolerance']>; label: string }[] = [
  { value: 'cautious', label: 'Cautious — treat as unknown until tested' },
  { value: 'normal',   label: 'Normal — accept standard screed risk' },
];

const DHW_OPTIONS: { value: NonNullable<ExpertAssumptionsV1['dhwExperiencePriority']>; label: string }[] = [
  { value: 'normal', label: 'Normal — adequate hot water' },
  { value: 'high',   label: 'High — excellent DHW experience a priority' },
];

const FUTURE_OPTIONS: { value: NonNullable<ExpertAssumptionsV1['futureReadinessPriority']>; label: string }[] = [
  { value: 'normal', label: 'Normal — no specific future-proofing needed' },
  { value: 'high',   label: 'High — keep heat-pump pathway open' },
];

const COMFORT_OPTIONS: { value: NonNullable<ExpertAssumptionsV1['comfortVsRunningCost']>; label: string }[] = [
  { value: 'comfort',  label: 'Comfort — prioritise warmth and DHW quality' },
  { value: 'balanced', label: 'Balanced — comfort and cost in proportion' },
  { value: 'cost',     label: 'Cost — minimise running costs' },
];

const SPACE_OPTIONS: { value: NonNullable<ExpertAssumptionsV1['spaceSavingPriority']>; label: string }[] = [
  { value: 'low',    label: 'Low — space is not an issue' },
  { value: 'medium', label: 'Medium — prefer compact if practical' },
  { value: 'high',   label: 'High — must avoid cylinders / maximise space' },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function ExpertPanel({
  plan,
  expertAssumptions,
  selectedPathwayId,
  onAssumptionsChange,
  onSelectPathway,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ea = expertAssumptions;

  function update<K extends keyof ExpertAssumptionsV1>(key: K, value: ExpertAssumptionsV1[K]) {
    onAssumptionsChange({ ...ea, [key]: value });
  }

  return (
    <div style={{ fontFamily: 'inherit' }}>
      {/* Assumption dials */}
      <div style={{ marginBottom: '1.25rem' }}>
        <h4 style={{ fontSize: '0.9rem', color: '#4a5568', marginBottom: '0.75rem' }}>
          🔧 Expert Assumptions
          <span style={{ fontWeight: 400, fontSize: '0.78rem', color: '#718096', marginLeft: '0.5rem' }}>
            (adjust ranking and messaging — physics unchanged)
          </span>
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
          <AssumptionSelect
            label="Disruption tolerance"
            value={ea.disruptionTolerance ?? 'low'}
            options={DISRUPTION_OPTIONS}
            onChange={v => update('disruptionTolerance', v)}
          />
          <AssumptionSelect
            label="Screed leak risk"
            value={ea.screedLeakRiskTolerance ?? 'cautious'}
            options={SCREED_OPTIONS}
            onChange={v => update('screedLeakRiskTolerance', v)}
          />
          <AssumptionSelect
            label="DHW experience"
            value={ea.dhwExperiencePriority ?? 'normal'}
            options={DHW_OPTIONS}
            onChange={v => update('dhwExperiencePriority', v)}
          />
          <AssumptionSelect
            label="Future readiness"
            value={ea.futureReadinessPriority ?? 'normal'}
            options={FUTURE_OPTIONS}
            onChange={v => update('futureReadinessPriority', v)}
          />
          <AssumptionSelect
            label="Comfort vs cost"
            value={ea.comfortVsRunningCost ?? 'balanced'}
            options={COMFORT_OPTIONS}
            onChange={v => update('comfortVsRunningCost', v)}
          />
          <AssumptionSelect
            label="Space saving priority"
            value={ea.spaceSavingPriority ?? 'low'}
            options={SPACE_OPTIONS}
            onChange={v => update('spaceSavingPriority', v)}
          />
        </div>
      </div>

      {/* Shared constraints */}
      {plan.sharedConstraints.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '0.6rem 0.75rem', borderRadius: '6px', background: '#ebf8ff', border: '1px solid #bee3f8', fontSize: '0.8rem', color: '#2c5282' }}>
          <strong>Shared constraints (physics facts — cannot be changed here):</strong>
          <ul style={{ margin: '0.4rem 0 0 1.1rem', padding: 0 }}>
            {plan.sharedConstraints.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {/* Pathway cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {plan.pathways.map(pathway => (
          <PathwayCard
            key={pathway.id}
            pathway={pathway}
            isSelected={selectedPathwayId === pathway.id}
            isExpanded={expandedId === pathway.id}
            onSelect={() => onSelectPathway(pathway.id)}
            onToggleExpand={() => setExpandedId(expandedId === pathway.id ? null : pathway.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── PathwayCard ────────────────────────────────────────────────────────────────

function PathwayCard({
  pathway,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
}: {
  pathway: PathwayOptionV1;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
}) {
  const conf = pathway.confidence;
  const confColour = CONFIDENCE_COLOUR[conf.level];
  const confBg = CONFIDENCE_BG[conf.level];
  const confBorder = CONFIDENCE_BORDER[conf.level];

  const borderColour = isSelected ? '#6366f1' : '#e2e8f0';
  const bg = isSelected ? '#faf5ff' : '#fff';

  return (
    <div
      style={{
        border: `1.5px solid ${borderColour}`,
        borderRadius: '8px',
        background: bg,
        overflow: 'hidden',
        transition: 'border-color 0.15s',
      }}
    >
      {/* Card header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.7rem 0.9rem', cursor: 'pointer' }} onClick={onToggleExpand}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6366f1', background: '#ede9fe', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>
          {formatRankLabel(pathway.rank)}
        </span>
        <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, color: '#1a202c' }}>
          {pathway.title}
        </span>
        <span
          style={{ fontSize: '0.72rem', fontWeight: 600, color: confColour, background: confBg, border: `1px solid ${confBorder}`, borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}
        >
          {CONFIDENCE_LABEL[conf.level]}
        </span>
        <span style={{ fontSize: '0.75rem', color: '#718096' }}>{isExpanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '0.75rem 0.9rem', fontSize: '0.82rem', color: '#2d3748' }}>
          <p style={{ margin: '0 0 0.6rem' }}><em>{pathway.rationale}</em></p>

          <Detail title="Today" text={pathway.outcomeToday} />
          {pathway.outcomeAfterTrigger && (
            <Detail title="After trigger" text={pathway.outcomeAfterTrigger} />
          )}

          {pathway.prerequisites.length > 0 && (
            <div style={{ marginTop: '0.6rem' }}>
              <strong>Prerequisites:</strong>
              <ul style={{ margin: '0.3rem 0 0 1.1rem', padding: 0 }}>
                {pathway.prerequisites.map((p, i) => (
                  <li key={i} style={{ marginBottom: '0.25rem' }}>
                    {p.description}
                    {p.triggerEvent && <span style={{ color: '#718096' }}> — trigger: {p.triggerEvent}</span>}
                    {p.limiterRef && <span style={{ color: '#9f7aea', marginLeft: '0.3rem' }}>({p.limiterRef})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {conf.unknowns && conf.unknowns.length > 0 && (
            <div style={{ marginTop: '0.6rem', padding: '0.4rem 0.6rem', background: '#fffaf0', borderRadius: '5px', border: '1px solid #fbd38d' }}>
              <strong style={{ color: '#744210' }}>Unknowns:</strong>
              <ul style={{ margin: '0.2rem 0 0 1rem', padding: 0, color: '#744210' }}>
                {conf.unknowns.map((u, i) => <li key={i}>{u}</li>)}
              </ul>
              {conf.unlockBy && conf.unlockBy.length > 0 && (
                <>
                  <strong style={{ color: '#276749', marginTop: '0.4rem', display: 'block' }}>Unlock by:</strong>
                  <ul style={{ margin: '0.2rem 0 0 1rem', padding: 0, color: '#276749' }}>
                    {conf.unlockBy.map((u, i) => <li key={i}>{u}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Select button */}
      <div style={{ padding: '0.5rem 0.9rem', borderTop: isExpanded ? '1px solid #e2e8f0' : undefined }}>
        <button
          style={{
            fontSize: '0.8rem',
            padding: '0.3rem 0.8rem',
            borderRadius: '5px',
            border: isSelected ? '1.5px solid #6366f1' : '1px solid #cbd5e0',
            background: isSelected ? '#6366f1' : '#fff',
            color: isSelected ? '#fff' : '#4a5568',
            cursor: 'pointer',
            fontWeight: isSelected ? 600 : 400,
          }}
          onClick={onSelect}
        >
          {isSelected ? '✓ Selected' : 'Select this pathway'}
        </button>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function AssumptionSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="form-field" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      <label style={{ fontSize: '0.75rem', color: '#4a5568', fontWeight: 600 }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value as T)}
        style={{ fontSize: '0.8rem', padding: '0.3rem 0.4rem', borderRadius: '5px', border: '1px solid #cbd5e0' }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function Detail({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ marginBottom: '0.4rem' }}>
      <strong>{title}: </strong>{text}
    </div>
  );
}
