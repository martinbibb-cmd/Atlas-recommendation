/**
 * ExpertPanel – Expert-First Pathway Planning Panel
 *
 * Displays expert assumptions dropdowns and expandable pathway cards
 * from engineOutput.plans.pathways. Lets the expert select a pathway
 * without the engine forcing a single answer.
 */

import { useState } from 'react';
import type { PlanV1, PathwayOptionV1, PathwayOptionId } from '../../contracts/EngineOutputV1';
import type { ExpertAssumptionsV1 } from '../../engine/schema/EngineInputV2_3';
import {
  CONFIDENCE_BADGE_STYLE,
  CONFIDENCE_LABEL,
  PATHWAY_RANK_BADGE,
} from './panelConstants';

interface Props {
  plan: PlanV1;
  assumptions: ExpertAssumptionsV1;
  onAssumptionsChange: (next: ExpertAssumptionsV1) => void;
  selectedPathwayId?: PathwayOptionId;
  onSelectPathway: (id: PathwayOptionId) => void;
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const sectionHead: React.CSSProperties = {
  fontSize: '0.92rem',
  fontWeight: 700,
  color: '#2d3748',
  margin: '0 0 8px 0',
};

const fieldRow: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  color: '#4a5568',
  fontWeight: 600,
};

const selectStyle: React.CSSProperties = {
  fontSize: '0.84rem',
  padding: '5px 8px',
  border: '1px solid #cbd5e0',
  borderRadius: 6,
  background: '#fff',
  color: '#2d3748',
};

// ─── Expert Assumptions ───────────────────────────────────────────────────────

