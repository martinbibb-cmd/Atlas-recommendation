/**
 * ExpertPanel.tsx
 *
 * Expert assumption dials + pathway selection.
 *
 * This panel lets the expert tune risk-appetite inputs that feed pathway ranking
 * (not the physics simulation).  The expert then selects a pathway and the
 * selection is stored in session state for inclusion in the generated summary.
 *
 * DATA FLOW:
 *   ExpertAssumptionsV1 (dials) → engine input → PathwayBuilderModule → PlanV1
 *   Expert selects pathway → selectedPathwayId → CustomerSummaryPanel
 */
import { useState } from 'react';
import type { ExpertAssumptionsV1 } from '../../engine/schema/EngineInputV2_3';
import type { PlanV1, PathwayOptionV1 } from '../../contracts/EngineOutputV1';
import { CONFIDENCE_BADGE_STYLES } from './panelConstants';

interface Props {
  /** Pathway plan produced by the engine. */
  plan: PlanV1;
  /** Current expert assumption values (controlled). */
  assumptions: ExpertAssumptionsV1;
  /** Called when the expert changes an assumption dial. */
  onAssumptionsChange: (updated: ExpertAssumptionsV1) => void;
  /** Called when the expert selects a pathway. */
  onPathwaySelected: (pathwayId: string) => void;
  /** Currently selected pathway ID (or undefined if none chosen yet). */
  selectedPathwayId?: string;
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const PANEL_STYLE: React.CSSProperties = {
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  padding: '16px 20px',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 14,
  color: '#1a202c',
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#4a5568',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: 10,
};

const DIAL_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 8,
};

const DIAL_LABEL: React.CSSProperties = {
  width: 200,
  fontSize: 13,
  color: '#2d3748',
};

const SELECT_STYLE: React.CSSProperties = {
  fontSize: 13,
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid #cbd5e0',
  background: '#fff',
  color: '#2d3748',
  cursor: 'pointer',
};

// ── Assumption dials ──────────────────────────────────────────────────────────