function AssumptionsForm({
  assumptions,
  onChange,
}: {
  assumptions: ExpertAssumptionsV1;
  onChange: (next: ExpertAssumptionsV1) => void;
}) {
  function update<K extends keyof ExpertAssumptionsV1>(key: K, value: ExpertAssumptionsV1[K]) {
    onChange({ ...assumptions, [key]: value });
  }

  return (
    <div>
      <h4 style={sectionHead}>🎛️ Expert Assumptions</h4>
      <p style={{ fontSize: '0.78rem', color: '#718096', marginBottom: 12 }}>
        Tune these dials to adjust pathway ranking and messaging. Physics constraints are unchanged.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
        <div style={fieldRow}>
          <label style={labelStyle}>Disruption tolerance</label>
          <select
            style={selectStyle}
            value={assumptions.disruptionTolerance}
            onChange={e => update('disruptionTolerance', e.target.value as ExpertAssumptionsV1['disruptionTolerance'])}
          >
            <option value="low">Low — like-for-like only</option>
            <option value="med">Medium — some work accepted</option>
            <option value="high">High — full renovation possible</option>
          </select>
        </div>

        <div style={fieldRow}>
          <label style={labelStyle}>Screed / leak risk tolerance</label>
          <select
            style={selectStyle}
            value={assumptions.screedLeakRiskTolerance}
            onChange={e => update('screedLeakRiskTolerance', e.target.value as ExpertAssumptionsV1['screedLeakRiskTolerance'])}
          >
            <option value="cautious">Cautious — avoid screed risk</option>
            <option value="normal">Normal — standard risk accepted</option>
          </select>
        </div>

        <div style={fieldRow}>
          <label style={labelStyle}>DHW experience priority</label>
          <select
            style={selectStyle}
            value={assumptions.dhwExperiencePriority}
            onChange={e => update('dhwExperiencePriority', e.target.value as ExpertAssumptionsV1['dhwExperiencePriority'])}
          >
            <option value="normal">Normal</option>
            <option value="high">High — best DHW performance first</option>
          </select>
        </div>

        <div style={fieldRow}>
          <label style={labelStyle}>Future readiness priority</label>
          <select
            style={selectStyle}
            value={assumptions.futureReadinessPriority}
            onChange={e => update('futureReadinessPriority', e.target.value as ExpertAssumptionsV1['futureReadinessPriority'])}
          >
            <option value="normal">Normal</option>
            <option value="high">High — ready for ASHP / upgrade</option>
          </select>
        </div>

        <div style={{ ...fieldRow, gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Comfort vs cost weighting</label>
          <select
            style={selectStyle}
            value={assumptions.comfortVsCost}
            onChange={e => update('comfortVsCost', e.target.value as ExpertAssumptionsV1['comfortVsCost'])}
          >
            <option value="comfort">Comfort-led</option>
            <option value="balanced">Balanced</option>
            <option value="cost">Cost-led</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// ─── Pathway Card ─────────────────────────────────────────────────────────────

function PathwayCard({
  pathway,
  isSelected,
  onSelect,
}: {
  pathway: PathwayOptionV1;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rankBadge = PATHWAY_RANK_BADGE[pathway.rank] ?? PATHWAY_RANK_BADGE[4];
  const confBadge = CONFIDENCE_BADGE_STYLE[pathway.confidence.level];

  return (
    <div
      style={{
        border: isSelected ? '2px solid #3182ce' : '1px solid #e2e8f0',
        borderRadius: 8,
        marginBottom: 10,
        overflow: 'hidden',
        background: isSelected ? '#ebf8ff' : '#fff',
        transition: 'border 0.15s',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(prev => !prev)}
        role="button"
        aria-expanded={expanded}
      >
        <span
          style={{
            ...rankBadge,
            borderRadius: 4,
            padding: '2px 7px',
            fontSize: '0.75rem',
            fontWeight: 700,
          }}
        >
          #{pathway.rank}
        </span>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#2d3748', flex: 1 }}>
          {pathway.title}
        </span>
        <span
          style={{
            ...confBadge,
            borderRadius: 4,
            padding: '2px 7px',
            fontSize: '0.72rem',
            border: confBadge.border,
          }}
        >
          {CONFIDENCE_LABEL[pathway.confidence.level]}
        </span>
        <span style={{ fontSize: '0.78rem', color: '#718096' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 12px 12px' }}>
          <p style={{ fontSize: '0.8rem', color: '#718096', margin: '0 0 8px' }}>
            {pathway.whenOffered}
          </p>

          {/* Rationale */}
          <div style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: '0.8rem', color: '#4a5568' }}>Rationale</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.8rem', color: '#4a5568' }}>
              {pathway.rationale.map(r => <li key={r}>{r}</li>)}
            </ul>
          </div>

          {/* Prerequisites / Constraints */}
          {pathway.prerequisites.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: '0.8rem', color: '#c05621' }}>Prerequisites</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.8rem', color: '#4a5568' }}>
                {pathway.prerequisites.map(p => (
                  <li key={p.id}>
                    {p.text}
                    {p.limiterRef && (
                      <span style={{ fontSize: '0.72rem', color: '#718096', marginLeft: 6 }}>
                        [constraint: {p.limiterRef}]
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Outcomes */}
          <div style={{ marginBottom: 8 }}>
            <strong style={{ fontSize: '0.8rem', color: '#4a5568' }}>Outcome today</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.8rem', color: '#4a5568' }}>
              {pathway.outcomeToday.map(o => <li key={o}>{o}</li>)}
            </ul>
          </div>

          {pathway.outcomeAfterTrigger && pathway.outcomeAfterTrigger.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: '0.8rem', color: '#4a5568' }}>After prerequisites resolved</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.8rem', color: '#4a5568' }}>
                {pathway.outcomeAfterTrigger.map(o => <li key={o}>{o}</li>)}
              </ul>
            </div>
          )}

          {/* Unknowns */}
          {pathway.confidence.unknowns && pathway.confidence.unknowns.length > 0 && (
            <div
              style={{
                background: '#fffaf0',
                border: '1px solid #fbd38d',
                borderRadius: 6,
                padding: '6px 10px',
                marginBottom: 8,
                fontSize: '0.78rem',
                color: '#744210',
              }}
            >
              <strong>Unknowns:</strong>
              <ul style={{ margin: '4px 0 0 14px', padding: 0 }}>
                {pathway.confidence.unknowns.map(u => <li key={u}>{u}</li>)}
              </ul>
              {pathway.confidence.unlockBy && pathway.confidence.unlockBy.length > 0 && (
                <>
                  <strong style={{ display: 'block', marginTop: 4 }}>Unlock by:</strong>
                  <ul style={{ margin: '4px 0 0 14px', padding: 0 }}>
                    {pathway.confidence.unlockBy.map(u => <li key={u}>{u}</li>)}
                  </ul>
                </>
              )}
            </div>
          )}

          {/* Select button */}
          <button
            onClick={e => { e.stopPropagation(); onSelect(); }}
            style={{
              marginTop: 4,
              padding: '6px 16px',
              background: isSelected ? '#3182ce' : '#f7fafc',
              color: isSelected ? '#fff' : '#2d3748',
              border: `1px solid ${isSelected ? '#3182ce' : '#cbd5e0'}`,
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.82rem',
            }}
          >
            {isSelected ? '✓ Selected' : 'Select this pathway'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * ExpertPanel
 *
 * Renders expert assumptions dropdowns + expandable pathway cards.
 * Allows the expert to tune assumptions and select a pathway.
 * The engine never forces a selection — selectedPathwayId is UI state.
 */
export default function ExpertPanel({
  plan,
  assumptions,
  onAssumptionsChange,
  selectedPathwayId,
  onSelectPathway,
}: Props) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 16 }}>
      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#2d3748', marginTop: 0 }}>
        🧭 Expert Pathway Planner
      </h3>

      {/* Shared constraints */}
      {plan.sharedConstraints.length > 0 && (
        <div
          style={{
            background: '#fff5f5',
            border: '1px solid #feb2b2',
            borderRadius: 6,
            padding: '8px 12px',
            marginBottom: 14,
            fontSize: '0.8rem',
            color: '#c53030',
          }}
        >
          <strong>Active constraints</strong>
          <ul style={{ margin: '4px 0 0 14px', padding: 0 }}>
            {plan.sharedConstraints.map(c => (
              <li key={c.limiterId}>{c.summary}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Assumptions form */}
      <div style={{ marginBottom: 16 }}>
        <AssumptionsForm assumptions={assumptions} onChange={onAssumptionsChange} />
      </div>

      {/* Pathway cards */}
      <div>
        <h4 style={sectionHead}>📋 Pathway Options</h4>
        {plan.pathways.map(pathway => (
          <PathwayCard
            key={pathway.id}
            pathway={pathway}
            isSelected={pathway.id === selectedPathwayId}
            onSelect={() => onSelectPathway(pathway.id)}
          />
        ))}
      </div>
    </div>
  );
}