function DialRow<K extends keyof ExpertAssumptionsV1>({
  label,
  field,
  options,
  assumptions,
  onChange,
}: {
  label: string;
  field: K;
  options: Array<{ value: NonNullable<ExpertAssumptionsV1[K]>; label: string }>;
  assumptions: ExpertAssumptionsV1;
  onChange: (field: K, value: NonNullable<ExpertAssumptionsV1[K]>) => void;
}) {
  const current = assumptions[field] ?? options[0].value;
  return (
    <div style={DIAL_ROW}>
      <span style={DIAL_LABEL}>{label}</span>
      <select
        style={SELECT_STYLE}
        value={String(current)}
        onChange={e => onChange(field, e.target.value as NonNullable<ExpertAssumptionsV1[K]>)}
        aria-label={label}
      >
        {options.map(o => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Pathway card ──────────────────────────────────────────────────────────────

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
  const badge = CONFIDENCE_BADGE_STYLES[pathway.confidence.level];

  return (
    <div
      style={{
        border: `2px solid ${isSelected ? '#3182ce' : '#e2e8f0'}`,
        borderRadius: 8,
        padding: '14px 16px',
        marginBottom: 10,
        background: isSelected ? '#ebf8ff' : '#fff',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
      onClick={onSelect}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
            {isSelected && <span style={{ color: '#3182ce', marginRight: 6 }}>✓</span>}
            {pathway.title}
          </div>
          <div style={{ fontSize: 13, color: '#4a5568', marginBottom: 6 }}>{pathway.rationale}</div>
          <span
            style={{
              display: 'inline-block',
              background: badge.bg,
              color: badge.text,
              fontSize: 11,
              fontWeight: 600,
              borderRadius: 4,
              padding: '2px 8px',
              marginRight: 6,
            }}
          >
            {pathway.confidence.level.charAt(0).toUpperCase() + pathway.confidence.level.slice(1)} confidence
          </span>
          {pathway.prerequisites.length > 0 && (
            <span
              style={{
                display: 'inline-block',
                background: '#fef3c7',
                color: '#92400e',
                fontSize: 11,
                borderRadius: 4,
                padding: '2px 8px',
              }}
            >
              {pathway.prerequisites.length} prerequisite{pathway.prerequisites.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 18,
            color: '#718096',
            padding: '0 4px',
            lineHeight: 1,
          }}
          onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            <strong>Today:</strong> {pathway.outcomeToday}
          </div>
          {pathway.outcomeAfterTrigger && (
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <strong>After trigger event:</strong> {pathway.outcomeAfterTrigger}
            </div>
          )}
          {pathway.prerequisites.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#4a5568', marginBottom: 4 }}>
                Prerequisites
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {pathway.prerequisites.map((p, i) => (
                  <li key={i} style={{ fontSize: 12, color: '#2d3748', marginBottom: 4 }}>
                    {p.description}
                    {p.triggerEvent && (
                      <span style={{ color: '#718096' }}> — trigger: {p.triggerEvent}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {pathway.confidence.unknowns && pathway.confidence.unknowns.length > 0 && (
            <div style={{ marginTop: 8, background: '#fffbeb', borderRadius: 4, padding: '8px 10px' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 4 }}>
                Unknowns reducing confidence
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {pathway.confidence.unknowns.map((u, i) => (
                  <li key={i} style={{ fontSize: 12, color: '#92400e', marginBottom: 2 }}>{u}</li>
                ))}
              </ul>
              {pathway.confidence.unlockBy && pathway.confidence.unlockBy.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: '#276749' }}>
                  <strong>Unlock by:</strong> {pathway.confidence.unlockBy.join('; ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * ExpertPanel renders expert assumption dials and pathway selection cards.
 *
 * The expert adjusts risk-appetite dials (which re-rank pathways on the next
 * engine run), then clicks "I choose this pathway" on their preferred option.
 */
export function ExpertPanel({
  plan,
  assumptions,
  onAssumptionsChange,
  onPathwaySelected,
  selectedPathwayId,
}: Props) {
  function updateDial<K extends keyof ExpertAssumptionsV1>(
    field: K,
    value: NonNullable<ExpertAssumptionsV1[K]>,
  ) {
    onAssumptionsChange({ ...assumptions, [field]: value });
  }

  return (
    <div style={PANEL_STYLE}>
      {/* ── Assumption dials ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={SECTION_TITLE}>Expert Assumptions</div>
        <div style={{ fontSize: 12, color: '#718096', marginBottom: 12 }}>
          Adjust these dials to reflect your client's priorities and risk appetite.
          These inputs rank the pathways below — they do not change the physics.
        </div>

        <DialRow
          label="Disruption tolerance"
          field="disruptionTolerance"
          options={[
            { value: 'low',  label: 'Low — minimal disruption preferred' },
            { value: 'med',  label: 'Medium — some disruption acceptable' },
            { value: 'high', label: 'High — full job, do it right' },
          ]}
          assumptions={assumptions}
          onChange={updateDial}
        />
        <DialRow
          label="Screed leak risk tolerance"
          field="screedLeakRiskTolerance"
          options={[
            { value: 'cautious', label: 'Cautious — avoid risk' },
            { value: 'normal',   label: 'Normal — standard practice' },
          ]}
          assumptions={assumptions}
          onChange={updateDial}
        />
        <DialRow
          label="DHW experience priority"
          field="dhwExperiencePriority"
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'high',   label: 'High — reliable hot water is critical' },
          ]}
          assumptions={assumptions}
          onChange={updateDial}
        />
        <DialRow
          label="Future readiness priority"
          field="futureReadinessPriority"
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'high',   label: 'High — keep heat pump pathway open' },
          ]}
          assumptions={assumptions}
          onChange={updateDial}
        />
        <DialRow
          label="Comfort vs running cost"
          field="comfortVsRunningCost"
          options={[
            { value: 'balanced', label: 'Balanced' },
            { value: 'comfort',  label: 'Comfort first' },
            { value: 'cost',     label: 'Running cost first' },
          ]}
          assumptions={assumptions}
          onChange={updateDial}
        />
      </div>

      {/* ── Shared constraints ───────────────────────────────────────────── */}
      {plan.sharedConstraints.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={SECTION_TITLE}>Shared Constraints (physics facts)</div>
          <div
            style={{
              background: '#fff5f5',
              border: '1px solid #feb2b2',
              borderRadius: 6,
              padding: '10px 14px',
            }}
          >
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {plan.sharedConstraints.map((c, i) => (
                <li key={i} style={{ fontSize: 12, color: '#742a2a', marginBottom: 4 }}>
                  {c}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ fontSize: 11, color: '#718096', marginTop: 6 }}>
            The expert may adjust assumptions (above), but these constraints reflect measured physics.
          </div>
        </div>
      )}

      {/* ── Pathway options ──────────────────────────────────────────────── */}
      <div>
        <div style={SECTION_TITLE}>Pathway Options</div>
        <div style={{ fontSize: 12, color: '#718096', marginBottom: 12 }}>
          Select the pathway that best fits this property. The engine will generate
          a customer explanation based on your choice.
        </div>

        {plan.pathways.map(pathway => (
          <PathwayCard
            key={pathway.id}
            pathway={pathway}
            isSelected={pathway.id === selectedPathwayId}
            onSelect={() => onPathwaySelected(pathway.id)}
          />
        ))}
      </div>
    </div>
  );
}
